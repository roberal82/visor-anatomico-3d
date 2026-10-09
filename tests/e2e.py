import json,time
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:4173/visor-anatomico-3d/'
S='shots/'
R={}
def ok(n,c,extra=''):
    R[n]=bool(c); print(('PASS ' if c else 'FAIL ')+n,extra)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'])
    ctx=b.new_context(viewport={'width':412,'height':860},device_scale_factor=1,is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')
    pg=ctx.new_page(); logs=[]
    pg.on('console',lambda m:logs.append(m.type+': '+m.text[:250]))
    pg.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)[:400]))
    pg.on('response',lambda r:logs.append('HTTP%d %s'%(r.status,r.url)) if r.status>=400 else None)
    pg.goto(URL+'?calidad=baja')
    pg.wait_for_function('window.__visor && window.__visor.listo',timeout=180000)
    st=lambda:pg.evaluate('window.__visor.estado()')
    abierto=lambda:pg.evaluate("document.querySelector('#menu').classList.contains('abierto')")
    def esperar(max_s=40):
        prev=None;t0=time.time()
        while time.time()-t0<max_s:
            time.sleep(1.3); c=st()['camara']
            if prev and max(abs(a-b) for a,b in zip(c,prev))<1e-4: return
            prev=c
    def abre():
        if not abierto(): pg.click('#btn-menu'); time.sleep(.35)
    def cierra():
        if abierto(): pg.click('#menu-cerrar'); time.sleep(.35)
    s=st(); ok('cinco_capas_cargadas',all(v['cargada'] for v in s['capas'].values()),str({k:v['tris'] for k,v in s['capas'].items()}))
    ok('aviso_permanente_visible',pg.is_visible('#aviso') and 'no reemplaza' in pg.inner_text('#aviso'))
    # menú
    abre(); ok('menu_abre',pg.evaluate("document.querySelector('#menu').classList.contains('abierto')"))
    pg.screenshot(path=S+'02_menu.png')
    # transparencia + capa
    pg.evaluate("(()=>{const r=document.querySelector('[data-opac=piel]');r.value=60;r.dispatchEvent(new Event('input',{bubbles:true}))})()")
    ok('transparencia_piel',abs(st()['capas']['piel']['opacidad']-0.6)<0.01)
    pg.evaluate("(()=>{const c=document.querySelector('[data-capa=musculos]');c.click()})()")
    ok('toggle_musculos',st()['capas']['musculos']['visible'] is True)
    pg.evaluate("document.querySelector('[data-capa=musculos]').click()")
    ok('toggle_musculos_off',st()['capas']['musculos']['visible'] is False)
    # búsqueda
    abre(); pg.fill('#buscar','estomago'); time.sleep(.3)
    items=pg.eval_on_selector_all('#resultados button','e=>e.map(x=>x.innerText)')
    ok('busqueda_estomago',any('Estómago' in i for i in items),str(items[:3]))
    pg.click('#resultados button'); esperar()
    s=st(); ok('busqueda_selecciona',s['seleccion'] and s['seleccion']['capa']=='organos',str(s['seleccion']))
    ok('info_visible',pg.is_visible('#info') and 'Estómago' in pg.inner_text('#info'),pg.inner_text('#info')[:80].replace('\n',' | '))
    pg.screenshot(path=S+'03_busqueda.png')
    # vistas
    cierra(); pg.click('#btn-reiniciar'); esperar()
    abre(); pg.click('[data-vista=posterior]'); esperar(); c=st()['camara']; ok('vista_posterior',c[2]<-1,str([round(x,2) for x in c]))
    pg.screenshot(path=S+'04_posterior.png')
    abre(); pg.click('[data-vista=izquierda]'); esperar(); c=st()['camara']; ok('vista_izq_paciente(+X)',c[0]>1,str([round(x,2) for x in c]))
    abre(); pg.click('[data-vista=derecha]'); esperar(); c=st()['camara']; ok('vista_der_paciente(-X)',c[0]<-1)
    abre(); pg.click('[data-vista=anterior]'); esperar(); c=st()['camara']; ok('vista_anterior',c[2]>1)
    # corte
    abre(); pg.evaluate("(()=>{const r=document.querySelector('#corte');r.value=60;r.dispatchEvent(new Event('input',{bubbles:true}))})()")
    ok('corte_activo',abs(st()['corte']-1.05)<0.01,str(st()['corte']))
    cierra(); time.sleep(.5)
    pg.screenshot(path=S+'05_corte.png')
    abre(); pg.click('#corte-on'); ok('corte_apagado',st()['corte']>50)
    cierra()
    # reset
    pg.click('#btn-reiniciar'); esperar(); s=st(); ok('reset_camara',abs(s['camara'][2]-2.99)<0.1 and abs(s['camara'][0])<0.05,str(s['camara']))
    # selección por toque
    time.sleep(.3)
    # esqueleto: tocar en el esternón aprox (centro del tórax) 
    pos=pg.evaluate("window.__visor.pixelCentro('organos','Liver')"); print('liver px',pos)
    pg.touchscreen.tap(pos['x'],pos['y']); time.sleep(.6); s=st(); ok('seleccion_por_toque',s['seleccion'] is not None,str(s['seleccion'])+' '+pg.inner_text('#info')[:60].replace('\n',' | '))
    pg.screenshot(path=S+'06_seleccion.png')
    # lesión
    pg.click('#btn-lesion'); esperar()
    s=st(); v=s['validacion']; print(json.dumps(v))
    ok('lesion_activa',s['lesionActiva']); ok('lesion_validada',v and v['ok']); ok('estomago_izq_paciente',v and v['estomagoALaIzquierda'] and v['centroideEstomago'][0]>0)
    ok('marcador_visible',s['marcadorVisible']); ok('panel_lesion',pg.is_visible('#lesion-panel') and 'LESIÓN GÁSTRICA — VISUALIZACIÓN ILUSTRATIVA' in pg.inner_text('#lesion-panel'))
    pg.screenshot(path=S+'07_lesion.png')
    pg.click('#btn-volver'); esperar(); s=st(); ok('volver_general',(not s['lesionActiva']) and not s['marcadorVisible'] and s['capas']['piel']['visible'])
    pg.screenshot(path=S+'08_vuelta.png')
    errs=[l for l in logs if l.startswith(('error','PAGEERROR','HTTP'))]
    ok('sin_errores_consola',not errs,str(errs[:5]))
    # anterior con lesión: el estómago a la derecha de pantalla
    pg.click('#btn-reiniciar'); esperar()
    a=pg.evaluate("window.__visor.pixelCentro('organos','Stomach')"); h=pg.evaluate("window.__visor.pixelCentro('organos','Liver')")
    ok('estomago_a_la_derecha_en_pantalla_vista_anterior',a['x']>h['x'] and a['x']>206,'estomago x=%.0f higado x=%.0f centro=206'%(a['x'],h['x']))
    print('\n'.join(l for l in logs if not l.startswith('warning'))[:1500])
    json.dump(R,open('resultados_t2.json','w'),indent=1)
    b.close()

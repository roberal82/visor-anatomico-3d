// Resultados de estudios incorporados al visor. Solo se transcribe lo que consta en los informes del expediente.
// Sin nombre, documento, institución ni profesionales: el sitio es público. Estado de cada dato:
//   HECHO = consta en el informe · SOSPECHA = el informe lo plantea como sugestivo · PENDIENTE = no figura todavía.
export const ESTUDIOS = [
  {
    id: 'endoscopia', fecha: '24/09/2026', titulo: 'Endoscopia digestiva alta',
    items: [
      ['HECHO', 'Cuerpo gástrico, curvatura mayor, pared posterior: tumoración difusa, friable y estenosante.'],
      ['HECHO', 'Estómago con calibre y distensibilidad disminuidos. Antro, píloro (permeable) y duodeno de aspecto normal. Esófago normal.'],
      ['HECHO', 'Conclusión del informe: compatible con proceso neoformativo a nivel de cuerpo gástrico. Se tomaron biopsias.'],
    ],
  },
  {
    id: 'ecografia', fecha: '23/09/2026', titulo: 'Ecografía abdominal',
    items: [
      ['HECHO', 'Ascitis leve, heterogénea, en la región subhepática, la pelvis y los flancos.'],
      ['HECHO', 'Hígado sin lesiones.'],
      ['HECHO', 'Cola del páncreas no visualizada.'],
    ],
  },
  {
    id: 'biopsia', fecha: '30/09/2026', titulo: 'Anatomía patológica (biopsia gástrica; muestra del 24/09/2026)',
    items: [
      ['HECHO', 'Adenocarcinoma infiltrante de tipo difuso (clasificación de Lauren), pobremente diferenciado, grado 3, con células en anillo de sello.'],
      ['PENDIENTE', 'El informe no incluye estadificación, HER2, MMR/MSI, PD-L1 ni Claudina 18.2: se piden aparte.'],
    ],
  },
  {
    id: 'tomografia', fecha: '06/10/2026', titulo: 'Tomografía de tórax, abdomen y pelvis con contraste',
    items: [
      ['HECHO', 'Engrosamiento de la pared gástrica.'],
      ['HECHO', 'Ascitis.'],
      ['HECHO', 'No se describen lesiones focales en el hígado ni nódulos pulmonares sospechosos. Esto no equivale a descartar enfermedad a distancia.'],
      ['SOSPECHA', 'Hallazgos sugestivos de infiltración peritoneal (el informe lo plantea como sugestivo, no confirmado).'],
      ['PENDIENTE', 'Estadio oncológico definitivo: lo confirma el equipo médico.'],
    ],
  },
];

export const BIOPSIA_RESUMEN = 'Adenocarcinoma infiltrante de tipo difuso (Lauren), pobremente diferenciado, grado 3, con células en anillo de sello (informe del 30/09/2026).';
export const ASCITIS_NOTA = 'Ascitis leve heterogénea descrita en la ecografía (subhepática, pelvis y flancos) y ascitis en la tomografía. Las zonas celestes marcan solo DÓNDE la describe el informe; no representan volumen ni forma del líquido.';

// Configuración del módulo "LESIÓN GÁSTRICA — VISUALIZACIÓN ILUSTRATIVA".
//
// Sistema de coordenadas: el de los GLB (glTF): Y arriba, el frente del paciente mira a +Z,
// el lado IZQUIERDO del paciente es +X (en vista anterior queda a la DERECHA de la pantalla). Unidades: metros.
//
// ESTADO DE CALIBRACIÓN: VALIDADA (ver `calibracion`). La posición se calculó sobre la malla real del
// estómago de Z-Anatomy (estructura "Stomach") y se comprueba en cada carga (ver validarLesion en src/main.js).
// Si se reemplaza el modelo del estómago, hay que recalcular estos valores y poner `calibrada: false`
// hasta volver a verificarlos: con `calibrada: false` la app NO dibuja el marcador rojo.
export const LESION = {
  calibrada: true,

  organo: { en: 'Stomach', es: 'Estómago' },

  // Texto clínico: únicamente lo que consta en el informe endoscópico. No se agregan datos inventados.
  descripcion: {
    organo: 'Estómago',
    region: 'Cuerpo gástrico',
    localizacion: 'Curvatura mayor, pared posterior',
    endoscopia: 'Tumoración difusa, friable y estenosante',
  },
  aviso: 'Representación aproximada e ilustrativa de la ubicación. No se conocen —y por eso no se muestran— estadio definitivo, ' +
         'metástasis confirmadas, dimensiones, profundidad de invasión ni extensión exacta.',

  // Marcador: punto sobre la superficie posterior del estómago (cuerpo, cerca de la curvatura mayor, lado izquierdo del paciente).
  marcador: {
    posicion: [0.0910, 1.1699, 0.0021],     // vértice de la malla del estómago
    normal: [0.666, -0.290, -0.688],        // hacia afuera de la pared: izquierda, abajo y atrás
    separacion: 0.004,                      // m, para que no quede dentro de la pared
    radio: 0.006,                           // m, tamaño visual del marcador (NO es el tamaño del tumor)
    color: '#ff2a2a',
    pulso: { amplitud: 0.35, frecuenciaHz: 1.1 },
  },

  // Cámara al enfocar. Se mira al marcador desde atrás y a la izquierda del paciente (la pared posterior no se ve desde delante).
  camara: {
    objetivo: [0.049, 1.171, 0.039],        // centro del estómago
    direccion: [0.55, 0.15, -0.82],         // desde dónde se mira (normalizada al usarla)
    distancia: 0.5,
  },

  // Región anatómica descrita (cuerpo gástrico, curvatura mayor, pared posterior), como fracciones de la caja del estómago.
  // Es una zona orientativa para resaltar el sector; NO representa el tamaño ni la extensión del tumor.
  region: { y: [0.28, 0.72], xMin: 0.5, zMax: 0.5, suavizado: 0.12, color: '#ffb347' },

  // Datos de la calibración, para poder repetirla.
  calibracion: {
    fuente: 'Z-Anatomy, estructura "Stomach" (2598 vértices en la capa de órganos, calidad alta)',
    caja_estomago: { min: [-0.029, 1.104, -0.017], max: [0.105, 1.229, 0.089] },
    fraccion_en_caja: { x: 0.89, y: 0.53, z: 0.18 },   // x: 0 = lado derecho del paciente, 1 = izquierdo; y: 0 = abajo; z: 0 = posterior
    criterio: 'tercio medio vertical del estómago (cuerpo), cuarto más a la izquierda del paciente, tercio posterior; ' +
              'vértice más cercano al centroide de ese conjunto',
  },

  // Tolerancias de la validación automática al cargar.
  validacion: { distMaxSuperficie: 0.006, fracYMin: 0.3, fracYMax: 0.7, minLadoIzq: 0.75, maxPosterior: 0.35 },
};

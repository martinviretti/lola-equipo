// Los 3 niveles del examen (diseño en DISENO-EXAMEN.md). Las preguntas de cada nivel están en
// src/data/examen.json con su campo "nivel".

/** Porcentaje mínimo para aprobar cualquier nivel. */
export const APRUEBA = 80;
/** Preguntas clave (seguridad) que trae cada examen: errar una es no aprobar. */
export const CRITICAS_POR_EXAMEN = 3;

export const NIVELES = [
  {
    numero: 1,
    nombre: 'Básico',
    subtitulo: 'Lo mínimo para atender sin meter la pata.',
    cuando: 'Ideal: tu primera semana',
    preguntas: 15,
    minutos: 8,
    mezcla: { vf: 6, opcion: 6, situacion: 2, unir: 1 },
    entra: [
      'Qué hay en cada góndola y para qué lo busca la gente',
      'Sin TACC: el logo y por qué el granel no sirve',
      'Alergias: qué preguntar antes de recomendar',
      'Qué tiene cafeína y qué no',
      'Por qué nunca prometemos curas',
    ],
  },
  {
    numero: 2,
    nombre: 'Intermedio',
    subtitulo: 'Conocer los productos y saber recomendar.',
    cuando: 'Ideal: tu primer mes',
    preguntas: 20,
    minutos: 12,
    mezcla: { vf: 4, opcion: 7, situacion: 6, unir: 3 },
    entra: [
      'Diferencias entre tipos: harinas, leches, frutos secos, endulzantes',
      'Cómo se usa cada cosa y con qué se reemplaza',
      'Cómo se conserva cada producto',
      'Clientes celíacos, veganos o que cuidan el azúcar',
    ],
  },
  {
    numero: 3,
    nombre: 'Experto',
    subtitulo: 'Responder lo difícil y ser la referencia del local.',
    cuando: 'Ideal: a los tres meses',
    preguntas: 20,
    minutos: 15,
    mezcla: { vf: 2, opcion: 5, situacion: 11, unir: 2 },
    entra: [
      'Propiedades: qué aporta cada producto comparado con otro',
      'Precauciones de yuyos y suplementos',
      'Casos combinados: celíaco y vegano, embarazo, medicación',
      'Cuándo derivar al médico o a la encargada',
    ],
  },
] as const;

// Los 3 niveles del examen (diseño en DISENO-EXAMEN.md). Las preguntas están en
// src/data/examen/<tema>.json, cada una con su "nivel" (reglas en EXAMEN-BANCO.md).

/** Porcentaje mínimo para aprobar cualquier nivel. */
export const APRUEBA = 80;

export const NIVELES = [
  {
    numero: 1,
    nombre: 'Básico',
    subtitulo: 'Lo mínimo para atender sin meter la pata.',
    cuando: 'Ideal: tu primera semana',
    preguntas: 40,
    minutos: 20,
    mezcla: { vf: 15, opcion: 16, situacion: 6, unir: 3 },
    entra: [
      'Todas las góndolas: qué es cada producto principal y para qué lo busca la gente',
      'Yerbas, tés, cafés, yuyos y bebidas',
      'Harinas, cereales, legumbres, panes y pastas',
      'Frutos secos, semillas, desecadas, leches vegetales, yogures, endulzantes, aceites y especias',
      'Sin TACC, alergias, cadena de frío y por qué nunca prometemos curas',
    ],
  },
  {
    numero: 2,
    nombre: 'Intermedio',
    subtitulo: 'Conocer los productos y saber recomendar.',
    cuando: 'Ideal: tu primer mes',
    preguntas: 30,
    minutos: 18,
    mezcla: { vf: 6, opcion: 11, situacion: 9, unir: 4 },
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
    preguntas: 30,
    minutos: 20,
    mezcla: { vf: 3, opcion: 8, situacion: 16, unir: 3 },
    entra: [
      'Propiedades: qué aporta cada producto comparado con otro',
      'Precauciones de yuyos y suplementos',
      'Casos combinados: celíaco y vegano, embarazo, medicación',
      'Cuándo derivar al médico o a la encargada',
    ],
  },
] as const;

/** Temas del banco, en el orden en que se muestran (uno por archivo en src/data/examen). */
export const TEMAS = [
  'La dietética y los conceptos básicos',
  'Celiaquía y sin TACC',
  'Alergias e intolerancias',
  'Yerbas y mate',
  'Tés y cafés',
  'Yuyos y hierbas',
  'Bebidas',
  'Frutos secos',
  'Semillas',
  'Frutas desecadas',
  'Galletitas, snacks y chocolates',
  'Harinas',
  'Cereales y arroces',
  'Legumbres',
  'Panes y pastas',
  'Leches vegetales',
  'Yogures, quesos y heladera',
  'Endulzantes',
  'Aceites y untables',
  'Especias, condimentos y conservas',
  'Vegano y vegetariano',
  'Congelados y cadena de frío',
  'Suplementos',
  'Cosmética natural',
];

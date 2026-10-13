// Contenido de la pestaña Bienvenida: el "Manual de manejo y orientación" del local
// (reglas internas, tareas por rol, cierre, imagen, horarios, celular y música).
// Fuente: el manual en PDF que armó la encargada (Lola_mento.pdf).

export interface Item {
  icono: string;
  titulo: string;
  texto?: string;
}

export const atencion = {
  objetivo: 'Que cada cliente se vaya bien atendido: con amabilidad, a su medida y sin demoras.',
  pasos: [
    { icono: 'smiley', titulo: 'Saludá', texto: 'Con “¡Buen día!” o “¡Buenas tardes!” y una sonrisa.' },
    { icono: 'question', titulo: 'Ofrecé ayuda', texto: 'Preguntá: “¿Te puedo ayudar en algo?”' },
    { icono: 'info', titulo: 'Informá', texto: 'Contá para qué sirve cada producto, cómo se usa, sus propiedades y con qué se reemplaza.' },
    { icono: 'cash-register', titulo: 'Acompañá', texto: 'Acompañá al cliente a la caja y consultá si necesita algo más.' },
    { icono: 'heart', titulo: 'Despedí', texto: '“¡Muchas gracias por tu compra, que tengas un lindo día!”' },
  ] satisfies Item[],
};

export const tareasGenerales = {
  objetivo: 'Dejar el local limpio, ordenado y con todo lo necesario.',
  grupos: [
    {
      titulo: 'Control y organización',
      icono: 'clipboard-text',
      items: [
        { icono: 'notebook', titulo: 'Usar el cuaderno de faltantes' },
        { icono: 'receipt', titulo: 'Anotar los tickets' },
        { icono: 'tag', titulo: 'Controlar precios y vencimientos' },
        { icono: 'percent', titulo: 'Promociones' },
      ],
    },
    {
      titulo: 'Limpieza y mantenimiento',
      icono: 'broom',
      items: [
        { icono: 'basket', titulo: 'Góndolas ordenadas' },
        { icono: 'broom', titulo: 'Limpieza general del local' },
        { icono: 'snowflake', titulo: 'Limpieza y control de heladeras y freezers' },
      ],
    },
    {
      titulo: 'Abastecimiento',
      icono: 'package',
      items: [
        { icono: 'package', titulo: 'Reposición de mercadería' },
        { icono: 'clipboard-text', titulo: 'Listas de pedidos y rutas' },
        { icono: 'truck', titulo: 'Control de proveedores' },
      ],
    },
    {
      titulo: 'Colaboración',
      icono: 'users-three',
      items: [
        { icono: 'smiley', titulo: 'Buen ambiente laboral' },
        { icono: 'hand-heart', titulo: 'Apoyo entre compañeras' },
        { icono: 'chat-circle-dots', titulo: 'Comunicación efectiva' },
      ],
    },
  ] satisfies { titulo: string; icono: string; items: Item[] }[],
};

export const roles = [
  {
    titulo: 'Vendedoras',
    icono: 'users-three',
    tareas: [
      'Atención al cliente',
      'Reposición, orden y limpieza de góndolas',
      'Limpieza profunda los sábados',
      'Control de listas y precios',
      'Limpieza de vidrios, vereda, pisos y baños',
      'Ayuda en caja cuando sea necesario',
    ],
  },
  {
    titulo: 'Cajera',
    icono: 'cash-register',
    tareas: [
      'Cobro eficiente',
      'Mantener la caja ordenada',
      'Apertura y cierre de caja',
      'Ayudar a embolsar la mercadería',
      'Cobro con tarjeta o Mercado Pago en eventos',
      'Limpieza del área de caja',
    ],
  },
  {
    titulo: 'Vidrieras',
    icono: 'storefront',
    tareas: [
      'Limpieza cada 15 días',
      'Renovación de productos cada 15 días',
      'Presentación atractiva de los productos',
      'Destacar los productos de temporada',
      'Mantener una estética coherente',
    ],
  },
  {
    titulo: 'Encargada',
    icono: 'seal-check',
    tareas: [
      'Apertura del local',
      'Supervisión de limpieza y orden',
      'Control de stock y pedidos',
      'Apoyo en ventas y caja',
      'Recepción de proveedores',
      'Cobro de tickets a vendedoras',
      'Coordinación de promociones',
    ],
  },
];

export const cierre = {
  objetivo: 'Dejar el local listo para el día siguiente.',
  pasos: [
    { icono: 'basket', titulo: 'Frenteá los productos', texto: 'Acomodá todos los productos hacia el frente de las góndolas.' },
    { icono: 'fork-knife', titulo: 'Lavá los utensilios', texto: 'Lavá y guardá todo lo que se usó durante el día.' },
    { icono: 'power', titulo: 'Desenchufá y apagá los equipos', texto: 'Fijate que no quede ningún equipo eléctrico prendido.' },
    { icono: 'broom', titulo: 'Barré y pasá el trapo', texto: 'Todo el piso del local, para que quede impecable.' },
    { icono: 'bicycle', titulo: 'Entrá las plantas y las bicis', texto: 'Todo lo que está en la entrada del local.' },
    { icono: 'lock-key', titulo: 'Bajá las persianas y cerrá la puerta', texto: 'Asegurate de que el local quede bien cerrado.' },
  ] satisfies Item[],
  responsable: 'Quien esté a cargo revisa que esté todo hecho antes de irse.',
};

export const imagen = {
  objetivo: 'Todas venimos con el uniforme y una presentación prolija.',
  items: [
    { icono: 't-shirt', titulo: 'Pantalón', texto: 'Negro o jean. Es la base del uniforme diario.' },
    { icono: 't-shirt', titulo: 'Remera y delantal', texto: 'Limpios y sin manchas. El uniforme se usa siempre.' },
    { icono: 'user-circle', titulo: 'Cabello', texto: 'Recogido, por higiene y presentación.' },
    { icono: 'hand-heart', titulo: 'Uñas', texto: 'Cortas y limpias, por higiene al manipular alimentos.' },
    { icono: 'sparkle', titulo: 'Maquillaje', texto: 'Suave y natural, con apariencia profesional.' },
    { icono: 'sneaker', titulo: 'Calzado', texto: 'Cómodo y adecuado para jornadas largas.' },
  ] satisfies Item[],
  nota: 'Cómo nos ven también es parte de cómo atendemos.',
};

export const horarios = {
  objetivo: 'Los horarios de entrada y de descanso, para organizarnos entre todas.',
  momentos: [
    { icono: 'door', titulo: 'Ingreso', valor: '10 minutos antes', texto: 'Para preparar todo antes de abrir.' },
    { icono: 'fork-knife', titulo: 'Almuerzo', valor: '13:30 a 14:30', texto: 'En turnos coordinados entre compañeras.' },
    { icono: 'coffee', titulo: 'Merienda', valor: '16:00 a 17:00', texto: 'En turnos coordinados entre compañeras.' },
    { icono: 'timer', titulo: 'Descanso', valor: '20 minutos', texto: 'Cada 8 horas de trabajo.' },
  ],
  nota: 'En los descansos, dejá los utensilios comunes limpios y en su lugar.',
};

export const celular = {
  objetivo: 'Mientras trabajás, el celular queda guardado.',
  principal: 'Durante todo tu horario, el celular va en la caja que tenemos para eso.',
  reglas: [
    { icono: 'instagram-logo', titulo: 'Redes sociales', texto: 'Mientras trabajás, nada de redes.', permitido: false },
    { icono: 'warning', titulo: 'Urgencias', texto: 'Si surge una emergencia, lo podés usar.', permitido: true },
    { icono: 'briefcase', titulo: 'Temas laborales', texto: 'Sí, si es algo del trabajo.', permitido: true },
  ],
  nota: 'Con el celular guardado estamos más atentas a cada cliente.',
};

export const musica = {
  objetivo: 'Mejor en inglés y a volumen bajo, para que el local tenga un ambiente tranquilo.',
  estilos: [
    { icono: 'guitar', titulo: 'Indie pop', texto: 'Alegre y relajado' },
    { icono: 'headphones', titulo: 'Lo-fi chill', texto: 'Para un ambiente tranquilo' },
    { icono: 'music-notes', titulo: 'Jazz instrumental', texto: 'Elegante y sofisticado' },
    { icono: 'guitar', titulo: 'Soft acoustic / folk', texto: 'Cálido y acogedor' },
  ],
  playlists: ['Café Atmosphere', 'Organic Vibes', 'Wellness Background'],
  artistas: ['Jack Johnson', 'Norah Jones', 'Zero 7', 'Kings of Convenience', 'Ben Howard', 'Angus & Julia Stone'],
};

export const cierreManual = 'Cuidar estos acuerdos nos ayuda a trabajar tranquilas y a atender mejor.';

/** Los temas de la página, agrupados en tres bloques. */
export const grupos = [
  {
    id: 'atender',
    titulo: 'Atender',
    bajada: 'Cómo recibimos a cada cliente y lo que nunca se negocia.',
    secciones: [
      { id: 'atencion', icono: 'hand-waving', titulo: 'Atención al cliente', resumen: 'Los 5 pasos con cada cliente.' },
      { id: 'reglas', icono: 'shield-check', titulo: 'Las 5 reglas de mostrador', resumen: 'Lo que nunca se negocia con un cliente.' },
    ],
  },
  {
    id: 'dia-a-dia',
    titulo: 'El día a día',
    bajada: 'Cómo nos organizamos para que el local funcione.',
    secciones: [
      { id: 'tareas', icono: 'clipboard-text', titulo: 'Tareas generales', resumen: 'Orden, limpieza y abastecimiento.' },
      { id: 'roles', icono: 'users-three', titulo: 'Tareas por rol', resumen: 'Qué hace cada una en el local.' },
      { id: 'cierre', icono: 'lock-key', titulo: 'Cierre del local', resumen: 'La lista para dejar todo listo.' },
    ],
  },
  {
    id: 'acuerdos',
    titulo: 'Nuestros acuerdos',
    bajada: 'Lo que acordamos entre todas para trabajar bien.',
    secciones: [
      { id: 'imagen', icono: 't-shirt', titulo: 'Imagen y uniforme', resumen: 'Uniforme y presentación.' },
      { id: 'horarios', icono: 'clock', titulo: 'Horarios y descansos', resumen: 'Ingreso, almuerzo, merienda y descansos.' },
      { id: 'celular', icono: 'device-mobile-slash', titulo: 'Uso del celular', resumen: 'Cuándo se puede usar y cuándo no.' },
      { id: 'musica', icono: 'music-notes', titulo: 'Música en el local', resumen: 'Qué poner y a qué volumen.' },
    ],
  },
];

/** Todos los temas, en orden. */
export const secciones = grupos.flatMap((g) => g.secciones);

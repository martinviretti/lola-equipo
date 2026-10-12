// Contenido de la pestaña Bienvenida: el "Manual de manejo y orientación" del local
// (reglas internas, tareas por rol, cierre, imagen, horarios, celular y música).
// Fuente: el manual en PDF que armó la encargada (Lola_mento.pdf).

export interface Item {
  icono: string;
  titulo: string;
  texto?: string;
}

export const atencion = {
  objetivo: 'Brindar una experiencia de compra amable, personalizada y eficiente.',
  pasos: [
    { icono: 'smiley', titulo: 'Saludá', texto: 'Con “¡Buen día!” o “¡Buenas tardes!” y una sonrisa.' },
    { icono: 'question', titulo: 'Ofrecé ayuda', texto: 'Preguntá: “¿Te puedo ayudar en algo?”' },
    { icono: 'info', titulo: 'Informá', texto: 'Contá para qué sirve cada producto, cómo se usa, sus propiedades y con qué se reemplaza.' },
    { icono: 'cash-register', titulo: 'Acompañá', texto: 'Acompañá al cliente a la caja y consultá si necesita algo más.' },
    { icono: 'heart', titulo: 'Despedí', texto: '“¡Muchas gracias por tu compra, que tengas un lindo día!”' },
  ] satisfies Item[],
  beneficios: [
    { valor: '10%', texto: 'de descuento en compras habituales' },
    { valor: '15%', texto: 'de descuento en compras de mayor volumen' },
  ],
};

export const tareasGenerales = {
  objetivo: 'Mantener la tienda en condiciones óptimas de limpieza, orden y abastecimiento.',
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
    { icono: 'basket', titulo: 'Frenteo de productos', texto: 'Ordenar y acomodar todos los productos hacia el frente de las góndolas.' },
    { icono: 'fork-knife', titulo: 'Limpieza de utensilios', texto: 'Lavar y guardar todos los utensilios usados durante el día.' },
    { icono: 'power', titulo: 'Desenchufar y apagar equipos', texto: 'Verificar que todos los equipos electrónicos estén apagados.' },
    { icono: 'broom', titulo: 'Barrer y pasar trapo', texto: 'Limpiar el piso de todo el local para dejarlo impecable.' },
    { icono: 'bicycle', titulo: 'Guardar plantas y bicicletas', texto: 'Entrar lo que está en la entrada del local.' },
    { icono: 'lock-key', titulo: 'Bajar persianas y cerrar la puerta', texto: 'Asegurar bien el local al terminar.' },
  ] satisfies Item[],
  responsable: 'Quien esté a cargo verifica que todo esté hecho antes de retirarse.',
};

export const imagen = {
  objetivo: 'Mantener una imagen profesional y el uniforme para todo el personal.',
  items: [
    { icono: 't-shirt', titulo: 'Pantalón', texto: 'Negro o jean. Es la base del uniforme diario.' },
    { icono: 't-shirt', titulo: 'Remera y delantal', texto: 'Limpios y sin manchas. El uniforme es obligatorio.' },
    { icono: 'user-circle', titulo: 'Cabello', texto: 'Recogido, por higiene y presentación.' },
    { icono: 'hand-heart', titulo: 'Uñas', texto: 'Cortas y limpias, por higiene al manipular alimentos.' },
    { icono: 'sparkle', titulo: 'Maquillaje', texto: 'Suave y natural, con apariencia profesional.' },
    { icono: 'sneaker', titulo: 'Calzado', texto: 'Cómodo y adecuado para jornadas largas.' },
  ] satisfies Item[],
  nota: 'La imagen personal refleja la identidad de nuestra dietética.',
};

export const horarios = {
  objetivo: 'Organizar los tiempos para un ambiente de trabajo eficiente y armonioso.',
  momentos: [
    { icono: 'door', titulo: 'Ingreso', valor: '10 minutos antes', texto: 'Para preparar todo antes de abrir.' },
    { icono: 'fork-knife', titulo: 'Almuerzo', valor: '13:30 a 14:30', texto: 'En turnos coordinados entre compañeras.' },
    { icono: 'coffee', titulo: 'Merienda', valor: '16:00 a 17:00', texto: 'En turnos coordinados entre compañeras.' },
    { icono: 'timer', titulo: 'Descanso', valor: '20 minutos', texto: 'Cada 8 horas de trabajo.' },
  ],
  nota: 'Mantené el orden en el uso de los utensilios comunes durante los descansos.',
};

export const celular = {
  objetivo: 'Uso responsable del celular durante el horario de trabajo.',
  principal: 'Los celulares se guardan en la caja designada durante todo el horario laboral.',
  reglas: [
    { icono: 'instagram-logo', titulo: 'Redes sociales', texto: 'No se pueden usar durante el horario de trabajo.', permitido: false },
    { icono: 'warning', titulo: 'Urgencias', texto: 'Uso excepcional para situaciones de emergencia.', permitido: true },
    { icono: 'briefcase', titulo: 'Temas laborales', texto: 'Solo para cosas relacionadas con el trabajo.', permitido: true },
  ],
  nota: 'Cumplir estas normas ayuda a trabajar mejor y a atender con profesionalismo.',
};

export const musica = {
  objetivo: 'Preferentemente en inglés y a volumen bajo, para un ambiente relajado y agradable.',
  estilos: [
    { icono: 'guitar', titulo: 'Indie pop', texto: 'Alegre y relajado' },
    { icono: 'headphones', titulo: 'Lo-fi chill', texto: 'Para un ambiente tranquilo' },
    { icono: 'music-notes', titulo: 'Jazz instrumental', texto: 'Elegante y sofisticado' },
    { icono: 'guitar', titulo: 'Soft acoustic / folk', texto: 'Cálido y acogedor' },
  ],
  playlists: ['Café Atmosphere', 'Organic Vibes', 'Wellness Background'],
  artistas: ['Jack Johnson', 'Norah Jones', 'Zero 7', 'Kings of Convenience', 'Ben Howard', 'Angus & Julia Stone'],
};

export const cierreManual =
  'Cumplir este manual es fundamental para mantener un ambiente profesional, ordenado y armónico para todo el equipo.';

/** Índice de la página, en orden. */
export const secciones = [
  { id: 'atencion', icono: 'hand-waving', titulo: 'Atención al cliente' },
  { id: 'reglas', icono: 'shield-check', titulo: 'Reglas de mostrador' },
  { id: 'tareas', icono: 'clipboard-text', titulo: 'Tareas generales' },
  { id: 'roles', icono: 'users-three', titulo: 'Tareas por rol' },
  { id: 'cierre', icono: 'lock-key', titulo: 'Cierre del local' },
  { id: 'imagen', icono: 't-shirt', titulo: 'Imagen y uniforme' },
  { id: 'horarios', icono: 'clock', titulo: 'Horarios y descansos' },
  { id: 'celular', icono: 'device-mobile-slash', titulo: 'Uso del celular' },
  { id: 'musica', icono: 'music-notes', titulo: 'Música en el local' },
];

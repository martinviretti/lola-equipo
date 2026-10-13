// Sub-pestañas de una parte del panel de admin (Hoy y semana, Día a día, Aparatos y ajustes…): se ve
// una sección por vez y queda anotada en la dirección (#dia), así al recargar se vuelve al mismo lugar.
// Después de la vista pueden venir datos para esa vista: #dia/2026-10-07/ana@gmail.com.
// Las secciones llevan data-vista="id" y los botones data-vista-boton="id" (componente VistasPanel).

/** Lo que viene después de la vista en la dirección (por ejemplo, el día y la persona). */
export const parametrosVista = () => location.hash.slice(1).split('/').slice(1).map(decodeURIComponent);

export function mostrarVista(pedida: string) {
  let id = pedida.split('/')[0];
  const botones = [...document.querySelectorAll<HTMLButtonElement>('[data-vista-boton]')];
  if (!botones.some((b) => b.dataset.vistaBoton === id)) id = botones[0]?.dataset.vistaBoton ?? '';
  for (const b of botones) b.setAttribute('aria-pressed', String(b.dataset.vistaBoton === id));
  document.querySelectorAll<HTMLElement>('[data-vista]').forEach((s) => (s.hidden = s.dataset.vista !== id));
  if (location.hash.slice(1).split('/')[0] !== id) history.replaceState(null, '', `#${id}`);
  dispatchEvent(new CustomEvent('vista', { detail: id }));
}

/** Lleva la vista a la pantalla (por ejemplo, al saltar desde la planilla al día). */
export function irAVista(id: string) {
  mostrarVista(id);
  const nav = document.querySelector('[data-vistas]');
  if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start' });
}

export function iniciarVistas() {
  document.querySelectorAll<HTMLButtonElement>('[data-vista-boton]').forEach((b) =>
    b.addEventListener('click', () => {
      history.replaceState(null, '', `#${b.dataset.vistaBoton}`);
      irAVista(b.dataset.vistaBoton!);
    }),
  );
  addEventListener('hashchange', () => mostrarVista(location.hash.slice(1)));
  mostrarVista(location.hash.slice(1));
}

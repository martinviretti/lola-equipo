// Sub-pestañas de una parte del panel de admin (Resumen, Día a día, Configuración…): se ve una
// sección por vez y queda anotada en la dirección (#dia), así al recargar se vuelve al mismo lugar.
// Las secciones llevan data-vista="id" y los botones data-vista-boton="id" (componente VistasPanel).

export function mostrarVista(id: string) {
  const botones = [...document.querySelectorAll<HTMLButtonElement>('[data-vista-boton]')];
  if (!botones.some((b) => b.dataset.vistaBoton === id)) id = botones[0]?.dataset.vistaBoton ?? '';
  for (const b of botones) b.setAttribute('aria-pressed', String(b.dataset.vistaBoton === id));
  document.querySelectorAll<HTMLElement>('[data-vista]').forEach((s) => (s.hidden = s.dataset.vista !== id));
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
  dispatchEvent(new CustomEvent('vista', { detail: id }));
}

/** Lleva la vista a la pantalla (por ejemplo, al saltar desde la planilla al día). */
export function irAVista(id: string) {
  mostrarVista(id);
  const nav = document.querySelector('[data-vistas]');
  if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start' });
}

export function iniciarVistas() {
  document.querySelectorAll<HTMLButtonElement>('[data-vista-boton]').forEach((b) => b.addEventListener('click', () => irAVista(b.dataset.vistaBoton!)));
  addEventListener('hashchange', () => mostrarVista(location.hash.slice(1)));
  mostrarVista(location.hash.slice(1));
}

// Capas a pantalla completa del fichador (resultado, activar, registro, problema): una visible a la vez.
const capas = () => [...document.querySelectorAll<HTMLElement>('[data-capa]')];

export const mostrarCapa = (nombre: string | null) => capas().forEach((c) => c.classList.toggle('hidden', c.dataset.capa !== nombre));
export const capaVisible = () => capas().find((c) => !c.classList.contains('hidden'))?.dataset.capa ?? null;

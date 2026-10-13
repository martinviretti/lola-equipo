// Aviso breve abajo de la pantalla ("Guardada en Guardados", "No se pudo guardar: probá de nuevo").
// Reemplaza a alert(): no frena la pantalla y se va solo. Estilos en global.css (.aviso).

interface Opciones {
  /** Botón opcional dentro del aviso, por ejemplo "Deshacer". */
  accion?: { texto: string; alTocar: () => void };
  /** Cuánto queda a la vista, en milisegundos (con botón, un poco más). */
  ms?: number;
}

let actual: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const cerrar = (el: HTMLElement) => {
  el.classList.remove('visible');
  setTimeout(() => el.remove(), 220);
  if (actual === el) actual = null;
};

/** Muestra un aviso. Si había otro, lo reemplaza. */
export function avisar(texto: string, { accion, ms }: Opciones = {}) {
  if (actual) cerrar(actual);
  clearTimeout(timer);
  const el = document.createElement('div');
  el.className = 'aviso';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const t = document.createElement('span');
  t.textContent = texto;
  el.append(t);
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aviso-accion';
    b.textContent = accion.texto;
    b.addEventListener('click', () => {
      accion.alTocar();
      cerrar(el);
    });
    el.append(b);
  }
  document.body.append(el);
  actual = el;
  requestAnimationFrame(() => el.classList.add('visible'));
  timer = setTimeout(() => cerrar(el), ms ?? (accion ? 5000 : 3000));
}

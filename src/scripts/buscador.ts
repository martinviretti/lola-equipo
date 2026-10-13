import { url } from '../lib/url';
// Buscador sobre /buscar.json (guía primero, después el manual completo).
interface Entrada {
  modulo: string;
  titulo: string;
  url: string;
  texto: string;
  guia?: boolean;
}
type Indexada = Entrada & { n: string; nt: string };

/** Resultados que se muestran de entrada (y cuántos más suma cada "Ver más"). */
const TANDA = 8;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function fragmento(texto: string, termino: string) {
  const i = norm(texto).indexOf(termino);
  if (i < 0) return escapar(texto.slice(0, 140)) + (texto.length > 140 ? '…' : '');
  const desde = Math.max(0, i - 60);
  const hasta = Math.min(texto.length, i + termino.length + 80);
  return `${desde > 0 ? '…' : ''}${escapar(texto.slice(desde, i))}<mark class="rounded bg-menta px-0.5 text-profundo">${escapar(
    texto.slice(i, i + termino.length),
  )}</mark>${escapar(texto.slice(i + termino.length, hasta))}${hasta < texto.length ? '…' : ''}`;
}

export function initBuscador() {
  const input = document.querySelector<HTMLInputElement>('#buscador');
  const lista = document.querySelector<HTMLOListElement>('[data-resultados]');
  const estado = document.querySelector<HTMLElement>('[data-buscador-estado]');
  if (!input || !lista || !estado) return;

  // Si la descarga falla (sin red), no se guarda el error: el próximo intento la vuelve a pedir.
  let indice: Indexada[] | null = null;
  let pedido: Promise<Indexada[]> | null = null;
  const cargar = () =>
    indice
      ? Promise.resolve(indice)
      : (pedido ??= fetch(url('/buscar.json'))
          .then((r) => {
            if (!r.ok) throw new Error(`No se pudo bajar buscar.json (HTTP ${r.status})`);
            return r.json() as Promise<Entrada[]>;
          })
          .then((datos) => (indice = datos.map((e) => ({ ...e, n: norm(e.texto), nt: norm(e.titulo) }))))
          .finally(() => (pedido = null)));

  // "Ver más": suma otra tanda de resultados.
  const verMas = document.createElement('button');
  verMas.type = 'button';
  verMas.className = 'boton boton-secundario mt-3 w-full';
  verMas.textContent = 'Ver más';
  verMas.hidden = true;
  lista.after(verMas);

  let mostrar = TANDA;
  let ultima = '';

  const error = () => {
    lista.innerHTML = '';
    verMas.hidden = true;
    estado.classList.remove('hidden');
    const texto = document.createElement('span');
    texto.textContent = 'Sin conexión: probá de nuevo en un rato.';
    const reintentar = document.createElement('button');
    reintentar.type = 'button';
    reintentar.className =
      'inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-profundo ring-1 ring-profundo/15 hover:bg-menta-suave';
    reintentar.textContent = 'Reintentar';
    reintentar.addEventListener('click', () => {
      estado.textContent = 'Buscando…';
      input.focus();
      void buscar();
    });
    const fila = document.createElement('span');
    fila.className = 'flex flex-wrap items-center gap-x-3 gap-y-2';
    fila.append(texto, reintentar);
    estado.replaceChildren(fila);
  };

  let temporizador: number | undefined;
  const buscar = async () => {
    const q = norm(input.value.trim());
    if (q !== ultima) {
      ultima = q;
      mostrar = TANDA;
    }
    if (q.length < 2) {
      lista.innerHTML = '';
      verMas.hidden = true;
      estado.classList.add('hidden');
      return;
    }
    let datos: Indexada[];
    try {
      datos = await cargar();
    } catch (e) {
      console.error(e);
      // Solo si sigue buscando lo mismo (pudo haber borrado mientras tanto).
      if (norm(input.value.trim()) === q) error();
      return;
    }
    if (norm(input.value.trim()) !== q) return; // escribió algo más: ya viene otra búsqueda
    const terminos = q.split(/\s+/).filter(Boolean);
    const todos = datos
      .flatMap((e) => {
        if (!terminos.every((t) => e.n.includes(t) || e.nt.includes(t))) return [];
        const puntaje =
          (e.guia ? 30 : 0) + terminos.reduce((s, t) => s + (e.nt.includes(t) ? 10 : 0) + (e.n.split(t).length - 1), 0);
        return [{ e, puntaje }];
      })
      .sort((a, b) => b.puntaje - a.puntaje);
    const res = todos.slice(0, mostrar);

    estado.classList.remove('hidden');
    estado.textContent = !todos.length
      ? 'No encontramos nada. Probá con otra palabra o preguntale a la encargada.'
      : res.length < todos.length
        ? `${res.length} de ${todos.length} resultados`
        : `${todos.length} resultado${todos.length > 1 ? 's' : ''}`;
    lista.innerHTML = res
      .map(
        ({ e }) => `<li><a href="${e.url}" class="block rounded-2xl bg-white p-4 ring-1 ring-profundo/10 hover:bg-menta-suave">
          <span class="text-xs font-semibold ${e.guia ? 'text-marca-texto' : 'text-texto-2'}">${escapar(e.modulo)}</span>
          <span class="mt-1 block font-semibold text-profundo">${escapar(e.titulo)}</span>
          <span class="mt-1 block text-sm text-texto-2">${fragmento(e.texto, terminos[0])}</span>
        </a></li>`,
      )
      .join('');
    const faltan = todos.length - res.length;
    verMas.hidden = faltan <= 0;
  };

  verMas.addEventListener('click', async () => {
    const antes = lista.children.length;
    mostrar += TANDA;
    await buscar();
    // El foco va al primer resultado nuevo, para seguir leyendo desde ahí.
    lista.children[antes]?.querySelector<HTMLAnchorElement>('a')?.focus();
  });

  // Se baja apenas tocás el campo, así la primera búsqueda sale al instante (si falla, se reintenta al buscar).
  input.addEventListener('focus', () => void cargar().catch(() => {}), { once: true });
  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = window.setTimeout(buscar, 150);
  });
  if (location.hash === '#buscar') input.focus();
}

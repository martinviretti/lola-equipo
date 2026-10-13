import { url } from '../lib/url';
// Buscador sobre /buscar.json (guía primero, después el manual completo).
interface Entrada {
  modulo: string;
  titulo: string;
  url: string;
  texto: string;
  guia?: boolean;
}

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

  let indice: (Entrada & { n: string; nt: string })[] | null = null;
  const cargar = async () => {
    if (indice) return indice;
    const datos: Entrada[] = await (await fetch(url('/buscar.json'))).json();
    indice = datos.map((e) => ({ ...e, n: norm(e.texto), nt: norm(e.titulo) }));
    return indice;
  };

  let temporizador: number | undefined;
  const buscar = async () => {
    const q = norm(input.value.trim());
    if (q.length < 2) {
      lista.innerHTML = '';
      estado.classList.add('hidden');
      return;
    }
    const datos = await cargar();
    const terminos = q.split(/\s+/).filter(Boolean);
    const res = datos
      .flatMap((e) => {
        if (!terminos.every((t) => e.n.includes(t) || e.nt.includes(t))) return [];
        const puntaje =
          (e.guia ? 30 : 0) + terminos.reduce((s, t) => s + (e.nt.includes(t) ? 10 : 0) + (e.n.split(t).length - 1), 0);
        return [{ e, puntaje }];
      })
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 8);

    estado.classList.remove('hidden');
    estado.textContent = res.length
      ? `${res.length} resultado${res.length > 1 ? 's' : ''}`
      : 'No encontramos nada. Probá con otra palabra o preguntale a la encargada.';
    lista.innerHTML = res
      .map(
        ({ e }) => `<li><a href="${e.url}" class="block rounded-2xl bg-white p-4 ring-1 ring-profundo/10 hover:bg-menta-suave">
          <span class="text-xs font-semibold ${e.guia ? 'text-marca-texto' : 'text-texto-2'}">${escapar(e.modulo)}</span>
          <span class="mt-1 block font-semibold text-profundo">${escapar(e.titulo)}</span>
          <span class="mt-1 block text-sm text-texto-2">${fragmento(e.texto, terminos[0])}</span>
        </a></li>`,
      )
      .join('');
  };

  input.addEventListener('focus', () => void cargar(), { once: true });
  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = window.setTimeout(buscar, 150);
  });
  if (location.hash === '#buscar') input.focus();
}

// Registrar la cara de alguien en la compu del local: código de la admin + 5 tomas guiadas.
// La base rechaza si las tomas no son de la misma persona o si la cara ya es de otra registrada.
import { supabase } from '../../lib/supabase';
import type { Dispositivo } from '../../lib/fichador';
import { huella, type Lectura } from './caras';
import { mostrarCapa } from './capas';

const POSES = [
  'Mirá de frente a la cámara',
  'Girá apenas la cabeza hacia tu izquierda',
  'Ahora apenas hacia tu derecha',
  'Levantá un poquito la pera',
  'De frente otra vez',
];
const FALTA: Record<string, string> = {
  nadie: 'Buscando tu cara…',
  varias: 'Que se vea una sola persona',
  lejos: 'Acercate un poco más',
  quieta: 'No te muevas un segundo…',
};

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const verPaso = (p: 'codigo' | 'tomas' | 'fin') =>
  document.querySelectorAll<HTMLElement>('[data-registro]').forEach((x) => x.classList.toggle('hidden', x.dataset.registro !== p));

let disp: Dispositivo | null = null;
let alTerminar: () => void = () => {};
let activo = false;
let codigo = '';
let paso = 0;
let tomas: { e: number[]; foto: string | null }[] = [];
/** Cuadros buenos desde la última toma (uno malo suelto no arranca de cero). */
let buenos = 0;
let ultimaToma = 0;

export const registroActivo = () => activo;

export function iniciarRegistro(d: Dispositivo, listo: () => void) {
  disp = d;
  alTerminar = listo;
  activo = false;
  mostrarCapa('registro');
  verPaso('codigo');
  const input = $<HTMLInputElement>('#codigo-cara');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}

function pintarTomas() {
  $('[data-registro-tomas]').replaceChildren(
    ...POSES.map((_, i) => {
      const li = document.createElement('li');
      if (i === paso) li.className = 'actual';
      const t = tomas[i];
      if (t?.foto) {
        const img = document.createElement('img');
        img.src = t.foto;
        img.alt = `Toma ${i + 1}`;
        li.append(img);
      }
      return li;
    }),
  );
  $('[data-registro-paso]').textContent = POSES[Math.min(paso, POSES.length - 1)];
}

function fin(ok: boolean, titulo: string, texto: string) {
  activo = false;
  verPaso('fin');
  const icono = $('[data-registro-fin-icono]');
  icono.classList.toggle('bg-ambar-suave', !ok);
  icono.classList.toggle('text-ambar', !ok);
  $('[data-registro-fin-titulo]').textContent = titulo;
  $('[data-registro-fin-texto]').textContent = texto;
}

async function enviar() {
  activo = false;
  $('[data-registro-estado]').textContent = 'Guardando…';
  const { data, error } = await supabase!.rpc('registrar_cara', {
    p_dispositivo: disp!.id,
    p_secreto: disp!.secreto,
    p_codigo: codigo,
    p_embeddings: tomas.map((t) => t.e),
    p_foto: tomas[0]?.foto ?? null,
  });
  if (error) return fin(false, 'No se pudo guardar', 'Revisá la conexión a internet y probá de nuevo con el mismo código.');
  const nombre = String(data.nombre ?? '').split(/\s+/)[0];
  if (data.estado === 'ok') return fin(true, `Listo, ${nombre}`, 'Ya podés fichar mirando a la cámara.');
  if (data.estado === 'tomas_distintas')
    return fin(false, 'Las tomas salieron muy distintas', 'Probemos de nuevo con buena luz de frente, sin anteojos de sol ni gorra.');
  if (data.estado === 'parecida_a_otra')
    return fin(false, 'Esta cara ya está registrada', `Se parece mucho a la de ${String(data.otra).split(/\s+/)[0]}. Llamá a la encargada.`);
  if (data.estado === 'codigo_invalido') return fin(false, 'El código venció', 'Pedile a la admin un código nuevo (dura 15 minutos).');
  return fin(false, 'No se pudo guardar', 'Probá de nuevo.');
}

/** El ciclo de la cámara le pasa cada lectura mientras se están sacando las tomas. */
export function alimentarRegistro(l: Lectura, foto: () => string | null) {
  if (!activo) return;
  if (!l.valida || !l.embedding) {
    buenos = Math.max(0, buenos - 1);
    $('[data-registro-estado]').textContent = FALTA[l.falta ?? 'nadie'];
    return;
  }
  const ahora = Date.now();
  buenos++;
  $('[data-registro-estado]').textContent = 'Quedate así…';
  // Entre toma y toma, tiempo para cambiar la pose; y al menos 2 cuadros buenos.
  if (buenos < 2 || ahora - ultimaToma < 1600) return;
  tomas.push({ e: huella(l.embedding), foto: foto() });
  paso++;
  buenos = 0;
  ultimaToma = ahora;
  pintarTomas();
  if (paso >= POSES.length) void enviar();
}

$<HTMLFormElement>('[data-registro-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#codigo-cara');
  codigo = input.value.trim();
  const { data, error } = await supabase!.rpc('ver_codigo_cara', { p_dispositivo: disp!.id, p_secreto: disp!.secreto, p_codigo: codigo });
  if (error || data?.estado !== 'ok') {
    input.setCustomValidity(error ? 'Sin conexión: probá de nuevo' : 'Código vencido o equivocado');
    input.reportValidity();
    setTimeout(() => input.setCustomValidity(''), 2500);
    return;
  }
  $('[data-registro-nombre]').textContent = String(data.nombre).split(/\s+/)[0];
  paso = 0;
  tomas = [];
  buenos = 0;
  ultimaToma = 0;
  pintarTomas();
  verPaso('tomas');
  activo = true;
});

document.querySelectorAll('[data-registro-cancelar]').forEach((b) =>
  b.addEventListener('click', () => {
    activo = false;
    mostrarCapa(null);
    alTerminar();
  }),
);
$('[data-registro-cerrar]').addEventListener('click', () => {
  mostrarCapa(null);
  alTerminar();
});

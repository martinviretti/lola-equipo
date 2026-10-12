// Registrar la cara de alguien en la compu del local: código de la admin + 5 tomas guiadas.
// Cada toma espera a que la persona esté en la pose (de frente, girada a un lado, al otro…), con una
// cuenta regresiva para que no salga todo de golpe. La base rechaza si las tomas no son de la misma
// persona o si la cara se parece a la de otra registrada (salvo que la admin confirme que es otra).
import { supabase } from '../../lib/supabase';
import type { Dispositivo } from '../../lib/fichador';
import { huella, type Lectura } from './caras';
import { mostrarCapa } from './capas';

type Pose = 'frente' | 'costado' | 'otro_costado' | 'libre';
const POSES: { texto: string; pose: Pose }[] = [
  { texto: 'Mirá de frente a la cámara', pose: 'frente' },
  { texto: 'Girá despacio la cabeza hacia un costado', pose: 'costado' },
  { texto: 'Ahora girala hacia el otro costado', pose: 'otro_costado' },
  { texto: 'De frente, levantá un poquito la pera', pose: 'libre' },
  { texto: 'De frente otra vez', pose: 'frente' },
];
const FALTA: Record<string, string> = {
  nadie: 'Buscando tu cara…',
  varias: 'Que se vea una sola persona',
  lejos: 'Acercate un poco más',
  quieta: 'Abrí bien los ojos…',
};
/** Tiempo para leer la indicación antes de empezar a medir la pose. */
const PARA_LEER = 2200;
/** Cuenta regresiva con la pose lograda antes de sacar la toma. */
const CUENTA = 1800;
/** Si no logra la pose en este tiempo, se acepta igual (para que nadie quede trabado). */
const PACIENCIA = 9000;
const GIRO_FRENTE = 0.12;
const GIRO_COSTADO = 0.15;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const verPaso = (p: 'codigo' | 'tomas' | 'fin') =>
  document.querySelectorAll<HTMLElement>('[data-registro]').forEach((x) => x.classList.toggle('hidden', x.dataset.registro !== p));
const estado = (t: string) => ($('[data-registro-estado]').textContent = t);

let disp: Dispositivo | null = null;
let alTerminar: () => void = () => {};
let activo = false;
let codigo = '';
let paso = 0;
let tomas: { e: number[]; foto: string | null }[] = [];
/** Cuándo se mostró la pose actual y desde cuándo la persona la cumple (0 = todavía no). */
let poseDesde = 0;
let cumpleDesde = 0;
/** Cuadros malos seguidos (uno suelto no corta la cuenta regresiva). */
let malos = 0;
/** Para "el otro costado": hacia dónde giró en la toma anterior. */
let signoCostado = 0;

export const registroActivo = () => activo;

export function iniciarRegistro(d: Dispositivo, listo: () => void) {
  disp = d;
  alTerminar = listo;
  activo = false;
  $('[data-registro-fin-icono]').closest('.tarjeta-grande')!.classList.remove('aviso');
  $('[data-registro-forzar]').classList.add('hidden');
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
  const p = Math.min(paso, POSES.length - 1);
  $('[data-registro-paso]').textContent = `${p + 1} de ${POSES.length}: ${POSES[p].texto}`;
}

function fin(ok: boolean, titulo: string, texto: string, forzar = false) {
  activo = false;
  verPaso('fin');
  $('[data-registro-fin-icono]').closest('.tarjeta-grande')!.classList.toggle('aviso', !ok);
  $('[data-registro-fin-titulo]').textContent = titulo;
  $('[data-registro-fin-texto]').textContent = texto;
  $('[data-registro-forzar]').classList.toggle('hidden', !forzar);
}

async function enviar(forzar = false) {
  activo = false;
  estado('Guardando…');
  const { data, error } = await supabase!.rpc('registrar_cara', {
    p_dispositivo: disp!.id,
    p_secreto: disp!.secreto,
    p_codigo: codigo,
    p_embeddings: tomas.map((t) => t.e),
    p_foto: tomas[0]?.foto ?? null,
    p_forzar: forzar,
  });
  if (error) return fin(false, 'No se pudo guardar', 'Revisá la conexión a internet y probá de nuevo con el mismo código.');
  const nombre = String(data.nombre ?? '').split(/\s+/)[0];
  if (data.estado === 'ok') return fin(true, `Listo, ${nombre}`, 'Ya podés fichar mirando a la cámara.');
  if (data.estado === 'tomas_distintas')
    return fin(false, 'Las tomas salieron muy distintas', 'Probemos de nuevo con buena luz de frente, sin anteojos de sol ni gorra.');
  if (data.estado === 'parecida_a_otra') {
    const otra = String(data.otra).split(/\s+/)[0];
    return fin(
      false,
      `Se parece mucho a ${otra}`,
      `Si ${nombre} es otra persona (por ejemplo, un familiar de ${otra}), tocá el botón de abajo. Si no, avisale a la encargada.`,
      true,
    );
  }
  if (data.estado === 'codigo_invalido') return fin(false, 'El código venció', 'Pedile a la admin un código nuevo (dura 15 minutos).');
  return fin(false, 'No se pudo guardar', 'Probá de nuevo.');
}

/** ¿Está en la pose que se le pidió? (el giro se mide con la nariz respecto de los ojos). */
function enPose(pose: Pose, l: Lectura): { ok: boolean; pista?: string } {
  if (pose === 'frente') return Math.abs(l.giro) < GIRO_FRENTE ? { ok: true } : { ok: false, pista: 'Mirá derecho a la cámara' };
  if (pose === 'costado') return Math.abs(l.giro) > GIRO_COSTADO ? { ok: true } : { ok: false, pista: 'Girá un poco más la cabeza' };
  if (pose === 'otro_costado') {
    if (Math.abs(l.giro) > GIRO_COSTADO && Math.sign(l.giro) !== signoCostado) return { ok: true };
    return { ok: false, pista: Math.sign(l.giro) === signoCostado && Math.abs(l.giro) > GIRO_FRENTE ? 'Para el otro lado' : 'Girá hacia el otro costado' };
  }
  return { ok: true };
}

/** El ciclo de la cámara le pasa cada lectura mientras se están sacando las tomas. */
export function alimentarRegistro(l: Lectura, foto: () => string | null) {
  if (!activo) return;
  const ahora = Date.now();
  if (ahora - poseDesde < PARA_LEER) {
    estado('Preparate…');
    return;
  }
  if (!l.valida || !l.embedding) {
    if (++malos >= 2) cumpleDesde = 0;
    estado(FALTA[l.falta ?? 'nadie']);
    return;
  }
  const actual = POSES[paso];
  const p = enPose(actual.pose, l);
  if (!p.ok && ahora - poseDesde < PACIENCIA) {
    if (++malos >= 2) cumpleDesde = 0;
    estado(p.pista ?? '');
    return;
  }
  malos = 0;
  cumpleDesde ||= ahora;
  const falta = CUENTA - (ahora - cumpleDesde);
  if (falta > 0) {
    estado(`¡Así! No te muevas… ${Math.ceil(falta / 600)}`);
    return;
  }
  if (actual.pose === 'costado') signoCostado = Math.sign(l.giro) || 1;
  tomas.push({ e: huella(l.embedding), foto: foto() });
  paso++;
  poseDesde = ahora;
  cumpleDesde = 0;
  pintarTomas();
  if (paso >= POSES.length) void enviar();
  else estado('¡Bien!');
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
  malos = 0;
  cumpleDesde = 0;
  signoCostado = 0;
  poseDesde = Date.now();
  pintarTomas();
  verPaso('tomas');
  activo = true;
});

// "Es otra persona": la admin confirma que no es la misma que la registrada (por ejemplo, un familiar).
$('[data-registro-forzar]').addEventListener('click', () => {
  verPaso('tomas');
  void enviar(true);
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

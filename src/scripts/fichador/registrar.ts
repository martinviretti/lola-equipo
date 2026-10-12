// Registrar la cara de alguien en el fichador del local, siempre con una admin presente: con el
// código que se genera en el panel o, si el fichador tiene abierta una cuenta de admin (el celular
// del local), eligiendo a la persona de la lista.
// Son 5 tomas guiadas, como en los celulares: el círculo se completa por partes, una flecha marca
// hacia dónde girar y se va llenando a medida que la persona gira, y cada toma suena y vibra. La
// indicación también se dice en voz alta, porque con la cabeza girada no se puede leer la pantalla.
// La base rechaza si las tomas no son de la misma persona o si la cara se parece a la de otra
// registrada (salvo que la admin confirme que es otra persona).
import { supabase } from '../../lib/supabase';
import type { Dispositivo } from '../../lib/fichador';
import { huella, type Lectura } from './caras';
import { mostrarCapa } from './capas';
import { sonar, hablar, callar, vibrar } from './sonidos';

type Pose = 'frente' | 'izquierda' | 'derecha' | 'sonrisa';
const POSES: { pose: Pose; texto: string; voz: string }[] = [
  { pose: 'frente', texto: 'Mirá a la cámara, de frente', voz: 'Mirá a la cámara, de frente' },
  { pose: 'izquierda', texto: 'Girá despacio la cabeza hacia tu izquierda', voz: 'Ahora girá despacio la cabeza hacia tu izquierda' },
  { pose: 'derecha', texto: 'Ahora hacia tu derecha', voz: 'Muy bien. Ahora hacia tu derecha' },
  { pose: 'sonrisa', texto: 'De frente, con una sonrisa', voz: 'De frente, con una sonrisa' },
  { pose: 'frente', texto: 'La última: de frente, sin sonreír', voz: 'La última: de frente, sin sonreír' },
];
const FALTA: Record<string, string> = {
  nadie: 'No te veo: mirá a la cámara',
  varias: 'Que se vea una sola persona',
  lejos: 'Acercate un poco más',
  quieta: 'Abrí bien los ojos',
};
/** Tiempo para escuchar la indicación antes de empezar a medir la pose. */
const PARA_LEER = 1300;
/** Cuánto hay que sostener la pose (mientras tanto se llena esa parte del círculo). */
const SOSTENER = 900;
/** Si no logra la pose en este tiempo, se le repite la pista en voz alta. */
const PISTA = 7000;
/** Y si tampoco, se acepta la toma igual (para que nadie quede trabado). */
const PACIENCIA = 16000;
const GIRO_FRENTE = 0.12;
const GIRO_COSTADO = 0.15;
/**
 * El giro se mide en la imagen de la cámara: es positivo cuando la persona gira hacia SU izquierda
 * (la nariz se corre hacia el lado derecho de la imagen). En la pantalla el video se ve como un
 * espejo, así que eso queda a la izquierda de la pantalla.
 */
const SIGNO_IZQUIERDA = 1;

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
type Paso = 'esperar' | 'elegir' | 'codigo' | 'tomas' | 'fin';
const verPaso = (p: Paso) => document.querySelectorAll<HTMLElement>('[data-registro]').forEach((x) => x.classList.toggle('hidden', x.dataset.registro !== p));
const estado = (t: string) => ($('[data-registro-estado]').textContent = t);

let disp: Dispositivo | null = null;
let alTerminar: () => void = () => {};
let activo = false;
let codigo = '';
let paso = 0;
let tomas: { e: number[]; foto: string | null }[] = [];
/** Cuándo se pidió la pose actual y desde cuándo la persona la cumple (0 = todavía no). */
let poseDesde = 0;
let cumpleDesde = 0;
/** Cuadros malos seguidos (uno suelto no corta lo que se venía sosteniendo). */
let malos = 0;
let pistaDada = false;

export const registroActivo = () => activo;

// ---------- El círculo por partes ----------
const NS = 'http://www.w3.org/2000/svg';
const LARGO = 100 / POSES.length - 2.5;
const tramos = POSES.map((_, i) => {
  const circulo = (clase: string) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '47');
    c.setAttribute('pathLength', '100');
    c.setAttribute('class', clase);
    c.style.strokeDashoffset = String(-(i * (100 / POSES.length) + 1.25));
    return c;
  };
  const fondo = circulo('tramo-fondo');
  fondo.style.strokeDasharray = `${LARGO} ${100 - LARGO}`;
  const lleno = circulo('tramo');
  $('[data-guia-anillo]').append(fondo, lleno);
  return lleno;
});
function tramo(i: number, avance: number, hecho = false) {
  const c = tramos[i];
  if (!c) return;
  const largo = LARGO * Math.max(0, Math.min(1, avance));
  c.style.strokeDasharray = `${largo} ${100 - largo}`;
  // Vacío no se dibuja (con la punta redondeada quedaría un punto).
  c.style.opacity = largo > 0 ? '1' : '0';
  c.classList.toggle('hecho', hecho);
}

// ---------- Flechas: hacia dónde girar y cuánto falta ----------
function pintarFlechas(pose: Pose, l: Lectura) {
  for (const lado of ['izquierda', 'derecha'] as const) {
    const f = $(`[data-flecha="${lado}"]`);
    const pedida = activo && pose === lado;
    const hacia = lado === 'izquierda' ? l.giro * SIGNO_IZQUIERDA : -l.giro * SIGNO_IZQUIERDA;
    const avance = pedida && l.cantidad === 1 ? Math.max(0, Math.min(1, hacia / GIRO_COSTADO)) : 0;
    f.classList.toggle('pedida', pedida);
    f.classList.toggle('lograda', pedida && avance >= 1);
    f.style.setProperty('--avance', avance.toFixed(2));
  }
}

function destello() {
  const m = $('[data-guia-marco]');
  m.classList.remove('toma');
  void m.getBoundingClientRect();
  m.classList.add('toma');
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
}

/** Pide la pose que sigue: en la pantalla y en voz alta. */
function indicar() {
  const p = POSES[paso];
  $('[data-registro-paso]').textContent = p.texto;
  $('[data-registro-numero]').textContent = `${paso + 1} de ${POSES.length}`;
  estado('');
  pintarTomas();
  hablar(p.voz);
}

// ---------- Empezar ----------
async function hayAdmin(): Promise<boolean> {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) return false;
  const { data: es } = await supabase!.rpc('es_admin');
  return es === true;
}

export async function iniciarRegistro(d: Dispositivo, listo: () => void) {
  disp = d;
  alTerminar = listo;
  activo = false;
  $('[data-registro-fin-icono]').closest('.tarjeta-grande')!.classList.remove('aviso');
  $('[data-registro-forzar]').classList.add('hidden');
  mostrarCapa('registro');
  verPaso('esperar');
  // En el celular del local queda abierta la cuenta de admin: se elige a la persona, sin código.
  if (await hayAdmin().catch(() => false)) {
    await pintarPersonas();
    verPaso('elegir');
    return;
  }
  pedirCodigo();
}

function pedirCodigo() {
  verPaso('codigo');
  const input = $<HTMLInputElement>('#codigo-cara');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}

async function pintarPersonas() {
  const lista = $('[data-registro-personas]');
  const [ps, cs] = await Promise.all([
    supabase!.from('autorizados').select('email,nombre').eq('activo', true).order('nombre'),
    supabase!.from('caras').select('email'),
  ]);
  const conCara = new Set(((cs.data ?? []) as { email: string }[]).map((c) => c.email));
  lista.replaceChildren(
    ...((ps.data ?? []) as { email: string; nombre: string | null }[]).map((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'persona-elegir';
      const nombre = document.createElement('span');
      nombre.className = 'flex-1 font-bold text-profundo';
      nombre.textContent = p.nombre || p.email.split('@')[0];
      b.append(nombre);
      if (conCara.has(p.email)) {
        const ya = document.createElement('span');
        ya.className = 'text-xs font-semibold text-marca';
        ya.textContent = 'Ya tiene cara';
        b.append(ya);
      }
      b.addEventListener('click', async () => {
        b.disabled = true;
        const { data, error } = await supabase!.rpc('crear_codigo_cara', { p_email: p.email });
        const listo = !error && data ? await empezar(String(data)) : false;
        b.disabled = false;
        if (!listo) alert('No se pudo empezar. Revisá la conexión y probá de nuevo.');
      });
      return b;
    }),
  );
}

/** Con un código válido: muestra la cámara grande y arranca las tomas. */
async function empezar(c: string): Promise<boolean> {
  const { data, error } = await supabase!.rpc('ver_codigo_cara', { p_dispositivo: disp!.id, p_secreto: disp!.secreto, p_codigo: c });
  if (error || data?.estado !== 'ok') return false;
  codigo = c;
  $('[data-registro-nombre]').textContent = String(data.nombre).split(/\s+/)[0];
  const guia = $<HTMLVideoElement>('[data-guia-video]');
  guia.srcObject = $<HTMLVideoElement>('[data-video]').srcObject;
  void guia.play().catch(() => {});
  paso = 0;
  tomas = [];
  malos = 0;
  cumpleDesde = 0;
  pistaDada = false;
  tramos.forEach((_, i) => tramo(i, 0));
  poseDesde = Date.now();
  verPaso('tomas');
  activo = true;
  indicar();
  return true;
}

// ---------- Terminar ----------
function fin(ok: boolean, titulo: string, texto: string, forzar = false) {
  activo = false;
  verPaso('fin');
  $('[data-registro-fin-icono]').closest('.tarjeta-grande')!.classList.toggle('aviso', !ok);
  $('[data-registro-fin-titulo]').textContent = titulo;
  $('[data-registro-fin-texto]').textContent = texto;
  $('[data-registro-forzar]').classList.toggle('hidden', !forzar);
  if (ok) {
    sonar('listo');
    vibrar([80, 60, 80]);
  } else {
    sonar('error');
    vibrar(200);
  }
  hablar(titulo);
}

async function enviar(forzar = false) {
  activo = false;
  $('[data-registro-paso]').textContent = '¡Listo! Guardando…';
  estado('');
  const { data, error } = await supabase!.rpc('registrar_cara', {
    p_dispositivo: disp!.id,
    p_secreto: disp!.secreto,
    p_codigo: codigo,
    p_embeddings: tomas.map((t) => t.e),
    p_foto: tomas[0]?.foto ?? null,
    p_forzar: forzar,
  });
  if (error) return fin(false, 'No se pudo guardar', 'Revisá la conexión a internet y probá de nuevo.');
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
  if (data.estado === 'codigo_invalido') return fin(false, 'El código venció', 'Generá uno nuevo (dura 15 minutos) y probá otra vez.');
  return fin(false, 'No se pudo guardar', 'Probá de nuevo.');
}

// ---------- Cada cuadro de la cámara ----------
/** ¿Está en la pose que se le pidió? (el giro se mide con la nariz respecto de los ojos). */
function enPose(pose: Pose, l: Lectura): { ok: boolean; pista: string } {
  if (pose === 'frente' || pose === 'sonrisa') return { ok: Math.abs(l.giro) < GIRO_FRENTE, pista: 'Mirá derecho a la cámara' };
  const izq = l.giro * SIGNO_IZQUIERDA;
  const hacia = pose === 'izquierda' ? izq : -izq;
  if (hacia > GIRO_COSTADO) return { ok: true, pista: '' };
  return { ok: false, pista: hacia < -GIRO_FRENTE ? 'Para el otro lado' : 'Girá un poco más la cabeza' };
}

function soltar() {
  cumpleDesde = 0;
  tramo(paso, 0);
}

/** El ciclo de la cámara le pasa cada lectura mientras se están sacando las tomas. */
export function alimentarRegistro(l: Lectura, foto: () => string | null) {
  if (!activo) return;
  const ahora = Date.now();
  const actual = POSES[paso];
  pintarFlechas(actual.pose, l);
  if (ahora - poseDesde < PARA_LEER) return;

  // De costado los ojos se ven más cerrados: alcanza con que se vea una sola cara cerca.
  const deCostado = actual.pose === 'izquierda' || actual.pose === 'derecha';
  const sirve = deCostado ? l.cantidad === 1 && !!l.embedding && l.falta !== 'lejos' : l.valida && !!l.embedding;
  if (!sirve) {
    if (++malos >= 2) soltar();
    estado(FALTA[l.falta ?? 'nadie']);
    return;
  }
  const p = enPose(actual.pose, l);
  if (!p.ok && ahora - poseDesde < PACIENCIA) {
    if (++malos >= 2) soltar();
    estado(p.pista);
    if (!pistaDada && ahora - poseDesde > PISTA) {
      pistaDada = true;
      hablar(p.pista);
    }
    return;
  }
  malos = 0;
  if (!cumpleDesde) {
    cumpleDesde = ahora;
    sonar('tic');
  }
  const avance = (ahora - cumpleDesde) / SOSTENER;
  tramo(paso, avance);
  if (avance < 1) {
    estado('¡Así! Quedate así un segundo…');
    return;
  }

  // Toma lista
  tomas.push({ e: huella(l.embedding!), foto: foto() });
  tramo(paso, 1, true);
  sonar('toma');
  vibrar(60);
  destello();
  paso++;
  poseDesde = ahora;
  cumpleDesde = 0;
  pistaDada = false;
  if (paso >= POSES.length) {
    pintarTomas();
    pintarFlechas('frente', l);
    void enviar();
    return;
  }
  indicar();
}

// ---------- Botones ----------
$<HTMLFormElement>('[data-registro-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('#codigo-cara');
  if (await empezar(input.value.trim())) return;
  input.setCustomValidity(navigator.onLine ? 'Código vencido o equivocado' : 'Sin conexión: probá de nuevo');
  input.reportValidity();
  setTimeout(() => input.setCustomValidity(''), 2500);
});

$('[data-registro-con-codigo]').addEventListener('click', pedirCodigo);

// "Es otra persona": la admin confirma que no es la misma que la registrada (por ejemplo, un familiar).
$('[data-registro-forzar]').addEventListener('click', () => {
  verPaso('tomas');
  void enviar(true);
});

function cerrar() {
  activo = false;
  callar();
  mostrarCapa(null);
  alTerminar();
}
document.querySelectorAll('[data-registro-cancelar]').forEach((b) => b.addEventListener('click', cerrar));
$('[data-registro-cerrar]').addEventListener('click', cerrar);

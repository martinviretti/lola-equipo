// Sincroniza el avance de la persona con la base (Supabase). Todo pasa por una cola guardada
// en el celular: si no hay internet o falla, se reintenta al volver la conexión o en la próxima visita.
//
// Cada cosa de la cola tiene su id y cuenta cuántas veces la rechazó la base. Si la rechaza 5 veces
// (un dato que la base no acepta), pasa a una lista aparte (lola-pendientes-fallidos:v1) para no trabar
// al resto; esa lista se vuelve a probar una vez por día. Sin internet o con la sesión vencida no se
// cuenta nada: se corta y se sigue después.
//
// Al abrir la página y cada vez que cambia cuántas cosas quedan sin subir, avisa con el evento
// window 'lola:pendientes' → detail: { cantidad, fallidas } (cantidad incluye a las fallidas).
// También se puede preguntar en cualquier momento con cantidadPendiente().
import { supabase, configurado } from '../lib/supabase';

type Datos =
  | { accion: 'vista'; gondola: string }
  | { accion: 'leida'; seccion: string }
  | { accion: 'quiz'; gondola: string; bien: number; total: number; aprobado: boolean }
  | { accion: 'intento'; nivel: number; nota: number; aprobado: boolean; preguntas: number; errores: string[] };

type Op = Datos & {
  id: string;
  /** Cuándo pasó (ms). Es lo que se guarda en la base como fecha, aunque llegue más tarde. */
  t: number;
  /** Veces que la base la rechazó. */
  intentos?: number;
  /** Último error, para poder mirarlo si hace falta. */
  error?: string;
};
type Fallida = Op & { uid?: string; probada_el: number };

const COLA = 'lola-pendientes:v1';
const FALLIDAS = 'lola-pendientes-fallidos:v1';
const MAX_INTENTOS = 5;
const REPROBAR_FALLIDAS_MS = 24 * 3600 * 1000;
/** Errores de "la base todavía no tiene esto" (función o regla única sin crear): se hace lo de antes. */
const FALTA_EN_BASE = new Set(['PGRST202', '42883', '42P10']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Guardado en el celular ----------
const leer = <T>(clave: string): T[] => {
  try {
    const c = JSON.parse(localStorage.getItem(clave) ?? '[]');
    return Array.isArray(c) ? c.filter((x) => x && typeof x === 'object' && typeof x.accion === 'string') : [];
  } catch {
    return [];
  }
};
const escribir = (clave: string, lista: unknown[], max: number) => {
  try {
    if (lista.length) localStorage.setItem(clave, JSON.stringify(lista.slice(-max)));
    else localStorage.removeItem(clave);
  } catch {}
  avisarCantidad();
};

function nuevoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Sin conexión segura (http) no hay randomUUID: se arma uno igual (versión 4).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** La cola. Lo que quedó guardado por una versión anterior (sin id) recibe uno acá. */
function leerCola(): Op[] {
  const c = leer<Op>(COLA);
  if (c.some((op) => !op.id)) {
    for (const op of c) op.id ||= nuevoId();
    escribir(COLA, c, 500);
  }
  return c;
}
const leerFallidas = () => leer<Fallida>(FALLIDAS);

// ---------- Aviso de cuántas quedan ----------
let ultimaCantidad = -1;
function avisarCantidad(siempre = false) {
  if (typeof window === 'undefined' || !configurado) return;
  const fallidas = leer(FALLIDAS).length;
  const cantidad = leer(COLA).length + fallidas;
  if (!siempre && cantidad === ultimaCantidad) return;
  ultimaCantidad = cantidad;
  window.dispatchEvent(new CustomEvent('lola:pendientes', { detail: { cantidad, fallidas } }));
}

/** Cuántas cosas del avance todavía no llegaron a la base (incluye las que la base rechazó). */
export const cantidadPendiente = () => leer(COLA).length + leer(FALLIDAS).length;

// ---------- Hablar con la base ----------
class FalloNube extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, mensaje: string) {
    super(mensaje);
    this.status = status;
    this.code = code;
  }
}
type Respuesta = { error: { code?: string; message?: string } | null; status: number };
const comprobar = (r: Respuesta) => {
  if (r.error) throw new FalloNube(r.status, r.error.code ?? '', r.error.message ?? '');
};
const faltaEnBase = (r: Respuesta) => !!r.error && FALTA_EN_BASE.has(r.error.code ?? '');

/**
 * Qué hacer con un error:
 * - 'red': no llegó a la base (sin señal). No es culpa de la operación: se corta sin contar.
 * - 'sesion': la sesión venció o no vale. Tampoco se cuenta: se corta.
 * - 'servidor': la base anda mal (500, 503...). Se cuenta solo para esta y se corta.
 * - 'rechazo': la base no acepta esta operación. Se cuenta y se sigue con la siguiente.
 */
function tipoDeFallo(e: unknown): 'red' | 'sesion' | 'servidor' | 'rechazo' {
  if (!(e instanceof FalloNube)) return 'rechazo';
  if (!e.status) return 'red';
  if (e.status === 401 || e.code.startsWith('PGRST30')) return 'sesion';
  if (e.status >= 500 || e.status === 408 || e.status === 429) return 'servidor';
  return 'rechazo';
}
const textoError = (e: unknown) => (e instanceof FalloNube ? `${e.status} ${e.code} ${e.message}` : String(e)).slice(0, 200);

async function usuario() {
  const { data } = await supabase!.auth.getSession();
  return data.session?.user.id ?? null;
}

// Si la base todavía no tiene la actualización (supabase/actualizar-intranet-1.sql), se hace como antes.
let sinRepasoEnBase = false;
let sinClaveIntentos = false;

async function ejecutar(op: Op, uid: string) {
  const db = supabase!;
  const cuando = new Date(op.t).toISOString();
  if (op.accion === 'vista') {
    comprobar(
      await db
        .from('progreso_gondola')
        .upsert({ user_id: uid, gondola: op.gondola, vista_el: cuando }, { onConflict: 'user_id,gondola', ignoreDuplicates: true }),
    );
  } else if (op.accion === 'leida') {
    comprobar(
      await db
        .from('secciones_leidas')
        .upsert({ user_id: uid, seccion: op.seccion, leida_el: cuando }, { onConflict: 'user_id,seccion', ignoreDuplicates: true }),
    );
  } else if (op.accion === 'intento') {
    const fila = {
      user_id: uid,
      nivel: op.nivel,
      nota: op.nota,
      aprobado: op.aprobado,
      preguntas: op.preguntas,
      errores: op.errores,
      hecho_el: cuando,
    };
    // El mismo examen (misma persona, mismo instante) llega una sola vez aunque se reintente.
    if (!sinClaveIntentos) {
      const r = await db.from('intentos_examen').upsert(fila, { onConflict: 'user_id,hecho_el', ignoreDuplicates: true });
      if (!faltaEnBase(r)) return comprobar(r);
      sinClaveIntentos = true;
    }
    const ya = await db.from('intentos_examen').select('id').eq('user_id', uid).eq('hecho_el', cuando).limit(1);
    comprobar(ya);
    if (!ya.data?.length) comprobar(await db.from('intentos_examen').insert(fila));
  } else if (op.accion === 'quiz') {
    // La base suma el intento en un solo paso; con el id, un reintento no cuenta doble.
    if (!sinRepasoEnBase) {
      const r = await db.rpc('registrar_repaso', {
        p_gondola: op.gondola,
        p_bien: op.bien,
        p_total: op.total,
        p_aprobado: op.aprobado,
        p_hecho_el: cuando,
        p_id: UUID.test(op.id) ? op.id : null,
      });
      if (!faltaEnBase(r)) return comprobar(r);
      sinRepasoEnBase = true;
    }
    const { data, error, status } = await db.from('progreso_gondola').select('*').eq('user_id', uid).eq('gondola', op.gondola).maybeSingle();
    comprobar({ error, status });
    const fila = {
      user_id: uid,
      gondola: op.gondola,
      vista_el: data?.vista_el ?? cuando,
      quiz_intentos: (data?.quiz_intentos ?? 0) + 1,
      quiz_mejor: Math.max(data?.quiz_mejor ?? 0, op.bien),
      quiz_total: op.total,
      completada_el: data?.completada_el ?? (op.aprobado ? cuando : null),
      actualizado_el: new Date().toISOString(),
    };
    comprobar(await db.from('progreso_gondola').upsert(fila, { onConflict: 'user_id,gondola' }));
  }
}

// ---------- La cola ----------
const sacar = (id: string) => escribir(COLA, leerCola().filter((x) => x.id !== id), 500);

/** La base rechazó la operación: suma un intento y, si ya van 5, la pasa a la lista de fallidas. */
function anotarRechazo(op: Op, e: unknown, uid: string) {
  const cola = leerCola();
  const x = cola.find((y) => y.id === op.id);
  if (!x) return;
  x.intentos = (x.intentos ?? 0) + 1;
  x.error = textoError(e);
  if (x.intentos < MAX_INTENTOS) return escribir(COLA, cola, 500);
  escribir(COLA, cola.filter((y) => y.id !== op.id), 500);
  escribir(FALLIDAS, [...leerFallidas(), { ...x, uid, probada_el: Date.now() }], 100);
}

/** Una vez por día vuelve a probar las fallidas (por ejemplo, si después se actualizó la base). */
async function reprobarFallidas(uid: string) {
  const todas = leerFallidas();
  // Si en este celular entró otra cuenta, las fallidas de la anterior no son de esta persona.
  const ajenas = todas.filter((f) => f.uid && f.uid !== uid);
  if (ajenas.length) escribir(FALLIDAS, todas.filter((f) => !ajenas.includes(f)), 100);
  for (const f of leerFallidas()) {
    if (Date.now() - (f.probada_el ?? 0) < REPROBAR_FALLIDAS_MS) continue;
    try {
      await ejecutar(f, uid);
      escribir(FALLIDAS, leerFallidas().filter((x) => x.id !== f.id), 100);
    } catch (e) {
      const tipo = tipoDeFallo(e);
      if (tipo !== 'rechazo') return;
      escribir(FALLIDAS, leerFallidas().map((x) => (x.id === f.id ? { ...x, probada_el: Date.now(), error: textoError(e) } : x)), 100);
    }
  }
}

async function procesar(uid: string) {
  const probadas = new Set<string>();
  for (;;) {
    // Se relee en cada vuelta: lo que se agregue mientras tanto (en esta pestaña o en otra) también sale.
    const op = leerCola().find((x) => !probadas.has(x.id));
    if (!op) break;
    probadas.add(op.id);
    try {
      await ejecutar(op, uid);
      sacar(op.id);
    } catch (e) {
      const tipo = tipoDeFallo(e);
      if (tipo === 'red' || tipo === 'sesion') return; // Queda para el próximo intento, en orden.
      anotarRechazo(op, e, uid);
      if (tipo === 'servidor') return;
    }
  }
  await reprobarFallidas(uid);
}

let trabajando = false;

/** Manda a la base todo lo pendiente. Se puede llamar seguido: si ya está trabajando, no hace nada. */
export async function procesarPendientes() {
  if (!configurado || trabajando || !navigator.onLine) return;
  trabajando = true;
  try {
    const uid = await usuario();
    if (!uid) return;
    // Con dos pestañas abiertas, una sola manda la cola por vez.
    if (navigator.locks) await navigator.locks.request('lola-pendientes', { ifAvailable: true }, (candado) => (candado ? procesar(uid) : undefined));
    else await procesar(uid);
  } catch {
    // Sin conexión o error inesperado: queda todo para el próximo intento.
  } finally {
    trabajando = false;
    avisarCantidad(true);
  }
}

function encolar(datos: Datos) {
  if (!configurado) return;
  guardarEnCola({ ...datos, id: nuevoId(), t: Date.now() } as Op);
  void procesarPendientes();
}
const guardarEnCola = (op: Op) => escribir(COLA, [...leerCola(), op], 500);

export const nube = {
  vista: (gondola: string) => encolar({ accion: 'vista', gondola }),
  leida: (seccion: string) => encolar({ accion: 'leida', seccion }),
  quiz: (gondola: string, bien: number, total: number, aprobado: boolean) => encolar({ accion: 'quiz', gondola, bien, total, aprobado }),
  intento: (r: { nivel: number; nota: number; aprobado: boolean; preguntas: number; errores: string[] }) =>
    encolar({ accion: 'intento', ...r, errores: r.errores.slice(0, 200).map((x) => String(x).slice(0, 80)) }),
};

/** Trae el avance guardado en la base (para un celular nuevo o después de borrar datos). */
export async function bajarProgreso() {
  if (!configurado) return null;
  const uid = await usuario();
  if (!uid) return null;
  const db = supabase!;
  const [g, l, i] = await Promise.all([
    db.from('progreso_gondola').select('*').eq('user_id', uid),
    db.from('secciones_leidas').select('seccion').eq('user_id', uid),
    db.from('intentos_examen').select('nivel,nota,aprobado,hecho_el').eq('user_id', uid).order('hecho_el'),
  ]);
  if (g.error || l.error || i.error) return null;
  return { gondolas: g.data, leidas: l.data.map((x) => x.seccion as string), intentos: i.data };
}

if (typeof window !== 'undefined') {
  addEventListener('online', () => void procesarPendientes());
  // Otra pestaña cambió la cola: el número del menú se actualiza igual.
  addEventListener('storage', (e) => {
    if (e.key === COLA || e.key === FALLIDAS || e.key === null) avisarCantidad();
  });
  // Al abrir la página también se avisa (así el menú muestra lo pendiente enseguida, aunque no cambie nada).
  let avisado = false;
  const alArrancar = () => {
    if (avisado) return;
    avisado = true;
    avisarCantidad(true);
  };
  if (document.readyState === 'complete') setTimeout(alArrancar, 0);
  else {
    document.addEventListener('DOMContentLoaded', alArrancar, { once: true });
    addEventListener('load', alArrancar, { once: true }); // por si DOMContentLoaded ya había pasado
  }
}

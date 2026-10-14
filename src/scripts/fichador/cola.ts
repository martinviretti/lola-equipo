// Si se corta internet en el local, la compu guarda las fichadas con cara (huella, foto, hora de la compu
// y si eligió entrada o salida) y las manda solas cuando vuelve la conexión. En el panel quedan marcadas
// "sin internet".
import { supabase } from '../../lib/supabase';
import type { Dispositivo } from '../../lib/fichador';

interface Pendiente {
  t: string;
  embedding: number[];
  foto: string | null;
  /** Lo que eligió (sin elegir: lo decide el fichador al mandarla). */
  tipo?: 'entrada' | 'salida' | null;
}

const COLA = 'lola-fichador-cola:v1';
const MAXIMO = 60;

const leerCola = (): Pendiente[] => {
  try {
    const c = JSON.parse(localStorage.getItem(COLA) ?? '[]');
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
};
const guardarCola = (c: Pendiente[]) => {
  try {
    localStorage.setItem(COLA, JSON.stringify(c.slice(-MAXIMO)));
  } catch {
    // Sin lugar: se descarta la foto de las más viejas antes de perder la fichada.
    localStorage.setItem(COLA, JSON.stringify(c.slice(-MAXIMO).map((p, i) => (i < c.length / 2 ? { ...p, foto: null } : p))));
  }
};

export const pendientes = () => leerCola().length;

/** `hora`: la hora ya corregida con el reloj de la base (la de la compu puede estar mal). */
export function encolar(embedding: number[], foto: string | null, hora: Date, tipo: 'entrada' | 'salida' | null = null) {
  guardarCola([...leerCola(), { t: hora.toISOString(), embedding, foto, tipo }]);
}

const distancia = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0));

/** ¿Esta cara ya quedó guardada en los últimos 2 minutos? Misma persona = huellas a menos de 0,5 (como en la base). */
export const guardadaHacePoco = (embedding: number[], hora: Date) =>
  leerCola().some((p) => Math.abs(hora.getTime() - new Date(p.t).getTime()) < 120000 && distancia(p.embedding, embedding) < 0.5);

/** Error de red (no de la base): conviene guardar y reintentar. */
export const esSinConexion = (e: { message?: string } | null | undefined) =>
  !navigator.onLine || /fetch|network|load failed|timeout/i.test(e?.message ?? '');

/** El envío en curso: si llega otra cara mientras se manda, espera a que termine (y no lo toma como "sin internet"). */
let enCurso: Promise<number> | null = null;

/** Manda lo pendiente, en orden. Devuelve cuántas se mandaron. */
export function mandarPendientes(d: Dispositivo): Promise<number> {
  if (!navigator.onLine || !supabase) return Promise.resolve(0);
  enCurso ??= mandar(d).finally(() => (enCurso = null));
  return enCurso;
}

async function mandar(d: Dispositivo): Promise<number> {
  if (!supabase) return 0;
  let enviadas = 0;
  for (const p of leerCola()) {
    const args = {
      p_dispositivo: d.id,
      p_secreto: d.secreto,
      p_embedding: p.embedding,
      p_foto: p.foto,
      p_hora_pc: p.t,
    };
    let { error } = await supabase.rpc('fichar_cara', p.tipo ? { ...args, p_tipo: p.tipo } : args).abortSignal(AbortSignal.timeout(8000));
    // La base todavía no sabe de elegir: se manda igual y decide el fichador.
    if (error && p.tipo && (error.code === 'PGRST202' || /could not find the function/i.test(error.message))) {
      ({ error } = await supabase.rpc('fichar_cara', args).abortSignal(AbortSignal.timeout(8000)));
    }
    if (error) break; // sin conexión o compu desactivada: queda para después
    guardarCola(leerCola().filter((x) => x.t !== p.t));
    enviadas++;
  }
  return enviadas;
}

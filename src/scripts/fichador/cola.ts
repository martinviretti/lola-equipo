// Si se corta internet en el local, la compu guarda las fichadas con cara (huella, foto y hora de la
// compu) y las manda solas cuando vuelve la conexión. En el panel quedan marcadas "sin internet".
import { supabase } from '../../lib/supabase';
import type { Dispositivo } from '../../lib/fichador';

interface Pendiente {
  t: string;
  embedding: number[];
  foto: string | null;
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

export function encolar(embedding: number[], foto: string | null) {
  guardarCola([...leerCola(), { t: new Date().toISOString(), embedding, foto }]);
}

/** Error de red (no de la base): conviene guardar y reintentar. */
export const esSinConexion = (e: { message?: string } | null | undefined) =>
  !navigator.onLine || /fetch|network|load failed|timeout/i.test(e?.message ?? '');

let trabajando = false;

/** Manda lo pendiente, en orden. Devuelve cuántas se mandaron. */
export async function mandarPendientes(d: Dispositivo): Promise<number> {
  if (trabajando || !navigator.onLine || !supabase) return 0;
  trabajando = true;
  let enviadas = 0;
  try {
    for (const p of leerCola()) {
      const { error } = await supabase.rpc('fichar_cara', {
        p_dispositivo: d.id,
        p_secreto: d.secreto,
        p_embedding: p.embedding,
        p_foto: p.foto,
        p_hora_pc: p.t,
      });
      if (error) break; // sin conexión o compu desactivada: queda para después
      guardarCola(leerCola().filter((x) => x.t !== p.t));
      enviadas++;
    }
  } finally {
    trabajando = false;
  }
  return enviadas;
}

// Sincroniza el avance de la persona con la base (Supabase). Todo pasa por una cola guardada
// en el celular: si no hay internet o falla, se reintenta al volver la conexión o en la próxima visita.
import { supabase, configurado } from '../lib/supabase';

type Op =
  | { accion: 'vista'; gondola: string; t: number }
  | { accion: 'leida'; seccion: string; t: number }
  | { accion: 'quiz'; gondola: string; bien: number; total: number; aprobado: boolean; t: number }
  | { accion: 'intento'; nivel: number; nota: number; aprobado: boolean; preguntas: number; errores: string[]; t: number };

const COLA = 'lola-pendientes:v1';

const leerCola = (): Op[] => {
  try {
    const c = JSON.parse(localStorage.getItem(COLA) ?? '[]');
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
};
const guardarCola = (c: Op[]) => {
  try {
    localStorage.setItem(COLA, JSON.stringify(c.slice(-500)));
  } catch {}
};

async function usuario() {
  const { data } = await supabase!.auth.getSession();
  return data.session?.user.id ?? null;
}

async function ejecutar(op: Op, uid: string) {
  const db = supabase!;
  const cuando = new Date(op.t).toISOString();
  if (op.accion === 'vista') {
    const { error } = await db
      .from('progreso_gondola')
      .upsert({ user_id: uid, gondola: op.gondola, vista_el: cuando }, { onConflict: 'user_id,gondola', ignoreDuplicates: true });
    if (error) throw error;
  } else if (op.accion === 'leida') {
    const { error } = await db
      .from('secciones_leidas')
      .upsert({ user_id: uid, seccion: op.seccion, leida_el: cuando }, { onConflict: 'user_id,seccion', ignoreDuplicates: true });
    if (error) throw error;
  } else if (op.accion === 'intento') {
    const { error } = await db.from('intentos_examen').insert({
      user_id: uid,
      nivel: op.nivel,
      nota: op.nota,
      aprobado: op.aprobado,
      preguntas: op.preguntas,
      errores: op.errores,
      hecho_el: cuando,
    });
    if (error) throw error;
  } else if (op.accion === 'quiz') {
    const { data, error } = await db.from('progreso_gondola').select('*').eq('user_id', uid).eq('gondola', op.gondola).maybeSingle();
    if (error) throw error;
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
    const r = await db.from('progreso_gondola').upsert(fila, { onConflict: 'user_id,gondola' });
    if (r.error) throw r.error;
  }
}

let trabajando = false;

/** Manda a la base todo lo pendiente. Se puede llamar seguido: si ya está trabajando, no hace nada. */
export async function procesarPendientes() {
  if (!configurado || trabajando || !navigator.onLine) return;
  trabajando = true;
  try {
    const uid = await usuario();
    if (!uid) return;
    for (const op of leerCola()) {
      try {
        await ejecutar(op, uid);
        guardarCola(leerCola().filter((x) => x.t !== op.t || x.accion !== op.accion));
      } catch {
        break; // Sin conexión o error: queda para el próximo intento, en orden.
      }
    }
  } finally {
    trabajando = false;
  }
}

function encolar(op: Op) {
  if (!configurado) return;
  guardarCola([...leerCola(), op]);
  void procesarPendientes();
}

export const nube = {
  vista: (gondola: string) => encolar({ accion: 'vista', gondola, t: Date.now() }),
  leida: (seccion: string) => encolar({ accion: 'leida', seccion, t: Date.now() }),
  quiz: (gondola: string, bien: number, total: number, aprobado: boolean) =>
    encolar({ accion: 'quiz', gondola, bien, total, aprobado, t: Date.now() }),
  intento: (r: { nivel: number; nota: number; aprobado: boolean; preguntas: number; errores: string[] }) =>
    encolar({ accion: 'intento', ...r, t: Date.now() }),
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

if (typeof window !== 'undefined') addEventListener('online', () => void procesarPendientes());

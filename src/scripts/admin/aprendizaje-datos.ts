// Datos del aprendizaje para el panel de admin: avance en las góndolas, repasos, exámenes y temas
// de Bienvenida. Los títulos de la guía vienen de la página (componente DatosGuia).
import { supabase } from '../../lib/supabase';
import type { Persona } from './comun';

export interface Gondola {
  user_id: string;
  gondola: string;
  vista_el: string | null;
  quiz_intentos: number;
  quiz_mejor: number;
  quiz_total: number;
  completada_el: string | null;
  actualizado_el: string;
}
export interface Intento {
  user_id: string;
  nivel: number;
  nota: number;
  aprobado: boolean;
  hecho_el: string;
}
export interface Lectura {
  user_id: string;
  seccion: string;
  leida_el: string;
}
export interface Evento {
  user_id: string;
  tipo: 'Góndola leída' | 'Repaso' | 'Góndola completada' | 'Examen' | 'Bienvenida';
  que: string;
  resultado: string;
  fecha: string;
}
export interface DatosAprendizaje {
  equipo: Persona[];
  bajas: Persona[];
  gondolas: Gondola[];
  intentos: Intento[];
  leidas: Lectura[];
  /** Mails con cara registrada en el fichador. */
  conCara: Set<string>;
}
export interface InfoGuia {
  gondolas: { id: string; titulo: string }[];
  secciones: { id: string; titulo: string }[];
  niveles: { numero: number; nombre: string }[];
}

export const leerInfoGuia = (): InfoGuia => JSON.parse(document.getElementById('guia-datos')!.textContent!);

export const porUsuario = <T extends { user_id: string }>(lista: T[], uid: string | null) => (uid ? lista.filter((x) => x.user_id === uid) : []);

export async function cargarAprendizaje(): Promise<DatosAprendizaje> {
  const db = supabase!;
  const [a, g, i, l] = await Promise.all([
    db.from('autorizados').select('*').order('rol').order('nombre'),
    db.from('progreso_gondola').select('user_id,gondola,vista_el,quiz_intentos,quiz_mejor,quiz_total,completada_el,actualizado_el'),
    db.from('intentos_examen').select('user_id,nivel,nota,aprobado,hecho_el').order('hecho_el', { ascending: false }).limit(5000),
    db.from('secciones_leidas').select('user_id,seccion,leida_el'),
  ]);
  if (a.error || g.error || i.error || l.error) throw a.error ?? g.error ?? i.error ?? l.error;
  // Caras del fichador: si la base todavía no tiene el fichador, el panel anda igual.
  const c = await db.from('caras').select('email');
  const todos = a.data as Persona[];
  return {
    equipo: todos.filter((p) => p.activo !== false),
    bajas: todos.filter((p) => p.activo === false),
    gondolas: g.data as Gondola[],
    intentos: i.data as Intento[],
    leidas: l.data as Lectura[],
    conCara: new Set(c.error ? [] : (c.data as { email: string }[]).map((x) => x.email)),
  };
}

/** Toda la actividad registrada, como eventos con fecha (lo más nuevo primero). */
export function eventos(d: DatosAprendizaje, info: InfoGuia): Evento[] {
  const tituloGondola = (id: string) => info.gondolas.find((g) => g.id === id)?.titulo ?? id;
  const tituloSeccion = (id: string) => info.secciones.find((s) => s.id === id)?.titulo ?? id;
  const nombreNivel = (n: number) => info.niveles.find((v) => v.numero === n)?.nombre ?? '';
  const lista: Evento[] = [];
  for (const g of d.gondolas) {
    const t = tituloGondola(g.gondola);
    if (g.vista_el) lista.push({ user_id: g.user_id, tipo: 'Góndola leída', que: t, resultado: '', fecha: g.vista_el });
    if (g.quiz_intentos > 0)
      lista.push({
        user_id: g.user_id,
        tipo: 'Repaso',
        que: t,
        resultado: `Mejor: ${g.quiz_mejor} de ${g.quiz_total} (${g.quiz_intentos} ${g.quiz_intentos === 1 ? 'intento' : 'intentos'})`,
        fecha: g.actualizado_el,
      });
    if (g.completada_el) lista.push({ user_id: g.user_id, tipo: 'Góndola completada', que: t, resultado: 'Repaso aprobado', fecha: g.completada_el });
  }
  for (const x of d.intentos)
    lista.push({
      user_id: x.user_id,
      tipo: 'Examen',
      que: `Nivel ${x.nivel} · ${nombreNivel(x.nivel)}`,
      resultado: `${x.nota}% · ${x.aprobado ? 'aprobado' : 'no aprobado'}`,
      fecha: x.hecho_el,
    });
  for (const l of d.leidas) lista.push({ user_id: l.user_id, tipo: 'Bienvenida', que: tituloSeccion(l.seccion), resultado: 'Tema leído', fecha: l.leida_el });
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Promedio del mejor resultado en los repasos (de 0 a 1), o null si no hizo ninguno. */
export function promedioRepasos(gs: Gondola[]) {
  const con = gs.filter((x) => x.quiz_intentos > 0);
  return con.length ? con.reduce((s, x) => s + x.quiz_mejor / (x.quiz_total || 5), 0) / con.length : null;
}

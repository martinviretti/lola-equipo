// Lo que comparten las pestañas del panel de admin: pedir datos a la base, fechas de Argentina y las
// cuentas de horas (tramos de entrada y salida, carga horaria).
import { supabase } from '../../lib/supabase';
import { diaClave, duracion, hora, tramos, type Fichada } from '../../lib/fichador';

// ---------- Tipos ----------
export interface Persona {
  email: string;
  nombre: string | null;
  rol: 'empleada' | 'admin';
  activo: boolean;
  horario_fijo: boolean;
  /** Carga horaria: horas por semana (null = sin cargar). */
  horas_semana: number | null;
  user_id: string | null;
  agregado_el: string;
  primer_ingreso: string | null;
  ultimo_ingreso: string | null;
  baja_el: string | null;
}
export interface FichadaCompleta extends Fichada {
  similitud: number | null;
  revisada_por: string | null;
  anulada_por: string | null;
  anulada_motivo: string | null;
  motivo: string | null;
  nota: string | null;
  corregida_por: string | null;
}
export interface Horario {
  email: string;
  dia: number;
  entrada: string;
  salida: string;
}

export const COLUMNAS = 'id,email,tipo,hora,metodo,similitud,sin_conexion,revisar,revisada_el,revisada_por,anulada,anulada_por,anulada_motivo,motivo,creada_por,nota,hora_original,corregida_por';
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const METODO: Record<string, string> = { cara: 'Con la cara', codigo: 'Con el código del celular', manual: 'Cargada a mano' };

// ---------- Pantalla ----------
export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, clase = '', texto = '') => {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto) e.textContent = texto;
  return e;
};
export const boton = (texto: string, clase: string, accion: () => void) => {
  const b = el('button', `boton !py-1.5 !px-3 !text-sm ${clase}`, texto);
  b.type = 'button';
  b.addEventListener('click', accion);
  return b;
};
export const nombreDe = (p: { email: string; nombre: string | null }) => p.nombre || p.email.split('@')[0];

// ---------- Base ----------
export async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/** Supabase devuelve como mucho 1000 filas por pedido: se piden de a 1000 hasta traer todo. */
export async function todas<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const parte = await q<T[]>(armar(desde, desde + 999));
    filas.push(...parte);
    if (parte.length < 1000) return filas;
  }
}

export const cargarPersonas = () => q<Persona[]>(supabase!.from('autorizados').select('*').order('nombre'));

// ---------- Fechas (siempre días de Argentina, "AAAA-MM-DD") ----------
/** Medianoche de un día de Argentina, como ISO. */
export const inicioDia = (dia: string) => `${dia}T00:00:00-03:00`;
export const sumarDias = (dia: string, n: number) => diaClave(new Date(new Date(`${dia}T12:00:00-03:00`).getTime() + n * 86400000));
export const diaSemana = (dia: string) => new Date(`${dia}T12:00:00-03:00`).getUTCDay();
export const lunesDe = (dia: string) => sumarDias(dia, -((diaSemana(dia) + 6) % 7));
export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const minutosDe = (iso: string) => minutos(hora(iso));

/** Fichadas entre dos días (desde incluido, hasta excluido), de a 1000. */
export const fichadasEntre = (desde: string, hasta: string) =>
  todas<FichadaCompleta>((a, b) => supabase!.from('fichadas').select(COLUMNAS).gte('hora', inicioDia(desde)).lt('hora', inicioDia(hasta)).order('hora').order('id').range(a, b));

// ---------- Horas ----------
/** Cada entrada con su salida, persona por persona. */
export function tramosPorPersona(fs: Fichada[], horasMax = 16) {
  const por = new Map<string, Fichada[]>();
  for (const f of fs) por.set(f.email, [...(por.get(f.email) ?? []), f]);
  return [...por.values()].flatMap((lista) => tramos(lista, horasMax));
}

/** Horas de la carga horaria como texto: 30 → "30 h", 22.5 → "22 h 30". */
export const horasTexto = (h: number) => (Number.isInteger(h) ? `${h} h` : duracion(h * 3600000));

/** Cuánto lleva contra su carga horaria de la semana. */
export function avanceCarga(ms: number, horas: number, semanaActual: boolean) {
  const falta = horas * 3600000 - ms;
  if (Math.abs(falta) < 5 * 60000) return { texto: 'Cumplió', clase: 'text-marca' };
  if (falta > 0) return { texto: `${semanaActual ? 'Faltan' : 'Faltaron'} ${duracion(falta)}`, clase: semanaActual ? 'text-texto-2' : 'text-ambar' };
  return { texto: `${duracion(-falta)} de más`, clase: 'text-marca' };
}

/** Las que fichan: activas, empleadas o con cara registrada o carga horaria (la encargada también puede fichar). */
export const quienesFichan = (personas: Persona[], conCara: Set<string>) =>
  personas.filter((p) => p.activo && (p.rol === 'empleada' || conCara.has(p.email) || p.horas_semana));

/** "hace 3 días": cuándo entró a la app por última vez. */
export const hace = (iso: string | null) => {
  if (!iso) return 'Nunca entró';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return dias === 0 ? 'Entró hoy' : dias === 1 ? 'Entró ayer' : `Entró hace ${dias} días`;
};

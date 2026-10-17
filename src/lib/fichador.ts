// Fichador: lo que comparten la compu del local (/fichador), el celular (/fichar) y el panel (/fichadas).
import { url } from './url';

/**
 * Librería de reconocimiento facial face-api (MIT), servida desde el propio sitio (public/face-api/<versión>):
 * así nadie de afuera puede cambiarle el código al fichador. Para actualizarla, copiar dist/face-api.esm.js y
 * los 3 modelos que usamos del paquete npm a una carpeta nueva con la versión y cambiar este número.
 */
export const FACEAPI_VERSION = '1.7.15';
export const FACEAPI_BASE = url(`/face-api/${FACEAPI_VERSION}`);

/** Cada cuántos segundos cambia el QR del celular (tiene que coincidir con la base). */
export const PASO_QR = 3;
export const PREFIJO_QR = 'LOLA1';

const ZONA = 'America/Argentina/Buenos_Aires';

// ---------- La compu activada ----------
export interface Dispositivo {
  id: string;
  secreto: string;
  nombre: string;
}
const CLAVE_DISPOSITIVO = 'lola-fichador:v1';

export const dispositivoGuardado = (): Dispositivo | null => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) ?? 'null');
  } catch {
    return null;
  }
};
export const guardarDispositivo = (d: Dispositivo | null) => {
  if (d) localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(d));
  else localStorage.removeItem(CLAVE_DISPOSITIVO);
};

// ---------- QR del celular ----------
const hexABytes = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
const bytesAHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Texto del QR para un paso de tiempo: LOLA1.<id>.<paso>.<firma>. La base lo verifica con la misma clave. */
export async function textoQr(id: string, clave: string, paso: number) {
  const llave = await crypto.subtle.importKey('raw', hexABytes(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = bytesAHex(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${id}.${paso}`))).slice(0, 16);
  return `${PREFIJO_QR}.${id}.${paso}.${firma}`;
}

// ---------- Fechas (siempre en hora de Argentina) ----------
export const hora = (iso: string | Date) =>
  new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA }).format(new Date(iso));

/** Clave del día en Argentina: 2026-10-12 */
export const diaClave = (iso: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONA }).format(new Date(iso));

export const diaLargo = (iso: string | Date) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).format(new Date(iso));

/** 4 h 39 · 45 min */
export const duracion = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  if (!h) return `${min} min`;
  return min % 60 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${h} h`;
};

// ---------- Tramos: cada entrada con su salida ----------
export interface Fichada {
  id: number;
  email: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  metodo: 'cara' | 'codigo' | 'manual';
  revisar?: string | null;
  revisada_el?: string | null;
  anulada?: boolean;
  sin_conexion?: boolean;
  hora_original?: string | null;
  creada_por?: string | null;
}

export interface Tramo {
  email: string;
  dia: string;
  entrada?: Fichada;
  salida?: Fichada;
  /** Milisegundos trabajados (solo si tiene entrada y salida). */
  ms: number;
}

/**
 * Arma los tramos de una persona en orden: entrada → salida del MISMO día (igual que la base). Una
 * salida sin entrada o una entrada sin salida quedan como tramo incompleto, para que la admin lo complete.
 */
export function tramos(fichadas: Fichada[], horasMax = 16): Tramo[] {
  const lista = fichadas.filter((f) => !f.anulada).sort((a, b) => a.hora.localeCompare(b.hora));
  const salida: Tramo[] = [];
  let abierto: Tramo | null = null;
  for (const f of lista) {
    if (f.tipo === 'entrada') {
      if (abierto) salida.push(abierto);
      abierto = { email: f.email, dia: diaClave(f.hora), entrada: f, ms: 0 };
    } else if (abierto && abierto.dia === diaClave(f.hora) && new Date(f.hora).getTime() - new Date(abierto.entrada!.hora).getTime() < horasMax * 3600000) {
      abierto.salida = f;
      abierto.ms = new Date(f.hora).getTime() - new Date(abierto.entrada!.hora).getTime();
      salida.push(abierto);
      abierto = null;
    } else {
      if (abierto) salida.push(abierto);
      abierto = null;
      salida.push({ email: f.email, dia: diaClave(f.hora), salida: f, ms: 0 });
    }
  }
  if (abierto) salida.push(abierto);
  return salida;
}

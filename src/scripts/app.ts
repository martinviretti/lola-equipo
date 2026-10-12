import { url } from '../lib/url';
// Estado de la app guardado en el celular (localStorage): fichas guardadas, góndolas vistas,
// el nombre de la persona y cómo le fue en cada nivel del examen.
const CLAVE = 'lola-app:v1';

export type Nivel = 1 | 2 | 3;

export interface EstadoNivel {
  intentos: number;
  /** Mejor nota en %. */
  mejor: number;
  /** Fecha (ISO) del primer aprobado; si no está, todavía no aprobó. */
  aprobadoEl?: string;
  /** Nota con la que aprobó, en %. */
  notaAprobado?: number;
  /** Ids de las preguntas del último intento (para no repetirlas en el siguiente). */
  ultimas: string[];
  /** Ids de las preguntas erradas en el último intento (para "Repasar mis errores"). */
  errores: string[];
}

interface Estado {
  guardadas: string[];
  vistas: string[];
  nombre?: string;
  niveles: Partial<Record<Nivel, EstadoNivel>>;
}

function leer(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE) ?? '');
    return { guardadas: e.guardadas ?? [], vistas: e.vistas ?? [], nombre: e.nombre, niveles: e.niveles ?? {} };
  } catch {
    return { guardadas: [], vistas: [], niveles: {} };
  }
}

function guardar(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // Sin almacenamiento disponible: la app funciona igual, sin recordar nada.
  }
}

const alternar = (lista: string[], id: string, poner: boolean) =>
  poner ? (lista.includes(id) ? lista : [...lista, id]) : lista.filter((x) => x !== id);

export const nivelVacio = (): EstadoNivel => ({ intentos: 0, mejor: 0, ultimas: [], errores: [] });

export const app = {
  estado: leer,
  estaGuardada: (id: string) => leer().guardadas.includes(id),
  guardarFicha(id: string, poner: boolean) {
    const e = leer();
    e.guardadas = alternar(e.guardadas, id, poner);
    guardar(e);
  },
  marcarVista(gondolaId: string) {
    const e = leer();
    e.vistas = alternar(e.vistas, gondolaId, true);
    guardar(e);
  },
  nivel: (n: Nivel): EstadoNivel => ({ ...nivelVacio(), ...leer().niveles[n] }),
  /** Registra un intento del examen y devuelve el estado actualizado del nivel. */
  registrarIntento(n: Nivel, r: { nota: number; aprobado: boolean; ids: string[]; errores: string[] }) {
    const e = leer();
    const v = { ...nivelVacio(), ...e.niveles[n] };
    v.intentos++;
    v.mejor = Math.max(v.mejor, r.nota);
    v.ultimas = r.ids;
    v.errores = r.errores;
    if (r.aprobado && !v.aprobadoEl) {
      v.aprobadoEl = new Date().toISOString();
      v.notaAprobado = r.nota;
    }
    e.niveles[n] = v;
    guardar(e);
    return v;
  },
  guardarNombre(nombre: string) {
    const e = leer();
    e.nombre = nombre.trim().slice(0, 60);
    guardar(e);
  },
};

export interface Ficha {
  id: string;
  gondola: string;
  gondolaId: string;
  icono: string;
  titulo: string;
  url: string;
  lineas: { etiqueta: string; texto: string }[];
}

let cache: Promise<Ficha[]> | null = null;
export const cargarFichas = () => (cache ??= fetch(url('/fichas.json')).then((r) => r.json()));

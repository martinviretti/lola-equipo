import { url } from '../lib/url';
import { nube } from './nube';
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

/** Quiz de repaso al final de cada góndola. */
export interface EstadoQuiz {
  intentos: number;
  /** Respuestas bien en el mejor intento. */
  mejor: number;
  total: number;
  /** Fecha (ISO) de la primera vez que lo aprobó: la góndola queda completada. */
  completadaEl?: string;
}

interface Estado {
  guardadas: string[];
  vistas: string[];
  nombre?: string;
  niveles: Partial<Record<Nivel, EstadoNivel>>;
  quizzes: Record<string, EstadoQuiz>;
}

function leer(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE) ?? '');
    return { guardadas: e.guardadas ?? [], vistas: e.vistas ?? [], nombre: e.nombre, niveles: e.niveles ?? {}, quizzes: e.quizzes ?? {} };
  } catch {
    return { guardadas: [], vistas: [], niveles: {}, quizzes: {} };
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
    if (!e.vistas.includes(gondolaId)) nube.vista(gondolaId);
    e.vistas = alternar(e.vistas, gondolaId, true);
    guardar(e);
  },
  quiz: (gondolaId: string): EstadoQuiz | undefined => leer().quizzes[gondolaId],
  /** Registra un intento del quiz de una góndola. Aprobado = completada. */
  registrarQuiz(gondolaId: string, bien: number, total: number, aprobado: boolean) {
    const e = leer();
    const q = e.quizzes[gondolaId] ?? { intentos: 0, mejor: 0, total };
    q.intentos++;
    q.mejor = Math.max(q.mejor, bien);
    q.total = total;
    if (aprobado && !q.completadaEl) q.completadaEl = new Date().toISOString();
    e.quizzes[gondolaId] = q;
    guardar(e);
    nube.quiz(gondolaId, bien, total, aprobado);
    return q;
  },
  /** Suma al celular el avance que está en la base (otro celular, datos borrados). */
  mezclarDeLaNube(p: {
    gondolas: { gondola: string; vista_el: string | null; quiz_intentos: number; quiz_mejor: number; quiz_total: number; completada_el: string | null }[];
    intentos: { nivel: number; nota: number; aprobado: boolean; hecho_el: string }[];
  }) {
    const e = leer();
    for (const g of p.gondolas) {
      if (g.vista_el && !e.vistas.includes(g.gondola)) e.vistas.push(g.gondola);
      if (g.quiz_intentos > 0) {
        const q = e.quizzes[g.gondola] ?? { intentos: 0, mejor: 0, total: g.quiz_total };
        q.intentos = Math.max(q.intentos, g.quiz_intentos);
        q.mejor = Math.max(q.mejor, g.quiz_mejor);
        q.total = g.quiz_total || q.total;
        q.completadaEl ??= g.completada_el ?? undefined;
        e.quizzes[g.gondola] = q;
      }
    }
    for (const i of p.intentos) {
      const n = i.nivel as Nivel;
      const v = { ...nivelVacio(), ...e.niveles[n] };
      v.intentos = Math.max(v.intentos, p.intentos.filter((x) => x.nivel === i.nivel).length);
      v.mejor = Math.max(v.mejor, i.nota);
      if (i.aprobado && !v.aprobadoEl) {
        v.aprobadoEl = i.hecho_el;
        v.notaAprobado = i.nota;
      }
      e.niveles[n] = v;
    }
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
    nube.intento({ nivel: n, nota: r.nota, aprobado: r.aprobado, preguntas: r.ids.length, errores: r.errores });
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

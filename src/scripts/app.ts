import { url } from '../lib/url';
// Estado de la app guardado en el celular (localStorage): fichas guardadas,
// góndolas vistas y el resultado del último examen.
const CLAVE = 'lola-app:v1';

export interface ResultadoExamen {
  bien: number;
  total: number;
  /** Góndola del examen ('' = todas). */
  gondola: string;
  fecha: string;
}

interface Estado {
  guardadas: string[];
  vistas: string[];
  ultimoExamen?: ResultadoExamen;
}

function leer(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE) ?? '');
    return { guardadas: e.guardadas ?? [], vistas: e.vistas ?? [], ultimoExamen: e.ultimoExamen };
  } catch {
    return { guardadas: [], vistas: [] };
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
  guardarExamen(r: ResultadoExamen) {
    const e = leer();
    e.ultimoExamen = r;
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

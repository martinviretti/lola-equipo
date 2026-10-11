// La app se publica en una subcarpeta (GitHub Pages: /lola-equipo). Toda dirección interna
// pasa por acá para llevar ese prefijo. En desarrollo el prefijo también aplica.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** url('/guia/01-yerbas') → '/lola-equipo/guia/01-yerbas' */
export const url = (ruta: string) => `${BASE}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;

/** Ruta actual sin el prefijo, para saber en qué sección estamos: '/lola-equipo/buscar' → '/buscar' */
export const sinBase = (ruta: string) => (ruta.startsWith(BASE) ? ruta.slice(BASE.length) : ruta) || '/';

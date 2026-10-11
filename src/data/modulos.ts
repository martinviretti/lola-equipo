import { url } from '../lib/url';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Modulo = CollectionEntry<'modulos'>;

export const PARTES = [
  { nombre: 'Empezar', bajada: 'Para tu primer día.' },
  { nombre: 'Lo que tenés que saber', bajada: 'La base para atender sin miedo a equivocarte.' },
  { nombre: 'Los productos', bajada: 'Qué es cada cosa, cómo se usa y qué te van a preguntar.' },
  { nombre: 'Atender y trabajar', bajada: 'El mostrador y el día a día del local.' },
  { nombre: 'Consulta rápida', bajada: 'Para buscar algo puntual en medio de una venta.' },
] as const;

export async function getModulos(): Promise<Modulo[]> {
  const todos = await getCollection('modulos');
  return todos.sort((a, b) => a.data.numero - b.data.numero);
}

export const urlModulo = (m: Modulo) => url(`/modulos/${m.id}`);
export const numeroModulo = (m: Modulo) => String(m.data.numero).padStart(2, '0');

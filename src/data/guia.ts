import { url } from '../lib/url';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Categoria = CollectionEntry<'guia'>;

export async function getGuia(): Promise<Categoria[]> {
  const todas = await getCollection('guia');
  return todas.sort((a, b) => a.data.numero - b.data.numero);
}

export const urlCategoria = (c: Categoria) => url(`/guia/${c.id}`);

// Zonas del local para agrupar el índice. Cada góndola cae en la zona según su número.
export const ZONAS = [
  { nombre: 'Mate, tés e infusiones', desde: 1, hasta: 3 },
  { nombre: 'Frutos secos, semillas y desecadas', desde: 4, hasta: 6 },
  { nombre: 'Harinas, cereales, legumbres y pastas', desde: 7, hasta: 10 },
  { nombre: 'Panes y dulces', desde: 11, hasta: 14 },
  { nombre: 'Para cocinar', desde: 15, hasta: 17 },
  { nombre: 'Heladera y freezer', desde: 18, hasta: 21 },
  { nombre: 'Góndolas especiales', desde: 22, hasta: 99 },
];

export const porZona = (lista: Categoria[]) =>
  ZONAS.map((z) => ({ ...z, categorias: lista.filter((c) => c.data.numero >= z.desde && c.data.numero <= z.hasta) })).filter(
    (z) => z.categorias.length > 0,
  );

// Lo único "serio" de la guía: cinco reglas para no meter la pata con un cliente.
export const reglas = [
  {
    icono: 'heartbeat',
    titulo: 'Nunca digas que algo cura',
    texto: 'Ningún yuyo, semilla ni suplemento cura, adelgaza o baja el azúcar. Contá cómo se usa y, si es un tema de salud, que lo consulte con su médico.',
  },
  {
    icono: 'grains-slash',
    titulo: 'Sin TACC, solo con el logo',
    texto: 'Para un celíaco sirve solo lo que trae el logo sin TACC en el envase cerrado. Nada del granel es apto, aunque sea arroz o quinoa.',
  },
  {
    icono: 'warning-circle',
    titulo: 'Con alergias, mostrá la etiqueta',
    texto: 'Si alguien es alérgico (maní, frutos secos, leche), leé la etiqueta con la persona. No respondas de memoria. Ante la duda, no lo recomiendes.',
  },
  {
    icono: 'snowflake',
    titulo: 'Lo frío no espera',
    texto: 'Congelados y refrigerados se guardan apenas llegan. Lo que se descongeló no se vuelve a congelar ni se vende.',
  },
  {
    icono: 'question',
    titulo: 'Si no sabés, preguntá',
    texto: '"No lo sé, dejame consultarlo" es una respuesta perfecta. Inventar no. La encargada y esta guía están para eso.',
  },
];

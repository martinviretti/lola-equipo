import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { getGuia, urlCategoria } from '../data/guia';

// Todas las fichas de producto de la guía (cada "### Producto" de "## Los productos"),
// para el modo Estudiar y para Guardados. Se genera en el build.

export interface Ficha {
  /** Identificador estable: góndola#producto. */
  id: string;
  gondola: string;
  gondolaId: string;
  icono: string;
  titulo: string;
  url: string;
  /** Viñetas de la ficha, ya sin Markdown: [{ etiqueta: 'Qué es', texto: '...' }]. */
  lineas: { etiqueta: string; texto: string }[];
}

const SALTO = /\r?\n/;
const sinMarkdown = (s: string) => {
  const t = s.replace(/\*\*/g, '').replace(/[*_`]/g, '').trim();
  // Viene de "Qué es: yerba…": en la tarjeta va solo, así que arranca en mayúscula.
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const GET: APIRoute = async () => {
  const fichas: Ficha[] = [];

  for (const c of await getGuia()) {
    const { headings } = await render(c);
    const titulos = headings.filter((h) => h.depth === 3);
    let k = 0;
    let actual: Ficha | null = null;

    // Toda sección "### Nombre" con viñetas "**Etiqueta:** texto" es una ficha.
    for (const linea of (c.body ?? '').split(SALTO)) {
      if (/^##\s/.test(linea)) {
        actual = null;
        continue;
      }
      if (/^###\s/.test(linea)) {
        const h = titulos[k++];
        if (!h) {
          actual = null;
          continue;
        }
        actual = {
          id: `${c.id}#${h.slug}`,
          gondola: c.data.titulo,
          gondolaId: c.id,
          icono: c.data.icono,
          titulo: h.text,
          url: `${urlCategoria(c)}#${h.slug}`,
          lineas: [],
        };
        fichas.push(actual);
        continue;
      }
      const vineta = linea.match(/^\s*-\s+\*\*([^*]+?):?\*\*:?\s*(.*)$/);
      if (actual && vineta) {
        actual.lineas.push({ etiqueta: vineta[1].replace(/:$/, '').trim(), texto: sinMarkdown(vineta[2]) });
      }
    }
  }

  return new Response(JSON.stringify(fichas.filter((f) => f.lineas.length > 0)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

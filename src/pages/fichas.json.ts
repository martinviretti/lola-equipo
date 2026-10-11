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
  /** Texto de la ficha, ya sin Markdown: párrafos con etiqueta vacía y después Tip/Ojo. */
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

    // Toda sección "### Nombre" de "## Los productos" es una ficha: sus párrafos van sin
    // etiqueta y sus viñetas "**Tip:** texto" / "**Ojo:** texto", con la etiqueta.
    let seguido = false;
    for (const linea of (c.body ?? '').split(SALTO)) {
      if (/^##\s/.test(linea)) {
        actual = null;
        continue;
      }
      if (!linea.trim()) {
        seguido = false;
        continue;
      }
      if (/^###\s/.test(linea)) {
        seguido = false;
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
      if (!actual) continue;
      const vineta = linea.match(/^\s*-\s+\*\*([^*]+?):?\*\*:?\s*(.*)$/);
      if (vineta) {
        actual.lineas.push({ etiqueta: vineta[1].replace(/:$/, '').trim(), texto: sinMarkdown(vineta[2]) });
        seguido = false;
      } else if (seguido) {
        // Un párrafo escrito en varias líneas seguidas.
        const ultima = actual.lineas[actual.lineas.length - 1];
        ultima.texto = `${ultima.texto} ${sinMarkdown(linea)}`;
      } else if (!/^\s*[-|]/.test(linea)) {
        actual.lineas.push({ etiqueta: '', texto: sinMarkdown(linea) });
        seguido = true;
      }
    }
  }

  return new Response(JSON.stringify(fichas.filter((f) => f.lineas.length > 0)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { getModulos, urlModulo, numeroModulo } from '../data/modulos';
import { getGuia, urlCategoria } from '../data/guia';

// Índice del buscador: primero la guía de productos (una entrada por producto) y después
// el manual completo (una por sección). Se genera en el build y el navegador lo descarga
// recién cuando se usa el buscador.

interface Entrada {
  modulo: string;
  titulo: string;
  url: string;
  texto: string;
  guia?: boolean;
}

const SALTO = /\r?\n/;

const limpiar = (s: string) =>
  s
    .replace(/<\/?Alerta[^>]*>/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/[*_`#>]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*-\s*\[[ x]\]\s*/gim, '')
    .replace(/^\s*[-:]+\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Parte el cuerpo en bloques según los títulos ## y ###. */
function bloques(
  cuerpo: string,
  headings: { depth: number; slug: string; text: string }[],
  inicial: { titulo: string; texto: string[] },
) {
  const titulos = headings.filter((h) => h.depth === 2 || h.depth === 3);
  const lista = [{ ...inicial, slug: '' }];
  let k = 0;
  for (const linea of cuerpo.split(SALTO)) {
    if (/^#{2,3}\s/.test(linea)) {
      const h = titulos[k++];
      lista.push({ titulo: h?.text ?? linea.replace(/^#+\s*/, ''), slug: h?.slug ?? '', texto: [] });
    } else {
      lista[lista.length - 1].texto.push(linea);
    }
  }
  return lista;
}

export const GET: APIRoute = async () => {
  const entradas: Entrada[] = [];

  for (const c of await getGuia()) {
    const { headings } = await render(c);
    const lista = bloques(c.body ?? '', headings, { titulo: c.data.titulo, texto: [c.data.bajada, ...c.data.claves] });
    for (const b of lista) {
      const texto = limpiar(b.texto.join(' '));
      if (!texto) continue;
      entradas.push({
        modulo: `Guía · ${c.data.titulo}`,
        titulo: b.titulo,
        url: `${urlCategoria(c)}${b.slug ? `#${b.slug}` : ''}`,
        texto,
        guia: true,
      });
    }
  }

  for (const m of await getModulos()) {
    const { headings } = await render(m);
    const lista = bloques(m.body ?? '', headings, { titulo: m.data.titulo, texto: [m.data.resumen] });
    for (const b of lista) {
      entradas.push({
        modulo: `Manual ${numeroModulo(m)} · ${m.data.titulo}`,
        titulo: b.titulo,
        url: `${urlModulo(m)}${b.slug ? `#${b.slug}` : ''}`,
        texto: limpiar(b.texto.join(' ')),
      });
    }
  }

  return new Response(JSON.stringify(entradas), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

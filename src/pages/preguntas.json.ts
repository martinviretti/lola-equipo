import type { APIRoute } from 'astro';
import { getGuia, urlCategoria } from '../data/guia';

// Las preguntas reales de clientes de cada góndola ("## Lo que más te van a preguntar"),
// con su respuesta modelo. Las usa el examen. Se genera en el build.

export interface PreguntaCliente {
  gondolaId: string;
  gondola: string;
  url: string;
  pregunta: string;
  respuesta: string;
}

const sinMarkdown = (s: string) => s.replace(/\*\*/g, '').replace(/[*_`]/g, '').trim();

export const GET: APIRoute = async () => {
  const lista: PreguntaCliente[] = [];

  for (const c of await getGuia()) {
    let dentro = false;
    let actual: PreguntaCliente | null = null;
    for (const linea of (c.body ?? '').split(/\r?\n/)) {
      if (/^##\s/.test(linea)) {
        dentro = /^##\s+Lo que más te van a preguntar/.test(linea);
        actual = null;
        continue;
      }
      if (!dentro) continue;
      if (!linea.trim()) {
        actual = null;
        continue;
      }
      const p = linea.match(/^\*\*(.+)\*\*\s*$/);
      if (p) {
        actual = {
          gondolaId: c.id,
          gondola: c.data.titulo,
          url: `${urlCategoria(c)}#lo-que-más-te-van-a-preguntar`,
          pregunta: p[1].replace(/^["“]|["”]$/g, '').trim(),
          respuesta: '',
        };
        lista.push(actual);
      } else if (actual) {
        actual.respuesta = `${actual.respuesta} ${sinMarkdown(linea)}`.trim();
      }
    }
  }

  return new Response(JSON.stringify(lista.filter((p) => p.respuesta)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

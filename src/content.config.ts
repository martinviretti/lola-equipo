import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Guía de productos: una página simple por góndola. Archivos en src/content/guia/NN-slug.mdx.
const guia = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/guia' }),
  schema: z.object({
    numero: z.number().int(),
    titulo: z.string(),
    /** Una frase que se ve en la tarjeta del índice. */
    bajada: z.string(),
    icono: z.string(),
    /** De 3 a 5 ideas clave que la empleada tiene que saber sí o sí. */
    claves: z.array(z.string()).min(2).max(6),
    /** Ya no se usa (era el número del manual largo, borrado). Se acepta para no romper fichas viejas. */
    modulo: z.number().int().optional(),
  }),
});

export const collections = { guia };

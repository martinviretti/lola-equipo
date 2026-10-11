import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Cada módulo del manual es un archivo MDX en src/content/modulos/NN-slug.mdx.
const modulos = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/modulos' }),
  schema: z.object({
    numero: z.number().int(),
    titulo: z.string(),
    /** Una o dos frases: de qué trata y por qué importa. */
    resumen: z.string(),
    /** Parte del manual a la que pertenece (agrupa el índice). */
    parte: z.enum(['Empezar', 'Lo que tenés que saber', 'Los productos', 'Atender y trabajar', 'Consulta rápida']),
    /** Minutos estimados de lectura. */
    minutos: z.number().int(),
    /** Nombre de ícono Phosphor (variante light). */
    icono: z.string(),
    objetivos: z.array(z.string()).default([]),
    quiz: z
      .array(
        z.object({
          pregunta: z.string(),
          opciones: z.array(z.string()).min(2).max(4),
          /** Índice (desde 0) de la opción correcta. */
          correcta: z.number().int().min(0),
          explicacion: z.string(),
        }),
      )
      .default([]),
    fuentes: z.array(z.object({ titulo: z.string(), url: z.string().url() })).default([]),
  }),
});

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
    /** Número del módulo largo del manual para profundizar (opcional). */
    modulo: z.number().int().optional(),
  }),
});

export const collections = { modulos, guia };

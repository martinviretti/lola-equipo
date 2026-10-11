// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import serviceWorker from './integraciones/service-worker.mjs';

// App del equipo publicada en GitHub Pages: https://martinviretti.github.io/lola-equipo
export default defineConfig({
  site: 'https://martinviretti.github.io',
  base: '/lola-equipo',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [mdx(), serviceWorker()],
  vite: { plugins: [tailwindcss()] },
});

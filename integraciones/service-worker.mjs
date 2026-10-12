// Integración de Astro: al terminar el build escribe dist/sw.js con la lista de todo lo
// que hay que guardar en el celular para que la app funcione sin internet.
import { readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No se guardan offline: los PDF (pesan varios MB y se bajan aparte) ni archivos internos.
const EXCLUIR = /\.(pdf|map|mp4|webm)$|^(_headers|_redirects|robots\.txt|sw\.js)$/;

async function listar(dir, base = dir) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await listar(ruta, base)));
    else salida.push(path.relative(base, ruta).split(path.sep).join('/'));
  }
  return salida;
}

// Las páginas se piden sin ".html". BASE es la subcarpeta donde vive la app (por ejemplo /lola-equipo).
let BASE = '';
const aUrl = (archivo) => {
  if (archivo === 'index.html') return `${BASE}/`;
  if (archivo.endsWith('.html')) return `${BASE}/${archivo.slice(0, -5)}`;
  return `${BASE}/${archivo}`;
};

export default function serviceWorker() {
  return {
    name: 'lola-service-worker',
    hooks: {
      'astro:config:done': ({ config }) => {
        BASE = config.base.replace(/\/$/, '');
      },
      'astro:build:done': async ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const archivos = (await listar(raiz)).filter((f) => !EXCLUIR.test(path.basename(f)) && f !== '404.html');
        const hash = createHash('sha256');
        let bytes = 0;
        for (const f of archivos) {
          const s = await stat(path.join(raiz, f));
          bytes += s.size;
          hash.update(`${f}:${s.size}:${s.mtimeMs}`);
        }
        const version = hash.digest('hex').slice(0, 12);
        const urls = archivos.map(aUrl);

        const sw = `// Generado en el build por integraciones/service-worker.mjs. No editar a mano.
const VERSION = '${version}';
const CACHE = 'lola-' + VERSION;
const INICIO = '${BASE}/';
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // De a poco, para no saturar conexiones lentas. Si una falla, se sigue con las demás.
      for (let i = 0; i < PRECACHE.length; i += 8) {
        await Promise.all(PRECACHE.slice(i, i + 8).map((u) => cache.add(u).catch(() => {})));
      }
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('lola-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const limpiar = (url) => {
  const u = new URL(url);
  u.hash = '';
  u.search = '';
  if (u.pathname.endsWith('.html')) u.pathname = u.pathname.slice(0, -5);
  if (u.pathname.endsWith('/index')) u.pathname = u.pathname.slice(0, -5);
  if (u.pathname === INICIO.slice(0, -1)) u.pathname = INICIO;
  return u.toString();
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Los videos van siempre a la red (pedidos por partes): no se guardan para usar sin internet.
  if (/\.(mp4|webm)$/.test(new URL(req.url).pathname)) return;

  // Páginas: primero la red (para ver lo último), si no hay conexión, lo guardado.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(limpiar(req.url), copia));
          }
          return res;
        })
        .catch(() => caches.match(limpiar(req.url)).then((r) => r || caches.match(INICIO))),
    );
    return;
  }

  // Todo lo demás (estilos, fuentes, imágenes, datos): lo guardado primero, y se actualiza de fondo.
  e.respondWith(
    caches.match(limpiar(req.url)).then((guardado) => {
      const red = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic' && !req.url.endsWith('.pdf')) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(limpiar(req.url), copia));
          }
          return res;
        })
        .catch(() => guardado);
      return guardado || red;
    }),
  );
});
`;
        await writeFile(path.join(raiz, 'sw.js'), sw, 'utf8');
        logger.info(`sw.js: ${urls.length} archivos para usar sin conexión (${Math.round(bytes / 1024)} KB), versión ${version}`);
      },
    },
  };
}

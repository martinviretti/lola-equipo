// Integración de Astro: al terminar el build escribe dist/sw.js con la lista de lo que hay que guardar en el
// celular para que la app funcione sin internet.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Nunca se guardan de entrada: PDF y videos (pesan varios MB y se bajan aparte), mapas de código y archivos internos.
const EXCLUIR = /\.(pdf|map|mp4|webm)$|^(_headers|_redirects|robots\.txt|sw\.js|404\.html)$/;
// Páginas que casi nadie usa: no se bajan en la primera visita. Se guardan solas la primera vez que se abren y,
// desde ahí, se vuelven a guardar en cada versión nueva. imprimir es solo para armar el PDF; admin y fichadas
// son de las encargadas; fichar y fichador, del celular y la compu del local.
const A_DEMANDA = ['guia/imprimir.html', 'admin.html', 'fichadas.html', 'fichar.html', 'fichador.html'];
// De la fuente solo se guarda el alfabeto latino: los otros subsets no se usan en la app.
const OTRO_ALFABETO = /-(cyrillic|cyrillic-ext|greek|greek-ext|latin-ext|vietnamese)-[^/]*\.woff2$/;

async function listar(dir, base = dir) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await listar(ruta, base)));
    else salida.push(path.relative(base, ruta).split(path.sep).join('/'));
  }
  return salida.sort();
}

// Las páginas se piden sin ".html". BASE es la subcarpeta donde vive la app (por ejemplo /lola-equipo).
let BASE = '';
const aUrl = (archivo) => {
  if (archivo === 'index.html') return `${BASE}/`;
  if (archivo.endsWith('.html')) return `${BASE}/${archivo.slice(0, -5)}`;
  return `${BASE}/${archivo}`;
};

/** Qué archivos del build nombra cada HTML, JS o CSS (scripts, estilos, fuentes, imágenes, imports). */
async function referencias(raiz, archivos) {
  const todos = new Set(archivos);
  const porNombre = new Map(archivos.filter((f) => f.startsWith('_astro/')).map((f) => [path.posix.basename(f), f]));
  const conBase = new RegExp(`${BASE}/([\\w./-]+\\.[a-z0-9]+)`, 'g');
  const refs = new Map();
  for (const f of archivos.filter((a) => /\.(html|js|css)$/.test(a))) {
    const texto = await readFile(path.join(raiz, f), 'utf8');
    const s = new Set();
    for (const [nombre] of texto.matchAll(/[\w.-]+\.(?:js|css|woff2?|webp|avif|png|jpe?g|svg)\b/g)) {
      if (porNombre.has(nombre)) s.add(porNombre.get(nombre));
    }
    for (const [, ruta] of texto.matchAll(conBase)) if (todos.has(ruta)) s.add(ruta);
    s.delete(f);
    refs.set(f, s);
  }
  return refs;
}

/** Todo lo que necesitan estas páginas para funcionar (siguiendo los imports). */
function cierre(paginas, refs) {
  const visto = new Set();
  const pila = [...paginas];
  while (pila.length) {
    const f = pila.pop();
    if (visto.has(f)) continue;
    visto.add(f);
    pila.push(...(refs.get(f) ?? []));
  }
  return visto;
}

// El service worker en sí. Se arma con JSON para no tener que escapar nada.
const codigo = (datos) => `// Generado en el build por integraciones/service-worker.mjs. No editar a mano.
const VERSION = ${JSON.stringify(datos.version)};
const CACHE = 'lola-' + VERSION;
const INICIO = ${JSON.stringify(datos.inicio)};
const PRECACHE = ${JSON.stringify(datos.precache)};
// Página -> lo que necesita. Se guarda solo si ya se había abierto en una versión anterior.
const A_DEMANDA = ${JSON.stringify(datos.aDemanda)};
// Si la red no contesta en este tiempo, se muestra la copia guardada (señal "colgada" en el local).
const TOPE_RED = 4000;
const SIN_CONEXION = ${JSON.stringify(datos.sinConexion)};

const esperar = (ms) => new Promise((ok) => setTimeout(() => ok(null), ms));
const esEsencial = (u) => u === INICIO || u.includes('/_astro/');

/** Guarda de a 8 (para no saturar conexiones lentas). Lo que ya quedó de un intento anterior no se vuelve a bajar. */
async function guardar(cache, urls) {
  const fallidas = [];
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(
      urls.slice(i, i + 8).map(async (u) => {
        if (await cache.match(u)) return;
        // 'reload': directo del servidor, sin pasar por el caché del navegador (que puede tener la versión anterior).
        try { await cache.add(new Request(u, { cache: 'reload' })); } catch { fallidas.push(u); }
      }),
    );
  }
  return fallidas;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const extra = [];
    for (const [pagina, lista] of Object.entries(A_DEMANDA)) if (await caches.match(pagina)) extra.push(...lista);
    const fallidas = await guardar(cache, PRECACHE);
    // Sin la portada, los estilos o los scripts, esta versión no se activa: sigue la anterior y el navegador
    // vuelve a intentar la instalación en la próxima visita (lo que ya se bajó queda guardado).
    if (fallidas.some(esEsencial)) throw new Error('Precache incompleto: ' + fallidas.filter(esEsencial).join(', '));
    await guardar(cache, [...new Set(extra)].filter((u) => !PRECACHE.includes(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('lola-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Si en la instalación falló algo no esencial (una góndola, una imagen), se completa en segundo plano al abrir
// otra página. Cuando ya está todo, no se vuelve a revisar hasta que el service worker arranque de nuevo.
let completando = null;
const completar = () =>
  (completando ??= caches
    .open(CACHE)
    .then((c) => guardar(c, PRECACHE))
    .then((fallidas) => { if (fallidas.length) completando = null; })
    .catch(() => { completando = null; }));

const limpiar = (url) => {
  const u = new URL(url);
  u.hash = '';
  u.search = '';
  if (u.pathname.endsWith('.html')) u.pathname = u.pathname.slice(0, -5);
  if (u.pathname.endsWith('/index')) u.pathname = u.pathname.slice(0, -5);
  if (u.pathname === INICIO.slice(0, -1)) u.pathname = INICIO;
  return u.toString();
};
const esHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');
const sinConexion = () =>
  new Response(SIN_CONEXION, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo lo de la app: Supabase, otras páginas del mismo dominio y lo que no sea GET pasan directo.
  if (req.method !== 'GET' || url.origin !== self.location.origin || !(url.pathname + '/').startsWith(INICIO)) return;
  // Los videos van siempre a la red (pedidos por partes): no se guardan para usar sin internet.
  if (/\\.(mp4|webm)$/.test(url.pathname)) return;

  // Páginas: primero la red, para ver lo último. Si no contesta en 4 segundos o no hay conexión, lo guardado.
  if (req.mode === 'navigate') {
    const clave = limpiar(req.url);
    // 'no-cache': siempre se confirma con el servidor (GitHub Pages deja las páginas 10 minutos en el caché del navegador).
    const red = fetch(req, { cache: 'no-cache' });
    e.waitUntil(
      red
        .then((res) => {
          // Solo se guardan páginas: si se abre el PDF u otro archivo directo, no.
          if (res.ok && !res.redirected && esHtml(res)) {
            const copia = res.clone();
            return caches.open(CACHE).then((c) => c.put(clave, copia));
          }
        })
        .catch(() => {}),
    );
    e.respondWith((async () => {
      const guardado = await caches.match(clave);
      if (!guardado) return red.catch(sinConexion);
      const res = await Promise.race([red.catch(() => null), esperar(TOPE_RED)]);
      // Si el servidor falla (5xx), mejor lo guardado. Un 404 sí se muestra: la página ya no existe.
      return res && res.status < 500 ? res : guardado;
    })());
    e.waitUntil(completar());
    return;
  }

  // Lo demás (estilos, scripts, fuentes, imágenes, datos): lo guardado primero.
  e.respondWith((async () => {
    const clave = limpiar(req.url);
    const guardado = await caches.match(clave);
    // Los archivos de _astro llevan un hash en el nombre: si cambian, cambia el nombre. No hace falta revisarlos.
    if (guardado && url.pathname.includes('/_astro/')) return guardado;
    // El resto (buscar.json, fichas.json, íconos) se actualiza de fondo para la próxima vez.
    const red = fetch(req, guardado ? { cache: 'no-cache' } : undefined).then((res) => {
      if (res.ok && res.type === 'basic' && !url.pathname.endsWith('.pdf')) {
        const copia = res.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(clave, copia)));
      }
      return res;
    });
    if (!guardado) return red;
    e.waitUntil(red.catch(() => {}));
    return guardado;
  })());
});
`;

// Aviso que da el service worker cuando, sin conexión, se abre una página que no está guardada en el celular.
const sinConexion = (inicio, fuente) => `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>Sin conexión | Lola · Equipo</title>
<link rel="icon" type="image/png" href="${inicio}favicon.png">
<style>
${fuente ? `@font-face{font-family:"Manrope Variable";font-weight:200 800;font-display:swap;src:url(${fuente}) format("woff2")}` : ''}
body{margin:0;min-height:100svh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:#fbf8f2;color:#25392f;font-family:"Manrope Variable",ui-sans-serif,system-ui,sans-serif}
main{width:100%;max-width:420px;box-sizing:border-box;background:#fff;border-radius:32px;padding:28px;text-align:center;box-shadow:0 30px 80px -40px rgb(33 76 59/.55)}
.marca{margin:0;font-size:.875rem;font-weight:600;color:#37705e}
h1{margin:4px 0 0;font-size:1.625rem;line-height:1.2;color:#214c3b}
p{line-height:1.5;color:#52655b}
a,button{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:12px;border-radius:999px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;box-sizing:border-box}
a{background:#214c3b;color:#fff;border:0}
button{background:#fff;color:#214c3b;border:1px solid rgb(33 76 59/.15)}
</style></head>
<body><main>
<p class="marca">La Almacén de Lola</p>
<h1>Esta página no está guardada en tu celular</h1>
<p>Sin conexión no la podemos abrir. Cuando vuelva la señal, probá de nuevo.</p>
<a href="${inicio}">Volver al inicio</a>
<button type="button" onclick="location.reload()">Probar de nuevo</button>
</main></body></html>`;

export default function serviceWorker() {
  return {
    name: 'lola-service-worker',
    hooks: {
      'astro:config:done': ({ config }) => {
        BASE = config.base.replace(/\/$/, '');
      },
      'astro:build:done': async ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const archivos = (await listar(raiz)).filter((f) => !EXCLUIR.test(path.posix.basename(f)));
        const refs = await referencias(raiz, archivos);

        // Lo que usan las páginas de todos los días se guarda de entrada; lo que solo usan las páginas a demanda, no.
        const comunes = archivos.filter((f) => f.endsWith('.html') && !A_DEMANDA.includes(f));
        const necesario = cierre(comunes, refs);
        const aDemanda = {};
        const soloADemanda = new Set();
        for (const pagina of A_DEMANDA.filter((p) => archivos.includes(p))) {
          const propios = [...cierre([pagina], refs)].filter((f) => !necesario.has(f) && !OTRO_ALFABETO.test(f));
          propios.forEach((f) => soloADemanda.add(f));
          aDemanda[aUrl(pagina)] = propios.map(aUrl);
        }
        const precache = archivos.filter((f) => !soloADemanda.has(f) && !OTRO_ALFABETO.test(f));

        // La versión sale del contenido (no de la fecha de los archivos): un build sin cambios no obliga a
        // todas a volver a bajar la app. También cambia si cambia el código del service worker.
        const hash = createHash('sha256');
        let bytes = 0;
        for (const f of [...precache, ...soloADemanda]) {
          const contenido = await readFile(path.join(raiz, f));
          if (precache.includes(f)) bytes += contenido.length;
          hash.update(f);
          hash.update(contenido);
        }
        // El aviso sin conexión usa la fuente que ya está guardada (si hay una).
        const fuente = precache.find((f) => f.endsWith('.woff2'));
        const datos = {
          version: '',
          inicio: `${BASE}/`,
          precache: precache.map(aUrl),
          aDemanda,
          sinConexion: sinConexion(`${BASE}/`, fuente && aUrl(fuente)),
        };
        hash.update(codigo(datos));
        datos.version = hash.digest('hex').slice(0, 12);

        await writeFile(path.join(raiz, 'sw.js'), codigo(datos), 'utf8');
        const demanda = Object.keys(aDemanda).map((u) => u.slice(BASE.length + 1)).join(', ');
        logger.info(
          `sw.js: ${precache.length} archivos para usar sin conexión (${Math.round(bytes / 1024)} KB), versión ${datos.version}. ` +
            `Se guardan al abrirlas: ${demanda} (${soloADemanda.size} archivos).`,
        );
      },
    },
  };
}

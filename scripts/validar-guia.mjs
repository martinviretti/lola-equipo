// Valida la guía de productos (src/content/guia/*.mdx) y los carteles (src/data/carteles.json)
// contra las reglas de GUIA-PRODUCTOS.md. Uso: node scripts/validar-guia.mjs
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const palabras = (s) => s.split(/\s+/).filter(Boolean).length;
// Lo que el dueño pidió dejar afuera: normativa y organismos.
const PROHIBIDO = /\b(art\.|artículo|ley \d|ley n|resoluci[oó]n|decreto|disposici[oó]n|CAA|ANMAT|SENASA|C[oó]digo Alimentario|RNPA|RNE)\b/i;
const SALUD = /\b(cura|curan|desinflama|adelgaza|baja el azúcar|desintoxica)\b/i;
let errores = 0;
const mal = (archivo, msgs) => {
  if (!msgs.length) return false;
  errores++;
  console.log(`✗ ${archivo}\n  - ${msgs.join('\n  - ')}`);
  return true;
};

// ---------- Guía ----------
const dir = path.resolve('src/content/guia');
const archivos = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.mdx')).sort() : [];
for (const f of archivos) {
  const texto = await readFile(path.join(dir, f), 'utf8');
  const fm = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const p = [];
  if (!fm) p.push('falta el frontmatter');
  else for (const c of ['numero:', 'titulo:', 'bajada:', 'icono:', 'claves:']) if (!fm[1].includes(c)) p.push(`falta ${c}`);
  const cuerpo = fm ? texto.slice(fm[0].length) : texto;
  const total = palabras(cuerpo) + (fm ? palabras(fm[1]) : 0);
  if (total > 1950) p.push(`demasiado largo: ${total} palabras (máximo orientativo 1.800)`);
  if (/^#{1}\s|^####/m.test(cuerpo)) p.push('usa # o ####');
  cuerpo.split(/\r?\n/).forEach((l, i) => {
    const n = i + 1;
    if (/[{}<>]/.test(l)) p.push(`línea ${n}: tiene < > { }`);
    if (PROHIBIDO.test(l)) p.push(`línea ${n}: menciona normativa u organismos: "${l.trim().slice(0, 70)}"`);
    if (SALUD.test(l) && !/nunca|no digas|no prometas|no es que/i.test(l)) p.push(`línea ${n}: posible promesa de salud: "${l.trim().slice(0, 70)}"`);
    const vineta = l.match(/^\s*-\s+\*\*[^*]+\*\*\s*(.*)$/);
    if (vineta && palabras(vineta[1]) > 30) p.push(`línea ${n}: viñeta de ${palabras(vineta[1])} palabras (máximo 25)`);
  });
  if (!mal(f, p)) console.log(`✓ ${f} (${total} palabras)`);
}

// ---------- Carteles ----------
const rutaCarteles = path.resolve('src/data/carteles.json');
if (existsSync(rutaCarteles)) {
  let carteles = [];
  try {
    carteles = JSON.parse(await readFile(rutaCarteles, 'utf8'));
  } catch (e) {
    mal('carteles.json', [`JSON inválido: ${e.message}`]);
  }
  for (const c of carteles) {
    const p = [];
    for (const k of ['slug', 'sector', 'titulo', 'icono', 'intro', 'datos', 'sabias']) if (!c[k]) p.push(`falta ${k}`);
    if (c.datos && (c.datos.length < 4 || c.datos.length > 6)) p.push(`datos: ${c.datos.length} (entre 4 y 6)`);
    (c.datos ?? []).forEach((d, i) => {
      if (palabras(d.texto ?? '') > 28) p.push(`dato ${i + 1}: ${palabras(d.texto)} palabras (máximo 25)`);
    });
    const todo = JSON.stringify(c);
    const total = palabras([c.titulo, c.intro, c.sabias, ...(c.datos ?? []).flatMap((d) => [d.titulo, d.texto]), ...(c.guia ?? []).flatMap((g) => [g.nombre, g.texto])].join(' '));
    if (total > 280) p.push(`demasiado largo para una hoja: ${total} palabras (máximo 260)`);
    if (PROHIBIDO.test(todo)) p.push('menciona normativa u organismos');
    if (SALUD.test(todo)) p.push('posible promesa de salud');
    if (!mal(`cartel ${c.slug}`, p)) console.log(`✓ cartel ${c.slug} (${total} palabras)`);
  }
}

process.exit(errores ? 1 : 0);

// Valida la guía de productos (src/content/guia/*.mdx) y los carteles (src/data/carteles.json)
// contra las reglas de GUIA-PRODUCTOS.md. Uso: node scripts/validar-guia.mjs
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const palabras = (s) => s.split(/\s+/).filter(Boolean).length;
// Lo que el dueño pidió dejar afuera: normativa y organismos.
const PROHIBIDO = /\b(art\.|artículo|ley \d|ley n|resoluci[oó]n|decreto|disposici[oó]n|CAA|ANMAT|SENASA|C[oó]digo Alimentario|RNPA|RNE)\b/i;
const SALUD = /\b(cura|curan|desinflama|adelgaza|baja el azúcar|desintoxica|quema grasas?)\b/i;
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
  if (total > 6400) p.push(`demasiado largo: ${total} palabras (máximo orientativo 6.000)`);
  if (!/^## Lo básico\s*$/m.test(cuerpo)) p.push('falta la sección "## Lo básico"');
  // "De un vistazo": la última columna es "Propiedades", corta (8 palabras como máximo).
  const vistazo = cuerpo.split(/^## /m).find((s) => s.startsWith('De un vistazo'));
  const filasTabla = (vistazo ?? '').split(/\r?\n/).filter((l) => /^\|/.test(l));
  if (!filasTabla.length) p.push('falta la tabla de "## De un vistazo"');
  else {
    const celdas = (l) => l.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
    const cabeza = celdas(filasTabla[0]);
    if (cabeza.at(-1) !== 'Propiedades') p.push('la tabla de "De un vistazo" tiene que terminar en la columna "Propiedades"');
    for (const l of filasTabla.slice(2)) {
      const c = celdas(l);
      if (c.length !== cabeza.length) p.push(`tabla: la fila "${c[0]}" tiene ${c.length} celdas y la cabecera ${cabeza.length}`);
      else if (palabras(c.at(-1)) > 9) p.push(`tabla: Propiedades de "${c[0]}" tiene ${palabras(c.at(-1))} palabras (máximo 8)`);
      else if (!c.at(-1)) p.push(`tabla: falta Propiedades en "${c[0]}"`);
    }
  }
  // Fichas: cada "### " dentro de "## Los productos". Se leen como texto corrido:
  // de 1 a 3 párrafos sin etiquetas y, como máximo, las viñetas "Tip" y "Ojo".
  const productos = cuerpo.split(/^## /m).find((s) => s.startsWith('Los productos'));
  for (const ficha of (productos ?? '').split(/^### /m).slice(1)) {
    const [titulo, ...resto] = ficha.split(/\r?\n/);
    const lineas = resto.map((l) => l.trim()).filter(Boolean);
    const vinetas = lineas.filter((l) => l.startsWith('- '));
    const parrafos = lineas.filter((l) => !l.startsWith('- '));
    const largo = palabras(resto.join(' '));
    if (parrafos.length < 1 || parrafos.length > 3) p.push(`ficha "${titulo}": ${parrafos.length} párrafos (de 1 a 3)`);
    if (parrafos.some((l) => /^\*\*[^*]+:\*\*/.test(l))) p.push(`ficha "${titulo}": un párrafo arranca con etiqueta en negrita`);
    if (vinetas.length > 3) p.push(`ficha "${titulo}": ${vinetas.length} viñetas (máximo 3: Propiedades, Tip y Ojo)`);
    for (const v of vinetas) if (!/^-\s+\*\*(Propiedades|Tip|Ojo):\*\*/.test(v)) p.push(`ficha "${titulo}": viñeta que no es Propiedades, Tip ni Ojo: "${v.slice(0, 40)}"`);
    if (!/^-\s+\*\*Propiedades:\*\*/.test(vinetas[0] ?? '')) p.push(`ficha "${titulo}": falta "Propiedades" como primera viñeta`);
    const prop = vinetas.find((v) => v.includes('**Propiedades:**'));
    if (prop && palabras(prop) > 56) p.push(`ficha "${titulo}": Propiedades de ${palabras(prop)} palabras (máximo 50)`);
    if (largo < 75 || largo > 235) p.push(`ficha "${titulo}": ${largo} palabras (de 80 a 220)`);
  }
  if (/^#{1}\s|^####/m.test(cuerpo)) p.push('usa # o ####');
  cuerpo.split(/\r?\n/).forEach((l, i) => {
    const n = i + 1;
    if (/[{}<>]/.test(l)) p.push(`línea ${n}: tiene < > { }`);
    if (PROHIBIDO.test(l)) p.push(`línea ${n}: menciona normativa u organismos: "${l.trim().slice(0, 70)}"`);
    if (SALUD.test(l) && !/nunca|no digas|no prometas|no es que/i.test(l)) p.push(`línea ${n}: posible promesa de salud: "${l.trim().slice(0, 70)}"`);
    const vineta = l.match(/^\s*-\s+\*\*[^*]+\*\*\s*(.*)$/);
    if (vineta && palabras(vineta[1]) > 55) p.push(`línea ${n}: viñeta de ${palabras(vineta[1])} palabras (máximo 50)`);
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

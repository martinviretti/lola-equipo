// Valida el banco del examen (src/data/examen/*.json) contra EXAMEN-BANCO.md.
// Uso: node scripts/validar-examen.mjs [id-del-tema ...]   (sin argumentos, valida todos)
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const TEMAS = {
  conceptos: 'La dietética y los conceptos básicos',
  'sin-tacc': 'Celiaquía y sin TACC',
  alergias: 'Alergias e intolerancias',
  yerbas: 'Yerbas y mate',
  'tes-cafes': 'Tés y cafés',
  yuyos: 'Yuyos y hierbas',
  bebidas: 'Bebidas',
  'frutos-secos': 'Frutos secos',
  semillas: 'Semillas',
  desecadas: 'Frutas desecadas',
  'galletitas-chocolates': 'Galletitas, snacks y chocolates',
  harinas: 'Harinas',
  cereales: 'Cereales y arroces',
  legumbres: 'Legumbres',
  'panes-pastas': 'Panes y pastas',
  leches: 'Leches vegetales',
  yogures: 'Yogures, quesos y heladera',
  endulzantes: 'Endulzantes',
  aceites: 'Aceites y untables',
  especias: 'Especias, condimentos y conservas',
  veganos: 'Vegano y vegetariano',
  congelados: 'Congelados y cadena de frío',
  suplementos: 'Suplementos',
  cosmetica: 'Cosmética natural',
};
const NUCLEO = ['conceptos', 'sin-tacc', 'alergias'];
const SALUD = /\b(cura|curan|adelgaza|desinflama|desintoxica|quema grasas?)\b/i;
const palabras = (s) => s.split(/\s+/).filter(Boolean).length;

const dir = path.resolve('src/data/examen');
const pedidos = process.argv.slice(2);
const ids = new Set();
const gondolas = new Set((await readdir('src/content/guia')).map((f) => f.replace(/\.mdx$/, '')));
let errores = 0;
let total = 0;

for (const id of pedidos.length ? pedidos : Object.keys(TEMAS)) {
  const archivo = path.join(dir, `${id}.json`);
  const p = [];
  if (!TEMAS[id]) p.push(`tema desconocido: ${id}`);
  if (!existsSync(archivo)) {
    console.log(`· ${id}.json todavía no existe`);
    continue;
  }
  let lista = [];
  try {
    lista = JSON.parse(await readFile(archivo, 'utf8'));
  } catch (e) {
    console.log(`✗ ${id}.json: JSON inválido: ${e.message}`);
    errores++;
    continue;
  }
  const porNivel = { 1: 0, 2: 0, 3: 0 };
  let unir = 0;
  for (const q of lista) {
    const n = q.id ?? '(sin id)';
    if (ids.has(q.id)) p.push(`${n}: id repetido`);
    ids.add(q.id);
    if (q.tema !== TEMAS[id]) p.push(`${n}: tema "${q.tema}" (tiene que ser "${TEMAS[id]}")`);
    if (![1, 2, 3].includes(q.nivel)) p.push(`${n}: nivel inválido`);
    else porNivel[q.nivel]++;
    if (!['opcion', 'situacion', 'vf', 'unir'].includes(q.tipo)) p.push(`${n}: tipo inválido`);
    if (!q.pregunta || !q.explicacion) p.push(`${n}: falta pregunta o explicacion`);
    if (q.gondola && !gondolas.has(q.gondola)) p.push(`${n}: góndola inexistente "${q.gondola}"`);
    if (q.tipo === 'opcion' || q.tipo === 'situacion') {
      if (!Array.isArray(q.opciones) || q.opciones.length < 3 || q.opciones.length > 4) p.push(`${n}: necesita 3 o 4 opciones`);
      else if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) p.push(`${n}: correcta fuera de rango`);
      else if (new Set(q.opciones).size !== q.opciones.length) p.push(`${n}: opciones repetidas`);
    }
    if (q.tipo === 'vf' && typeof q.correcta !== 'boolean') p.push(`${n}: en vf, correcta va true o false`);
    if (q.tipo === 'unir') {
      unir++;
      if (!Array.isArray(q.pares) || q.pares.length !== 4) p.push(`${n}: unir necesita 4 pares`);
      else {
        if (new Set(q.pares.map((x) => x.b)).size !== 4 || new Set(q.pares.map((x) => x.a)).size !== 4) p.push(`${n}: pares repetidos`);
        for (const x of q.pares) if (palabras(x.b ?? '') > 9) p.push(`${n}: "${x.b}" tiene más de 8 palabras`);
      }
      if (q.critica) p.push(`${n}: unir no puede ser crítica`);
    }
    const todo = JSON.stringify(q);
    if (/—|–/.test(todo)) p.push(`${n}: tiene guiones largos`);
    if (SALUD.test(q.explicacion) && !/no |nunca/i.test(q.explicacion)) p.push(`${n}: posible promesa de salud en la explicación`);
  }
  const meta = NUCLEO.includes(id) ? { 1: 8, 2: 5, 3: 4 } : { 1: 6, 2: 4, 3: 3 };
  for (const nv of [1, 2, 3]) if (porNivel[nv] < meta[nv]) p.push(`nivel ${nv}: ${porNivel[nv]} preguntas (mínimo ${meta[nv]})`);
  if (!unir) p.push('falta al menos un "unir"');
  total += lista.length;
  if (p.length) {
    errores++;
    console.log(`✗ ${id}.json\n  - ${p.join('\n  - ')}`);
  } else console.log(`✓ ${id}.json: ${lista.length} preguntas (${porNivel[1]}/${porNivel[2]}/${porNivel[3]}), ${lista.filter((q) => q.critica).length} clave`);
}
console.log(`Total: ${total} preguntas`);
process.exit(errores ? 1 : 0);

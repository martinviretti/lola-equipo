// Valida el banco del examen (src/data/examen/*.json) contra EXAMEN-BANCO.md.
// Uso: node scripts/validar-examen.mjs [id-del-tema ...]
//   Sin argumentos valida todo el banco, y los chequeos generales (todo el banco, preguntas
//   clave por nivel, formatos por nivel) cortan con error.
//   Con temas, valida esos archivos y los duplicados que los tocan; los chequeos generales
//   se informan igual, pero no cortan.
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
const SALUD = /\b(cura|curan|adelgaza|desinflama|desintoxica|depurativ[oa]s?|diur[eé]tic[oa]s?|quema grasas?)\b/i;
const USTEDES = /\b(leen|lean|miren|comparen|comparan|revisen|f[ií]jense)\b/i;

// Largo parejo y sin pistas (EXAMEN-BANCO.md). Solo en opción y situación.
const MAX_LARGA_BANCO = 0.3; // la correcta es la única opción más larga: en todo el banco
const MAX_LARGA_GRUPO = 0.4; // ... y en cada archivo y nivel
const MAX_PROPORCION = 1.4; // largo de la correcta / promedio de largo de las otras
const MIN_EXTREMO = 0.15; // si la correcta casi nunca es la más larga (o la más corta), también es pista (aviso)
// Duplicados: parecido entre dos preguntas (0 a 1), con tildes y palabras vacías afuera.
const CASI_IGUAL = 0.5; // desde acá es error
const PARECIDA = 0.4; // desde acá se avisa para revisar
// Preguntas clave (critica: true), en vf, opción o situación.
const MIN_CLAVES = 8; // por nivel, contando solo las de ese nivel
const MAX_CLAVES = 0.25; // si se marca más de esto del nivel, la marca deja de filtrar (aviso)

const palabras = (s) => s.split(/\s+/).filter(Boolean).length;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
const conOpciones = (q) => (q.tipo === 'opcion' || q.tipo === 'situacion') && Array.isArray(q.opciones) && Number.isInteger(q.correcta) && q.opciones[q.correcta] !== undefined;

/** Largo de la correcta frente a las otras opciones. */
function largos(q) {
  const lens = q.opciones.map((o) => o.length);
  const c = lens[q.correcta];
  const otras = lens.filter((_, i) => i !== q.correcta);
  const promedio = otras.reduce((a, b) => a + b, 0) / otras.length;
  return { c, promedio, masLarga: c > Math.max(...otras), masCorta: c < Math.min(...otras), proporcion: c / promedio };
}

// Para comparar enunciados: minúsculas, sin tildes, sin palabras vacías ni las del molde
// de las situaciones ("una clienta te dice ... ¿qué le respondés?"), y sin plural ni género.
const VACIAS = new Set(
  `a al algo ante antes asi aunque cada como con contra cual cuales cuando cuanto cuanta de del desde donde dos e el ella
  ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos estan fue ha hay hace la las le les lo los
  mas me mi mis muy mucho mucha muchos muchas nada ni no nos o otra otras otro otros para pero poco por porque que se sea
  ser si sin sobre solo son su sus tambien te tiene tienen tu tus u un una unas uno unos y ya yo vos tenes queres podes
  puedo puede pueden cliente clienta dice dicen pregunta preguntas respondes ofreces haces hacer decis quiero llevo mama
  papa uni siempre nunca todo toda todos todas igual bien`.split(/\s+/),
);
const raices = (s) =>
  new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !VACIAS.has(w))
      .map((w) => w.replace(/s$/, '').replace(/(?<=.{3})[aoe]$/, '')),
  );
const enunciado = (q) =>
  q.tipo === 'unir' && Array.isArray(q.pares)
    ? q.pares.map((p) => `${p.a} ${p.b}`).join(' ')
    : conOpciones(q)
      ? `${q.pregunta} ${q.opciones[q.correcta]}`
      : `${q.pregunta ?? ''}`;
function parecido(a, b) {
  const comunes = [...a].filter((w) => b.has(w)).length;
  return comunes / (a.size + b.size - comunes || 1);
}

// Formatos que pide el sorteo de cada nivel (src/data/niveles.ts, campo "mezcla").
let mezclas = [];
if (existsSync('src/data/niveles.ts')) {
  const ts = await readFile('src/data/niveles.ts', 'utf8');
  mezclas = [...ts.matchAll(/mezcla:\s*\{([^}]*)\}/g)].map((m) => Object.fromEntries([...m[1].matchAll(/(\w+):\s*(\d+)/g)].map((x) => [x[1], Number(x[2])])));
}

const dir = path.resolve('src/data/examen');
const pedidos = process.argv.slice(2);
const revisar = new Set(pedidos.length ? pedidos : Object.keys(TEMAS));
const gondolas = new Set((await readdir('src/content/guia')).map((f) => f.replace(/\.mdx$/, '')));
const ids = new Set();
const banco = []; // todas las preguntas que se pudieron leer, con su archivo
let errores = 0;
let total = 0;

for (const id of pedidos) if (!TEMAS[id]) {
  console.log(`✗ tema desconocido: ${id}`);
  errores++;
}

for (const id of Object.keys(TEMAS)) {
  const archivo = path.join(dir, `${id}.json`);
  const mirar = revisar.has(id);
  if (!existsSync(archivo)) {
    if (mirar) console.log(`· ${id}.json todavía no existe`);
    continue;
  }
  let lista = [];
  try {
    lista = JSON.parse(await readFile(archivo, 'utf8'));
  } catch (e) {
    if (mirar) {
      console.log(`✗ ${id}.json: JSON inválido: ${e.message}`);
      errores++;
    }
    continue;
  }
  for (const q of lista) banco.push({ q, archivo: id });
  if (!mirar) continue;

  const p = [];
  const porNivel = { 1: 0, 2: 0, 3: 0 };
  const larga = { 1: [], 2: [], 3: [] }; // ids donde la correcta es la única más larga
  const conOpc = { 1: 0, 2: 0, 3: 0 };
  let unir = 0;
  for (const q of lista) {
    const n = q.id ?? '(sin id)';
    if (ids.has(q.id)) p.push(`${n}: id repetido`);
    ids.add(q.id);
    if (q.tema !== TEMAS[id]) p.push(`${n}: tema "${q.tema}" (tiene que ser "${TEMAS[id]}")`);
    if (![1, 2, 3].includes(q.nivel)) p.push(`${n}: nivel inválido`);
    else porNivel[q.nivel]++;
    if (q.id && !new RegExp(`^${id}-${q.nivel}-\\d{2}$`).test(q.id)) p.push(`${n}: el id tiene que ser ${id}-${q.nivel}-NN`);
    if (!['opcion', 'situacion', 'vf', 'unir'].includes(q.tipo)) p.push(`${n}: tipo inválido`);
    if (!q.pregunta || !q.explicacion) p.push(`${n}: falta pregunta o explicacion`);
    if (q.gondola && !gondolas.has(q.gondola)) p.push(`${n}: góndola inexistente "${q.gondola}"`);
    if ('critica' in q && q.critica !== true) p.push(`${n}: "critica" va solo como true (si no es clave, sacá el campo)`);
    if (q.tipo === 'opcion' || q.tipo === 'situacion') {
      if (!Array.isArray(q.opciones) || q.opciones.length < 3 || q.opciones.length > 4) p.push(`${n}: necesita 3 o 4 opciones`);
      else if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) p.push(`${n}: correcta fuera de rango`);
      else if (new Set(q.opciones).size !== q.opciones.length) p.push(`${n}: opciones repetidas`);
      else if ([1, 2, 3].includes(q.nivel)) {
        const l = largos(q);
        conOpc[q.nivel]++;
        if (l.masLarga) larga[q.nivel].push(q.id);
        if (l.proporcion > MAX_PROPORCION)
          p.push(`${n}: la correcta mide ${l.c} caracteres y las otras ${Math.round(l.promedio)} en promedio (más de ${MAX_PROPORCION} veces): emparejá el largo`);
      }
    }
    if (q.tipo === 'vf' && typeof q.correcta !== 'boolean') p.push(`${n}: en vf, correcta va true o false`);
    if (q.tipo === 'unir') {
      unir++;
      if (!Array.isArray(q.pares) || q.pares.length !== 4) p.push(`${n}: unir necesita 4 pares`);
      else {
        if (new Set(q.pares.map((x) => x.b)).size !== 4 || new Set(q.pares.map((x) => x.a)).size !== 4) p.push(`${n}: pares repetidos`);
        for (const x of q.pares) if (palabras(x.b ?? '') > 8) p.push(`${n}: "${x.b}" tiene más de 8 palabras`);
      }
      if (q.critica) p.push(`${n}: unir no puede ser clave`);
    }
    const todo = JSON.stringify(q);
    if (/—|–/.test(todo)) p.push(`${n}: tiene guiones largos`);
    const usted = todo.match(USTEDES);
    if (usted) p.push(`${n}: "${usted[0]}" es de ustedes: en voseo va "leés con él", "mirás con ella", "leamos juntas"`);
    const afirma = [q.explicacion ?? '', conOpciones(q) ? q.opciones[q.correcta] : '', q.tipo === 'vf' && q.correcta === true ? q.pregunta : ''];
    for (const t of afirma) if (SALUD.test(t) && !/\bno\b|nunca|ning[uú]n/i.test(t)) p.push(`${n}: posible promesa de salud: "${t.match(SALUD)[0]}"`);
  }
  const meta = NUCLEO.includes(id) ? { 1: 8, 2: 5, 3: 4 } : { 1: 6, 2: 4, 3: 3 };
  for (const nv of [1, 2, 3]) if (porNivel[nv] < meta[nv]) p.push(`nivel ${nv}: ${porNivel[nv]} preguntas (mínimo ${meta[nv]})`);
  for (const nv of [1, 2, 3]) {
    const permitidas = Math.floor(MAX_LARGA_GRUPO * conOpc[nv] + 1e-9);
    if (larga[nv].length > permitidas)
      p.push(
        `nivel ${nv}: la correcta es la opción más larga en ${larga[nv].length} de ${conOpc[nv]} (${pct(larga[nv].length, conOpc[nv])}; máximo ${
          MAX_LARGA_GRUPO * 100
        }%, o sea ${permitidas}): ${larga[nv].join(', ')}`,
      );
  }
  if (!unir) p.push('falta al menos un "unir"');
  total += lista.length;
  const resumenLargo = [1, 2, 3].map((nv) => `N${nv} ${larga[nv].length}/${conOpc[nv]}`).join(' · ');
  if (p.length) {
    errores++;
    console.log(`✗ ${id}.json\n  - ${p.join('\n  - ')}`);
  } else
    console.log(
      `✓ ${id}.json: ${lista.length} preguntas (${porNivel[1]}/${porNivel[2]}/${porNivel[3]}), ${lista.filter((q) => q.critica).length} clave · correcta más larga: ${resumenLargo}`,
    );
}
console.log(`Total: ${total} preguntas${pedidos.length ? ` (de ${banco.length} en el banco)` : ''}`);

// ---------- Chequeos de todo el banco ----------
const general = []; // errores de todo el banco: cortan solo si se valida el banco entero
const avisos = [];

// (a) La correcta no puede ser casi siempre la más larga.
console.log('\nLa correcta es la opción más larga (opción y situación; al azar sería 25%):');
const deNivel = (nv) => banco.filter(({ q }) => q.nivel === nv && conOpciones(q));
let largasTot = 0;
let cortasTot = 0;
let opcTot = 0;
for (const nv of [1, 2, 3]) {
  const l = deNivel(nv).map(({ q }) => largos(q));
  const lar = l.filter((x) => x.masLarga).length;
  const cor = l.filter((x) => x.masCorta).length;
  largasTot += lar;
  cortasTot += cor;
  opcTot += l.length;
  console.log(`  Nivel ${nv}: más larga ${lar} de ${l.length} (${pct(lar, l.length)}) · más corta ${cor} (${pct(cor, l.length)})`);
}
console.log(`  Todo el banco: más larga ${largasTot} de ${opcTot} (${pct(largasTot, opcTot)}, máximo ${MAX_LARGA_BANCO * 100}%) · más corta ${cortasTot} (${pct(cortasTot, opcTot)})`);
if (opcTot && largasTot / opcTot > MAX_LARGA_BANCO)
  general.push(`la correcta es la más larga en ${pct(largasTot, opcTot)} del banco (máximo ${MAX_LARGA_BANCO * 100}%)`);
for (const [que, n] of [['larga', largasTot], ['corta', cortasTot]])
  if (opcTot && n / opcTot < MIN_EXTREMO)
    avisos.push(`la correcta casi nunca es la más ${que} (${pct(n, opcTot)}): eso también es pista. Lo ideal ronda el 20 o 25%`);

// (d) Preguntas clave suficientes para el sorteo (3 por examen, de su nivel y los anteriores).
console.log(`\nPreguntas clave (vf, opción o situación; mínimo ${MIN_CLAVES} por nivel):`);
let acumuladas = 0;
for (const nv of [1, 2, 3]) {
  const elegibles = banco.filter(({ q }) => q.nivel === nv && ['vf', 'opcion', 'situacion'].includes(q.tipo));
  const claves = elegibles.filter(({ q }) => q.critica === true).length;
  acumuladas += claves;
  console.log(`  Nivel ${nv}: ${claves} de ${elegibles.length} (${pct(claves, elegibles.length)}) · para su sorteo, con los niveles anteriores: ${acumuladas}`);
  if (claves < MIN_CLAVES) general.push(`nivel ${nv}: ${claves} preguntas clave (mínimo ${MIN_CLAVES})`);
  if (elegibles.length && claves / elegibles.length > MAX_CLAVES)
    avisos.push(`nivel ${nv}: ${pct(claves, elegibles.length)} de las preguntas son clave; con más de ${MAX_CLAVES * 100}% la marca deja de filtrar lo grave`);
}

// Formatos: el banco de cada nivel tiene que alcanzar para la mezcla del sorteo.
if (mezclas.length) {
  console.log('\nFormatos por nivel (en el banco / por examen, según src/data/niveles.ts):');
  for (const nv of [1, 2, 3]) {
    const m = mezclas[nv - 1];
    if (!m) continue;
    const partes = Object.entries(m).map(([tipo, cupo]) => {
      const hay = banco.filter(({ q }) => q.nivel === nv && q.tipo === tipo).length;
      if (hay < cupo) general.push(`nivel ${nv}: hay ${hay} "${tipo}" y cada examen pide ${cupo}`);
      return `${tipo} ${hay}/${cupo}${hay < cupo ? ' ✗' : ''}`;
    });
    console.log(`  Nivel ${nv}: ${partes.join(' · ')}`);
  }
}

// (c) Duplicados entre temas y niveles.
const conRaices = banco.filter(({ q }) => q.id).map((x) => ({ ...x, r: raices(enunciado(x.q)) }));
const iguales = [];
const parecidas = [];
for (let i = 0; i < conRaices.length; i++)
  for (let j = i + 1; j < conRaices.length; j++) {
    const a = conRaices[i];
    const b = conRaices[j];
    if (!revisar.has(a.archivo) && !revisar.has(b.archivo)) continue;
    const s = parecido(a.r, b.r);
    const linea = `${a.q.id} (N${a.q.nivel}) y ${b.q.id} (N${b.q.nivel}): ${s.toFixed(2)}`;
    if (s >= CASI_IGUAL) iguales.push(linea);
    else if (s >= PARECIDA) parecidas.push(linea);
  }
console.log(`\nDuplicados (parecido de enunciado y respuesta, de 0 a 1; error desde ${CASI_IGUAL}):`);
if (!iguales.length) console.log('  Ninguno.');
for (const l of iguales) console.log(`  ✗ ${l}`);
if (iguales.length) {
  errores++;
  console.log('  Dejá una sola o reescribí una para que pregunte otra cosa.');
}
if (parecidas.length) avisos.push(`preguntas parecidas (desde ${PARECIDA}), revisá que no pregunten lo mismo:\n    ${parecidas.join('\n    ')}`);

if (avisos.length) console.log(`\nAvisos (no cortan):\n  - ${avisos.join('\n  - ')}`);
if (general.length) {
  console.log(`\n${pedidos.length ? 'Todo el banco (informativo, porque validaste solo algunos temas)' : '✗ Todo el banco'}:\n  - ${general.join('\n  - ')}`);
  if (!pedidos.length) errores++;
}
console.log(errores ? '\n✗ Hay problemas para corregir.' : '\n✓ Todo en orden.');
process.exit(errores ? 1 : 0);

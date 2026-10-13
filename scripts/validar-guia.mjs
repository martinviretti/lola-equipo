// Valida la guía de productos (src/content/guia/*.mdx) contra las reglas de GUIA-PRODUCTOS.md:
// estructura (claves, Lo básico, tabla, fichas, preguntas), largos, normativa, promesas de salud
// y la regla sin TACC del local (solo envasado con el logo).
// Uso: node scripts/validar-guia.mjs            (todas las góndolas)
//      node scripts/validar-guia.mjs 18 22      (solo las que empiezan con esos números)
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const palabras = (s) => s.split(/\s+/).filter(Boolean).length;
const oraciones = (s) => s.split(/(?<=[.!?])\s+/);

// Lo que el dueño pidió dejar afuera: normativa y organismos.
const PROHIBIDO = /\b(artículo|ley \d|ley n[°º.]|resoluci[oó]n|decreto|disposici[oó]n|CAA|ANMAT|SENASA|INAL|C[oó]digo Alimentario|RNPA|RNE)\b|\bart\.\s*\d/i;
// Otras cosas que no van: el bolsón (el local ya no lo hace) y el nombre del local con "El".
const NO_VA = [
  [/\bbols[oó]n(es)?\b/i, 'menciona el bolsón (el local ya no lo hace)'],
  [/\bEl Almac[eé]n de Lola\b/, 'el local es "La Almacén de Lola", con La'],
  [/\br[oó]tulos?\b/i, 'dice "rótulo": en el mostrador se dice "etiqueta" o "envase" (y para celíacos, "el logo sin TACC")'],
  [/\bchicos? chic(o|os)\b/i, 'dice "chicos chicos": decí a quién aplica (por ejemplo "bebés y chicos chiquitos, que lo hable con el pediatra")'],
];
// Promesas de salud y usos tradicionales atados a una dolencia. Se aceptan solo si la misma oración
// las frena ("nunca digas que...", "no prometas que...", "sin prometer...").
const SALUD = /\b(curan?|desinflam\w*|desintoxic\w*|adelgaz(a|an|ar|ante|antes)|quem(a|an|e|en|ar) (la )?grasas?|baja(n|r)? (el azúcar|el colesterol|la glucemia|la presión)|previene(n)?|diur[eé]tic\w*|depurativ\w*|para la garganta|resfr[ií]\w*|conciliar el sueño|se pierde casi toda|casi sin vitamina C)\b/i;
const FRENA = /\b(nunca|no (digas|le digas|prometas|prometás|promet\w*|es que|se dice|lo vendas|la vendas|lo ofrezcas|la ofrezcas|lo presentes|la presentes)|ni (digas|prometas)|sin prometer)\b/i;
// Frases válidas que contienen una palabra de la lista de arriba: se sacan antes de chequear.
const VALIDAS = [
  // "diuréticos" como medicamento, en un Ojo de precaución ("Quien toma litio, diuréticos o...").
  /\b(quien(es)? toma\w*|si toma\w*|medicaci[oó]n|medicamentos?)\b[^.]*?\bdiur[eé]ticos\b/gi,
];
const promesa = (linea) =>
  oraciones(VALIDAS.reduce((t, re) => t.replace(re, ''), linea)).find((o) => SALUD.test(o) && !FRENA.test(o));
// Sin TACC: decir que algo "no tiene gluten" exige aclarar, en la misma ficha o respuesta, lo del logo.
// No cuentan los usos generales ("la cocina sin gluten", "masas sin gluten") ni las negaciones
// ("integral no quiere decir sin gluten", "mucha gente cree que no tiene gluten, pero es trigo").
const SIN_GLUTEN = /\b(no (tiene|tienen|lleva|llevan|contiene|contienen) gluten|(es|son|naturalmente|de por sí|viene|vienen) sin gluten|libres? de gluten)\b|(^|[.:;]\s+|\*\*\s+)sin gluten\b(?!\s+no\b)/i;
const NO_ES_CLAIM = [/\b(cree|creen|piensa|piensan|parece)\b[^.]*?gluten/gi, /\bno (es|son)\s+sin gluten/gi, /\bquiere decir sin gluten/gi];
const diceSinGluten = (t) => SIN_GLUTEN.test(NO_ES_CLAIM.reduce((s, re) => s.replace(re, ''), t));
const LOGO = /\blogo\b/i;

let errores = 0;
const mal = (archivo, msgs) => {
  if (!msgs.length) return false;
  errores++;
  console.log(`✗ ${archivo}\n  - ${msgs.join('\n  - ')}`);
  return true;
};
const celdas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
// Devuelve las secciones "## " del cuerpo como { titulo, lineas: [{ n, texto }] }.
const secciones = (lineas) => {
  const out = [];
  for (const l of lineas) {
    const m = l.texto.match(/^## (.+?)\s*$/);
    if (m) out.push({ titulo: m[1], lineas: [] });
    else if (out.length) out.at(-1).lineas.push(l);
  }
  return out;
};

// ---------- Guía ----------
const filtro = process.argv.slice(2);
const dir = path.resolve('src/content/guia');
const archivos = (existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.mdx')).sort() : []).filter(
  (f) => !filtro.length || filtro.some((x) => f.startsWith(x.padStart(2, '0'))),
);
for (const f of archivos) {
  const texto = await readFile(path.join(dir, f), 'utf8');
  const todas = texto.split(/\r?\n/).map((t, i) => ({ n: i + 1, texto: t }));
  const p = [];

  // Frontmatter
  const cierre = todas[0]?.texto === '---' ? todas.findIndex((l, i) => i > 0 && l.texto === '---') : -1;
  const fmLineas = cierre > 0 ? todas.slice(1, cierre) : [];
  const fm = fmLineas.map((l) => l.texto).join('\n');
  const cuerpoLineas = cierre > 0 ? todas.slice(cierre + 1) : todas;
  const cuerpo = cuerpoLineas.map((l) => l.texto).join('\n');
  if (cierre < 0) p.push('falta el frontmatter');
  else {
    for (const c of ['numero:', 'titulo:', 'bajada:', 'icono:', 'claves:']) if (!new RegExp(`^${c}`, 'm').test(fm)) p.push(`falta ${c} en el frontmatter`);
    const numero = fm.match(/^numero:\s*(\d+)/m)?.[1];
    if (numero && Number(numero) !== parseInt(f, 10)) p.push(`numero: ${numero} no coincide con el archivo`);
    // claves: de 3 a 5, de 25 palabras como máximo cada una.
    const iClaves = fmLineas.findIndex((l) => /^claves:/.test(l.texto));
    const claves = [];
    for (const l of iClaves >= 0 ? fmLineas.slice(iClaves + 1) : []) {
      if (!/^\s/.test(l.texto)) break;
      const m = l.texto.match(/^\s+-\s+"(.*)"\s*$/);
      if (m) claves.push({ n: l.n, texto: m[1] });
    }
    if (iClaves >= 0 && (claves.length < 3 || claves.length > 5)) p.push(`claves: ${claves.length} (de 3 a 5)`);
    for (const c of claves) if (palabras(c.texto) > 25) p.push(`línea ${c.n}: clave de ${palabras(c.texto)} palabras (máximo 25)`);
  }

  const total = palabras(cuerpo) + palabras(fm);
  if (total > 6400) p.push(`demasiado largo: ${total} palabras (máximo orientativo 6.000)`);
  const secs = secciones(cuerpoLineas);
  const sec = (nombre) => secs.find((s) => s.titulo === nombre);

  // Lo básico: obligatoria, primera sección, de 90 a 200 palabras.
  const basico = sec('Lo básico');
  if (!basico) p.push('falta la sección "## Lo básico"');
  else {
    if (secs[0] !== basico) p.push('"## Lo básico" tiene que ser la primera sección');
    const n = palabras(basico.lineas.map((l) => l.texto).join(' '));
    if (n < 90 || n > 200) p.push(`"Lo básico" tiene ${n} palabras (de 90 a 200)`);
  }

  // Tablas: en una columna de TACC, nunca "No" a secas (o "No, naturalmente") sin aclarar lo del logo.
  let tabla = [];
  for (const l of [...cuerpoLineas, { n: 0, texto: '' }]) {
    if (/^\|/.test(l.texto)) { tabla.push(l); continue; }
    if (tabla.length > 2) {
      const cab = celdas(tabla[0].texto);
      const cols = cab.map((c, i) => (/TACC|gluten/i.test(c) ? i : -1)).filter((i) => i >= 0);
      for (const fila of tabla.slice(2)) {
        const c = celdas(fila.texto);
        for (const i of cols) {
          if (/^(no|sin|apto|apta)\b/i.test(c[i] ?? '') && !LOGO.test(c[i])) p.push(`línea ${fila.n}: tabla de TACC dice "${c[i]}" para "${c[0]}" sin aclarar lo del logo (por ejemplo "No de por sí, solo con logo")`);
        }
      }
    }
    tabla = [];
  }

  // "De un vistazo": la última columna es "Propiedades", corta (8 palabras como máximo).
  const vistazo = sec('De un vistazo');
  const filasTabla = (vistazo?.lineas ?? []).map((l) => l.texto).filter((l) => /^\|/.test(l));
  if (!filasTabla.length) p.push('falta la tabla de "## De un vistazo"');
  else {
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
  // de 1 a 3 párrafos sin etiquetas, una línea en blanco y las viñetas Propiedades, Tip y Ojo.
  const fichas = [];
  for (const l of sec('Los productos')?.lineas ?? []) {
    const m = l.texto.match(/^### (.+?)\s*$/);
    if (m) fichas.push({ titulo: m[1], lineas: [] });
    else if (fichas.length) fichas.at(-1).lineas.push(l);
  }
  if (!fichas.length) p.push('falta "## Los productos" con fichas "###"');
  for (const { titulo, lineas: crudas } of fichas) {
    const lineas = crudas.map((l) => l.texto.trim()).filter(Boolean);
    const vinetas = lineas.filter((l) => l.startsWith('- '));
    const parrafos = lineas.filter((l) => !l.startsWith('- '));
    const largo = palabras(lineas.join(' '));
    if (parrafos.length < 1 || parrafos.length > 3) p.push(`ficha "${titulo}": ${parrafos.length} párrafos (de 1 a 3)`);
    if (parrafos.some((l) => /^\*\*[^*]+:\*\*/.test(l))) p.push(`ficha "${titulo}": un párrafo arranca con etiqueta en negrita`);
    if (vinetas.length > 3) p.push(`ficha "${titulo}": ${vinetas.length} viñetas (máximo 3: Propiedades, Tip y Ojo)`);
    for (const v of vinetas) if (!/^-\s+\*\*(Propiedades|Tip|Ojo):\*\*/.test(v)) p.push(`ficha "${titulo}": viñeta que no es Propiedades, Tip ni Ojo: "${v.slice(0, 40)}"`);
    if (!/^-\s+\*\*Propiedades:\*\*/.test(vinetas[0] ?? '')) p.push(`ficha "${titulo}": falta "Propiedades" como primera viñeta`);
    const prop = vinetas.find((v) => v.includes('**Propiedades:**'));
    if (prop && palabras(prop) > 56) p.push(`ficha "${titulo}": Propiedades de ${palabras(prop)} palabras (máximo 50)`);
    for (const v of vinetas) {
      const m = v.match(/^-\s+\*\*(Tip|Ojo):\*\*\s*(.*)$/);
      if (m && palabras(m[2]) > 35) p.push(`ficha "${titulo}": ${m[1]} de ${palabras(m[2])} palabras (máximo 35)`);
    }
    if (largo < 75 || largo > 235) p.push(`ficha "${titulo}": ${largo} palabras (de 80 a 220)`);
    crudas.forEach((l, i) => {
      const antes = crudas[i - 1]?.texto.trim() ?? '';
      if (l.texto.trim().startsWith('- ') && antes && !antes.startsWith('- ')) p.push(`línea ${l.n}: falta una línea en blanco entre el párrafo y las viñetas de "${titulo}"`);
    });
    if (lineas.some(diceSinGluten) && !LOGO.test(lineas.join(' '))) p.push(`ficha "${titulo}": dice que no tiene gluten sin aclarar que para celíacos va solo envasado con el logo sin TACC`);
  }

  // Lo que más te van a preguntar: de 8 a 12 preguntas, cada una con su respuesta en la línea siguiente.
  const faq = sec('Lo que más te van a preguntar');
  if (!faq) p.push('falta la sección "## Lo que más te van a preguntar"');
  else {
    const ls = faq.lineas;
    const preguntas = ls.map((l, i) => i).filter((i) => /^\*\*["“¿]/.test(ls[i].texto.trim()));
    if (preguntas.length < 8 || preguntas.length > 12) p.push(`"Lo que más te van a preguntar" tiene ${preguntas.length} preguntas (de 8 a 12)`);
    for (const i of preguntas) {
      const resp = ls[i + 1]?.texto.trim() ?? '';
      if (!resp || /^\*\*["“¿]/.test(resp)) p.push(`línea ${ls[i].n}: la pregunta no tiene la respuesta en la línea siguiente`);
      else if (diceSinGluten(resp) && !LOGO.test(resp)) p.push(`línea ${ls[i + 1].n}: la respuesta dice que no tiene gluten sin aclarar lo del logo sin TACC`);
    }
  }

  if (/^#\s|^####/m.test(cuerpo)) p.push('usa # o ####');
  for (const { n, texto: l } of todas) {
    if (n > cierre + 1 && /[{}<>]/.test(l)) p.push(`línea ${n}: tiene < > { }`);
    if (PROHIBIDO.test(l)) p.push(`línea ${n}: menciona normativa u organismos: "${l.trim().slice(0, 70)}"`);
    for (const [re, msg] of NO_VA) if (re.test(l)) p.push(`línea ${n}: ${msg}`);
    const o = promesa(l);
    if (o) p.push(`línea ${n}: posible promesa de salud o uso atado a una dolencia: "${o.match(SALUD)[0]}" en "${o.trim().slice(0, 80)}"`);
    const vineta = l.match(/^\s*-\s+\*\*[^*]+\*\*\s*(.*)$/);
    if (vineta && palabras(vineta[1]) > 55) p.push(`línea ${n}: viñeta de ${palabras(vineta[1])} palabras (máximo 50)`);
  }
  if (!mal(f, p)) console.log(`✓ ${f} (${total} palabras)`);
}

if (!archivos.length) console.log('No encontré góndolas para validar.');
process.exit(errores ? 1 : 0);

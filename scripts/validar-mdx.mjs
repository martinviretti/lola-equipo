// Chequeo rápido de los módulos MDX: frontmatter básico y patrones que rompen el
// compilador. La validación completa es `npm run build`.
// Uso: node scripts/validar-mdx.mjs [archivo.mdx ...]  (sin argumentos valida todos)
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('src/content/modulos');
const archivos = process.argv.slice(2).length
  ? process.argv.slice(2).map((a) => path.resolve(a))
  : (await readdir(dir)).filter((f) => f.endsWith('.mdx')).map((f) => path.join(dir, f));

const PARTES = ['Empezar', 'Lo que tenés que saber', 'Los productos', 'Atender y trabajar', 'Consulta rápida'];
const ALERTA = /<\/?Alerta(\s+tipo="(peligro|importante|consejo|local|verificar)")?\s*>/g;
let errores = 0;

for (const archivo of archivos) {
  const texto = await readFile(archivo, 'utf8');
  const nombre = path.basename(archivo);
  const fm = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const problemas = [];

  if (!fm) problemas.push('falta el frontmatter');
  else {
    for (const campo of ['numero:', 'titulo:', 'resumen:', 'parte:', 'minutos:', 'icono:']) {
      if (!fm[1].includes(campo)) problemas.push(`falta ${campo}`);
    }
    const parte = fm[1].match(/^parte:\s*"(.+)"/m)?.[1];
    if (parte && !PARTES.includes(parte)) problemas.push(`parte inválida: ${parte}`);
  }

  const cuerpo = fm ? texto.slice(fm[0].length) : texto;
  if (/^#\s/m.test(cuerpo)) problemas.push('tiene un título h1 (#)');

  cuerpo.split(/\r?\n/).forEach((linea, i) => {
    const n = i + 1;
    if (/[{}]/.test(linea)) problemas.push(`línea ${n}: tiene llaves`);
    if (linea.includes('<!--')) problemas.push(`línea ${n}: comentario HTML`);
    const resto = linea.replace(ALERTA, '');
    if (/<\/?Alerta/.test(resto)) problemas.push(`línea ${n}: <Alerta> con tipo inválido`);
    // Un ">" al inicio de línea es una cita de Markdown y está permitido.
    if (/[<>]/.test(resto.replace(/^\s*>/, ''))) problemas.push(`línea ${n}: tiene < o > sueltos`);
  });

  const abre = (cuerpo.match(/<Alerta/g) || []).length;
  const cierra = (cuerpo.match(/<\/Alerta>/g) || []).length;
  if (abre !== cierra) problemas.push(`<Alerta> abiertas: ${abre}, cerradas: ${cierra}`);

  const palabras = cuerpo.split(/\s+/).filter(Boolean).length;
  if (problemas.length) {
    errores++;
    console.log(`✗ ${nombre}\n  - ${problemas.join('\n  - ')}`);
  } else {
    console.log(`✓ ${nombre} (${palabras} palabras)`);
  }
}

process.exit(errores ? 1 : 0);

// Junta en PENDIENTES.md todos los recuadros "local" (a completar por la encargada)
// y "verificar" (datos a confirmar) de los módulos.
// Uso: node scripts/pendientes.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('src/content/modulos');
const archivos = (await readdir(dir)).filter((f) => f.endsWith('.mdx') && !f.startsWith('00-')).sort();

const grupos = { local: [], verificar: [] };

for (const f of archivos) {
  const texto = await readFile(path.join(dir, f), 'utf8');
  const titulo = texto.match(/^titulo:\s*"(.+)"/m)?.[1] ?? f;
  const numero = f.slice(0, 2);
  const re = /<Alerta tipo="(local|verificar)">([\s\S]*?)<\/Alerta>/g;
  let m;
  while ((m = re.exec(texto))) {
    let contenido = m[2].trim().replace(/\r?\n\s*\r?\n/g, '\n').replace(/^Completar con la encargada:\s*/i, '');
    contenido = contenido.charAt(0).toUpperCase() + contenido.slice(1);
    grupos[m[1]].push({ modulo: `${numero} · ${titulo}`, contenido });
  }
}

const seccion = (items) => {
  let actual = '';
  const lineas = [];
  for (const it of items) {
    if (it.modulo !== actual) {
      actual = it.modulo;
      lineas.push(`\n### ${actual}\n`);
    }
    const cuerpo = it.contenido
      .split('\n')
      .map((l, i) => (i === 0 ? `- [ ] ${l.replace(/^-\s*/, '')}` : `      ${l}`))
      .join('\n');
    lineas.push(cuerpo);
  }
  return lineas.join('\n');
};

const md = `# Pendientes del manual

Generado con \`node scripts/pendientes.mjs\` a partir de los módulos. No editar a mano: se pisa.

## Para completar con la encargada (${grupos.local.length})

Son los recuadros "Completar en el local". Cuando tengan la respuesta, reemplazar el recuadro en el módulo
por el texto real (o pasármelo y lo cargo).
${seccion(grupos.local)}

## Datos a verificar (${grupos.verificar.length})

Son los recuadros "Dato a verificar". Hay que confirmarlos en la fuente oficial y, si se confirman, sacar el recuadro.
${seccion(grupos.verificar)}
`;

await writeFile('PENDIENTES.md', md, 'utf8');
console.log(`PENDIENTES.md: ${grupos.local.length} para completar en el local, ${grupos.verificar.length} a verificar.`);

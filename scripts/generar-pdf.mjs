// Genera el PDF de la guía de productos con Chrome o Edge en modo headless.
// Uso: npm run pdf   (hace el build, sirve dist/ en local, imprime y deja los PDF en public/ y dist/)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, statSync } from 'node:fs';
import path from 'node:path';

const PDFS = [
  { ruta: '/lola-equipo/guia/imprimir', nombre: 'guia-de-productos-lola.pdf' },
];
const PUERTO = 4329;
// El navegador que imprime no tiene sesión: el build para imprimir se arma sin login.
// (No afecta al sitio publicado: GitHub arma el suyo.)
process.env.PUBLIC_SIN_LOGIN = '1';

const navegadores = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const navegador = process.env.NAVEGADOR_PDF ?? navegadores.find((n) => existsSync(n));
if (!navegador) {
  console.error('No encontré Chrome ni Edge. Definí NAVEGADOR_PDF con la ruta al ejecutable.');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const correr = (args) => {
  const r = spawnSync(npx, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const faltabaAlguno = PDFS.some((p) => !existsSync(path.resolve('public', p.nombre)));
console.log('1/3 Build del manual…');
correr(['astro', 'build']);

console.log('2/3 Sirviendo dist/ en local…');
const servidor = spawn(npx, ['astro', 'preview', '--port', String(PUERTO), '--force'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
});

const esperar = async () => {
  for (let i = 0; i < 240; i++) {
    try {
      const r = await fetch(`http://localhost:${PUERTO}/lola-equipo/guia/imprimir`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El servidor de preview no respondió.');
};

try {
  await esperar();
  for (const pdf of PDFS) {
    const salidaPublic = path.resolve('public', pdf.nombre);
    console.log(`3/3 Imprimiendo ${pdf.ruta} con ${path.basename(navegador)}…`);
    const r = spawnSync(
      navegador,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=15000',
        `--print-to-pdf=${salidaPublic}`,
        `http://localhost:${PUERTO}${pdf.ruta}`,
      ],
      { stdio: 'ignore' },
    );
    if (r.status !== 0 || !existsSync(salidaPublic)) throw new Error(`El navegador no generó ${pdf.nombre}.`);
    copyFileSync(salidaPublic, path.resolve('dist', pdf.nombre));
    console.log(`  ${pdf.nombre}: ${Math.round(statSync(salidaPublic).size / 1024)} KB`);
  }
} finally {
  servidor.kill();
  if (process.platform === 'win32' && servidor.pid) {
    spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
  }
  // En Windows el proceso de astro preview puede sobrevivir al taskkill del shell: se cierra explícito.
  spawnSync(npx, ['astro', 'preview', 'stop'], { stdio: 'ignore', shell: process.platform === 'win32' });
}

// La primera vez, los botones "Descargar PDF" aparecen recién en un segundo build.
if (faltabaAlguno) {
  console.log('Primer PDF: rehago el build para mostrar el botón de descarga…');
  correr(['astro', 'build']);
}

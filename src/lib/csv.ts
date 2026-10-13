// Descargas para Excel: CSV con punto y coma y BOM, así Excel en español lo abre con columnas y acentos bien.

/**
 * Una celda del CSV. Los textos que empiezan con =, +, -, @, tabulación o retorno Excel los toma como
 * fórmula (y una fórmula puede abrir enlaces o pedir datos): se les pone un apóstrofo adelante para que
 * queden como texto. Los números van tal cual (un -5 sigue siendo número).
 */
export function celdaCsv(v: string | number | null | undefined) {
  if (typeof v === 'number') return String(v);
  let s = String(v ?? '');
  if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Todo el archivo, listo para guardar. */
export const textoCsv = (filas: (string | number)[][]) => '﻿' + filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n');

export function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([textoCsv(filas)], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const FORMATO = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** Fecha para Excel en español, en hora de Argentina: 12/10/2026 14:30 (la reconoce como fecha y se puede ordenar). */
export const fechaExcel = (iso: string | null) => {
  if (!iso) return '';
  const p = Object.fromEntries(FORMATO.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
};

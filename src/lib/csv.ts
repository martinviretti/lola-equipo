// Descargas para Excel: CSV con punto y coma y BOM, así Excel en español lo abre con columnas y acentos bien.
export function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const celda = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
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

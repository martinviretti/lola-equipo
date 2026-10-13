// Archivos de Excel (.xlsx) con varias hojas, armados en el navegador sin librerías: un .xlsx es un
// zip con unos XML adentro. Va sin comprimir (son archivos chicos) y Excel lo abre igual.
// Cada hoja tiene la primera fila en negrita y fija; las fechas van como fechas de verdad.

/** Un valor de celda: texto, número, vacío o una fecha (ISO, se muestra en hora de Argentina). */
export type Celda = string | number | null | undefined | { fecha: string | null };
export interface Hoja {
  nombre: string;
  filas: Celda[][];
  /** Ancho de cada columna (en caracteres, aproximado). */
  anchos?: number[];
}

const escapar = (s: string) =>
  s
    // Caracteres de control que el XML no admite
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** 0 → A, 25 → Z, 26 → AA. */
const columna = (n: number) => {
  let s = '';
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const PARTES = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
/** Fecha de Excel: días desde el 30/12/1899, con la hora de Argentina. */
function serial(iso: string) {
  const p = Object.fromEntries(PARTES.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) / 86400000 + 25569;
}

function celda(v: Celda, ref: string, cabecera: boolean) {
  const estilo = cabecera ? ' s="1"' : '';
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${estilo}><v>${v}</v></c>` : '';
  if (typeof v === 'object') return v.fecha ? `<c r="${ref}" s="2"><v>${serial(v.fecha)}</v></c>` : '';
  return `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org';

function hojaXml(h: Hoja) {
  const filas = h.filas.map((f, i) => `<row r="${i + 1}">${f.map((v, j) => celda(v, `${columna(j)}${i + 1}`, i === 0)).join('')}</row>`).join('');
  const anchos = h.anchos?.length ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return (
    `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `${anchos}<sheetData>${filas}</sheetData></worksheet>`
  );
}

const ESTILOS =
  `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Arma el .xlsx (como bytes). Los nombres de hoja se recortan a 31 caracteres, como pide Excel. */
export function armarXlsx(hojas: Hoja[]): Uint8Array {
  const nombres = hojas.map((h) => h.nombre.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31));
  const archivos: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="${NS}/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>` +
        nombres.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        `</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">` +
        hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${hojas.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', ESTILOS],
    ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)] as [string, string]),
  ];
  const texto = new TextEncoder();
  return zip(archivos.map(([nombre, contenido]) => ({ nombre, datos: texto.encode(contenido) })));
}

/** Baja el .xlsx con ese nombre. */
export function descargarXlsx(nombre: string, hojas: Hoja[]) {
  const bytes = armarXlsx(hojas);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Zip sin comprimir ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (const x of b) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const texto = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  const FECHA = 0x21; // 1/1/1980 en formato de fecha de DOS
  for (const a of archivos) {
    const nombre = texto.encode(a.nombre);
    const crc = crc32(a.datos);
    const n = a.datos.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin comprimir
    local.setUint16(10, 0, true);
    local.setUint16(12, FECHA, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, n, true);
    local.setUint32(22, n, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nombre, a.datos);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, 0, true);
    cen.setUint16(14, FECHA, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, n, true);
    cen.setUint32(24, n, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    desplazamiento += 30 + nombre.length + n;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of todo) {
    salida.set(x, i);
    i += x.length;
  }
  return salida;
}

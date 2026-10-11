// Progreso del empleado guardado en el dispositivo (localStorage). No sale del celular.
const CLAVE = 'lola-manual:v1';

export interface Progreso {
  leidos: Record<string, string>; // slug -> fecha ISO
  quiz: Record<string, { ok: number; total: number; fecha: string }>;
}

export function leer(): Progreso {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? '');
    return { leidos: p.leidos ?? {}, quiz: p.quiz ?? {} };
  } catch {
    return { leidos: {}, quiz: {} };
  }
}

function guardar(p: Progreso) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // Modo privado o almacenamiento lleno: el manual sigue funcionando sin progreso.
  }
}

export function marcarLeido(slug: string, leido = true) {
  const p = leer();
  if (leido) p.leidos[slug] = new Date().toISOString();
  else delete p.leidos[slug];
  guardar(p);
}

export function guardarQuiz(slug: string, ok: number, total: number) {
  const p = leer();
  const previo = p.quiz[slug];
  // Se conserva el mejor resultado.
  if (!previo || ok >= previo.ok) p.quiz[slug] = { ok, total, fecha: new Date().toISOString() };
  guardar(p);
}

export function reiniciar() {
  guardar({ leidos: {}, quiz: {} });
}

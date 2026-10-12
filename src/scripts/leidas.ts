// Temas de la Bienvenida que la persona ya abrió, guardados en el celular (localStorage).
const CLAVE = 'lola-bienvenida:v1';

export function leidas(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

export function marcarLeida(id: string) {
  const l = leidas();
  if (l.includes(id)) return l;
  const nueva = [...l, id];
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nueva));
  } catch {
    // Sin almacenamiento: la página funciona igual, sin recordar.
  }
  return nueva;
}

import { nube } from './nube';
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
  nube.leida(id);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nueva));
  } catch {
    // Sin almacenamiento: la página funciona igual, sin recordar.
  }
  return nueva;
}

/** Suma al celular las secciones leídas que están en la base. */
export function mezclarLeidas(ids: string[]) {
  const l = leidas();
  const nueva = [...new Set([...l, ...ids])];
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nueva));
  } catch {}
}

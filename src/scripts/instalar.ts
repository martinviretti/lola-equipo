// Instalar la app (PWA) en el celular. Detecta el teléfono y el navegador, guarda el aviso de
// instalación que da Chrome en Android y dice qué pasos hay que mostrar en cada caso.

type AvisoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type Caso =
  | 'instalada' // ya se abrió como app
  | 'android-boton' // Chrome en Android ofrece instalar: un botón alcanza
  | 'android-menu' // Android sin el aviso: hay que usar el menú ⋮ del navegador
  | 'ios-safari' // iPhone con Safari: Compartir → Agregar a inicio
  | 'ios-otro' // iPhone con otro navegador (Chrome, Google, etc.)
  | 'app-interna' // abierta dentro de Instagram, Facebook, TikTok…
  | 'computadora';

const ua = navigator.userAgent;
export const esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = /Android/.test(ua);
const esAppInterna = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|TikTok|musical_ly|Snapchat/i.test(ua);
const esSafari = esIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);

let aviso: AvisoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  aviso = e as AvisoInstalar;
  avisar();
});
addEventListener('appinstalled', () => {
  aviso = null;
  avisar();
});

export const estaInstalada = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function caso(): Caso {
  if (estaInstalada()) return 'instalada';
  if (esAppInterna) return 'app-interna';
  if (esIOS) return esSafari ? 'ios-safari' : 'ios-otro';
  if (esAndroid) return aviso ? 'android-boton' : 'android-menu';
  return 'computadora';
}

/** Llama a `f` cada vez que cambia el caso (por ejemplo, cuando Chrome habilita el botón). */
export const alCambiar = (f: () => void) => oyentes.add(f);

/** Abre el aviso de instalación de Android. Devuelve true si la persona aceptó. */
export async function instalar() {
  if (!aviso) return false;
  await aviso.prompt();
  const { outcome } = await aviso.userChoice;
  aviso = null;
  avisar();
  return outcome === 'accepted';
}

// "Ahora no" o "Ya la instalé": la tarjeta del inicio se esconde unos días.
const CLAVE = 'lola-instalar-oculto:v1';
const DIAS_OCULTA = 5;
export function ocultarTarjeta() {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {}
}
export function tarjetaOculta() {
  try {
    const t = Number(localStorage.getItem(CLAVE));
    return !!t && Date.now() - t < DIAS_OCULTA * 864e5;
  } catch {
    return false;
  }
}

/** Dirección de la app, para copiar o compartir. */
export const enlaceApp = () => new URL(import.meta.env.BASE_URL, location.origin).href;

export async function copiarEnlace() {
  try {
    await navigator.clipboard.writeText(enlaceApp());
    return true;
  } catch {
    return false;
  }
}

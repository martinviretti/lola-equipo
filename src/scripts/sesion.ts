// Login con Google (Supabase): controla que quien abre la app esté autorizada, pinta su usuario
// en el encabezado y sincroniza su avance. Si Supabase no está configurado, no hace nada.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { url } from '../lib/url';
import { supabase, configurado } from '../lib/supabase';
import { app } from './app';
import { mezclarLeidas, leidas } from './leidas';
import { bajarProgreso, procesarPendientes, nube } from './nube';

export interface Acceso {
  email: string;
  nombre: string;
  foto?: string;
  rol: 'empleada' | 'admin';
  /** Última verificación contra la base (ms). */
  t: number;
}

const ACCESO = 'lola-acceso:v1';
/** Datos del avance que son de la persona: se borran al salir o si entra otra cuenta en el mismo celular. */
const DATOS_PERSONALES = ['lola-app:v1', 'lola-bienvenida:v1', 'lola-pendientes:v1', 'lola-pendientes-fallidos:v1', 'lola-cierre:v1'];
const REVERIFICAR_MS = 10 * 60 * 1000;
/** Cuánto esperamos a Supabase antes de seguir con lo que ya sabemos de la persona. */
const TOPE_SESION_MS = 4000;

export const accesoGuardado = (): Acceso | null => {
  try {
    return JSON.parse(localStorage.getItem(ACCESO) ?? 'null');
  } catch {
    return null;
  }
};
const guardarAcceso = (a: Acceso | null) => {
  try {
    if (a) localStorage.setItem(ACCESO, JSON.stringify(a));
    else localStorage.removeItem(ACCESO);
  } catch {}
};
const borrarDatosPersonales = () =>
  DATOS_PERSONALES.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });

const mostrar = () => document.documentElement.classList.remove('verificando');

export function irAEntrar(error?: string) {
  const volver = location.pathname + location.search + location.hash;
  const destino = new URL(url('/entrar'), location.origin);
  if (!volver.endsWith('/entrar')) destino.searchParams.set('volver', volver);
  if (error) destino.searchParams.set('error', error);
  location.replace(destino.toString());
}

export async function salir() {
  try {
    await procesarPendientes();
    await supabase?.auth.signOut();
  } catch {}
  guardarAcceso(null);
  borrarDatosPersonales();
  location.replace(url('/entrar'));
}

/**
 * Pregunta a la base si el mail está autorizado y registra el ingreso.
 * Devuelve el acceso, `null` si no está autorizado, o `undefined` si no se pudo preguntar (sin conexión).
 */
export async function verificar(): Promise<Acceso | null | undefined> {
  const { data } = await supabase!.auth.getSession();
  const u = data.session?.user;
  if (!u?.email) return null;
  const nombre = (u.user_metadata?.full_name || u.user_metadata?.name || u.email.split('@')[0]) as string;
  const { data: rol, error } = await supabase!.rpc('registrar_ingreso', { p_nombre: nombre });
  if (error) return undefined;
  if (!rol) return null;
  const anterior = accesoGuardado();
  const email = u.email.toLowerCase();
  // Otra cuenta en este celular: el avance guardado no es suyo.
  if (anterior && anterior.email !== email) borrarDatosPersonales();
  const acceso: Acceso = { email, nombre, foto: u.user_metadata?.avatar_url, rol, t: Date.now() };
  guardarAcceso(acceso);
  if (!anterior || anterior.email !== email) await primeraSincronizacion();
  return acceso;
}

/** En un celular nuevo: trae el avance de la base y sube lo que ya había en el celular. */
async function primeraSincronizacion() {
  const p = await bajarProgreso();
  const e = app.estado();
  for (const g of e.vistas) nube.vista(g);
  for (const s of leidas()) nube.leida(s);
  if (p) {
    app.mezclarDeLaNube(p);
    mezclarLeidas(p.leidas);
  }
}

let resolver: (a: Acceso | null) => void;
/** Se resuelve con el acceso de la persona (o null si la app no pide login). */
export const sesionLista = new Promise<Acceso | null>((r) => (resolver = r));

type Lectura = Awaited<ReturnType<SupabaseClient['auth']['getSession']>>;
const esperar = (ms: number) => new Promise<null>((r) => setTimeout(() => r(null), ms));
/** No se pudo hablar con Supabase: sin señal, señal colgada (`null`: no contestó a tiempo) o el servidor caído. */
const sinRed = (l: Lectura | null) => l === null || !navigator.onLine || l.error?.name === 'AuthRetryableFetchError';

const entrar = (a: Acceso) => {
  mostrar();
  resolver(a);
  pintarUsuario(a);
};

/** Llamado en cada página (menos /entrar). */
export async function controlarAcceso() {
  if (!configurado) {
    mostrar();
    resolver(null);
    return;
  }
  const guardado = accesoGuardado();
  const pedido = supabase!.auth.getSession();
  // Con el token vencido y sin señal, getSession() intenta renovarlo durante ~30 s y termina en session = null.
  // Si ya conocemos a la persona no la hacemos esperar ni la sacamos de la app: sigue en modo sin conexión.
  const lectura = guardado ? await Promise.race([pedido, esperar(TOPE_SESION_MS)]) : await pedido;
  if (lectura?.data.session) return seguir(lectura.data.session);
  if (guardado && sinRed(lectura)) return modoSinConexion(guardado, lectura ? null : pedido);
  irAEntrar();
}

/** Con la sesión confirmada: entra (o confirma que sigue autorizada) y sube lo pendiente. */
async function seguir(session: Session) {
  const guardado = accesoGuardado();
  const email = session.user.email?.toLowerCase();
  if (guardado && guardado.email === email) {
    // Entrada rápida con lo que ya sabemos; se vuelve a confirmar en segundo plano.
    entrar(guardado);
    if (navigator.onLine && Date.now() - guardado.t > REVERIFICAR_MS) {
      const a = await verificar();
      if (a === null) return salirSinPermiso();
      if (a) pintarUsuario(a);
    }
  } else {
    const a = await verificar();
    if (a === null) return salirSinPermiso();
    if (a === undefined) return irAEntrar('sin-conexion');
    entrar(a);
  }
  void procesarPendientes();
}

/**
 * Sin señal y con la sesión sin confirmar: sigue con lo que ya sabemos de la persona. Cuando vuelve la señal
 * (o supabase-js logra renovar el token solo) se confirma la sesión; si ya no vale, recién ahí va a /entrar.
 */
function modoSinConexion(guardado: Acceso, pedido: Promise<Lectura> | null) {
  entrar(guardado);
  let listo = false;
  let probando = false;
  const probar = async (l?: Lectura) => {
    if (listo || probando) return;
    probando = true;
    try {
      const lectura = l ?? (await supabase!.auth.getSession());
      if (lectura.data.session) {
        terminar();
        await seguir(lectura.data.session);
      } else if (!sinRed(lectura)) {
        terminar();
        irAEntrar();
      }
    } finally {
      probando = false;
    }
  };
  const alVolver = () => void probar();
  // supabase-js pide no esperar otras llamadas suyas adentro de este aviso: se prueba en el turno siguiente.
  const { data } = supabase!.auth.onAuthStateChange((evento) => {
    if (evento === 'TOKEN_REFRESHED' || evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(alVolver, 0);
  });
  const terminar = () => {
    listo = true;
    data.subscription.unsubscribe();
    removeEventListener('online', alVolver);
  };
  addEventListener('online', alVolver);
  void pedido?.then((l) => probar(l));
}

async function salirSinPermiso() {
  await supabase?.auth.signOut();
  guardarAcceso(null);
  borrarDatosPersonales();
  irAEntrar('no-autorizado');
}

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Muestra la persona en el encabezado, con el menú de Admin (si corresponde) y Salir. */
function pintarUsuario(a: Acceso) {
  const caja = document.querySelector<HTMLElement>('[data-usuario]');
  if (!caja) return;
  caja.classList.remove('hidden');
  const avatar = caja.querySelector<HTMLElement>('[data-usuario-avatar]')!;
  avatar.textContent = iniciales(a.nombre);
  caja.querySelector('[data-usuario-nombre]')!.textContent = a.nombre;
  caja.querySelector('[data-usuario-email]')!.textContent = a.email;
  caja.querySelector('[data-usuario-admin]')?.classList.toggle('hidden', a.rol !== 'admin');
  document.querySelectorAll('[data-solo-admin]').forEach((el) => el.classList.toggle('hidden', a.rol !== 'admin'));
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-salir]');
    if (b) {
      e.preventDefault();
      void salir();
    }
  });
}

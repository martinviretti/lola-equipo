// Pantalla del fichador (la compu o el celular del local). Un solo ciclo mira la cámara: busca caras
// y códigos QR, y según el modo ficha, guía el registro de una cara o espera.
import jsQR from 'jsqr';
import { supabase } from '../../lib/supabase';
import { url } from '../../lib/url';
import { dispositivoGuardado, guardarDispositivo, hora, diaClave, diaLargo, PREFIJO_QR, type Dispositivo } from '../../lib/fichador';
import { cargarCaras, leer, huella, promedio, ojosCerrados, type Lectura } from './caras';
import { encolar, mandarPendientes, pendientes, esSinConexion } from './cola';
import { iniciarRegistro, registroActivo, alimentarRegistro } from './registrar';
import { mostrarCapa, capaVisible } from './capas';
import { sonar } from './sonidos';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const video = $<HTMLVideoElement>('[data-video]');

let disp: Dispositivo | null = dispositivoGuardado();
/** Diferencia entre el reloj de la base y el de la compu (la hora que vale es la de la base). */
let desfase = 0;
const ahora = () => new Date(Date.now() + desfase);

// ---------- Reloj y "Hoy en el local" ----------
interface EventoHoy {
  email: string;
  nombre: string;
  tipo: 'entrada' | 'salida';
  hora: string;
}
function pintarReloj() {
  const a = ahora();
  $('[data-reloj]').textContent = hora(a);
  $('[data-fecha]').textContent = diaLargo(a);
}
setInterval(pintarReloj, 1000);
pintarReloj();

function pintarHoy(hoy: EventoHoy[]) {
  const porPersona = new Map<string, EventoHoy[]>();
  for (const e of hoy) porPersona.set(e.email, [...(porPersona.get(e.email) ?? []), e]);
  const filas = [...porPersona.values()]
    .map((evs) => ({ evs, ultimo: evs[evs.length - 1] }))
    .sort((a, b) => (a.ultimo.tipo === b.ultimo.tipo ? b.ultimo.hora.localeCompare(a.ultimo.hora) : a.ultimo.tipo === 'entrada' ? -1 : 1));
  const lista = $('[data-hoy]');
  lista.replaceChildren(
    ...filas.map(({ evs, ultimo }) => {
      const li = document.createElement('li');
      li.className = 'persona-hoy';
      const punto = document.createElement('span');
      punto.className = `punto${ultimo.tipo === 'entrada' ? ' adentro' : ''}`;
      const nombre = document.createElement('span');
      nombre.className = 'flex-1 font-bold text-profundo';
      nombre.textContent = ultimo.nombre;
      const detalle = document.createElement('span');
      detalle.className = 'text-sm font-semibold tabular-nums text-texto-2';
      detalle.textContent = ultimo.tipo === 'entrada' ? `Adentro desde las ${hora(ultimo.hora)}` : `Se fue a las ${hora(ultimo.hora)}`;
      li.title = evs.map((e) => `${e.tipo === 'entrada' ? 'Entró' : 'Salió'} ${hora(e.hora)}`).join(' · ');
      li.append(punto, nombre, detalle);
      return li;
    }),
  );
  $('[data-hoy-vacio]').classList.toggle('hidden', filas.length > 0);
}

function pintarCola() {
  const n = pendientes();
  $('[data-cola-chip]').classList.toggle('hidden', !n && navigator.onLine);
  $('[data-cola-texto]').textContent = n ? `Sin internet: ${n} ${n === 1 ? 'fichada guardada' : 'fichadas guardadas'}` : 'Sin internet';
  $('[data-conexion]').classList.toggle('hidden', !navigator.onLine || n > 0);
}

let caras = 0;
/** Si está prendido en el panel, además hay que parpadear (una foto impresa no parpadea). */
let pedirParpadeo = false;
let parpadeo = false;
async function refrescarEstado() {
  pintarCola();
  if (!disp || !supabase) return;
  await mandarPendientes(disp);
  const { data, error } = await supabase.rpc('estado_fichador', { p_dispositivo: disp.id, p_secreto: disp.secreto });
  if (error) {
    if (/dispositivo_invalido/.test(error.message)) return compuDesactivada();
    pintarCola();
    return;
  }
  desfase = new Date(data.ahora).getTime() - Date.now();
  caras = data.caras;
  pedirParpadeo = data.ajustes?.parpadeo === true;
  pintarHoy((data.hoy as EventoHoy[]).filter((e) => diaClave(e.hora) === diaClave(ahora())));
  $('[data-pie]').textContent = `${data.nombre} · ${caras} ${caras === 1 ? 'cara registrada' : 'caras registradas'}`;
  pintarCola();
}
setInterval(() => void refrescarEstado(), 20000);
addEventListener('online', () => void refrescarEstado());
addEventListener('offline', pintarCola);

function compuDesactivada() {
  guardarDispositivo(null);
  disp = null;
  $('[data-activar-texto]').textContent = 'Este fichador fue desactivado desde el panel. Para volver a usarlo, activalo de nuevo con una cuenta de admin.';
  void mostrarActivar();
}

// ---------- Modo calibrar (/fichador?calibrar): muestra los números para ajustar el panel ----------
const tablero = new URLSearchParams(location.search).has('calibrar')
  ? document.body.appendChild(Object.assign(document.createElement('pre'), { className: 'fixed right-3 bottom-3 z-50 rounded-xl bg-white/90 p-3 font-mono text-xs text-profundo shadow-lg' }))
  : null;
let ultimaSimilitud = 'parecido: —';
function mostrarCalibracion(l: Lectura) {
  if (!tablero) return;
  tablero.textContent = [
    `caras en cámara: ${l.cantidad}`,
    `ojos: ${l.ojos.toFixed(2)} (cerrados por debajo de 0.20)`,
    `giro de la cabeza: ${l.giro.toFixed(2)}`,
    `tamaño de la cara: ${l.lado}px (mínimo ${Math.round(Math.max(110, Math.min(video.videoWidth, video.videoHeight) * 0.2))})`,
    `parpadeo: ${pedirParpadeo ? (parpadeo ? 'visto' : 'esperando') : 'no se pide'}`,
    `qué falta: ${l.falta ?? 'nada'}`,
    ultimaSimilitud,
  ].join('\n');
}

// ---------- Mensajes bajo la cámara ----------
const MENSAJES: Record<NonNullable<Lectura['falta']>, string> = {
  nadie: 'Acercate y mirá a la cámara',
  varias: 'De a una persona por vez',
  lejos: 'Acercate un poco más',
  quieta: 'No te muevas un segundo…',
};
const mensaje = (t: string) => ($('[data-mensaje]').textContent = t);
const anillo = (avance: number) => ($('[data-anillo]').style.strokeDashoffset = String(100 - Math.min(1, avance) * 100));

// ---------- Resultado ----------
let ocupado = false;
let pausaHasta = 0;
let ultimaFichada: { id: number; hasta: number } | null = null;

function mostrarResultado(o: { titulo: string; detalle?: string; sub?: string; tipo: 'entrada' | 'salida' | 'aviso'; id?: number; segundos?: number }) {
  // Una respuesta que llega tarde no tapa el registro de una cara ni la activación.
  const visible = capaVisible();
  if (visible && visible !== 'resultado') return;
  const caja = $('[data-resultado-caja]');
  caja.classList.toggle('salida', o.tipo === 'salida');
  caja.classList.toggle('aviso', o.tipo === 'aviso');
  $('[data-resultado-titulo]').textContent = o.titulo;
  $('[data-resultado-detalle]').textContent = o.detalle ?? '';
  $('[data-resultado-detalle]').className = `mt-3 text-2xl font-semibold ${o.tipo === 'aviso' ? 'text-ambar' : 'text-marca-texto'}`;
  $('[data-resultado-sub]').textContent = o.sub ?? '';
  const boton = $('[data-no-soy-yo]');
  boton.classList.toggle('hidden', !o.id);
  mostrarCapa('resultado');
  sonar(o.tipo === 'aviso' ? 'error' : 'ok');
  const segundos = o.segundos ?? (o.id ? 8 : 5);
  const fin = Date.now() + segundos * 1000;
  ultimaFichada = o.id ? { id: o.id, hasta: fin } : null;
  pausaHasta = fin + 1500;
  const contar = () => {
    if (capaVisible() !== 'resultado') return;
    const quedan = Math.ceil((fin - Date.now()) / 1000);
    $('[data-no-soy-yo-cuenta]').textContent = quedan > 0 ? `(${quedan})` : '';
    if (quedan <= 0) {
      mostrarCapa(null);
      ultimaFichada = null;
      return;
    }
    setTimeout(contar, 250);
  };
  contar();
}

$('[data-no-soy-yo]').addEventListener('click', async () => {
  if (!ultimaFichada || !disp) return;
  const id = ultimaFichada.id;
  ultimaFichada = null;
  const { data } = await supabase!.rpc('deshacer_fichada', { p_dispositivo: disp.id, p_secreto: disp.secreto, p_id: id });
  mostrarResultado({
    titulo: data ? 'Listo, la borramos' : 'No se pudo borrar',
    detalle: data ? 'Probá de nuevo mirando de frente' : 'Avisale a la encargada',
    tipo: 'aviso',
    segundos: 4,
  });
  void refrescarEstado();
});

const primerNombre = (n: string) => n.split(/\s+/)[0];
function contarRespuesta(r: { estado: string; nombre?: string; tipo?: 'entrada' | 'salida'; hora?: string; id?: number; otra?: string }) {
  switch (r.estado) {
    case 'ok':
      mostrarResultado({
        titulo: `¡Hola, ${primerNombre(r.nombre!)}!`,
        detalle: `${r.tipo === 'entrada' ? 'Entrada' : 'Salida'} · ${hora(r.hora!)}`,
        sub: r.tipo === 'entrada' ? 'Que tengas una linda jornada.' : '¡Gracias por el día de hoy!',
        tipo: r.tipo!,
        id: r.id,
      });
      void refrescarEstado();
      return true;
    case 'repetida':
      mostrarResultado({
        titulo: `${primerNombre(r.nombre!)}, ya estás`,
        detalle: `Fichaste tu ${r.tipo} a las ${hora(r.hora!)}`,
        tipo: 'aviso',
      });
      return true;
    case 'limite_dia':
      mostrarResultado({
        titulo: `${primerNombre(r.nombre!)}, hoy ya fichaste 4 veces`,
        detalle: 'Ya tenés tus 2 entradas y 2 salidas del día',
        sub: 'Es el máximo por día (horario cortado). Si hay un error, avisale a la encargada.',
        tipo: 'aviso',
        segundos: 7,
      });
      return true;
    case 'cara_de_otra':
      mostrarResultado({
        titulo: 'Ese código no es tuyo',
        detalle: `Es de ${primerNombre(r.nombre!)}, y la cara es de ${primerNombre(r.otra!)}`,
        sub: 'Cada una ficha con su cara o con el código de su celular.',
        tipo: 'aviso',
      });
      return true;
    case 'codigo_vencido':
    case 'codigo_invalido':
      mostrarResultado({ titulo: 'El código venció', detalle: 'Abrí de nuevo "Fichar" en el celular', sub: 'Las fotos o capturas del código no sirven.', tipo: 'aviso' });
      return true;
    case 'falta_cara':
      mensaje('Mostrá el código y mirá a la cámara al mismo tiempo');
      return false;
    case 'sin_acceso':
      mostrarResultado({ titulo: 'Sin acceso', detalle: 'Esta persona está dada de baja', tipo: 'aviso' });
      return true;
    default:
      return false;
  }
}

// ---------- Fichar ----------
const lienzoFoto = document.createElement('canvas');
function foto(): string | null {
  if (!video.videoWidth) return null;
  const ancho = 320;
  lienzoFoto.width = ancho;
  lienzoFoto.height = Math.round((video.videoHeight / video.videoWidth) * ancho);
  lienzoFoto.getContext('2d')!.drawImage(video, 0, 0, lienzoFoto.width, lienzoFoto.height);
  return lienzoFoto.toDataURL('image/jpeg', 0.6);
}

let intentosFallidos = 0;
async function ficharConCara(embedding: number[]) {
  if (!disp) return;
  ocupado = true;
  mensaje('Un segundo…');
  const f = foto();
  const e = huella(embedding);
  const avisarGuardada = () =>
    mostrarResultado({
      titulo: 'Sin internet',
      detalle: 'Guardamos tu fichada',
      sub: 'Se confirma sola cuando vuelva la conexión. Si querés, avisale a la encargada.',
      tipo: 'aviso',
      segundos: 6,
    });
  try {
    // Si quedaron fichadas guardadas sin internet, primero van esas (para respetar el orden).
    if (pendientes()) await mandarPendientes(disp);
    if (pendientes()) {
      encolar(e, f, ahora());
      pintarCola();
      avisarGuardada();
      return;
    }
    const { data, error } = await supabase!.rpc('fichar_cara', { p_dispositivo: disp.id, p_secreto: disp.secreto, p_embedding: e, p_foto: f });
    if (error) {
      if (/dispositivo_invalido/.test(error.message)) return compuDesactivada();
      if (esSinConexion(error)) {
        encolar(e, f, ahora());
        pintarCola();
        avisarGuardada();
        return;
      }
      throw error;
    }
    ultimaSimilitud = `parecido: ${typeof data.similitud === 'number' ? data.similitud.toFixed(2) : '—'} (${data.estado}${data.nombre ? `, ${data.nombre}` : ''})`;
    if (data.estado === 'desconocida' || data.estado === 'dudosa') {
      intentosFallidos++;
      pausaHasta = Date.now() + 1200;
      if (intentosFallidos >= 3) {
        intentosFallidos = 0;
        mostrarResultado({
          titulo: 'No te reconocí',
          detalle: 'Probá con más luz, de frente',
          sub: caras ? 'O mostrá el código de "Fichar" en la app del celular.' : 'Todavía no hay caras registradas: tocá "Registrar cara".',
          tipo: 'aviso',
          segundos: 6,
        });
      } else mensaje('No te reconocí, probemos otra vez…');
      return;
    }
    intentosFallidos = 0;
    contarRespuesta(data);
  } catch {
    mostrarResultado({ titulo: 'Algo falló', detalle: 'Probá de nuevo en un momento', tipo: 'aviso' });
  } finally {
    ocupado = false;
  }
}

/** Con el código del celular. La cara es opcional: si se ve, se controla que no sea la de otra persona. */
async function ficharConCodigo(qr: string, embedding: number[] | null) {
  if (!disp) return;
  ocupado = true;
  mensaje('Un segundo…');
  try {
    const { data, error } = await supabase!.rpc('fichar_codigo', {
      p_dispositivo: disp.id,
      p_secreto: disp.secreto,
      p_qr: qr,
      p_embedding: embedding ? huella(embedding) : null,
      p_foto: foto(),
    });
    if (error) {
      if (/dispositivo_invalido/.test(error.message)) return compuDesactivada();
      mostrarResultado({
        titulo: esSinConexion(error) ? 'Sin internet' : 'Algo falló',
        detalle: esSinConexion(error) ? 'Con el código no se puede fichar sin conexión' : 'Probá de nuevo en un momento',
        sub: esSinConexion(error) ? 'Probá con la cara: se guarda y se manda sola después.' : '',
        tipo: 'aviso',
      });
      return;
    }
    contarRespuesta(data);
  } finally {
    ocupado = false;
  }
}

// ---------- Ciclo de la cámara ----------
const lienzoQr = document.createElement('canvas');
const ctxQr = lienzoQr.getContext('2d', { willReadFrequently: true })!;
function buscarQr(): string | null {
  if (!video.videoWidth) return null;
  const ancho = Math.min(640, video.videoWidth);
  lienzoQr.width = ancho;
  lienzoQr.height = Math.round((video.videoHeight / video.videoWidth) * ancho);
  ctxQr.drawImage(video, 0, 0, lienzoQr.width, lienzoQr.height);
  const img = ctxQr.getImageData(0, 0, lienzoQr.width, lienzoQr.height);
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  return r?.data.startsWith(`${PREFIJO_QR}.`) ? r.data : null;
}

/** Cuadros válidos seguidos de la misma cara: con 3 se reconoce. */
let validas: { t: number; e: number[] }[] = [];
let qrVisto: { texto: string; t: number; desde: number } | null = null;
let vuelta = 0;

async function ciclo() {
  try {
    if (video.readyState >= 2 && capaVisible() !== 'activar' && capaVisible() !== 'problema') {
      const enRegistro = registroActivo();
      const l = await leer(video);
      mostrarCalibracion(l);
      if (enRegistro) {
        alimentarRegistro(l, foto);
      } else if (!ocupado && Date.now() > pausaHasta && capaVisible() === null) {
        // Código del celular (se busca en cuadros alternados para no cargar la compu)
        if (vuelta++ % 2 === 0) {
          const qr = buscarQr();
          if (qr) qrVisto = { texto: qr, t: Date.now(), desde: qrVisto && Date.now() - qrVisto.t < 2000 ? qrVisto.desde : Date.now() };
        }
        const conQr = qrVisto && Date.now() - qrVisto.t < 2500;
        if (conQr) {
          // El código vale igual que la cara: si además se ve una cara, va junto (para controlar que no
          // sea la de otra compañera); si no aparece ninguna en un momento, ficha con el código solo.
          anillo(0.5);
          // Una cara chiquita (alguien que pasa atrás) no cuenta: con eso no se puede comparar bien.
          if (l.cantidad === 1 && l.embedding && l.falta !== 'lejos') {
            await ficharConCodigo(qrVisto!.texto, l.embedding);
            qrVisto = null;
          } else if (l.cantidad > 1) {
            mensaje(MENSAJES.varias);
          } else if (Date.now() - qrVisto!.desde > 1200) {
            await ficharConCodigo(qrVisto!.texto, null);
            qrVisto = null;
          } else mensaje('Leyendo el código…');
        } else {
          qrVisto = null;
          if (l.falta === 'nadie') parpadeo = false;
          if (ojosCerrados(l)) parpadeo = true;
          if (l.valida && l.embedding) {
            // Las 3 últimas lecturas buenas de los últimos 5 segundos (en una compu lenta cada lectura tarda casi un segundo).
            validas = [...validas.filter((x) => Date.now() - x.t < 5000).slice(-2), { t: Date.now(), e: l.embedding }];
            anillo(validas.length / 3);
            mensaje('Reconociendo…');
            if (validas.length >= 3 && pedirParpadeo && !parpadeo) {
              mensaje('Parpadeá una vez, despacio');
            } else if (validas.length >= 3) {
              parpadeo = false;
              const media = promedio(validas.map((v) => v.e));
              validas = [];
              $('[data-marco]').classList.add('ok');
              await ficharConCara(media);
              $('[data-marco]').classList.remove('ok');
              anillo(0);
            }
          } else {
            if (l.falta === 'nadie') validas = [];
            anillo(validas.length / 3);
            mensaje(MENSAJES[l.falta ?? 'nadie']);
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
  // Sin requestAnimationFrame: si otra ventana tapa el fichador, el navegador lo frena pero sigue andando.
  setTimeout(() => void ciclo(), 120);
}

// ---------- Activar la compu (una admin, una sola vez) ----------
const DATOS_DE_SESION = ['lola-acceso:v1', 'lola-app:v1', 'lola-bienvenida:v1', 'lola-pendientes:v1', 'lola-cierre:v1'];
const verActivar = (p: 'inicio' | 'form' | 'no-admin') =>
  document.querySelectorAll<HTMLElement>('[data-activar]').forEach((x) => x.classList.toggle('hidden', x.dataset.activar !== p));

async function mostrarActivar() {
  mostrarCapa('activar');
  verActivar('inicio');
  const { data } = await supabase!.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return;
  const { data: esAdmin } = await supabase!.rpc('es_admin');
  if (esAdmin === true) {
    $('[data-activar-quien]').textContent = email;
    // Celular (pantalla táctil): se propone dejar la sesión abierta; en la compu, cerrarla.
    const celular = matchMedia('(pointer: coarse)').matches;
    $<HTMLInputElement>('#mantener-sesion').checked = celular;
    $<HTMLInputElement>('#nombre-compu').value = celular ? 'Celular del local' : 'Compu del local';
    verActivar('form');
  } else {
    $('[data-activar-quien2]').textContent = email;
    verActivar('no-admin');
  }
}

$('[data-activar-entrar]').addEventListener('click', () => {
  const destino = new URL(url('/entrar'), location.origin);
  destino.searchParams.set('volver', url('/fichador'));
  location.assign(destino.toString());
});
$('[data-activar-otra]').addEventListener('click', async () => {
  await supabase!.auth.signOut();
  DATOS_DE_SESION.forEach((k) => localStorage.removeItem(k));
  verActivar('inicio');
});
$<HTMLFormElement>('[data-activar="form"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target as HTMLFormElement);
  const nombre = String(datos.get('nombre') ?? '').trim();
  const mantener = datos.get('mantener') === 'on';
  const { data, error } = await supabase!.rpc('activar_dispositivo', { p_nombre: nombre });
  const err = $('[data-activar-error]');
  if (error || !data) {
    err.textContent = 'No se pudo activar. Revisá la conexión y probá de nuevo.';
    err.classList.remove('hidden');
    return;
  }
  guardarDispositivo({ id: data.id, secreto: data.secreto, nombre: nombre || 'Fichador del local' });
  // En la compu, la sesión de la admin no queda abierta. En el celular del local, que ya usa la cuenta
  // de admin para la app, se puede dejar (y así se registran caras sin código).
  if (!mantener) {
    await supabase!.auth.signOut();
    DATOS_DE_SESION.forEach((k) => localStorage.removeItem(k));
  }
  location.reload();
});

// ---------- Registrar cara ----------
$('[data-abrir-registro]').addEventListener('click', async () => {
  if (!disp) return;
  // Si justo estaba fichando a alguien, primero termina eso.
  while (ocupado) await new Promise((ok) => setTimeout(ok, 100));
  validas = [];
  void iniciarRegistro(disp, () => {
    mostrarCapa(null);
    // Quien se acaba de registrar sigue adelante de la cámara: que no quede fichada sin querer.
    validas = [];
    pausaHasta = Date.now() + 10000;
    void refrescarEstado();
  });
});

// ---------- Pantalla completa y pantalla siempre prendida ----------
// En el iPhone no existe la pantalla completa: ahí el botón no se muestra.
if (!document.documentElement.requestFullscreen) $('[data-pantalla-completa]').classList.add('hidden');
$('[data-pantalla-completa]').addEventListener('click', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => {});
});
async function mantenerPrendida() {
  try {
    await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<unknown> } }).wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void mantenerPrendida());

// ---------- Arranque ----------
function problema(titulo: string, texto: string) {
  $('[data-problema-titulo]').textContent = titulo;
  $('[data-problema-texto]').textContent = texto;
  mostrarCapa('problema');
}
$('[data-problema-reintentar]').addEventListener('click', () => location.reload());

async function prenderCamara() {
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
  video.srcObject = s;
  await video.play();
}

async function arrancar() {
  if (!supabase) return problema('Falta configurar la base', 'La app no tiene cargado el proyecto de Supabase.');
  if (!disp) return mostrarActivar();
  void refrescarEstado();
  void mantenerPrendida();
  try {
    await prenderCamara();
  } catch (e) {
    const nombre = (e as DOMException).name;
    return problema(
      nombre === 'NotAllowedError' ? 'Falta el permiso de la cámara' : 'No encontramos la cámara',
      nombre === 'NotAllowedError'
        ? 'Tocá el candado al lado de la dirección, permití la cámara y tocá Reintentar.'
        : 'Conectá una webcam (o revisá que ninguna otra app la esté usando) y tocá Reintentar.',
    );
  }
  mensaje('Preparando el reconocimiento…');
  try {
    await cargarCaras();
  } catch {
    return problema('No se pudo preparar el reconocimiento', 'La primera vez hace falta internet para bajarlo (unos 8 MB). Revisá la conexión y tocá Reintentar.');
  }
  $('[data-tapa]').classList.add('hidden');
  mensaje(MENSAJES.nadie);
  void ciclo();
}

void arrancar();

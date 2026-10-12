// Sonido de los videos de la intranet (portada y bloques de Bienvenida): por defecto, siempre con sonido.
// Los navegadores no dejan arrancar con sonido si la persona todavía no tocó la página: en ese caso el
// video arranca en silencio y el sonido se prende solo con el primer toque o tecla en cualquier lado.
// Si alguien lo silencia, queda guardado para todos los videos.

const CLAVE = 'lola-video-sonido:v1';
const enMarcha = new Set<HTMLVideoElement>();
let esperandoToque = false;
let prendidoEl = 0;
// Eventos que el navegador acepta como "la persona tocó la página" (en el celular cuenta al levantar el dedo).
const EVENTOS = ['mousedown', 'pointerup', 'touchend', 'keydown'];

/** true si el sonido se acaba de prender con un toque (para que ese mismo toque no pause el video). */
export const recienPrendido = () => Date.now() - prendidoEl < 700;

export const quiereSonido = () => localStorage.getItem(CLAVE) !== 'no';
export const guardarSonido = (si: boolean) => localStorage.setItem(CLAVE, si ? 'si' : 'no');

const alPrimerToque = (e: Event) => {
  // El botón de sonido ya maneja su propio clic.
  if ((e.target as Element | null)?.closest?.('[data-video-sonido]')) return;
  // Si el navegador todavía no lo toma como toque (por ejemplo, al terminar de scrollear), seguimos esperando.
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  esperandoToque = false;
  EVENTOS.forEach((ev) => document.removeEventListener(ev, alPrimerToque, true));
  if (!quiereSonido()) return;
  enMarcha.forEach((v) => {
    if (!v.paused && !v.ended && v.muted) {
      v.muted = false;
      prendidoEl = Date.now();
    }
  });
};

const esperarToque = () => {
  if (esperandoToque) return;
  esperandoToque = true;
  EVENTOS.forEach((ev) => document.addEventListener(ev, alPrimerToque, true));
};

/** Reproduce con sonido si se puede; si el navegador no lo deja todavía, en silencio hasta el primer toque. */
export const reproducir = (video: HTMLVideoElement) => {
  if (!enMarcha.has(video)) {
    enMarcha.add(video);
    video.addEventListener('volumechange', () => {
      // Si quedó con sonido, ya no hace falta esperar el toque.
      if (!video.muted && esperandoToque) {
        esperandoToque = false;
        EVENTOS.forEach((ev) => document.removeEventListener(ev, alPrimerToque, true));
      }
    });
  }
  const conSonido = quiereSonido();
  video.muted = !conSonido;
  return video.play().catch(() => {
    if (!conSonido) return;
    video.muted = true;
    esperarToque();
    return video.play().catch(() => {});
  });
};

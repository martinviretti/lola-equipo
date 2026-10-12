// Videos de la intranet (portada y bloques de Bienvenida): siempre con sonido.
// Arrancan cuando la persona toca play, así que el navegador deja reproducir con sonido.

/** Reproduce con sonido; si el navegador igual lo bloquea, en silencio (mejor eso que no verlo). */
export const reproducir = (video: HTMLVideoElement) => {
  video.muted = false;
  return video.play().catch((e: DOMException) => {
    // Solo si el navegador bloqueó el sonido (si se pausó mientras cargaba, no hay que hacer nada).
    if (e.name !== 'NotAllowedError') return;
    video.muted = true;
    return video.play().catch(() => {});
  });
};

// Sonidos cortos, voz y vibración del fichador. No hay archivos de audio: los tonos los arma el
// navegador y la voz es la del sistema (si no tiene una voz en español, no habla).
let audio: AudioContext | null = null;

/** El navegador solo deja sonar después de que alguien tocó la pantalla. */
export function prepararSonido() {
  audio ??= new AudioContext();
  void audio.resume();
}
addEventListener('pointerdown', prepararSonido);

type Sonido = 'ok' | 'error' | 'tic' | 'toma' | 'listo';
const NOTAS: Record<Sonido, number[]> = {
  ok: [660, 880],
  error: [330, 247],
  tic: [1250],
  toma: [880, 1320],
  listo: [660, 880, 1100, 1320],
};

export function sonar(tipo: Sonido) {
  if (!audio || audio.state !== 'running') return;
  const corto = tipo === 'tic';
  NOTAS[tipo].forEach((f, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.frequency.value = f;
    o.type = 'sine';
    const t = audio!.currentTime + i * 0.12;
    const fin = corto ? 0.07 : 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(corto ? 0.12 : 0.25, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + fin);
    o.connect(g).connect(audio!.destination);
    o.start(t);
    o.stop(t + fin + 0.03);
  });
}

/** En los celulares (en las compus no hace nada). */
export const vibrar = (patron: number | number[]) => navigator.vibrate?.(patron);

// ---------- Voz ----------
let voz: SpeechSynthesisVoice | null = null;
function elegirVoz() {
  const voces = speechSynthesis.getVoices();
  voz =
    voces.find((v) => v.lang === 'es-AR') ??
    voces.find((v) => /^es-(419|US|MX|UY|CL|CO)$/.test(v.lang)) ??
    voces.find((v) => v.lang.startsWith('es')) ??
    null;
}
if ('speechSynthesis' in window) {
  elegirVoz();
  speechSynthesis.onvoiceschanged = elegirVoz;
}

/** Dice el texto en voz alta (corta lo que estaba diciendo antes). */
export function hablar(texto: string) {
  if (!('speechSynthesis' in window)) return;
  if (!voz) elegirVoz();
  if (!voz) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.voice = voz;
  u.lang = voz.lang;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

export const callar = () => 'speechSynthesis' in window && speechSynthesis.cancel();

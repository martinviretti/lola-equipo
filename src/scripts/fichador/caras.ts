// Reconocimiento facial en el fichador del local con face-api (corre en el navegador: el video no sale
// del aparato; a la base solo viaja la huella numérica de la cara y una foto chica).
// Se eligió face-api (red de reconocimiento estilo dlib) porque en las pruebas distinguía mejor a
// personas parecidas que el modelo que trae Human.
import { FACEAPI_BASE } from '../../lib/fichador';

/* Lo poco que usamos de face-api (se carga aparte, sin tipos). */
interface Punto {
  x: number;
  y: number;
}
interface Deteccion {
  detection: { score: number; box: { width: number; height: number } };
  landmarks: { positions: Punto[] };
  descriptor: Float32Array;
}
interface FaceApi {
  nets: Record<'tinyFaceDetector' | 'faceLandmark68Net' | 'faceRecognitionNet', { loadFromUri(url: string): Promise<void> }>;
  TinyFaceDetectorOptions: new (o: { inputSize: number; scoreThreshold: number }) => unknown;
  detectAllFaces(input: HTMLVideoElement | HTMLCanvasElement, o: unknown): { withFaceLandmarks(): { withFaceDescriptors(): Promise<Deteccion[]> } };
}

/** Lo que vemos en un cuadro de la cámara. */
export interface Lectura {
  cantidad: number;
  /** Cara lista para reconocer: de buen tamaño, con los ojos abiertos y con huella. */
  valida: boolean;
  /** Si no es válida, qué le falta (para guiar a la persona). */
  falta: 'nadie' | 'varias' | 'lejos' | 'quieta' | null;
  embedding: number[] | null;
  puntaje: number;
  /** Apertura de los ojos (abiertos ≈ 0,3; cerrados < 0,2): sirve para ver un parpadeo. */
  ojos: number;
  /** Cuánto gira la cabeza (0 = de frente). */
  giro: number;
  lado: number;
}

const CONFIANZA_MIN = 0.5;
const OJOS_CERRADOS = 0.2;

let api: FaceApi | null = null;
let opciones: unknown;

export async function cargarCaras(): Promise<void> {
  if (api) return;
  const f: FaceApi = await import(/* @vite-ignore */ `${FACEAPI_BASE}/face-api.esm.js`);
  const modelos = `${FACEAPI_BASE}/model/`;
  await Promise.all([f.nets.tinyFaceDetector.loadFromUri(modelos), f.nets.faceLandmark68Net.loadFromUri(modelos), f.nets.faceRecognitionNet.loadFromUri(modelos)]);
  opciones = new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
  // La primera pasada tarda (prepara la placa de video): se hace ahora y no con la primera persona.
  const lienzo = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  await f.detectAllFaces(lienzo, opciones).withFaceLandmarks().withFaceDescriptors();
  api = f;
}

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
/** Apertura de un ojo con los 6 puntos de face-api (36-41 un ojo, 42-47 el otro). */
const apertura = (p: Punto[], i: number) => (distancia(p[i + 1], p[i + 5]) + distancia(p[i + 2], p[i + 4])) / (2 * distancia(p[i], p[i + 3]));

/** Analiza el cuadro actual del video. */
export async function leer(video: HTMLVideoElement): Promise<Lectura> {
  const caras = await api!.detectAllFaces(video, opciones).withFaceLandmarks().withFaceDescriptors();
  const base: Lectura = { cantidad: caras.length, valida: false, falta: null, embedding: null, puntaje: 0, ojos: 0, giro: 0, lado: 0 };
  if (!caras.length) return { ...base, falta: 'nadie' };
  if (caras.length > 1) return { ...base, falta: 'varias' };

  const c = caras[0];
  const p = c.landmarks.positions;
  const ojos = (apertura(p, 36) + apertura(p, 42)) / 2;
  const medio = { x: (p[36].x + p[45].x) / 2, y: (p[36].y + p[45].y) / 2 };
  const giro = (p[30].x - medio.x) / Math.max(1, distancia(p[36], p[45]));
  const lado = Math.round(Math.min(c.detection.box.width, c.detection.box.height));
  const lectura = { ...base, puntaje: c.detection.score, ojos, giro, lado, embedding: Array.from(c.descriptor) };

  // El lado corto del video: en el celular parado la imagen es más alta que ancha.
  if (lectura.puntaje < CONFIANZA_MIN || lado < Math.max(110, Math.min(video.videoWidth, video.videoHeight) * 0.2)) return { ...lectura, falta: 'lejos' };
  if (ojos < OJOS_CERRADOS) return { ...lectura, falta: 'quieta' };
  return { ...lectura, valida: true };
}

export const ojosCerrados = (l: Lectura) => l.cantidad === 1 && l.ojos > 0 && l.ojos < OJOS_CERRADOS;

/** Promedio de varias huellas de la misma cara: más estable que una sola. */
export const promedio = (es: number[][]) => es[0].map((_, i) => es.reduce((s, e) => s + e[i], 0) / es.length);

/** La huella redondeada (viaja más liviana y no pierde nada que importe). */
export const huella = (e: number[]) => e.map((x) => Math.round(x * 1e5) / 1e5);

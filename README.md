# Intranet del equipo — La Almacén de Lola

App web instalable (PWA) para el equipo de La Almacén de Lola: Bienvenida (cómo trabajamos en el local),
guía de productos de las 25 góndolas con repaso, buscador, Guardados, examen en 3 niveles con certificado,
fichador de entrada y salida, y panel de admin. Pensada para el celular, con versión en PDF de la guía.

Astro 7 + MDX + Tailwind CSS 4. Salida estática, publicada en **GitHub Pages**:
https://martinviretti.github.io/lola-equipo. Se entra con una cuenta de Google autorizada (Supabase).

## La app en el celular

- **Instalar:** en Android, abrir el link en Chrome y tocar "Instalar" en el inicio (o menú ⋮ → Instalar). En iPhone, abrirlo en Safari → Compartir → Agregar a inicio. Queda el ícono de Lola y se abre a pantalla completa. El paso a paso está en `/instalar`.
- **Sin internet:** después de la primera visita, la guía, el buscador, Guardados y el examen funcionan sin conexión. El PDF y los videos se bajan aparte. Admin, Fichadas, Fichar y Fichador no se bajan de entrada: se guardan la primera vez que se abren. Con señal "colgada", a los 4 segundos se muestra la copia guardada; con la sesión vencida y sin señal no se sale de la app: la sesión se renueva sola cuando vuelve la conexión.
- **Pestañas:** Inicio ("Tu camino" en 3 pasos), Bienvenida, Buscar, Guardados (fichas marcadas con la estrella) y Examinarme. Menú lateral con todas las góndolas.
- **Actualizaciones:** la versión del `sw.js` sale del contenido: si un build cambió algo, la próxima vez que la persona abra la app con internet se baja todo lo nuevo sola (si no cambió nada, no se vuelve a bajar).

Archivos de la app: `public/manifest.webmanifest`, `public/iconos/` (regenerarlos si llega el logo en alta) y `integraciones/service-worker.mjs`.

## Correr en local (PowerShell)

```powershell
cd "C:Usersmartin.virettiproyectos-claudeel-almacen-de-lolamanual"
npm install
npm run dev       # http://localhost:4321
npm run validar   # reglas de la guía y del banco del examen
npm run pdf       # build + genera public/guia-de-productos-lola.pdf (usa Chrome o Edge instalados)
```

El login real solo vuelve a la dirección publicada (Supabase no acepta `localhost`). Para probar en local con
sesión, usar un servidor de prueba con datos inventados (`PUBLIC_SUPABASE_URL_PRUEBA` en `src/lib/supabase-config.ts`).

El PDF se arma desde la página `/guia/imprimir` con todas las góndolas.

## Contenido

- **Guía de productos:** un archivo por góndola en `src/content/guia/NN-slug.mdx`. Reglas de redacción en
  [GUIA-PRODUCTOS.md](GUIA-PRODUCTOS.md) (sin normativa, sin promesas de salud, sin TACC solo con logo oficial).
  El repaso de cada góndola está en `src/data/quiz/NN-slug.json`.
- **Examen:** banco en `src/data/examen/*.json`, niveles en `src/data/niveles.ts`. Reglas para escribir preguntas
  en [EXAMEN-BANCO.md](EXAMEN-BANCO.md) y cómo funciona en [DISENO-EXAMEN.md](DISENO-EXAMEN.md) (3 preguntas clave
  por examen: errar una no aprueba).
- **Bienvenida:** `src/data/bienvenida.ts`.
- **Fichador:** ver [FICHADOR.md](FICHADOR.md).
- Antes de subir cambios de contenido: `npm run validar`.

## Datos y avance

El avance (góndolas, repasos, exámenes, Bienvenida) se guarda en el celular y se sincroniza con Supabase
(proyecto `lola-equipo`) con una cola que funciona sin conexión (`src/scripts/nube.ts`). El esquema y las reglas de
acceso están en `supabase/schema.sql`; los cambios posteriores, en `supabase/actualizar-*.sql`. Solo entran los
mails de la tabla `autorizados`; el panel de admin está en `/admin`.

## Publicar

Se publica sola: cada cambio que llega a la rama `main` de
[martinviretti/lola-equipo](https://github.com/martinviretti/lola-equipo) dispara el workflow
`.github/workflows/pages.yml`, que hace el build y lo sube a GitHub Pages en 1 o 2 minutos.

- Los PDF no se generan en GitHub (necesitan Chrome): se generan en la compu con `npm run pdf` y se suben
  junto con el resto, desde `public/`.
- La app vive en la subcarpeta `/lola-equipo` (`base` en `astro.config.mjs`). Toda dirección interna pasa por
  `url()` de `src/lib/url.ts`: no escribir rutas que empiecen con `/` a mano.
- Antes del build, el workflow corre `npm run validar` (guía y banco del examen): si algo no pasa, no se publica
  y queda la versión anterior. Conviene correrlo también en la compu antes de subir cambios.
- **La guía es abierta; el avance y el panel requieren cuenta.** El login con Google identifica a la persona y
  protege los datos (avance, exámenes, fichadas, panel de admin) con las reglas de Supabase, pero las páginas,
  el PDF y los videos se pueden abrir con solo tener la dirección. No cargar información sensible del local
  (precios de proveedores, datos personales, claves).
- GitHub Pages no aplica `_headers` ni lee un `robots.txt` dentro de `/lola-equipo`, por eso no están en `public/`.
  Lo que frena a los buscadores es el `<meta name="robots" content="noindex">` de cada página (no cubre el PDF
  ni los videos).
- El workflow `mantener-supabase.yml` despierta la base cada 3 días. GitHub lo apaga solo si el repo pasa 60 días
  sin cambios: en ese caso, volver a activarlo desde Actions.

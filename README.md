# Lola · Equipo — guía de productos

App web instalable (PWA) para el equipo de La Almacén de Lola.

## La app en el celular

- **Instalar:** en Android, abrir el link en Chrome y tocar "Instalar la app" en el inicio (o menú ⋮ → Instalar). En iPhone, abrirlo en Safari → Compartir → Agregar a inicio. Queda el ícono de Lola y se abre a pantalla completa.
- **Sin internet:** después de la primera visita, toda la guía, el buscador y el examen funcionan sin conexión. El PDF se baja aparte. Admin, Fichadas, Fichar y Fichador no se bajan de entrada: se guardan la primera vez que se abren. Con señal "colgada", a los 4 segundos se muestra la copia guardada; con el token vencido y sin señal no se sale de la app: la sesión se renueva sola cuando vuelve la conexión.
- **Pestañas:** Inicio, Buscar, Guardados (fichas marcadas con la estrella) y Examinarme (opción múltiple armada sola con la guía: qué producto es, sus propiedades y qué responderle a un cliente). Menú lateral con todas las góndolas.
- **Archivado, sin publicar:** el manual largo (`src/content/modulos`) y los carteles (`src/data/carteles.json`) quedaron en el repo pero ya no tienen páginas. Para volver a publicarlos, recuperar las páginas del historial de git.
- **Lo personal** (fichas guardadas, avance de estudio, góndolas vistas) queda en el celular de cada persona.
- **Actualizaciones:** la versión del `sw.js` sale del contenido: si un build cambió algo, la próxima vez que la persona abra la app con internet se baja todo lo nuevo sola (si no cambió nada, no se vuelve a bajar).

Archivos de la app: `public/manifest.webmanifest`, `public/iconos/` (regenerarlos si llega el logo en alta) y `integraciones/service-worker.mjs`.

Manual de onboarding para empleados nuevos. Web pensada para el celular, con buscador, autoevaluaciones,
progreso de lectura y versión para imprimir o descargar en PDF.

Astro 7 + MDX + Tailwind CSS 4. Salida estática, publicada en **GitHub Pages**:
https://martinviretti.github.io/lola-equipo (pública: entra cualquiera que tenga el link).

## Correr en local (PowerShell)

```powershell
cd "C:\Users\martin.viretti\proyectos-claude\el-almacen-de-lola\manual"
npm install
npm run dev      # http://localhost:4321
```

```powershell
npm run pdf      # build + genera public/guia-de-productos-lola.pdf (usa Chrome o Edge instalados)
```

El PDF se arma desde la página `/imprimir`: portada, índice, todos los módulos, las autoevaluaciones con las
respuestas al final y la planilla de avance para firmar. Desde el celular también se puede imprimir esa página
con "Guardar como PDF".

## Contenido

Cada módulo es un archivo en `src/content/modulos/NN-slug.mdx`. El formato, el tono y las reglas están en
[GUIA-REDACCION.md](GUIA-REDACCION.md). Antes de hacer el build, chequeá los archivos con:

```powershell
node scripts/validar-mdx.mjs
```

Recuadros especiales dentro de los módulos:

| Tipo | Para qué |
|---|---|
| `peligro` | Riesgo para la salud del cliente o error grave |
| `importante` | Clave para atender bien |
| `consejo` | Truco de mostrador |
| `local` | **Lo tiene que completar la encargada** con cómo se hace en el local |
| `verificar` | Dato que hay que confirmar antes de dar por cerrado el manual |

Para ver qué falta completar:

```powershell
Select-String -Path "src\content\modulos\*.mdx" -Pattern 'tipo="local"','tipo="verificar"' | Group-Object Filename | Select-Object Name, Count
```

## Progreso del empleado

Se guarda en el navegador de cada dispositivo (localStorage): módulos leídos y mejor resultado de cada quiz.
No hay base de datos ni cuentas: nada sale del celular. Si cambia de teléfono, empieza de cero. Para un
registro formal está la planilla de avance de la versión impresa.

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

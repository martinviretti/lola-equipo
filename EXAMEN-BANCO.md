# Banco de preguntas del examen — reglas

El examen tiene 3 niveles (ver `DISENO-EXAMEN.md`). Pedido de Martín (2026-10-11): el nivel **Básico tiene que tocar todo lo que se vende en la dietética, sin profundizar**: panes, harinas, frutos secos, tés, yerbas, leches vegetales, yogures, bebidas, etc. Una persona que aprueba el Básico tiene que poder trabajar en el mostrador. Después se va subiendo.

## Un archivo por tema

`src/data/examen/<id>.json`: un arreglo de preguntas de ese tema. Temas (usá exactamente estos `id` y `tema`):

| id | tema (texto exacto) | góndolas de la guía |
|---|---|---|
| conceptos | La dietética y los conceptos básicos | todas: integral, fibra, etiquetas, granel, conservación, "natural" no es inofensivo, no prometer curas, si no sabés preguntá |
| sin-tacc | Celiaquía y sin TACC | 22-sin-tacc |
| alergias | Alergias e intolerancias | todas |
| yerbas | Yerbas y mate | 01-yerbas |
| tes-cafes | Tés y cafés | 03-tes-y-cafes |
| yuyos | Yuyos y hierbas | 02-yuyos-y-hierbas |
| bebidas | Bebidas | 24-bebidas |
| frutos-secos | Frutos secos | 04-frutos-secos |
| semillas | Semillas | 05-semillas |
| desecadas | Frutas desecadas | 06-frutas-desecadas |
| galletitas-chocolates | Galletitas, snacks y chocolates | 12-galletitas-barritas-y-snacks, 13-chocolates-y-cacao |
| harinas | Harinas | 07-harinas |
| cereales | Cereales y arroces | 08-cereales-y-arroces |
| legumbres | Legumbres | 09-legumbres |
| panes-pastas | Panes y pastas | 10-pastas, 11-panes-y-panificados |
| leches | Leches vegetales | 18-leches-vegetales |
| yogures | Yogures, quesos y heladera | 19-yogures-y-heladera |
| endulzantes | Endulzantes | 14-endulzantes |
| aceites | Aceites y untables | 15-aceites-y-untables |
| especias | Especias, condimentos y conservas | 16-especias-y-condimentos, 17-hongos-algas-y-conservas |
| veganos | Vegano y vegetariano | 20-veganos |
| congelados | Congelados y cadena de frío | 21-congelados |
| suplementos | Suplementos | 23-suplementos |
| cosmetica | Cosmética natural | 25-cosmetica-natural |

## Cuántas por tema

- **conceptos, sin-tacc y alergias:** 8 de nivel 1, 5 de nivel 2 y 4 de nivel 3.
- **Todos los demás:** 6 de nivel 1, 4 de nivel 2 y 3 de nivel 3.
- Al menos 1 `unir` por tema.

## Niveles

- **1 Básico.** Lo que hay que saber sí o sí para atender desde el primer día. Qué es cada producto principal de la góndola y para qué lo busca la gente. Los tipos principales: con palo o despalada, 000 o 0000, nuez o almendra, leche de soja o de almendras. Qué tiene cafeína, qué tiene gluten, cómo se guarda. Amplio y simple, nada rebuscado.
- **2 Intermedio.** Diferencias entre tipos, cómo se usa cada cosa, con qué se reemplaza y cómo recomendar según lo que busca el cliente.
- **3 Experto.** Situaciones de mostrador difíciles que combinan conceptos (celíaco y vegano, embarazo, medicación, chicos), propiedades comparadas en grandes rasgos (qué tiene más proteína o más fibra) y precauciones de yuyos y suplementos. **Más difícil no es más largo:** el caso tiene que pedir razonar o combinar dos reglas (celíaca y alérgica a la leche, un bebé con tos y caramelos de miel, el cliente que insiste "eso lo ponen por las dudas", un reclamo). Si se contesta repitiendo una regla del Nivel 1, va al Nivel 1 o 2.

## Formatos (`tipo`)

- **Nivel 1:** mitad `vf` y `opcion`, algunas `situacion`.
- **Nivel 3:** sobre todo `situacion`, pero también `opcion` (propiedades comparadas), algunos `vf` y algún `unir`.
- El banco de cada nivel tiene que alcanzar para la mezcla del sorteo (`mezcla` en `src/data/niveles.ts`): el validador lo controla.

Esquemas JSON (comillas dobles, sin comas finales; las comillas internas van como “ ” o ‘ ’):

- `opcion`: `{"id":"yerbas-1-01","tema":"Yerbas y mate","nivel":1,"tipo":"opcion","pregunta":"¿...?","opciones":["...","...","...","..."],"correcta":0,"explicacion":"...","gondola":"01-yerbas"}`
- `situacion`: igual que `opcion`, con `"tipo":"situacion"`. La pregunta arranca con lo que dice el cliente: `Una clienta te dice: “...” ¿Qué le respondés?`
- `vf`: `{"id":"...","tema":"...","nivel":1,"tipo":"vf","pregunta":"Afirmación en una frase.","correcta":true,"explicacion":"...","gondola":"..."}`. Más o menos la mitad verdaderas.
- `unir`: `{"id":"...","tema":"...","nivel":1,"tipo":"unir","pregunta":"Uní cada ... con ...","pares":[{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."}],"explicacion":"...","gondola":"..."}`. Lleva 4 pares; cada `b` tiene 8 palabras como máximo y corresponde a un solo `a`.
- `id`: `<id del tema>-<nivel>-<número de dos cifras>`. Tiene que ser único. Si una pregunta cambia de idea o de nivel, lleva un `id` nuevo (el avance de las empleadas se guarda por `id`); si solo se mejora la redacción, conserva el suyo.
- `correcta`: índice desde 0. Variá la posición (igual, el examen mezcla las opciones al mostrarlas).
- `gondola`: el nombre del .mdx sin extensión, para repasar. Va siempre, salvo en conceptos y alergias si es general.
- `critica: true`: marca una **pregunta clave** (ver abajo). En las demás preguntas no pongas el campo.

## Preguntas clave (`critica: true`)

Cada examen trae 3, sorteadas entre las de su nivel y las de los anteriores, y **errar una es no aprobar**, aunque la nota pase el 80%. Por eso:

- Solo para la **seguridad real del cliente**: sin TACC (logo, granel, fraccionado), alergias y trazas, y no prometer curas ni indicar cantidades, incluido derivar al médico con embarazo, medicación o bebés.
- **Una sola respuesta posible, sin matices.** Si la correcta se juega en un detalle (el orden de las filas, una palabra), no es clave.
- No son clave: cadena de frío, atragantamiento, cosmética, limpieza, conservación. Son importantes, pero se aprenden practicando.
- Solo en `vf`, `opcion` o `situacion`, nunca en `unir`.
- Entre 8 y unas 20 por nivel en todo el banco. Si se marca de más, la marca deja de separar lo grave.

## Opciones: largo parejo y sin pistas

La persona tiene que elegir por lo que sabe, no por cómo está escrita la opción:

- **Largo parejo.** Las 4 opciones con el largo parecido. La correcta no puede ser casi siempre la más larga (ni casi siempre la más corta): en todo el banco, como mucho 30% de las veces la más larga, y lo ideal ronda el 20 o 25%. Nunca más de 1,4 veces el largo promedio de las otras.
- **Misma forma.** Si las otras arrancan con "Le decís...", la correcta también. Todo en voseo: "leés con él", "mirás la etiqueta con ella", "leamos juntas". Nunca "leen", "miren" o "lean" (es de ustedes y delata la respuesta).
- **Las palabras seguras no van solo en la correcta.** "Médico", "etiqueta" o "logo" también aparecen en distractores que derivan mal ("Preguntale al médico, pero un vasito no te hace nada"). Y que no siempre la correcta sea la que no empieza con "Sí".
- **Distractores creíbles:** errores reales de clientes o de una empleada nueva ("el tostado ya no da alergia", "si es vegano no tiene leche"). Nada que se descarte sin saber (tres opciones de miel para una vegana, "en el freezer" para una leche abierta).
- En `vf`, que las verdaderas no sean siempre las más largas ni las que dicen "conviene" o "hay que".

## Sin repetir

- Un mismo dato no se pregunta dos veces con otras palabras, ni en otro tema ni en otro nivel. Si el Nivel 1 ya lo pregunta, el Nivel 3 lo usa dentro de un caso más difícil, no lo repite.
- El validador compara cada pregunta con todo el banco (sin tildes ni palabras vacías) y corta si dos se parecen demasiado.

## Calidad

- Todo tiene que coincidir con la guía (`src/content/guia/*.mdx`). Usá sus secciones "Lo básico", las claves del frontmatter y "Lo que más te van a preguntar".
- Criterios del local, no negociables:
  - Para un celíaco solo sirve lo envasado con el logo oficial sin TACC. Nada del granel ni de lo fraccionado. Nunca "no tiene gluten" a secas en una respuesta: siempre con lo del logo.
  - Nunca se promete que algo cura, adelgaza o sirve para una enfermedad. Nada de "diurético", "depurativo" ni usos atados a una dolencia. No todas las hierbas son "para la noche": el sen y la cáscara sagrada son laxantes, y la yerba, el té y el guaraná tienen cafeína.
  - Con una alergia no se nombran productos "seguros": se lee la etiqueta con el cliente y, ante la duda, que lo consulte con su médico.
  - Embarazo, medicación y chicos se derivan al médico.
  - Si no sabés, le preguntás a la encargada.
  - No se nombran leyes ni organismos.
- Español rioplatense, con voseo y natural, como lo preguntaría una encargada con experiencia. Frases cortas, sin guiones largos.
- Las opciones son 4 creíbles, de largo parecido y del mismo estilo (ver arriba). Nada de "todas o ninguna de las anteriores". Una sola respuesta claramente correcta: si otra opción también se puede defender, se ajusta el enunciado.
- Sin detalles rebuscados: ni orígenes geográficos, ni porcentajes, ni nombres químicos, ni marcas. Los números van solo si son muy básicos y están en la guía.
- `explicacion`: 1 o 2 frases que enseñan el porqué, sin contradecir el enunciado.

## Validar

Desde la carpeta del proyecto:

```powershell
node scripts/validar-examen.mjs
node scripts/validar-examen.mjs aceites alergias   # solo esos temas
```

Controla el formato de cada pregunta, los mínimos por tema y nivel, los guiones largos, las formas de "ustedes" y las promesas de salud, y además:

- que la correcta no sea la más larga en más del 30% del banco ni en más del 40% de cada archivo y nivel, y que nunca pase 1,4 veces el largo promedio de las otras (avisa también si casi nunca es la más larga o la más corta);
- que no haya preguntas casi iguales en todo el banco (corta desde 0,5 de parecido y avisa desde 0,4);
- que cada nivel tenga al menos 8 preguntas clave en `vf`, `opcion` o `situacion`;
- que cada nivel tenga suficientes preguntas de cada formato para la mezcla de `src/data/niveles.ts`.

Sin argumentos, todo eso corta con error. Con temas, los chequeos de todo el banco se muestran, pero solo cortan los de esos archivos y sus duplicados.

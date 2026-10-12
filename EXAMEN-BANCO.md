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
- **3 Experto.** Situaciones de mostrador difíciles que combinan conceptos (celíaco y vegano, embarazo, medicación, chicos), propiedades comparadas en grandes rasgos (qué tiene más proteína o más fibra) y precauciones de yuyos y suplementos.

## Formatos (`tipo`)

- **Nivel 1:** mitad `vf` y `opcion`, algunas `situacion`.
- **Nivel 3:** sobre todo `situacion`.

Esquemas JSON (comillas dobles, sin comas finales; las comillas internas van como “ ” o ‘ ’):

- `opcion`: `{"id":"yerbas-1-01","tema":"Yerbas y mate","nivel":1,"tipo":"opcion","pregunta":"¿...?","opciones":["...","...","...","..."],"correcta":0,"explicacion":"...","gondola":"01-yerbas"}`
- `situacion`: igual que `opcion`, con `"tipo":"situacion"`. La pregunta arranca con lo que dice el cliente: `Una clienta te dice: “...” ¿Qué le respondés?`
- `vf`: `{"id":"...","tema":"...","nivel":1,"tipo":"vf","pregunta":"Afirmación en una frase.","correcta":true,"explicacion":"...","gondola":"..."}`. Más o menos la mitad verdaderas.
- `unir`: `{"id":"...","tema":"...","nivel":1,"tipo":"unir","pregunta":"Uní cada ... con ...","pares":[{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."},{"a":"...","b":"..."}],"explicacion":"...","gondola":"..."}`. Lleva 4 pares; cada `b` tiene 8 palabras como máximo y corresponde a un solo `a`.
- `id`: `<id del tema>-<nivel>-<número de dos cifras>`. Tiene que ser único.
- `correcta`: índice desde 0. Variá la posición.
- `gondola`: el nombre del .mdx sin extensión, para repasar. Va siempre, salvo en conceptos y alergias si es general.
- `critica: true`: solo en preguntas de seguridad que no se pueden errar. Por ejemplo: sin TACC y granel, alergias y trazas, no prometer curas, derivar al médico (embarazo, medicación, chicos), miel antes del año, cadena de frío, frutos secos enteros en chicos chicos. Nunca en `unir`. En las demás preguntas no pongas el campo.

## Calidad

- Todo tiene que coincidir con la guía (`src/content/guia/*.mdx`). Usá sus secciones "Lo básico", las claves del frontmatter y "Lo que más te van a preguntar".
- Criterios del local, no negociables:
  - Para un celíaco solo sirve lo envasado con el logo oficial sin TACC. Nada del granel ni de lo fraccionado.
  - Nunca se promete que algo cura, adelgaza o sirve para una enfermedad.
  - Embarazo, medicación y chicos se derivan al médico.
  - Si no sabés, le preguntás a la encargada.
  - No se nombran leyes ni organismos.
- Español rioplatense, con voseo y natural, como lo preguntaría una encargada con experiencia. Frases cortas, sin guiones largos.
- Las opciones son 4 creíbles, de largo parecido y del mismo estilo. Nada de opciones absurdas, ni "todas o ninguna de las anteriores". Una sola respuesta claramente correcta.
- Sin detalles rebuscados: ni orígenes geográficos, ni porcentajes, ni nombres químicos, ni marcas. Los números van solo si son muy básicos y están en la guía.
- `explicacion`: 1 o 2 frases que enseñan el porqué.
- Reaprovechá las preguntas buenas del banco anterior (`src/data/examen.json`), cambiándoles `tema`, `id` y, si hace falta, el `nivel`.

## Validar

Desde la carpeta del proyecto:

```powershell
node scripts/validar-examen.mjs
```

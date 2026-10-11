# Guía de productos y carteles — reglas de redacción

El dueño del proyecto pidió algo **simple y a tierra**: que una empleada nueva sepa qué es cada producto, para qué lo busca la gente y cómo explicarlo. **Nada de leyes, artículos, normas, resoluciones ni siglas de organismos.** Si algo es importante para la seguridad del cliente (sin TACC, alergias), se dice en una frase simple, sin citar normas.

Ya existe un manual largo en `src/content/modulos/` con todo verificado. **Tu primera fuente es ese manual.** Para lo que no esté ahí (tipos de producto, usos en la cocina, sabores, góndolas nuevas), usá conocimiento de producto de dietética argentina que sea seguro y, ante la duda, verificalo con una búsqueda web. Nunca inventes.

**El objetivo central:** que la empleada conozca **todos los tipos** de cada cosa que se vende en una dietética argentina y pueda **responder las preguntas reales de los clientes**: qué tipos de nueces hay, qué leche vegetal conviene para el café, qué diferencia hay entre una harina 000 y una 0000, qué pan es integral de verdad, qué té no tiene cafeína, etc.

## Tono

- Español rioplatense con voseo, como una compañera que te explica en el mostrador. Cálido y claro.
- Frases cortas. Nada de párrafos largos.
- Sin guiones largos ni guiones dentro de las frases.
- Nunca decir que un producto cura, desinflama, adelgaza, baja el azúcar ni que sirve para una enfermedad. Se habla de sabor, uso en la cocina y costumbre ("mucha gente la toma después de comer").

---

## 1. Guía de productos (para la empleada)

Un archivo MDX por categoría en `src/content/guia/NN-slug.mdx`.

```mdx
---
numero: 1
titulo: "Yerbas"
bajada: "Con palo, sin palo, suave, compuesta: cómo ayudar a elegir la yerba de cada uno."
icono: "leaf"
modulo: 9
claves:
  - "El palo suaviza: la yerba con palo es más suave, la despalada es más intensa."
  - "Barbacuá es la yerba secada con humo de leña: tiene gusto ahumado."
  - "Si al cliente la yerba le cae pesada o amarga, ofrecé una suave o con palo."
---

## De un vistazo

| Tipo | Sabor | Para quién |
|---|---|---|
| Con palo | Suave y parejo | El que toma mate todo el día |
| Despalada | Intensa, amarga | El que lo toma fuerte |

## Los productos

### Yerba con palo

- **Qué es:** la yerba común, con hojas y palitos.
- **Cómo es:** sabor suave y parejo, dura más en el mate.
- **Tip de mostrador:** es la que más se vende, la opción segura si no sabe cuál elegir.

### Yerba despalada

- **Qué es:** ...

## Lo que más te van a preguntar

**"¿Cuál es la más suave?"**
La con palo o una suave. Si quiere algo distinto, una compuesta con hierbas.

**"¿Tienen sin TACC?"**
Mostrale las que tienen el logo sin TACC en el paquete.
```

### Reglas

- `claves`: de 3 a 5 frases cortas (máximo 25 palabras cada una). Es lo primero que se lee: lo que hay que saber sí o sí.
- `## De un vistazo`: **una** tabla de 3 columnas como máximo, con los productos principales. Si la categoría no se presta a tabla, omitila.
- `## Los productos`: **un `###` por cada tipo de producto** (no agrupes varios en una sola ficha: "Avellanas", "Pistachos" y "Nuez pecán" van separados), con **3 a 4 viñetas** de este estilo (elegí las que apliquen):
  - **Qué es:** (obligatoria)
  - **Cómo es / Sabor:**
  - **Cómo se usa:** (preparación o uso en la cocina, simple)
  - **La buscan para:** (uso cotidiano, nunca efectos de salud)
  - **Tip de mostrador:** (cómo ofrecerlo, con qué combina, qué preguntar)
  - **Ojo:** (solo si es importante: sin TACC, alergia, cafeína, heladera)
  - Cada viñeta: **máximo 25 palabras**.
- `## Lo que más te van a preguntar`: de **6 a 10** preguntas reales de clientes, en negrita y entre comillas, con la respuesta modelo en 1 o 2 líneas debajo (en la línea siguiente, sin línea en blanco entre pregunta y respuesta; con una línea en blanco entre cada par).
- Extensión total: **entre 700 y 1.800 palabras** por categoría, según cuántos tipos tenga. Las fichas siguen siendo cortas: crece la cantidad de fichas, no el largo de cada una.
- No uses `<Alerta>` ni ningún otro componente. No uses `####`. No uses `<`, `>`, `{` ni `}` en el texto.
- No pongas sección "Para recordar" ni "En el mostrador" ni fuentes.

### Valores

- `icono`: uno de: grains-slash, storefront, leaf, plant, tea-bag, coffee, drop, pepper, grains, bowl-food, cube, nut, sparkle, orange-slice, drop-half, jar-label, bread, cookie, barbell, snowflake, basket, egg-crack, flask, fire, heartbeat.
- `modulo`: el número del módulo largo relacionado.

### Validar

```powershell
node scripts/validar-guia.mjs
```

---

## 2. Carteles para el cliente (para plastificar en cada sector)

Van todos en un único archivo `src/data/carteles.json`: un arreglo de objetos. Cada cartel es **una hoja A4** que se pega en la góndola para que **el cliente** lea mientras elige. Tiene que ser lindo, curioso y fácil: datos copados, como el cartel de un zoológico.

```json
[
  {
    "slug": "yerbas",
    "sector": "Yerbas",
    "titulo": "¿Qué yerba es la tuya?",
    "icono": "leaf",
    "intro": "Una frase que invite a leer.",
    "datos": [
      { "titulo": "El palo suaviza", "texto": "La yerba con palo es más suave y rinde más. La despalada es puro sabor intenso." }
    ],
    "sabias": "Un dato curioso destacado, de 1 o 2 frases.",
    "guiaTitulo": "Elegí según tu gusto",
    "guia": [
      { "nombre": "Suave", "texto": "Para tomar todo el día." }
    ]
  }
]
```

### Reglas

- Le hablás **al cliente** (voseo), no a la empleada.
- `datos`: de 4 a 6, cada `titulo` de 2 a 5 palabras y cada `texto` de **máximo 25 palabras**.
- `sabias`: 1 dato curioso y **verdadero**, máximo 35 palabras.
- `guia`: de 3 a 6 filas para ayudar a elegir (opcional), cada `texto` máximo 12 palabras.
- Total por cartel: **entre 150 y 260 palabras**, para que entre en una hoja A4 con letra grande.
- Nada de promesas de salud, nada de leyes. Datos de origen, sabor, cómo se usa, curiosidades.
- Si el cartel menciona algo para celíacos, solo: "Buscá el logo sin TACC en el envase".
- JSON válido: comillas dobles, sin comas finales. Las comillas dentro de un texto van como comillas tipográficas “ ” o simples ‘ ’.

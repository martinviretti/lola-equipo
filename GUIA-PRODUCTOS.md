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

## 1. Guía de productos (para la empleada) — versión 2, fichas completas

Un archivo MDX por categoría (góndola) en `src/content/guia/NN-slug.mdx`.

**Por qué cambió (pedido de Martín, 2026-10-11):** las fichas eran un mensajito ("Sabor: suave. La buscan para: la noche"). Quedaban flojas. Ahora cada ficha tiene que contar **bien** el producto: qué es, de dónde sale, cómo es, cómo se prepara o usa, por qué lo busca la gente, con qué combina y qué cuidar. **El equilibrio:** ni una Wikipedia ni un mensajito. Una ficha se lee en 30 a 60 segundos y la empleada sale sabiendo explicarle el producto a un cliente.

```mdx
---
numero: 2
titulo: "Yuyos y hierbas"
bajada: "Una frase que se ve en el índice."
icono: "plant"
modulo: 9
claves:
  - "De 3 a 5 frases cortas: lo que hay que saber sí o sí."
---

## Lo básico

Dos a cuatro párrafos cortos (entre 90 y 200 palabras en total) que explican la góndola entera:
qué agrupa, cómo se clasifican los productos, cómo se preparan o usan en general,
cómo se conservan y qué tiene que tener en la cabeza la empleada.

## De un vistazo

| Hierba | Sabor | Cómo la toma la gente |
|---|---|---|
| Manzanilla | Suave, floral | De noche o de sobremesa |

## Los productos

### Manzanilla

Son las flores secas de una planta parecida a una margarita chiquita, y es de las hierbas más antiguas para infusión. Tiene un sabor suave, floral y apenas dulce, sin nada de amargor, por eso la toma casi todo el mundo, incluso quien no está acostumbrado a los yuyos.

Es la infusión clásica de la noche y de la sobremesa, y por tradición se la asocia con la tranquilidad y con la digestión. Se prepara con una cucharadita por taza y agua caliente sin hervir, tapada de 5 a 7 minutos. Combina muy bien con tilo, melisa o un poco de miel.

- **Tip:** si el cliente nunca tomó yuyos, es la puerta de entrada ideal.
- **Ojo:** quien es alérgico a la margarita o al crisantemo puede reaccionar. Embarazadas y personas con medicación, que lo consulten con su médico.

## Lo que más te van a preguntar

**"¿Qué me llevo para tomar a la noche?"**
Manzanilla, tilo o melisa: no tienen cafeína y son suaves.
```

### Reglas

- `claves`: de 3 a 5 frases cortas (máximo 25 palabras cada una).
- `## Lo básico`: **obligatoria**, primera sección. De 2 a 4 párrafos cortos, entre 90 y 200 palabras. Es la "clase" de la góndola: qué hay, cómo se ordena, cómo se prepara o conserva en general. Si ayuda, puede incluir una lista corta.
- `## De un vistazo`: **una** tabla con los productos principales: 3 columnas de datos y **una cuarta y última columna, `Propiedades`, obligatoria** (pedido de Martín, 2026-10-12). En cada celda de Propiedades va lo que aporta ese producto en **8 palabras como máximo** ("Sin cafeína", "Mucha proteína y fibra", "Rica en omega 3", "Sin cafeína; por tradición, digestiva"), sacado de la viñeta **Propiedades** de su ficha: nada que no esté en la ficha. Mismas reglas de salud que en las fichas. En el celular cada fila de la tabla se ve como una tarjeta.
- `## Los productos`: **un `###` por cada tipo de producto** (no agrupes). **Mantené todos los productos que ya existen, con el mismo título del `###`** (las fichas guardadas por las empleadas dependen de ese título). Podés agregar productos que falten y que se vendan habitualmente en una dietética argentina.
- **Cada ficha se lee como una explicación, no como un formulario** (pedido de Martín: "no pongas literal Qué es, Para qué... sino para leerlo bien"). Formato:
  - **De 1 a 3 párrafos cortos de texto corrido** (entre 50 y 140 palabras en total) que cuentan, con naturalidad y en este orden aproximado: qué es y de dónde sale; cómo es (sabor, aroma, textura, en qué se diferencia de sus parecidos); para qué lo busca la gente (para yuyos, tés y suplementos, el uso tradicional contado como costumbre, nunca como efecto prometido); cómo se prepara o se usa en la cocina (cantidad culinaria, tiempo, recetas) y con qué combina. Un dato curioso, si es verdadero y suma, va metido en el texto.
  - **Prohibido arrancar párrafos con etiquetas** tipo "Qué es:", "Sabor:", "Para qué:". Nada de negritas de etiqueta dentro de los párrafos.
  - **Después, las viñetas destacadas, en este orden** (máximo 3):
    - `- **Propiedades:** ...` **obligatoria** (pedido de Martín, 2026-10-11: "propiedades, por ejemplo el trigo sarraceno tiene tantas proteínas, grasas, a diferencia de..., resumido"). Máximo 50 palabras. Qué aporta y en qué se diferencia de sus parecidos:
      - **Alimentos** (harinas, cereales, legumbres, frutos secos, semillas, desecadas, pastas, panes, snacks, chocolates, endulzantes, aceites, leches, yogures, veganos, congelados, sin TACC, bebidas): lo que se destaca, con valores aproximados cada 100 g cuando sirvan ("alrededor de 13 g de proteína cada 100 g, casi el doble que el arroz blanco"), y lo que no tiene (sin gluten, sin lactosa, sin cafeína). Usá tablas de composición confiables (USDA FoodData Central, tablas argentinas) y redondeá: son referencias, el envase manda. Para endulzantes: calorías y poder endulzante. Para aceites: tipo de grasa (omega 3, monoinsaturadas, saturadas).
      - **Yuyos, tés, cafés y especias:** qué contiene (cafeína o no, aceites esenciales, mucílagos, taninos) y **qué propiedades se le atribuyen por tradición**, siempre con "se le atribuyen", "popularmente se la considera" o "la tradición la usa como". Nunca como efecto seguro.
      - **Suplementos:** qué aporta por porción según el envase típico (proteína, vitamina, mineral) y para qué se usa ese nutriente en el cuerpo, en una frase y sin promesas.
      - **Cosmética:** propiedades cosméticas (hidrata, nutre, limpia, suaviza), que son válidas.
    - `- **Tip:** ...` (cómo ofrecerlo, qué preguntarle al cliente).
    - `- **Ojo:** ...` (precauciones reales: embarazo, lactancia, niños, medicación, alergias, cafeína, sin TACC, heladera, confusiones). Obligatorio cuando hay una precaución real.
    - Tip y Ojo: máximo 35 palabras cada uno.
  - Total por ficha: **entre 80 y 220 palabras**.
  - Prohibido igual en Propiedades: "cura", "desinflama", "adelgaza", "baja el azúcar", "desintoxica", "quema grasa", "previene" una enfermedad. Lo que dice la tradición se cuenta como tradición.
- `## Lo que más te van a preguntar`: de **8 a 12** preguntas reales de clientes, en negrita y entre comillas, con la respuesta modelo en 1 a 3 líneas debajo (en la línea siguiente, sin línea en blanco entre pregunta y respuesta; con una línea en blanco entre cada par).
- Extensión total orientativa: **entre 1.500 y 5.500 palabras** por categoría, según cuántos productos tenga.
- No uses `<Alerta>` ni ningún otro componente. No uses `####`. No uses `<`, `>`, `{` ni `}` en el texto.
- No pongas sección "Para recordar" ni "En el mostrador" ni fuentes.
- **Exactitud:** la empleada va a repetir esto a clientes. Si un dato (origen, precaución, interacción) no lo sabés con seguridad, buscalo con WebSearch o sacalo. Nunca inventes.

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

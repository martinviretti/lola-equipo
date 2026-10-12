# Guía de redacción del manual — La Almacén de Lola

Manual de onboarding para empleados nuevos de una dietética/almacén natural en Victoria (San Fernando, Buenos Aires). La rotación es alta y la gente entra **sin saber nada** de dietética. El manual tiene que permitir que alguien lo lea en su primera semana y pueda atender bien, y que sirva de consulta después. Se lee en el celular y también se imprime en PDF.

## Para quién escribís

Una persona de 18 a 40 años, con secundario, sin formación en nutrición, que nunca trabajó en una dietética. Puede estar nerviosa. Necesita entender **qué es cada cosa, para qué la compra la gente, qué le van a preguntar y qué no tiene que decir nunca**.

## Tono

- Español rioplatense, con voseo ("fijate", "preguntale", "vas a ver"). Cálido, directo, como una compañera con experiencia explicando en el mostrador.
- Frases cortas. Párrafos de 2 a 4 líneas como máximo.
- Cada término técnico se explica la primera vez que aparece, en criollo. Ejemplo: "el gluten (una proteína que tienen el trigo, la avena, la cebada y el centeno)".
- Ejemplos concretos de mostrador: qué pregunta el cliente, qué le respondés.
- Nada de relleno, nada de frases tipo "en el mundo de la alimentación saludable".
- No uses guiones largos ni guiones dentro de las frases: reescribí la frase.

## Reglas de contenido (no negociables)

1. **Exactitud.** Es un manual para atender gente con celiaquía, alergias o diabetes: un error puede hacerle daño a alguien. Si un dato es normativo o de salud, verificalo en fuentes oficiales argentinas (argentina.gob.ar/anmat, Código Alimentario Argentino, SENASA, Ministerio de Salud) o en sociedades científicas reconocidas. Podés usar WebSearch y WebFetch. Agregá las fuentes que usaste en el frontmatter `fuentes`.
2. Si no pudiste verificar algo y aun así vale la pena decirlo, encerralo en `<Alerta tipo="verificar">...</Alerta>` para que se revise.
3. **El empleado nunca diagnostica ni receta.** No promete efectos de salud ("cura", "desinflama", "adelgaza", "baja el azúcar", "sirve para tal enfermedad"). Ante una consulta de salud, informa sobre el producto y deriva al médico o nutricionista. Esto tiene que aparecer de forma natural donde corresponda.
4. **No recomiendes marcas.** Hablá de tipos de producto. Podés decir "algunas marcas..." en general.
5. Lo que depende del local (precios, proveedores, procedimientos internos, medios de pago, horarios de entrega, quién es la encargada) **no lo inventes**: dejalo marcado con `<Alerta tipo="local">Completar con la encargada: ...</Alerta>`.
6. Contexto argentino: unidades métricas, nombres locales de los productos (porotos, maní, zapallo, palta, frutilla, durazno, choclo), normativa argentina.
7. Completo pero útil: incluí todo lo que un empleado necesita para atender bien, sin convertirlo en un tratado de nutrición.

## Formato de archivo (MDX)

Un archivo por módulo en `src/content/modulos/NN-slug.mdx` (NN con dos dígitos). Estructura:

```mdx
---
numero: 5
titulo: "Celiaquía y productos sin TACC"
resumen: "Una o dos frases: de qué trata el módulo y por qué importa."
parte: "Lo que tenés que saber"
minutos: 15
icono: "grains-slash"
objetivos:
  - "Explicar qué es la celiaquía en dos frases"
  - "Reconocer el logo oficial sin TACC"
quiz:
  - pregunta: "¿Cuáles son los cereales que forman la sigla TACC?"
    opciones:
      - "Trigo, arroz, cebada y centeno"
      - "Trigo, avena, cebada y centeno"
      - "Trigo, avena, cebada y choclo"
    correcta: 1
    explicacion: "TACC es Trigo, Avena, Cebada y Centeno."
fuentes:
  - titulo: "ANMAT: Alimentos libres de gluten"
    url: "https://www.argentina.gob.ar/anmat/..."
---

## Por qué importa

Texto...

## Sección

### Subsección
```

### Valores permitidos

- `parte`: exactamente uno de `"Empezar"`, `"Lo que tenés que saber"`, `"Los productos"`, `"Atender y trabajar"`, `"Consulta rápida"`.
- `icono`: uno de: hand-waving, storefront, book-open-text, heartbeat, tag, grains-slash, warning-circle, drop, plant, leaf, coffee, tea-bag, nut, grains, bowl-food, drop-half, jar-label, barbell, cookie, snowflake, chat-circle-text, scales, clipboard-text, question, book-bookmark, users-three, cube, flask, bread, egg-crack, orange-slice, pepper, sparkle, shield-check, list-checks, thermometer-cold, calendar-check, basket, fire.
- `quiz`: de 5 a 8 preguntas por módulo (salvo el glosario, que no lleva). 3 o 4 opciones. `correcta` es el índice desde 0. Variá la posición de la respuesta correcta. Las preguntas tienen que ser **situaciones reales de mostrador** cuando se pueda ("Un cliente te pide... ¿qué hacés?"), no solo memoria. La `explicacion` enseña: dice por qué es la correcta.
- Usá comillas dobles en los strings del frontmatter. Si un texto lleva comillas adentro, usá comillas simples tipográficas o reformulá.

### Cuerpo

- **No pongas un título `#` (h1)**: el título sale del frontmatter. Arrancá con `## Por qué importa` (2 a 4 líneas).
- Secciones con `##`, subsecciones con `###`. No uses `####`.
- **Tablas** para comparar (tipos de yerba, leche de almendras vs avena, etc.).
- **Listas** para enumerar. Listas de tareas `- [ ]` para checklists (se imprimen como casillas).
- **Negrita** para lo que no se puede olvidar.
- Un único componente disponible, sin importarlo:

```mdx
<Alerta tipo="peligro">Nunca vendas productos a granel como sin TACC.</Alerta>
```

  Tipos: `peligro` (riesgo para la salud del cliente o error grave), `importante` (clave para atender bien), `consejo` (truco de mostrador), `local` (a completar con la encargada), `verificar` (dato a confirmar). Dentro de `<Alerta>` dejá una línea en blanco después de la etiqueta de apertura y antes de la de cierre si usás listas o varios párrafos. No abuses: 2 a 6 alertas por módulo.

- Cerrá cada módulo con dos secciones fijas:
  - `## En el mostrador`: 3 a 6 situaciones típicas con el formato **Cliente:** "..." / **Vos:** "...".
  - `## Para recordar`: 4 a 7 viñetas con lo esencial.

### Errores de MDX que rompen el build (evitalos)

- No escribas `<` ni `>` sueltos en el texto (escribí "menos de", "más de"). No uses `{` ni `}` en el texto.
- No uses comentarios HTML `<!-- -->`.
- No uses HTML salvo `<Alerta>`.

## Extensión orientativa

- Módulos generales: 1.500 a 2.500 palabras.
- Módulos de productos: 2.000 a 3.500 palabras (son los que más se consultan).
- Glosario y preguntas frecuentes: lo que haga falta.

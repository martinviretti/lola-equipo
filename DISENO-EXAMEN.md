# Diseño de "Examinarme": 3 niveles

Este documento describe lo que hace hoy la app. Los números salen de `src/data/niveles.ts` y la lógica de
`src/pages/examen.astro`; si cambian ahí, actualizalos acá. Las reglas para escribir preguntas están en
`EXAMEN-BANCO.md`.

## 1. Niveles y tarjetas

| | Básico | Intermedio | Experto |
|---|---|---|---|
| Para quién / cuándo | Recién entrada, primera semana | Ya atiende sola, primer mes | Referente, a los tres meses |
| Contenido (`nivel`) | Lo básico de todas las góndolas, sin TACC, alergias, cadena de frío y no prometer curas | Diferencias entre tipos, usos y reemplazos, conservación, clientes celíacos, veganos o que cuidan el azúcar | Comparar productos, precauciones de yuyos y suplementos, casos combinados y cuándo derivar |

Cada tarjeta muestra el nombre, la frase del nivel, la línea "40 preguntas (3 clave) · unos 20 min, sin cronómetro ·
Ideal: tu primera semana" y la lista "Qué incluye". Estados:

- **Sin hacer**: botón "Empezar".
- **No aprobado todavía**: "Tu mejor nota: 72%. Para aprobar necesitás 80% y las preguntas clave bien." y botón
  "Volver a intentar".
- **Aprobado · 87%**: "Aprobado el 12/10/2026. Tu mejor nota: 90%." "Ver certificado" es el botón principal y
  "Hacerlo de nuevo" el secundario.
- **Bloqueado**: sin botón, con un candado y "Se habilita cuando aprobás el nivel Básico." (sin texto atenuado).

Arriba de las tarjetas: la intro ("Cada examen recorre todas las góndolas y no tiene cronómetro"), un recuadro
"Para aprobar" que explica las preguntas clave y "Aprobaste 1 de 3 niveles".

## 2. Números

| | Preguntas | Tiempo estimado | Mínimo para aprobar | vf / opción / situación / unir |
|---|---|---|---|---|
| Básico | 40 | unos 20 min | 32 (80%) | 15 / 16 / 6 / 3 |
| Intermedio | 30 | unos 18 min | 24 (80%) | 6 / 11 / 9 / 4 |
| Experto | 30 | unos 20 min | 24 (80%) | 3 / 8 / 16 / 3 |

- **Un solo umbral, 80%**, para los tres niveles: la dificultad la pone el contenido.
- **Sin cronómetro**: el tiempo es una estimación y en pantalla se dice "sin cronómetro".
- La mezcla de formatos es un objetivo: si el banco no alcanza en un formato, se completa con otro.

## 3. Preguntas clave

- **3 por examen** (constante `CLAVES` en `examen.astro`), siempre incluidas. Se sortean primero, entre las
  preguntas con `critica: true` de ese nivel **y de los anteriores**, nunca de "unir", de temas distintos mientras se
  pueda y priorizando las que no salieron en el intento anterior. Si el banco tiene menos de 3, van las que haya.
- **Fallar una clave = no aprobado**, aunque la nota pase el 80%. La razón: ese error le puede hacer mal a un
  cliente; el resto se corrige practicando.
- En la pregunta se ven con el chip "Pregunta clave". Las otras preguntas `critica: true` que salgan en el sorteo
  general cuentan como una pregunta más (si contaran todas, un examen podría tener muchas más que 3 y el número
  cambiaría de un intento a otro).
- Para el banco: `critica: true` solo en preguntas de seguridad (sin TACC y granel, alergias y trazas, no prometer
  curas, derivar al médico, miel antes del año, cadena de frío). Con unas 10 a 12 por nivel, los intentos seguidos
  no repiten las mismas claves.

## 4. Nota y sorteo

- Todas las preguntas valen 1 punto. "Unir" vale 1 y solo cuenta con todos los pares bien.
- Nota = bien / total, en %, redondeada para abajo. Aprueba si llega al mínimo de la tabla y no falló ninguna clave.
- Orden del sorteo: (1) las claves, (2) al menos una pregunta de cada tema, (3) el resto respetando la mezcla de
  formatos. Dos preguntas casi iguales no van en el mismo examen, y se priorizan las que no salieron la vez
  anterior. El orden de las preguntas se mezcla.
- **Las opciones se mezclan** cada vez que se muestra una pregunta de opción o situación (la letra A a D es la
  posición en pantalla); en "unir" se mezclan las dos columnas. Verdadero o falso queda en ese orden.

## 5. Progresión

El 2 se habilita al aprobar el 1 y el 3 al aprobar el 2. Así "Experto" certifica también lo anterior. Un nivel
aprobado queda aprobado para siempre, aunque después lo rehagas y no apruebes.

## 6. Durante el examen

- Arriba: "Nivel 1 · Básico", "Pregunta 4 de 40", la barra de avance y el botón **"Salir del examen"** (44 px), que
  abre un diálogo propio: "¿Salir del examen? Si salís, perdés lo que respondiste." con "Seguir con el examen"
  (principal) y "Salir".
- Mientras se responde, `<html>` lleva la clase `examen-en-curso`: se ocultan la barra inferior y el botón del menú,
  para no salir sin querer. Se saca en el resultado, en el certificado y al salir.
- El avance se guarda en la pestaña (`sessionStorage`, clave `lola-examen-en-curso:v1`). Si la página se recarga o
  se va a otra pantalla sin querer, al volver a Examinarme sigue donde quedó ("Seguís donde habías quedado...").
  "Salir del examen" lo descarta.
- **Devolución inmediata**, con ícono (check o cruz) además del color, en la opción y en el recuadro:
  "¡Bien!" · "No era esa. La correcta es la B." · "Era verdadero." / "Era falso." · en unir, "Casi: acertaste 3
  de 4. Para que cuente, tienen que estar bien las cuatro." (o "Todavía no: ..."), y abajo la explicación.
- **Uní cada uno**: antes de responder dice "Elegí la pareja de cada uno. Cuenta solo si acertás las cuatro.";
  las respuestas ya elegidas en otro renglón se ven atenuadas con "(ya elegida)"; "Comprobar" es el botón principal
  y queda fijo al pie de la pantalla. Si falta elegir alguno, avisa "Te faltan 2 por elegir.".
- Los enlaces a la guía aparecen recién en el resultado, para no abandonar a mitad de examen.

## 7. Resultado

1. **Sello**: nivel, nota grande y APROBADO, TODAVÍA NO o PRÁCTICA, con una frase:
   - Aprobó: "¡Aprobaste! 35 de 40 bien. Podés ver tu certificado o seguir con el próximo nivel."
   - Le faltaron puntos: "Sacaste 29 de 40: te faltaron 3 para aprobar (necesitás 32). Abajo ves qué repasar.
     Podés intentarlo las veces que quieras."
   - Solo falló una clave: "Sacaste 38 de 40, ¡muy buena nota! Pero no aprobaste porque fallaste una pregunta
     clave." Debajo, un recuadro con cada clave fallada: la pregunta, la respuesta, la explicación, "Por qué
     importa: ..." (según hable de sin TACC, alergias o salud) y "Ver en la guía". Cierra con "Repasala y volvé a
     intentar: es para cuidar al cliente, no un reto."
   - Repaso de errores: "Repaso listo: acertaste 3 de 5. Esto no cambia tu nota."
2. **Acciones**, justo debajo del sello. Aprobó: "Siguiente nivel" (principal; en Experto, "Ver certificado"),
   "Ver certificado", "Repasar mis errores" (si hubo) y "Ver los niveles". No aprobó: "Repasar mis errores"
   (principal), "Volver a intentar" y "Ver los niveles".
3. "Tu mejor nota: 85%. Intentos: 3."
4. **Temas a reforzar**: los 3 temas con peor resultado ("Harinas: 1 de 2 bien") con "Ver en la guía: Harinas".
5. Plegados, con contador: "Tus errores, con la respuesta (6)" (marca las clave) y "Cómo te fue por tema (24)"
   (cuenta "1 de 2 bien" en lugar de porcentajes; en ámbar solo si hubo un error).

**Repasar mis errores**: una ronda con las erradas del último intento, que no cuenta para la nota ni tiene claves.
Si no queda ninguna (por ejemplo, porque cambió el banco), avisa "No hay preguntas para repasar. Hacé otro examen.".

## 8. Certificado

- El nombre viene del login de Google, ya cargado; "Cambiar el nombre" lo edita y lo guarda en el celular. Si no
  hay nombre, lo pide antes.
- Muestra: logo, "La Almacén de Lola", "Intranet del equipo", "Certificado", el nombre, el nivel, la nota, los
  intentos, la fecha de aprobación (en su propio renglón, para que no se corte ni a 360 px) y la **hora actual en
  vivo**, para distinguirlo de una captura vieja. Abajo: "Mostráselo a la encargada en tu celular. Te puede hacer 2
  preguntas en el mostrador para confirmar."
- **Mandar por WhatsApp**: "Ana López aprobó el Nivel 1 Básico del examen de La Almacén de Lola con 87% el
  12/10/2026 a las 15:42 (2 intentos)."
- **No hay código de verificación ni página "Verificar"**: un diseño anterior los proponía, pero no se hicieron.

**Límites**: la nota se calcula en el celular, así que alguien que sepa programar puede cambiarla; no prueba quién
hizo el examen. Los intentos también se guardan en la base, así que al entrar desde otro celular se recupera si
aprobó. Regla de uso: la encargada lo ve en el celular de la empleada (no en una captura) y le hace 2 preguntas en
el mostrador. El certificado ordena y motiva; esa charla no la reemplaza.

## 9. Repaso de cada góndola

Al final de cada góndola (`src/components/QuizGondola.astro`, preguntas en `src/data/quiz/<góndola>.json`):

- 5 preguntas de a una; con 4 bien, la góndola queda **completada**. Las opciones se mezclan y las devoluciones son
  las mismas del examen ("¡Bien!", "No era esa.", "Era verdadero.") con ícono.
- Mientras se responde (y la pestaña Repaso está a la vista), `<html>` lleva la clase `repaso-en-curso`: la página
  de la góndola oculta "Otras góndolas" con eso.
- Resultado. No aprobó: "Te faltó poco" o "Todavía no", y "Hacerlo de nuevo" como botón principal ("Ir a
  <siguiente góndola>" queda secundario). Aprobó: la primera vez, un festejo breve (sin animación si el celular
  pide menos movimiento), "¡Góndola completada!" y "Llevás 7 de 25 góndolas completadas." con su barra; el botón
  principal es "Seguir con <la próxima góndola sin completar>" (o "Ir a Examinarme" si ya están todas) y "Hacerlo
  de nuevo" queda secundario.

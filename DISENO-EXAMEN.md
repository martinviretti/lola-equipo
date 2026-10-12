# Diseño de "Examinarme": 3 niveles

## 1. Niveles y tarjetas

| | Básico | Intermedio | Experto |
|---|---|---|---|
| Para quién / cuándo | Recién entrada, semana 1 | Ya atiende sola, mes 1 | Referente, mes 3 |
| Contenido (`nivel`) | "Lo básico" de las 25 góndolas + reglas de seguridad | Fichas, Tip y preguntas de clientes | Propiedades, Ojo y casos combinados |

**Nivel 1 · Básico**: "Lo mínimo para atender sola sin meter la pata."
- Qué hay en cada góndola y para qué lo busca la gente
- Sin TACC: el logo y la contaminación cruzada
- Alergias: qué preguntar antes de recomendar
- Por qué nunca prometemos curas

**Nivel 2 · Intermedio**: "Conocer los productos y saber recomendar."
- Diferencias entre tipos: harinas, leches, frutos secos, endulzantes
- Cómo se usa cada cosa y con qué se reemplaza
- Los tips de cada ficha
- Clientes celíacos, veganos o que cuidan el azúcar

**Nivel 3 · Experto**: "Responder lo difícil y ser la referencia del local."
- Propiedades: qué aporta cada producto comparado con otro
- Los "Ojo": yuyos, suplementos, cuándo no conviene algo
- Suplementos, algas y hongos, cosmética
- Casos combinados (celíaco y diabético, embarazo, chicos) y cuándo derivar al médico

Cada tarjeta suma la línea "15 preguntas · 8 min · aprobás con 80%" e "Ideal: tu primera semana" (o lo que corresponda al nivel).

## 2. Números

| | Preguntas | Tiempo | Aprueba | vf / opción / situación / unir |
|---|---|---|---|---|
| Básico | 15 | 8 min | 80% (12) | 6 / 6 / 2 / 1 |
| Intermedio | 20 | 12 min | 80% (16) | 4 / 7 / 6 / 3 |
| Experto | 20 | 15 min | 80% (16) | 2 / 5 / 11 / 2 |

- **Un solo umbral, 80%**: se recuerda solo, y la dificultad ya la pone el contenido.
- **Sin cronómetro**: igual no se puede evitar la trampa, y el reloj solo suma nervios.
- **3 críticas por examen, siempre incluidas en el sorteo.** Errar una = no aprobado, aunque saque 95%. Cubren sin TACC, alergias y no prometer curas ni dosis. Se sortean entre las de su nivel y las de los anteriores, y van solo en vf, opción o situación, con una respuesta sin ambigüedad. La razón: ese error daña a un cliente, el resto se corrige practicando.
- **Al banco le hace falta** el campo `critica: true` (8 o más por nivel) y unas 45 preguntas o más por nivel, así cada sorteo usa menos de la mitad.

## 3. Ponderación

Todas las preguntas valen 1 punto. "Unir" vale 1 y solo cuenta con los 4 pares bien, como hoy. No hay peso por tema: el sorteo asegura al menos 1 pregunta por tema. Las críticas no valen más, funcionan como llave. En pantalla: "17 de 20 bien = 85%".

## 4. Progresión

Las 3 tarjetas siempre se ven con su "qué entra". El 2 se habilita al aprobar el 1 y el 3 al aprobar el 2 ("Se habilita cuando aprobás Básico"). Así "Experto" certifica también lo anterior. Un nivel aprobado queda aprobado para siempre.

## 5. Aprender con el examen

- **Devolución inmediata**: después de cada respuesta, la correcta y la explicación. Es lo que más fija.
- **Los enlaces a la guía, recién en el resultado**, para que no abandone a mitad de examen.
- **Reintentos ilimitados, sin espera**: el sorteo prioriza preguntas que no salieron la vez anterior.
- **Sin modo práctica aparte**: el examen ya es práctica. Se suma el botón **"Repasar mis errores"**, una ronda solo con las erradas que no cuenta para la nota.

## 6. Pantallas

**Resultado**: "85%" grande, el sello APROBADO o NO APROBADO y "Necesitabas 80%". Si erró una crítica: "Te equivocaste en una pregunta clave (sin TACC). Esa hay que saberla sí o sí." Debajo, una barra por tema con su %, y "Para repasar", con los errores agrupados por góndola y su enlace a la guía. Después "Tu mejor nota: 85%" y los botones Repasar mis errores · Otro examen · Ver certificado y Siguiente nivel (estos dos, solo si aprobó).

**Inicio**: arriba, "Aprobaste 1 de 3 niveles". Cada tarjeta tiene uno de estos estados: "Sin hacer" · "No aprobado todavía · Mejor nota 72%" · "Aprobado con 87% · 12/10/2026" · "Bloqueado".

## 7. Verificación sin servidor

- La primera vez, la app pide el nombre y lo guarda en el celular.
- **Certificado** por nivel: nombre, nivel, nota, fecha, intentos y un código de 6 caracteres calculado con esos datos. Muestra además la hora en vivo, para distinguirlo de una captura vieja.
- **Compartir por WhatsApp**: "Ana aprobó Nivel 1 Básico con 87% el 12/10/2026. Código 4F7K2Q". La encargada lo junta en un chat o una planilla.
- **Página "Verificar"**: la encargada carga esos datos en su celular y la app le confirma si el código coincide.

**Límites**:
- No prueba quién hizo el examen.
- El código frena una captura editada, no a alguien que sepa programar.
- Si borra los datos del navegador o cambia de celular, pierde el historial.

Regla de uso: la encargada lo ve en el celular de la empleada (no en una captura) y le hace 2 preguntas en el mostrador. El certificado ordena y motiva; esa charla no la reemplaza.

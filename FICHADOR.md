# Fichador del equipo

Entradas y salidas del equipo, fichadas **solo en los aparatos del local**: la compu del local y el celular del local. Los dos funcionan igual.

- **Con la cara**: la persona mira la cámara y en 1 o 2 segundos aparece "¡Hola, Sofi! Entrada 09:52".
- **Con el código del celular propio**: abre **Fichar** en la app (con su cuenta) y le muestra el código a la cámara del local. Vale igual que la cara.

Lo que nadie puede hacer:

- **Fichar desde otro lado.** El celular propio solo muestra el código: el que ficha es el aparato del local, que lo lee con su cámara. No se usa GPS (con un GPS falso o una VPN se engaña).
- **Fichar por otra persona.** Si muestra el código de una compañera y la cámara ve la cara de otra persona registrada, lo rechaza.
- **Fichar con una captura del código.** El código cambia cada 3 segundos, así que una foto o una captura mandada por WhatsApp no sirve.
- **Cambiar la hora.** La hora la pone la base, no el aparato.

Cada fichada guarda una foto chica como prueba.

**Por día, como mucho 2 entradas y 2 salidas** (para el horario cortado). Una quinta fichada en el día se rechaza, y tampoco se puede cargar a mano.

Las admins lo ven todo en la intranet, en **Panel de admin → Fichaje**. El panel tiene dos pestañas, **Aprendizaje** y **Fichaje**, y Fichaje tiene tres partes:

- **Resumen**, para mirar rápido: los números del día, la línea de tiempo de hoy, la planilla de la semana contra la **carga horaria** y el Excel del mes;
- **Día a día**, para gestionar: lo que hay que revisar y cada día persona por persona, para corregir o agregar;
- **Configuración**: cómo funciona, la carga horaria y el horario fijo, los aparatos, las caras y los ajustes.

Cuesta $0 salvo la webcam: todo corre en el plan gratis de Supabase y en GitHub Pages.

---

## Puesta en marcha (una sola vez)

### 1. Actualizar la base

1. Entrá a [supabase.com](https://supabase.com) → proyecto **lola-equipo** → **SQL Editor** → **New query**.
2. Pegá todo `supabase/schema.sql` y tocá **Run**.

Se puede volver a correr sin romper nada. Prende solo las extensiones que necesita (`vector` para comparar caras y `pgcrypto` para los códigos).

### 2. Preparar la compu del local

1. Conectá la webcam (si no tiene) y abrí **Edge o Chrome** en:
   `https://martinviretti.github.io/lola-equipo/fichador`
2. Cuando pregunte por la cámara, tocá **Permitir**.
3. Tocá **Activar con mi cuenta de admin** y entrá con tu Google.
4. Ponele un nombre ("Compu del local") y tocá **Activar esta compu**. Tu sesión se cierra sola: la compu queda solo para fichar.
5. **Instalala como app**, para que abra en pantalla completa y sin barra:
   - en Edge: menú `···` → **Aplicaciones** → **Instalar este sitio como una aplicación**;
   - en Chrome: el ícono de instalar, a la derecha de la barra de direcciones.
6. **Que abra sola al prender la compu**: apretá `Windows + R`, escribí `shell:startup`, Enter, y arrastrá a esa carpeta el acceso directo **Lola · Fichador** del escritorio o del menú Inicio.
7. En Windows, **Configuración → Sistema → Energía**: que la pantalla y la compu **no** se apaguen ni se suspendan.

La primera vez baja el reconocimiento facial (unos 8 MB, desde jsDelivr). Después queda guardado en la compu.

### 2 bis. Preparar el celular del local

1. Abrí **Chrome** en el celular del local (el que ya tiene la cuenta de admin) en:
   `https://martinviretti.github.io/lola-equipo/fichador`
2. Permití la cámara y tocá **Activar con mi cuenta de admin**.
3. Ponele un nombre ("Celular del local") y dejá tildado **Dejar mi sesión abierta en este aparato**: así la app de Lola sigue entrando con esa cuenta y las caras se registran eligiendo a la persona, sin código.
4. Menú `⋮` → **Agregar a la pantalla principal** (o **Instalar app**). Queda el ícono **Fichador**.
5. Para fichar, dejalo parado y apoyado, con la cámara de adelante mirando a la persona, y enchufado. Mientras el fichador está abierto, la pantalla no se apaga.

**Recomendado: que nadie pueda sacar la "llave" de la compu.** La compu guarda un secreto propio para fichar. Alguien que sepa de computación podría copiarlo con las herramientas de desarrollador del navegador (F12) e intentar fichar desde otro lado.

Igual quedaría a la vista: cada fichada registra desde qué conexión de internet llegó y, si no es la del local, aparece en **Para revisar**. Para cerrarlo del todo:

- Que en la compu del local las empleadas usen un **usuario de Windows sin permisos de administrador**.
- Bloqueá F12 en Edge. Se hace una vez, desde **PowerShell como administrador**:
  ```powershell
  New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name DeveloperToolsAvailability -Value 2 -Type DWord
  ```
  Para Chrome es lo mismo, cambiando `Microsoft\Edge` por `Google\Chrome`. Para deshacerlo: `Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name DeveloperToolsAvailability`.
- Si alguna vez sospechás que copiaron el secreto: **Panel de admin → Fichaje → Configuración → Aparatos que fichan → Desactivar** y activalo de nuevo. El secreto viejo deja de servir.

### 3. Registrar la cara de cada una

Siempre en un aparato del local (nunca desde el celular propio), con la persona adelante y buena luz de frente:

- **En el celular del local** (con la sesión de admin abierta): **Registrar cara** → tocá su nombre.
- **En la compu del local**: primero **Panel de admin → Fichaje → Configuración → Caras registradas → Generar código** (6 números, dura 15 minutos). Después **Registrar cara** y escribí el código.

Son 5 tomas guiadas: de frente, girando hacia su izquierda, hacia su derecha, con una sonrisa y de frente otra vez. Las indicaciones se dicen en voz alta, una flecha marca hacia dónde girar y se llena a medida que gira, y cada toma suena, vibra (en el celular) y completa una parte del círculo.

Si la cara se parece mucho a la de otra persona ya registrada, avisa. Si es de verdad otra persona (por ejemplo, un familiar), tocá **Es otra persona: registrar igual**.

### 4. Probar y ajustar (10 minutos)

Abrí `https://martinviretti.github.io/lola-equipo/fichador?calibrar`. Abajo a la derecha aparecen los números: tamaño de la cara, ojos, giro y el **parecido** de cada intento.

- Que cada una fiche dos o tres veces. El parecido con su propia cara debería dar **más de 0,5**.
- **Si a alguien le cuesta**: volvé a registrar su cara con mejor luz. Si sigue costando, en **Ajustes** poné la exigencia en "Suave".
- **Si confunde a dos personas** (le dice "Hola" a la que no es): poné la exigencia en "Estricta".
- **Probá con una foto impresa de una de ellas.** Si la deja fichar, prendé **Pedir un parpadeo**: una foto no parpadea.

---

## Uso de todos los días

- **Llegar e irse**: mirar la cámara. Si es entrada o salida lo decide solo.
- **Si dice "Hola" a la persona equivocada**: tocar **No soy yo** (está 8 segundos) y volver a mirar de frente.
- **Con el código del celular**: menú → **Fichar** → acercar la pantalla a la cámara del local, a un palmo, con el brillo al máximo.
- **Sin internet en el local**: con la cara se guarda y se manda sola cuando vuelve la conexión. Queda marcada "sin internet" para revisar. Con el celular no se puede sin conexión.
- **Fichar dos veces seguidas** (dentro de los 10 minutos de la entrada) cuenta como la misma fichada: no la convierte en salida.
- **Horario cortado**: se puede entrar, salir, volver a entrar y volver a salir. Más de 2 entradas y 2 salidas en el día no se aceptan: el fichador avisa "hoy ya fichaste 4 veces".
- **Cada una ve sus horas** en la app, en **Fichar**: cuánto lleva en la semana y, si tiene carga horaria, cuánto le falta.

## El panel (Panel de admin → Fichaje)

### Resumen
- **Los números de arriba**: cuántas están adentro ahora, cuántas ficharon hoy, cuántas fichadas hay para revisar (tocás y te lleva) y las horas de la semana contra la carga horaria de todas.
- **Hoy**: una línea de tiempo con cada persona, de cuándo a cuándo estuvo. Las que están adentro ahora se ven distinto. Tocás una persona y se abre el detalle del día.
- **Semana**: una planilla con una fila por persona y una columna por día. En cada día, las horas trabajadas. En verde, completo; en ámbar, algo para mirar: falta una fichada, llegó tarde, se fue antes o es un día fuera de su horario. Un puntito marca que hay algo para revisar. Al final, el total contra su carga horaria ("25 h 23 de 30 h · Faltaron 4 h 37"). Tocás un día y te lleva a ese día en **Día a día**.
- **Descargar para Excel**: por mes, en dos versiones: horas por persona (con la carga horaria y las horas esperadas en el mes) y todas las fichadas.

### Día a día
- **Para revisar** (si hay): mirás la foto y tocás **Está bien** o **Anular**. Aparecen las fichadas guardadas sin internet y las que llegaron desde otra conexión que la del local. Si una guardada sin internet no se pudo reconocer, aparece como **"¿Quién es?"** con la foto: elegís la persona y si fue entrada o salida.
- **El día**: elegís el día con las flechas, con los botones de la semana (un puntito marca los días con algo para mirar) o con la fecha. Ves a cada persona con sus entradas y salidas, las horas y las marcas, y también a quién no fichó.
- **Agregar la salida** aparece cuando alguien se olvidó de fichar al irse. **Ver y corregir** abre las fotos y deja corregir una hora, cambiar entrada por salida, anular o agregar una fichada. Nada se borra: queda quién lo cambió y por qué.
- Una salida solo cierra una entrada **del mismo día**: un olvido no desordena los días siguientes.

### Configuración
- **Cómo funciona el fichaje**, en cinco pasos.
- **Carga horaria y horarios**: tocás a cada persona.
  - **Carga horaria**: cuántas horas por semana trabaja. Es flexible: no dice qué días ni a qué hora.
  - **Horario fijo** (opcional): si tiene días y horarios fijos, se marcan las tardanzas. Nunca bloquea: los reemplazos y cambios de turno se fichan igual.
- **Aparatos que fichan** (la compu y el celular del local), **Caras registradas** y **Ajustes del reconocimiento**.

**Altas y bajas**: en **Panel de admin → Aprendizaje → Equipo y accesos**. "Dar de baja" deja a la persona sin acceso y sin poder fichar, pero guarda su historial. Se puede **reactivar**.

## Si algo no anda

- **"Falta el permiso de la cámara"**: tocá el candado al lado de la dirección → Cámara → Permitir → Reintentar.
- **"No encontramos la cámara"**: revisá el cable USB y que ninguna otra app (Zoom, Teams) la esté usando.
- **Cambiaste de compu o de celular, o se rompió**: en **Panel de admin → Fichaje → Configuración → Aparatos que fichan**, tocá **Desactivar** en el viejo y activá el nuevo.
- **Alguien se olvidó de fichar**: en la semana, tocá el día → **Agregar una fichada que faltó**.

## Antes de usarlo con el equipo

- **La dueña tiene que estar de acuerdo.**
- La cara es un dato personal sensible (Ley 25.326). Conviene un **consentimiento por escrito** de cada empleada y que pueda elegir fichar siempre con el celular en vez de con la cara. Que lo confirme quien lleve lo laboral o el contador.
- Lo que se guarda:
  - la **huella** de la cara: 128 números, no una foto, y nadie la puede ver, ni las admins;
  - una foto chica de cada fichada, que **se borra sola a los 90 días**;
  - la hora.

---

## Para mantenerlo (técnico)

- **Páginas**:
  - `src/pages/fichador.astro`: el fichador (compu o celular del local), con el layout `src/layouts/Kiosco.astro` y el manifest `public/manifest-fichador.webmanifest`;
  - `src/pages/fichar.astro`: el código para mostrar desde el celular propio;
  - `src/pages/fichadas.astro`: el panel de Fichaje (Resumen, Día a día y Configuración; las sub-pestañas son `src/components/VistasPanel.astro` y `src/scripts/vistas.ts`).
- **Lógica del fichador** (`src/scripts/fichador/`):
  - `kiosco.ts`: ciclo de la cámara, QR y pantallas;
  - `caras.ts`: face-api;
  - `registrar.ts`: registro de caras (círculo por partes, flechas, voz);
  - `sonidos.ts`: tonos, voz y vibración;
  - `cola.ts`: fichadas sin internet;
  - `capas.ts`: pantallas encima de la cámara.
- **Comunes**: `src/lib/fichador.ts` (QR con HMAC, fechas, tramos entrada→salida) y `src/lib/csv.ts`.
- **Reconocimiento**: [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) **1.7.15** (MIT), con detector tiny, 68 puntos y red de reconocimiento. Se carga desde jsDelivr con la versión fija: no hay modelos en el repo.
  - Se probó también Human, del mismo autor. Con fotos de muestra confundía a personas parecidas (parecido 0,72 entre dos mujeres distintas), así que se descartó.
- **La base** (`supabase/schema.sql`, sección *Fichador*):
  - la comparación de caras es en el servidor (pgvector, distancia entre huellas), así que la compu nunca baja las caras de nadie;
  - la compu se identifica con un secreto propio (en la base, solo su hash);
  - el QR del celular se firma con HMAC-SHA256 por paso de 3 segundos;
  - todas las escrituras pasan por funciones `security definer`, con RLS en todas las tablas.
- **Probar sin tocar la base real**: `supabase/pruebas/fichador.mjs` tiene 101 pruebas sobre el esquema real, en un Postgres local. Cubren reconocer, el QR, el rechazo de "código de una, cara de otra", entrada y salida del mismo día, sin internet, la conexión del local, los permisos, las bajas y las correcciones. Se corre así:
  ```
  npm i --no-save @electric-sql/pglite @electric-sql/pglite-pgvector
  node supabase/pruebas/fichador.mjs
  ```

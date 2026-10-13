// Pruebas de la intranet (avance, exámenes y admins) sobre el esquema real más supabase/actualizar-intranet-1.sql,
// en un Postgres local (PGlite) con lo mínimo de Supabase simulado (roles anon/authenticated, auth.jwt(),
// permisos por defecto). No toca la base real.
// Correr desde la raíz del repo:
//   npm i --no-save @electric-sql/pglite @electric-sql/pglite-pgvector
//   node supabase/pruebas/intranet.mjs
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';

const ESQUEMA = new URL('../schema.sql', import.meta.url);
const ACTUALIZACION = new URL('../actualizar-intranet-1.sql', import.meta.url);
const db = new PGlite({ extensions: { vector, pgcrypto } });

let fallas = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? 'OK   ' : 'FALLA'} ${texto}`);
  if (!cond) fallas++;
};

// --- Supabase simulado (igual que en fichador.mjs) ---
await db.exec(`
  create schema if not exists auth;
  create schema if not exists extensions;
  create role anon nologin;
  create role authenticated nologin;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  -- Como Supabase: todo lo nuevo en public queda habilitado para anon y authenticated (el esquema tiene que revocar).
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);

const esquema = await readFile(ESQUEMA, 'utf8');
const actualizacion = await readFile(ACTUALIZACION, 'utf8');

const U = {
  martin: ['00000000-0000-0000-0000-000000000001', 'martinviretti@gmail.com'],
  jimena: ['00000000-0000-0000-0000-000000000002', 'jimenasavarro@gmail.com'],
  ana: ['00000000-0000-0000-0000-000000000003', 'ana@gmail.com'],
  sofi: ['00000000-0000-0000-0000-000000000004', 'sofi@gmail.com'],
  nadia: ['00000000-0000-0000-0000-000000000006', 'nadia@gmail.com'],
  intrusa: ['00000000-0000-0000-0000-000000000009', 'intrusa@gmail.com'],
};
const ANA = U.ana[0];
const SOFI = U.sofi[0];

async function como(quien, consulta, params = []) {
  return db.transaction(async (tx) => {
    if (quien === 'anon') {
      await tx.exec(`set local role anon; select set_config('request.jwt.claims', '', true);`);
    } else if (quien !== 'base') {
      const [sub, email] = U[quien];
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, email, role: 'authenticated' })]);
      await tx.exec('set local role authenticated');
    }
    return (await tx.query(consulta, params)).rows;
  });
}
async function falla(quien, consulta, params = []) {
  try {
    await como(quien, consulta, params);
    return null;
  } catch (e) {
    return e.message;
  }
}
const uno = async (quien, consulta, params) => Object.values((await como(quien, consulta, params))[0])[0];
const reglas = async () =>
  Object.fromEntries(
    (await db.query(`select conname, convalidated from pg_constraint where conname in
      ('progreso_gondola_gondola_valida', 'progreso_gondola_numeros', 'intentos_examen_valores',
       'intentos_examen_errores', 'secciones_leidas_seccion_valida', 'autorizados_largos')`)).rows.map((r) => [r.conname, r.convalidated]),
  );

// =====================================================================
// 1. Correr el esquema y la actualización, con datos viejos "sucios"
// =====================================================================
await db.exec(esquema);
await db.exec(`
  insert into auth.users values ${Object.values(U).map(([id, email]) => `('${id}', '${email}')`).join(', ')};
  insert into public.autorizados (email, nombre, rol) values
    ('ana@gmail.com', 'Ana López', 'empleada'), ('sofi@gmail.com', 'Sofía', 'empleada'), ('nadia@gmail.com', null, 'empleada');
  -- Un examen que llegó tres veces por reintentos (mismo instante exacto) y otros que no son copias.
  insert into public.intentos_examen (user_id, nivel, nota, aprobado, preguntas, errores, hecho_el) values
    ('${ANA}', 1, 85, true, 40, '[]', '2026-10-01T10:00:00.123Z'),
    ('${ANA}', 1, 85, true, 40, '[]', '2026-10-01T10:00:00.123Z'),
    ('${ANA}', 1, 85, true, 40, '[]', '2026-10-01T10:00:00.123Z'),
    ('${ANA}', 2, 70, false, 30, '["a-1"]', '2026-10-02T10:00:00Z'),
    ('${SOFI}', 1, 85, true, 40, '[]', '2026-10-01T10:00:00.123Z');
  -- Un dato viejo que no cumple la regla nueva de ids de góndola.
  insert into public.progreso_gondola (user_id, gondola, quiz_intentos, quiz_mejor, quiz_total)
    values ('${ANA}', 'Góndola Vieja', 1, 3, 5);
`);

await db.exec(actualizacion);
await db.exec(actualizacion); // se tiene que poder correr dos veces
ok(true, 'schema.sql + actualizar-intranet-1.sql corren (la actualización, dos veces) sin errores');

ok((await uno('base', `select count(*)::int from public.intentos_examen where user_id = $1 and nivel = 1`, [ANA])) === 1, 'se borraron las copias exactas del examen (quedó 1 de 3)');
ok((await uno('base', `select count(*)::int from public.intentos_examen`)) === 3, 'los exámenes que no eran copias quedaron todos (incluido el de otra persona en el mismo instante)');
ok((await uno('base', `select count(*)::int from public.progreso_gondola where gondola = 'Góndola Vieja'`)) === 1, 'el dato viejo que no cumple la regla no se borró');
let r = await reglas();
ok(Object.keys(r).length === 6, 'están las 6 reglas de límites');
ok(r.progreso_gondola_gondola_valida === false, 'la regla de ids de góndola queda "solo para lo nuevo" porque hay un dato viejo que no la cumple');
ok(r.intentos_examen_valores && r.intentos_examen_errores && r.secciones_leidas_seccion_valida && r.autorizados_largos && r.progreso_gondola_numeros, 'las reglas que los datos viejos cumplen quedan completas');

// Volver a correr schema.sql (como pasa cuando se actualiza el fichador) y después la actualización.
await db.exec(esquema);
await db.exec(actualizacion);
ok(true, 'volver a correr schema.sql y después la actualización anda (el alta de admins del esquema no choca con el control de la última admin)');

await db.exec(`delete from public.progreso_gondola where gondola = 'Góndola Vieja'`);
await db.exec(actualizacion);
r = await reglas();
ok(Object.values(r).every(Boolean), 'sin datos viejos raros, al correrla de nuevo todas las reglas quedan completas');

// =====================================================================
// 2. Exámenes sin repetir
// =====================================================================
// Lo que manda la app: upsert con "ignorar repetidos" sobre (user_id, hecho_el).
const intento = `insert into public.intentos_examen (user_id, nivel, nota, aprobado, preguntas, errores, hecho_el)
  values ($1, 2, 90, true, 30, '["p1","p2"]', $2) on conflict (user_id, hecho_el) do nothing`;
await como('ana', intento, [ANA, '2026-10-13T12:00:00.456Z']);
await como('ana', intento, [ANA, '2026-10-13T12:00:00.456Z']);
ok((await uno('ana', `select count(*)::int from public.intentos_examen where hecho_el = '2026-10-13T12:00:00.456Z'`)) === 1, 'un examen que llega dos veces (reintento) queda guardado una sola vez');
ok((await falla('ana', intento.replace(/ on conflict.*$/, ''), [ANA, '2026-10-13T12:00:00.456Z']))?.includes('duplicate key'), 'sin "ignorar repetidos" la base rechaza la copia: nunca queda dos veces');
await como('ana', intento, [ANA, '2026-10-13T12:00:01.456Z']);
ok((await uno('ana', `select count(*)::int from public.intentos_examen where nivel = 2`)) === 3, 'otro examen, en otro momento, se guarda normal');
ok((await falla('ana', intento, [SOFI, '2026-10-13T12:00:02Z']))?.includes('row-level security'), 'no puede guardar un examen a nombre de otra persona');
ok((await uno('sofi', `select count(*)::int from public.intentos_examen`)) === 1, 'cada empleada ve solo sus exámenes');

// =====================================================================
// 3. registrar_repaso
// =====================================================================
const repaso = (quien, g, bien, total, aprobado, cuando = null, id = null) =>
  como(quien, `select public.registrar_repaso($1, $2, $3, $4, $5, $6)`, [g, bien, total, aprobado, cuando, id]);
const fila = async (uid, g) => (await como('base', `select * from public.progreso_gondola where user_id = $1 and gondola = $2`, [uid, g]))[0];
const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;

// Antes abrió la góndola (lo que manda la app al leerla).
await como('ana', `insert into public.progreso_gondola (user_id, gondola, vista_el) values ($1, '01-yerbas', '2026-10-01T09:00:00Z')
  on conflict (user_id, gondola) do nothing`, [ANA]);
await repaso('ana', '01-yerbas', 3, 5, false, '2026-10-01T10:00:00Z', id(1));
await repaso('ana', '01-yerbas', 5, 5, true, '2026-10-01T10:05:00Z', id(2));
await repaso('ana', '01-yerbas', 4, 5, true, '2026-10-01T10:10:00Z', id(3));
let f = await fila(ANA, '01-yerbas');
ok(f.quiz_intentos === 3 && f.quiz_mejor === 5 && f.quiz_total === 5, 'registrar_repaso suma los intentos (3) y guarda el mejor resultado (5 de 5)');
ok(f.completada_el?.toISOString() === '2026-10-01T10:05:00.000Z', 'la góndola queda completada en el momento del primer repaso aprobado (no se pisa después)');
ok(f.vista_el?.toISOString() === '2026-10-01T09:00:00.000Z', 'no pisa cuándo la abrió por primera vez');
await repaso('ana', '01-yerbas', 4, 5, true, '2026-10-01T10:10:00Z', id(3));
ok((await fila(ANA, '01-yerbas')).quiz_intentos === 3, 'el mismo repaso que llega dos veces (mismo id) se cuenta una sola vez');
await repaso('ana', '01-yerbas', 3, 4, true, '2026-10-01T10:20:00Z', id(4));
f = await fila(ANA, '01-yerbas');
ok(f.quiz_intentos === 4 && f.quiz_mejor === 4 && f.quiz_total === 4, 'si el repaso pasa a tener menos preguntas, el mejor no queda por encima del total');
await repaso('ana', '02-yuyos-y-hierbas', 2, 5, false, '2099-01-01T00:00:00Z');
f = await fila(ANA, '02-yuyos-y-hierbas');
ok(f && f.quiz_intentos === 1 && f.completada_el === null && f.vista_el <= new Date(), 'en una góndola sin abrir crea la fila; una fecha del futuro se toma como "ahora"');
await repaso('ana', '02-yuyos-y-hierbas', 1, 5, false);
ok((await fila(ANA, '02-yuyos-y-hierbas')).quiz_intentos === 2, 'sin id (app vieja) también suma');

// Respeta los permisos
await repaso('sofi', '01-yerbas', 2, 5, false, null, id(5));
ok((await fila(ANA, '01-yerbas')).quiz_intentos === 4 && (await fila(SOFI, '01-yerbas')).quiz_intentos === 1, 'cada una suma en su propia fila: el repaso de Sofía no toca el de Ana');
ok((await uno('sofi', `select count(*)::int from public.progreso_gondola where user_id = $1`, [ANA])) === 0, 'una empleada no ve el avance de otra');
ok((await falla('intrusa', `select public.registrar_repaso('01-yerbas', 1, 5, false)`))?.includes('sin_acceso'), 'una cuenta de Google sin acceso no puede registrar repasos');
ok((await falla('anon', `select public.registrar_repaso('01-yerbas', 1, 5, false)`))?.includes('permission denied'), 'sin sesión no se puede llamar a registrar_repaso');
await como('martin', `update public.autorizados set activo = false where email = 'sofi@gmail.com'`);
ok((await falla('sofi', `select public.registrar_repaso('01-yerbas', 1, 5, false)`))?.includes('sin_acceso'), 'una persona dada de baja no puede registrar repasos');
await como('martin', `update public.autorizados set activo = true where email = 'sofi@gmail.com'`);

// Valores fuera de rango
ok((await falla('ana', `select public.registrar_repaso('01-yerbas', 7, 5, true)`))?.includes('valores_invalidos'), 'registrar_repaso rechaza más respuestas bien que preguntas');
ok((await falla('ana', `select public.registrar_repaso('01-yerbas', 0, 0, false)`))?.includes('valores_invalidos'), 'registrar_repaso rechaza un repaso sin preguntas');
ok((await falla('ana', `select public.registrar_repaso('01-yerbas', 1, 500, false)`))?.includes('valores_invalidos'), 'registrar_repaso rechaza un total absurdo');
ok((await falla('ana', `select public.registrar_repaso('=HYPERLINK("http://x")', 1, 5, false)`))?.includes('gondola_invalida'), 'registrar_repaso rechaza una "góndola" que es una fórmula de Excel');
ok((await falla('ana', `select public.registrar_repaso($1, 1, 5, false)`, ['a'.repeat(81)]))?.includes('gondola_invalida'), 'registrar_repaso rechaza un id de góndola larguísimo');

// =====================================================================
// 4. Límites cuando la empleada escribe directo en las tablas
// =====================================================================
const regla = async (texto, consulta, params = [ANA]) => ok((await falla('ana', consulta, params))?.includes('violates check constraint'), texto);
const insIntento = (campos, valores) => `insert into public.intentos_examen (user_id, hecho_el, ${campos}) values ($1, now(), ${valores})`;
await regla('rechaza una nota de examen de 150', insIntento('nivel, nota, aprobado', '1, 150, true'));
await regla('rechaza una nota negativa', insIntento('nivel, nota, aprobado', '1, -5, false'));
await regla('rechaza un nivel 99', insIntento('nivel, nota, aprobado', '99, 80, true'));
await regla('rechaza una cantidad de preguntas negativa', insIntento('nivel, nota, aprobado, preguntas', '1, 80, true, -1'));
await regla('rechaza "errores" que no son una lista', insIntento('nivel, nota, aprobado, errores', `1, 80, true, '"hola"'`));
await regla('rechaza una lista de errores de 600', insIntento('nivel, nota, aprobado, errores', `1, 80, true, (select jsonb_agg(i) from generate_series(1, 600) i)`));
await regla('rechaza una lista de errores gigante (más de 20 KB)', insIntento('nivel, nota, aprobado, errores', `1, 80, true, (select jsonb_agg(repeat('x', 5000)) from generate_series(1, 10))`));
ok((await falla('ana', insIntento('nivel, nota, aprobado, preguntas, errores', `3, 100, true, 20, '["x-1"]'`), [ANA])) === null, 'un examen normal se guarda');

const insProgreso = (g) => `insert into public.progreso_gondola (user_id, gondola, vista_el) values ($1, '${g}', now()) on conflict (user_id, gondola) do nothing`;
await regla('rechaza una góndola que empieza con "=" (fórmula)', insProgreso('=1+1'));
await regla('rechaza una góndola con espacios y mayúsculas', insProgreso('Góndola Rara'));
await regla('rechaza un id de góndola de más de 80 letras', insProgreso('a'.repeat(81)));
await regla('rechaza un "mejor resultado" mayor que el total', `update public.progreso_gondola set quiz_mejor = 9 where user_id = $1 and gondola = '01-yerbas'`);
await regla('rechaza intentos negativos', `update public.progreso_gondola set quiz_intentos = -1 where user_id = $1 and gondola = '01-yerbas'`);
ok((await falla('ana', insProgreso('25-cosmetica-natural'), [ANA])) === null, 'abrir una góndola normal se guarda');

const insSeccion = (s) => `insert into public.secciones_leidas (user_id, seccion) values ($1, '${s}') on conflict (user_id, seccion) do nothing`;
await regla('rechaza un tema de Bienvenida que es una fórmula', insSeccion('@SUM(1+1)'));
await regla('rechaza un tema de Bienvenida con acentos y mayúsculas', insSeccion('Atención'));
ok((await falla('ana', insSeccion('atencion'), [ANA])) === null, 'leer un tema normal de Bienvenida se guarda');

ok((await falla('martin', `insert into public.autorizados (email, nombre) values ('larga@gmail.com', $1)`, ['N'.repeat(81)]))?.includes('violates check constraint'), 'rechaza un nombre de más de 80 letras al dar acceso');

// registrar_ingreso corta el nombre que manda el celular
ok((await uno('nadia', `select public.registrar_ingreso($1)`, ['  ' + 'N'.repeat(200) + '  '])) === 'empleada', 'registrar_ingreso sigue devolviendo el rol');
ok((await uno('base', `select char_length(nombre) from public.autorizados where email = 'nadia@gmail.com'`)) === 80, 'registrar_ingreso corta el nombre en 80 letras');
ok((await uno('intrusa', `select public.registrar_ingreso('Intrusa')`)) === null, 'registrar_ingreso no deja entrar a quien no está autorizada');

// =====================================================================
// 5. Nunca sin admins
// =====================================================================
const adminsActivas = () => uno('base', `select string_agg(email, ',' order by email) from public.autorizados where rol = 'admin' and activo`);
ok((await adminsActivas()) === 'jimenasavarro@gmail.com,martinviretti@gmail.com', 'arrancan dos admins activas');
ok((await falla('martin', `update public.autorizados set rol = 'empleada' where email = 'jimenasavarro@gmail.com'`)) === null, 'con dos admins, una puede pasar a la otra a empleada');
ok((await falla('martin', `update public.autorizados set rol = 'empleada' where email = 'martinviretti@gmail.com'`))?.includes('ultima_admin'), 'la última admin no puede pasarse a empleada');
ok((await falla('martin', `update public.autorizados set activo = false, baja_el = now() where email = 'martinviretti@gmail.com'`))?.includes('ultima_admin'), 'la última admin no se puede dar de baja');
ok((await falla('base', `delete from public.autorizados where email = 'martinviretti@gmail.com'`))?.includes('ultima_admin'), 'la última admin no se puede borrar, ni desde el SQL Editor');
ok((await falla('martin', `update public.autorizados set rol = 'admin' where email = 'ana@gmail.com'`)) === null, 'se puede hacer admin a otra persona');
ok((await falla('martin', `update public.autorizados set activo = false where email = 'ana@gmail.com'`)) === null, 'con otra admin activa, se puede dar de baja a una admin');
ok((await falla('martin', `update public.autorizados set rol = 'empleada' where email = 'martinviretti@gmail.com'`))?.includes('ultima_admin'), 'una admin dada de baja no cuenta: sigue sin dejar degradar a la última activa');
ok((await falla('martin', `update public.autorizados set activo = true where email = 'ana@gmail.com'`)) === null, 'reactivar a una admin se puede');
ok((await falla('martin', `update public.autorizados set rol = 'empleada' where email = 'martinviretti@gmail.com'`)) === null, 'con otra admin activa, una admin sí puede dejar de serlo');
ok((await adminsActivas()) === 'ana@gmail.com', 'queda Ana como única admin');
ok((await falla('ana', `update public.autorizados set activo = false where email = 'ana@gmail.com'`))?.includes('ultima_admin'), 'Ana, la última, no se puede dar de baja a sí misma');
await como('sofi', `update public.autorizados set rol = 'empleada' where email = 'ana@gmail.com'`);
ok((await adminsActivas()) === 'ana@gmail.com', 'una empleada no puede cambiar roles (como antes)');
ok((await falla('ana', `update public.autorizados set rol = 'admin' where email in ('martinviretti@gmail.com', 'jimenasavarro@gmail.com')`)) === null, 'Ana vuelve a hacer admins a Martín y Jimena');
ok((await falla('martin', `update public.autorizados set rol = 'empleada' where email = 'ana@gmail.com'`)) === null, 'y Ana vuelve a ser empleada');
ok((await falla('base', `update public.autorizados set rol = 'empleada' where rol = 'admin'`))?.includes('ultima_admin'), 'pasar a todas las admins a empleada de una vez tampoco se puede');
ok((await adminsActivas()) === 'jimenasavarro@gmail.com,martinviretti@gmail.com', 'y no cambió nada');

// =====================================================================
// 6. Sin sesión (anon): nada
// =====================================================================
for (const t of ['autorizados', 'progreso_gondola', 'intentos_examen', 'secciones_leidas']) {
  ok((await falla('anon', `select * from public.${t}`))?.includes('permission denied'), `sin sesión no se lee ${t}`);
}
ok((await falla('anon', `insert into public.intentos_examen (user_id, nivel, nota, aprobado) values ($1, 1, 100, true)`, [ANA]))?.includes('permission denied'), 'sin sesión no se escribe en intentos_examen');
for (const fn of [`mi_email()`, `es_admin()`, `registrar_ingreso('x')`, `registrar_repaso('01-yerbas', 1, 5, false)`]) {
  ok((await falla('anon', `select public.${fn}`))?.includes('permission denied'), `sin sesión no se puede llamar a ${fn.split('(')[0]}`);
}
ok((await uno('anon', `select public.es_autorizado()`)) === false, 'es_autorizado sin sesión contesta false (la usa el aviso que mantiene despierta la base)');
ok((await falla('ana', `select public._cuidar_ultima_admin()`))?.includes('permission denied'), 'nadie puede llamar a mano a la función del control de admins');

// =====================================================================
// 7. Orden en las funciones de la intranet
// =====================================================================
const funciones = (
  await db.query(`select p.proname as nombre, p.prosecdef as definer, coalesce(array_to_string(p.proconfig, ','), '') as config,
                         has_function_privilege('anon', p.oid, 'execute') as anon
                    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public'
                     and p.proname in ('mi_email', 'es_autorizado', 'es_admin', 'registrar_ingreso', 'registrar_repaso', '_cuidar_ultima_admin')`)
).rows;
ok(funciones.length === 6, 'están las 6 funciones de la intranet');
ok(funciones.every((x) => x.config.includes('search_path=public')), 'todas tienen la ruta de búsqueda fija');
ok(funciones.filter((x) => x.anon).map((x) => x.nombre).join() === 'es_autorizado', 'sin sesión solo se puede llamar a es_autorizado');
ok(await uno('base', `select has_function_privilege('anon', 'public.estado_fichador(uuid, text)', 'execute')`), 'las funciones del fichador para la compu del local siguen como estaban');
ok(await uno('base', `select has_function_privilege('authenticated', 'public.pedir_codigo_fichaje()', 'execute')`), 'y las del celular de la empleada también');

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo bien');
process.exit(fallas ? 1 : 0);

// Pruebas del fichador sobre el esquema real, en un Postgres local (PGlite) con lo mínimo de Supabase simulado
// (roles anon/authenticated, auth.jwt(), permisos por defecto). No toca la base real.
// Correr desde la raíz del repo:
//   npm i --no-save @electric-sql/pglite @electric-sql/pglite-pgvector
//   node supabase/pruebas/fichador.mjs
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';

const ESQUEMA = new URL('../schema.sql', import.meta.url);
const db = new PGlite({ extensions: { vector, pgcrypto } });

let fallas = 0;
const ok = (cond, texto) => {
  console.log(`${cond ? 'OK   ' : 'FALLA'} ${texto}`);
  if (!cond) fallas++;
};

// --- Supabase simulado ---
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

const sql = await readFile(ESQUEMA, 'utf8');
await db.exec(sql);
await db.exec(sql); // se tiene que poder correr dos veces
ok(true, 'el esquema corre dos veces sin errores');

await db.exec(`
  insert into auth.users values
    ('00000000-0000-0000-0000-000000000001', 'martinviretti@gmail.com'),
    ('00000000-0000-0000-0000-000000000003', 'ana@gmail.com'),
    ('00000000-0000-0000-0000-000000000004', 'sofi@gmail.com');
  insert into public.autorizados (email, nombre, rol) values
    ('ana@gmail.com', 'Ana López', 'empleada'), ('sofi@gmail.com', 'Sofía', 'empleada'), ('lu@gmail.com', 'Lucía', 'empleada');
`);

// --- Ejecutar como un rol ---
const usuarios = { martin: ['00000000-0000-0000-0000-000000000001', 'martinviretti@gmail.com'], ana: ['00000000-0000-0000-0000-000000000003', 'ana@gmail.com'], sofi: ['00000000-0000-0000-0000-000000000004', 'sofi@gmail.com'] };
/** Conexión de internet desde la que "llega" el pedido (Supabase la pasa en x-forwarded-for). */
let IP = null;
async function como(quien, consulta, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.headers', $1, true)`, [IP ? JSON.stringify({ 'x-forwarded-for': `${IP}, 10.0.0.1` }) : '']);
    if (quien === 'anon') {
      await tx.exec(`set local role anon; select set_config('request.jwt.claims', '', true);`);
    } else {
      const [sub, email] = usuarios[quien];
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

// --- Caras sintéticas ---
let semilla = 7;
const azar = () => {
  semilla = (semilla * 16807) % 2147483647;
  return semilla / 2147483647;
};
const normal = () => Math.sqrt(-2 * Math.log(azar() || 1e-9)) * Math.cos(2 * Math.PI * azar());
const base = () => Array.from({ length: 128 }, () => normal() * 0.08);
const toma = (b, ruido = 0.01) => b.map((x) => +(x + normal() * ruido).toFixed(5));
const ANA = base(), SOFI = base(), LU = base(), DESCONOCIDA = base();
const foto = 'data:image/jpeg;base64,' + 'A'.repeat(2000);

// --- Activar la compu ---
ok((await falla('ana', `select public.activar_dispositivo('Compu')`))?.includes('solo_admin'), 'una empleada no puede activar una compu');
ok((await falla('anon', `select public.activar_dispositivo('Compu')`))?.includes('permission denied'), 'sin sesión no se puede activar una compu');
const disp = await uno('martin', `select public.activar_dispositivo('Compu del local')`);
ok(disp.id && disp.secreto?.length === 64, 'la admin activa la compu y recibe el secreto');
const D = [disp.id, disp.secreto];

ok((await falla('anon', `select public.estado_fichador($1, 'otro')`, [disp.id]))?.includes('dispositivo_invalido'), 'con un secreto equivocado no anda');
const est0 = await uno('anon', `select public.estado_fichador($1, $2)`, D);
ok(Array.isArray(est0.hoy) && est0.caras === 0, 'estado del fichador sin caras ni fichadas');

// --- Registrar caras ---
const codAna = await uno('martin', `select public.crear_codigo_cara('ana@gmail.com')`);
ok(/^\d{6}$/.test(codAna), `código de cara de 6 números (${codAna})`);
ok((await falla('sofi', `select public.crear_codigo_cara('ana@gmail.com')`))?.includes('solo_admin'), 'una empleada no puede generar códigos de cara');
ok((await uno('anon', `select public.ver_codigo_cara($1, $2, $3)`, [...D, codAna])).nombre === 'Ana López', 'el código muestra de quién es');
ok((await uno('anon', `select public.ver_codigo_cara($1, $2, '000000')`, D)).estado === 'codigo_invalido', 'código inexistente');
const mezcla = await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, $5)`, [...D, codAna, JSON.stringify([toma(ANA), toma(SOFI), toma(ANA)]), foto]);
ok(mezcla.estado === 'tomas_distintas', 'rechaza tomas de dos personas distintas');
const regAna = await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, $5)`, [...D, codAna, JSON.stringify([toma(ANA), toma(ANA), toma(ANA), toma(ANA)]), foto]);
ok(regAna.estado === 'ok', 'registra la cara de Ana');
ok((await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, $5)`, [...D, codAna, JSON.stringify([toma(ANA), toma(ANA), toma(ANA)]), foto])).estado === 'codigo_invalido', 'el código de cara sirve una sola vez');

const codSofi = await uno('martin', `select public.crear_codigo_cara('sofi@gmail.com')`);
const robo = await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, null)`, [...D, codSofi, JSON.stringify([toma(ANA), toma(ANA), toma(ANA)])]);
ok(robo.estado === 'parecida_a_otra' && robo.otra === 'Ana López', 'no deja registrar la cara de Ana a nombre de Sofía');
ok((await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, null)`, [...D, codSofi, JSON.stringify([toma(SOFI), toma(SOFI), toma(SOFI)])])).estado === 'ok', 'registra la cara de Sofía (el código no se gastó en el intento rechazado)');

// --- Fichar con la cara ---
const f1 = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, $4)`, [...D, JSON.stringify(toma(ANA)), foto]);
ok(f1.estado === 'ok' && f1.tipo === 'entrada' && f1.nombre === 'Ana López', 'Ana ficha la entrada con la cara');
const f2 = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, $4)`, [...D, JSON.stringify(toma(ANA)), foto]);
ok(f2.estado === 'repetida', 'una segunda fichada al toque cuenta como repetida');
await db.exec(`update public.fichadas set hora = hora - interval '5 minutes', registrada_el = registrada_el - interval '5 minutes' where id = ${f1.id}`);
ok((await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(ANA))])).estado === 'repetida', 'una "salida" a los 5 minutos de la entrada cuenta como repetida');

// Horas de ayer (Argentina), mandadas como fichadas guardadas sin internet
const ayer = (hhmm) => {
  const hoy = new Date(Date.now() - 3 * 3600e3);
  const d = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - 1);
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(d + (h + 3) * 3600e3 + m * 60e3).toISOString();
};
const fa = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null, $4)`, [...D, JSON.stringify(toma(ANA)), ayer('09:00')]);
const fb = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null, $4)`, [...D, JSON.stringify(toma(ANA)), ayer('13:00')]);
ok(fa.tipo === 'entrada' && fb.tipo === 'salida', 'ayer a las 09:00 entrada y a las 13:00 salida (mismo día)');
ok((await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(DESCONOCIDA))])).estado === 'desconocida', 'una cara no registrada no ficha');
ok((await db.query(`select count(*)::int as n from public.fotos_fichada`)).rows[0].n === 1, 'se guardó la foto de la fichada');

// Sofía entró ayer a las 18:00 y se olvidó de fichar la salida: hoy su fichada es una entrada, no una salida.
const fs0 = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null, $4)`, [...D, JSON.stringify(toma(SOFI)), ayer('18:00')]);
ok(fs0.tipo === 'entrada', 'Sofía: entrada de ayer a las 18:00');
const f4 = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(SOFI))]);
ok(f4.estado === 'ok' && f4.nombre === 'Sofía' && f4.tipo === 'entrada', 'una entrada de ayer sin salida no convierte la de hoy en salida');
ok((await uno('anon', `select public.deshacer_fichada($1, $2, $3)`, [...D, f4.id])) === true, '"No soy yo" anula la fichada recién hecha');
ok((await uno('anon', `select public.deshacer_fichada($1, $2, $3)`, [...D, f1.id])) === false, '"No soy yo" no anula fichadas viejas');

// Offline: la compu manda la hora de la compu
const hacePoco = new Date(Date.now() - 30 * 60000).toISOString();
const f5 = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null, $4)`, [...D, JSON.stringify(toma(SOFI)), hacePoco]);
const fila5 = (await db.query(`select sin_conexion, revisar, hora from public.fichadas where id = $1`, [f5.id])).rows[0];
ok(f5.estado === 'ok' && fila5.sin_conexion && fila5.revisar?.includes('sin internet') && Math.abs(new Date(fila5.hora) - new Date(hacePoco)) < 1000, 'la fichada guardada sin internet usa la hora de la compu y queda para revisar');

// --- QR del celular ---
ok((await falla('anon', `select public.pedir_codigo_fichaje()`))?.includes('permission denied'), 'sin sesión no se puede pedir el código');
const qr = async (quien) => {
  const c = await uno(quien, `select public.pedir_codigo_fichaje()`);
  const paso = Math.floor(Date.now() / 3000);
  const firma = (p) => createHmac('sha256', Buffer.from(c.clave, 'hex')).update(`${c.id}.${p}`).digest('hex').slice(0, 16);
  return { c, texto: (p = paso) => `LOLA1.${c.id}.${p}.${firma(p)}`, paso };
};
const q = await qr('sofi');
ok(q.c.paso === 3 && q.c.clave.length === 64, 'Sofía pide su código en el celular');
const otra = await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, null)`, [...D, q.texto(), JSON.stringify(toma(ANA))]);
ok(otra.estado === 'cara_de_otra' && otra.nombre === 'Sofía' && otra.otra === 'Ana López', 'el código de Sofía mostrado por Ana se rechaza');
ok((await uno('anon', `select public.fichar_codigo($1, $2, $3, null, null)`, [...D, q.texto()])).estado === 'falta_cara', 'el código solo no alcanza: hace falta una cara');
ok((await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, null)`, [...D, q.texto(q.paso - 5), JSON.stringify(toma(SOFI))])).estado === 'codigo_vencido', 'una captura de hace 15 segundos no sirve');
ok((await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, null)`, [...D, q.texto().slice(0, -1) + (q.texto().endsWith('0') ? '1' : '0'), JSON.stringify(toma(SOFI))])).estado === 'codigo_vencido', 'un código con la firma cambiada no sirve');
await db.exec(`delete from public.fichadas where email = 'sofi@gmail.com'`);
const bien = await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, $5)`, [...D, q.texto(), JSON.stringify(toma(SOFI)), foto]);
const filaBien = (await db.query(`select metodo, revisar from public.fichadas where id = $1`, [bien.id])).rows[0];
ok(bien.estado === 'ok' && filaBien.metodo === 'codigo' && filaBien.revisar === null, 'Sofía ficha con su código y su cara: sin nada para revisar');
ok((await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, null)`, [...D, q.texto(), JSON.stringify(toma(SOFI))])).estado === 'codigo_vencido', 'el código ya usado no sirve de nuevo');
const q2 = await qr('ana');
await db.exec(`update public.fichadas set hora = hora - interval '2 days' where email = 'ana@gmail.com'`);
const sinCara = await uno('anon', `select public.fichar_codigo($1, $2, $3, $4::jsonb, null)`, [...D, q2.texto(), JSON.stringify(toma(DESCONOCIDA))]);
const filaSin = (await db.query(`select revisar, tipo from public.fichadas where id = $1`, [sinCara.id])).rows[0];
ok(sinCara.estado === 'ok' && filaSin.revisar?.includes('mirá la foto') && filaSin.tipo === 'entrada', 'con código y cara no reconocida: ficha pero queda para revisar (y una salida olvidada no la confunde)');

// --- Permisos de lectura ---
ok((await como('sofi', `select email from public.fichadas`)).every((r) => r.email === 'sofi@gmail.com'), 'Sofía solo ve sus fichadas');
ok((await como('sofi', `select * from public.fotos_fichada`)).length === 0, 'Sofía no ve las fotos');
ok((await como('sofi', `select id from public.caras`)).length === 0, 'Sofía no ve las caras');
ok((await falla('martin', `select embedding from public.caras`))?.includes('permission denied'), 'ni la admin puede leer la huella de la cara');
ok((await falla('martin', `select secreto_hash from public.dispositivos`))?.includes('permission denied'), 'ni la admin puede leer el hash del secreto');
ok((await como('martin', `select id, email, foto from public.caras`)).length === 7, 'la admin ve las caras registradas (sin la huella)');
ok((await como('martin', `select id from public.fichadas`)).length >= 4, 'la admin ve todas las fichadas');
ok((await como('martin', `select fichada_id from public.fotos_fichada`)).length >= 1, 'la admin ve las fotos');
for (const t of ['fichadas', 'fotos_fichada', 'caras', 'dispositivos', 'codigos_fichaje', 'codigos_cara', 'ajustes_fichador', 'horarios', 'fichadas_sin_reconocer']) {
  ok((await falla('anon', `select * from public.${t}`))?.includes('permission denied'), `sin sesión no se lee ${t}`);
}
ok((await falla('sofi', `select * from public.codigos_fichaje`))?.includes('permission denied'), 'nadie lee los códigos del celular directo');
ok((await falla('sofi', `insert into public.fichadas (email, tipo, metodo) values ('sofi@gmail.com', 'entrada', 'manual')`))?.includes('permission denied'), 'una empleada no puede cargar fichadas a mano');
ok((await falla('sofi', `select public.fichada_manual('sofi@gmail.com', 'entrada', now(), 'x')`))?.includes('solo_admin'), 'una empleada no puede usar fichada_manual');
ok((await falla('anon', `select public._registrar_fichada('ana@gmail.com', 'cara', null, 1, null, null, null)`))?.includes('permission denied'), 'las funciones internas no se pueden llamar de afuera');
ok((await falla('sofi', `select * from public._reconocer('[1]'::extensions.vector)`)) !== null, 'tampoco _reconocer');

// --- Admin: manual, corregir, anular, revisar, horarios, ajustes, compus ---
const man = await uno('martin', `select public.fichada_manual('lu@gmail.com', 'entrada', now() - interval '1 hour', 'Se olvidó de fichar')`);
const filaMan = (await db.query(`select metodo, creada_por from public.fichadas where id = $1`, [man])).rows[0];
ok(filaMan.metodo === 'manual' && filaMan.creada_por === 'martinviretti@gmail.com', 'la admin carga una fichada a mano y queda quién la cargó');
await como('martin', `select public.corregir_fichada($1, now() - interval '2 hours', 'Llegó antes')`, [man]);
const filaCor = (await db.query(`select hora_original, corregida_por, motivo from public.fichadas where id = $1`, [man])).rows[0];
ok(filaCor.hora_original && filaCor.corregida_por === 'martinviretti@gmail.com' && filaCor.motivo === 'Llegó antes', 'corregir guarda la hora original y quién la cambió');
await como('martin', `select public.anular_fichada($1, 'Error')`, [man]);
const filaAn = (await db.query(`select anulada, anulada_motivo, motivo from public.fichadas where id = $1`, [man])).rows[0];
ok(filaAn.anulada && filaAn.anulada_motivo === 'Error' && filaAn.motivo === 'Llegó antes', 'anular la deja tachada sin borrar el motivo de la corrección');
ok((await falla('sofi', `select public.cambiar_tipo($1, 'x')`, [sinCara.id]))?.includes('solo_admin'), 'una empleada no puede cambiar entrada/salida');
await como('martin', `select public.cambiar_tipo($1, 'Se olvidó la entrada')`, [sinCara.id]);
ok((await db.query(`select tipo, motivo from public.fichadas where id = $1`, [sinCara.id])).rows[0].tipo === 'salida', 'la admin cambia una entrada por salida');
await como('martin', `select public.cambiar_tipo($1, null)`, [sinCara.id]);

// Sin internet y la cara no se reconoce: queda para asignar, no se pierde
const sr = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, $4, $5)`, [...D, JSON.stringify(toma(DESCONOCIDA)), foto, new Date(Date.now() - 3600e3).toISOString()]);
ok(sr.estado === 'guardada_sin_reconocer', 'sin internet y sin reconocer: se guarda para que la admin la asigne');
ok((await falla('sofi', `select id from public.fichadas_sin_reconocer`)) !== null || (await como('sofi', `select id from public.fichadas_sin_reconocer`)).length === 0, 'una empleada no ve las sin reconocer');
const pend = await como('martin', `select id, foto from public.fichadas_sin_reconocer where resuelta_el is null`);
ok(pend.length === 1 && pend[0].foto === foto, 'la admin ve la pendiente con la foto');
const asignada = await uno('martin', `select public.asignar_sin_reconocer($1, 'lu@gmail.com', 'entrada')`, [pend[0].id]);
const filaAsig = (await db.query(`select email, metodo, sin_conexion, creada_por from public.fichadas where id = $1`, [asignada])).rows[0];
ok(filaAsig.email === 'lu@gmail.com' && filaAsig.metodo === 'manual' && filaAsig.creada_por === 'martinviretti@gmail.com', 'asignarla crea la fichada a nombre de quien corresponde');
ok((await falla('martin', `select public.asignar_sin_reconocer($1, 'lu@gmail.com', 'entrada')`, [pend[0].id]))?.includes('ya_resuelta'), 'no se puede asignar dos veces');
ok((await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null, $4)`, [...D, JSON.stringify(toma(ANA)), new Date(Date.now() - 40 * 86400e3).toISOString()])).estado === 'vieja', 'una guardada hace más de 30 días se descarta');

// Parientes que se parecen (madre e hijo): se rechaza, pero la admin puede confirmar que es otra persona
const FAMILIAR = ANA.map((x) => +(x * 0.9 + normal() * 0.08 * 0.4).toFixed(5));
const codFam = await uno('martin', `select public.crear_codigo_cara('lu@gmail.com')`);
const tomasFam = JSON.stringify([toma(FAMILIAR), toma(FAMILIAR), toma(FAMILIAR)]);
const fam1 = await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, null)`, [...D, codFam, tomasFam]);
ok(fam1.estado === 'parecida_a_otra' && fam1.otra === 'Ana López', 'un pariente parecido a Ana: avisa que se parece');
const fam2 = await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, null, true)`, [...D, codFam, tomasFam]);
ok(fam2.estado === 'ok' && fam2.parecida_a === 'Ana López', 'confirmando que es otra persona, se registra igual');
ok((await como('martin', `select distinct parecida_a from public.caras where email = 'lu@gmail.com'`))[0]?.parecida_a === 'Ana López', 'y queda anotado a quién se parecía');

// Conexión de internet: la compu consulta desde el local; si alguien ficha con el secreto desde otro lado, queda para revisar
const codLu = await uno('martin', `select public.crear_codigo_cara('lu@gmail.com')`);
await uno('anon', `select public.registrar_cara($1, $2, $3, $4::jsonb, null)`, [...D, codLu, JSON.stringify([toma(LU), toma(LU), toma(LU)])]);
IP = '200.1.1.1';
await uno('anon', `select public.estado_fichador($1, $2)`, D);
ok((await db.query(`select ultima_ip from public.dispositivos where id = $1`, [disp.id])).rows[0].ultima_ip === '200.1.1.1', 'la compu registra la conexión del local');
await db.exec(`update public.fichadas set hora = hora - interval '3 days' where email = 'lu@gmail.com'`);
const desdeLocal = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(LU))]);
IP = '181.9.9.9';
await db.exec(`update public.fichadas set hora = hora - interval '3 days' where email = 'lu@gmail.com'`);
const desdeAfuera = await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(LU))]);
IP = null;
const r1 = (await db.query(`select revisar, ip from public.fichadas where id = $1`, [desdeLocal.id])).rows[0];
const r2 = (await db.query(`select revisar, ip from public.fichadas where id = $1`, [desdeAfuera.id])).rows[0];
ok(r1.ip === '200.1.1.1' && r1.revisar === null, 'desde la conexión del local: sin nada para revisar');
ok(r2.ip === '181.9.9.9' && r2.revisar?.includes('otra conexión'), 'desde otra conexión: queda para revisar');

// Horario fijo, todo junto
ok((await falla('ana', `select public.guardar_horario('ana@gmail.com', true, '[]'::jsonb)`))?.includes('solo_admin'), 'una empleada no puede guardar horarios');
await como('martin', `select public.guardar_horario('sofi@gmail.com', true, $1::jsonb)`, [JSON.stringify([{ dia: 1, entrada: '14:00', salida: '20:00' }, { dia: 2, entrada: '14:00', salida: '20:00' }])]);
ok((await db.query(`select count(*)::int as n from public.horarios where email = 'sofi@gmail.com'`)).rows[0].n === 2 && (await db.query(`select horario_fijo from public.autorizados where email = 'sofi@gmail.com'`)).rows[0].horario_fijo, 'guardar el horario de Sofía');
ok((await falla('martin', `select public.guardar_horario('sofi@gmail.com', false, '[{"dia": 9, "entrada": "x"}]'::jsonb)`)) !== null && (await db.query(`select count(*)::int as n from public.horarios where email = 'sofi@gmail.com'`)).rows[0].n === 2, 'si el horario nuevo está mal, el anterior queda');
await como('martin', `select public.marcar_revisada($1)`, [sinCara.id]);
ok((await db.query(`select revisada_por from public.fichadas where id = $1`, [sinCara.id])).rows[0].revisada_por === 'martinviretti@gmail.com', 'marcar como revisada');
await como('martin', `insert into public.horarios (email, dia, entrada, salida) values ('ana@gmail.com', 1, '09:00', '14:00')`);
await como('martin', `update public.autorizados set horario_fijo = true where email = 'ana@gmail.com'`);
ok((await como('ana', `select email from public.horarios`)).every((r) => r.email === 'ana@gmail.com') && (await como('sofi', `select email from public.horarios`)).every((r) => r.email === 'sofi@gmail.com'), 'cada una ve solo su horario');
ok((await falla('ana', `insert into public.horarios (email, dia, entrada, salida) values ('ana@gmail.com', 2, '09:00', '14:00')`)) !== null, 'una empleada no puede cambiar su horario');
await como('martin', `update public.ajustes_fichador set similitud_min = 0.6`);
ok((await db.query(`select similitud_min from public.ajustes_fichador`)).rows[0].similitud_min > 0.59, 'la admin cambia la exigencia');
ok((await como('sofi', `update public.ajustes_fichador set similitud_min = 0.1 returning id`)).length === 0, 'una empleada no puede cambiar ajustes');

// Dar de baja
await como('martin', `update public.autorizados set activo = false, baja_el = now() where email = 'ana@gmail.com'`);
ok((await uno('ana', `select public.es_autorizado()`)) === false, 'dada de baja: ya no entra');
ok((await uno('ana', `select public.registrar_ingreso('Ana')`)) === null, 'dada de baja: el login la rechaza');
ok((await uno('anon', `select public.fichar_cara($1, $2, $3::jsonb, null)`, [...D, JSON.stringify(toma(ANA))])).estado === 'desconocida', 'dada de baja: su cara ya no ficha');
ok((await como('martin', `select id from public.fichadas where email = 'ana@gmail.com'`)).length >= 2, 'dada de baja: su historial queda');
await como('martin', `update public.autorizados set activo = true, baja_el = null where email = 'ana@gmail.com'`);

// Desactivar la compu
await como('martin', `update public.dispositivos set activo = false where id = $1`, [disp.id]);
ok((await falla('anon', `select public.estado_fichador($1, $2)`, D))?.includes('dispositivo_invalido'), 'la compu desactivada deja de fichar');
await db.exec(`update public.dispositivos set activo = true`);
const est = await uno('anon', `select public.estado_fichador($1, $2)`, D);
ok(est.caras === 3 && est.hoy.length >= 1 && est.hoy.every((x) => x.tipo && x.hora), `estado del fichador: ${est.caras} caras, ${est.hoy.length} fichadas de hoy`);

// Similitud igual a la de Human
const s = (await db.query(`select public._similitud(0.5) as a, public._similitud(0) as b, public._similitud(1.2) as c`)).rows[0];
ok(Math.abs(s.a - 0.5) < 1e-6 && s.b === 1 && s.c === 0, 'parecido = 1 - distancia (face-api)');
const est2 = await uno('anon', `select public.estado_fichador($1, $2)`, D);
ok(est2.ajustes && est2.ajustes.parpadeo === false, 'el fichador recibe el ajuste de parpadeo');

console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo bien');
process.exit(fallas ? 1 : 0);

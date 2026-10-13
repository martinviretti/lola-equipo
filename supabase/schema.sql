-- =====================================================================
-- Lola · Equipo — base de datos (Supabase / Postgres)
-- Se corre UNA vez en Supabase: SQL Editor → New query → pegar todo → Run.
-- Se puede volver a correr sin romper nada (todo es "if not exists" / "or replace").
-- =====================================================================

-- ---------- Quiénes pueden entrar ----------
-- Solo los mails de esta tabla ven la app. Los admins además ven el avance de todas.
create table if not exists public.autorizados (
  email           text primary key check (email = lower(email)),
  nombre          text,
  rol             text not null default 'empleada' check (rol in ('empleada', 'admin')),
  user_id         uuid unique references auth.users (id) on delete set null,
  agregado_el     timestamptz not null default now(),
  primer_ingreso  timestamptz,
  ultimo_ingreso  timestamptz
);

insert into public.autorizados (email, nombre, rol) values
  ('martinviretti@gmail.com', 'Martín', 'admin'),
  ('jimenasavarro@gmail.com', 'Jimena', 'admin')
on conflict (email) do nothing;  -- si ya están, no se tocan (por si alguna dejó de ser admin a propósito)

-- Dar de baja sin borrar: la persona deja de entrar, pero su historial (avance y fichadas) queda.
alter table public.autorizados add column if not exists activo boolean not null default true;
alter table public.autorizados add column if not exists baja_el timestamptz;
-- Horario fijo opcional (fichador): si está apagado, solo se registran las fichadas.
alter table public.autorizados add column if not exists horario_fijo boolean not null default false;
-- Carga horaria (fichador): cuántas horas por semana trabaja cada persona. Vacío = sin carga cargada.
-- Es flexible: no dice qué días ni a qué hora, solo el total de la semana.
alter table public.autorizados add column if not exists horas_semana numeric(4, 1)
  check (horas_semana is null or (horas_semana > 0 and horas_semana <= 80));

-- ---------- Avance por góndola (lectura y quiz final) ----------
create table if not exists public.progreso_gondola (
  user_id         uuid not null references auth.users (id) on delete cascade,
  gondola         text not null,
  vista_el        timestamptz,
  quiz_intentos   int not null default 0,
  quiz_mejor      int not null default 0,          -- respuestas bien en el mejor intento
  quiz_total      int not null default 0,          -- preguntas del quiz
  completada_el   timestamptz,                     -- primera vez que aprobó el quiz
  actualizado_el  timestamptz not null default now(),
  primary key (user_id, gondola)
);

-- ---------- Intentos del examen general ----------
create table if not exists public.intentos_examen (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nivel       int not null,
  nota        int not null,                        -- porcentaje 0 a 100
  aprobado    boolean not null,
  preguntas   int,
  errores     jsonb not null default '[]',
  hecho_el    timestamptz not null default now()
);
create index if not exists intentos_examen_usuario on public.intentos_examen (user_id, hecho_el desc);

-- ---------- Secciones de Bienvenida leídas ----------
create table if not exists public.secciones_leidas (
  user_id   uuid not null references auth.users (id) on delete cascade,
  seccion   text not null,
  leida_el  timestamptz not null default now(),
  primary key (user_id, seccion)
);

-- ---------- Funciones de permisos ----------
create or replace function public.mi_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.es_autorizado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.autorizados where email = public.mi_email() and activo)
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.autorizados where email = public.mi_email() and rol = 'admin' and activo)
$$;

-- Al entrar a la app: devuelve el rol (o null si el mail no está autorizado) y registra el ingreso.
create or replace function public.registrar_ingreso(p_nombre text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  update public.autorizados
     set user_id        = auth.uid(),
         nombre         = coalesce(nullif(nombre, ''), p_nombre),
         primer_ingreso = coalesce(primer_ingreso, now()),
         ultimo_ingreso = now()
   where email = public.mi_email() and activo
  returning rol into v_rol;
  return v_rol;
end $$;

grant execute on function public.es_autorizado(), public.es_admin(), public.registrar_ingreso(text), public.mi_email() to authenticated;

-- ---------- Seguridad por filas (RLS) ----------
alter table public.autorizados       enable row level security;
alter table public.progreso_gondola  enable row level security;
alter table public.intentos_examen   enable row level security;
alter table public.secciones_leidas  enable row level security;

-- autorizados: cada una ve su fila; los admins ven y manejan todas.
drop policy if exists "ver mi fila o admin" on public.autorizados;
create policy "ver mi fila o admin" on public.autorizados
  for select to authenticated using (email = public.mi_email() or public.es_admin());
drop policy if exists "admin agrega" on public.autorizados;
create policy "admin agrega" on public.autorizados
  for insert to authenticated with check (public.es_admin());
drop policy if exists "admin edita" on public.autorizados;
create policy "admin edita" on public.autorizados
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin borra" on public.autorizados;
create policy "admin borra" on public.autorizados
  for delete to authenticated using (public.es_admin() and email <> public.mi_email());

-- Tablas de avance: cada una lee y escribe lo suyo (si está autorizada); los admins leen todo.
do $$
declare t text;
begin
  foreach t in array array['progreso_gondola', 'intentos_examen', 'secciones_leidas'] loop
    execute format('drop policy if exists "leer propio o admin" on public.%I', t);
    execute format('create policy "leer propio o admin" on public.%I for select to authenticated
                    using ((user_id = auth.uid() and public.es_autorizado()) or public.es_admin())', t);
    execute format('drop policy if exists "escribir propio" on public.%I', t);
    execute format('create policy "escribir propio" on public.%I for insert to authenticated
                    with check (user_id = auth.uid() and public.es_autorizado())', t);
    execute format('drop policy if exists "actualizar propio" on public.%I', t);
    execute format('create policy "actualizar propio" on public.%I for update to authenticated
                    using (user_id = auth.uid() and public.es_autorizado())
                    with check (user_id = auth.uid() and public.es_autorizado())', t);
  end loop;
end $$;

-- Los admins pueden borrar el avance de alguien (por ejemplo, para que empiece de cero).
drop policy if exists "admin borra avance" on public.progreso_gondola;
create policy "admin borra avance" on public.progreso_gondola for delete to authenticated using (public.es_admin());
drop policy if exists "admin borra intentos" on public.intentos_examen;
create policy "admin borra intentos" on public.intentos_examen for delete to authenticated using (public.es_admin());
drop policy if exists "admin borra lecturas" on public.secciones_leidas;
create policy "admin borra lecturas" on public.secciones_leidas for delete to authenticated using (public.es_admin());

grant select, insert, update, delete on public.autorizados, public.progreso_gondola, public.intentos_examen, public.secciones_leidas to authenticated;
revoke all on public.autorizados, public.progreso_gondola, public.intentos_examen, public.secciones_leidas from anon;


-- =====================================================================
-- Fichador: entradas y salidas del equipo
-- Se ficha SOLO en el fichador del local (/fichador, en la compu o en el celular del local): con la
-- cara, o mostrando a la cámara el código QR que da la app en el celular (cambia cada 3 segundos). La hora la pone siempre la base, nunca
-- la compu. La compu no tiene sesión: la activa una admin y queda con un secreto propio.
-- =====================================================================
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Ajustes (una sola fila, se cambian desde el panel de Fichadas) ----------
create table if not exists public.ajustes_fichador (
  id               int primary key default 1 check (id = 1),
  similitud_min    real not null default 0.5,   -- parecido mínimo con la cara registrada (0 a 1 = 1 - distancia; más alto = más estricto)
  margen           real not null default 0.06,  -- ventaja mínima sobre la segunda persona más parecida
  horas_max_turno  int  not null default 16,    -- una entrada sin salida más vieja que esto se toma como olvidada
  tolerancia_min   int  not null default 15,    -- minutos de tolerancia antes de marcar "fuera de horario"
  dias_fotos       int  not null default 90     -- las fotos de las fichadas se borran solas después de esto
);
-- Pedir un parpadeo antes de fichar con la cara (una foto impresa no parpadea). Apagado: más rápido.
alter table public.ajustes_fichador add column if not exists parpadeo boolean not null default false;
insert into public.ajustes_fichador (id) values (1) on conflict (id) do nothing;

-- ---------- Horario fijo por persona (opcional: solo cuenta si autorizados.horario_fijo) ----------
create table if not exists public.horarios (
  email    text not null references public.autorizados (email) on delete cascade,
  dia      smallint not null check (dia between 0 and 6),   -- 0 domingo, 1 lunes … 6 sábado
  entrada  time not null,
  salida   time not null,
  primary key (email, dia)
);

-- ---------- Compus que fichan ----------
create table if not exists public.dispositivos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  secreto_hash  text not null,                  -- sha256 del secreto; el secreto solo lo tiene la compu
  activo        boolean not null default true,
  creado_por    text not null,
  creado_el     timestamptz not null default now(),
  ultimo_uso    timestamptz,
  ultima_ip     text                            -- la conexión de internet desde la que consulta la compu (cada 20 s)
);

-- ---------- Caras registradas (varias tomas por persona) ----------
create table if not exists public.caras (
  id           bigint generated always as identity primary key,
  email        text not null references public.autorizados (email) on delete cascade,
  embedding    extensions.vector(128) not null,    -- huella numérica de la cara (no es una foto)
  foto         text,                               -- miniatura de la toma, para que la admin vea a quién se registró
  creada_el    timestamptz not null default now(),
  dispositivo  uuid references public.dispositivos (id) on delete set null
);
create index if not exists caras_email on public.caras (email);

-- ---------- Fichadas ----------
create table if not exists public.fichadas (
  id             bigint generated always as identity primary key,
  email          text not null references public.autorizados (email),
  tipo           text not null check (tipo in ('entrada', 'salida')),
  hora           timestamptz not null default now(),
  metodo         text not null check (metodo in ('cara', 'codigo', 'manual')),
  dispositivo    uuid references public.dispositivos (id) on delete set null,
  similitud      real,                     -- qué tan parecida a la cara registrada (0 a 1)
  sin_conexion   boolean not null default false,
  hora_pc        timestamptz,              -- hora de la compu, solo si se guardó sin internet
  registrada_el  timestamptz not null default now(),
  revisar        text,                     -- motivo para que la admin la mire (null = todo bien)
  revisada_por   text,
  revisada_el    timestamptz,
  creada_por     text,                     -- admin que la cargó a mano
  nota           text,
  hora_original  timestamptz,              -- si se corrigió la hora, la que tenía antes
  corregida_por  text,
  corregida_el   timestamptz,
  anulada        boolean not null default false,
  anulada_por    text,
  anulada_el     timestamptz,
  anulada_motivo text,
  motivo         text,                     -- por qué se corrigió
  ip             text                      -- conexión de internet desde la que llegó
);
create index if not exists fichadas_email_hora on public.fichadas (email, hora desc);
create index if not exists fichadas_hora on public.fichadas (hora desc);

-- Foto chica de cada fichada, como prueba (se borran solas después de ajustes.dias_fotos).
create table if not exists public.fotos_fichada (
  fichada_id  bigint primary key references public.fichadas (id) on delete cascade,
  foto        text not null,               -- data:image/jpeg;base64,…
  tomada_el   timestamptz not null default now()
);
create index if not exists fotos_fichada_fecha on public.fotos_fichada (tomada_el);

-- Fichadas guardadas sin internet cuya cara no se reconoció al mandarlas: la admin las asigna a mano.
create table if not exists public.fichadas_sin_reconocer (
  id            bigint generated always as identity primary key,
  dispositivo   uuid references public.dispositivos (id) on delete set null,
  hora          timestamptz not null,       -- hora de la compu
  foto          text,
  creada_el     timestamptz not null default now(),
  resuelta_el   timestamptz,
  resuelta_por  text,
  fichada_id    bigint references public.fichadas (id) on delete set null
);

-- Código del celular: el celular recibe una clave y arma un QR nuevo cada 3 segundos con ella.
create table if not exists public.codigos_fichaje (
  id        text primary key,
  email     text not null references public.autorizados (email) on delete cascade,
  clave     text not null,
  vence     timestamptz not null,
  usado_el  timestamptz
);

-- Código de 6 números que genera una admin para registrar la cara de alguien en la compu.
create table if not exists public.codigos_cara (
  codigo      text primary key,
  email       text not null references public.autorizados (email) on delete cascade,
  vence       timestamptz not null,
  creado_por  text not null,
  usado_el    timestamptz
);

-- ---------- Funciones internas ----------
-- Controla el secreto de la compu. Corta todo si no corresponde.
create or replace function public._dispositivo(p_id uuid, p_secreto text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uso timestamptz;
begin
  select ultimo_uso into v_uso from public.dispositivos
   where id = p_id and activo and secreto_hash = encode(digest(coalesce(p_secreto, ''), 'sha256'), 'hex');
  if not found then raise exception 'dispositivo_invalido' using errcode = 'P0001'; end if;
  if v_uso is null or v_uso < now() - interval '5 minutes' then
    update public.dispositivos set ultimo_uso = now() where id = p_id;
  end if;
end $$;

-- Huella de la cara que manda la compu (lista de 128 números, red de reconocimiento de face-api) → vector.
create or replace function public._vector(p jsonb) returns extensions.vector
language sql immutable set search_path = public, extensions as $$
  select replace(p::text, ' ', '')::extensions.vector(128)
$$;

-- Distancia entre huellas → parecido de 0 a 1. Con face-api, la misma persona suele quedar a menos de 0,5
-- y dos personas distintas a más de 0,6 (por eso el mínimo de parecido por defecto es 0,5).
create or replace function public._similitud(d double precision) returns real
language sql immutable set search_path = public as $$
  select greatest(0, least(1, 1 - d))::real
$$;

-- Persona más parecida (y el parecido de la segunda), entre las activas con cara registrada.
create or replace function public._reconocer(p extensions.vector, p_excluir text default null)
returns table (email text, similitud real, segunda real)
language sql stable security definer set search_path = public, extensions as $$
  with por_persona as (
    select c.email, min(c.embedding <-> p) as d
      from public.caras c
      join public.autorizados a on a.email = c.email and a.activo
     where p_excluir is null or c.email <> p_excluir
     group by c.email
  ), orden as (
    select x.email, x.d, row_number() over (order by x.d) as n from por_persona x
  )
  select (select o.email from orden o where o.n = 1),
         (select public._similitud(o.d) from orden o where o.n = 1),
         (select public._similitud(o.d) from orden o where o.n = 2)
$$;

-- Conexión de internet desde la que llega el pedido (Supabase la pasa en los encabezados).
create or replace function public._ip() returns text
language sql stable set search_path = public as $$
  select nullif(trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '')
$$;

-- Día de Argentina de una hora.
create or replace function public._dia(t timestamptz) returns date
language sql immutable set search_path = public as $$ select (t at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Por día, como mucho 2 entradas y 2 salidas (horario cortado). ¿Ya tiene 2 de ese tipo ese día?
-- p_excluir: la fichada que se está cambiando (no cuenta).
create or replace function public._dia_completo(p_email text, p_tipo text, p_hora timestamptz, p_excluir bigint default null)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select count(*) >= 2 from public.fichadas f
   where f.email = p_email and f.tipo = p_tipo and not f.anulada
     and public._dia(f.hora) = public._dia(p_hora)
     and (p_excluir is null or f.id <> p_excluir)
$$;

-- Registra una fichada: decide sola si es entrada o salida y guarda la foto.
-- Una salida solo cierra una entrada del MISMO día: si alguien se olvida de fichar, el error no se
-- arrastra a los días siguientes y queda a la vista ("falta la salida") para que la admin lo arregle.
create or replace function public._registrar_fichada(
  p_email text, p_metodo text, p_dispositivo uuid, p_similitud real, p_foto text, p_hora_pc timestamptz, p_revisar text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_aj public.ajustes_fichador;
  v_hora timestamptz := now();
  v_sin_conexion boolean := false;
  v_ult public.fichadas;
  v_tipo text;
  v_id bigint;
  v_nombre text;
  v_ip text := public._ip();
  v_ip_local text;
begin
  select * into v_aj from public.ajustes_fichador where id = 1;
  select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) into v_nombre
    from public.autorizados a where a.email = p_email and a.activo;
  if v_nombre is null then return jsonb_build_object('estado', 'sin_acceso'); end if;

  -- Guardada en la compu sin internet: vale la hora de la compu (nunca en el futuro) y queda para revisar.
  if p_hora_pc is not null then
    if p_hora_pc < now() - interval '30 days' then return jsonb_build_object('estado', 'vieja'); end if;
    v_hora := least(p_hora_pc, now());
    v_sin_conexion := p_hora_pc < now() - interval '2 minutes';
  end if;

  select * into v_ult from public.fichadas f
   where f.email = p_email and not f.anulada and f.hora <= v_hora + interval '2 minutes'
   order by f.hora desc limit 1;

  -- La misma persona fichando dos veces: en menos de 2 minutos, o una "salida" a menos de 10 de su entrada.
  if v_ult.id is not null and (abs(extract(epoch from v_hora - v_ult.hora)) < 120
                               or (v_ult.tipo = 'entrada' and v_hora - v_ult.hora < interval '10 minutes')) then
    return jsonb_build_object('estado', 'repetida', 'nombre', v_nombre, 'tipo', v_ult.tipo, 'hora', v_ult.hora);
  end if;

  v_tipo := case
    when v_ult.tipo = 'entrada' and public._dia(v_ult.hora) = public._dia(v_hora)
         and v_hora - v_ult.hora < make_interval(hours => v_aj.horas_max_turno) then 'salida'
    else 'entrada' end;

  -- Tope del día: 2 entradas y 2 salidas.
  if public._dia_completo(p_email, v_tipo, v_hora) then
    return jsonb_build_object('estado', 'limite_dia', 'nombre', v_nombre, 'tipo', v_tipo);
  end if;

  -- Si llega de la compu pero desde otra conexión que la del local, puede ser alguien que copió el secreto
  -- de la compu: se registra igual, pero queda para revisar.
  if p_dispositivo is not null and v_ip is not null then
    select d.ultima_ip into v_ip_local from public.dispositivos d where d.id = p_dispositivo;
  end if;

  insert into public.fichadas (email, tipo, hora, metodo, dispositivo, similitud, sin_conexion, hora_pc, revisar, ip)
  values (p_email, v_tipo, v_hora, p_metodo, p_dispositivo, p_similitud, v_sin_conexion,
          case when v_sin_conexion then p_hora_pc end,
          nullif(concat_ws(' · ', p_revisar,
            case when v_sin_conexion then 'Se guardó sin internet: vale la hora de la compu' end,
            case when v_ip_local is not null and v_ip <> v_ip_local then 'Llegó desde otra conexión de internet, no la del local' end), ''),
          v_ip)
  returning id into v_id;

  if p_foto is not null and length(p_foto) < 300000 and p_foto like 'data:image/jpeg;base64,%' then
    insert into public.fotos_fichada (fichada_id, foto) values (v_id, p_foto);
  end if;
  delete from public.fotos_fichada where tomada_el < now() - make_interval(days => v_aj.dias_fotos);
  update public.fichadas_sin_reconocer set foto = null where foto is not null and creada_el < now() - make_interval(days => v_aj.dias_fotos);

  return jsonb_build_object('estado', 'ok', 'id', v_id, 'nombre', v_nombre, 'tipo', v_tipo, 'hora', v_hora);
end $$;

revoke all on function public._dispositivo(uuid, text), public._vector(jsonb), public._similitud(double precision),
  public._reconocer(extensions.vector, text), public._registrar_fichada(text, text, uuid, real, text, timestamptz, text),
  public._ip(), public._dia(timestamptz), public._dia_completo(text, text, timestamptz, bigint)
  from public, anon, authenticated;

-- ---------- Lo que usa la compu del local (con su id y secreto) ----------
-- Pantalla: hora de la base y las fichadas de hoy (hora de Argentina).
create or replace function public.estado_fichador(p_dispositivo uuid, p_secreto text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_ip text := public._ip();
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  -- La compu consulta esto cada 20 segundos desde el local: así se sabe cuál es la conexión del local.
  if v_ip is not null then
    update public.dispositivos set ultima_ip = v_ip where id = p_dispositivo and ultima_ip is distinct from v_ip;
  end if;
  return jsonb_build_object(
    'ahora', now(),
    'nombre', (select nombre from public.dispositivos where id = p_dispositivo),
    'caras', (select count(distinct c.email) from public.caras c join public.autorizados a on a.email = c.email and a.activo),
    'ajustes', (select jsonb_build_object('parpadeo', parpadeo) from public.ajustes_fichador where id = 1),
    'hoy', coalesce((
      select jsonb_agg(jsonb_build_object(
               'email', f.email,
               'nombre', split_part(coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)), ' ', 1),
               'tipo', f.tipo, 'hora', f.hora, 'metodo', f.metodo) order by f.hora)
        from public.fichadas f join public.autorizados a on a.email = f.email
       where not f.anulada
         and (f.hora at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date
    ), '[]'::jsonb));
end $$;

-- Fichar con la cara.
create or replace function public.fichar_cara(
  p_dispositivo uuid, p_secreto text, p_embedding jsonb, p_foto text default null, p_hora_pc timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_aj public.ajustes_fichador; r record;
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  select * into v_aj from public.ajustes_fichador where id = 1;
  select * into r from public._reconocer(public._vector(p_embedding));
  if r.email is null or r.similitud < v_aj.similitud_min
     or (r.segunda is not null and r.similitud - r.segunda < v_aj.margen) then
    -- Guardada sin internet y no se reconoce: no se pierde, queda con la foto para que la admin la asigne.
    if p_hora_pc is not null then
      insert into public.fichadas_sin_reconocer (dispositivo, hora, foto)
      values (p_dispositivo, least(p_hora_pc, now()),
              case when p_foto like 'data:image/jpeg;base64,%' and length(p_foto) < 300000 then p_foto end);
      return jsonb_build_object('estado', 'guardada_sin_reconocer', 'similitud', r.similitud);
    end if;
    return jsonb_build_object('estado', case when r.email is null or r.similitud < v_aj.similitud_min then 'desconocida' else 'dudosa' end,
                              'similitud', r.similitud);
  end if;
  return public._registrar_fichada(r.email, 'cara', p_dispositivo, r.similitud, p_foto, p_hora_pc, null)
         || jsonb_build_object('similitud', r.similitud);
end $$;

-- Fichar con el QR del celular: vale igual que la cara. El código cambia cada 3 segundos, lo tiene solo
-- la dueña de la cuenta y lo tiene que leer la cámara del local (desde otro lado no se puede fichar).
-- Si la cámara ve a la vez la cara de OTRA persona registrada, se rechaza; si no ve ninguna cara (o no
-- la conoce), ficha igual y queda la foto.
create or replace function public.fichar_codigo(
  p_dispositivo uuid, p_secreto text, p_qr text, p_embedding jsonb, p_foto text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_aj public.ajustes_fichador;
  v_partes text[] := string_to_array(coalesce(p_qr, ''), '.');
  v_cod public.codigos_fichaje;
  v_paso bigint;
  v_ahora bigint := floor(extract(epoch from now()) / 3)::bigint;
  v_duena text;
  v_cara text;
  v_similitud real;
  v_res jsonb;
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  select * into v_aj from public.ajustes_fichador where id = 1;
  if coalesce(array_length(v_partes, 1), 0) <> 4 or v_partes[1] <> 'LOLA1' or v_partes[3] !~ '^\d{1,12}$' then
    return jsonb_build_object('estado', 'codigo_invalido');
  end if;
  v_paso := v_partes[3]::bigint;

  select * into v_cod from public.codigos_fichaje c where c.id = v_partes[2] and c.vence > now() and c.usado_el is null for update;
  if v_cod.id is null
     or v_paso not between v_ahora - 2 and v_ahora + 1
     or v_partes[4] <> substr(encode(hmac(convert_to(v_cod.id || '.' || v_paso, 'UTF8'), decode(v_cod.clave, 'hex'), 'sha256'), 'hex'), 1, 16)
  then
    return jsonb_build_object('estado', 'codigo_vencido');
  end if;

  select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) into v_duena from public.autorizados a where a.email = v_cod.email;
  if p_embedding is not null then
    select r.email, r.similitud into v_cara, v_similitud from public._reconocer(public._vector(p_embedding)) r;
    if v_cara is not null and v_cara <> v_cod.email and v_similitud >= v_aj.similitud_min then
      return jsonb_build_object('estado', 'cara_de_otra', 'nombre', v_duena,
        'otra', (select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) from public.autorizados a where a.email = v_cara));
    end if;
  end if;

  v_res := public._registrar_fichada(
    v_cod.email, 'codigo', p_dispositivo,
    case when v_cara = v_cod.email then v_similitud end, p_foto, null, null);
  if v_res ->> 'estado' = 'ok' then
    update public.codigos_fichaje set usado_el = now() where id = v_cod.id;
  end if;
  return v_res;
end $$;

-- "No soy yo": anula la fichada recién hecha (solo desde la misma compu y en el primer minuto y medio).
create or replace function public.deshacer_fichada(p_dispositivo uuid, p_secreto text, p_id bigint) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  update public.fichadas
     set anulada = true, anulada_el = now(), anulada_por = 'fichador', anulada_motivo = 'Tocaron "No soy yo" en el fichador'
   where id = p_id and dispositivo = p_dispositivo and not anulada and registrada_el > now() - interval '90 seconds';
  return found;
end $$;

-- Antes de registrar una cara: de quién es el código.
create or replace function public.ver_codigo_cara(p_dispositivo uuid, p_secreto text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_nombre text;
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) into v_nombre
    from public.codigos_cara c join public.autorizados a on a.email = c.email and a.activo
   where c.codigo = p_codigo and c.vence > now() and c.usado_el is null;
  if v_nombre is null then return jsonb_build_object('estado', 'codigo_invalido'); end if;
  return jsonb_build_object('estado', 'ok', 'nombre', v_nombre);
end $$;

-- Registrar (o volver a registrar) la cara de alguien, con el código que generó una admin.
-- Se rechaza si las tomas no son de la misma persona o si la cara se parece a la de otra registrada.
-- Parientes (madre e hijo, hermanas) se pueden parecer de verdad: con p_forzar se registra igual y
-- queda anotado a quién se parecía (la admin está presente, porque el código lo dio ella).
alter table public.caras add column if not exists parecida_a text;
drop function if exists public.registrar_cara(uuid, text, text, jsonb, text);
create or replace function public.registrar_cara(
  p_dispositivo uuid, p_secreto text, p_codigo text, p_embeddings jsonb, p_foto text default null, p_forzar boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_aj public.ajustes_fichador;
  v_cod public.codigos_cara;
  v_nombre text;
  v_vectores extensions.vector[];
  v extensions.vector;
  r record;
  v_peor real;
  v_parecida text;
  i int := 0;
begin
  perform public._dispositivo(p_dispositivo, p_secreto);
  select * into v_aj from public.ajustes_fichador where id = 1;
  select * into v_cod from public.codigos_cara c where c.codigo = p_codigo and c.vence > now() and c.usado_el is null for update;
  if v_cod.codigo is null then return jsonb_build_object('estado', 'codigo_invalido'); end if;
  select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) into v_nombre from public.autorizados a where a.email = v_cod.email;

  if p_embeddings is null or jsonb_typeof(p_embeddings) <> 'array' or jsonb_array_length(p_embeddings) not between 3 and 10 then
    return jsonb_build_object('estado', 'faltan_tomas');
  end if;
  select array_agg(public._vector(e)) into v_vectores from jsonb_array_elements(p_embeddings) e;

  -- Todas las tomas tienen que ser de la misma persona (con margen: entre tomas cambian la pose y la expresión).
  select min(public._similitud(a.v <-> b.v)) into v_peor
    from unnest(v_vectores) with ordinality a(v, n) join unnest(v_vectores) with ordinality b(v, n) on a.n < b.n;
  if v_peor < v_aj.similitud_min - 0.2 then
    return jsonb_build_object('estado', 'tomas_distintas', 'similitud', v_peor);
  end if;

  -- Ninguna toma se puede parecer a la cara de otra persona registrada (salvo que la admin confirme que es otra persona).
  foreach v in array v_vectores loop
    select * into r from public._reconocer(v, v_cod.email);
    if r.email is not null and r.similitud >= v_aj.similitud_min then
      v_parecida := (select coalesce(nullif(a.nombre, ''), split_part(a.email, '@', 1)) from public.autorizados a where a.email = r.email);
      if not coalesce(p_forzar, false) then
        return jsonb_build_object('estado', 'parecida_a_otra', 'nombre', v_nombre, 'otra', v_parecida);
      end if;
      exit;
    end if;
  end loop;

  delete from public.caras where email = v_cod.email;
  foreach v in array v_vectores loop
    i := i + 1;
    insert into public.caras (email, embedding, foto, dispositivo, parecida_a)
    values (v_cod.email, v,
            case when i = 1 and p_foto like 'data:image/jpeg;base64,%' and length(p_foto) < 300000 then p_foto end,
            p_dispositivo, v_parecida);
  end loop;
  update public.codigos_cara set usado_el = now() where codigo = v_cod.codigo;
  return jsonb_build_object('estado', 'ok', 'nombre', v_nombre, 'parecida_a', v_parecida);
end $$;

-- ---------- Lo que usa la empleada desde su celular ----------
-- Pide una clave para armar el QR (dura 3 minutos; la app pide otra sola).
create or replace function public.pedir_codigo_fichaje() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text := public.mi_email(); v_id text; v_clave text; v_vence timestamptz := now() + interval '3 minutes';
begin
  if not public.es_autorizado() then raise exception 'sin_acceso' using errcode = 'P0001'; end if;
  delete from public.codigos_fichaje where email = v_email or vence < now() - interval '1 day';
  v_id := encode(gen_random_bytes(9), 'hex');
  v_clave := encode(gen_random_bytes(32), 'hex');
  insert into public.codigos_fichaje (id, email, clave, vence) values (v_id, v_email, v_clave, v_vence);
  return jsonb_build_object('id', v_id, 'clave', v_clave, 'vence', v_vence, 'ahora', now(), 'paso', 3);
end $$;

-- ---------- Lo que usan las admins ----------
-- Convierte la compu donde está abierta la página en fichador. Devuelve el secreto UNA sola vez.
create or replace function public.activar_dispositivo(p_nombre text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_secreto text := encode(gen_random_bytes(32), 'hex'); v_id uuid;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  insert into public.dispositivos (nombre, secreto_hash, creado_por)
  values (left(coalesce(nullif(trim(p_nombre), ''), 'Compu del local'), 40), encode(digest(v_secreto, 'sha256'), 'hex'), public.mi_email())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'secreto', v_secreto);
end $$;

-- Código de 6 números (vale 15 minutos) para registrar la cara de una persona en la compu.
create or replace function public.crear_codigo_cara(p_email text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_codigo text; b bytea;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.autorizados where email = lower(p_email) and activo) then
    raise exception 'sin_acceso' using errcode = 'P0001';
  end if;
  delete from public.codigos_cara where email = lower(p_email) or vence < now() - interval '1 day';
  loop
    b := gen_random_bytes(3);
    v_codigo := lpad(((get_byte(b, 0) * 65536 + get_byte(b, 1) * 256 + get_byte(b, 2)) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.codigos_cara where codigo = v_codigo);
  end loop;
  insert into public.codigos_cara (codigo, email, vence, creado_por) values (v_codigo, lower(p_email), now() + interval '15 minutes', public.mi_email());
  return v_codigo;
end $$;

-- Cargar a mano una fichada que faltó (queda registrado quién la cargó).
create or replace function public.fichada_manual(p_email text, p_tipo text, p_hora timestamptz, p_nota text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare v_id bigint;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  if public._dia_completo(lower(p_email), p_tipo, p_hora) then raise exception 'limite_dia' using errcode = 'P0001'; end if;
  insert into public.fichadas (email, tipo, hora, metodo, creada_por, nota)
  values (lower(p_email), p_tipo, p_hora, 'manual', public.mi_email(), left(nullif(trim(p_nota), ''), 300))
  returning id into v_id;
  return v_id;
end $$;

-- Corregir la hora (se guarda la original y quién la cambió).
create or replace function public.corregir_fichada(p_id bigint, p_hora timestamptz, p_motivo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_f public.fichadas;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  select * into v_f from public.fichadas where id = p_id;
  if v_f.id is not null and not v_f.anulada and public._dia_completo(v_f.email, v_f.tipo, p_hora, p_id) then
    raise exception 'limite_dia' using errcode = 'P0001';
  end if;
  update public.fichadas
     set hora_original = coalesce(hora_original, hora), hora = p_hora,
         corregida_por = public.mi_email(), corregida_el = now(), motivo = left(nullif(trim(p_motivo), ''), 300)
   where id = p_id;
end $$;

-- Anular (no se borra: queda tachada con el motivo).
create or replace function public.anular_fichada(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  update public.fichadas
     set anulada = true, anulada_por = public.mi_email(), anulada_el = now(), anulada_motivo = left(nullif(trim(p_motivo), ''), 300)
   where id = p_id;
end $$;

-- Cambiar una entrada por salida o al revés (por ejemplo, cuando alguien se olvidó de fichar la entrada).
create or replace function public.cambiar_tipo(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_f public.fichadas;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  select * into v_f from public.fichadas where id = p_id;
  if v_f.id is not null and not v_f.anulada
     and public._dia_completo(v_f.email, case v_f.tipo when 'entrada' then 'salida' else 'entrada' end, v_f.hora, p_id) then
    raise exception 'limite_dia' using errcode = 'P0001';
  end if;
  update public.fichadas
     set tipo = case tipo when 'entrada' then 'salida' else 'entrada' end,
         corregida_por = public.mi_email(), corregida_el = now(),
         motivo = concat_ws(' · ', left(nullif(trim(p_motivo), ''), 300), 'Se cambió entrada/salida')
   where id = p_id;
end $$;

-- "Ya la miré, está bien".
create or replace function public.marcar_revisada(p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  update public.fichadas set revisada_por = public.mi_email(), revisada_el = now() where id = p_id;
end $$;

-- Horario fijo de una persona, todo junto (si algo falla no queda a medias).
-- p_dias: [{"dia": 1, "entrada": "09:00", "salida": "14:00"}, ...]
create or replace function public.guardar_horario(p_email text, p_fijo boolean, p_dias jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  delete from public.horarios where email = p_email;
  insert into public.horarios (email, dia, entrada, salida)
  select p_email, (d ->> 'dia')::smallint, (d ->> 'entrada')::time, (d ->> 'salida')::time
    from jsonb_array_elements(coalesce(p_dias, '[]'::jsonb)) d;
  update public.autorizados set horario_fijo = coalesce(p_fijo, false) where email = p_email;
end $$;

-- Una fichada guardada sin internet que no se reconoció: la admin dice de quién es (queda como cargada a mano).
create or replace function public.asignar_sin_reconocer(p_id bigint, p_email text, p_tipo text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare v_s public.fichadas_sin_reconocer; v_id bigint;
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  select * into v_s from public.fichadas_sin_reconocer where id = p_id and resuelta_el is null for update;
  if v_s.id is null then raise exception 'ya_resuelta' using errcode = 'P0001'; end if;
  if public._dia_completo(lower(p_email), p_tipo, v_s.hora) then raise exception 'limite_dia' using errcode = 'P0001'; end if;
  insert into public.fichadas (email, tipo, hora, metodo, dispositivo, creada_por, nota, sin_conexion, hora_pc)
  values (lower(p_email), p_tipo, v_s.hora, 'manual', v_s.dispositivo, public.mi_email(),
          'Se guardó sin internet y la cara no se reconoció: la asignó una admin mirando la foto', true, v_s.hora)
  returning id into v_id;
  if v_s.foto is not null then insert into public.fotos_fichada (fichada_id, foto) values (v_id, v_s.foto); end if;
  update public.fichadas_sin_reconocer set resuelta_el = now(), resuelta_por = public.mi_email(), fichada_id = v_id where id = p_id;
  return v_id;
end $$;

create or replace function public.descartar_sin_reconocer(p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_admin() then raise exception 'solo_admin' using errcode = 'P0001'; end if;
  update public.fichadas_sin_reconocer set resuelta_el = now(), resuelta_por = public.mi_email() where id = p_id and resuelta_el is null;
end $$;

-- ---------- Permisos ----------
revoke all on function
  public.estado_fichador(uuid, text), public.fichar_cara(uuid, text, jsonb, text, timestamptz),
  public.fichar_codigo(uuid, text, text, jsonb, text), public.deshacer_fichada(uuid, text, bigint),
  public.ver_codigo_cara(uuid, text, text), public.registrar_cara(uuid, text, text, jsonb, text, boolean),
  public.pedir_codigo_fichaje(), public.activar_dispositivo(text), public.crear_codigo_cara(text),
  public.fichada_manual(text, text, timestamptz, text), public.corregir_fichada(bigint, timestamptz, text),
  public.anular_fichada(bigint, text), public.marcar_revisada(bigint), public.cambiar_tipo(bigint, text),
  public.guardar_horario(text, boolean, jsonb), public.asignar_sin_reconocer(bigint, text, text),
  public.descartar_sin_reconocer(bigint)
  from public, anon, authenticated;
-- La compu no tiene sesión (entra como anon) y se identifica con su secreto.
grant execute on function
  public.estado_fichador(uuid, text), public.fichar_cara(uuid, text, jsonb, text, timestamptz),
  public.fichar_codigo(uuid, text, text, jsonb, text), public.deshacer_fichada(uuid, text, bigint),
  public.ver_codigo_cara(uuid, text, text), public.registrar_cara(uuid, text, text, jsonb, text, boolean)
  to anon, authenticated;
grant execute on function
  public.pedir_codigo_fichaje(), public.activar_dispositivo(text), public.crear_codigo_cara(text),
  public.fichada_manual(text, text, timestamptz, text), public.corregir_fichada(bigint, timestamptz, text),
  public.anular_fichada(bigint, text), public.marcar_revisada(bigint), public.cambiar_tipo(bigint, text),
  public.guardar_horario(text, boolean, jsonb), public.asignar_sin_reconocer(bigint, text, text),
  public.descartar_sin_reconocer(bigint)
  to authenticated;

alter table public.fichadas_sin_reconocer enable row level security;
alter table public.ajustes_fichador  enable row level security;
alter table public.horarios          enable row level security;
alter table public.dispositivos      enable row level security;
alter table public.caras             enable row level security;
alter table public.fichadas          enable row level security;
alter table public.fotos_fichada     enable row level security;
alter table public.codigos_fichaje   enable row level security;   -- sin políticas: solo por las funciones
alter table public.codigos_cara      enable row level security;   -- sin políticas: solo por las funciones

-- Fichadas: cada una ve las suyas; las admins ven todas. Nadie escribe directo: solo por las funciones.
drop policy if exists "ver mis fichadas o admin" on public.fichadas;
create policy "ver mis fichadas o admin" on public.fichadas
  for select to authenticated using ((email = public.mi_email() and public.es_autorizado()) or public.es_admin());
drop policy if exists "admin ve fotos" on public.fotos_fichada;
create policy "admin ve fotos" on public.fotos_fichada for select to authenticated using (public.es_admin());
drop policy if exists "admin ve sin reconocer" on public.fichadas_sin_reconocer;
create policy "admin ve sin reconocer" on public.fichadas_sin_reconocer for select to authenticated using (public.es_admin());

drop policy if exists "admin ve caras" on public.caras;
create policy "admin ve caras" on public.caras for select to authenticated using (public.es_admin());
drop policy if exists "admin borra caras" on public.caras;
create policy "admin borra caras" on public.caras for delete to authenticated using (public.es_admin());

drop policy if exists "admin ve compus" on public.dispositivos;
create policy "admin ve compus" on public.dispositivos for select to authenticated using (public.es_admin());
drop policy if exists "admin edita compus" on public.dispositivos;
create policy "admin edita compus" on public.dispositivos for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin ve ajustes" on public.ajustes_fichador;
create policy "admin ve ajustes" on public.ajustes_fichador for select to authenticated using (public.es_admin());
drop policy if exists "admin edita ajustes" on public.ajustes_fichador;
create policy "admin edita ajustes" on public.ajustes_fichador for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "ver mi horario o admin" on public.horarios;
create policy "ver mi horario o admin" on public.horarios
  for select to authenticated using ((email = public.mi_email() and public.es_autorizado()) or public.es_admin());
drop policy if exists "admin maneja horarios" on public.horarios;
create policy "admin maneja horarios" on public.horarios for all to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.ajustes_fichador, public.horarios, public.dispositivos, public.caras, public.fichadas,
  public.fotos_fichada, public.codigos_fichaje, public.codigos_cara, public.fichadas_sin_reconocer from anon, authenticated;
grant select on public.fichadas, public.fotos_fichada, public.fichadas_sin_reconocer to authenticated;
grant select, insert, update, delete on public.horarios to authenticated;
grant select, update on public.ajustes_fichador to authenticated;
-- La huella de la cara y el hash del secreto no salen nunca de la base.
grant select (id, email, foto, creada_el, dispositivo, parecida_a) on public.caras to authenticated;
grant delete on public.caras to authenticated;
grant select (id, nombre, activo, creado_por, creado_el, ultimo_uso, ultima_ip) on public.dispositivos to authenticated;
grant update (nombre, activo) on public.dispositivos to authenticated;

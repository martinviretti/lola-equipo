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
on conflict (email) do update set rol = 'admin';

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
  select exists (select 1 from public.autorizados where email = public.mi_email())
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.autorizados where email = public.mi_email() and rol = 'admin')
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
   where email = public.mi_email()
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

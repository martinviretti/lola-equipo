-- =====================================================================
-- Lola · Equipo — actualización 1 de la intranet (avance, exámenes y admins)
--
-- QUÉ HACE, EN CRISTIANO
--  1. Exámenes sin repetir: si con mala señal un examen llegó dos veces a la base, borra la copia
--     (misma persona, mismo instante exacto) y pone una regla para que no vuelva a pasar.
--  2. Repasos sumados por la base: la función registrar_repaso() suma el intento del repaso de una
--     góndola del lado de la base, en un solo paso (antes lo sumaba el celular y se podía contar doble).
--  3. Límites a lo que escribe cada empleada: notas entre 0 y 100, niveles y cantidades razonables,
--     nombres de góndola y de tema de Bienvenida con forma de id ("01-yerbas", "atencion") y largo
--     acotado. Así nadie puede guardar textos raros o gigantes (por ejemplo una fórmula de Excel).
--  4. Nunca sin admins: la base no deja pasar a empleada, dar de baja ni borrar a la última admin
--     activa (ni aunque se pida por la API o desde el SQL Editor).
--  5. Orden en las funciones de la intranet: rutas de búsqueda fijas, sin permiso para quien no
--     inició sesión, y el nombre que llega al entrar se corta en 80 letras.
--
-- CÓMO SE CORRE
--  Supabase → SQL Editor → New query → pegar todo este archivo → Run.
--  Se puede correr dos (o más) veces sin romper nada.
--  Va DESPUÉS de schema.sql. Si algún día volvés a correr schema.sql, corré este archivo otra vez
--  después (schema.sql vuelve a dejar algunas funciones como estaban antes).
--
-- ORDEN CON LA APP
--  La app nueva funciona con y sin este archivo: si la base todavía no lo tiene, hace lo de antes.
--  Lo más prolijo: 1) publicar la app, 2) esperar uno o dos días a que los celulares se actualicen,
--  3) correr este archivo. Si se corre antes, tampoco se pierde nada.
--
-- DATOS QUE YA ESTÁN CARGADOS
--  Las reglas nuevas (punto 3) se aplican siempre a lo que se escriba de ahora en adelante. Si algún
--  dato viejo no las cumple, el dato queda como está y la base avisa con un mensaje ("NOTICE") que
--  esa regla quedó "solo para lo nuevo". No se borra nada, salvo las copias exactas de exámenes del
--  punto 1.
-- =====================================================================


-- ---------- 1. Exámenes sin repetir ----------
-- La app manda el instante exacto en que se terminó el examen (hecho_el). Si el mismo examen llega
-- dos veces (se reintentó porque no llegó la respuesta), las dos copias tienen el mismo instante:
-- se deja la primera y se borra la otra. Después, una regla única (persona + instante) hace que la
-- base ignore los repetidos.
do $$
begin
  -- Mientras tanto nadie escribe en la tabla, así no se cuela una copia entre el borrado y la regla.
  lock table public.intentos_examen in share row exclusive mode;
  delete from public.intentos_examen a
   using public.intentos_examen b
   where a.user_id = b.user_id and a.hecho_el = b.hecho_el and a.id > b.id;
  create unique index if not exists intentos_examen_sin_repetir on public.intentos_examen (user_id, hecho_el);
end $$;


-- ---------- 2. Repaso de una góndola, sumado por la base ----------
-- Guarda cuál fue el último repaso registrado (lo manda la app con un id único), así un reintento
-- del mismo repaso no se cuenta dos veces.
alter table public.progreso_gondola add column if not exists ultimo_repaso uuid;

-- p_hecho_el: cuándo se hizo el repaso (puede llegar tarde si no había internet; nunca en el futuro).
-- p_id: id único del repaso que manda la app.
create or replace function public.registrar_repaso(
  p_gondola text, p_bien int, p_total int, p_aprobado boolean,
  p_hecho_el timestamptz default null, p_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cuando timestamptz := least(coalesce(p_hecho_el, now()), now());
begin
  -- Solo para la persona que inició sesión, y si sigue teniendo acceso: escribe únicamente su fila.
  if v_uid is null or not public.es_autorizado() then
    raise exception 'sin_acceso' using errcode = '42501';
  end if;
  if p_gondola is null or char_length(p_gondola) > 80 or p_gondola !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'gondola_invalida' using errcode = '22023';
  end if;
  if p_total is null or p_total not between 1 and 100 or p_bien is null or p_bien not between 0 and p_total then
    raise exception 'valores_invalidos' using errcode = '22023';
  end if;

  insert into public.progreso_gondola as g
    (user_id, gondola, vista_el, quiz_intentos, quiz_mejor, quiz_total, completada_el, actualizado_el, ultimo_repaso)
  values
    (v_uid, p_gondola, v_cuando, 1, p_bien, p_total, case when coalesce(p_aprobado, false) then v_cuando end, now(), p_id)
  on conflict (user_id, gondola) do update set
    quiz_intentos  = g.quiz_intentos + 1,
    -- El mejor resultado nunca pasa del total actual (si el repaso cambió de cantidad de preguntas).
    quiz_mejor     = least(greatest(g.quiz_mejor, excluded.quiz_mejor), excluded.quiz_total),
    quiz_total     = excluded.quiz_total,
    vista_el       = coalesce(g.vista_el, excluded.vista_el),
    completada_el  = coalesce(g.completada_el, excluded.completada_el),
    actualizado_el = now(),
    ultimo_repaso  = excluded.ultimo_repaso
  where p_id is null or g.ultimo_repaso is distinct from p_id;
end $$;

revoke all on function public.registrar_repaso(text, int, int, boolean, timestamptz, uuid) from public, anon;
grant execute on function public.registrar_repaso(text, int, int, boolean, timestamptz, uuid) to authenticated;


-- ---------- 3. Límites a lo que escribe cada empleada ----------
-- Cada regla se agrega "not valid": vale para todo lo que se escriba desde ya, sin revisar lo viejo.
-- Después se intenta revisar lo viejo: si cumple, la regla queda completa; si no, queda solo para lo
-- nuevo y sale un aviso (NOTICE) con el nombre de la regla. Nada se borra.
-- Ids válidos: minúsculas, números y guiones, como "01-yerbas" o "atencion" (hasta 80 letras).
alter table public.progreso_gondola
  drop constraint if exists progreso_gondola_gondola_valida,
  add constraint progreso_gondola_gondola_valida
    check (char_length(gondola) <= 80 and gondola ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid,
  drop constraint if exists progreso_gondola_numeros,
  add constraint progreso_gondola_numeros
    check (quiz_intentos between 0 and 100000 and quiz_total between 0 and 100
           and quiz_mejor between 0 and quiz_total) not valid;

alter table public.intentos_examen
  drop constraint if exists intentos_examen_valores,
  add constraint intentos_examen_valores
    check (nivel between 1 and 10 and nota between 0 and 100
           and (preguntas is null or preguntas between 0 and 500)) not valid,
  drop constraint if exists intentos_examen_errores,
  -- Errores: una lista de ids de preguntas, de tamaño razonable.
  add constraint intentos_examen_errores
    check (case when jsonb_typeof(errores) = 'array'
                then jsonb_array_length(errores) <= 500 and octet_length(errores::text) <= 20000
                else false end) not valid;

alter table public.secciones_leidas
  drop constraint if exists secciones_leidas_seccion_valida,
  add constraint secciones_leidas_seccion_valida
    check (char_length(seccion) <= 80 and seccion ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

alter table public.autorizados
  drop constraint if exists autorizados_largos,
  add constraint autorizados_largos
    check (char_length(email) <= 254 and (nombre is null or char_length(nombre) <= 80)) not valid;

-- Revisar lo que ya estaba cargado.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname as regla
      from pg_constraint c
     where c.conrelid in ('public.progreso_gondola'::regclass, 'public.intentos_examen'::regclass,
                          'public.secciones_leidas'::regclass, 'public.autorizados'::regclass)
       and c.conname in ('progreso_gondola_gondola_valida', 'progreso_gondola_numeros', 'intentos_examen_valores',
                         'intentos_examen_errores', 'secciones_leidas_seccion_valida', 'autorizados_largos')
       and not c.convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', r.tabla, r.regla);
    exception when check_violation then
      raise notice 'La regla % (tabla %) queda solo para lo nuevo: hay datos viejos que no la cumplen. No se borró nada.',
        r.regla, r.tabla;
    end;
  end loop;
end $$;


-- ---------- 4. Nunca sin admins ----------
-- Antes de pasar a empleada, dar de baja o borrar a una admin activa, se fija que quede otra admin
-- activa. Si no queda ninguna, no lo deja ('ultima_admin'). El candado evita que dos admins se
-- degraden una a la otra al mismo tiempo y quede el panel sin nadie.
create or replace function public._cuidar_ultima_admin() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_deja_de_ser boolean := false;
begin
  if old.rol = 'admin' and old.activo then
    if tg_op = 'DELETE' then
      v_deja_de_ser := true;
    else
      v_deja_de_ser := new.rol is distinct from 'admin' or new.activo is not true;
    end if;
  end if;
  if v_deja_de_ser then
    perform pg_advisory_xact_lock(hashtext('lola:ultima_admin'));
    if not exists (select 1 from public.autorizados a
                    where a.rol = 'admin' and a.activo and a.email <> old.email) then
      raise exception 'ultima_admin'
        using errcode = 'P0001',
              detail = 'Es la única admin activa: el panel quedaría sin nadie que lo maneje.',
              hint = 'Primero hacé admin a otra persona.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists cuidar_ultima_admin on public.autorizados;
create trigger cuidar_ultima_admin
  before update of rol, activo or delete on public.autorizados
  for each row execute function public._cuidar_ultima_admin();

revoke all on function public._cuidar_ultima_admin() from public, anon, authenticated;


-- ---------- 5. Orden en las funciones de la intranet ----------
-- (Las del fichador no se tocan acá.)
-- mi_email: ruta de búsqueda fija, como las demás.
alter function public.mi_email() set search_path = public;

-- registrar_ingreso: igual que antes, pero el nombre que manda el celular se limpia y se corta en 80.
create or replace function public.registrar_ingreso(p_nombre text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  update public.autorizados
     set user_id        = auth.uid(),
         nombre         = coalesce(nullif(nombre, ''), left(nullif(trim(p_nombre), ''), 80)),
         primer_ingreso = coalesce(primer_ingreso, now()),
         ultimo_ingreso = now()
   where email = public.mi_email() and activo
  returning rol into v_rol;
  return v_rol;
end $$;

-- Permisos: solo con sesión iniciada. Excepción: es_autorizado() queda abierta para quien no inició
-- sesión porque la usa el aviso automático que mantiene despierta la base (.github/workflows/
-- mantener-supabase.yml); sin sesión siempre contesta "false" y no muestra nada.
revoke execute on function public.mi_email(), public.es_admin(), public.registrar_ingreso(text) from public, anon;
revoke execute on function public.es_autorizado() from public;
grant execute on function public.mi_email(), public.es_autorizado(), public.es_admin(), public.registrar_ingreso(text)
  to authenticated;
grant execute on function public.es_autorizado() to anon;

-- Que la API vea la función nueva enseguida.
notify pgrst, 'reload schema';

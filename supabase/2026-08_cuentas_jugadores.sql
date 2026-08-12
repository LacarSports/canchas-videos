-- ============================================================
-- Cuentas de jugadores + trazabilidad de descargas (Ley 21.719)
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- Fecha: agosto 2026
-- ============================================================

-- ------------------------------------------------------------
-- 1) PERFILES: una fila por usuario registrado.
--    Guarda la aceptación de Términos y Condiciones (prueba de
--    consentimiento) y datos básicos del perfil.
-- ------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre text,
  accepted_tos_at timestamptz,   -- cuándo aceptó los T&C (null = cuenta creada a mano, sin aceptación online)
  tos_version text,              -- versión de los T&C aceptada (fecha del documento)
  created_at timestamptz default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "leer propio perfil" on public.perfiles;
create policy "leer propio perfil" on public.perfiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "editar propio perfil" on public.perfiles;
create policy "editar propio perfil" on public.perfiles
  for update to authenticated using (auth.uid() = id);

-- Trigger: cada vez que se crea un usuario en auth.users se crea su perfil.
-- El registro en /login exige marcar la casilla de T&C ANTES de enviar el
-- formulario (o de ir a Google), por lo que la fecha de creación de la cuenta
-- equivale a la fecha de aceptación.
-- El nombre viene de user_metadata: 'nombre' lo manda el formulario de /login;
-- 'full_name'/'name' los entrega Google automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, accepted_tos_at, tos_version)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), '')
    ),
    now(),
    '2026-08'   -- versión vigente de los T&C (ver app/terminos/page.tsx)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: crear perfil para las cuentas que ya existen (dueños de complejos,
-- creadas a mano desde el dashboard). Quedan sin fecha de aceptación online.
insert into public.perfiles (id, email, accepted_tos_at, tos_version)
select id, email, null, null from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2) DESCARGAS_CLIPS: registro de cada clip descargado o guardado
--    como destacado, con el usuario que lo hizo. Sirve para
--    identificar responsables si un clip se difunde mal (T&C §6.3,
--    "ruptura de la cadena de custodia").
--    NOTA: partido_id/jugada_id son text SIN foreign key a propósito:
--    los partidos se borran a los 7 días y este registro debe
--    sobrevivirlos.
-- ------------------------------------------------------------
create table if not exists public.descargas_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,                    -- copia del correo al momento de la descarga
  partido_id text,
  jugada_id text,
  complejo text,
  inicio_seg numeric,
  fin_seg numeric,
  etiqueta text,
  tipo text not null default 'descarga',   -- 'descarga' | 'destacado'
  origen text,                             -- 'partido' | 'jugada'
  created_at timestamptz default now()
);

alter table public.descargas_clips enable row level security;

drop policy if exists "insertar propia descarga" on public.descargas_clips;
create policy "insertar propia descarga" on public.descargas_clips
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "leer propias descargas" on public.descargas_clips;
create policy "leer propias descargas" on public.descargas_clips
  for select to authenticated using (auth.uid() = user_id);

create index if not exists descargas_clips_partido_idx on public.descargas_clips (partido_id);
create index if not exists descargas_clips_user_idx on public.descargas_clips (user_id);

-- ------------------------------------------------------------
-- 3) VISITAS: asociar la visita al usuario logueado (si lo hay).
--    El session_id anónimo se mantiene para no romper las
--    estadísticas históricas.
-- ------------------------------------------------------------
alter table public.visitas_partidos add column if not exists user_id uuid;
alter table public.usuarios_complejo add column if not exists user_id uuid;

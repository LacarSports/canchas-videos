-- ──────────────────────────────────────────────────────────────
-- Reseñas de jugadores (sección "Reseñas" de la página de inicio)
-- Octubre 2026
--
-- - Solo usuarios con sesión pueden escribir, una reseña por cuenta.
-- - Toda reseña nueva entra con aprobada = false: no se ve en la web
--   hasta que alguien la aprueba a mano (Table Editor → resenas →
--   marcar "aprobada"). Así no se publica spam ni insultos.
-- - Cualquiera (incluso sin sesión) puede leer las aprobadas.
-- ──────────────────────────────────────────────────────────────

create table if not exists public.resenas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  complejo    text not null check (char_length(complejo) between 1 and 80),
  estrellas   smallint not null check (estrellas between 1 and 5),
  comentario  text not null check (char_length(comentario) between 3 and 500),
  aprobada    boolean not null default false,
  creado_en   timestamptz not null default now(),
  unique (user_id)
);

create index if not exists resenas_aprobadas_idx
  on public.resenas (creado_en desc) where aprobada;

alter table public.resenas enable row level security;

-- Permisos por columna: el cliente no puede escribir aprobada, user_id ni fechas.
revoke all on public.resenas from anon, authenticated;
grant select on public.resenas to anon, authenticated;
grant insert (nombre, complejo, estrellas, comentario) on public.resenas to authenticated;

drop policy if exists "resenas: leer aprobadas" on public.resenas;
create policy "resenas: leer aprobadas" on public.resenas
  for select to anon, authenticated
  using (aprobada);

drop policy if exists "resenas: leer la propia" on public.resenas;
create policy "resenas: leer la propia" on public.resenas
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "resenas: crear la propia" on public.resenas;
create policy "resenas: crear la propia" on public.resenas
  for insert to authenticated
  with check (user_id = auth.uid() and aprobada = false);

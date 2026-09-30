-- Lacar Sports — Seguridad: qué puede leer/escribir la web con la anon key (oct-2026)
--
-- ⚠️ ORDEN: correr esto DESPUÉS de que Vercel tenga desplegado el código que acompaña
--    este cambio (select con columnas explícitas, /api/video-auth con service_role,
--    /api/camera-slot con verificación del dueño). Con el código viejo, la búsqueda de
--    partidos y el panel fallarían.
--
-- Problemas que cierra:
--   1. Cualquiera (con la anon key, que es pública en la web) podía leer password_hash
--      de `partidos` y `camera_settings`.
--   2. `camera_settings` tenía la policy "Allow all": cualquiera podía modificarla
--      (bloquear/desbloquear grabaciones, quitar privados).
--   3. `partidos` era modificable con la anon key (lo usaba /api/video-privacy, ya borrada).
--   4. `reportes` (con correos de quien reporta) era legible por cualquiera.
--
-- Quién escribe en estas tablas después de esto: solo el servidor con la service_role
-- (Raspberry, /api/camera-slot, /api/reportes, pg_cron), que no depende de RLS ni grants.
-- Idempotente: se puede correr dos veces.

begin;

-- Quitar TODAS las policies actuales de estas tablas (algunas se crearon a mano en el
-- Dashboard y no están documentadas) para dejar solo las de abajo.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('partidos', 'camera_settings', 'reportes')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── partidos: lectura pública SIN password_hash; escritura solo servidor ──
alter table public.partidos enable row level security;
create policy "partidos_lectura_publica" on public.partidos
  for select to anon, authenticated using (true);
revoke all on public.partidos from anon, authenticated;
grant select (id, complejo, numero_cancha, ciudad, fecha, hora, duracion_minutos,
              archivo_url, creado_en, deporte, privado, estado)
  on public.partidos to anon, authenticated;

-- ── camera_settings: solo usuarios con sesión leen (el panel), sin el hash ──
-- `tiene_clave` reemplaza a password_hash para que el panel sepa si hay clave.
alter table public.camera_settings
  add column if not exists tiene_clave boolean generated always as (password_hash is not null) stored;
alter table public.camera_settings enable row level security;
create policy "camera_settings_lectura_con_sesion" on public.camera_settings
  for select to authenticated using (true);
revoke all on public.camera_settings from anon, authenticated;
grant select (id, complejo, numero_cancha, deporte, fecha, hora, estado, graba, tiene_clave, created_at)
  on public.camera_settings to authenticated;

-- ── reportes: solo el servidor (se insertan por /api/reportes con service_role) ──
alter table public.reportes enable row level security;
revoke all on public.reportes from anon, authenticated;

commit;

-- Verificación (debe decir "permission denied" las dos primeras, y funcionar la tercera):
--   set role anon; select password_hash from partidos limit 1; reset role;
--   set role anon; select * from reportes limit 1; reset role;
--   set role anon; select id, fecha, hora from partidos limit 1; reset role;

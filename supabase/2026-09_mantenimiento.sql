-- Lacar Sports — Mantenimiento automático y orden de tablas (30-sep-2026)
-- Ejecutar completo en Supabase → SQL Editor. Es idempotente (se puede correr dos veces).
-- Después de correrlo, los trabajos programados se ven en: Integrations → Cron
-- (o con:  select jobname, schedule, active from cron.job;)

-- ─────────────────────────────────────────────────────────────────────
-- 1) Borrados automáticos (pg_cron). Horarios en UTC: 06:00 UTC = 03:00 Chile.
-- ─────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;

-- Quitar versiones anteriores de estos trabajos (para poder re-ejecutar el script)
select cron.unschedule(jobid) from cron.job
where jobname in ('lacar-borrar-partidos', 'lacar-limpiar-monitoreo',
                  'lacar-limpiar-camera-settings', 'lacar-limpiar-alertas');

-- a) Partidos: a los 7 días (lo que prometen los T&C). R2 ya borra los videos a los
--    7 días con una regla del bucket ("Borrar videos después de 7 días"); esto borra
--    la fila del partido para que la plataforma no muestre videos que ya no existen.
--    Sus `jugadas` se borran solas por el ON DELETE CASCADE.
select cron.schedule('lacar-borrar-partidos', '0 6 * * *', $$
  delete from public.partidos
  where fecha <= (now() at time zone 'America/Santiago')::date - 7
$$);

-- b) Métricas de las Raspberry: se guardan 30 días.
select cron.schedule('lacar-limpiar-monitoreo', '10 6 * * *', $$
  delete from public.monitoreo where reportado_en < now() - interval '30 days'
$$);

-- c) Configuración por bloque horario (público/privado/bloqueado) de fechas pasadas:
--    no sirve después de que pasó el día. Se guarda 30 días.
select cron.schedule('lacar-limpiar-camera-settings', '20 6 * * *', $$
  delete from public.camera_settings
  where fecha < (now() at time zone 'America/Santiago')::date - 30
$$);

-- d) Alertas del watchdog ya resueltas: se guardan 90 días.
select cron.schedule('lacar-limpiar-alertas', '30 6 * * *', $$
  delete from public.alertas_monitoreo
  where resuelta_en is not null and resuelta_en < now() - interval '90 days'
$$);

-- Se conservan SIN borrado: ocupacion_canchas y visitas_partidos / usuarios_complejo
-- (estadísticas del panel), descargas_clips (trazabilidad legal), reportes, perfiles.

-- ─────────────────────────────────────────────────────────────────────
-- 2) Monitoreo: desde la versión 2026-09-30 del script, instance_id incluye el
--    nombre de la Pi ("lacar-pi-0/camara1") para que sea único entre complejos.
--    Se borran las filas de prueba con el formato antiguo ("camara1").
-- ─────────────────────────────────────────────────────────────────────
delete from public.monitoreo where instance_id not like '%/%';
delete from public.alertas_monitoreo where instance_id not like '%/%';

-- ─────────────────────────────────────────────────────────────────────
-- 3) Heartbeat: la clave era solo `cancha`, así que la cancha 1 de un complejo
--    pisaba la cancha 1 de otro. Ahora la clave es (complejo, cancha).
--    La Raspberry no necesita cambios (su upsert usa la clave primaria).
-- ─────────────────────────────────────────────────────────────────────
update public.heartbeat set complejo = '' where complejo is null;
alter table public.heartbeat alter column complejo set not null;
do $$
declare pk text;
begin
  select conname into pk from pg_constraint
  where conrelid = 'public.heartbeat'::regclass and contype = 'p';
  if pk is not null then
    execute format('alter table public.heartbeat drop constraint %I', pk);
  end if;
  alter table public.heartbeat add primary key (complejo, cancha);
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4) Tabla sin uso: `horarios_grabacion` (0 filas, ningún código la usa; la
--    reemplazó `camera_settings`).
-- ─────────────────────────────────────────────────────────────────────
drop table if exists public.horarios_grabacion;

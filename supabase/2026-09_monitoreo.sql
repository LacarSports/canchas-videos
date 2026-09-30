-- Lacar Sports — Monitoreo de Raspberry Pi + alertas del watchdog (septiembre 2026)
-- Ejecutar completo en Supabase → SQL Editor. Es idempotente (se puede correr dos veces).

-- 1) Métricas: la Pi inserta una fila cada MONITOR_INTERVAL (15 min por defecto)
--    por cada cámara/instancia. Ver lacar_pipeline.py → send_monitoreo().
create table if not exists public.monitoreo (
  id                        bigint generated always as identity primary key,
  reportado_en              timestamptz not null default now(),
  instance_id               text not null,
  complejo                  text not null,
  numero_cancha             integer,
  deporte                   text,
  hostname                  text,
  ip_local                  text,
  version                   text,
  uptime_s                  integer,
  script_uptime_s           integer,
  cpu_pct                   real,
  ram_pct                   real,
  temp_c                    real,
  disco_libre_pct           real,
  disco_libre_gb            real,
  throttled                 text,
  internet_ok               boolean,
  camara_ok                 boolean,
  camara_desfase_s          real,
  ultimo_segmento_subido    timestamptz,
  ultimo_partido_registrado timestamptz,
  segmentos_pendientes      integer,
  errores                   integer,
  ultimo_error              text
);

create index if not exists monitoreo_instance_reportado_idx
  on public.monitoreo (instance_id, reportado_en desc);

-- RLS activado y SIN policies: solo la service role (Pi y watchdog) lee/escribe.
alter table public.monitoreo enable row level security;

-- 2) Último reporte de cada instancia (lo usa el watchdog).
--    security_invoker: la vista respeta el RLS de la tabla (anon no ve nada).
create or replace view public.monitoreo_ultimo
with (security_invoker = true) as
select distinct on (instance_id) *
from public.monitoreo
where reportado_en > now() - interval '7 days'
order by instance_id, reportado_en desc;

-- 3) Alertas: una fila por problema detectado. Mientras resuelta_en es null la
--    alerta está abierta y no se vuelve a notificar (evita spam de correos).
create table if not exists public.alertas_monitoreo (
  id                bigint generated always as identity primary key,
  instance_id       text not null,
  complejo          text,
  numero_cancha     integer,
  deporte           text,
  tipo              text not null,   -- sin_reporte | camara_caida | temperatura | disco | energia | reloj | errores | atraso
  detalle           text,
  abierta_en        timestamptz not null default now(),
  resuelta_en       timestamptz,
  notificado_dueno  boolean not null default false
);

create unique index if not exists alertas_una_abierta_por_tipo
  on public.alertas_monitoreo (instance_id, tipo)
  where resuelta_en is null;

alter table public.alertas_monitoreo enable row level security;

-- 4) Retención: las métricas de más de 30 días no sirven. Borrar a mano cada
--    tanto, o programarlo con pg_cron (Database → Extensions → pg_cron):
--
--   select cron.schedule('limpiar-monitoreo', '0 5 * * *',
--     $$ delete from public.monitoreo where reportado_en < now() - interval '30 days' $$);

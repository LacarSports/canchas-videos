# Plan: bloques horarios por complejo (pendiente de implementar)

Algunos clubes arriendan en bloques distintos a la hora clásica, por ejemplo
`08:00-09:30, 09:30-11:00, 11:00-12:30…`. Hoy todo el sistema asume bloques de 1 hora
(07:00 a 24:00). Este plan deja listo **cómo** cambiarlo; se implementa cuando el club
confirme sus horas.

## Decisiones (oct-2026)

- El horario es **el mismo todos los días** → una sola lista de bloques.
- Por ahora **todas las canchas de un complejo usan los mismos bloques** → se guarda en
  `complejos`. Si algún día una cancha necesita otros, se agrega `camaras.bloques` como
  excepción (si está lleno, gana sobre el del complejo).
- Vacío = hora clásica (07:00–24:00 de a 1 hora), así los complejos actuales no cambian.
- Cada bloque debe empezar y terminar en **múltiplos de 5 minutos** (la cámara graba
  archivos de 5 min: 8:00, 9:30, 11:00 sirven; 9:45 sirve; 9:47 no).
- Un bloque puede pasar de medianoche solo si termina a las 24:00 exactas.

## Dónde se configura

```sql
alter table public.complejos add column if not exists bloques text;
-- Ejemplo para un club con bloques de 90 min:
update public.complejos
set bloques = '08:00-09:30,09:30-11:00,11:00-12:30,12:30-14:00,14:00-15:30,15:30-17:00,17:00-18:30,18:30-20:00,20:00-21:30,21:30-23:00'
where name_complex = 'Appadel';
```

Cambiar los bloques = editar ese texto en Supabase (Table Editor → complejos). Nada más:
la Pi y el panel lo leen solos.

## Cambios en el código

### Raspberry (`lacar_pipeline.py`)
- Al arrancar y cada hora: leer `complejos.bloques` (y `camaras.bloques` si existe) con la
  service_role; si falla, usar la última lista conocida (guardada en `state/<inst>/bloques.json`).
- Reemplazar `match_start_hours` (lista de horas) por una lista de bloques
  `[(inicio_min, fin_min), …]`. `get_match_hour()` → `get_bloque(dt)` que devuelve el bloque
  que contiene ese instante.
- La clave interna de un partido sigue siendo `<fecha>_<HHMM del inicio>` (ej.
  `2026-10-02_0930`): con hora clásica queda idéntica a la actual, así que es compatible
  con lo ya guardado en la Pi.
- `partidos.hora` = `"08:00-09:30"` (hoy `"08:00-09:00"`), `duracion_minutos` real.
- `camera_settings.hora` y `ocupacion_canchas.hora` = inicio del bloque (`"09:30"`).
- Carpeta R2: `…/<fecha>/0930/` (inicio del bloque).
- "Partido terminado" = fin del bloque (no `hora + 1`). El aviso de partido incompleto
  compara contra la duración del bloque, no contra 60 min.

### Panel (`app/auth/complejo/dashboard/page.tsx`)
- `HORA_SLOTS` (hoy fijo, 07:00–23:00) pasa a venir del complejo: `/api/my-complejo`
  devuelve `{ complejo, bloques }` y el panel arma las columnas con el inicio de cada bloque
  (`"08:00"`, `"09:30"`…) y las rotula `08:00–09:30`.
- Como el panel ya compara por los primeros 5 caracteres de la hora (`hora.slice(0, 5)`),
  Configuración, Ocupación y "ver el partido de ese horario" funcionan con los inicios de
  bloque sin más cambios.
- Reportes (gráfico "partidos por hora"): agrupar por bloque en vez de por hora.

### Web pública
- La búsqueda ya lee las horas disponibles desde `partidos.hora`, así que mostrará
  `08:00-09:30` sin cambios. Revisar solo que el texto se vea bien en el selector.

## Prueba antes de usarlo en un club
1. Poner bloques en el complejo de prueba (ej. `…,18:30-20:00,20:00-21:30`).
2. Ver en el log de la Pi `Partido en curso: <fecha> 18:30` y al cierre
   `Registrado … 18:30-20:00` con ~90 min.
3. En el panel: la grilla muestra los bloques; bloquear `20:00-21:30` y verificar en el log
   `BLOQUEADA` para ese bloque.

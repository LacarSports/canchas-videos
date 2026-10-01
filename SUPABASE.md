# Estructura de Supabase — Lacar Sports

> **Mantener actualizado:** cada vez que se agregue/modifique una tabla, columna, política RLS
> o configuración de Auth, actualizar este archivo en el mismo cambio. Los scripts SQL
> ejecutados viven en `supabase/*.sql`.

Proyecto: `soyoxtzfedkgmiiiwllm.supabase.co`

## Autenticación (Supabase Auth)

- **Un solo sistema de login para todos** (jugadores y dueños de complejos), email/password
  y Google OAuth. La diferencia entre jugador y admin no está en el login sino en los datos:
  si el correo del usuario aparece en `complejos.owner_email`, es dueño de ese complejo.
- Jugadores se registran solos en `/login` (nombre y apellido + correo + contraseña,
  aceptando T&C; versión aceptada guardada en `perfiles`). Sin confirmación de correo
  (desactivada para reducir fricción).
- Administradores de un complejo: la persona se registra sola en `/login` (o se crea a mano
  en Dashboard → Authentication → Users) y se agrega su correo en `complejos.owner_email`.
  Admite **varios correos separados por coma** (`dueno@club.cl, encargado@club.cl`); se
  comparan sin importar mayúsculas ni espacios (`lib/complejos.ts`). Un correo administra un
  solo complejo.
- La sesión persiste en localStorage del navegador (cliente `lib/supabase.ts`); el token se
  renueva solo. `lib/useSession.ts` expone el hook `useSession()` para componentes cliente.
- Ver un partido (`/partido/[id]`) exige sesión (gate en `app/partido/[id]/AuthGate.tsx`).
  Buscar/navegar es libre. En `/jugada/[id]` ver es libre, descargar exige sesión.

## Mapa rápido (estado al 30-sep-2026)

Todas las tablas se unen por el **texto** del complejo (`complejos.name_complex`, ej.
"Complejo Las Condes") + `numero_cancha` + `deporte`. No hay IDs de complejo: un nombre
escrito distinto (tilde, mayúscula) es otro complejo.

| Tabla | Quién escribe | Quién lee | Se borra | Para qué |
|---|---|---|---|---|
| `complejos` | Tú (a mano) | API servidor | nunca | Clientes y correo del dueño |
| `camaras` | Tú (a mano) | Panel | nunca | Canchas instaladas (fuente de verdad de nombres) |
| `partidos` | Raspberry | Web, panel | **7 días** (pg_cron) | Un video por cancha y hora |
| `jugadas` | Jugadores | Web, panel | con su partido (cascade) | Clips destacados |
| `camera_settings` | Panel (API) | Raspberry, panel | 30 días después de la fecha | Público / privado / bloqueado por hora |
| `ocupacion_canchas` | Raspberry | Panel | nunca | ¿Hubo gente cada hora? |
| `heartbeat` | Raspberry | Panel (Monitoreo) | se sobrescribe | Última señal de vida por cancha |
| `monitoreo` | Raspberry | Watchdog | 30 días | Métricas de cada Pi cada 15 min |
| `alertas_monitoreo` | Watchdog | Watchdog | resueltas, 90 días | Problemas abiertos/cerrados |
| `visitas_partidos` | API servidor | Panel (Reportes) | nunca | Cada reproducción |
| `usuarios_complejo` | API servidor | Panel (Reportes) | nunca | Resumen por visitante |
| `perfiles` | Trigger de Auth | El propio usuario | nunca | Nombre + aceptación de T&C |
| `descargas_clips` | Jugadores | Solo servicio | nunca (legal) | Quién descargó qué clip |
| `reportes` | API servidor | Tú | nunca | Reportes de problemas |

Borrados automáticos: `supabase/2026-09_mantenimiento.sql` (pg_cron, ver Integrations →
Cron). Los **videos** los borra R2 a los 7 días con una regla del bucket
(Cloudflare → R2 → canchas-videos → Settings → Object lifecycle: "Borrar videos después
de 7 días", prefijo `processed/`).

> **Seguridad (`supabase/2026-10_seguridad.sql`):** la anon key es pública (va en la web),
> así que todo lo que ella pueda leer/escribir lo puede cualquiera.
> - `partidos`: lectura pública **sin** `password_hash` ni `raw_url` (grants por columna);
>   escritura solo con service_role. ⚠️ No usar `select("*")` sobre `partidos` desde el
>   cliente: falla por permisos. La clave de un partido privado se verifica en el
>   servidor (`/api/video-auth`).
> - `camera_settings`: solo lectura para usuarios con sesión, sin `password_hash` (el panel
>   usa la columna generada `tiene_clave`); escritura solo por `/api/camera-slot`, que
>   verifica que el token sea del dueño del complejo.
> - `reportes`: sin acceso desde el cliente.
> - Siguen legibles con la anon key (datos poco sensibles, pendiente de revisar):
>   `camaras`, `heartbeat`, `ocupacion_canchas`, `visitas_partidos`, `usuarios_complejo`.
> - **Limitación conocida:** los videos están en un bucket R2 público con rutas predecibles
>   (`processed/<complejo>/<deporte>/<cancha>/<fecha>/<HH00>/playlist.m3u8`). Un partido
>   "privado" oculta el reproductor, pero quien adivine la URL puede ver el video. Cerrarlo
>   requiere URLs firmadas o servir el video por un proxy con verificación.

## Tablas

### `partidos`
Un partido grabado por cancha/bloque. Columnas usadas por el código: `id`, `complejo`,
`numero_cancha`, `ciudad`, `fecha`, `hora`, `duracion_minutos`, `archivo_url` (ruta en R2 o
URL completa), `privado` (bool), `password_hash` (bcrypt, si el bloque era privado),
`deporte`. Retención 7 días: R2 borra los videos (regla del bucket) y pg_cron borra la fila
(`lacar-borrar-partidos`).

### `jugadas`
Clips destacados guardados por jugadores desde el reproductor. `id`, `partido_id`
(FK a `partidos`, **ON DELETE CASCADE**), `etiqueta`, `inicio_seg`, `fin_seg`, `duracion`,
`creado_en`. Alimenta la página pública `/jugada/[id]` y el sidebar del partido. Máximo
120 s por clip (validado en app y API). **Retención (T&C aug26):** al borrarse el partido
a los 7 días, sus `jugadas` se eliminan automáticamente por el cascade (y con ellas las
páginas `/jugada/[id]`), cumpliendo la regla de que ningún material del partido sobrevive
al plazo. La trazabilidad de quién descargó vive aparte en `descargas_clips`, que NO se
borra (no guarda video, solo el registro).

### `complejos`
Complejos clientes. `id`, `name_complex`, `owner_email` (uno o varios correos separados por
coma). **RLS bloquea lectura anónima**; la resolución correo→complejo se hace server-side
con la service role key, siempre con `complejoDeAdmin()` de `lib/complejos.ts` (la usan
`/api/my-complejo`, `/api/camera-slot`, `/api/visita` y el watchdog). No comparar
`owner_email` con `.eq()`: falla cuando hay varios correos. `name_complex` es el string que une casi todas las tablas (`complejo`).

### `camaras`
Cámaras físicas instaladas (fuente de verdad de canchas): `complejo`, `numero_cancha`,
`deporte`, `activa`. UNIQUE(complejo, numero_cancha, deporte) — la misma cancha puede
existir en dos deportes. El panel de cada complejo muestra (Ocupación, Cámaras/Configuración)
**solo sus filas con `activa = true`**: para sacar una cancha del panel sin borrarla, poner
`activa = false`.

### `camera_settings`
Configuración por bloque horario (grilla "Configuración" del panel): una fila por
(`complejo`, `numero_cancha`, `deporte`, `fecha`, `hora "HH:00"`). `estado`
`publico|privado|bloqueado`, `graba` bool, `password_hash` (bcrypt de la clave del bloque
privado). Escrituras vía `app/api/camera-slot/route.ts`.

### `ocupacion_canchas`
La llena la Raspberry según movimiento detectado (independiente de si hay video). Columnas:
`id` (uuid PK), `complejo`, `numero_cancha` (int), `deporte`, `fecha`, `hora` ("HH:00"),
`ocupada`, `detectado_en`. **No tiene UNIQUE** por bloque: la Pi hace GET y luego
PATCH/POST para no duplicar. Alimenta la pestaña Ocupación del panel.

> **Regla de strings:** `complejo`, `numero_cancha` y `deporte` que escribe la Pi salen
> de su `.env` (`COMPLEJO_NOMBRE`, `CANCHA`, `DEPORTE`) y deben ser **idénticos** a la
> tabla `camaras` (`Pádel`, no `Padel`). Si no, el panel no enlaza videos/ocupación con
> la cancha y `camera_settings` no se aplica. La Pi lo verifica al arrancar.

### `heartbeat`
Estado de las cámaras (pestaña Monitoreo del panel, filtrada por complejo). Columnas:
`complejo` + `cancha` (text) = **PK** (desde `2026-09_mantenimiento.sql`; antes era solo
`cancha` y los complejos se pisaban), `ultimo_heartbeat`, `estado`
(online|sin_internet|error|offline), `ip_local`, `detalle`. La Pi hace upsert por la PK.
⚠️ No existe `instance_id`: enviar una columna inexistente hace que PostgREST rechace el
heartbeat completo (pasó de mayo a septiembre 2026). Dos cámaras de la misma cancha en
distinto deporte comparten fila: para el detalle por cámara está `monitoreo`.

### `monitoreo` (septiembre 2026)
Métricas de cada Raspberry, una fila cada ~15 min por instancia (`instance_id` =
`<hostname>/<INSTANCE_ID>`, ej. `lacar-pi-0/camara1`, único entre todas las Pi): `reportado_en`, `complejo`, `numero_cancha`, `deporte`,
`hostname`, `ip_local`, `version`, `uptime_s`, `script_uptime_s`, `cpu_pct`, `ram_pct`,
`temp_c`, `disco_libre_pct`, `disco_libre_gb`, `throttled` (salida de
`vcgencmd get_throttled`, "0x0" = OK), `internet_ok`, `camara_ok`, `camara_desfase_s`,
`ultimo_segmento_subido`, `ultimo_partido_registrado`, `segmentos_pendientes`, `errores`,
`ultimo_error`. RLS sin policies (solo service role). Vista **`monitoreo_ultimo`**
(`security_invoker`): último reporte por instancia de los últimos 7 días. Retención
sugerida 30 días (pg_cron comentado en el SQL).

### `alertas_monitoreo` (septiembre 2026)
Estado de las alertas del watchdog (`app/api/cron/watchdog/route.ts`): `instance_id`,
`complejo`, `numero_cancha`, `deporte`, `tipo` (sin_reporte|camara_caida|temperatura|
disco|energia|reloj|errores|atraso), `detalle`, `abierta_en`, `resuelta_en` (null =
abierta), `notificado_dueno`. Índice único parcial: una alerta abierta por
(instance_id, tipo). RLS sin policies.

### `visitas_partidos`
Una fila por reproducción de video: `partido_id`, `complejo`, `session_id` (anónimo, de
localStorage), `user_id` (uuid, null si no había sesión — agregado ago-2026), `visited_at`.
Se registra en el primer `play` vía `app/api/visita/route.ts`. **No** se cuenta al dueño
del complejo viendo sus propios videos (el API lo verifica contra `complejos.owner_email`).

### `usuarios_complejo`
Resumen por visitante y complejo. UNIQUE(complejo, session_id): `primera_visita`,
`ultima_visita`, `total_visitas`, `user_id` (agregado ago-2026). Alimenta los KPIs de
usuarios del panel Reportes.

### `reportes`
Reportes de problemas sobre la plataforma: `origen` 'jugador'|'complejo', `comentario`,
`complejo`, `numero_cancha`, `partido_id`, `email_reportante`, `dispositivo`, `navegador`,
`url_pagina`, `estado` 'pendiente'|'resuelto'. Insertados con service role vía
`app/api/reportes/route.ts` (además envía email por Resend a `ADMIN_EMAIL`).

### `perfiles` (agosto 2026)
Una fila por usuario de Auth. `id` (= auth.users.id), `email`, `nombre` (lo escribe el
trigger desde user_metadata: `nombre` del formulario de /login, o `full_name`/`name` de
Google), `accepted_tos_at`, `tos_version` (versión del documento de T&C aceptado; vigente:
`'2026-08'`), `created_at`. Se crea automáticamente con el trigger `on_auth_user_created`
(función `handle_new_user`, security definer). RLS: cada usuario lee/edita solo su fila.
Si los T&C cambian de forma sustancial: subir la versión en el trigger y comparar
`perfiles.tos_version` contra la versión vigente para pedir re-aceptación (pendiente de
implementar cuando ocurra).
Sirve como **prueba de consentimiento** de T&C (Ley 21.719). Cuentas antiguas de dueños
tienen `accepted_tos_at = null` (creadas a mano, sin aceptación online).

### `descargas_clips` (agosto 2026)
Trazabilidad de clips: quién descargó/guardó qué. `user_id`, `email`, `partido_id`,
`jugada_id` (text sin FK: deben sobrevivir al borrado del partido a los 7 días),
`complejo`, `inicio_seg`, `fin_seg`, `etiqueta`, `tipo` 'descarga'|'destacado', `origen`
'partido'|'jugada', `created_at`. RLS: authenticated inserta/lee solo sus propias filas;
para investigar un clip difundido usar service role o el SQL Editor. Se inserta desde
`lib/descargas.ts` (`registrarDescarga()`).

## Configuración del Dashboard (no SQL)

- **Authentication → Sign In / Providers**: "Allow new users to sign up" debe estar
  **activado** (los jugadores se registran solos). Proveedor Google: requiere OAuth Client
  en Google Cloud Console con redirect `https://soyoxtzfedkgmiiiwllm.supabase.co/auth/v1/callback`.
- **Authentication → URL Configuration** — ⚠️ crítico, aquí se cae el login con Google:
  - **Site URL** = dominio de producción (NO dejar el `http://localhost:3000` que viene por
    defecto). Supabase usa este valor como destino de respaldo, y si el `redirectTo` que
    manda la app no está en la lista de abajo, **lo ignora y manda a Site URL** — ese es el
    síntoma de "inicio sesión con Google y termino en localhost".
  - **Redirect URLs** debe incluir todas las variantes que se usan:
    `https://lacarsports.cl/**`, `https://www.lacarsports.cl/**` y
    `http://localhost:3000/**`. El código manda `window.location.origin + next`
    (`app/login/page.tsx`), o sea rutas profundas tipo `/partido/<id>`: por eso el `/**`.
- **Marca en la pantalla de consentimiento de Google**: Google muestra el host del callback
  (`soyoxtzfedkgmiiiwllm.supabase.co`) en vez de "Lacar Sports" porque el callback vive en
  el dominio compartido de Supabase. Configurar App name + logo en Google Cloud → OAuth
  consent screen ayuda, pero para que desaparezca la URL de Supabase hace falta el add-on
  de **Custom Domain** de Supabase (de pago), que deja el callback en
  `auth.lacarsports.cl`. Es cosmético: el login funciona igual sin eso.
- **Confirm email**: **desactivado** (Authentication → Sign In / Providers → Email →
  "Confirm email" OFF). El registro entra directo, sin paso de confirmación.

## Variables de entorno (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente público.
- `SUPABASE_SERVICE_ROLE_KEY` — solo server-side: `api/my-complejo`, `api/reportes`,
  `api/visita` (verificación de dueño).
- `NEXT_PUBLIC_R2_PUBLIC_URL` — base pública de videos en Cloudflare R2.
- `RESEND_API_KEY`, `ADMIN_EMAIL`, `RESEND_FROM` — emails de reportes y del watchdog.
- `CRON_SECRET` — protege `/api/cron/watchdog` (Vercel Cron lo envía como
  `Authorization: Bearer <CRON_SECRET>`).
- `WATCHDOG_ALERTAR_DUENOS` — `true` para que el watchdog avise también a los dueños
  (`complejos.owner_email`). Por defecto solo avisa a `ADMIN_EMAIL`.

La Raspberry usa sus propios archivos (`/opt/lacar/comun.env` + `.env.camaraN`, ver
`Lacar System/comun.env.example` y `camara.env.example`) con la
**service_role** key: acceso total a la BD, riesgo conocido (pendiente migrar a un
endpoint de ingesta con token por dispositivo).

## Historial de scripts

| Archivo | Qué hace |
|---|---|
| `supabase/2026-08_cuentas_jugadores.sql` | Crea `perfiles` + trigger, `descargas_clips`, agrega `user_id` a visitas |
| `supabase/2026-09_monitoreo.sql` | Crea `monitoreo`, vista `monitoreo_ultimo` y `alertas_monitoreo` (Raspberry + watchdog) |
| `supabase/2026-09_mantenimiento.sql` | pg_cron (partidos 7 días, monitoreo 30, camera_settings 30, alertas 90), PK de `heartbeat` = (complejo, cancha), borra `horarios_grabacion` (sin uso) |
| `supabase/2026-10_seguridad.sql` | Cierra `partidos`/`camera_settings`/`reportes` a la anon key: sin `password_hash`, sin escritura, `camera_settings.tiene_clave` |

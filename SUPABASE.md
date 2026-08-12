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
- Cuentas de dueños se crean a mano en Dashboard → Authentication → Users, y se asocian
  agregando su correo en `complejos.owner_email`.
- La sesión persiste en localStorage del navegador (cliente `lib/supabase.ts`); el token se
  renueva solo. `lib/useSession.ts` expone el hook `useSession()` para componentes cliente.
- Ver un partido (`/partido/[id]`) exige sesión (gate en `app/partido/[id]/AuthGate.tsx`).
  Buscar/navegar es libre. En `/jugada/[id]` ver es libre, descargar exige sesión.

## Tablas

### `partidos`
Un partido grabado por cancha/bloque. Columnas usadas por el código: `id`, `complejo`,
`numero_cancha`, `ciudad`, `fecha`, `hora`, `duracion_minutos`, `archivo_url` (ruta en R2 o
URL completa), `privado` (bool), `password_hash` (bcrypt, si el bloque era privado),
`deporte`. Los videos se eliminan a los ~7 días (política de retención de los T&C).

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
Complejos clientes. `id`, `name_complex`, `owner_email`. **RLS bloquea lectura anónima**;
la resolución dueño→complejo se hace server-side en `app/api/my-complejo/route.ts` con la
service role key. `name_complex` es el string que une casi todas las tablas (`complejo`).

### `camaras`
Cámaras físicas instaladas (fuente de verdad de canchas): `complejo`, `numero_cancha`,
`deporte`, `activa`. UNIQUE(complejo, numero_cancha, deporte) — la misma cancha puede
existir en dos deportes.

### `camera_settings`
Configuración por bloque horario (grilla "Configuración" del panel): una fila por
(`complejo`, `numero_cancha`, `deporte`, `fecha`, `hora "HH:00"`). `estado`
`publico|privado|bloqueado`, `graba` bool, `password_hash` (bcrypt de la clave del bloque
privado). Escrituras vía `app/api/camera-slot/route.ts`.

### `ocupacion_canchas`
La llena la Raspberry según movimiento detectado (independiente de si hay video). Incluye
`deporte`. Alimenta la pestaña Ocupación del panel.

### `heartbeat`
Estado de las cámaras (monitoreo). Agrupado por número de cancha (sin deporte).

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
- `RESEND_API_KEY`, `ADMIN_EMAIL`, `RESEND_FROM` — emails de reportes.

## Historial de scripts

| Archivo | Qué hace |
|---|---|
| `supabase/2026-08_cuentas_jugadores.sql` | Crea `perfiles` + trigger, `descargas_clips`, agrega `user_id` a visitas |

# Plan: horarios flexibles (arriendos de 60, 90 o 120 min) + EasyCancha

Reemplaza al plan anterior de "bloques fijos por complejo", que se descartó: en los clubes
cada arriendo puede durar 60, 90 o 120 minutos y empezar en cualquier media hora, así que
no existe una grilla fija de bloques.

Estado: **pendiente de implementar** (decidido 1-oct-2026). Mientras tanto el sistema sigue
con la hora clásica (bloques de 1 h, 07:00–24:00).

---

## Idea

1. La Pi graba todo el día (ya lo hace) y sube el video en **tramos de 30 minutos**.
2. El jugador busca complejo + cancha + fecha y ve una **línea de tiempo del día**: los tramos
   con video, y en verde los que tuvieron gente según la cámara.
3. Elige solo **hora de inicio** (en pasos de 30 min) y **duración** (60 / 90 / 120 min).
4. La plataforma arma el video exacto de esa ventana juntando los tramos.

Ejemplo: alguien arrendó 11:00–12:30 → elige "11:00 · 90 min". El que llegó a las 12:30 por
1 hora elige "12:30 · 60 min". Sin cruces y sin la lista larga de combinaciones (estilo
Beelup).

Descartado: cortar partidos por detección de movimiento (si un grupo entra justo cuando sale
otro, la cancha nunca queda vacía y no hay corte que detectar). La detección se sigue usando
para la ocupación y para pintar en verde la línea de tiempo.

---

## Modelo de datos

### Nueva tabla `tramos` (la escribe la Pi)
Un tramo = 30 min de video de una cancha.

| Columna | Ejemplo |
|---|---|
| `complejo`, `numero_cancha`, `deporte` | Appadel · 1 · Pádel |
| `fecha`, `inicio` | 2026-10-05 · `"11:00"` |
| `playlist_url` | URL R2 del `.m3u8` del tramo (`…/2026-10-05/1100/playlist.m3u8`) |
| `duracion_seg` | 1800 (menos si hubo corte de luz) |
| `actividad` | proporción de muestras con personas (0–1) |
| `estado` | publico / privado / bloqueado (copiado de `camera_settings` al cerrarlo) |

UNIQUE(complejo, numero_cancha, deporte, fecha, inicio). Se borra a los 7 días (pg_cron,
igual que `partidos`). RLS: lectura pública de columnas no sensibles; escritura solo
service_role.

### `partidos` pasa a ser "una ventana elegida"
La primera vez que alguien abre "Appadel · cancha 1 · 2026-10-05 · 11:00 · 90 min", el
servidor crea (o reutiliza si ya existe) una fila en `partidos` con `hora = "11:00-12:30"`,
`duracion_minutos = 90` y `archivo_url = /api/ventana/<id>.m3u8`. Así **siguen funcionando sin
cambios**: el enlace para compartir, `jugadas` (clips con segundos relativos al partido),
`visitas_partidos`, `descargas_clips` y el borrado a los 7 días.

### `camera_settings` y `ocupacion_canchas`
Pasan de filas por hora a filas por tramo de 30 min (`hora = "11:30"`). El panel del dueño
muestra columnas de media hora. Una ventana es privada/bloqueada si **alguno** de sus tramos
lo es (lo más restrictivo gana).

---

## Cambios por pieza

### Raspberry (`lacar_pipeline.py`)
- Agrupar archivos de la cámara por tramo de 30 min en vez de por hora (los archivos son de
  5 min, así que cada tramo = 6 archivos).
- Al cerrar cada tramo: playlist final en R2, fila en `tramos` (con `actividad`), fila en
  `ocupacion_canchas`. Ya **no** decide si "hubo partido": sube todo lo que no esté
  bloqueado. (Los tramos sin nadie igual ocupan poco y se borran a los 7 días.)
- Ya no borra de R2 por "sin actividad" (era la heurística que fallaba con arriendos
  seguidos). Opcional: no subir tramos con actividad 0 fuera del horario de atención.

### Web
- `/api/ventana`: recibe cancha + fecha + inicio + duración, valida que existan los tramos
  y que ninguno esté bloqueado, crea/reutiliza la fila en `partidos` y devuelve su id.
- `/api/ventana/<id>.m3u8`: arma la playlist uniendo las de los tramos (con
  `#EXT-X-DISCONTINUITY` entre tramos). Si alguno es privado, exige la clave
  (`/api/video-auth` ya existe).
- Buscador: complejo → cancha → fecha → **línea de tiempo** (tramos con/sin video, verde =
  actividad) → selector de inicio + duración (60/90/120).
- Panel del dueño: columnas de 30 min en Configuración y Ocupación.

### Compatibilidad
Los partidos de 1 hora ya grabados quedan como están hasta que se borren a los 7 días.
Se puede activar por complejo (columna `complejos.modo_tramos boolean`) para probar en la Pi
de casa antes de pasar Appadel.

---

## Integración con EasyCancha (fase 2)

**Qué permitiría:**
1. **El jugador no busca su partido:** "Tu partido del sábado 11:00–12:30 en Appadel ya está
   disponible" (y se puede mostrar directo al entrar).
2. **Alerta al dueño de uso no arrendado:** si la cámara detecta gente de forma sostenida en
   un tramo sin reserva en EasyCancha → aviso al dueño (por el mismo sistema de alertas del
   watchdog).

**Cómo obtener las reservas** (investigado 1-oct-2026: EasyCancha no publica una API ni
integraciones en su sitio para clubes), en orden de preferencia:

| Opción | Cómo | Pros / contras |
|---|---|---|
| 1. Acuerdo con EasyCancha | Pedirles acceso a una API o webhook de reservas por club. Propuesta de valor para ellos: "tus reservas incluyen el video del partido". | Lo correcto y estable. Depende de que acepten. |
| 2. Calendario del club | Si el panel de EasyCancha del club permite sincronizar con Google Calendar o exportar un enlace iCal/CSV, leer ese calendario cada pocos minutos. | No depende de EasyCancha como empresa. Hay que confirmar si existe en el panel del club. |
| 3. Correos de reserva | Si el club recibe un correo por cada reserva, reenviarlos automáticamente a un buzón de Lacar y leerlos. | Funciona sin nadie más, pero se rompe si cambian el formato del correo. |
| ✗ No hacer | Entrar al panel de EasyCancha con la clave del club y "raspar" la página. | Frágil, probablemente contra sus términos, y obliga a guardar credenciales del club. |

**Siguientes pasos (no técnicos):**
- Preguntarle al administrador de Appadel si su panel de EasyCancha tiene "exportar",
  "sincronizar con Google Calendar" o si le llega un correo por cada reserva.
- Escribir a EasyCancha (área de clubes / alianzas) planteando la integración.

**Cuidados para la alerta de uso no arrendado:**
- Solo en el horario de atención del club y con actividad sostenida (ej. ≥ 70 % de las
  muestras del tramo), para no alertar por el personal limpiando o alguien que cruza.
- Considerar clases, escuelas y torneos que el club no registra como reserva: permitir que
  el dueño marque horarios "propios" que no generan alerta.
- Empezar como reporte diario ("ayer hubo 3 tramos con gente sin reserva") antes de alertas
  en tiempo real, para calibrar.

---

## Orden sugerido
1. Tramos de 30 min en la Pi + tabla `tramos` (probar en la Pi de casa).
2. Ventanas en la web (línea de tiempo + inicio/duración) y `partidos` como ventana.
3. Panel del dueño con columnas de 30 min.
4. Activar en Appadel.
5. EasyCancha, según la opción que resulte viable.

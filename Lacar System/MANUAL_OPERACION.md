# Lacar Sports — Manual de operación de la Raspberry Pi

Este manual es para **operar** el sistema ya instalado: entender qué hace, revisar que
funciona, diagnosticar problemas y actualizar el script. La instalación desde cero está en
`GUIA_SETUP_RASPBERRY.md`.

---

## 1. Qué hace el sistema

```
 CÁMARA DAHUA                RASPBERRY PI                         NUBE
 ────────────                ────────────                         ────
 Graba 24/7 en su     ┌──► lacar_pipeline.py (1 por cámara) ──┬──► Cloudflare R2
 tarjeta SD, en       │    cada 30 s:                         │    (los videos: trozos .ts
 archivos .dav de     │    1. ¿hay personas? (muestra)        │     de 6 s + playlist.m3u8)
 5 minutos            │    2. lista archivos nuevos de la SD  │
        │             │    3. descarga .dav (red local)       └──► Supabase
        └─────────────┘    4. ffmpeg: .dav → trozos .ts            (partidos, ocupación,
          red local        5. sube los .ts a R2 (8 en paralelo)     heartbeat, monitoreo)
          (HTTP)           6. al terminar la hora: registra
                              el partido en Supabase                     │
                                                                         ▼
                                                        lacarsports.cl lee `partidos` y
                                                        reproduce el video desde R2
```

**La cámara no sabe nada de Lacar.** Solo graba en su SD. La Pi es la que le pregunta
"¿qué archivos tienes?", se los descarga, los convierte y los sube. Por eso, si la Pi se
apaga un rato, al volver puede recuperar lo que la cámara grabó mientras tanto (la SD
guarda varios días).

### El ciclo de un partido (ej. bloque 19:00–20:00)

| Hora | Qué pasa |
|---|---|
| 19:00–20:00 | Cada 30 s la Pi pregunta a la cámara si detecta personas y lo anota. |
| 19:05, 19:10, … | Cada vez que la cámara cierra un archivo de 5 min, la Pi lo descarga, lo convierte y lo sube a R2 (~1 min). |
| 20:00–20:06 | La hora terminó. La Pi sube el último archivo y decide: |
| | • **≥ 50 % de las muestras con personas** → arma la playlist final y crea la fila en `partidos`. El video aparece en la plataforma. |
| | • **Menos** → cancha vacía: borra lo subido de R2 y no publica nada. |
| | • Siempre: escribe en `ocupacion_canchas` si la cancha estuvo ocupada o no. |

Antes de subir revisa `camera_settings` (la grilla "Configuración" del panel del dueño):
- **público** (o sin configuración) → se graba y publica.
- **privado** → se publica con clave (`privado = true`, `password_hash`).
- **bloqueado** → no se sube video (y si ya se había subido algo de esa hora, se borra); solo se registra ocupación.

---

## 2. Dónde vive cada cosa

### En la Raspberry Pi (`/opt/lacar/`)

| Ruta | Qué es |
|---|---|
| `lacar_pipeline.py` | El script principal. |
| `lacar_diagnostico.py` | Revisión completa con ✅/❌ (ver §4). |
| `comun.env` | Claves de R2 y Supabase + parámetros por defecto. Iguales en todas las Pi; lo pone `desplegar.sh`. **Secreto.** |
| `.env.camara1` | Configuración propia de la cámara 1: IP, clave, complejo, deporte, cancha. Se edita en la Pi con `configurar.sh`. **Secreto.** |
| `configurar.sh` | Asistente para crear, editar, revisar y reiniciar cada cámara (ver §5.1). |
| `logs/camara1.log` | Log del script (se rota solo: máx. 3 archivos de 5 MB). |
| `state/camara1/processed_files.json` | Partidos ya terminados (últimos 7 días). |
| `state/camara1/tmp/manifest_*.json` | Trozos ya subidos del partido en curso. Se borra al cerrar el partido. |
| `state/camara1/tmp/detections_*.json` | Muestras "¿hay personas?" del partido en curso. |
| `/etc/systemd/system/lacar@.service` | El servicio que mantiene el script corriendo y lo arranca al encender. |

### En Cloudflare R2

```
processed/<COMPLEJO>/<DEPORTE>/<CANCHA>/<fecha>/<HH00>/playlist.m3u8
processed/<COMPLEJO>/<DEPORTE>/<CANCHA>/<fecha>/<HH00>/segment_0000.ts ...
```

### En Supabase (detalle en `SUPABASE.md`)

| Tabla | Quién escribe | Para qué |
|---|---|---|
| `partidos` | Pi | Un video publicado por hora. |
| `ocupacion_canchas` | Pi | Si la cancha estuvo ocupada cada hora (pestaña Ocupación). |
| `heartbeat` | Pi | "Sigo viva" (pestaña Monitoreo del panel). |
| `monitoreo` | Pi | Métricas cada 15 min: CPU, RAM, temperatura, disco, energía, cámara, errores. |
| `alertas_monitoreo` | Watchdog (Vercel) | Problemas abiertos/resueltos, para no repetir correos. |
| `camera_settings` | Panel del dueño | Público / privado / bloqueado por hora. La Pi solo lee. |
| `camaras` | Tú (a mano) | Canchas instaladas. **COMPLEJO_NOMBRE, DEPORTE y CANCHA del `.env` deben ser idénticos a esta tabla** (tildes incluidas: `Pádel`, no `Padel`). |

---

## 3. Comandos del día a día

Conéctate primero a la Pi (desde PowerShell en tu PC):

```bash
ssh lacar0@100.x.x.x
```

(`lacar0` = tu usuario de la Pi; `100.x.x.x` = su IP de Tailscale. La ves en
<https://login.tailscale.com/admin/machines>.)

### ¿Está corriendo?

```bash
systemctl status lacar@camara1
```

Busca `Active: active (running)`. Si dice `failed` o `activating (auto-restart)` está
cayéndose: mira el log.

### Ver el log en vivo (Ctrl+C para salir)

```bash
tail -f /opt/lacar/logs/camara1.log
```

### Buscar en el log

```bash
# Solo errores y advertencias recientes
grep -E "ERROR|WARNING" /opt/lacar/logs/camara1.log | tail -30

# Partidos cerrados y su resultado
grep -E "Finalizando|Registrado en Supabase|sin actividad|incompleto|resuelto" /opt/lacar/logs/camara1.log | tail -30

# Velocidad de subida (cuánto tarda cada archivo de 5 min)
grep "Segmento subido" /opt/lacar/logs/camara1.log | tail -20

# Arranques del script (reinicios, cortes de luz)
grep "Pipeline iniciado" /opt/lacar/logs/camara1.log
```

### Reiniciar / detener / arrancar

```bash
sudo systemctl restart lacar@camara1
sudo systemctl stop lacar@camara1
sudo systemctl start lacar@camara1
```

### Estado general de la Pi

```bash
uptime                     # hace cuánto está encendida y la carga
vcgencmd measure_temp      # temperatura (normal < 70 °C)
vcgencmd get_throttled     # 0x0 = energía OK. Otro valor = cargador malo / bajo voltaje
df -h /                    # espacio en disco
free -h                    # memoria
timedatectl                # hora y zona horaria (debe ser America/Santiago)
```

---

## 4. ¿La Pi ve la cámara? — Diagnóstico

### La forma fácil: el script de diagnóstico

```bash
cd /opt/lacar
python3 lacar_diagnostico.py .env.camara1
```

Revisa en orden: configuración, Pi (hora, ffmpeg, disco, temperatura, energía), cámara
(ping, usuario/clave, reloj, tarjeta SD, modo de grabación), **cuántos minutos grabó la
cámara en cada hora de hoy**, detección de personas, R2, Supabase y el servicio. Al final
muestra un resumen con todo lo que no está ✅.

Variantes:

```bash
# Además descarga un archivo y lo convierte (mide velocidad de red local y ffmpeg)
python3 lacar_diagnostico.py .env.camara1 --descarga

# Ver las grabaciones de otro día (tabla por hora)
python3 lacar_diagnostico.py .env.camara1 --fecha 2026-09-19
```

No modifica nada: se puede correr con el servicio funcionando.

### A mano, paso a paso (si quieres entender cada pieza)

**1. ¿Hay conexión de red con la cámara?**

```bash
ping -c 3 192.168.1.108
```

`0% packet loss` = hay red. `Destination Host Unreachable` = cable, energía (PoE) o IP /
subred distinta. Compara con `hostname -I` (los 3 primeros números deben coincidir).

**2. Guardar la clave de la cámara en una variable** (así no queda escrita en el historial):

```bash
read -rsp 'Clave de la cámara: ' CP; echo
CAM=192.168.1.108
```

**3. ¿Acepta usuario y clave?**

```bash
curl -s --digest -u "admin:$CP" "http://$CAM/cgi-bin/magicBox.cgi?action=getDeviceType"
```

Responde `type=DH-IPC-...` = OK. `401 Unauthorized` = clave incorrecta.

**4. ¿Qué hora tiene la cámara?** (debe coincidir con `date` de la Pi, ± 1 min)

```bash
curl -s --digest -u "admin:$CP" "http://$CAM/cgi-bin/global.cgi?action=getCurrentTime"; date
```

**5. ¿Tiene la tarjeta SD bien?**

```bash
curl -s --digest -u "admin:$CP" "http://$CAM/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo"
```

Busca `State=Success` (o `Normal`) y `TotalBytes`/`UsedBytes`.

**6. ¿Detecta personas ahora?**

```bash
curl -s --digest -u "admin:$CP" "http://$CAM/cgi-bin/eventManager.cgi?action=getEventIndexes&code=SmartMotionHuman"
```

`channels[0]=0` = hay personas en este momento. `Error ... No Events` = no hay.

---

## 5. Instalar, actualizar y configurar

La configuración está separada en dos:

| Qué | Dónde vive | Quién la cambia |
|---|---|---|
| **Lo común** a todas las Pi: claves de R2 y Supabase, parámetros por defecto | Tu PC: `Lacar System/configs/comun.env` → cada Pi: `/opt/lacar/comun.env` | Tú en el PC + `desplegar.sh` |
| **Lo de cada cámara**: IP, clave, complejo, cancha, deporte | Solo en la Pi: `/opt/lacar/.env.camaraN` | Tú en la Pi con `configurar.sh` |

Si una variable está en los dos, gana la de la cámara (sirve, por ejemplo, para poner un
`ACTIVITY_THRESHOLD` distinto en una sola cancha). `desplegar.sh` **nunca** toca la
configuración de las cámaras, y al terminar guarda un respaldo de ella en tu PC.

En tu PC:

```
Lacar System/
├── lacar_pipeline.py        ← el script (igual para todas las Pi)
├── lacar_diagnostico.py     ← diagnóstico
├── configurar.sh            ← asistente de cámaras (se usa EN la Pi)
├── lacar@.service           ← servicio systemd (igual para todas)
├── instalar.sh              ← corre EN la Pi: instala/actualiza (lo lanza desplegar.sh)
├── desplegar.sh             ← corre en tu PC
├── comun.env.example        ← plantilla de lo común (sin claves)
├── camara.env.example       ← plantilla de una cámara (sin claves)
├── configs/                 ← NO va a git (tiene claves)
│   ├── comun.env            ← claves reales, iguales para todas las Pi
│   └── respaldos/<pi>/      ← copia automática de las cámaras de cada Pi
└── _antiguo/                ← archivos viejos archivados (NO va a git)
```

### Instalar una Pi nueva o actualizar el script (desde tu PC, Git Bash)

```bash
cd "/c/Users/Isabella Blamey/canchas-videos/Lacar System"
bash desplegar.sh lacar0@100.104.119.36
```

El instalador, en la Pi: instala lo que falte (ffmpeg, python3-requests,
python3-boto3), deja la zona horaria en Santiago, quita servicios de formatos antiguos,
copia los scripts y `comun.env` a `/opt/lacar`, instala `lacar@.service`, reinicia cada
cámara configurada y muestra el diagnóstico. Se puede correr las veces que quieras. Hazlo
**entre partidos** (p. ej. a los :10 de una hora).

En una **Pi nueva** crea `.env.camara1` desde la plantilla y te dice que la configures
(paso siguiente).

### 5.1 Configurar las cámaras (en la Pi)

Conéctate a la Pi (`ssh lacar0@100.x.x.x`) y usa el asistente:

```bash
bash /opt/lacar/configurar.sh              # lista las cámaras de esta Pi y su estado
bash /opt/lacar/configurar.sh camara1      # crea o edita la cámara 1
bash /opt/lacar/configurar.sh camara2      # agrega una segunda cámara
bash /opt/lacar/configurar.sh camara2 --quitar   # apaga la cámara 2
```

Al editar se abre el archivo en `nano` (se guarda con **Ctrl+O** y Enter, se sale con
**Ctrl+X**). Al salir, el asistente revisa la configuración con el diagnóstico y te
pregunta si aplicarla (reinicia el servicio de esa cámara; pide la contraseña de la Pi).

Después de cambiar algo, guarda el respaldo en tu PC:

```bash
bash desplegar.sh lacar0@100.x.x.x --solo-respaldo
```

| Quiero cambiar… | Pasos |
|---|---|
| **Contraseña de la cámara** | 1) Cámbiala en la web de la cámara. 2) En la Pi: `configurar.sh camaraN`, cambia `CAMERA_PASS`, aplica. Hazlo seguido: entre el paso 1 y el 2 la Pi recibe "401" y tras ~1,5 min marca la cámara como caída. |
| **IP de la cámara** | Igual: cambia la IP en la cámara → `CAMERA_IP` con `configurar.sh`. |
| **Carpeta de R2** (`COMPLEJO`, el slug) | Cámbialo con `configurar.sh`. Afecta a los videos nuevos; los viejos guardan su URL completa. |
| **Nombre del complejo** (`COMPLEJO_NOMBRE`) | Es la "llave" que une todas las tablas. 1) En Supabase corre el SQL de abajo. 2) Con `configurar.sh`, cambia `COMPLEJO_NOMBRE` en cada cámara de ese complejo. Si el dueño tenía sesión abierta en el panel, que cierre sesión y vuelva a entrar. |
| **Número de cancha o deporte** | 1) En Supabase → Table Editor → `camaras`, edita la fila (o crea la nueva y marca la vieja `activa = false`). 2) Con `configurar.sh` cambia `CANCHA` / `DEPORTE` (idéntico a `camaras`, tildes incluidas). 3) Si cambió la cancha, borra la fila vieja de `heartbeat`. Los partidos ya grabados quedan con el valor antiguo y desaparecen solos a los 7 días; los bloqueos/privados futuros de la cancha vieja hay que volver a ponerlos en el panel. |
| **Umbral de actividad, recuperación, etc. para TODAS** | En tu PC edita `configs/comun.env` y corre `desplegar.sh` en cada Pi. |
| **…solo para una cámara** | Agrega la línea (ej. `ACTIVITY_THRESHOLD=0.3`) con `configurar.sh`. |
| **Claves de R2 o Supabase** | En tu PC edita `configs/comun.env` y corre `desplegar.sh` en cada Pi. |

SQL para **renombrar un complejo** (Supabase → SQL Editor; cambia los dos nombres):

```sql
begin;
update complejos         set name_complex = 'Nombre Nuevo' where name_complex = 'Nombre Viejo';
update camaras           set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update partidos          set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update camera_settings   set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update ocupacion_canchas set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update visitas_partidos  set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update usuarios_complejo set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
update descargas_clips   set complejo = 'Nombre Nuevo' where complejo = 'Nombre Viejo';
delete from heartbeat where complejo = 'Nombre Viejo';
commit;
```

(Qué es cada tabla y cómo se relacionan: ver `SUPABASE.md` → "Mapa rápido".)

**Volver atrás si una versión nueva falla:** los scripts están en git; recupera la versión
anterior (`git checkout <commit> -- "Lacar System/lacar_pipeline.py"`) y vuelve a desplegar.

---

## 6. Pruebas para dar por verificadas las mejoras

### 6.1 Subida paralela (8 hilos) — estabilidad

Tras uno o dos días funcionando:

```bash
grep "Segmento subido" /opt/lacar/logs/camara1.log | tail -50
grep -c "Error subiendo" /opt/lacar/logs/camara1.log
```

- Cada archivo de 5 min debería subir en **menos de 60 s** (se midió ~23 s). Si sube a más
  de ~4 min, la Pi no alcanza a subir al ritmo que graba la cámara → el video se atrasa
  (en monitoreo aparece como `segmentos_pendientes` alto).
- `Error subiendo` debería ser 0 o muy raro. Si hay muchos, bajar a `UPLOAD_WORKERS=4` en
  el `.env` y reiniciar.

### 6.2 Recuperación tras corte de luz

En el complejo, un corte apaga **la Pi y la cámara juntas** (y el router). Lo que pasa:

- Mientras no hay luz, la cámara no graba: ese tramo simplemente no existe en el video.
- El archivo de 5 min que la cámara estaba grabando al momento del corte puede quedar
  cortado o dañado. El script lo intenta 3 veces y, si ffmpeg no puede leerlo, lo omite.
- Al volver la luz, la Pi arranca antes que la cámara (~1–2 min) y el router puede tardar
  más en dar internet. Verás `La cámara ... no responde` / `Sin internet` y después
  `Cámara responde de nuevo`: es normal.
- La Pi retoma lo que ya estaba grabado antes del corte (ventana de `RECOVERY_HOURS`).
- Es clave que la cámara tenga **NTP activado**: si al reiniciar su reloj queda mal, los
  archivos quedan con hora equivocada (el script lo avisa con `🕒 El reloj de la cámara difiere`).

Prueba (simula el corte real: desenchufa **ambas**, la Pi y la cámara / el switch PoE):

1. Durante un bloque con gente (o moviéndote frente a la cámara), a los ~20 min de la hora,
   desenchufa todo.
2. Vuelve a enchufar a los ~:25.
3. En el log debe aparecer `Pipeline iniciado`, `Ventana de recuperación: partidos desde ...`,
   luego `Cámara responde de nuevo` y `Partido en curso ... subiendo N archivo(s)`.
4. Al terminar la hora, el partido debe aparecer en la plataforma con ~55 min (60 menos los
   ~5 min sin luz), reproduciéndose de corrido, con un salto solo en el tramo del corte.

Prueba también cruzando el cambio de hora (desenchufar a las :57, enchufar a las :03 de la
siguiente): el partido anterior debe quedar publicado y el nuevo debe seguir normal.

> Un corte de luz puede dañar la microSD de la Pi. Si el complejo tiene cortes frecuentes,
> conviene una UPS pequeña para la Pi y el switch.

### 6.3 `camera_settings` y `ocupacion_canchas`

1. En el panel del dueño (Configuración), pon la **próxima hora** como **Bloqueado**.
   - Log esperado durante esa hora: `🚫 Cancha 1 BLOQUEADA para ...`.
   - Al terminar: `📊 Ocupación registrada ...` y **ningún** partido nuevo para esa hora.
2. Pon otra hora como **Privado** con una clave.
   - Log: `🔒 Cancha 1 PRIVADA ...` y luego `Registrado en Supabase (🔒 PRIVADO)`.
   - En la plataforma el video debe pedir la clave.
3. Revisa en Supabase → SQL Editor:

```sql
select fecha, hora, ocupada, deporte, detectado_en
from ocupacion_canchas
where complejo = 'Complejo Las Condes'
order by fecha desc, hora desc limit 20;

select fecha, hora, deporte, privado, duracion_minutos
from partidos
where complejo = 'Complejo Las Condes'
order by fecha desc, hora desc limit 20;
```

Los dos deben tener el **mismo `deporte` que la tabla `camaras`** (`Pádel`).

---

## 7. Monitoreo y alertas

### Qué manda la Pi

- **`heartbeat`** cada 30 min, y al instante cuando cambia algo (se cae/vuelve internet o la
  cámara). Es lo que muestra la pestaña Monitoreo del panel.
- **`monitoreo`** cada 15 min: CPU, RAM, temperatura, disco libre, energía
  (`throttled`), internet, cámara, diferencia de reloj cámara/Pi, último archivo subido,
  último partido registrado, archivos pendientes y cantidad de errores.

Última foto de cada Pi (SQL Editor):

```sql
select instance_id, reportado_en, camara_ok, internet_ok, temp_c, cpu_pct, ram_pct,
       disco_libre_pct, throttled, segmentos_pendientes, errores, ultimo_error
from monitoreo_ultimo;
```

Alertas abiertas:

```sql
select * from alertas_monitoreo where resuelta_en is null order by abierta_en desc;
```

### Qué revisa el watchdog (en Vercel: `/api/cron/watchdog`)

Hoy corre **una vez al día (~10:00 hora Chile)**, que es lo que permite el plan gratis de
Vercel (`vercel.json`, `"schedule": "0 13 * * *"` en UTC). Con el plan Pro se cambia a
`"*/5 * * * *"` para revisar cada 5 minutos. También se puede llamar a mano:
`curl -H "Authorization: Bearer <CRON_SECRET>" https://lacarsports.cl/api/cron/watchdog`.
Con una sola revisión diaria, el aviso al dueño llega recién al día siguiente de abierta
la alerta; por eso conviene dejar `WATCHDOG_ALERTAR_DUENOS` apagado hasta tener el plan Pro.

| Alerta | Cuándo | ¿Avisa al dueño? |
|---|---|---|
| `sin_reporte` | La Pi no reporta hace ≥ 35 min (apagada, sin internet o script caído) | Sí, si dura ≥ 30 min |
| `camara_caida` | La Pi no logra hablar con la cámara | Sí, si dura ≥ 30 min |
| `temperatura` | CPU ≥ 80 °C | No |
| `disco` | < 10 % libre en la Pi | No |
| `energia` | `throttled` ≠ `0x0` (bajo voltaje / calor) | No |
| `reloj` | Cámara y Pi difieren > 2 min | No |
| `errores` | ≥ 5 errores en 15 min | No |
| `atraso` | ≥ 6 archivos esperando subida (30 min de atraso) | No |

A ti (`ADMIN_EMAIL`) te llega un correo técnico cuando se abre y cuando se resuelve cada
alerta. Al dueño, uno simple ("la cámara de la cancha 1 no está funcionando desde las
HH:MM") y otro cuando vuelve — solo si `WATCHDOG_ALERTAR_DUENOS=true` en Vercel.

---

## 8. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Log: `La cámara 192.168.x.x no responde` | Cámara sin energía / cable / cambió de IP | `ping`; revisar PoE del switch; en el router ver si la cámara tomó otra IP (debe tener IP fija). |
| Log (WARNING) de vez en cuando: `No se pudo listar ... Invalid session in request data!` | Particularidad de la cámara (HDBW2649E): rechaza ~1 de cada 10 búsquedas | Normal si es ocasional: esa vuelta se salta y la siguiente funciona. Solo es problema si aparece `La cámara ... no responde` (3 fallos seguidos). |
| Log: `401` en la cámara | Cambiaron la clave de la cámara | Actualizar `CAMERA_PASS` en `.env.camara1` (entre comillas simples) y reiniciar. |
| Log: `El reloj de la cámara difiere ...` | Cámara sin NTP o zona horaria distinta | Web de la cámara → Setup → System → General → Date & Time: NTP `pool.ntp.org`, zona Santiago con horario de verano. En la Pi: `sudo timedatectl set-timezone America/Santiago`. |
| Log: `⚠ Partido incompleto: N min de video` | La cámara no grabó (o no entregó) toda la hora | Correr el diagnóstico con `--fecha` de ese día y mirar la tabla por hora. Revisar en la web de la cámara el horario de grabación (debe ser continuo, 24 h) y el tamaño de archivo (5 min). |
| Log: `DEPORTE='...' no coincide` | `.env` distinto a la tabla `camaras` | Corregir `DEPORTE` / `COMPLEJO_NOMBRE` / `CANCHA` en el `.env`, reiniciar. |
| Log: `Sin internet — modo offline` | Internet del complejo caído | Nada: la Pi sigue midiendo ocupación y sube todo cuando vuelve (hasta 24 h hacia atrás). |
| Log: `Heartbeat rechazado por Supabase (400)` | El script manda una columna que la tabla no tiene | Comparar con `SUPABASE.md` (sección heartbeat). |
| `vcgencmd get_throttled` ≠ `0x0` | Cargador débil o calor | Usar el cargador oficial de 27 W (Pi 5) / 15 W (Pi 4); ventilación. |
| El partido no aparece pero el log dice `sin actividad` | La cámara detectó personas en menos del 50 % de las muestras | Revisar en el diagnóstico (§5 "Detección") que la cámara responde. Si hay partidos reales que se descartan, bajar `ACTIVITY_THRESHOLD` (p. ej. `0.3`). |
| Servicio en `activating (auto-restart)` | El script se cae al arrancar | `journalctl -u lacar@camara1 -n 50` muestra el error (suele ser una variable faltante en el `.env`). |

---

## 9. Leyenda del log

| Símbolo | Significado |
|---|---|
| 🟢 / ⚪ Actividad | Muestra de "¿hay personas?" del bloque en curso (SÍ / NO). |
| ❔ Actividad | La cámara no respondió la consulta; esa muestra no cuenta. |
| ↓ Descargando / ✓ Descargado | Bajando un archivo de 5 min desde la cámara. |
| 🎬 Convirtiendo | ffmpeg pasando el .dav a trozos .ts. |
| ☁ Subiendo / ✓ Segmento subido | Subida a R2 (con el tiempo que tardó). |
| 🏁 Finalizando | Terminó la hora: se decide si se publica. |
| 📊 Ocupación registrada | Se escribió `ocupacion_canchas`. |
| ✓ Registrado en Supabase | El partido ya está en la plataforma. |
| 🚫 BLOQUEADA / 🔒 PRIVADA | Configuración del panel para esa hora. |
| 💓 Heartbeat / 📈 Monitoreo | Reportes de estado. |
| 📵 Sin internet / 🌐 Internet restaurado | Cambios de conexión. |
| 🕒 Reloj cámara vs Pi | Diferencia de hora entre ambos (debe ser pequeña). |

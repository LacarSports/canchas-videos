# Lacar Sports — Guía de instalación de una Raspberry Pi nueva

Para el día a día (revisar, diagnosticar, actualizar) ver `MANUAL_OPERACION.md`.

---

## Resumen del flujo

```
EN TU CASA                      EN EL COMPLEJO                  DESDE TU CASA (REMOTO)
──────────                      ──────────────                  ──────────────────────
1. Grabar Raspberry Pi OS       4. Conectar Pi + cámaras        6. configurar.sh en la Pi
2. Conectarte por SSH              al router/switch                (datos de cada cámara)
3. Instalar Tailscale           5. Configurar cámaras           7. Respaldo al PC
3b. bash desplegar.sh (PC)         (IP fija, clave, NTP,        8. Revisar
                                    grabación continua)
```

Lo común a todas las Pi (scripts, servicio, claves de R2/Supabase) lo instala
`desplegar.sh` desde tu PC. Lo propio de cada cámara se configura en la Pi con
`configurar.sh`.

---

## PARTE 1 — En tu casa

### Paso 1 — Grabar Raspberry Pi OS

1. Descargar [Raspberry Pi Imager](https://www.raspberrypi.com/software/) e insertar la microSD.
2. En el Imager:
   - OS: **Raspberry Pi OS Lite (64-bit)** (sin escritorio; no hace falta)
   - Configuración (engranaje ⚙️):
     - **Hostname:** `lacar-pi-N` (N = número de Pi: 0, 1, 2…). Este mismo nombre será su
       carpeta en `configs/`.
     - **Enable SSH:** activar, con contraseña
     - **Username:** `lacar0` (el mismo en todas las Pi simplifica todo)
     - **Password:** una contraseña propia por Pi, guardada en tu gestor de contraseñas
     - **WiFi:** NO configurar (solo Ethernet)
     - **Locale:** America/Santiago
3. "Write", poner la microSD en la Pi, conectarla por Ethernet a tu router y encenderla.
   Esperar ~2 minutos.

### Paso 2 — Conectarte por SSH

Encontrar su IP (en Git Bash):

```bash
ping -c 1 lacar-pi-N.local
```

Si no responde, mírala en la página de tu router (lista de dispositivos). Luego:

```bash
ssh lacar0@IP_DE_LA_PI
```

### Paso 3 — Instalar Tailscale (acceso remoto)

En la Pi:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Abre el link que aparece, autoriza con tu cuenta y anota la IP `100.x.x.x` que le asigna
(también la ves en <https://login.tailscale.com/admin/machines>). Tu PC necesita tener
Tailscale instalado y con sesión iniciada en la misma cuenta.

> Recomendado: en el panel de Tailscale, en la máquina → "Disable key expiry", para que la Pi
> no pierda el acceso remoto a los 6 meses.

(Opcional, para no escribir la contraseña cada vez desde tu PC — en Git Bash:)

```bash
ssh-copy-id lacar0@100.x.x.x
```

### Paso 3b — Instalar el sistema (desde tu PC)

En Git Bash, en tu PC:

```bash
cd "/c/Users/Isabella Blamey/canchas-videos/Lacar System"
bash desplegar.sh lacar0@100.x.x.x
```

Instala todo (paquetes, zona horaria, scripts, claves comunes de `configs/comun.env`,
servicio). Como la Pi todavía no tiene cámaras, deja creada `/opt/lacar/.env.camara1`
vacía para configurarla en el complejo (paso 6).

La Pi ya puede ir al complejo: `sudo shutdown now`, desconectar y llevar.

---

## PARTE 2 — En el complejo

### Paso 4 — Conexión física

1. Switch al router del complejo.
2. Pi y cámaras al switch (cámaras por PoE).
3. Encender todo.

### Paso 5 — Configurar las cámaras

Las Dahua vienen de fábrica en `192.168.1.108`. Entrar desde un notebook/celular en la misma
red a `http://IP_DE_LA_CAMARA`:

1. **Setup → Network → TCP/IP:** IP estática en la subred del router
   (cámara 1: `192.168.X.108`, cámara 2: `192.168.X.109`), máscara `255.255.255.0`, gateway
   el del router.
2. **Contraseña:** una segura; guardarla en el gestor de contraseñas.
3. **Setup → System → General → Date & Time:** zona horaria de Santiago **con horario de
   verano**, y **NTP activado** (`pool.ntp.org`). ⚠️ Si la cámara no cambia de horario de
   verano, su reloj queda 1 hora corrido y los partidos se publican incompletos (pasó en
   septiembre 2026).
4. **Storage / Record:** grabación continua (24 h, todos los días), archivos de **5 minutos**,
   H.264, **overwrite activado** (sobrescribe lo más antiguo cuando se llena la SD).
5. **Detección de personas** (SMD / IVS "Human"): activada, sobre la zona de la cancha. El
   script la usa para decidir si hubo partido.

Anotar IP y contraseña de cada cámara.

---

## PARTE 3 — Desde tu casa (remoto)

### Paso 6 — Configurar cada cámara (en la Pi)

Antes, en Supabase → Table Editor → `camaras`, crea la fila de cada cancha (complejo,
número de cancha, deporte). Luego conéctate a la Pi y usa el asistente:

```bash
ssh lacar0@100.x.x.x
bash /opt/lacar/configurar.sh camara1
```

Se abre el archivo de la cámara en `nano`. Cambia:

```bash
CAMERA_IP='192.168.X.108'
CAMERA_PASS='ClaveDeLaCamara'
COMPLEJO='slug-del-complejo'
COMPLEJO_NOMBRE='Nombre Del Complejo'
DEPORTE='Pádel'
CANCHA='1'
```

Guarda con **Ctrl+O** y Enter, sal con **Ctrl+X**. El asistente revisa la configuración y
te pregunta si aplicarla: responde `s`.

Reglas:
- Valores entre comillas simples; **nada de comentarios al final de una línea**.
- `COMPLEJO_NOMBRE`, `DEPORTE` y `CANCHA` deben ser **idénticos** a la fila de `camaras`
  (tildes incluidas: `Pádel`, no `Padel`).
- Segunda cámara: `bash /opt/lacar/configurar.sh camara2`.
- Las claves de R2 y Supabase NO van aquí: ya están en `/opt/lacar/comun.env`.

> Al arrancar, el script revisa las últimas `RECOVERY_HOURS` horas (3 por defecto) y publica
> los partidos de ese rango que tengan actividad. Si la cámara grabó pruebas en esas horas y
> no quieres publicarlas, agrega `RECOVERY_HOURS=0` al archivo de la cámara para el primer
> arranque y después bórralo.

### Paso 7 — Respaldar la configuración en tu PC

En Git Bash:

```bash
cd "/c/Users/Isabella Blamey/canchas-videos/Lacar System"
bash desplegar.sh lacar0@100.x.x.x --solo-respaldo
```

Queda una copia en `configs/respaldos/lacar-pi-N/` (por si se daña la tarjeta de la Pi).

### Paso 8 — Revisar

`bash /opt/lacar/configurar.sh` (sin nada más) muestra las cámaras de la Pi y si están
`active`. Luego mira el log:

```bash
tail -f /opt/lacar/logs/camara1.log
```

Deberías ver `Pipeline iniciado`, `✓ Cancha verificada en Supabase`, `💓 Heartbeat enviado` y
cada 30 s `🔍 Consultando cámara ...` sin errores.

---

## Checklist final

- [ ] Pi con hostname `lacar-pi-N`, usuario `lacar0`, Tailscale con "key expiry" desactivado
- [ ] Cámaras con IP fija, NTP y horario de verano, grabación continua de 5 min, detección de personas
- [ ] Fila(s) en la tabla `camaras` de Supabase
- [ ] `desplegar.sh` corrido en la Pi (en casa, paso 3b)
- [ ] Cada cámara configurada con `configurar.sh` y sin ❌ en su diagnóstico
- [ ] Respaldo en `configs/respaldos/lacar-pi-N/` del PC
- [ ] Al terminar la primera hora con gente, el partido aparece en la plataforma con ~60 min

---

## Problemas típicos al instalar

| Problema | Causa | Solución |
|----------|-------|----------|
| `ssh: connect ... Connection timed out` a la IP 100.x | Tailscale apagado o sin sesión en tu PC | Abrir Tailscale en el PC e iniciar sesión con la misma cuenta |
| Ping a la cámara no responde | Pi y cámara en distinta subred, o PoE sin energía | Comparar `hostname -I` con la IP de la cámara (3 primeros números iguales); otro puerto del switch |
| `401 Unauthorized` en el diagnóstico | Clave de cámara incorrecta en el `.env` | Corregir `CAMERA_PASS` en `configs/...` y volver a desplegar |
| `DEPORTE ... no coincide con 'camaras'` | Diferencia de tildes/mayúsculas | Corregir el `.env` o la tabla `camaras` y volver a desplegar |
| Servicio `activating (auto-restart)` | Falta una variable en el `.env` | `journalctl -u lacar@camara1 -n 30` en la Pi muestra cuál |
| Tailscale se desconecta tras cambiar la red | Gateway incorrecto | Con monitor y teclado: `sudo nmcli con mod "netplan-eth0" ipv4.method auto` y reiniciar |

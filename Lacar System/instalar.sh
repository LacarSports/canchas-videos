#!/usr/bin/env bash
# Lacar Sports — instala o ACTUALIZA el sistema en esta Raspberry Pi.
#
# Normalmente lo lanza desplegar.sh desde el PC. Instala:
#   - los scripts (lacar_pipeline.py, lacar_diagnostico.py, configurar.sh)
#   - comun.env (claves de R2/Supabase, iguales para todas las Pi)
#   - el servicio lacar@.service
# y NUNCA toca la configuración de cada cámara (/opt/lacar/.env.camaraN), que se
# edita en la Pi con:  bash /opt/lacar/configurar.sh camaraN
#
# Se corre con tu usuario normal (NO con sudo); pide la clave cuando hace falta.
# Se puede correr las veces que sea.

set -euo pipefail

ORIGEN="$(cd "$(dirname "$0")" && pwd)"
DESTINO=/opt/lacar
USUARIO="$(id -un)"

paso() { echo; echo "━━━ $* ━━━"; }
falla() { echo "❌ $*"; exit 1; }

[ "$USUARIO" = "root" ] && falla "Córrelo con tu usuario normal, sin sudo: bash instalar.sh"
for f in lacar_pipeline.py lacar_diagnostico.py configurar.sh lacar@.service comun.env camara.env.example; do
  [ -f "$ORIGEN/$f" ] || falla "Falta $f en $ORIGEN"
done
grep -q "CAMBIAR" "$ORIGEN/comun.env" && falla "comun.env todavía tiene valores CAMBIAR"

echo "Lacar Sports — instalación/actualización en $(hostname)"
echo "(te pedirá la contraseña de la Pi para los pasos de administrador)"
sudo -v

# ── 1. Paquetes ───────────────────────────────────────────────────────
paso "1/7 Paquetes: ffmpeg, requests, boto3"
FALTAN=()
command -v ffmpeg >/dev/null || FALTAN+=(ffmpeg)
python3 -c "import requests" 2>/dev/null || FALTAN+=(python3-requests)
python3 -c "import boto3" 2>/dev/null || FALTAN+=(python3-boto3)
if [ ${#FALTAN[@]} -gt 0 ]; then
  sudo apt-get update -qq
  sudo apt-get install -y "${FALTAN[@]}"
else
  echo "✅ ya estaban instalados"
fi

# ── 2. Zona horaria ───────────────────────────────────────────────────
paso "2/7 Zona horaria"
if [ "$(timedatectl show -p Timezone --value)" != "America/Santiago" ]; then
  sudo timedatectl set-timezone America/Santiago
fi
echo "✅ $(timedatectl show -p Timezone --value) — $(date '+%Y-%m-%d %H:%M:%S')"

# ── 3. Servicios de formatos antiguos ─────────────────────────────────
paso "3/7 Servicios antiguos"
quitados=0
for u in /etc/systemd/system/lacar.service /etc/systemd/system/lacar-camara*.service; do
  [ -e "$u" ] || continue
  n="$(basename "$u")"
  echo "🧹 Quitando $n"
  sudo systemctl disable --now "$n" 2>/dev/null || true
  sudo rm -f "$u"
  quitados=1
done
[ "$quitados" = 1 ] || echo "✅ no hay"

# ── 4. Archivos ───────────────────────────────────────────────────────
paso "4/7 Archivos en $DESTINO"
sudo mkdir -p "$DESTINO"
sudo chown "$USUARIO:$USUARIO" "$DESTINO"
install -m 644 "$ORIGEN/lacar_pipeline.py" "$ORIGEN/lacar_diagnostico.py" "$ORIGEN/camara.env.example" "$DESTINO/"
install -m 755 "$ORIGEN/configurar.sh" "$DESTINO/"
install -m 600 "$ORIGEN/comun.env" "$DESTINO/comun.env"
python3 -m py_compile "$DESTINO/lacar_pipeline.py" "$DESTINO/lacar_diagnostico.py" \
  || falla "El script tiene errores de sintaxis — no se instala"
# Archivos de formatos antiguos (env.camaraN sin punto, servicios viejos) → _antiguo/
for f in "$DESTINO"/env.camara* "$DESTINO"/lacar-camara*.service; do
  [ -e "$f" ] || continue
  mkdir -p "$DESTINO/_antiguo"; mv "$f" "$DESTINO/_antiguo/"
  echo "📦 $(basename "$f") → _antiguo/"
done
echo "✅ scripts y comun.env instalados"

# ── 5. Configuración de las cámaras (en la Pi) ────────────────────────
paso "5/7 Cámaras de esta Pi"
# Migración: si un .env de cámara todavía trae las claves comunes (formato
# anterior), se respalda y se le quitan, para que valgan las de comun.env.
CLAVES_COMUNES="$(grep -oE '^[A-Z_0-9]+=' "$DESTINO/comun.env" | tr -d '=' | paste -sd'|')"
INSTANCIAS=()
PENDIENTES=()
for f in "$DESTINO"/.env.camara*; do
  [ -e "$f" ] || continue
  n="$(basename "$f")"
  [[ "$n" =~ ^\.env\.(camara[0-9]+)$ ]] || continue
  inst="${BASH_REMATCH[1]}"
  if grep -qE "^($CLAVES_COMUNES)=" "$f"; then
    mkdir -p "$DESTINO/_antiguo"
    cp "$f" "$DESTINO/_antiguo/$n.completo.$(date +%Y%m%d-%H%M)"
    sed -i -E "/^($CLAVES_COMUNES)=/d" "$f"
    echo "🔧 $n: se quitaron las claves comunes (ahora vienen de comun.env)"
  fi
  if grep -q "CAMBIAR" "$f"; then PENDIENTES+=("$inst"); else INSTANCIAS+=("$inst"); fi
done
if [ ${#INSTANCIAS[@]} -eq 0 ] && [ ${#PENDIENTES[@]} -eq 0 ]; then
  sed "s/^INSTANCE_ID=.*/INSTANCE_ID=camara1/" "$DESTINO/camara.env.example" > "$DESTINO/.env.camara1"
  chmod 600 "$DESTINO/.env.camara1"
  PENDIENTES+=(camara1)
  echo "📝 Pi nueva: se creó .env.camara1 desde la plantilla"
fi
[ ${#INSTANCIAS[@]} -gt 0 ] && echo "✅ configuradas: ${INSTANCIAS[*]}"
[ ${#PENDIENTES[@]} -gt 0 ] && echo "⚠️  sin configurar (tienen valores CAMBIAR): ${PENDIENTES[*]}"

# ── 6. Servicio ───────────────────────────────────────────────────────
paso "6/7 Servicio systemd"
sed "s/^User=.*/User=$USUARIO/" "$ORIGEN/lacar@.service" | sudo tee /etc/systemd/system/lacar@.service >/dev/null
sudo systemctl daemon-reload
# Instancias activas cuya configuración ya no existe → se apagan
for u in $(systemctl list-units 'lacar@*' --all --plain --no-legend 2>/dev/null | awk '{print $1}'); do
  inst="${u#lacar@}"; inst="${inst%.service}"
  if [[ " ${INSTANCIAS[*]} " != *" $inst "* ]]; then
    sudo systemctl disable --now "lacar@$inst" 2>/dev/null || true
    echo "⏹  lacar@$inst apagada (sin configuración válida)"
  fi
done
for inst in "${INSTANCIAS[@]}"; do
  sudo systemctl enable "lacar@$inst" >/dev/null 2>&1
  sudo systemctl restart "lacar@$inst"
done
if [ ${#INSTANCIAS[@]} -gt 0 ]; then
  sleep 10
  for inst in "${INSTANCIAS[@]}"; do
    estado="$(systemctl is-active "lacar@$inst" || true)"
    [ "$estado" = "active" ] && echo "✅ lacar@$inst: $estado" || echo "❌ lacar@$inst: $estado  (ver: journalctl -u lacar@$inst -n 30)"
  done
fi

# ── 7. Diagnóstico ────────────────────────────────────────────────────
paso "7/7 Diagnóstico"
for inst in "${INSTANCIAS[@]}"; do
  echo "· $inst"
  python3 "$DESTINO/lacar_diagnostico.py" "$DESTINO/.env.$inst" | sed -n '/━━━ RESUMEN/,$p' || true
done

# comun.env tiene claves: no dejar copia en la carpeta temporal.
[ "$ORIGEN" != "$DESTINO" ] && rm -f "$ORIGEN/comun.env"

echo
if [ ${#PENDIENTES[@]} -gt 0 ]; then
  for p in "${PENDIENTES[@]}"; do
    echo "👉 Falta configurar $p. En la Pi:  bash $DESTINO/configurar.sh $p"
  done
fi
echo "Listo. Ver cámaras de esta Pi:  bash $DESTINO/configurar.sh"

#!/usr/bin/env bash
# install.sh — Ubuntu 22.04
# Instala dahua-bridge como servicio systemd en el puerto 22.
#
# PREREQUISITO: mover OpenSSH a otro puerto ANTES de correr este script.
# Ver instrucciones al final de este archivo.
#
# Uso: sudo bash install.sh

set -euo pipefail

INSTALL_DIR="/opt/dahua-bridge"
CONFIG_DIR="/etc/dahua-bridge"
SERVICE_USER="dahua-bridge"
LOG_FILE="/var/log/dahua-bridge.log"

echo "==> Actualizando paquetes..."
apt-get update -q
apt-get install -y -q python3 python3-pip python3-venv

echo "==> Creando usuario de sistema..."
id "$SERVICE_USER" &>/dev/null || useradd \
    --system \
    --no-create-home \
    --shell /usr/sbin/nologin \
    "$SERVICE_USER"

echo "==> Creando directorios..."
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" /tmp/dahua-bridge
touch "$LOG_FILE"
chown "$SERVICE_USER:$SERVICE_USER" "$LOG_FILE" /tmp/dahua-bridge

echo "==> Copiando script..."
cp bridge.py "$INSTALL_DIR/bridge.py"
chmod 755 "$INSTALL_DIR/bridge.py"

echo "==> Creando entorno virtual e instalando dependencias..."
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet \
    paramiko \
    boto3 \
    requests

echo "==> Configurando archivo de entorno..."
if [ ! -f "$CONFIG_DIR/env" ]; then
    cp env.example "$CONFIG_DIR/env"
    chmod 600 "$CONFIG_DIR/env"
    chown root:root "$CONFIG_DIR/env"
    echo ""
    echo "  !! IMPORTANTE: edita $CONFIG_DIR/env y cambia SFTP_PASSWORD antes de iniciar."
    echo "     nano $CONFIG_DIR/env"
    echo ""
fi

echo "==> Instalando servicio systemd..."
cp dahua-bridge.service /etc/systemd/system/dahua-bridge.service
systemd-analyze verify /etc/systemd/system/dahua-bridge.service || true
systemctl daemon-reload
systemctl enable dahua-bridge.service

echo ""
echo "==> Instalación completa."
echo ""
echo "  Próximos pasos:"
echo "  1. Edita la contraseña:   nano $CONFIG_DIR/env"
echo "  2. Inicia el servicio:    sudo systemctl start dahua-bridge"
echo "  3. Verifica logs:         sudo journalctl -u dahua-bridge -f"
echo "  4. Configura las cámaras Dahua con:"
echo "       - Protocolo: SFTP"
echo "       - Host: <IP del VPS>"
echo "       - Puerto: 22"
echo "       - Usuario: camera"
echo "       - Contraseña: (la que pusiste en env)"
echo "       - Ruta remota: /<complejo>/<deporte>/<numero_cancha>"
echo "         Ejemplo:    /complejo-las-condes/futbol7/1"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# CÓMO MOVER OPENSSH AL PUERTO 2222 ANTES DE INSTALAR
# (correr manualmente, NO parte de este script)
# ─────────────────────────────────────────────────────────────────────────────
#
# 1. Abre una segunda sesión SSH (no cierres la actual hasta confirmar que funciona)
#
# 2. Edita la config de SSH:
#      sudo nano /etc/ssh/sshd_config
#    Cambia:   Port 22
#    A:        Port 2222
#
# 3. Permite el nuevo puerto en el firewall:
#      sudo ufw allow 2222/tcp
#      sudo ufw deny 22/tcp     # opcional, después de confirmar
#
# 4. Recarga sshd:
#      sudo systemctl reload sshd
#
# 5. Abre una NUEVA terminal y conecta por puerto 2222 para confirmar:
#      ssh -p 2222 usuario@<IP>
#
# 6. Solo si el paso 5 funcionó, cierra la sesión original.
#
# 7. Recién ahora corre: sudo bash install.sh

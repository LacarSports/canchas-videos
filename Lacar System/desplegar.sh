#!/usr/bin/env bash
# Lacar Sports — instala o actualiza el sistema en una Raspberry Pi desde el PC.
# Se corre en Git Bash:
#
#     cd "/c/Users/Isabella Blamey/canchas-videos/Lacar System"
#     bash desplegar.sh lacar0@100.104.119.36                  → instalar / actualizar
#     bash desplegar.sh lacar0@100.104.119.36 --solo-respaldo  → solo copiar al PC la config de sus cámaras
#
# Copia a la Pi: los scripts, el servicio y configs/comun.env (claves comunes).
# NO toca la configuración de cada cámara: esa se edita en la Pi con
#     bash /opt/lacar/configurar.sh camaraN
# Al terminar, guarda un respaldo de la config de las cámaras de esa Pi en
# configs/respaldos/<nombre-de-la-pi>/ (por si se daña la tarjeta de la Pi).

set -euo pipefail
cd "$(dirname "$0")"

PI="${1:-}"
[ -n "$PI" ] || { echo "Uso: bash desplegar.sh usuario@ip-de-la-pi [--solo-respaldo]"; exit 1; }

respaldar() {
  local host
  host="$(ssh "$PI" hostname)"
  mkdir -p "configs/respaldos/$host"
  if scp -q "$PI:/opt/lacar/.env.camara*" "configs/respaldos/$host/" 2>/dev/null; then
    echo "💾 Respaldo de las cámaras de $host en configs/respaldos/$host/:"
    ls -1A "configs/respaldos/$host" | sed 's/^/     /'
  else
    echo "(la Pi todavía no tiene cámaras configuradas: nada que respaldar)"
  fi
}

if [ "${2:-}" = "--solo-respaldo" ]; then
  respaldar
  exit 0
fi

[ -f configs/comun.env ] || { echo "❌ Falta configs/comun.env (cópialo de comun.env.example y rellena las claves)"; exit 1; }

echo "Pi: $PI"
ssh "$PI" 'rm -rf ~/lacar-instalar && mkdir -p ~/lacar-instalar'
scp -q lacar_pipeline.py lacar_diagnostico.py configurar.sh instalar.sh "lacar@.service" \
       camara.env.example configs/comun.env "$PI:lacar-instalar/"
echo "✅ Archivos copiados. Instalando en la Pi..."
ssh -t "$PI" 'bash ~/lacar-instalar/instalar.sh'
echo
respaldar

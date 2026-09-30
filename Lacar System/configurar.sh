#!/usr/bin/env bash
# Lacar Sports — configurar las cámaras de ESTA Raspberry Pi (se corre en la Pi).
#
#   bash /opt/lacar/configurar.sh                    → lista las cámaras y su estado
#   bash /opt/lacar/configurar.sh camara1            → crea o edita la cámara 1, la revisa y la reinicia
#   bash /opt/lacar/configurar.sh camara2 --quitar   → apaga la cámara 2 y archiva su configuración
#
# Lo propio de cada cámara (IP, clave, complejo, cancha, deporte) vive aquí, en
# /opt/lacar/.env.camaraN. Las claves de R2/Supabase están en /opt/lacar/comun.env
# (las pone desplegar.sh desde el PC; no se editan aquí).

set -euo pipefail
DIR=/opt/lacar
INST="${1:-}"

valor() {  # valor ARCHIVO CLAVE → imprime el valor sin comillas
  grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- | sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/"
}

# ── Sin argumentos: listar ───────────────────────────────────────────
if [ -z "$INST" ]; then
  echo "Cámaras configuradas en $(hostname):"
  hay=0
  for f in "$DIR"/.env.camara*; do
    [ -e "$f" ] || continue
    n="$(basename "$f")"
    [[ "$n" =~ ^\.env\.(camara[0-9]+)$ ]] || continue
    i="${BASH_REMATCH[1]}"; hay=1
    printf "  %-8s %-9s %s · %s · cancha %s · cámara %s\n" "$i" "$(systemctl is-active "lacar@$i" 2>/dev/null || true)" \
      "$(valor "$f" COMPLEJO_NOMBRE)" "$(valor "$f" DEPORTE)" "$(valor "$f" CANCHA)" "$(valor "$f" CAMERA_IP)"
  done
  [ "$hay" = 1 ] || echo "  (ninguna)"
  echo
  echo "Crear o editar:  bash $DIR/configurar.sh camaraN"
  echo "Apagar:          bash $DIR/configurar.sh camaraN --quitar"
  exit 0
fi

[[ "$INST" =~ ^camara[0-9]+$ ]] || { echo "❌ El nombre debe ser camara1, camara2, ..."; exit 1; }
ENV="$DIR/.env.$INST"

# ── Quitar una cámara ────────────────────────────────────────────────
if [ "${2:-}" = "--quitar" ]; then
  sudo systemctl disable --now "lacar@$INST" 2>/dev/null || true
  if [ -f "$ENV" ]; then
    mkdir -p "$DIR/_antiguo"
    mv "$ENV" "$DIR/_antiguo/.env.$INST.$(date +%Y%m%d-%H%M)"
  fi
  echo "✅ $INST apagada (su configuración quedó en $DIR/_antiguo/)"
  exit 0
fi

# ── Crear / editar ───────────────────────────────────────────────────
[ -f "$DIR/comun.env" ] || { echo "❌ Falta $DIR/comun.env: corre primero desplegar.sh desde el PC"; exit 1; }
if [ ! -f "$ENV" ]; then
  sed "s/^INSTANCE_ID=.*/INSTANCE_ID=$INST/" "$DIR/camara.env.example" > "$ENV"
  chmod 600 "$ENV"
  echo "Creado $ENV desde la plantilla. Se abrirá para editarlo."
  sleep 2
fi

nano "$ENV"

if ! grep -qx "INSTANCE_ID=$INST" "$ENV"; then
  sed -i "s/^INSTANCE_ID=.*/INSTANCE_ID=$INST/" "$ENV"
  echo "(INSTANCE_ID corregido a $INST para que coincida con el nombre del archivo)"
fi
if grep -q "CAMBIAR" "$ENV"; then
  echo "⚠️  Todavía hay valores 'CAMBIAR' en $ENV: no se arranca. Vuelve a correr este comando."
  exit 1
fi

echo
echo "Revisando la configuración (cámara, Supabase, R2)..."
python3 "$DIR/lacar_diagnostico.py" "$ENV" | sed -n '/━━━ RESUMEN/,$p' || true
echo
read -rp "¿Aplicar y (re)iniciar lacar@$INST? [s/N] " resp
if [[ "$resp" =~ ^[sS] ]]; then
  sudo systemctl enable "lacar@$INST" >/dev/null 2>&1
  sudo systemctl restart "lacar@$INST"
  sleep 10
  echo "Estado: $(systemctl is-active "lacar@$INST" || true)"
  tail -n 8 "$DIR/logs/$INST.log" 2>/dev/null | sed 's/^/  /' || true
  echo
  echo "Recuerda respaldar la configuración en tu PC:  bash desplegar.sh $(id -un)@<ip> --solo-respaldo"
else
  echo "No se reinició. Para aplicarlo después:  sudo systemctl restart lacar@$INST"
fi

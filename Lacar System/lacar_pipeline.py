#!/usr/bin/env python3
"""
Lacar Sports — Pipeline de procesamiento de videos
Cámara Dahua → ffmpeg HLS → Cloudflare R2 → Supabase

Un proceso por cámara. Toda la configuración se lee desde variables de entorno, que systemd carga
(lacar@<instancia>) desde dos archivos: /opt/lacar/comun.env (claves de R2 y
Supabase, iguales para todas las Pi) y /opt/lacar/.env.<instancia> (lo propio
de cada cámara; gana si una variable está en ambos).

Uso manual (para probar):
    cd /opt/lacar
    set -a && source comun.env && source .env.camara1 && set +a && python3 lacar_pipeline.py

Qué hace, en cada vuelta del loop (cada POLL_INTERVAL segundos):
    1. Revisa internet y toma una muestra de "¿hay personas en la cancha?"
    2. Pide a la cámara la lista de archivos .dav grabados (bloques de 5 min)
    3. Agrupa los archivos por hora de partido (07:00, 08:00, ... 23:00)
    4. Sube a R2 los archivos nuevos ya cerrados (convertidos a HLS .ts)
    5. Cuando la hora termina: si hubo actividad arma la playlist final y
       registra el partido en Supabase; si no, borra lo subido.
       Siempre registra la ocupación de la cancha.
    6. Cada cierto tiempo manda heartbeat y métricas de monitoreo.
"""

import os
import re
import sys
import math
import time
import json
import signal
import socket
import logging
import platform
import requests
import subprocess
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from typing import Optional
from requests.auth import HTTPDigestAuth
from logging.handlers import RotatingFileHandler

import boto3
from botocore.config import Config as BotocoreConfig


SCRIPT_VERSION = "2026-09-30"

HLS_TIME = 6              # segundos por trozo .ts
MAX_REINTENTOS_SEG = 3    # intentos por archivo .dav antes de omitirlo
DIAS_ESTADO = 7           # días que se guardan registros locales


# ─────────────────────────────────────────────
#  CONFIGURACIÓN — leída desde variables de entorno
# ─────────────────────────────────────────────

@dataclass
class Config:
    """
    Configuración completa de una instancia del pipeline.
    Todos los valores provienen de variables de entorno (ver .env.example).
    """

    # Identificación de instancia
    instance_id: str = ""

    # Cámara
    camera_ip:   str = ""
    camera_user: str = "admin"
    camera_pass: str = ""

    # Metadatos del partido. COMPLEJO_NOMBRE, DEPORTE y CANCHA deben ser
    # idénticos (tildes incluidas) a la tabla `camaras` de Supabase.
    complejo:        str = ""   # slug R2 (ej: complejo-las-condes)
    complejo_nombre: str = ""   # nombre legible
    deporte:         str = "Fútbol 7"
    cancha:          str = "1"

    # Cloudflare R2
    r2_account_id: str = ""
    r2_bucket:     str = "canchas-videos"
    r2_access_key: str = ""
    r2_secret_key: str = ""
    r2_public_url: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # Parámetros de comportamiento
    poll_interval:      int = 30
    heartbeat_interval: int = 1800
    monitor_interval:   int = 900
    recovery_hours:     int = 3
    activity_threshold: float = 0.5
    upload_workers:     int = 8
    ffmpeg_path:        str = ""
    match_start_hours:  list = field(default_factory=lambda: list(range(7, 24)))

    # Runtime (calculados en __post_init__)
    r2_endpoint: str = field(init=False, default="")
    ffmpeg_bin:  str = field(init=False, default="ffmpeg")
    work_dir:    Path = field(init=False)
    processed_db: Path = field(init=False)
    log_path:    Path = field(init=False)

    def __post_init__(self):
        self.r2_endpoint = f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

        if self.ffmpeg_path:
            self.ffmpeg_bin = self.ffmpeg_path
        elif platform.system() == "Windows":
            self.ffmpeg_bin = r"C:\ffmpeg\bin\ffmpeg.exe"
        else:
            self.ffmpeg_bin = "ffmpeg"

        base_dir = Path(__file__).parent
        state_dir = base_dir / "state" / self.instance_id
        state_dir.mkdir(parents=True, exist_ok=True)

        logs_dir = base_dir / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)

        self.work_dir     = state_dir / "tmp"
        self.processed_db = state_dir / "processed_files.json"
        self.log_path     = logs_dir / f"{self.instance_id}.log"

        self.work_dir.mkdir(parents=True, exist_ok=True)

    def validate(self):
        """Lanza ValueError si faltan campos críticos."""
        required = {
            "INSTANCE_ID": self.instance_id,
            "CAMERA_IP":   self.camera_ip,
            "CAMERA_PASS": self.camera_pass,
            "COMPLEJO":    self.complejo,
            "COMPLEJO_NOMBRE": self.complejo_nombre,
            "R2_ACCOUNT_ID": self.r2_account_id,
            "R2_ACCESS_KEY": self.r2_access_key,
            "R2_SECRET_KEY": self.r2_secret_key,
            "R2_PUBLIC_URL": self.r2_public_url,
            "SUPABASE_URL":  self.supabase_url,
            "SUPABASE_KEY":  self.supabase_key,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            raise ValueError(f"Variables de entorno faltantes: {', '.join(missing)}")
        if not self.cancha.isdigit():
            raise ValueError(f"CANCHA debe ser un número (está '{self.cancha}')")


def load_config_from_env() -> Config:
    """Lee todas las variables de entorno y construye un Config."""
    return Config(
        instance_id     = os.environ.get("INSTANCE_ID", ""),
        camera_ip       = os.environ.get("CAMERA_IP", ""),
        camera_user     = os.environ.get("CAMERA_USER", "admin"),
        camera_pass     = os.environ.get("CAMERA_PASS", ""),
        complejo        = os.environ.get("COMPLEJO", ""),
        complejo_nombre = os.environ.get("COMPLEJO_NOMBRE", ""),
        deporte         = os.environ.get("DEPORTE", "Fútbol 7"),
        cancha          = os.environ.get("CANCHA", "1").strip(),
        r2_account_id   = os.environ.get("R2_ACCOUNT_ID", ""),
        r2_bucket       = os.environ.get("R2_BUCKET", "canchas-videos"),
        r2_access_key   = os.environ.get("R2_ACCESS_KEY", ""),
        r2_secret_key   = os.environ.get("R2_SECRET_KEY", ""),
        r2_public_url   = os.environ.get("R2_PUBLIC_URL", "").rstrip("/"),
        supabase_url    = os.environ.get("SUPABASE_URL", "").rstrip("/"),
        supabase_key    = os.environ.get("SUPABASE_KEY", ""),
        poll_interval      = int(os.environ.get("POLL_INTERVAL", "30")),
        heartbeat_interval = int(os.environ.get("HEARTBEAT_INTERVAL", "1800")),
        monitor_interval   = int(os.environ.get("MONITOR_INTERVAL", "900")),
        recovery_hours     = int(os.environ.get("RECOVERY_HOURS", "3")),
        activity_threshold = float(os.environ.get("ACTIVITY_THRESHOLD", "0.5")),
        upload_workers     = int(os.environ.get("UPLOAD_WORKERS", "8")),
        ffmpeg_path        = os.environ.get("FFMPEG_BIN", ""),
    )


# ─────────────────────────────────────────────
#  LOGGING — por instancia
# ─────────────────────────────────────────────

class ErrorCounter(logging.Handler):
    """Cuenta los errores del log para reportarlos en el monitoreo."""

    def __init__(self):
        super().__init__(level=logging.ERROR)
        self.count = 0
        self.last = ""

    def emit(self, record):
        self.count += 1
        self.last = record.getMessage()[:300]

    def reset(self) -> int:
        n, self.count = self.count, 0
        return n


ERRORES = ErrorCounter()


def setup_logging(cfg: Config) -> logging.Logger:
    """
    Configura un logger dedicado para esta instancia.
    Logs van a stdout (journald) y a logs/<instance_id>.log (5 MB × 2 backups).
    """
    logger = logging.getLogger(f"lacar.{cfg.instance_id}")
    logger.setLevel(logging.INFO)

    if logger.handlers:
        return logger  # ya configurado (por si se llama dos veces)

    fmt = logging.Formatter(f"%(asctime)s [{cfg.instance_id.upper()}] [%(levelname)s] %(message)s")

    # Consola
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    # Archivo rotativo
    fh = RotatingFileHandler(
        cfg.log_path,
        maxBytes=5 * 1024 * 1024,
        backupCount=2,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    logger.addHandler(ERRORES)
    return logger


# ─────────────────────────────────────────────
#  ESTADO EN MEMORIA (para heartbeat y monitoreo)
# ─────────────────────────────────────────────

@dataclass
class Estado:
    inicio: float = field(default_factory=time.time)
    internet_ok: bool = True
    camara_ok: Optional[bool] = None
    camara_desfase_s: Optional[float] = None
    ultimo_segmento_subido: Optional[str] = None
    ultimo_partido_registrado: Optional[str] = None
    segmentos_pendientes: int = 0
    fallos_camara_seguidos: int = 0
    fallos_segmento: dict = field(default_factory=dict)   # ruta .dav → nº de fallos
    monitoreo_activo: bool = True


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────
#  ARCHIVOS LOCALES DE ESTADO
# ─────────────────────────────────────────────

_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def _write_atomic(path: Path, text: str):
    """
    Escribe un archivo de forma atómica: primero a .tmp y luego renombra.
    Si se corta la luz a mitad de la escritura, queda el archivo anterior
    intacto en vez de un JSON corrupto.
    """
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def load_processed(cfg: Config) -> set:
    if cfg.processed_db.exists():
        try:
            return set(json.loads(cfg.processed_db.read_text(encoding="utf-8")))
        except Exception:
            pass
    return set()


def save_processed(cfg: Config, processed: set):
    _write_atomic(cfg.processed_db, json.dumps(sorted(processed), indent=2))


def prune_processed(processed: set) -> set:
    """Olvida registros de hace más de DIAS_ESTADO días (el archivo no crece para siempre)."""
    limite = (datetime.now() - timedelta(days=DIAS_ESTADO)).strftime("%Y-%m-%d")
    out = set()
    for item in processed:
        m = _DATE_RE.search(item)
        if m is None or m.group(1) >= limite:
            out.add(item)
    return out


def cleanup_state(cfg: Config, log: logging.Logger, borrar_temporales: bool):
    """
    borrar_temporales=True (solo al arrancar): borra carpetas de trabajo que
    quedaron a medias (p. ej. por un corte de luz en plena conversión).
    Siempre: borra archivos de estado de partidos de hace más de DIAS_ESTADO días.
    """
    limite = (datetime.now() - timedelta(days=DIAS_ESTADO)).strftime("%Y-%m-%d")
    borrados = 0
    for p in cfg.work_dir.iterdir():
        if p.is_dir():
            if borrar_temporales:
                shutil.rmtree(p, ignore_errors=True)
                borrados += 1
            continue
        m = _DATE_RE.search(p.name)
        if (m and m.group(1) < limite) or p.name.endswith(".tmp"):
            p.unlink(missing_ok=True)
            borrados += 1
    if borrados:
        log.info(f"🧹 Limpieza: {borrados} archivo(s)/carpeta(s) temporales antiguos eliminados")


# ── Estado por partido: manifiesto de .ts subidos y muestras de actividad ──

def _manifest_path(cfg: Config, fecha_str: str, match_hour: int) -> Path:
    return cfg.work_dir / f"manifest_{fecha_str}_{match_hour:02d}00.json"


def _detections_path(cfg: Config, fecha_str: str, match_hour: int) -> Path:
    return cfg.work_dir / f"detections_{fecha_str}_{match_hour:02d}00.json"


def load_manifest(cfg: Config, fecha_str: str, match_hour: int) -> list:
    """
    Lista ordenada de los .ts ya subidos de un partido:
      [{"name": "segment_0000.ts", "dur": 6.0, "disc": False, "src": "/mnt/sd/...dav"}, ...]
    - dur:  duración real del trozo (la que informa ffmpeg)
    - disc: True en el primer trozo de cada archivo .dav (cambio de archivo)
    - src:  archivo .dav de la cámara del que salió (para no subirlo dos veces)
    """
    p = _manifest_path(cfg, fecha_str, match_hour)
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    # Compatibilidad: una versión anterior del script solo guardaba un contador
    # (ts_index_*.txt) y asumía 50 trozos de 6 s por archivo de 5 min.
    legacy = cfg.work_dir / f"ts_index_{fecha_str}_{match_hour:02d}00.txt"
    if legacy.exists():
        try:
            total = int(legacy.read_text().strip())
        except Exception:
            total = 0
        return [
            {"name": f"segment_{i:04d}.ts", "dur": float(HLS_TIME), "disc": i > 0 and i % 50 == 0, "src": None}
            for i in range(total)
        ]
    return []


def save_manifest(cfg: Config, fecha_str: str, match_hour: int, entries: list):
    _write_atomic(_manifest_path(cfg, fecha_str, match_hour), json.dumps(entries))


def get_match_detections(cfg: Config, fecha_str: str, match_hour: int) -> list:
    f = _detections_path(cfg, fecha_str, match_hour)
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def save_match_detections(cfg: Config, fecha_str: str, match_hour: int, detections: list):
    _write_atomic(_detections_path(cfg, fecha_str, match_hour), json.dumps(detections))


def clear_match_state(cfg: Config, fecha_str: str, match_hour: int):
    _manifest_path(cfg, fecha_str, match_hour).unlink(missing_ok=True)
    _detections_path(cfg, fecha_str, match_hour).unlink(missing_ok=True)
    (cfg.work_dir / f"ts_index_{fecha_str}_{match_hour:02d}00.txt").unlink(missing_ok=True)


def match_has_activity(cfg: Config, log: logging.Logger, fecha_str: str, match_hour: int) -> bool:
    """
    True si la proporción de muestras con personas supera ACTIVITY_THRESHOLD.
    Con menos de 2 muestras (p. ej. la Pi estuvo apagada) se asume que SÍ hubo
    actividad: es preferible subir un video vacío que borrar un partido real.
    """
    detections = get_match_detections(cfg, fecha_str, match_hour)
    if len(detections) < 2:
        return True
    positives = sum(1 for d in detections if d)
    ratio = positives / len(detections)
    log.info(
        f"  📊 Detecciones {fecha_str} {match_hour:02d}:00 — "
        f"{positives}/{len(detections)} positivas ({ratio:.0%}, umbral {cfg.activity_threshold:.0%})"
    )
    return ratio >= cfg.activity_threshold


# ─────────────────────────────────────────────
#  SUPABASE — helpers
# ─────────────────────────────────────────────

def _sb_headers(cfg: Config, extra: dict = None) -> dict:
    h = {"apikey": cfg.supabase_key, "Authorization": f"Bearer {cfg.supabase_key}"}
    if extra:
        h.update(extra)
    return h


def _ip_local() -> str:
    """IP de la Pi en la red del complejo (no envía tráfico, solo consulta la ruta)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "desconocida"


# ─────────────────────────────────────────────
#  HEARTBEAT — lo lee la pestaña Monitoreo del panel
# ─────────────────────────────────────────────

def send_heartbeat(cfg: Config, log: logging.Logger, estado: str = "online", detalle: str = "") -> bool:
    """
    Reporta estado a la tabla `heartbeat` (una fila por cancha, se sobrescribe).
    estados: online | sin_internet | error | offline
    Ojo: solo enviar columnas que existen en la tabla (ver SUPABASE.md); una
    columna de más hace que Supabase rechace TODO el heartbeat.
    """
    url = f"{cfg.supabase_url}/rest/v1/heartbeat"
    headers = _sb_headers(cfg, {
        "Content-Type": "application/json",
        "Prefer":       "resolution=merge-duplicates,return=minimal",
    })
    payload = {
        "cancha":           cfg.cancha,
        "complejo":         cfg.complejo_nombre,
        "ultimo_heartbeat": _utc_now_iso(),
        "estado":           estado,
        "ip_local":         _ip_local(),
        "detalle":          (detalle[:200] if detalle else ""),
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=10)
        if not r.ok:
            log.warning(f"💓 Heartbeat rechazado por Supabase ({r.status_code}): {r.text[:200]}")
            return False
        log.info(f"💓 Heartbeat enviado: {estado}{' — ' + detalle if detalle else ''}")
        return True
    except Exception as e:
        log.warning(f"💓 Heartbeat no se pudo enviar (¿sin internet?): {e}")
        return False


# ─────────────────────────────────────────────
#  MONITOREO — métricas de la Pi a la tabla `monitoreo`
# ─────────────────────────────────────────────

def _leer(path: str) -> Optional[str]:
    try:
        return Path(path).read_text().strip()
    except Exception:
        return None


def _cpu_pct() -> Optional[float]:
    def snap():
        v = _leer("/proc/stat")
        if not v:
            return None
        nums = [int(x) for x in v.splitlines()[0].split()[1:]]
        idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
        return idle, sum(nums)
    a = snap()
    if a is None:
        return None
    time.sleep(0.5)
    b = snap()
    d_idle, d_total = b[0] - a[0], b[1] - a[1]
    return round(100 * (1 - d_idle / d_total), 1) if d_total > 0 else None


def _ram_pct() -> Optional[float]:
    v = _leer("/proc/meminfo")
    if not v:
        return None
    info = {}
    for line in v.splitlines():
        k, _, rest = line.partition(":")
        parts = rest.split()
        if parts:
            info[k] = int(parts[0])
    total, disponible = info.get("MemTotal"), info.get("MemAvailable")
    if not total or disponible is None:
        return None
    return round(100 * (1 - disponible / total), 1)


def _temp_c() -> Optional[float]:
    v = _leer("/sys/class/thermal/thermal_zone0/temp")
    try:
        return round(int(v) / 1000, 1)
    except Exception:
        return None


def _uptime_s() -> Optional[int]:
    v = _leer("/proc/uptime")
    try:
        return int(float(v.split()[0]))
    except Exception:
        return None


def _throttled() -> Optional[str]:
    """
    Estado de la fuente de poder según la Pi. "0x0" = todo bien.
    Cualquier otro valor = hubo bajo voltaje o sobrecalentamiento
    (típico de un cargador malo). Ver MANUAL_OPERACION.md.
    """
    try:
        r = subprocess.run(["vcgencmd", "get_throttled"], capture_output=True, text=True, timeout=5)
        return r.stdout.strip().split("=")[-1] or None
    except Exception:
        return None


def send_monitoreo(cfg: Config, log: logging.Logger, estado: Estado):
    """Inserta una fila de métricas en `monitoreo`. Si la tabla no existe, se desactiva."""
    if not estado.monitoreo_activo:
        return
    try:
        disco = shutil.disk_usage(Path(__file__).parent)
        disco_libre_pct = round(100 * disco.free / disco.total, 1)
        disco_libre_gb = round(disco.free / 1024 ** 3, 2)
    except Exception:
        disco_libre_pct = disco_libre_gb = None

    payload = {
        # Todas las Pi tienen "camara1": se antepone el hostname para que el
        # identificador sea único entre complejos (ej. "lacar-pi-0/camara1").
        "instance_id":               f"{socket.gethostname()}/{cfg.instance_id}",
        "complejo":                  cfg.complejo_nombre,
        "numero_cancha":             int(cfg.cancha),
        "deporte":                   cfg.deporte,
        "hostname":                  socket.gethostname(),
        "ip_local":                  _ip_local(),
        "version":                   SCRIPT_VERSION,
        "uptime_s":                  _uptime_s(),
        "script_uptime_s":           int(time.time() - estado.inicio),
        "cpu_pct":                   _cpu_pct(),
        "ram_pct":                   _ram_pct(),
        "temp_c":                    _temp_c(),
        "disco_libre_pct":           disco_libre_pct,
        "disco_libre_gb":            disco_libre_gb,
        "throttled":                 _throttled(),
        "internet_ok":               estado.internet_ok,
        "camara_ok":                 estado.camara_ok,
        "camara_desfase_s":          estado.camara_desfase_s,
        "ultimo_segmento_subido":    estado.ultimo_segmento_subido,
        "ultimo_partido_registrado": estado.ultimo_partido_registrado,
        "segmentos_pendientes":      estado.segmentos_pendientes,
        "errores":                   ERRORES.count,
        "ultimo_error":              ERRORES.last or None,
    }
    url = f"{cfg.supabase_url}/rest/v1/monitoreo"
    headers = _sb_headers(cfg, {"Content-Type": "application/json", "Prefer": "return=minimal"})
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=10)
        if r.status_code == 404:
            log.warning("📈 La tabla 'monitoreo' no existe en Supabase — monitoreo desactivado "
                        "(ejecutar supabase/2026-09_monitoreo.sql)")
            estado.monitoreo_activo = False
            return
        if not r.ok:
            log.warning(f"📈 Monitoreo rechazado ({r.status_code}): {r.text[:200]}")
            return
        ERRORES.reset()
        log.info(
            f"📈 Monitoreo: CPU {payload['cpu_pct']}% · RAM {payload['ram_pct']}% · "
            f"{payload['temp_c']}°C · disco libre {disco_libre_pct}% · energía {payload['throttled']}"
        )
    except Exception as e:
        log.warning(f"📈 Monitoreo no se pudo enviar: {e}")


# ─────────────────────────────────────────────
#  DETECCIÓN DE INTERNET
# ─────────────────────────────────────────────

def check_internet(cfg: Config) -> bool:
    """Verifica conectividad a internet intentando llegar a R2."""
    try:
        requests.get(f"{cfg.r2_public_url}/ping", timeout=5, allow_redirects=False)
        return True
    except Exception:
        pass
    try:
        # create_connection cierra el socket al salir del with y no toca el
        # timeout global del proceso (evita fugas de file descriptors 24/7).
        with socket.create_connection(("8.8.8.8", 53), timeout=3):
            return True
    except Exception:
        return False


# ─────────────────────────────────────────────
#  API DAHUA
# ─────────────────────────────────────────────

class DahuaAPI:
    def __init__(self, cfg: Config, log: logging.Logger):
        self.base = f"http://{cfg.camera_ip}"
        self.user = cfg.camera_user
        self.password = cfg.camera_pass
        self.log = log
        # Una sola sesión HTTP para todo el proceso (conexión keep-alive y el
        # mismo login digest): cada login nuevo abre una sesión en la cámara y,
        # si se abren muchas por minuto, la cámara invalida búsquedas en curso
        # ("Invalid session in request data!").
        self.session = requests.Session()
        self.session.auth = self._auth()

    def _auth(self):
        return HTTPDigestAuth(self.user, self.password)

    def _get(self, path: str, params: dict = None, stream: bool = False,
             timeout: int = 30, raw_query: str = None):
        url = self.base + path
        if raw_query:
            url = url + "?" + raw_query
            return self.session.get(url, stream=stream, timeout=timeout)
        return self.session.get(url, params=params, stream=stream, timeout=timeout)

    def get_current_time(self) -> Optional[datetime]:
        """Hora actual del reloj de la cámara (para detectar relojes desfasados)."""
        r = self._get("/cgi-bin/global.cgi", {"action": "getCurrentTime"}, timeout=10)
        r.raise_for_status()
        for line in r.text.splitlines():
            if line.startswith("result="):
                return datetime.strptime(line.split("=", 1)[1].strip(), "%Y-%m-%d %H:%M:%S")
        return None

    def list_dav_files(self, date_str: str = None, intentos: int = 4) -> list:
        """
        Devuelve lista de dicts con:
          - path: ruta en la cámara (/mnt/sd/YYYY-MM-DD/001/dav/HH/HH.MM.SS-HH.MM.SS[...].dav)
          - size: bytes
          - start_time: str "YYYY-MM-DD HH:MM:SS"
          - end_time:   str "YYYY-MM-DD HH:MM:SS"
        La cámara rechaza ~1 de cada 6 búsquedas con "Invalid session in request
        data!" (medido en la HDBW2649E, firmware 2.880, sep-2026). Se reintenta
        con espera creciente, y si sigue fallando se lanza una excepción (nunca se
        devuelve una lista vacía falsa, que haría creer que no hay grabaciones).
        """
        if date_str is None:
            date_str = datetime.now().strftime("%Y-%m-%d")
        for intento in range(1, intentos + 1):
            try:
                return self._buscar_dav(date_str)
            except Exception as e:
                if intento == intentos:
                    raise
                self.log.debug(f"Búsqueda en la cámara falló (intento {intento}): {e}")
                time.sleep(2 * intento)

    def _buscar_dav(self, date_str: str) -> list:
        # Crear sesión de búsqueda
        r = self._get("/cgi-bin/mediaFileFind.cgi", {"action": "factory.create"})
        r.raise_for_status()
        object_id = None
        for line in r.text.strip().splitlines():
            if line.startswith("result="):
                object_id = line.split("=", 1)[1].strip()
        if not object_id:
            raise RuntimeError(f"No se obtuvo object ID de mediaFileFind: {r.text!r}")

        # La sesión de búsqueda SIEMPRE se cierra y destruye (finally): la cámara
        # admite pocas sesiones abiertas y si se acumulan rechaza búsquedas.
        # Ojo: en esta cámara (HDBW2649E) "factory.destroy" da 501; lo correcto
        # es action=close + action=destroy.
        try:
            raw_query = (
                f"action=findFile&object={object_id}"
                f"&condition.Channel=1"
                f"&condition.StartTime={date_str} 00:00:00"
                f"&condition.EndTime={date_str} 23:59:59"
                f"&condition.Dirs[0]=/mnt/sd"
                f"&condition.Types[0]=dav"
                f"&condition.Flag[0]=Normal"
            )
            r = self._get("/cgi-bin/mediaFileFind.cgi", raw_query=raw_query)
            r.raise_for_status()
            if not r.text.strip().startswith("OK"):
                raise RuntimeError(f"La cámara rechazó la búsqueda: {r.text.strip()[:200]}")

            files = []
            while True:
                r = self._get("/cgi-bin/mediaFileFind.cgi", {
                    "action": "findNextFile",
                    "object": object_id,
                    "count":  100,
                })
                r.raise_for_status()
                text = r.text.strip()
                if "found=" not in text:
                    if "error" in text.lower():
                        raise RuntimeError(f"La cámara falló al entregar resultados: {text[:200]}")
                    break

                items: dict = {}
                found = 0
                for line in text.splitlines():
                    if line.startswith("found="):
                        found = int(line.split("=", 1)[1])
                    elif "=" in line:
                        key, _, val = line.partition("=")
                        items[key.strip()] = val.strip()

                for i in range(found):
                    prefix = f"items[{i}]"
                    file_path  = items.get(f"{prefix}.FilePath", "")
                    start_time = items.get(f"{prefix}.StartTime", "")
                    end_time   = items.get(f"{prefix}.EndTime", "")
                    size       = int(items.get(f"{prefix}.Length", 0) or 0)
                    if file_path.endswith(".dav"):
                        files.append({
                            "path":       file_path,
                            "size":       size,
                            "start_time": start_time,
                            "end_time":   end_time,
                        })

                if found < 100:
                    break
        finally:
            for accion in ("close", "destroy"):
                try:
                    self._get("/cgi-bin/mediaFileFind.cgi", {
                        "action": accion, "object": object_id
                    }, timeout=10)
                except Exception:
                    pass

        return files

    def download_file(self, remote_path: str, local_path: Path) -> None:
        url_path = f"/cgi-bin/RPC_Loadfile{remote_path}"
        self.log.info(f"  ↓ Descargando {remote_path} ...")
        t0 = time.time()
        with self._get(url_path, stream=True, timeout=300) as r:
            r.raise_for_status()
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)
        self.log.info(
            f"  ✓ Descargado ({local_path.stat().st_size / 1024 / 1024:.1f} MB en {time.time() - t0:.0f} s)"
        )


# ─────────────────────────────────────────────
#  DETECCIÓN DE PERSONAS (API Dahua)
# ─────────────────────────────────────────────

class MotionDetector:
    def __init__(self, dahua: DahuaAPI, log: logging.Logger):
        self.dahua = dahua
        self.log = log

    def detect_humans(self) -> Optional[bool]:
        """
        Consulta si la cámara detecta personas en este momento.
        SmartMotionHuman (IA) con fallback a VideoMotion genérico.
        Devuelve None si no se pudo preguntar: un error de comunicación NO debe
        contar como "cancha vacía" (eso haría borrar partidos reales).
        """
        for code in ["SmartMotionHuman", "VideoMotion"]:
            try:
                r = self.dahua._get("/cgi-bin/eventManager.cgi",
                                    {"action": "getEventIndexes", "code": code}, timeout=10)
                text = r.text.strip()
                if "channels[0]" in text:
                    return True
                elif "No Events" in text:
                    return False
            except Exception as e:
                self.log.debug(f"  ⚠ Error detección {code}: {e}")
        return None


# ─────────────────────────────────────────────
#  FFMPEG — DAV → HLS
# ─────────────────────────────────────────────

def convert_to_hls(cfg: Config, log: logging.Logger, input_path: Path, output_dir: Path) -> Path:
    """Convierte un .dav a HLS. Devuelve la ruta de la playlist .m3u8."""
    output_dir.mkdir(parents=True, exist_ok=True)
    playlist = output_dir / "playlist.m3u8"
    segment_pattern = str(output_dir / "segment_%03d.ts")

    cmd = [
        cfg.ffmpeg_bin,
        "-y",
        "-fflags", "+genpts+igndts+discardcorrupt",
        "-err_detect", "ignore_err",
        "-i", str(input_path),
        "-c:v", "copy",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        "-reset_timestamps", "1",
        "-f", "hls",
        "-hls_time", str(HLS_TIME),
        "-hls_list_size", "0",
        "-hls_segment_filename", segment_pattern,
        str(playlist),
    ]

    log.info(f"  🎬 Convirtiendo con ffmpeg ...")
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        log.error(f"ffmpeg error:\n{result.stderr[-2000:]}")
        raise RuntimeError(f"ffmpeg falló con código {result.returncode}")

    return playlist


def _leer_duraciones_hls(playlist: Path) -> dict:
    """{nombre_ts: duración_en_segundos} según la playlist que generó ffmpeg."""
    duraciones = {}
    pendiente = None
    for line in playlist.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#EXTINF:"):
            try:
                pendiente = float(line[len("#EXTINF:"):].split(",")[0])
            except ValueError:
                pendiente = None
        elif line and not line.startswith("#"):
            duraciones[Path(line).name] = pendiente or float(HLS_TIME)
            pendiente = None
    return duraciones


# ─────────────────────────────────────────────
#  CLOUDFLARE R2
# ─────────────────────────────────────────────

_R2_CLIENT = None


def get_r2_client(cfg: Config):
    # Un solo cliente para todo el proceso (el cliente de boto3 es thread-safe).
    global _R2_CLIENT
    if _R2_CLIENT is None:
        _R2_CLIENT = boto3.client(
            "s3",
            endpoint_url=cfg.r2_endpoint,
            aws_access_key_id=cfg.r2_access_key,
            aws_secret_access_key=cfg.r2_secret_key,
            region_name="auto",
            config=BotocoreConfig(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
        )
    return _R2_CLIENT


def _r2_prefix(cfg: Config, fecha_str: str, match_hour: int) -> str:
    """Construye el prefijo R2 para un partido."""
    return f"processed/{cfg.complejo}/{cfg.deporte}/{cfg.cancha}/{fecha_str}/{match_hour:02d}00"


def delete_match_from_r2(cfg: Config, log: logging.Logger,
                         fecha_str: str, match_hour: int, manifest: list):
    """Borra de R2 todos los archivos de un partido (sin actividad o bloqueado)."""
    prefix = _r2_prefix(cfg, fecha_str, match_hour)
    keys = [f"{prefix}/{e['name']}" for e in manifest] + [f"{prefix}/playlist.m3u8"]
    log.info(f"  🗑  Borrando {len(keys)} archivos de R2 ...")
    s3 = get_r2_client(cfg)
    for i in range(0, len(keys), 1000):   # R2/S3 admite máx. 1000 por llamada
        s3.delete_objects(
            Bucket=cfg.r2_bucket,
            Delete={"Objects": [{"Key": k} for k in keys[i:i + 1000]], "Quiet": True},
        )
    log.info(f"  ✓ Archivos del partido eliminados de R2")


def upload_segment_to_r2(
    cfg: Config,
    log: logging.Logger,
    dahua: DahuaAPI,
    seg: dict,
    fecha_str: str,
    match_hour: int,
    start_index: int,
) -> tuple:
    """
    Descarga un .dav, lo convierte a HLS y sube los .ts a R2 en paralelo.
    Devuelve (ok, entradas_para_el_manifiesto).
    """
    remote_path = seg["path"]
    prefix = _r2_prefix(cfg, fecha_str, match_hour)

    safe_name = remote_path.replace("/", "_").lstrip("_")
    seg_dir  = cfg.work_dir / safe_name
    dav_path = seg_dir / "input.dav"
    hls_dir  = seg_dir / "hls"

    try:
        dahua.download_file(remote_path, dav_path)
        playlist = convert_to_hls(cfg, log, dav_path, hls_dir)
        dav_path.unlink(missing_ok=True)

        duraciones = _leer_duraciones_hls(playlist)
        ts_files = sorted(hls_dir.glob("*.ts"))
        if not ts_files:
            raise RuntimeError("ffmpeg no generó ningún .ts")

        upload_tasks = []
        entries = []
        for i, ts_src in enumerate(ts_files):
            ts_name = f"segment_{start_index + i:04d}.ts"
            upload_tasks.append((str(ts_src), ts_name))
            entries.append({
                "name": ts_name,
                "dur":  round(duraciones.get(ts_src.name, float(HLS_TIME)), 3),
                # Cada .dav se convierte por separado y sus tiempos parten de 0:
                # el reproductor necesita un aviso de discontinuidad entre archivos.
                "disc": i == 0 and start_index > 0,
                "src":  remote_path,
            })

        s3 = get_r2_client(cfg)
        log.info(f"  ☁  Subiendo {len(upload_tasks)} .ts en paralelo "
                 f"(índice {start_index}→{start_index + len(upload_tasks) - 1}) ...")
        t0 = time.time()

        def _upload_one(task):
            local_path, ts_name = task
            s3.upload_file(
                local_path,
                cfg.r2_bucket,
                f"{prefix}/{ts_name}",
                ExtraArgs={"ContentType": "video/MP2T"},
            )
            return ts_name

        failed = []
        with ThreadPoolExecutor(max_workers=cfg.upload_workers) as pool:
            futures = {pool.submit(_upload_one, t): t for t in upload_tasks}
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    task = futures[future]
                    failed.append(task[1])
                    log.error(f"  ✗ Error subiendo {task[1]}: {e}")

        if failed:
            raise RuntimeError(f"Fallaron {len(failed)} uploads: {failed[:5]}")

        log.info(f"  ✓ Segmento subido ({len(upload_tasks)} .ts en {time.time() - t0:.1f} s)")
        return True, entries

    except Exception as e:
        log.error(f"  ✗ Error procesando segmento {remote_path}: {e}")
        return False, []

    finally:
        shutil.rmtree(seg_dir, ignore_errors=True)


def build_and_upload_playlist(
    cfg: Config, log: logging.Logger,
    fecha_str: str, match_hour: int,
    manifest: list, final: bool = False,
) -> str:
    """
    Construye la playlist .m3u8 con las duraciones reales de cada .ts y la sube a R2.
    Si final=True agrega #EXT-X-ENDLIST.
    """
    prefix = _r2_prefix(cfg, fecha_str, match_hour)

    target = max(HLS_TIME, math.ceil(max((e["dur"] for e in manifest), default=HLS_TIME)))
    lines = ["#EXTM3U", "#EXT-X-VERSION:3", f"#EXT-X-TARGETDURATION:{target}", "#EXT-X-MEDIA-SEQUENCE:0"]
    for e in manifest:
        if e.get("disc"):
            lines.append("#EXT-X-DISCONTINUITY")
        lines.append(f"#EXTINF:{e['dur']:.3f},")
        lines.append(e["name"])
    if final:
        lines.append("#EXT-X-ENDLIST")

    s3 = get_r2_client(cfg)
    s3.put_object(
        Bucket=cfg.r2_bucket,
        Key=f"{prefix}/playlist.m3u8",
        Body=("\n".join(lines) + "\n").encode("utf-8"),
        ContentType="application/x-mpegURL",
    )
    return f"{cfg.r2_public_url}/{prefix}/playlist.m3u8"


# ─────────────────────────────────────────────
#  SUPABASE — partidos, camera_settings, ocupación
# ─────────────────────────────────────────────

def register_in_supabase(
    cfg: Config,
    log: logging.Logger,
    fecha: str,
    hora_inicio: int,
    duracion_minutos: int,
    archivo_url: str,
    raw_url: str,
    ciudad: str = "Santiago",
    privado: bool = False,
    password_hash: str = None,
) -> bool:
    hora_fin = hora_inicio + 1
    hora_str = f"{hora_inicio:02d}:00-{hora_fin:02d}:00"

    url = f"{cfg.supabase_url}/rest/v1/partidos"

    # Idempotencia: si el partido ya existe (p. ej. finalize corrió dos veces
    # tras un reinicio por corte de luz), no crear una fila duplicada.
    try:
        existe = requests.get(
            url,
            headers=_sb_headers(cfg),
            params={
                "complejo":      f"eq.{cfg.complejo_nombre}",
                "numero_cancha": f"eq.{cfg.cancha}",
                "deporte":       f"eq.{cfg.deporte}",
                "fecha":         f"eq.{fecha}",
                "hora":          f"eq.{hora_str}",
                "select":        "id",
            },
            timeout=10,
        )
        if existe.ok and existe.json():
            log.info(f"  ↺ Partido ya estaba registrado ({fecha} {hora_str}) — no se duplica")
            return True
    except Exception as e:
        log.warning(f"  (no se pudo verificar duplicado, se inserta igual: {e})")

    payload = {
        "complejo":         cfg.complejo_nombre,
        "deporte":          cfg.deporte,
        "numero_cancha":    int(cfg.cancha),
        "ciudad":           ciudad,
        "fecha":            fecha,
        "hora":             hora_str,
        "duracion_minutos": duracion_minutos,
        "archivo_url":      archivo_url,
        "estado":           "listo",
        "raw_url":          raw_url,
        "privado":          privado,
        "password_hash":    password_hash,
    }
    try:
        r = requests.post(
            url,
            headers=_sb_headers(cfg, {"Content-Type": "application/json", "Prefer": "return=minimal"}),
            json=payload, timeout=30,
        )
        if not r.ok:
            log.error(f"  ✗ Supabase rechazó el partido ({r.status_code}): {r.text[:300]}")
            return False
        estado_txt = "🔒 PRIVADO" if privado else "🌐 PÚBLICO"
        log.info(f"  ✓ Registrado en Supabase ({estado_txt}): {cfg.complejo_nombre} | {fecha} | {hora_str}")
        return True
    except Exception as e:
        log.error(f"  ✗ Error Supabase: {e}")
        return False


def check_camera_settings(cfg: Config, log: logging.Logger, fecha_str: str, match_hour: int) -> dict:
    """
    Consulta camera_settings (grilla "Configuración" del panel) para este bloque.
    Devuelve dict con:
      - estado: 'publico' | 'privado' | 'bloqueado'
      - graba: True | False
      - password_hash: str | None
    Si no hay registro o falla la consulta → público por defecto.
    """
    default = {"estado": "publico", "graba": True, "password_hash": None}
    hora_str = f"{match_hour:02d}:00"

    params = {
        "complejo":      f"eq.{cfg.complejo_nombre}",
        "numero_cancha": f"eq.{cfg.cancha}",
        # Filtrar por deporte: la cancha 1 de fútbol y la cancha 1 de pádel son
        # canchas distintas, con configuraciones distintas.
        "deporte":       f"eq.{cfg.deporte}",
        "fecha":         f"eq.{fecha_str}",
        "hora":          f"eq.{hora_str}",
        "select":        "estado,graba,password_hash",
    }
    try:
        r = requests.get(f"{cfg.supabase_url}/rest/v1/camera_settings",
                         headers=_sb_headers(cfg), params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if not data:
            return default
        row = data[0]
        resultado = {
            "estado":        row.get("estado") or "publico",
            "graba":         row.get("graba", True) is not False,
            "password_hash": row.get("password_hash"),
        }
        if resultado["estado"] == "bloqueado" or not resultado["graba"]:
            log.info(f"  🚫 Cancha {cfg.cancha} BLOQUEADA para {fecha_str} {hora_str}")
        elif resultado["estado"] == "privado":
            log.info(f"  🔒 Cancha {cfg.cancha} PRIVADA para {fecha_str} {hora_str}")
        return resultado
    except Exception as e:
        log.warning(f"  ⚠ Error consultando camera_settings: {e} → grabando como público")
        return default


def register_ocupacion(cfg: Config, log: logging.Logger, fecha_str: str, match_hour: int, ocupada: bool) -> bool:
    """
    Registra en ocupacion_canchas si la cancha estuvo ocupada o no.
    Se ejecuta SIEMPRE al cerrar un bloque horario, independiente de si se grabó.
    Si la fila ya existe se actualiza (no se duplica tras un reinicio).
    """
    hora_str = f"{match_hour:02d}:00"
    url = f"{cfg.supabase_url}/rest/v1/ocupacion_canchas"
    filtro = {
        "complejo":      f"eq.{cfg.complejo_nombre}",
        "numero_cancha": f"eq.{cfg.cancha}",
        "deporte":       f"eq.{cfg.deporte}",
        "fecha":         f"eq.{fecha_str}",
        "hora":          f"eq.{hora_str}",
    }
    payload = {
        "complejo":      cfg.complejo_nombre,
        "numero_cancha": int(cfg.cancha),
        "deporte":       cfg.deporte,
        "fecha":         fecha_str,
        "hora":          hora_str,
        "ocupada":       ocupada,
        "detectado_en":  _utc_now_iso(),
    }
    headers = _sb_headers(cfg, {"Content-Type": "application/json", "Prefer": "return=minimal"})
    try:
        existe = requests.get(url, headers=_sb_headers(cfg), params={**filtro, "select": "id"}, timeout=10)
        existe.raise_for_status()
        filas = existe.json()
        if filas:
            r = requests.patch(url, headers=headers, params={"id": f"eq.{filas[0]['id']}"},
                               json=payload, timeout=10)
        else:
            r = requests.post(url, headers=headers, json=payload, timeout=10)
        if not r.ok:
            log.error(f"  ✗ Supabase rechazó la ocupación ({r.status_code}): {r.text[:300]}")
            return False
        estado = "🟢 OCUPADA" if ocupada else "⚪ VACÍA"
        log.info(f"  📊 Ocupación registrada: {fecha_str} {hora_str} → {estado}")
        return True
    except Exception as e:
        log.error(f"  ✗ Error registrando ocupación: {e}")
        return False


def verificar_cancha_en_supabase(cfg: Config, log: logging.Logger):
    """
    Al arrancar: comprueba que COMPLEJO_NOMBRE / CANCHA / DEPORTE del .env
    coinciden EXACTO con la tabla `camaras`. Si no coinciden, el panel no
    enlaza los videos con la cancha y los bloqueos/privados no se aplican.
    """
    try:
        r = requests.get(
            f"{cfg.supabase_url}/rest/v1/camaras",
            headers=_sb_headers(cfg),
            params={"complejo": f"eq.{cfg.complejo_nombre}", "numero_cancha": f"eq.{cfg.cancha}",
                    "select": "deporte,activa"},
            timeout=10,
        )
        r.raise_for_status()
        deportes = [row.get("deporte") for row in r.json()]
    except Exception as e:
        log.warning(f"⚠ No se pudo verificar la cancha en la tabla 'camaras': {e}")
        return
    if not deportes:
        log.warning(
            f"⚠ La tabla 'camaras' no tiene la cancha {cfg.cancha} de '{cfg.complejo_nombre}'. "
            f"Revisa COMPLEJO_NOMBRE y CANCHA en el .env (deben ser idénticos a Supabase)."
        )
    elif cfg.deporte not in deportes:
        log.warning(
            f"⚠ DEPORTE='{cfg.deporte}' no coincide con la tabla 'camaras' "
            f"(valores válidos: {', '.join(repr(d) for d in deportes)}). "
            f"Corrige DEPORTE en el .env — tildes incluidas."
        )
    else:
        log.info(f"✓ Cancha verificada en Supabase: {cfg.complejo_nombre} · {cfg.deporte} · cancha {cfg.cancha}")


# ─────────────────────────────────────────────
#  LÓGICA DE BLOQUES HORARIOS
# ─────────────────────────────────────────────

def _parse_dt(s: str) -> Optional[datetime]:
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def get_match_hour(cfg: Config, dt: datetime):
    """
    Dado un datetime, devuelve la hora de inicio del bloque de partido.
    Ej: 21:37 → 21, 06:50 → None (fuera de horario)
    """
    h = dt.hour
    if h in cfg.match_start_hours:
        return h
    if h > 0 and (h - 1) in cfg.match_start_hours and dt.minute <= 5:
        return h - 1
    return None


def group_segments_by_match(cfg: Config, files: list) -> dict:
    """
    Agrupa segmentos por (fecha, hora_partido).
    Devuelve dict: { (fecha_str, hora_int): [file_info, ...] }
    """
    groups: dict = {}
    for f in files:
        dt = _parse_dt(f["start_time"])
        if dt is None:
            continue
        match_hour = get_match_hour(cfg, dt)
        if match_hour is None:
            continue
        key = (dt.strftime("%Y-%m-%d"), match_hour)
        groups.setdefault(key, []).append(f)

    for key in groups:
        groups[key].sort(key=lambda x: x["start_time"])

    return groups


def _block_end(fecha_str: str, match_hour: int) -> datetime:
    return datetime.strptime(fecha_str, "%Y-%m-%d") + timedelta(hours=match_hour + 1)


def match_is_complete(fecha_str: str, match_hour: int, segments: list,
                      newest_start: Optional[datetime], now: datetime) -> bool:
    """
    Un partido se considera terminado cuando ocurre cualquiera de estas condiciones:
    1. Algún archivo termina exactamente en la hora de fin del bloque
    2. La cámara ya tiene un archivo que empieza en el bloque siguiente (o después)
    3. Ya pasaron 6 minutos de la hora de fin (respaldo si la cámara dejó de grabar)
    """
    end = _block_end(fecha_str, match_hour)
    end_str = end.strftime("%Y-%m-%d %H:%M:%S")

    if any(seg.get("end_time") == end_str for seg in segments):
        return True
    if newest_start is not None and newest_start >= end:
        return True
    return now > end + timedelta(minutes=6)


def segment_is_closed(seg: dict, newest_start: Optional[datetime], now: datetime) -> bool:
    """
    True si la cámara terminó de escribir este archivo. La cámara graba un
    archivo a la vez: si ya existe uno más nuevo, este está cerrado. Si no, se
    espera a que pase 1 minuto de su hora de término. Así nunca se descarga un
    archivo a medio grabar (quedaría cortado y se marcaría como hecho).
    """
    start = _parse_dt(seg["start_time"])
    end = _parse_dt(seg["end_time"])
    if start is not None and newest_start is not None and newest_start > start:
        return True
    if end is not None:
        return now >= end + timedelta(minutes=1)
    return False


# ─────────────────────────────────────────────
#  PIPELINE POR PARTIDO
# ─────────────────────────────────────────────

def _srcs_hechos(manifest: list) -> set:
    return {e.get("src") for e in manifest if e.get("src")}


def process_new_segments(
    cfg: Config, log: logging.Logger,
    dahua: DahuaAPI, fecha_str: str, match_hour: int,
    segments: list, processed: set, estado: Estado,
) -> int:
    """
    Sube a R2, en orden, los archivos del partido que aún no se han subido.
    Si uno falla, se detiene (para no desordenar el video) y se reintenta en la
    próxima vuelta. Tras MAX_REINTENTOS_SEG fallos, ese archivo se omite.
    Devuelve cuántos archivos se subieron.
    """
    manifest = load_manifest(cfg, fecha_str, match_hour)
    hechos = _srcs_hechos(manifest) | processed
    subidos = 0

    for seg in segments:
        path = seg["path"]
        if path in hechos:
            continue
        if estado.fallos_segmento.get(path, 0) >= MAX_REINTENTOS_SEG:
            continue  # ya se dio por perdido (se avisó en el log)

        ok, entries = upload_segment_to_r2(cfg, log, dahua, seg, fecha_str, match_hour, len(manifest))
        if not ok:
            n = estado.fallos_segmento.get(path, 0) + 1
            estado.fallos_segmento[path] = n
            if n >= MAX_REINTENTOS_SEG:
                log.error(f"  ✗ {path} falló {n} veces — se omite del video")
                continue
            log.warning(f"  ⏸ Intento {n}/{MAX_REINTENTOS_SEG} fallido — se reintenta en la próxima vuelta")
            break

        manifest.extend(entries)
        save_manifest(cfg, fecha_str, match_hour, manifest)
        estado.ultimo_segmento_subido = _utc_now_iso()
        subidos += 1

    return subidos


def finalize_match(
    cfg: Config, log: logging.Logger,
    dahua: DahuaAPI, fecha_str: str, match_hour: int,
    segments: list, processed: set, estado: Estado,
    cam_settings: dict,
) -> bool:
    """
    Cierra un partido. Devuelve True si quedó resuelto (se marca como hecho) o
    False si hay que reintentar en la próxima vuelta.
    1) Sube segmentos pendientes
    2) SIEMPRE registra ocupación en ocupacion_canchas
    3) Sin actividad humana → borra de R2 y no registra partido
    4) Con actividad → playlist final con #EXT-X-ENDLIST + registro en `partidos`
    """
    log.info(f"  🏁 Finalizando partido {fecha_str} {match_hour:02d}:00-{match_hour + 1:02d}:00 ...")

    process_new_segments(cfg, log, dahua, fecha_str, match_hour, segments, processed, estado)

    manifest = load_manifest(cfg, fecha_str, match_hour)
    hechos = _srcs_hechos(manifest) | processed
    pendientes = [
        s for s in segments
        if s["path"] not in hechos and estado.fallos_segmento.get(s["path"], 0) < MAX_REINTENTOS_SEG
    ]
    if pendientes:
        log.warning(f"  ⏳ Quedan {len(pendientes)} archivo(s) por subir — se reintenta")
        return False

    has_activity = match_has_activity(cfg, log, fecha_str, match_hour)
    if not register_ocupacion(cfg, log, fecha_str, match_hour, has_activity):
        return False

    if not manifest:
        log.error(f"  ✗ Partido {fecha_str} {match_hour:02d}:00 sin video: no se pudo subir ningún archivo")
        clear_match_state(cfg, fecha_str, match_hour)
        return True

    if not has_activity:
        log.info(f"  ⚪ Sin actividad — borrando de R2 y omitiendo registro")
        delete_match_from_r2(cfg, log, fecha_str, match_hour, manifest)
        clear_match_state(cfg, fecha_str, match_hour)
        return True

    log.info(f"  🟢 Actividad confirmada — registrando partido")
    playlist_url = build_and_upload_playlist(cfg, log, fecha_str, match_hour, manifest, final=True)
    log.info(f"  ✓ Playlist final: {playlist_url}")

    segundos = sum(e["dur"] for e in manifest)
    duracion_total = max(1, round(segundos / 60))
    if duracion_total < 50:
        # Un partido de 1 hora debería tener ~60 min. Si tiene mucho menos, la
        # cámara no grabó (o no entregó) todos los archivos de esa hora.
        log.warning(
            f"  ⚠ Partido incompleto: {duracion_total} min de video en {len(segments)} archivo(s) "
            f"({segments[0]['start_time'][11:16]}→{segments[-1]['end_time'][11:16]}). "
            f"Revisar grabación de la cámara (ver MANUAL_OPERACION.md)."
        )

    es_privado = cam_settings["estado"] == "privado"
    ok = register_in_supabase(
        cfg, log,
        fecha            = fecha_str,
        hora_inicio      = match_hour,
        duracion_minutos = duracion_total,
        archivo_url      = playlist_url,
        raw_url          = f"dahua://{cfg.camera_ip}/match/{fecha_str}/{match_hour:02d}00",
        privado          = es_privado,
        password_hash    = cam_settings["password_hash"] if es_privado else None,
    )
    if not ok:
        return False  # el video ya está en R2; se reintenta solo el registro

    estado.ultimo_partido_registrado = _utc_now_iso()
    clear_match_state(cfg, fecha_str, match_hour)
    return True


def _cerrar_partido_sin_video(cfg: Config, log: logging.Logger, fecha_str: str, match_hour: int,
                              ocupada: bool, processed: set, match_key: str) -> bool:
    """Registra ocupación, borra lo que se haya subido y marca el partido como hecho."""
    if not register_ocupacion(cfg, log, fecha_str, match_hour, ocupada):
        return False
    manifest = load_manifest(cfg, fecha_str, match_hour)
    if manifest:
        delete_match_from_r2(cfg, log, fecha_str, match_hour, manifest)
    clear_match_state(cfg, fecha_str, match_hour)
    processed.add(match_key)
    save_processed(cfg, processed)
    return True


# ─────────────────────────────────────────────
#  LOOP PRINCIPAL
# ─────────────────────────────────────────────

def _medir_desfase_camara(dahua: DahuaAPI, log: logging.Logger, estado: Estado, avisar: bool):
    try:
        t_cam = dahua.get_current_time()
        if t_cam is None:
            return
        desfase = round((t_cam - datetime.now()).total_seconds(), 1)
        estado.camara_desfase_s = desfase
        if abs(desfase) > 60:
            log.warning(
                f"🕒 El reloj de la cámara difiere {desfase:+.0f} s del de la Pi. "
                f"Revisar zona horaria / NTP (ver MANUAL_OPERACION.md)."
            )
        elif avisar:
            log.info(f"🕒 Reloj cámara vs Pi: {desfase:+.0f} s (OK)")
    except Exception as e:
        log.debug(f"No se pudo leer la hora de la cámara: {e}")


def _handle_sigterm(signum, frame):
    # systemctl stop/restart manda SIGTERM: lo convertimos en salida ordenada.
    raise SystemExit(0)


def main():
    cfg = load_config_from_env()
    cfg.validate()

    log = setup_logging(cfg)
    signal.signal(signal.SIGTERM, _handle_sigterm)

    log.info("=" * 60)
    log.info(f"🎥 Lacar Sports — Pipeline iniciado (versión {SCRIPT_VERSION})")
    log.info(f"   Instancia: {cfg.instance_id}")
    log.info(f"   Complejo:  {cfg.complejo_nombre} | Deporte: {cfg.deporte} | Cancha: {cfg.cancha}")
    log.info(f"   Cámara:    {cfg.camera_ip}")
    log.info(f"   Hora Pi:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ({time.strftime('%Z %z')})")
    log.info(f"   ffmpeg:    {cfg.ffmpeg_bin}")
    log.info(f"   State dir: {cfg.work_dir}")
    log.info(f"   Log:       {cfg.log_path}")
    log.info("=" * 60)

    cleanup_state(cfg, log, borrar_temporales=True)

    startup_time = datetime.now()
    # Ventana de recuperación: al arrancar (p. ej. tras un corte de luz) se
    # revisan las últimas RECOVERY_HOURS horas y se terminan los partidos que
    # hayan quedado a medias. Los ya terminados están en processed_files.json.
    recovery_start = (startup_time - timedelta(hours=cfg.recovery_hours)).replace(
        minute=0, second=0, microsecond=0)
    log.info(f"🔄 Ventana de recuperación: partidos desde {recovery_start.strftime('%Y-%m-%d %H:%M')}")

    dahua     = DahuaAPI(cfg, log)
    detector  = MotionDetector(dahua, log)
    processed = prune_processed(load_processed(cfg))
    save_processed(cfg, processed)
    estado    = Estado()
    log.info(f"Partidos ya procesados (últimos {DIAS_ESTADO} días): "
             f"{sum(1 for p in processed if not p.startswith('/'))}")

    _medir_desfase_camara(dahua, log, estado, avisar=True)
    verificar_cancha_en_supabase(cfg, log)
    send_heartbeat(cfg, log, "online", f"Pipeline iniciado (v{SCRIPT_VERSION})")

    last_heartbeat   = time.time()
    last_monitor     = 0.0
    last_housekeeping = time.time()

    while True:
        try:
            log.info("─" * 40)
            now = datetime.now()

            # ── Verificar internet ──────────────────────────────────────
            internet_ahora = check_internet(cfg)
            if internet_ahora and not estado.internet_ok:
                log.info("🌐 Internet restaurado")
                estado.internet_ok = True
                send_heartbeat(cfg, log, "online", "Internet restaurado")
            elif not internet_ahora and estado.internet_ok:
                log.warning("📵 Sin internet — modo offline (se sigue midiendo actividad)")
                estado.internet_ok = False

            # ── Muestra de actividad del bloque que está ocurriendo ahora ─
            # Solo se muestrea el bloque en curso: así los partidos pasados no
            # reciben muestras de otra hora (p. ej. al volver internet).
            live_hour = get_match_hour(cfg, now)
            if live_hour is not None:
                det = detector.detect_humans()
                fecha_live = now.strftime("%Y-%m-%d")
                if det is None:
                    log.info(f"   ❔ Actividad {fecha_live} {live_hour:02d}:00: sin respuesta de la cámara (no cuenta)")
                else:
                    dets = get_match_detections(cfg, fecha_live, live_hour)
                    dets.append(det)
                    save_match_detections(cfg, fecha_live, live_hour, dets)
                    log.info(f"   {'🟢' if det else '⚪'} Actividad {fecha_live} {live_hour:02d}:00: "
                             f"{'SÍ' if det else 'NO'} ({sum(dets)}/{len(dets)} muestras con personas)")

            # ── Consultar cámara ────────────────────────────────────────
            log.info("🔍 Consultando cámara ...")
            # Hasta 24 h hacia atrás: si se cayó internet en la noche, los
            # partidos del día anterior se suben igual cuando vuelve.
            eligible_from = max(recovery_start, (now - timedelta(hours=24)).replace(
                minute=0, second=0, microsecond=0))
            dias = []
            d = eligible_from.date()
            while d <= now.date():
                dias.append(d.strftime("%Y-%m-%d"))
                d += timedelta(days=1)

            files_all = []
            errores_listado = 0
            for date_str_check in dias:
                try:
                    files_all.extend(dahua.list_dav_files(date_str=date_str_check))
                except Exception as e:
                    errores_listado += 1
                    log.warning(f"   No se pudo listar {date_str_check}: {e}")

            # Una búsqueda fallida aislada es normal en esta cámara: solo se da por
            # caída si falla 3 vueltas seguidas (~1,5 min).
            if errores_listado == 0:
                estado.fallos_camara_seguidos = 0
                camara_ahora = True
            else:
                estado.fallos_camara_seguidos += 1
                camara_ahora = estado.camara_ok is not False and estado.fallos_camara_seguidos < 3
            if camara_ahora != estado.camara_ok:
                if camara_ahora and estado.camara_ok is False:
                    log.info("📷 Cámara responde de nuevo")
                    send_heartbeat(cfg, log, "online", "Cámara restaurada")
                elif not camara_ahora:
                    log.error(f"📷 La cámara {cfg.camera_ip} no responde")
                    send_heartbeat(cfg, log, "error", f"Cámara {cfg.camera_ip} no responde")
                estado.camara_ok = camara_ahora

            files = []
            for f in files_all:
                dt_seg = _parse_dt(f["start_time"])
                if dt_seg is not None and dt_seg >= eligible_from:
                    files.append(f)
            starts = [dt for dt in (_parse_dt(f["start_time"]) for f in files_all) if dt is not None]
            newest_start = max(starts) if starts else None

            all_groups = group_segments_by_match(cfg, files)
            log.info(f"   Archivos .dav en ventana: {len(files)} | Partidos: {len(all_groups)}")

            pendientes_total = 0
            for (fecha_str, match_hour), segments in sorted(all_groups.items()):
                match_key = f"{fecha_str}_{match_hour:02d}00"
                etiqueta = f"{fecha_str} {match_hour:02d}:00"

                if match_key in processed:
                    continue

                is_complete = match_is_complete(fecha_str, match_hour, segments, newest_start, now)

                # ── MODO OFFLINE: no se puede subir ni consultar Supabase ─
                if not estado.internet_ok:
                    continue

                cam_settings = check_camera_settings(cfg, log, fecha_str, match_hour)
                debe_grabar = cam_settings["graba"] and cam_settings["estado"] != "bloqueado"

                # ── BLOQUEADO: no se sube video, solo ocupación ─────────
                if not debe_grabar:
                    if is_complete:
                        ocupada = match_has_activity(cfg, log, fecha_str, match_hour)
                        _cerrar_partido_sin_video(cfg, log, fecha_str, match_hour, ocupada, processed, match_key)
                    continue

                # ── DEBE GRABAR (público o privado) ─────────────────────
                cerrados = [s for s in segments if segment_is_closed(s, newest_start, now)]
                manifest = load_manifest(cfg, fecha_str, match_hour)
                hechos = _srcs_hechos(manifest) | processed
                nuevos = [s for s in cerrados if s["path"] not in hechos]
                pendientes_total += len(nuevos)

                if is_complete:
                    if len(cerrados) < len(segments):
                        log.info(f"   ⏳ {etiqueta}: esperando que la cámara cierre el último archivo")
                        continue

                    detections = get_match_detections(cfg, fecha_str, match_hour)
                    if len(detections) >= 2 and not match_has_activity(cfg, log, fecha_str, match_hour):
                        log.info(f"   ⚪ Partido {etiqueta} sin actividad — no se publica")
                        _cerrar_partido_sin_video(cfg, log, fecha_str, match_hour, False, processed, match_key)
                        continue

                    log.info(f"\n🏁 Finalizando partido: {etiqueta}")
                    if finalize_match(cfg, log, dahua, fecha_str, match_hour, segments,
                                      processed, estado, cam_settings):
                        processed.add(match_key)
                        save_processed(cfg, processed)
                        log.info(f"   ✅ Partido {etiqueta} resuelto")
                    else:
                        log.warning(f"   ⚠ No se pudo cerrar {etiqueta} — se reintenta")

                elif nuevos:
                    log.info(f"\n📡 Partido en curso: {etiqueta} — subiendo {len(nuevos)} archivo(s)")
                    process_new_segments(cfg, log, dahua, fecha_str, match_hour, nuevos, processed, estado)
                else:
                    log.info(f"   ⏳ Partido {etiqueta} en curso — sin archivos nuevos")

            estado.segmentos_pendientes = pendientes_total

            # ── Heartbeat y monitoreo periódicos ────────────────────────
            if time.time() - last_heartbeat > cfg.heartbeat_interval:
                if not estado.internet_ok:
                    estado_hb, detalle = "sin_internet", ""
                elif estado.camara_ok is False:
                    estado_hb, detalle = "error", f"Cámara {cfg.camera_ip} no responde"
                else:
                    estado_hb, detalle = "online", ""
                send_heartbeat(cfg, log, estado_hb, detalle)
                last_heartbeat = time.time()

            if estado.internet_ok and time.time() - last_monitor > cfg.monitor_interval:
                _medir_desfase_camara(dahua, log, estado, avisar=False)
                send_monitoreo(cfg, log, estado)
                last_monitor = time.time()

            if time.time() - last_housekeeping > 24 * 3600:
                processed = prune_processed(processed)
                save_processed(cfg, processed)
                cleanup_state(cfg, log, borrar_temporales=False)
                estado.fallos_segmento.clear()
                last_housekeeping = time.time()

            log.info(f"⏳ Esperando {cfg.poll_interval}s ...")
            time.sleep(cfg.poll_interval)

        except (KeyboardInterrupt, SystemExit):
            log.info("⏹ Pipeline detenido")
            send_heartbeat(cfg, log, "offline", "Pipeline detenido")
            break
        except Exception as e:
            log.error(f"Error en el loop principal: {e}", exc_info=True)
            send_heartbeat(cfg, log, "error", str(e)[:200])
            try:
                time.sleep(cfg.poll_interval)
            except (KeyboardInterrupt, SystemExit):
                log.info("⏹ Pipeline detenido")
                send_heartbeat(cfg, log, "offline", "Pipeline detenido")
                break


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Lacar Sports — Diagnóstico de una cámara/instancia.

Revisa todo lo que el pipeline necesita y muestra ✅ / ⚠️ / ❌ en cada punto.
NO modifica nada (solo lee), salvo con --descarga, que baja un archivo de la
cámara y lo convierte con ffmpeg en una carpeta temporal (sin subirlo).

Uso (en la Pi; lee también /opt/lacar/comun.env si existe):
    cd /opt/lacar
    python3 lacar_diagnostico.py .env.camara1
    python3 lacar_diagnostico.py .env.camara1 --descarga     # prueba completa (~1 min)
    python3 lacar_diagnostico.py .env.camara1 --fecha 2026-09-19   # grabaciones de otro día
"""

import os
import sys
import time
import shutil
import platform
import subprocess
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

OK, WARN, FAIL = "✅", "⚠️ ", "❌"
_problemas = []


def titulo(t):
    print(f"\n━━━ {t} " + "━" * max(0, 60 - len(t)))


def res(simbolo, texto):
    print(f"  {simbolo} {texto}")
    if simbolo != OK:
        _problemas.append(f"{simbolo} {texto}")


def cargar_env(path: str):
    """Lee un archivo .env (KEY=valor, comillas opcionales, # comentarios)."""
    p = Path(path)
    if not p.exists():
        print(f"{FAIL} No existe el archivo {path}")
        sys.exit(1)
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if val[:1] in ("'", '"') and val[:1] in val[1:]:
            val = val[1:val.index(val[0], 1)]      # 'valor' → valor
        elif " #" in val:
            val = val.split(" #", 1)[0].strip()   # valor   # comentario → valor
        os.environ[key.strip()] = val


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith("-"):
        print(__doc__)
        sys.exit(1)
    # Igual que el servicio: primero lo común (claves de R2/Supabase) y después
    # lo de la cámara, que gana si una variable está en ambos.
    comun = Path(args[0]).resolve().parent / "comun.env"
    if comun.exists():
        cargar_env(str(comun))
    cargar_env(args[0])
    probar_descarga = "--descarga" in args
    fecha = datetime.now().strftime("%Y-%m-%d")
    if "--fecha" in args:
        fecha = args[args.index("--fecha") + 1]

    import requests
    from lacar_pipeline import (
        load_config_from_env, DahuaAPI, MotionDetector, convert_to_hls,
        get_match_hour, _parse_dt, _leer_duraciones_hls, _temp_c, _throttled, SCRIPT_VERSION,
    )
    import logging
    log = logging.getLogger("diagnostico")
    log.addHandler(logging.NullHandler())

    cfg = load_config_from_env()
    print(f"Lacar Sports — Diagnóstico (script v{SCRIPT_VERSION}) — {datetime.now():%Y-%m-%d %H:%M:%S}")

    # ── 1. Configuración ──────────────────────────────────────────────
    titulo("1. Configuración (.env)")
    try:
        cfg.validate()
        res(OK, "Todas las variables obligatorias están")
    except ValueError as e:
        res(FAIL, str(e))
    print(f"     instancia={cfg.instance_id}  cámara={cfg.camera_ip}  usuario={cfg.camera_user}")
    print(f"     complejo='{cfg.complejo_nombre}' (slug {cfg.complejo})  deporte='{cfg.deporte}'  cancha={cfg.cancha}")
    if cfg.supabase_key.count(".") == 2:
        import base64, json
        try:
            payload = cfg.supabase_key.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            rol = json.loads(base64.urlsafe_b64decode(payload)).get("role")
            print(f"     clave Supabase: rol '{rol}'")
        except Exception:
            pass

    # ── 2. Raspberry Pi ───────────────────────────────────────────────
    titulo("2. Raspberry Pi")
    print(f"     Python {platform.python_version()} · {platform.system()} {platform.release()}")
    zona = time.strftime("%Z %z")
    print(f"     Hora de la Pi: {datetime.now():%Y-%m-%d %H:%M:%S} ({zona})")
    if platform.system() == "Linux":
        try:
            tz = subprocess.run(["timedatectl", "show", "-p", "Timezone", "--value"],
                                capture_output=True, text=True, timeout=5).stdout.strip()
            sync = subprocess.run(["timedatectl", "show", "-p", "NTPSynchronized", "--value"],
                                  capture_output=True, text=True, timeout=5).stdout.strip()
            res(OK if tz == "America/Santiago" else FAIL,
                f"Zona horaria: {tz or '?'}" + ("" if tz == "America/Santiago" else
                " → corregir con: sudo timedatectl set-timezone America/Santiago"))
            res(OK if sync == "yes" else WARN, f"Reloj sincronizado por internet (NTP): {sync or '?'}")
        except Exception:
            pass
    ff = shutil.which(cfg.ffmpeg_bin) or (cfg.ffmpeg_bin if Path(cfg.ffmpeg_bin).exists() else None)
    if ff:
        v = subprocess.run([ff, "-version"], capture_output=True, text=True).stdout.splitlines()[0]
        res(OK, f"ffmpeg: {v[:60]}")
    else:
        res(FAIL, "ffmpeg no está instalado (sudo apt install -y ffmpeg)")
    disco = shutil.disk_usage(Path(__file__).parent)
    libre = 100 * disco.free / disco.total
    res(OK if libre > 15 else WARN, f"Disco libre: {disco.free / 1024**3:.1f} GB ({libre:.0f}%)")
    temp = _temp_c()
    if temp is not None:
        res(OK if temp < 75 else WARN, f"Temperatura CPU: {temp} °C")
    thr = _throttled()
    if thr is not None:
        res(OK if thr == "0x0" else WARN,
            f"Energía (get_throttled): {thr}" + ("" if thr == "0x0" else
            " → hubo bajo voltaje o calor: revisar el cargador (oficial 5V/3A o más)"))

    # ── 3. Cámara ─────────────────────────────────────────────────────
    titulo("3. Cámara")
    dahua = DahuaAPI(cfg, log)
    if platform.system() == "Linux":
        ping = subprocess.run(["ping", "-c", "2", "-W", "2", cfg.camera_ip], capture_output=True, text=True)
        res(OK if ping.returncode == 0 else FAIL,
            f"Ping a {cfg.camera_ip}: {'responde' if ping.returncode == 0 else 'NO responde (¿cable, energía PoE, IP o subred?)'}")
    camara_ok = False
    try:
        r = dahua._get("/cgi-bin/magicBox.cgi", {"action": "getDeviceType"}, timeout=8)
        if r.status_code == 401:
            res(FAIL, "La cámara rechaza usuario/contraseña (401) → revisar CAMERA_USER / CAMERA_PASS")
        else:
            r.raise_for_status()
            modelo = r.text.strip().split("=", 1)[-1]
            sw = dahua._get("/cgi-bin/magicBox.cgi", {"action": "getSoftwareVersion"}, timeout=8).text.strip()
            res(OK, f"Login OK · modelo {modelo} · firmware {sw.split('=', 1)[-1][:40]}")
            camara_ok = True
    except Exception as e:
        res(FAIL, f"No se pudo conectar por HTTP: {e}")

    if camara_ok:
        try:
            t_cam = dahua.get_current_time()
            desfase = (t_cam - datetime.now()).total_seconds()
            res(OK if abs(desfase) < 60 else FAIL,
                f"Reloj cámara {t_cam:%H:%M:%S} vs Pi → diferencia {desfase:+.0f} s"
                + ("" if abs(desfase) < 60 else " → sincronizar la hora de la cámara (NTP) y la zona horaria"))
        except Exception as e:
            res(WARN, f"No se pudo leer la hora de la cámara: {e}")

        try:
            r = dahua._get("/cgi-bin/storageDevice.cgi", {"action": "getDeviceAllInfo"}, timeout=10)
            info = dict(line.split("=", 1) for line in r.text.splitlines() if "=" in line)
            total = sum(float(v) for k, v in info.items() if k.endswith(".TotalBytes"))
            usado = sum(float(v) for k, v in info.items() if k.endswith(".UsedBytes"))
            estados = {v for k, v in info.items() if k.endswith(".State")}
            if total:
                res(OK if "Error" not in estados else FAIL,
                    f"Tarjeta SD: {total / 1024**3:.0f} GB, {100 * usado / total:.0f}% usada, estado {', '.join(estados) or '?'}")
            else:
                res(FAIL, "La cámara no reporta tarjeta SD (¿no tiene, o está dañada?)")
        except Exception as e:
            res(WARN, f"No se pudo leer la tarjeta SD: {e}")

        try:
            r = dahua._get("/cgi-bin/configManager.cgi", {"action": "getConfig", "name": "RecordMode"}, timeout=8)
            modo = [l.split("=", 1)[1].strip() for l in r.text.splitlines() if ".Mode=" in l][:1]
            textos = {"0": "automático (según horario)", "1": "manual (siempre)", "2": "apagado"}
            if modo:
                res(OK if modo[0] in ("0", "1") else FAIL, f"Modo de grabación: {textos.get(modo[0], modo[0])}")
        except Exception:
            pass

        # ── 4. Grabaciones por hora ───────────────────────────────────
        titulo(f"4. Grabaciones en la SD — {fecha}")
        try:
            files = dahua.list_dav_files(date_str=fecha)
            res(OK if files else FAIL, f"Archivos .dav listados (consulta del pipeline): {len(files)}")
        except Exception as e:
            files = []
            extra = (" — suele pasar si el servicio está consultando la cámara al mismo tiempo; "
                     "vuelve a correr el diagnóstico") if "Invalid session" in str(e) else ""
            res(FAIL, f"Falló el listado de archivos: {e}{extra}")

        # Misma búsqueda sin el filtro Flag, para comparar
        try:
            r = dahua._get("/cgi-bin/mediaFileFind.cgi", {"action": "factory.create"})
            oid = r.text.strip().split("=", 1)[-1]
            ff = dahua._get("/cgi-bin/mediaFileFind.cgi", raw_query=(
                f"action=findFile&object={oid}&condition.Channel=1"
                f"&condition.StartTime={fecha} 00:00:00&condition.EndTime={fecha} 23:59:59"
                f"&condition.Types[0]=dav"))
            if not ff.text.strip().startswith("OK"):
                # La cámara rechaza ~1 de cada 10 búsquedas: no es un problema de filtros.
                raise RuntimeError("la cámara rechazó esta búsqueda de comparación (ocasional, normal)")
            sin_filtro = 0
            while True:
                t = dahua._get("/cgi-bin/mediaFileFind.cgi",
                               {"action": "findNextFile", "object": oid, "count": 100}).text
                n = next((int(l.split("=")[1]) for l in t.splitlines() if l.startswith("found=")), 0)
                sin_filtro += n
                if n < 100:
                    break
            dahua._get("/cgi-bin/mediaFileFind.cgi", {"action": "close", "object": oid})
            dahua._get("/cgi-bin/mediaFileFind.cgi", {"action": "destroy", "object": oid})
            en_curso = fecha == datetime.now().strftime("%Y-%m-%d") and sin_filtro == len(files) + 1
            if en_curso:
                print(f"     (sin filtros lista {sin_filtro}: el de más es el archivo que se está grabando ahora, normal)")
            elif sin_filtro != len(files):
                res(WARN, f"Sin filtros la cámara lista {sin_filtro} archivos (vs {len(files)}): "
                          f"el filtro de búsqueda está dejando archivos fuera")
            else:
                print(f"     (sin filtros: mismo resultado, {sin_filtro} archivos)")
        except Exception as e:
            print(f"     (no se pudo hacer la búsqueda sin filtros: {e})")

        por_hora = defaultdict(list)
        for f in files:
            dt = _parse_dt(f["start_time"])
            if dt:
                por_hora[dt.hour].append(f)
        if por_hora:
            print("\n     Hora   Archivos  Minutos  Desde→Hasta")
            ahora = datetime.now()
            for h in sorted(por_hora):
                fs = sorted(por_hora[h], key=lambda x: x["start_time"])
                mins = sum(((_parse_dt(x["end_time"]) or _parse_dt(x["start_time"])) - _parse_dt(x["start_time"])).total_seconds()
                           for x in fs) / 60
                es_partido = get_match_hour(cfg, datetime(2000, 1, 1, h)) is not None
                hora_en_curso = fecha == ahora.strftime("%Y-%m-%d") and h == ahora.hour
                marca = ""
                if es_partido and not hora_en_curso and mins < 55:
                    marca = f"  {WARN}incompleta"
                    _problemas.append(f"{WARN} Hora {h:02d}:00 con solo {mins:.0f} min grabados")
                print(f"     {h:02d}:00  {len(fs):>8}  {mins:>7.0f}  "
                      f"{fs[0]['start_time'][11:19]}→{fs[-1]['end_time'][11:19]}{marca}")
            ejemplo = files[-1]
            print(f"\n     Último archivo: {ejemplo['path']} ({ejemplo['size'] / 1024**2:.0f} MB)")

        # ── 5. Detección de personas ──────────────────────────────────
        titulo("5. Detección de personas (decide si un partido se publica)")
        for code in ["SmartMotionHuman", "VideoMotion"]:
            try:
                url = f"{dahua.base}/cgi-bin/eventManager.cgi?action=getEventIndexes&code={code}"
                req = requests.Request("GET", url, auth=dahua._auth()).prepare()
                req.url = url
                with requests.Session() as s:
                    t = s.send(req, timeout=10).text.strip().replace("\r", " ").replace("\n", " ")
                entiende = "channels[0]" in t or "No Events" in t
                res(OK if entiende else WARN, f"{code}: {t[:70]}")
            except Exception as e:
                res(WARN, f"{code}: error {e}")
        det = MotionDetector(dahua, log).detect_humans()
        print(f"     Resultado ahora: {'hay personas' if det else 'no hay personas' if det is False else 'SIN RESPUESTA'}")
        if det is None:
            res(FAIL, "La cámara no responde a la detección: todos los partidos se publicarán (no se filtra por actividad)")

        # ── Prueba de descarga + conversión ───────────────────────────
        if probar_descarga and files:
            titulo("Prueba de descarga y conversión")
            seg = files[-2] if len(files) > 1 else files[-1]   # el penúltimo seguro está cerrado
            tmp = Path(tempfile.mkdtemp(prefix="lacar_diag_"))
            try:
                t0 = time.time()
                dahua.download_file(seg["path"], tmp / "input.dav")
                mb = (tmp / "input.dav").stat().st_size / 1024**2
                seg_desc = time.time() - t0
                res(OK, f"Descarga: {mb:.0f} MB en {seg_desc:.0f} s ({8 * mb / max(seg_desc, 0.1):.0f} Mbit/s)")
                t0 = time.time()
                pl = convert_to_hls(cfg, log, tmp / "input.dav", tmp / "hls")
                dur = _leer_duraciones_hls(pl)
                res(OK, f"ffmpeg: {len(dur)} trozos .ts, {sum(dur.values()) / 60:.1f} min de video, en {time.time() - t0:.0f} s")
            except Exception as e:
                res(FAIL, f"Prueba falló: {e}")
            finally:
                shutil.rmtree(tmp, ignore_errors=True)

    # ── 6. Cloudflare R2 ──────────────────────────────────────────────
    titulo("6. Cloudflare R2 (almacenamiento de video)")
    try:
        from lacar_pipeline import get_r2_client
        s3 = get_r2_client(cfg)
        r = s3.list_objects_v2(Bucket=cfg.r2_bucket, Prefix=f"processed/{cfg.complejo}/", MaxKeys=1)
        res(OK, f"Credenciales R2 OK (bucket {cfg.r2_bucket})")
    except Exception as e:
        res(FAIL, f"R2 rechaza las credenciales o no hay internet: {e}")

    # ── 7. Supabase ───────────────────────────────────────────────────
    titulo("7. Supabase (base de datos)")
    h = {"apikey": cfg.supabase_key, "Authorization": f"Bearer {cfg.supabase_key}"}
    base = f"{cfg.supabase_url}/rest/v1"
    for tabla in ["partidos", "camaras", "camera_settings", "ocupacion_canchas", "heartbeat", "monitoreo"]:
        try:
            r = requests.get(f"{base}/{tabla}", headers=h, params={"select": "*", "limit": 1}, timeout=10)
            if r.ok:
                res(OK, f"Tabla {tabla}: accesible")
            else:
                res(FAIL if tabla != "monitoreo" else WARN,
                    f"Tabla {tabla}: {r.status_code} {r.text[:80]}"
                    + (" → ejecutar supabase/2026-09_monitoreo.sql" if tabla == "monitoreo" else ""))
        except Exception as e:
            res(FAIL, f"Tabla {tabla}: {e}")
    try:
        r = requests.get(f"{base}/camaras", headers=h, timeout=10, params={
            "complejo": f"eq.{cfg.complejo_nombre}", "numero_cancha": f"eq.{cfg.cancha}", "select": "deporte"})
        deportes = [x["deporte"] for x in r.json()]
        if cfg.deporte in deportes:
            res(OK, f"La cancha existe en 'camaras' con deporte '{cfg.deporte}'")
        else:
            res(FAIL, f"DEPORTE/COMPLEJO_NOMBRE/CANCHA no coinciden con 'camaras' "
                      f"(deportes de esa cancha: {deportes or 'ninguno'}) → corregir el .env")
    except Exception as e:
        res(WARN, f"No se pudo revisar 'camaras': {e}")
    try:
        r = requests.get(f"{base}/partidos", headers=h, timeout=10, params={
            "complejo": f"eq.{cfg.complejo_nombre}", "numero_cancha": f"eq.{cfg.cancha}",
            "deporte": f"eq.{cfg.deporte}", "select": "fecha,hora,duracion_minutos",
            "order": "fecha.desc,hora.desc", "limit": 3})
        ult = r.json()
        if ult:
            print("     Últimos partidos registrados: " + " | ".join(
                f"{p['fecha']} {p['hora']} ({p['duracion_minutos']} min)" for p in ult))
        else:
            print("     (todavía no hay partidos registrados para esta cancha/deporte)")
        r = requests.get(f"{base}/heartbeat", headers=h, timeout=10,
                         params={"cancha": f"eq.{cfg.cancha}", "select": "ultimo_heartbeat,estado,detalle"})
        hb = r.json()
        if hb:
            print(f"     Último heartbeat: {hb[0]['ultimo_heartbeat']} · {hb[0]['estado']} {hb[0].get('detalle') or ''}")
    except Exception:
        pass

    # ── 8. Servicio ───────────────────────────────────────────────────
    if platform.system() == "Linux":
        titulo("8. Servicio systemd")
        unidad = f"lacar@{cfg.instance_id}"
        activo = subprocess.run(["systemctl", "is-active", unidad], capture_output=True, text=True).stdout.strip()
        habilitado = subprocess.run(["systemctl", "is-enabled", unidad], capture_output=True, text=True).stdout.strip()
        res(OK if activo == "active" else FAIL, f"{unidad}: {activo}")
        res(OK if habilitado == "enabled" else WARN,
            f"Arranca solo al encender la Pi: {habilitado}" + ("" if habilitado == "enabled" else
            f" → sudo systemctl enable {unidad}"))
        log_file = cfg.log_path
        if log_file.exists():
            lineas = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
            errores = [l for l in lineas if "[ERROR]" in l]
            print(f"     Log {log_file}: {len(lineas)} líneas, {len(errores)} errores")
            for l in errores[-3:]:
                print(f"       {l[:150]}")

    # ── Resumen ───────────────────────────────────────────────────────
    titulo("RESUMEN")
    if not _problemas:
        print(f"  {OK} Todo en orden")
    else:
        for p in _problemas:
            print(f"  {p}")


if __name__ == "__main__":
    main()

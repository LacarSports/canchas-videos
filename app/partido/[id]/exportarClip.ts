/**
 * Client-only. Exporta un clip con marca de agua usando WebCodecs (Mediabunny):
 * decodifica y codifica con el chip de video del dispositivo, ~8x más rápido que
 * ffmpeg.wasm. Si el navegador no tiene WebCodecs, cae a processClip (ffmpeg.wasm).
 *
 * Tiempos: inicioSeg/finSeg están en el tiempo de la PLAYLIST (suma de #EXTINF), igual
 * que video.currentTime en hls.js y en el HLS nativo de Safari, y que jugadas.inicio_seg.
 * Cada bloque de 5 min de la cámara viene tras un #EXT-X-DISCONTINUITY con sus propios
 * timestamps internos, así que los trozos se agrupan por bloque y cada grupo se alinea
 * al tiempo de la playlist de su primer trozo (lo mismo que hace hls.js).
 */
import {
  Input, BufferSource, MPEG_TS, Output, Mp4OutputFormat, BufferTarget,
  VideoSampleSink, EncodedPacketSink, VideoSampleSource, EncodedAudioPacketSource,
  VideoSample, canEncodeVideo,
} from "mediabunny";
import { crearMarcaAgua, type FormatoClip } from "@/lib/marcaAgua";
import { processClip, type FaseDescarga } from "./processClip";

/** Encuadre en un instante: centro (0–1 del cuadro original) y zoom (alto original / alto visible). */
export interface Vista { cx: number; cy: number; zoom: number }
/** Encuadre registrado en el tiempo `t` de la playlist (segundos). */
export interface KeyframeVista extends Vista { t: number }

export interface ExportOptions {
  videoUrl: string;
  inicioSeg: number;
  finSeg: number;
  formato: FormatoClip;
  /** Movimientos grabados mientras se marcaba la jugada. Sin esto, encuadre fijo. */
  seguimiento?: KeyframeVista[];
  /** Encuadre fijo cuando no hay seguimiento (por defecto, centrado y sin zoom). */
  vistaFija?: Vista;
  speed?: number;
  brightness?: number;
  contrast?: number;
  onFase?: (fase: FaseDescarga) => void;
  onProgreso?: (pct: number) => void;
}

// Calidad: el techo lo pone la cámara (~4 Mbit/s a 2688×1520); se recodifica con
// bastante más bitrate que el original para no perder detalle.
const BITRATE: Record<FormatoClip, number> = { reel: 10_000_000, completo: 12_000_000 };
const REEL_W = 1080, REEL_H = 1920;

type Segmento = { uri: string; start: number; dur: number; bloque: number };

/**
 * El reproductor nativo (Safari, Chrome reciente) pide la playlist y los trozos SIN CORS y
 * el navegador guarda esa respuesta en caché sin el header Access-Control-Allow-Origin; un
 * fetch() posterior a la misma URL reutiliza esa copia y falla por CORS. Un parámetro extra
 * (que R2 ignora) da otra entrada de caché, pedida siempre con CORS.
 */
function urlCors(url: string) {
  return url + (url.includes("?") ? "&" : "?") + "cors=1";
}

async function leerPlaylist(url: string): Promise<Segmento[]> {
  const res = await fetch(urlCors(url));
  if (!res.ok) throw new Error(`Error ${res.status} al leer el video`);
  const txt = await res.text();
  const base = url.substring(0, url.lastIndexOf("/") + 1);
  const segs: Segmento[] = [];
  let dur = 0, t = 0, bloque = 0;
  for (const linea of txt.split("\n")) {
    const l = linea.trim();
    if (l.startsWith("#EXTINF:")) dur = parseFloat(l.slice(8));
    else if (l.startsWith("#EXT-X-DISCONTINUITY")) bloque++;
    else if (l && !l.startsWith("#")) {
      segs.push({ uri: l.startsWith("http") ? l : base + l, start: t, dur, bloque });
      t += dur;
    }
  }
  return segs;
}

/** Baja en paralelo los trozos .ts directo desde R2 (bucket público con CORS abierto). */
async function bajarTrozos(segs: Segmento[], onPct: (pct: number) => void): Promise<Uint8Array[]> {
  let listos = 0;
  return Promise.all(segs.map(async (s) => {
    let ultimoError: unknown;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const res = await fetch(urlCors(s.uri));
        if (!res.ok) throw new Error(`Error ${res.status} al descargar el video`);
        const data = new Uint8Array(await res.arrayBuffer());
        onPct(Math.round((++listos / segs.length) * 100));
        return data;
      } catch (e) { ultimoError = e; }
    }
    throw ultimoError;
  }));
}

function unir(partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of partes) { out.set(p, off); off += p.length; }
  return out;
}

/** Rectángulo (px del original) que se ve con una vista dada en un formato dado. */
export function rectFuente(formato: FormatoClip, srcW: number, srcH: number, v: Vista) {
  const aspecto = formato === "reel" ? 9 / 16 : srcW / srcH;
  let h = srcH / Math.max(1, v.zoom);
  let w = h * aspecto;
  if (w > srcW) { w = srcW; h = w / aspecto; }
  const x = Math.max(0, Math.min(srcW - w, v.cx * srcW - w / 2));
  const y = Math.max(0, Math.min(srcH - h, v.cy * srcH - h / 2));
  return { x, y, w, h };
}

function interpolar(kf: KeyframeVista[], t: number): Vista {
  if (t <= kf[0].t) return kf[0];
  const n = kf.length;
  if (t >= kf[n - 1].t) return kf[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (kf[m].t <= t) lo = m; else hi = m; }
  const a = kf[lo], b = kf[hi];
  const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, zoom: a.zoom + (b.zoom - a.zoom) * u };
}

/** Promedia ±0,25 s alrededor de t: suaviza el pulso del dedo como una cámara estable. */
function vistaSuave(kf: KeyframeVista[], t: number): Vista {
  let cx = 0, cy = 0, zoom = 0;
  const pasos = 7;
  for (let i = 0; i < pasos; i++) {
    const v = interpolar(kf, t + (i - (pasos - 1) / 2) * (0.5 / (pasos - 1)));
    cx += v.cx; cy += v.cy; zoom += v.zoom;
  }
  return { cx: cx / pasos, cy: cy / pasos, zoom: zoom / pasos };
}

/** ¿El seguimiento tiene movimiento real (zoom o desplazamiento)? */
export function haySeguimiento(kf: KeyframeVista[] | undefined): boolean {
  if (!kf || kf.length === 0) return false;
  const a = kf[0];
  return kf.some((k) => k.zoom > 1.03 || Math.abs(k.cx - a.cx) > 0.01 || Math.abs(k.cy - a.cy) > 0.01);
}

export function soportaExportRapido(): boolean {
  return typeof window !== "undefined" && typeof VideoEncoder !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

async function exportarWebCodecs(o: ExportOptions): Promise<Blob> {
  const { inicioSeg, finSeg, formato, seguimiento, vistaFija, onFase, onProgreso } = o;
  const speed = o.speed ?? 1;
  const conSeguimiento = haySeguimiento(seguimiento);

  onFase?.("video");
  onProgreso?.(0);
  const todos = await leerPlaylist(o.videoUrl);
  const necesarios = todos.filter((s) => s.start + s.dur > inicioSeg && s.start < finSeg);
  if (necesarios.length === 0) throw new Error("No se encontró ese tramo del video");
  const datos = await bajarTrozos(necesarios, (p) => onProgreso?.(p));

  // Un grupo por bloque de cámara (entre discontinuidades), cada uno continuo. Cada grupo
  // se recorta a su tramo en la playlist: el último trozo de cada bloque trae más video que
  // lo que dice su #EXTINF (la Raspberry lo anota mal) y el reproductor lo pisa con el bloque
  // siguiente, así que el clip debe mostrar lo mismo que vio el jugador.
  const grupos: { start: number; end: number; partes: Uint8Array[] }[] = [];
  necesarios.forEach((s, i) => {
    const prev = necesarios[i - 1];
    if (!prev || prev.bloque !== s.bloque) grupos.push({ start: s.start, end: s.start, partes: [] });
    const g = grupos[grupos.length - 1];
    g.partes.push(datos[i]);
    g.end = s.start + s.dur;
  });

  onFase?.("procesando");
  onProgreso?.(0);

  const inputs = grupos.map((g, i) => ({
    start: g.start,
    // Hasta donde empieza el bloque siguiente (o el fin del clip si es el último grupo)
    end: i < grupos.length - 1 ? g.end : Infinity,
    input: new Input({ source: new BufferSource(unir(g.partes)), formats: [MPEG_TS] }),
  }));
  try {
    const vt0 = await inputs[0].input.getPrimaryVideoTrack();
    if (!vt0) throw new Error("El video no tiene imagen");
    const srcW = vt0.displayWidth, srcH = vt0.displayHeight;
    const W = formato === "reel" ? REEL_W : srcW - (srcW % 2);
    const H = formato === "reel" ? REEL_H : srcH - (srcH % 2);

    if (!(await canEncodeVideo("avc", { width: W, height: H, bitrate: BITRATE[formato] }))) {
      throw new Error("NO_WEBCODECS");
    }

    const marca = await crearMarcaAgua(formato, W, H);
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const filtro = (o.brightness ?? 100) !== 100 || (o.contrast ?? 100) !== 100
      ? `brightness(${o.brightness ?? 100}%) contrast(${o.contrast ?? 100}%)`
      : "none";

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const videoSrc = new VideoSampleSource({ codec: "avc", bitrate: BITRATE[formato], keyFrameInterval: 1 });
    output.addVideoTrack(videoSrc, { frameRate: 30 });
    // El audio se copia tal cual (sin recodificar). Con velocidad cambiada se omite.
    const at0 = speed === 1 ? await inputs[0].input.getPrimaryAudioTrack() : null;
    const audioSrc = at0 ? new EncodedAudioPacketSource("aac") : null;
    if (audioSrc) output.addAudioTrack(audioSrc);
    await output.start();

    const total = finSeg - inicioSeg;
    const fija = vistaFija ?? { cx: 0.5, cy: 0.5, zoom: 1 };
    let audioConfigEnviado = false;

    for (const { start, end, input } of inputs) {
      const desde = Math.max(inicioSeg, start);
      const hasta = Math.min(finSeg, end);
      if (hasta <= desde) continue;
      const vt = await input.getPrimaryVideoTrack();
      if (!vt) continue;
      const base = await input.getFirstTimestamp(); // timestamp interno = `start` en la playlist
      const aInterno = (tPlaylist: number) => base + (tPlaylist - start);
      const aPlaylist = (tInterno: number) => start + (tInterno - base);

      for await (const sample of new VideoSampleSink(vt).samples(aInterno(desde), aInterno(hasta))) {
        const t = aPlaylist(sample.timestamp);
        if (t < desde - 0.001 || t >= hasta) { sample.close(); continue; }
        const vista = conSeguimiento ? vistaSuave(seguimiento!, t) : fija;
        const r = rectFuente(formato, srcW, srcH, vista);
        ctx.filter = filtro;
        sample.draw(ctx, r.x, r.y, r.w, r.h, 0, 0, W, H);
        ctx.filter = "none";
        ctx.drawImage(marca, 0, 0);
        const ts = (t - inicioSeg) / speed;
        const frame = new VideoSample(canvas, { timestamp: ts, duration: sample.duration / speed });
        sample.close();
        await videoSrc.add(frame);
        frame.close();
        onProgreso?.(Math.min(99, Math.round(((t - inicioSeg) / total) * 100)));
      }

      if (audioSrc) {
        const at = await input.getPrimaryAudioTrack();
        if (!at) continue;
        const sink = new EncodedPacketSink(at);
        const primero = await sink.getPacket(aInterno(desde));
        if (!primero) continue;
        for await (const pkt of sink.packets(primero)) {
          const t = aPlaylist(pkt.timestamp);
          if (t >= hasta) break;
          if (t < desde) continue;
          const copia = pkt.clone({ timestamp: t - inicioSeg });
          if (!audioConfigEnviado) {
            const decoderConfig = await at.getDecoderConfig();
            await audioSrc.add(copia, decoderConfig ? { decoderConfig } : undefined);
            audioConfigEnviado = true;
          } else {
            await audioSrc.add(copia);
          }
        }
      }
    }

    await output.finalize();
    onProgreso?.(100);
    return new Blob([(output.target as BufferTarget).buffer!], { type: "video/mp4" });
  } finally {
    for (const { input } of inputs) input.dispose?.();
  }
}

/** Exporta el clip y devuelve una URL blob: (el llamador debe revocarla). */
export async function exportarClip(o: ExportOptions): Promise<string> {
  if (o.finSeg - o.inicioSeg > 120) throw new Error("Los clips pueden durar máximo 2 minutos.");
  if (soportaExportRapido()) {
    try {
      return URL.createObjectURL(await exportarWebCodecs(o));
    } catch (e) {
      if (!(e instanceof Error && e.message === "NO_WEBCODECS")) throw e;
    }
  }
  // Respaldo (navegadores sin WebCodecs): ffmpeg.wasm, encuadre fijo, con marca de agua.
  return processClip({
    videoUrl: o.videoUrl, inicioSeg: o.inicioSeg, finSeg: o.finSeg,
    speed: o.speed, brightness: o.brightness, contrast: o.contrast,
    formato: o.formato, vistaFija: o.vistaFija,
    onFase: o.onFase, onProgreso: o.onProgreso,
  });
}

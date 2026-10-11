"use client";

// PÁGINA DE PRUEBA (no enlazada): mide en el celular cuánto tarda el recorte con
// WebCodecs (Mediabunny) vs ffmpeg.wasm y muestra las marcas de agua. Borrar al terminar.

import { useEffect, useRef, useState } from "react";
import {
  Input, BufferSource, MPEG_TS, Output, Mp4OutputFormat, BufferTarget, Conversion,
  VideoSampleSink, Quality, canEncodeVideo, UrlSource, HLS_FORMATS, type VideoSample,
} from "mediabunny";
import { supabase } from "@/lib/supabase";
import { crearMarcaAgua, type FormatoClip } from "@/lib/marcaAgua";

type Keyframe = { t: number; cx: number; cy: number; zoom: number };
type Partido = { id: string; complejo: string; numero_cancha: number; deporte: string; fecha: string; hora: string; archivo_url: string };
type Variante = { formato: FormatoClip; nombre: string; ancho?: number; alto?: number; bitrate: number };

// Calidad: el techo lo pone la cámara (~4 Mbit/s a 2688×1520). Se recodifica con
// bastante más bitrate que el original para no perder detalle en la recompresión.
const VARIANTES: Record<string, Variante> = {
  reel: { formato: "reel", nombre: "Reel 1080×1920", ancho: 1080, alto: 1920, bitrate: 10_000_000 },
  completoNativo: { formato: "completo", nombre: "Completo resolución original", bitrate: 12_000_000 },
  completo1080: { formato: "completo", nombre: "Completo 1920×1080", ancho: 1920, alto: 1080, bitrate: 10_000_000 },
};

function buildVideoUrl(archivoUrl: string) {
  if (archivoUrl.startsWith("http")) return archivoUrl;
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/${archivoUrl}`;
}

function interp(kf: Keyframe[], t: number): Keyframe {
  if (t <= kf[0].t) return kf[0];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i].t) {
      const a = kf[i - 1], b = kf[i];
      const u = (t - a.t) / (b.t - a.t);
      const s = u * u * (3 - 2 * u); // suavizado
      return { t, cx: a.cx + (b.cx - a.cx) * s, cy: a.cy + (b.cy - a.cy) * s, zoom: a.zoom + (b.zoom - a.zoom) * s };
    }
  }
  return kf[kf.length - 1];
}

/** Rectángulo fuente para un formato, centrado en (cx,cy) normalizados, con zoom. */
function rectFuente(formato: FormatoClip, srcW: number, srcH: number, k: Keyframe) {
  let h = srcH / k.zoom;
  let w = formato === "reel" ? h * 9 / 16 : srcW / k.zoom;
  if (w > srcW) { w = srcW; h = formato === "reel" ? w * 16 / 9 : h; }
  const x = Math.max(0, Math.min(srcW - w, k.cx * srcW - w / 2));
  const y = Math.max(0, Math.min(srcH - h, k.cy * srcH - h / 2));
  return { x, y, w, h };
}

/** Baja directo de R2 (CORS abierto) solo los trozos .ts que cubren [inicio, fin]. */
async function bajarTrozos(playlistUrl: string, inicio: number, fin: number) {
  const txt = await (await fetch(playlistUrl)).text();
  const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);
  const segs: { uri: string; start: number; dur: number }[] = [];
  let pend = 0, t = 0;
  for (const linea of txt.split("\n")) {
    const l = linea.trim();
    if (l.startsWith("#EXTINF:")) pend = parseFloat(l.slice(8));
    else if (l && !l.startsWith("#")) { segs.push({ uri: l.startsWith("http") ? l : base + l, start: t, dur: pend }); t += pend; }
  }
  const nec = segs.filter((s) => s.start + s.dur > inicio && s.start < fin);
  const bufs = await Promise.all(nec.map(async (s) => new Uint8Array(await (await fetch(s.uri)).arrayBuffer())));
  const total = bufs.reduce((n, b) => n + b.length, 0);
  const data = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) { data.set(b, off); off += b.length; }
  return { data, segStart: nec[0].start };
}

export default function PruebaClip() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [url, setUrl] = useState("");
  const [inicio, setInicio] = useState(120);
  const [dur, setDur] = useState(15);
  const [log, setLog] = useState<string[]>([]);
  const [videos, setVideos] = useState<{ titulo: string; src: string; blob: Blob }[]>([]);
  const [prog, setProg] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const datos = useRef<{ data: Uint8Array; segStart: number; clave: string; seg: number } | null>(null);
  const reelRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<HTMLCanvasElement>(null);

  const add = (s: string) => setLog((l) => [...l, s]);

  useEffect(() => {
    supabase.from("partidos")
      .select("id, complejo, numero_cancha, deporte, fecha, hora, archivo_url")
      .eq("privado", false).order("fecha", { ascending: false }).limit(20)
      .then(({ data }) => {
        const lista = (data ?? []) as Partido[];
        setPartidos(lista);
        if (lista[0]) setUrl(buildVideoUrl(lista[0].archivo_url));
      });
    (async () => {
      const wc = typeof VideoEncoder !== "undefined";
      const r = wc ? await canEncodeVideo("avc", { width: 1080, height: 1920 }) : false;
      const n = wc ? await canEncodeVideo("avc", { width: 2688, height: 1520 }) : false;
      add(`WebCodecs: ${wc ? "sí" : "NO"} · H.264 1080×1920: ${r ? "sí" : "no"} · 2688×1520: ${n ? "sí" : "no"}`);
    })();
  }, []);

  async function cargar() {
    const clave = `${url}|${inicio}|${dur}`;
    if (datos.current?.clave === clave) return datos.current.seg;
    const t0 = performance.now();
    const { data, segStart } = await bajarTrozos(url, inicio, inicio + dur);
    const seg = (performance.now() - t0) / 1000;
    datos.current = { data, segStart, clave, seg };
    add(`Bajada ${dur}s de partido: ${(data.length / 1e6).toFixed(1)} MB en ${seg.toFixed(1)} s`);
    return seg;
  }

  function abrir() {
    return new Input({ source: new BufferSource(datos.current!.data), formats: [MPEG_TS] });
  }

  async function correr(fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true); setProg(0);
    try { await fn(); } catch (e) { add("ERROR: " + (e instanceof Error ? e.message : String(e))); }
    setOcupado(false);
  }

  async function vistaPrevia() {
    await cargar();
    const input = abrir();
    const vt = (await input.getPrimaryVideoTrack())!;
    const first = await vt.getFirstTimestamp();
    const sink = new VideoSampleSink(vt);
    const sample = await sink.getSample(first + (inicio - datos.current!.segStart) + 1);
    if (!sample) { add("sin cuadro"); return; }
    for (const formato of ["reel", "completo"] as FormatoClip[]) {
      const [W, H] = formato === "reel" ? [1080, 1920] : [1920, 1080];
      const cv = (formato === "reel" ? reelRef : compRef).current!;
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d")!;
      const r = rectFuente(formato, vt.displayWidth, vt.displayHeight, { t: 0, cx: 0.5, cy: 0.5, zoom: 1 });
      sample.draw(ctx, r.x, r.y, r.w, r.h, 0, 0, W, H);
      ctx.drawImage(await crearMarcaAgua(formato, W, H), 0, 0);
    }
    sample.close();
  }

  async function webcodecs(v: Variante, seguimiento: boolean) {
    const tBajada = await cargar();
    const t0 = performance.now();
    const input = abrir();
    const vt = (await input.getPrimaryVideoTrack())!;
    const first = await vt.getFirstTimestamp();
    const off = inicio - datos.current!.segStart;
    const srcW = vt.displayWidth, srcH = vt.displayHeight;
    const W = v.ancho ?? srcW, H = v.alto ?? srcH;
    const marca = await crearMarcaAgua(v.formato, W, H);
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    // Seguimiento simulado: barre de izquierda a derecha con zoom que sube y baja.
    const kf: Keyframe[] = seguimiento
      ? [
          { t: 0, cx: 0.2, cy: 0.5, zoom: 1 },
          { t: dur * 0.3, cx: 0.45, cy: 0.45, zoom: 1.8 },
          { t: dur * 0.6, cx: 0.75, cy: 0.55, zoom: 2.2 },
          { t: dur, cx: 0.5, cy: 0.5, zoom: 1 },
        ]
      : [{ t: 0, cx: 0.5, cy: 0.5, zoom: 1 }];

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conv = await Conversion.init({
      input, output,
      trim: { start: first + off, end: first + off + dur },
      video: {
        codec: "avc",
        quality: new Quality({ bitrate: v.bitrate }),
        processedWidth: W,
        processedHeight: H,
        process: (s: VideoSample) => {
          const r = rectFuente(v.formato, srcW, srcH, interp(kf, s.timestamp));
          s.draw(ctx, r.x, r.y, r.w, r.h, 0, 0, W, H);
          ctx.drawImage(marca, 0, 0);
          return canvas;
        },
      },
    });
    if (!conv.isValid) { add("Conversión inválida: " + JSON.stringify(conv.discardedTracks.map((d) => d.reason))); return; }
    conv.onProgress = (p) => setProg(Math.round(p * 100));
    await conv.execute();
    const buf = (output.target as BufferTarget).buffer!;
    const seg = (performance.now() - t0) / 1000;
    const titulo = `${v.nombre}${seguimiento ? " + seguimiento" : ""}`;
    add(`✔ ${titulo}: recorte ${seg.toFixed(1)} s · total con bajada ${(seg + tBajada).toFixed(1)} s · ${W}×${H} · ${(buf.byteLength / 1e6).toFixed(1)} MB`);
    const blob = new Blob([buf], { type: "video/mp4" });
    setVideos((vs) => [{ titulo: `${titulo} (${seg.toFixed(1)} s)`, src: URL.createObjectURL(blob), blob }, ...vs]);
  }

  // Lee la playlist HLS directo (sin bajar trozos a mano) y recorta [inicio, inicio+dur]
  // usando los tiempos de la playlist. Sirve para probar cortes que cruzan un bloque de 5 min.
  async function hlsDirecto() {
    const t0 = performance.now();
    const input = new Input({ source: new UrlSource(url), formats: HLS_FORMATS });
    const vt = (await input.getPrimaryVideoTrack())!;
    const first = await vt.getFirstTimestamp();
    add(`HLS: primer timestamp ${first.toFixed(3)} · ${vt.displayWidth}x${vt.displayHeight} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    const W = 1080, H = 1920;
    const marca = await crearMarcaAgua("reel", W, H);
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    const srcW = vt.displayWidth, srcH = vt.displayHeight;
    let primero: number | null = null, ultimo = 0, n = 0;
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conv = await Conversion.init({
      input, output, tracks: "primary",
      trim: { start: first + inicio, end: first + inicio + dur },
      video: {
        codec: "avc", quality: new Quality({ bitrate: 10_000_000 }), processedWidth: W, processedHeight: H,
        process: (s: VideoSample) => {
          if (primero === null) primero = s.timestamp; ultimo = s.timestamp; n++;
          const r = rectFuente("reel", srcW, srcH, { t: 0, cx: 0.5, cy: 0.5, zoom: 1 });
          s.draw(ctx, r.x, r.y, r.w, r.h, 0, 0, W, H);
          ctx.drawImage(marca, 0, 0);
          return canvas;
        },
      },
    });
    conv.onProgress = (p) => setProg(Math.round(p * 100));
    await conv.execute();
    const buf = (output.target as BufferTarget).buffer!;
    const seg = (performance.now() - t0) / 1000;
    add(`✔ HLS directo ${dur}s desde ${inicio}s: ${seg.toFixed(1)} s total · ${n} cuadros (${primero}→${ultimo.toFixed(2)}) · ${(buf.byteLength / 1e6).toFixed(1)} MB`);
    const blob = new Blob([buf], { type: "video/mp4" });
    setVideos((vs) => [{ titulo: `HLS directo desde ${inicio}s (${seg.toFixed(1)} s)`, src: URL.createObjectURL(blob), blob }, ...vs]);
  }

  // Diagnóstico: tiempos internos de cada trozo .ts frente a su tiempo en la playlist.
  async function diagnostico() {
    const txt = await (await fetch(url + "?cors=1")).text();
    const base = url.substring(0, url.lastIndexOf("/") + 1);
    let t = 0, d = 0, bloque = 0;
    const segs: { uri: string; start: number; dur: number; bloque: number }[] = [];
    for (const l0 of txt.split("\n")) { const l = l0.trim();
      if (l.startsWith("#EXTINF:")) d = parseFloat(l.slice(8));
      else if (l.startsWith("#EXT-X-DISCONTINUITY")) bloque++;
      else if (l && !l.startsWith("#")) { segs.push({ uri: base + l, start: t, dur: d, bloque }); t += d; } }
    const sel = segs.filter((s) => s.start + s.dur > inicio && s.start < inicio + dur);
    for (const s of sel) {
      const data = new Uint8Array(await (await fetch(s.uri + "?cors=1")).arrayBuffer());
      const input = new Input({ source: new BufferSource(data), formats: [MPEG_TS] });
      const vt = (await input.getPrimaryVideoTrack())!;
      const at = await input.getPrimaryAudioTrack();
      const v0 = await vt.getFirstTimestamp(); const vd = await vt.computeDuration();
      const a0 = at ? await at.getFirstTimestamp() : NaN;
      add(`${s.uri.split("/").pop()} bloque ${s.bloque} playlist ${s.start.toFixed(2)}+${s.dur} · video ${v0.toFixed(2)}→${vd.toFixed(2)} · audio ${a0.toFixed(2)}`);
    }
  }

  async function ffmpegWasm() {
    const tBajada = await cargar();
    const t0 = performance.now();
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ff.on("progress", ({ progress }) => setProg(Math.round(progress * 100)));
    const marca = await crearMarcaAgua("reel", 1080, 1920);
    const png = await new Promise<Blob>((r) => marca.toBlob((b) => r(b!), "image/png"));
    await ff.writeFile("in.ts", datos.current!.data);
    await ff.writeFile("marca.png", new Uint8Array(await png.arrayBuffer()));
    const off = inicio - datos.current!.segStart;
    await ff.exec(["-ss", String(off), "-i", "in.ts", "-i", "marca.png", "-t", String(dur),
      "-filter_complex", "[0:v]crop=ih*9/16:ih,scale=1080:1920[v];[v][1:v]overlay=0:0",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-c:a", "aac", "out.mp4"]);
    const out = (await ff.readFile("out.mp4")) as Uint8Array;
    const seg = (performance.now() - t0) / 1000;
    add(`✔ ffmpeg.wasm reel: recorte ${seg.toFixed(1)} s · total con bajada ${(seg + tBajada).toFixed(1)} s · ${(out.length / 1e6).toFixed(1)} MB`);
    const blob = new Blob([out.buffer as ArrayBuffer], { type: "video/mp4" });
    setVideos((vs) => [{ titulo: `ffmpeg.wasm reel (${seg.toFixed(1)} s)`, src: URL.createObjectURL(blob), blob }, ...vs]);
    ff.terminate();
  }

  async function compartir(v: { titulo: string; blob: Blob }) {
    const file = new File([v.blob], "jugada-lacar-sports.mp4", { type: "video/mp4" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* cancelado */ }
    } else {
      add("Este navegador no permite compartir archivos");
    }
  }

  const btn = "px-3 py-2.5 rounded-lg bg-crystal-400/15 border border-crystal-400/40 text-crystal-300 text-sm disabled:opacity-40";
  return (
    <div className="px-4 pt-28 pb-10 space-y-4 text-snow max-w-3xl mx-auto">
      <h1 className="text-lg font-bold">Prueba de recorte y marcas de agua</h1>
      <div className="space-y-2 text-sm">
        <select className="w-full bg-black/40 px-2 py-2 rounded" value={url} onChange={(e) => setUrl(e.target.value)}>
          {partidos.map((p) => (
            <option key={p.id} value={buildVideoUrl(p.archivo_url)}>
              {p.complejo} · {p.deporte} cancha {p.numero_cancha} · {p.fecha} {p.hora}
            </option>
          ))}
        </select>
        <div className="flex gap-3 items-center">
          <label>Inicio (s) <input type="number" className="w-20 bg-black/40 px-2 py-1 rounded" value={inicio} onChange={(e) => setInicio(+e.target.value)} /></label>
          <label>Duración (s) <input type="number" className="w-20 bg-black/40 px-2 py-1 rounded" value={dur} onChange={(e) => setDur(+e.target.value)} /></label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={ocupado} className={btn} onClick={() => correr(vistaPrevia)}>Vista previa marcas</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(() => webcodecs(VARIANTES.reel, false))}>Reel</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(() => webcodecs(VARIANTES.reel, true))}>Reel + seguimiento</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(() => webcodecs(VARIANTES.completoNativo, false))}>Completo (original)</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(() => webcodecs(VARIANTES.completo1080, false))}>Completo 1080p</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(ffmpegWasm)}>Método actual (lento)</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(hlsDirecto)}>HLS directo</button>
        <button disabled={ocupado} className={btn} onClick={() => correr(diagnostico)}>Diagnóstico</button>
      </div>
      <div className="text-sm">{ocupado ? `Procesando… ${prog}%` : "Listo"}</div>
      <pre id="log" className="text-xs bg-black/40 p-2 rounded whitespace-pre-wrap">{log.join("\n")}</pre>
      <div className="grid grid-cols-[9fr_16fr] gap-2 items-start">
        <canvas ref={reelRef} className="w-full bg-black" />
        <canvas ref={compRef} className="w-full bg-black" />
      </div>
      <div className="space-y-4">
        {videos.map((v) => (
          <div key={v.src} className="text-xs space-y-1">
            <div>{v.titulo}</div>
            <video src={v.src} controls playsInline className="w-full max-h-[70vh] bg-black" />
            <div className="flex gap-2">
              <button className={btn} onClick={() => compartir(v)}>Compartir / Guardar</button>
              <a className={btn} href={v.src} download="jugada-lacar-sports.mp4">Descargar</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

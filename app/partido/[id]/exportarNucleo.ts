/**
 * Núcleo de la exportación de clips con WebCodecs (Mediabunny), sin depender de la
 * página: corre en un Web Worker (exportarClip.worker.ts) para no trabar el reproductor
 * mientras se prepara el clip, o en la página si el worker no está disponible.
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
import type { FormatoClip } from "@/lib/marcaAgua";
import { ventana, vistaEn, haySeguimiento, type Vista, type KeyframeVista } from "@/lib/encuadre";
import type { FaseDescarga } from "./processClip";

/** Opciones serializables (se envían al worker). */
export interface OpcionesNucleo {
  videoUrl: string;
  inicioSeg: number;
  finSeg: number;
  formato: FormatoClip;
  /** Movimientos grabados mientras se marcaba la jugada (t desde el inicio del clip). Sin esto, encuadre fijo. */
  seguimiento?: KeyframeVista[] | null;
  /** Encuadre fijo cuando no hay seguimiento (por defecto, centrado y sin zoom). */
  vistaFija?: Vista;
  speed?: number;
  brightness?: number;
  contrast?: number;
}

export interface CallbacksNucleo {
  /** Imagen de la marca de agua del tamaño de salida (se dibuja en la página: usa el DOM). */
  obtenerMarca: (W: number, H: number) => Promise<CanvasImageSource>;
  onFase?: (fase: FaseDescarga) => void;
  onProgreso?: (pct: number) => void;
  /** Milisegundos de pausa entre cuadros (0 = a toda velocidad). */
  pausa?: () => number;
}

export function soportaWebCodecs(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof OffscreenCanvas !== "undefined";
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
  const txt = await bajarConReintentos(urlCors(url), (r) => r.text());
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

/**
 * Baja una URL completa (incluido el cuerpo) con reintentos y espera creciente: en datos
 * móviles la conexión se corta a ratos, a veces a mitad de la respuesta.
 */
async function bajarConReintentos<T>(url: string, leer: (r: Response) => Promise<T>, intentos = 4): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await leer(res);
      ultimoError = new Error(`HTTP ${res.status}`);
      if (res.status === 404) break;
    } catch (e) { ultimoError = e; }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  console.error("Descarga fallida", url, ultimoError);
  throw new Error("Se cortó la conexión al bajar el video. Revisa tu señal e inténtalo de nuevo.");
}

/**
 * Baja los trozos .ts directo desde R2 (bucket público con CORS abierto), de a 3 a la
 * vez: pedirlos todos juntos satura la red del celular mientras el partido sigue cargando.
 */
async function bajarTrozos(segs: Segmento[], onPct: (pct: number) => void): Promise<Uint8Array[]> {
  const out: Uint8Array[] = new Array(segs.length);
  let siguiente = 0, listos = 0;
  const trabajador = async () => {
    while (siguiente < segs.length) {
      const i = siguiente++;
      out[i] = await bajarConReintentos(urlCors(segs[i].uri), async (r) => new Uint8Array(await r.arrayBuffer()));
      onPct(Math.round((++listos / segs.length) * 100));
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, segs.length) }, trabajador));
  return out;
}

function unir(partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of partes) { out.set(p, off); off += p.length; }
  return out;
}

export async function exportarNucleo(o: OpcionesNucleo, cb: CallbacksNucleo): Promise<Blob> {
  const { inicioSeg, finSeg, formato, seguimiento, vistaFija } = o;
  const onFase = cb.onFase;
  // Progreso solo cuando cambia el porcentaje (cada aviso cuesta un render en la página)
  let ultimoPct = -1;
  const onProgreso = (p: number) => { if (p !== ultimoPct) { ultimoPct = p; cb.onProgreso?.(p); } };
  const speed = o.speed ?? 1;
  const conSeguimiento = haySeguimiento(seguimiento);

  onFase?.("video");
  onProgreso(0);
  const todos = await leerPlaylist(o.videoUrl);
  const necesarios = todos.filter((s) => s.start + s.dur > inicioSeg && s.start < finSeg);
  if (necesarios.length === 0) throw new Error("No se encontró ese tramo del video");
  const datos = await bajarTrozos(necesarios, (p) => onProgreso(p));

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
  onProgreso(0);

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

    const marca = await cb.obtenerMarca(W, H);
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
        const vista = conSeguimiento ? vistaEn(seguimiento!, t - inicioSeg) : fija;
        const win = ventana(W / H, srcW, srcH, vista);
        const esc = W / win.w;
        // Se dibuja el cuadro COMPLETO desplazado y escalado (el canvas recorta lo que
        // sobra). No se usa drawImage con sub-rectángulo de origen: Safari lo ignora con
        // VideoFrame y dibuja el cuadro entero aplastado.
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.filter = filtro;
        ctx.drawImage(sample.toCanvasImageSource(), -win.x * esc, -win.y * esc, srcW * esc, srcH * esc);
        ctx.filter = "none";
        ctx.drawImage(marca, 0, 0);
        const ts = (t - inicioSeg) / speed;
        const frame = new VideoSample(canvas, { timestamp: ts, duration: sample.duration / speed });
        sample.close();
        await videoSrc.add(frame);
        frame.close();
        onProgreso(Math.min(99, Math.round(((t - inicioSeg) / total) * 100)));
        // Si el partido se está reproduciendo, ceder un poco de tiempo para que siga fluido
        const pausa = cb.pausa?.() ?? 0;
        if (pausa > 0) await new Promise((r) => setTimeout(r, pausa));
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
    onProgreso(100);
    return new Blob([(output.target as BufferTarget).buffer!], { type: "video/mp4" });
  } finally {
    for (const { input } of inputs) input.dispose?.();
  }
}


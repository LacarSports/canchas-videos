/**
 * Client-only module. Do not import from server components.
 * Shared FFmpeg WASM singleton so the binary loads only once
 * regardless of how many components call processClip().
 */
import type { FFmpeg } from "@ffmpeg/ffmpeg";

let _ff: FFmpeg | null = null;
let _loadPromise: Promise<FFmpeg> | null = null;

// Single progress listener that delegates to the current operation's callback.
let _onProgress: ((pct: number) => void) | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (_ff) return _ff;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ff.on("progress", ({ progress }: { progress: number }) => {
      _onProgress?.(Math.min(99, Math.round(progress * 100)));
    });
    _ff = ff;
    _loadPromise = null;
    return ff;
  })();

  return _loadPromise;
}

async function fetchWithProgress(
  url: string,
  onPct: (pct: number) => void
): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al descargar el video${body ? ": " + body.slice(0, 120) : ""}`);
  }
  const total = parseInt(res.headers.get("content-length") ?? "0");
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onPct(Math.round((received / total) * 100));
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** Downloads only the HLS segments covering [inicioSeg, finSeg] via the server proxy. */
async function fetchHlsSegments(
  videoUrl: string,
  inicioSeg: number,
  finSeg: number,
  onPct: (pct: number) => void
): Promise<{ data: Uint8Array; segmentStart: number }> {
  const proxyUrl = `/api/proxy-hls?url=${encodeURIComponent(videoUrl)}&start=${inicioSeg}&end=${finSeg}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Error ${res.status} al descargar segmentos HLS`);
  }
  const segmentStart = parseFloat(res.headers.get("X-Segment-Start") ?? "0");
  const total = parseInt(res.headers.get("content-length") ?? "0");
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onPct(Math.round((received / total) * 100));
  }
  const data = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { data.set(c, off); off += c.length; }
  return { data, segmentStart };
}

export type FaseDescarga = "ffmpeg" | "video" | "procesando";

/**
 * Crop parameters derived from the user's zoom+pan state.
 * All pixel values are in CSS display pixels (not native video pixels).
 */
export interface CropParams {
  zoom: number;
  panX: number;       // CSS px offset — positive = video shifted right (user sees left)
  panY: number;       // CSS px offset — positive = video shifted down (user sees top)
  containerW: number; // rendered width of the video element in CSS px
  containerH: number; // rendered height of the video element in CSS px
  videoW: number;     // native video width in px
  videoH: number;     // native video height in px
}

export interface ProcessOptions {
  videoUrl: string;
  inicioSeg: number;
  finSeg: number;
  crop?: CropParams;
  /** Playback speed multiplier. 1 = normal, 0.5 = half, 2 = double. Default 1. */
  speed?: number;
  /** CSS brightness % value. 100 = normal, 150 = brighter. Default 100. */
  brightness?: number;
  /** CSS contrast % value. 100 = normal, 150 = more contrast. Default 100. */
  contrast?: number;
  onFase?: (fase: FaseDescarga) => void;
  onProgreso?: (pct: number) => void;
}

/**
 * Cuts (and optionally crops/zooms) a clip from a video using FFmpeg WASM.
 * Supports both MP4 and HLS (.m3u8) sources.
 * Returns a blob: object URL. Caller must eventually call URL.revokeObjectURL().
 */
export async function processClip({
  videoUrl,
  inicioSeg,
  finSeg,
  crop,
  speed = 1,
  brightness = 100,
  contrast = 100,
  onFase,
  onProgreso,
}: ProcessOptions): Promise<string> {
  onFase?.("ffmpeg");
  const ff = await getFFmpeg();

  onFase?.("video");
  onProgreso?.(0);

  const isHls = videoUrl.includes(".m3u8");
  let inputFile: string;
  let adjustedInicio: number;

  if (isHls) {
    const { data, segmentStart } = await fetchHlsSegments(
      videoUrl,
      inicioSeg,
      finSeg,
      (p) => onProgreso?.(p)
    );
    await ff.writeFile("input.ts", data);
    inputFile = "input.ts";
    // The concatenated segments start at segmentStart, so we seek from there
    adjustedInicio = Math.max(0, inicioSeg - segmentStart);
  } else {
    const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
    const data = await fetchWithProgress(proxyUrl, (p) => onProgreso?.(p));
    await ff.writeFile("input.mp4", data);
    inputFile = "input.mp4";
    adjustedInicio = inicioSeg;
  }

  onFase?.("procesando");
  onProgreso?.(0);
  _onProgress = (pct) => onProgreso?.(pct);

  const duration = finSeg - inicioSeg;

  const hasCrop = !!(crop && crop.zoom > 1.01);
  const hasBriCon = brightness !== 100 || contrast !== 100;
  const hasSpeed = speed !== 1;
  const needsReencode = hasCrop || hasBriCon || hasSpeed;

  if (!needsReencode) {
    const args = [
      "-ss", adjustedInicio.toString(),
      "-i", inputFile,
      "-t", duration.toString(),
      "-c", "copy",
    ];
    // ADTS→raw AAC conversion required when stream-copying from MPEG-TS to MP4
    if (isHls) args.push("-bsf:a", "aac_adtstoasc");
    args.push("-movflags", "+faststart", "output.mp4");
    await ff.exec(args);
  } else {
    // Build video filter chain
    const vfParts: string[] = [];

    if (hasCrop) {
      const scaleX = crop!.videoW / crop!.containerW;
      const scaleY = crop!.videoH / crop!.containerH;
      const cropW = Math.round(crop!.videoW / crop!.zoom);
      const cropH = Math.round(crop!.videoH / crop!.zoom);
      const centerX = crop!.videoW / 2 - crop!.panX * scaleX;
      const centerY = crop!.videoH / 2 - crop!.panY * scaleY;
      const cropX = Math.max(0, Math.min(crop!.videoW - cropW, Math.round(centerX - cropW / 2)));
      const cropY = Math.max(0, Math.min(crop!.videoH - cropH, Math.round(centerY - cropH / 2)));
      vfParts.push(`crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${crop!.videoW}:${crop!.videoH}`);
    }

    if (hasBriCon) {
      // FFmpeg eq: brightness -1→1 (0=normal), contrast 0→2 (1=normal)
      const b = ((brightness - 100) / 100).toFixed(3);
      const c = (contrast / 100).toFixed(3);
      vfParts.push(`eq=brightness=${b}:contrast=${c}`);
    }

    if (hasSpeed) {
      vfParts.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
    }

    // Build audio tempo filter chain (atempo range: 0.5–2.0, chain for extremes)
    let afStr: string | null = null;
    if (hasSpeed) {
      const tempoFilters: string[] = [];
      let rem = speed;
      if (rem < 0.5) {
        while (rem < 0.5) { tempoFilters.push("atempo=0.5"); rem *= 2; }
        if (Math.abs(rem - 1.0) > 0.001) tempoFilters.push(`atempo=${rem.toFixed(4)}`);
      } else if (rem > 2.0) {
        while (rem > 2.0) { tempoFilters.push("atempo=2.0"); rem /= 2; }
        if (Math.abs(rem - 1.0) > 0.001) tempoFilters.push(`atempo=${rem.toFixed(4)}`);
      } else {
        tempoFilters.push(`atempo=${rem.toFixed(4)}`);
      }
      afStr = tempoFilters.join(",");
    }

    const args: string[] = [
      "-ss", adjustedInicio.toString(),
      "-i", inputFile,
      "-t", duration.toString(),
    ];

    if (vfParts.length > 0) args.push("-vf", vfParts.join(","));
    args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "26");

    if (afStr) {
      args.push("-af", afStr, "-c:a", "aac");
    } else {
      // Re-encode audio to raw AAC for MP4 container (handles both MP4 and TS input)
      args.push("-c:a", "aac");
    }

    args.push("-movflags", "+faststart", "output.mp4");

    await ff.exec(args);
  }

  _onProgress = null;

  const result = (await ff.readFile("output.mp4")) as Uint8Array;
  const blob = new Blob([result.buffer as ArrayBuffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  await ff.deleteFile(inputFile);
  await ff.deleteFile("output.mp4");

  return url;
}

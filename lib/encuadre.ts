/**
 * Encuadre de un video: qué parte del cuadro original se ve. Lo comparten el
 * reproductor del partido (zoom/arrastre y seguimiento), los reproductores de
 * jugadas (reel con seguimiento en vivo) y la exportación del clip, para que lo
 * que se ve sea exactamente lo que se descarga.
 */

/** Centro (0–1 del cuadro original) y zoom = alto original / alto visible. */
export interface Vista { cx: number; cy: number; zoom: number }
/** Encuadre en el segundo `t` del clip (contado desde su inicio). */
export interface KeyframeVista extends Vista { t: number }

export const ZOOM_MAX = 4;

/**
 * Zoom mínimo para una ventana de proporción R (ancho/alto): el que deja ver todo
 * el ancho del original. En 16:9 es 1; en el reel (9:16) es ~0,32 y el sobrante
 * queda en negro arriba y abajo.
 */
export function zoomMinimo(R: number, sw: number, sh: number) {
  return Math.min(1, (sh * R) / sw);
}

/** Ventana (px del original) que se ve con una vista dada en un cuadro de proporción R. */
export function ventana(R: number, sw: number, sh: number, v: Vista) {
  const zoom = Math.max(zoomMinimo(R, sw, sh), Math.min(ZOOM_MAX, v.zoom || 1));
  const h = sh / zoom;
  const w = h * R;
  // Si la ventana es más grande que el original (zoom alejado), se centra con barras negras.
  const x = w >= sw ? (sw - w) / 2 : Math.max(0, Math.min(sw - w, v.cx * sw - w / 2));
  const y = h >= sh ? (sh - h) / 2 : Math.max(0, Math.min(sh - h, v.cy * sh - h / 2));
  return { x, y, w, h, zoom };
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

/** Encuadre en el segundo t, promediando ±0,25 s: suaviza el pulso del dedo como una cámara estable. */
export function vistaEn(kf: KeyframeVista[], t: number): Vista {
  if (kf.length === 1) return kf[0];
  let cx = 0, cy = 0, zoom = 0;
  const pasos = 7;
  for (let i = 0; i < pasos; i++) {
    const v = interpolar(kf, t + (i - (pasos - 1) / 2) * (0.5 / (pasos - 1)));
    cx += v.cx; cy += v.cy; zoom += v.zoom;
  }
  return { cx: cx / pasos, cy: cy / pasos, zoom: zoom / pasos };
}

/** ¿El seguimiento tiene movimiento o zoom real? */
export function haySeguimiento(kf: KeyframeVista[] | null | undefined): boolean {
  if (!kf || kf.length === 0) return false;
  const a = kf[0];
  return kf.some((k) => Math.abs(k.zoom - 1) > 0.03 || Math.abs(k.cx - a.cx) > 0.01 || Math.abs(k.cy - a.cy) > 0.01);
}

/**
 * Reduce el seguimiento para guardarlo en la base: como mucho un punto cada 0,1 s,
 * con los valores redondeados (un clip de 2 min queda en unos 30 KB como máximo).
 */
export function compactarSeguimiento(kf: KeyframeVista[]): KeyframeVista[] {
  const out: KeyframeVista[] = [];
  for (const k of kf) {
    const p = {
      t: Math.round(k.t * 100) / 100,
      cx: Math.round(k.cx * 10000) / 10000,
      cy: Math.round(k.cy * 10000) / 10000,
      zoom: Math.round(k.zoom * 1000) / 1000,
    };
    const u = out[out.length - 1];
    if (u && p.t - u.t < 0.1) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/**
 * Posiciona un <video> dentro de su cuadro (frame) para mostrar la vista dada.
 * El video debe ser `position:absolute; top:0; left:0; transform-origin:0 0`.
 * Devuelve la ventana usada y la escala (px de pantalla por px del original).
 */
export function aplicarVista(video: HTMLVideoElement, frame: HTMLElement, v: Vista) {
  const Fw = frame.clientWidth, Fh = frame.clientHeight;
  const sw = video.videoWidth || 16, sh = video.videoHeight || 9;
  if (!Fw || !Fh) return null;
  const win = ventana(Fw / Fh, sw, sh, v);
  const s = Fw / win.w;
  video.style.width = `${sw * s}px`;
  video.style.height = `${sh * s}px`;
  video.style.transform = `translate(${-win.x * s}px, ${-win.y * s}px)`;
  return { ...win, s, sw, sh };
}

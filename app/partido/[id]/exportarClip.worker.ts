/// <reference lib="webworker" />
/**
 * Web Worker que prepara los clips fuera del hilo de la página: así el reproductor del
 * partido sigue fluido (y responde a los toques) mientras el clip se procesa.
 *
 * Mensajes de la página: {tipo:"exportar", opciones} · {tipo:"ritmo", pausaMs} ·
 * {tipo:"marca", imagen} (respuesta a un pedido de marca de agua).
 * Mensajes hacia la página: {tipo:"fase"|"progreso"|"marca"|"listo"|"error", ...}.
 */
import { exportarNucleo, soportaWebCodecs, type OpcionesNucleo } from "./exportarNucleo";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let pausaMs = 0;
let esperandoMarca: ((img: ImageBitmap) => void) | null = null;

ctx.onmessage = async (e: MessageEvent) => {
  const m = e.data as
    | { tipo: "exportar"; opciones: OpcionesNucleo; pausaMs: number }
    | { tipo: "ritmo"; pausaMs: number }
    | { tipo: "marca"; imagen: ImageBitmap };

  if (m.tipo === "ritmo") { pausaMs = m.pausaMs; return; }
  if (m.tipo === "marca") { esperandoMarca?.(m.imagen); esperandoMarca = null; return; }

  pausaMs = m.pausaMs;
  if (!soportaWebCodecs()) { ctx.postMessage({ tipo: "error", mensaje: "NO_WEBCODECS" }); return; }
  try {
    const blob = await exportarNucleo(m.opciones, {
      obtenerMarca: (W, H) => new Promise<ImageBitmap>((resolver) => {
        esperandoMarca = resolver;
        ctx.postMessage({ tipo: "marca", W, H });
      }),
      onFase: (fase) => ctx.postMessage({ tipo: "fase", fase }),
      onProgreso: (pct) => ctx.postMessage({ tipo: "progreso", pct }),
      pausa: () => pausaMs,
    });
    ctx.postMessage({ tipo: "listo", blob });
  } catch (err) {
    ctx.postMessage({ tipo: "error", mensaje: err instanceof Error ? err.message : String(err) });
  }
};

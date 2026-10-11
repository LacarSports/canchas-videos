/**
 * Client-only. Exporta un clip con marca de agua usando WebCodecs (Mediabunny):
 * decodifica y codifica con el chip de video del dispositivo, ~8x más rápido que
 * ffmpeg.wasm. El trabajo pesado corre en un Web Worker para no trabar el reproductor;
 * si no hay worker, corre en la página; si no hay WebCodecs, cae a processClip (ffmpeg.wasm).
 */
import { crearMarcaAgua } from "@/lib/marcaAgua";
import { haySeguimiento, type Vista, type KeyframeVista } from "@/lib/encuadre";
import { processClip, type FaseDescarga } from "./processClip";
import { exportarNucleo, soportaWebCodecs, type OpcionesNucleo } from "./exportarNucleo";

export type { Vista, KeyframeVista, FaseDescarga };
export { haySeguimiento };

export interface ExportOptions extends OpcionesNucleo {
  onFase?: (fase: FaseDescarga) => void;
  onProgreso?: (pct: number) => void;
}

/* ── Prioridad del reproductor ──
   Mientras el partido se está reproduciendo, el clip se prepara con pequeñas pausas
   entre cuadros: tarda algo más, pero el video y los toques siguen fluidos. */
const PAUSA_REPRODUCIENDO_MS = 10;
let pausaActual = 0;
const workersActivos = new Set<Worker>();

export function avisarReproduccion(reproduciendo: boolean) {
  pausaActual = reproduciendo ? PAUSA_REPRODUCIENDO_MS : 0;
  workersActivos.forEach((w) => w.postMessage({ tipo: "ritmo", pausaMs: pausaActual }));
}

export function soportaExportRapido(): boolean {
  return typeof window !== "undefined" && soportaWebCodecs();
}

/** Marca de agua dibujada en la página (usa el DOM para el logo SVG). */
async function marcaComoBitmap(formato: OpcionesNucleo["formato"], W: number, H: number) {
  return createImageBitmap(await crearMarcaAgua(formato, W, H));
}

function separar(o: ExportOptions): OpcionesNucleo {
  const { onFase: _f, onProgreso: _p, ...opciones } = o;
  void _f; void _p;
  return opciones;
}

/** Exporta en un Web Worker. Rechaza con "SIN_WORKER" si no se pudo usar uno. */
function exportarEnWorker(o: ExportOptions): Promise<Blob> {
  return new Promise((resolver, rechazar) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./exportarClip.worker.ts", import.meta.url), { type: "module" });
    } catch {
      rechazar(new Error("SIN_WORKER"));
      return;
    }
    let empezo = false;
    const terminar = () => { workersActivos.delete(w); w.terminate(); };
    workersActivos.add(w);
    w.onerror = (ev) => {
      ev.preventDefault?.();
      terminar();
      // Si el worker ni siquiera cargó, se reintenta en la página
      rechazar(new Error(empezo ? "No se pudo preparar el video" : "SIN_WORKER"));
    };
    w.onmessage = async (e: MessageEvent) => {
      const m = e.data;
      empezo = true;
      if (m.tipo === "fase") o.onFase?.(m.fase);
      else if (m.tipo === "progreso") o.onProgreso?.(m.pct);
      else if (m.tipo === "marca") {
        try {
          const imagen = await marcaComoBitmap(o.formato, m.W, m.H);
          w.postMessage({ tipo: "marca", imagen }, [imagen]);
        } catch {
          terminar();
          rechazar(new Error("SIN_WORKER"));
        }
      } else if (m.tipo === "listo") { terminar(); resolver(m.blob as Blob); }
      else if (m.tipo === "error") { terminar(); rechazar(new Error(m.mensaje)); }
    };
    w.postMessage({ tipo: "exportar", opciones: separar(o), pausaMs: pausaActual });
  });
}

/** Exporta el clip. Devuelve el archivo y una URL blob: (el llamador debe revocarla). */
export async function exportarClip(o: ExportOptions): Promise<{ url: string; blob: Blob }> {
  if (o.finSeg - o.inicioSeg > 120) throw new Error("Los clips pueden durar máximo 2 minutos.");
  if (soportaExportRapido()) {
    try {
      let blob: Blob;
      try {
        blob = await exportarEnWorker(o);
      } catch (e) {
        if (!(e instanceof Error && e.message === "SIN_WORKER")) throw e;
        // Sin worker: mismo proceso en la página
        blob = await exportarNucleo(separar(o), {
          obtenerMarca: (W, H) => crearMarcaAgua(o.formato, W, H),
          onFase: o.onFase,
          onProgreso: o.onProgreso,
          pausa: () => pausaActual,
        });
      }
      return { url: URL.createObjectURL(blob), blob };
    } catch (e) {
      if (!(e instanceof Error && e.message === "NO_WEBCODECS")) throw e;
    }
  }
  // Respaldo (navegadores sin WebCodecs): ffmpeg.wasm, encuadre fijo, con marca de agua.
  const url = await processClip({
    videoUrl: o.videoUrl, inicioSeg: o.inicioSeg, finSeg: o.finSeg,
    speed: o.speed, brightness: o.brightness, contrast: o.contrast,
    formato: o.formato, vistaFija: o.vistaFija,
    onFase: o.onFase, onProgreso: o.onProgreso,
  });
  return { url, blob: await (await fetch(url)).blob() };
}

"use client";

import type { FormatoClip } from "@/lib/marcaAgua";

interface Props {
  etiquetas: readonly string[];
  etiqueta: string | null;
  etiquetaCustom: string;
  onEtiqueta: (e: string) => void;
  onEtiquetaCustom: (t: string) => void;
  /** Formato decidido por cómo se miraba al marcar (vertical = reel, horizontal = completo). */
  formato: FormatoClip;
  /** Si hubo zoom/movimiento al marcar: se ofrece usarlo o no. */
  haySeguimiento: boolean;
  conSeguimiento: boolean;
  onConSeguimiento: (v: boolean) => void;
  duracionTexto: string;
  error?: string | null;
  puedeCrear: boolean;
  onCrear: () => void;
  onDescartar: () => void;
  /** Versión encima del video (pantalla completa): más compacta. */
  enVideo?: boolean;
}

/**
 * Datos de la jugada recién marcada. Al crearla queda en "Jugadas destacadas" y el
 * clip se prepara en segundo plano mientras se sigue viendo el partido.
 */
/** Colores según dónde se muestra: encima del video (oscuro) o en el panel blanco de abajo. */
const TEMAS = {
  oscuro: {
    titulo: "text-snow",
    secundario: "text-mist-400",
    etiqueta: "text-mist-500",
    acento: "text-crystal-400",
    chipOn: "bg-crystal-400/12 border-crystal-400 text-crystal-400",
    chipOff: "border-mist-500/20 text-mist-400 hover:border-mist-500/40 hover:text-snow",
    segOn: "bg-crystal-400/20 text-crystal-300",
    segOff: "text-mist-500",
    segFondo: "bg-black/30",
    input: "bg-lake-950 border-crystal-400/15 text-white placeholder-mist-700 focus:ring-crystal-400/40",
    error: "text-red-400 bg-red-500/10 border-red-500/20",
    descartar: "border-mist-500/15 text-mist-500 hover:text-snow",
    crear: "bg-crystal-400 text-lake-950 hover:bg-crystal-300",
    nota: "text-mist-600",
  },
  claro: {
    titulo: "text-ink-950",
    secundario: "text-ink-500",
    etiqueta: "text-ink-500",
    acento: "text-brand-ink",
    chipOn: "bg-brand border-brand text-white",
    chipOff: "bg-white border-line text-ink-700 hover:border-ink-300",
    segOn: "bg-brand text-white font-semibold",
    segOff: "text-ink-500",
    segFondo: "bg-surface border border-line",
    input: "bg-white border-line text-ink-950 placeholder-ink-300 focus:ring-brand/30",
    error: "text-red-700 bg-red-50 border-red-200",
    descartar: "border-line text-ink-700 hover:border-ink-300",
    crear: "bg-brand text-white hover:bg-brand-hover",
    nota: "text-ink-500",
  },
} as const;

export default function FormularioJugada(p: Props) {
  const t = TEMAS[p.enVideo ? "oscuro" : "claro"];

  const chip = (activo: boolean) =>
    `px-3.5 py-2 rounded-full text-[13px] font-medium border transition-[background-color,border-color,transform] duration-150 active:scale-[0.96] ${activo ? t.chipOn : t.chipOff}`;

  const segmento = (activo: boolean) =>
    `flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs transition-colors ${activo ? t.segOn : t.segOff}`;

  return (
    <div className={p.enVideo ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${t.titulo}`}>Nueva jugada</p>
        <span className={`flex items-center gap-2 text-xs ${t.secundario}`}>
          {p.formato === "reel" ? (
            <><span className="w-2 h-3 rounded-[2px] border-[1.5px] border-current" />Reel 9:16</>
          ) : (
            <><span className="w-3.5 h-2 rounded-[2px] border-[1.5px] border-current" />Completo</>
          )}
          <span className={`font-mono ${t.acento}`}>{p.duracionTexto}</span>
        </span>
      </div>

      <div className="space-y-2">
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${t.etiqueta}`}>Etiqueta</p>
        <div className="flex flex-wrap gap-2">
          {p.etiquetas.map((e) => (
            <button key={e} type="button" onClick={() => p.onEtiqueta(e)} className={chip(p.etiqueta === e)}>{e}</button>
          ))}
        </div>
        {p.etiqueta === "Otro" && (
          <input
            type="text"
            placeholder="Describe tu jugada..."
            value={p.etiquetaCustom}
            onChange={(e) => p.onEtiquetaCustom(e.target.value)}
            autoFocus={!p.enVideo}
            className={`w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 ${t.input}`}
          />
        )}
      </div>

      {p.haySeguimiento && (
        <div className="space-y-2">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${t.etiqueta}`}>Tu zoom y movimiento</p>
          <div className={`flex gap-1 rounded-xl p-1 ${t.segFondo}`}>
            <button type="button" onClick={() => p.onConSeguimiento(true)} className={segmento(p.conSeguimiento)}>Con seguimiento</button>
            <button type="button" onClick={() => p.onConSeguimiento(false)} className={segmento(!p.conSeguimiento)}>Sin seguimiento</button>
          </div>
        </div>
      )}

      {p.error && <p className={`text-xs border rounded-lg px-3 py-2 ${t.error}`}>{p.error}</p>}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={p.onDescartar} className={`py-2.5 rounded-xl text-sm font-semibold border transition-[border-color,color,transform] duration-150 active:scale-[0.97] ${t.descartar}`}>
          Descartar
        </button>
        <button
          type="button"
          onClick={p.onCrear}
          disabled={!p.puedeCrear}
          className={`py-2.5 rounded-xl text-sm font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed ${t.crear}`}
        >
          Crear jugada
        </button>
      </div>
      <p className={`text-[11px] text-center leading-snug ${t.nota}`}>
        {p.puedeCrear
          ? "Se guarda en tus jugadas destacadas y se prepara mientras sigues viendo el partido."
          : "Elige una etiqueta para crear la jugada."}
      </p>
    </div>
  );
}

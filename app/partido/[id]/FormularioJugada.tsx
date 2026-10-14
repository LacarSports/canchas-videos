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
export default function FormularioJugada(p: Props) {
  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${activo
      ? "bg-crystal-400/12 border-crystal-400 text-crystal-400"
      : "border-mist-500/20 text-mist-400 hover:border-mist-500/40 hover:text-snow"}`;

  const segmento = (activo: boolean) =>
    `flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs transition-colors ${activo
      ? "bg-crystal-400/20 text-crystal-300"
      : "text-mist-500"}`;

  return (
    <div className={p.enVideo ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-snow">Nueva jugada</p>
        <span className="flex items-center gap-2 text-xs text-mist-400">
          {p.formato === "reel" ? (
            <><span className="w-2 h-3 rounded-[2px] border-[1.5px] border-current" />Reel 9:16</>
          ) : (
            <><span className="w-3.5 h-2 rounded-[2px] border-[1.5px] border-current" />Completo</>
          )}
          <span className="font-mono text-crystal-400">{p.duracionTexto}</span>
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-mist-500 uppercase tracking-wide">Etiqueta</p>
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
            className="w-full bg-lake-950 border border-crystal-400/15 rounded-lg px-3 py-2 text-sm text-white placeholder-mist-700 focus:outline-none focus:ring-1 focus:ring-crystal-400/40"
          />
        )}
      </div>

      {p.haySeguimiento && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-mist-500 uppercase tracking-wide">Tu zoom y movimiento</p>
          <div className="flex gap-1 rounded-xl bg-black/30 p-1">
            <button type="button" onClick={() => p.onConSeguimiento(true)} className={segmento(p.conSeguimiento)}>Con seguimiento</button>
            <button type="button" onClick={() => p.onConSeguimiento(false)} className={segmento(!p.conSeguimiento)}>Sin seguimiento</button>
          </div>
        </div>
      )}

      {p.error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{p.error}</p>}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={p.onDescartar} className="py-2.5 rounded-lg text-xs border border-mist-500/15 text-mist-500 hover:text-snow transition-colors">
          Descartar
        </button>
        <button
          type="button"
          onClick={p.onCrear}
          disabled={!p.puedeCrear}
          className="py-2.5 rounded-lg text-sm font-semibold bg-crystal-400 text-lake-950 hover:bg-crystal-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Crear jugada
        </button>
      </div>
      <p className="text-[11px] text-mist-600 text-center leading-snug">
        {p.puedeCrear
          ? "Se guarda en tus jugadas destacadas y se prepara mientras sigues viendo el partido."
          : "Elige una etiqueta para crear la jugada."}
      </p>
    </div>
  );
}

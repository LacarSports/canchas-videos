"use client";

import { useState } from "react";
import type { FormatoClip } from "@/lib/marcaAgua";

interface Props {
  formatoInicial?: FormatoClip;
  /** Si el jugador hizo zoom/movimiento al grabar: ofrece usarlo o no. */
  haySeguimiento?: boolean;
  onElegir: (formato: FormatoClip, conSeguimiento: boolean) => void;
  onCancelar?: () => void;
}

/** Selector de formato al descargar: Reel 9:16 o Completo (ambos con marca de agua). */
export default function ElegirFormato({ formatoInicial = "reel", haySeguimiento = false, onElegir, onCancelar }: Props) {
  const [conSeguimiento, setConSeguimiento] = useState(true);

  const opcion = (formato: FormatoClip, titulo: string, detalle: string, icono: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onElegir(formato, haySeguimiento && conSeguimiento)}
      className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 text-center transition-all active:scale-[0.98] ${
        formatoInicial === formato
          ? "border-crystal-400/60 bg-crystal-400/10"
          : "border-mist-500/15 hover:border-crystal-400/40 hover:bg-crystal-400/5"
      }`}
    >
      <div className="h-12 flex items-center justify-center text-crystal-400">{icono}</div>
      <div>
        <div className="text-sm font-semibold text-snow">{titulo}</div>
        <div className="text-[11px] text-mist-500 leading-snug mt-0.5">{detalle}</div>
      </div>
    </button>
  );

  return (
    <div className="space-y-3 rounded-xl border border-crystal-400/15 bg-lake-950/40 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-mist-400">¿Cómo quieres tu clip?</p>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="text-[11px] text-mist-600 hover:text-snow">Cancelar</button>
        )}
      </div>

      {haySeguimiento && (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-1 text-xs">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setConSeguimiento(v)}
              className={`rounded-md py-1.5 transition-colors ${conSeguimiento === v ? "bg-crystal-400/20 text-crystal-300" : "text-mist-500"}`}
            >
              {v ? "Con mi seguimiento" : "Sin seguimiento"}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {opcion("reel", "Reel 9:16", "Para Instagram, TikTok y estados",
          <div className="w-6 h-11 rounded-[5px] border-2 border-current" />)}
        {opcion("completo", "Completo", "Se ve toda la cancha",
          <div className="w-14 h-8 rounded-[5px] border-2 border-current" />)}
      </div>
    </div>
  );
}

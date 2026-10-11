"use client";

import { useAjustesReproductor, setAjustes } from "@/lib/ajustesReproductor";

const PASO = 10;
const MIN = 50;
const MAX = 200;

/**
 * Barra flotante de brillo y contraste, encima del video: se ajusta con − / + y se
 * ve el resultado al instante. Los valores son compartidos con todos los reproductores.
 */
export default function BarraImagen({ onCerrar }: { onCerrar: () => void }) {
  const { brillo, contraste } = useAjustesReproductor();

  const control = (etiqueta: string, valor: number, cambiar: (v: number) => void) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-white/70 w-[62px]">{etiqueta}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); cambiar(Math.max(MIN, valor - PASO)); }}
        disabled={valor <= MIN}
        aria-label={`Bajar ${etiqueta.toLowerCase()}`}
        className="w-9 h-9 rounded-full bg-white/10 active:bg-white/25 text-white text-lg leading-none disabled:opacity-30"
      >−</button>
      <span className="text-xs font-mono text-crystal-300 w-11 text-center tabular-nums">{valor}%</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); cambiar(Math.min(MAX, valor + PASO)); }}
        disabled={valor >= MAX}
        aria-label={`Subir ${etiqueta.toLowerCase()}`}
        className="w-9 h-9 rounded-full bg-white/10 active:bg-white/25 text-white text-lg leading-none disabled:opacity-30"
      >+</button>
    </div>
  );

  return (
    <div
      data-no-gesture
      className="flex items-center gap-3 bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl px-3 py-2 shadow-xl"
      onClick={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1">
        {control("Brillo", brillo, (v) => setAjustes({ brillo: v }))}
        {control("Contraste", contraste, (v) => setAjustes({ contraste: v }))}
      </div>
      <div className="flex flex-col gap-1.5 border-l border-white/10 pl-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAjustes({ brillo: 100, contraste: 100 }); }}
          className="text-[11px] text-white/60 active:text-white px-1 py-1"
        >Normal</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCerrar(); }}
          className="text-[11px] text-crystal-300 font-medium px-1 py-1"
        >Listo</button>
      </div>
    </div>
  );
}

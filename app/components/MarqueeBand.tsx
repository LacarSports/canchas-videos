/**
 * Banda inclinada con texto que avanza en bucle (estilo cinta deportiva).
 * Solo CSS: el contenido va dos veces seguidas y la animación lo corre -50%,
 * así el corte no se nota. Con "reducir movimiento" queda quieta.
 */
const PALABRAS_JUGADOR = ["Busca", "Revive", "Descarga", "Comparte"];

function Tira({ palabras, oculta = false }: { palabras: readonly string[]; oculta?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={oculta || undefined}>
      {[0, 1].flatMap((vuelta) =>
        palabras.map((p) => (
          <span key={`${vuelta}-${p}`} className="flex items-center">
            <span className="px-4 sm:px-6">{p}</span>
            <span aria-hidden="true">🔥</span>
          </span>
        ))
      )}
    </div>
  );
}

export default function MarqueeBand({
  palabras = PALABRAS_JUGADOR,
  className = "",
}: {
  palabras?: readonly string[];
  className?: string;
}) {
  return (
    <div className={`relative z-20 overflow-hidden py-6 -my-6 ${className}`}>
      <div className="-rotate-[3deg] -mx-4 bg-brand shadow-[0_10px_30px_rgba(45,201,183,0.35)]">
        <div className="flex w-max animate-marquee py-3 sm:py-4 text-white font-black uppercase italic tracking-tight text-2xl sm:text-4xl select-none">
          <Tira palabras={palabras} />
          <Tira palabras={palabras} oculta />
        </div>
      </div>
    </div>
  );
}

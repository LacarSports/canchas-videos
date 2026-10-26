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
    // El margen vertical deja espacio para la inclinación: con 3° la banda sube y baja
    // ~2,6 px por cada 100 px de ancho, así que 64 px alcanzan hasta pantallas de ~2400 px.
    // Sin pointer-events porque el margen negativo se monta sobre las secciones vecinas.
    <div className={`relative z-20 overflow-hidden py-16 -my-16 pointer-events-none ${className}`}>
      <div className="-rotate-[3deg] -mx-[5vw] bg-brand shadow-[0_10px_30px_rgba(45,201,183,0.35)]">
        <div className="flex w-max animate-marquee py-3 sm:py-4 text-white font-black uppercase italic tracking-tight text-2xl sm:text-4xl select-none">
          <Tira palabras={palabras} />
          <Tira palabras={palabras} oculta />
        </div>
      </div>
    </div>
  );
}

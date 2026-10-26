"use client";

import Link, { useLinkStatus } from "next/link";

interface PartidoCardData {
  id: string;
  complejo: string;
  numero_cancha: number;
  ciudad: string;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  videoUrl: string | null;
}

function formatFecha(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Ícono de play que pasa a "cargando" apenas se toca la tarjeta. */
function IconoPlay() {
  const { pending } = useLinkStatus();
  return (
    <div className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-200 ${pending ? "bg-crystal-400/20 border-crystal-400/60" : "bg-crystal-400/8 border-crystal-400/15 group-hover:bg-crystal-400/15 group-hover:border-crystal-400/40"}`}>
      {pending ? (
        <span className="w-4 h-4 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-3.5 h-3.5 text-crystal-400/60 group-hover:text-crystal-400 ml-0.5 transition-colors duration-200" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </div>
  );
}

/** Flecha que se cambia por "Abriendo…" mientras carga el partido. */
function Flecha() {
  const { pending } = useLinkStatus();
  if (pending) return <span className="shrink-0 text-xs text-crystal-300 font-medium">Abriendo…</span>;
  return (
    <svg className="shrink-0 w-4 h-4 text-mist-700 group-hover:text-crystal-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function PartidoCard({ partido }: { partido: PartidoCardData }) {
  return (
    <Link
      href={`/partido/${partido.id}`}
      className="group flex items-center gap-4 bg-lake-900/60 hover:bg-lake-800/80 rounded-xl border border-mist-500/10 hover:border-crystal-400/30 px-4 py-3.5 transition-all duration-200 hover:shadow-[0_0_20px_rgba(45,201,183,0.07)]"
    >
      {/* Icono play */}
      <IconoPlay />

      {/* Info principal */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-snow text-sm truncate">{partido.complejo}</span>
          <span className="shrink-0 text-mist-600 text-xs">·</span>
          <span className="shrink-0 text-crystal-400/70 text-xs font-medium">Cancha {partido.numero_cancha}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-mist-500 mt-0.5">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-mist-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatFecha(partido.fecha)}
          </span>
          <span>{partido.hora}</span>
          <span className="text-amber-400/70">{partido.duracion_minutos} min</span>
        </div>
      </div>

      {/* Flecha */}
      <Flecha />
    </Link>
  );
}

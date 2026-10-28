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
    <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-150 ${pending ? "bg-brand/80" : "bg-brand"}`}>
      {pending ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </div>
  );
}

/** Flecha que se cambia por "Abriendo…" mientras carga el partido. */
function Flecha() {
  const { pending } = useLinkStatus();
  if (pending) return <span className="shrink-0 text-xs text-brand-ink font-semibold">Abriendo…</span>;
  return (
    <svg className="shrink-0 w-4 h-4 text-ink-300 group-hover:text-brand-ink transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function PartidoCard({ partido }: { partido: PartidoCardData }) {
  return (
    <Link
      href={`/partido/${partido.id}`}
      className="group flex items-center gap-3.5 bg-white rounded-2xl border border-line hover:border-brand/50 px-3.5 py-3 transition-[border-color,transform] duration-150 active:scale-[0.98]"
    >
      {/* Icono play */}
      <IconoPlay />

      {/* Info principal */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-ink-950 text-[15px] truncate">{partido.complejo}</span>
          <span className="shrink-0 text-ink-300 text-xs">·</span>
          <span className="shrink-0 text-brand-ink text-xs font-semibold">Cancha {partido.numero_cancha}</span>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-ink-500 mt-0.5">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatFecha(partido.fecha)}
          </span>
          <span>{partido.hora}</span>
          <span className="text-ink-500 tabular-nums">{partido.duracion_minutos} min</span>
        </div>
      </div>

      {/* Flecha */}
      <Flecha />
    </Link>
  );
}

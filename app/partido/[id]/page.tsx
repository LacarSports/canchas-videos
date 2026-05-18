import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import PartidoView from "./PartidoView";
import PasswordGate from "./PasswordGate";
import ShareMatchButton from "./ShareMatchButton";

interface Partido {
  id: string;
  complejo: string;
  numero_cancha: number;
  ciudad: string;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  archivo_url: string;
  privado: boolean;
  password_hash: string | null;
  deporte?: string | null;
}

function formatFechaLarga(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildVideoUrl(archivoUrl: string) {
  if (archivoUrl.startsWith("http")) return archivoUrl;
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return `${base}/${archivoUrl}`;
}

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: partido, error } = await supabase
    .from("partidos")
    .select("*")
    .eq("id", id)
    .single<Partido>();

  if (error || !partido) notFound();

  const videoUrl = buildVideoUrl(partido.archivo_url);
  const title = `${partido.complejo} — Cancha ${partido.numero_cancha}`;

  return (
    <main className="min-h-screen bg-lake-950">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2240 60%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 100% at 0% 50%, rgba(41,196,173,0.08), transparent)" }} />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(41,196,173,0.3), transparent)" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 relative">
          <Link
            href="/#buscador"
            className="inline-flex items-center gap-1.5 text-mist-500 hover:text-crystal-400 text-sm transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a partidos
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400 mb-1">Partido</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-snow">{partido.complejo}</h1>
              <p className="text-mist-500 mt-1 text-sm">
                Cancha {partido.numero_cancha}{partido.ciudad ? ` · ${partido.ciudad}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 bg-crystal-400/10 border border-crystal-400/20 text-crystal-300 rounded-xl px-3 py-1.5 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatFechaLarga(partido.fecha)}
              </span>
              <span className="flex items-center gap-1.5 bg-glacial-400/10 border border-glacial-400/20 text-glacial-300 rounded-xl px-3 py-1.5 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {partido.hora}
              </span>
              <span className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-xl px-3 py-1.5 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {partido.duracion_minutos} min
              </span>
              <ShareMatchButton partidoId={partido.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Video + sidebar (client) */}
        {partido.privado ? (
          <PasswordGate partidoId={partido.id} videoUrl={videoUrl} title={title} deporte={partido.deporte} />
        ) : (
          <PartidoView videoUrl={videoUrl} title={title} partidoId={partido.id} deporte={partido.deporte} />
        )}

      </div>
    </main>
  );
}

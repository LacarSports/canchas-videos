import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ClipViewer from "./ClipViewer";

interface JugadaRow {
  id: string;
  partido_id: string;
  etiqueta: string;
  inicio_seg: number;
  fin_seg: number;
  duracion: number;
  partidos: {
    id: string;
    complejo: string;
    numero_cancha: number;
    ciudad: string;
    fecha: string;
    hora: string;
    archivo_url: string;
  } | null;
}

function buildVideoUrl(archivoUrl: string) {
  if (archivoUrl.startsWith("http")) return archivoUrl;
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return `${base}/${archivoUrl}`;
}

function formatFechaLarga(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function JugadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("jugadas")
    .select(
      "id, partido_id, etiqueta, inicio_seg, fin_seg, duracion, partidos(id, complejo, numero_cancha, ciudad, fecha, hora, archivo_url)"
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const jugada = data as unknown as JugadaRow;
  const partido = jugada.partidos;
  if (!partido) notFound();

  const videoUrl = buildVideoUrl(partido.archivo_url);

  return (
    <main className="min-h-screen bg-lake-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Back */}
        <Link
          href="/#jugadas"
          className="inline-flex items-center gap-1.5 text-mist-600 hover:text-crystal-400 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Jugadas destacadas
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-snow">{partido.complejo}</h1>
          <p className="text-mist-700 mt-0.5 text-sm">
            Cancha {partido.numero_cancha}
            {partido.ciudad ? ` · ${partido.ciudad}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="bg-crystal-400/8 border border-crystal-400/15 text-crystal-300 rounded-full px-3 py-1 text-xs">
              {formatFechaLarga(partido.fecha)}
            </span>
            <span className="bg-crystal-400/8 border border-crystal-400/15 text-crystal-300 rounded-full px-3 py-1 text-xs">
              {partido.hora}
            </span>
          </div>
        </div>

        {/* Clip viewer */}
        <ClipViewer
          videoUrl={videoUrl}
          inicioSeg={jugada.inicio_seg}
          finSeg={jugada.fin_seg}
          duracion={jugada.duracion}
          etiqueta={jugada.etiqueta}
          jugadaId={jugada.id}
          partidoId={jugada.partido_id}
        />

      </div>
    </main>
  );
}

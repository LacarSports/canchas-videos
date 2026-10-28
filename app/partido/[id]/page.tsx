import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import PartidoView from "./PartidoView";
import PasswordGate from "./PasswordGate";
import AuthGate from "./AuthGate";
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
    // Columnas explícitas: password_hash no es legible con la anon key (la clave se
    // verifica en el servidor, /api/video-auth).
    .select("id, complejo, numero_cancha, ciudad, fecha, hora, duracion_minutos, archivo_url, privado, deporte")
    .eq("id", id)
    .single<Partido>();

  if (error || !partido) notFound();

  const videoUrl = buildVideoUrl(partido.archivo_url);
  const title = `${partido.complejo}, Cancha ${partido.numero_cancha}`;

  return (
    <main className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface">
      {/* Encabezado del partido */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-6 sm:pt-8 sm:pb-8">
          <Link
            href="/#buscador"
            className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-950 text-sm font-semibold -ml-1 px-1 py-1 rounded-lg transition-colors mb-3 sm:mb-5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a partidos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
                Cancha {partido.numero_cancha}{partido.deporte ? ` · ${partido.deporte}` : ""}
              </p>
              <h1 className="text-[28px] sm:text-4xl font-black tracking-tight leading-[1.05] text-ink-950">{partido.complejo}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="inline-block first-letter:uppercase">{formatFechaLarga(partido.fecha)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <svg className="w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {partido.hora} · {partido.duracion_minutos} min
                </span>
                {partido.ciudad && <span>{partido.ciudad}</span>}
              </div>
            </div>
            <div className="shrink-0">
              <ShareMatchButton partidoId={partido.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">

        {/* Video + sidebar (client) — ver un partido requiere sesión iniciada */}
        <AuthGate>
          {partido.privado ? (
            <PasswordGate partidoId={partido.id} videoUrl={videoUrl} title={title} deporte={partido.deporte} complejo={partido.complejo} numeroCancha={partido.numero_cancha} hora={partido.hora} />
          ) : (
            <PartidoView videoUrl={videoUrl} title={title} partidoId={partido.id} deporte={partido.deporte} complejo={partido.complejo} numeroCancha={partido.numero_cancha} hora={partido.hora} />
          )}
        </AuthGate>

      </div>
    </main>
  );
}

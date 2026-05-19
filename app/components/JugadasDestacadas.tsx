"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import InlineClipPlayer from "./InlineClipPlayer";

export interface JugadaItem {
  id: string;
  etiqueta: string;
  inicio_seg: number;
  fin_seg: number;
  duracion: number;
  reproducciones: number;
  partido_id: string;
  complejo: string | null;
  fecha: string | null;
  hora: string | null;
  videoUrl: string | null;
}

const TAG_STYLES: Record<string, string> = {
  Gol:           "bg-crystal-400/15 text-crystal-300 border-crystal-400/25",
  Atajada:       "bg-glacial-400/15 text-glacial-300 border-glacial-400/25",
  Caño:          "bg-pine-400/15 text-pine-400 border-pine-400/25",
  "Buena jugada":"bg-mist-500/12 text-mist-400 border-mist-500/22",
  Blooper:       "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Otro:          "bg-lake-600/30 text-mist-600 border-mist-700/25",
};

function fmtSeg(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatFechaCorta(fecha: string) {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

function JugadaThumbnail({ videoUrl, atSeg }: { videoUrl: string; atSeg: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function capturar() {
      try {
        // Fetch and parse the m3u8 playlist to get .ts segment URLs
        const res = await fetch(`/api/proxy-video?url=${encodeURIComponent(videoUrl)}`);
        if (!res.ok || cancelled) return;
        const text = await res.text();

        const lines = text.split("\n").map((l) => l.trim());
        const segments: { duration: number; uri: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXTINF:")) {
            const duration = parseFloat(lines[i].split(":")[1]);
            const uri = lines[i + 1];
            if (uri && !uri.startsWith("#")) {
              segments.push({ duration, uri });
              i++;
            }
          }
        }

        if (segments.length === 0 || cancelled) return;

        // Find the segment containing atSeg and the time offset within it
        let cumulative = 0;
        let segUri = segments[0].uri;
        let offset = atSeg;
        for (const seg of segments) {
          if (atSeg < cumulative + seg.duration) {
            segUri = seg.uri;
            offset = atSeg - cumulative;
            break;
          }
          cumulative += seg.duration;
        }

        // Resolve relative .ts paths against the playlist base URL
        let tsUrl = segUri;
        if (!tsUrl.startsWith("http")) {
          const base = videoUrl.slice(0, videoUrl.lastIndexOf("/") + 1);
          tsUrl = base + segUri;
        }

        if (cancelled) return;

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.src = `/api/proxy-video?url=${encodeURIComponent(tsUrl)}`;

        const capture = () => {
          if (cancelled || video.readyState < 2) return;
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          try { setImgSrc(canvas.toDataURL("image/jpeg", 0.7)); } catch { /* canvas tainted */ }
          video.src = "";
        };

        video.addEventListener("seeked", capture, { once: true });
        video.addEventListener("loadeddata", () => {
          if (cancelled || video.readyState < 2) return;
          if (offset <= 0) {
            capture();
          } else {
            video.currentTime = offset;
          }
        }, { once: true });
      } catch { /* silently fail — thumbnail stays as gradient placeholder */ }
    }

    capturar();
    return () => { cancelled = true; };
  }, [videoUrl, atSeg]);

  return (
    <div className="absolute inset-0">
      {imgSrc ? (
        <img src={imgSrc} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-lake-700/50 to-lake-950" />
      )}
    </div>
  );
}

export default function JugadasDestacadas({ jugadas }: { jugadas: JugadaItem[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  function handleCopyLink(jugadaId: string) {
    const url = `${window.location.origin}/jugada/${jugadaId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedLinkId(jugadaId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  }

  async function handleShare(jugada: JugadaItem) {
    const url = `${window.location.origin}/jugada/${jugada.id}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Jugada: ${jugada.etiqueta}`,
          text: `Mirá esta jugada (${jugada.etiqueta})`,
          url,
        });
        return;
      } catch { /* cancelled */ }
    }
    handleCopyLink(jugada.id);
  }

  if (jugadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-crystal-400/8 border border-crystal-400/12 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-crystal-400/40" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <p className="text-mist-600 text-sm">Aún no hay jugadas destacadas guardadas.</p>
        <p className="text-mist-700 text-xs mt-1">Busca tu partido y guarda tu primera jugada.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {jugadas.map((jugada) => {
        const isPlaying = playingId === jugada.id;

        return (
          <div
            key={jugada.id}
            className="group bg-lake-900/80 rounded-2xl border border-mist-500/10 overflow-hidden hover:border-crystal-400/30 transition-all duration-300 hover:shadow-[0_0_32px_rgba(41,196,173,0.12),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-sm hover:-translate-y-0.5"
          >
            {isPlaying && jugada.videoUrl ? (
              <InlineClipPlayer
                videoUrl={jugada.videoUrl}
                inicioSeg={jugada.inicio_seg}
                finSeg={jugada.fin_seg}
                duracion={jugada.duracion}
                onClose={() => setPlayingId(null)}
              />
            ) : (
              <button
                onClick={() => jugada.videoUrl && setPlayingId(jugada.id)}
                className="w-full aspect-video bg-lake-950 relative overflow-hidden block"
                disabled={!jugada.videoUrl}
                style={{ touchAction: "manipulation" }}
              >
                {jugada.videoUrl ? (
                  <JugadaThumbnail videoUrl={jugada.videoUrl} atSeg={jugada.inicio_seg} />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-lake-700/40 to-lake-950" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-lake-950/60 via-transparent to-transparent" />

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-lake-950/50 border border-white/20 group-hover:border-crystal-400/50 group-hover:bg-crystal-400/15 flex items-center justify-center transition-all duration-300 backdrop-blur-sm">
                    <svg className="w-6 h-6 text-snow ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Tag */}
                <span
                  className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${
                    TAG_STYLES[jugada.etiqueta] ?? TAG_STYLES["Otro"]
                  }`}
                >
                  {jugada.etiqueta}
                </span>

                {/* Duration */}
                <span className="absolute bottom-2.5 right-2.5 text-[11px] font-mono text-snow/70 bg-lake-950/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                  {fmtSeg(jugada.duracion)}
                </span>
              </button>
            )}

            {/* Footer */}
            <div className="p-4 bg-gradient-to-b from-lake-900/0 to-lake-950/30">
              <p className="text-snow font-semibold text-sm mb-1 truncate">
                {jugada.complejo ?? "Partido"}
              </p>
              <div className="flex items-center justify-between text-xs text-mist-500">
                <span>
                  {jugada.fecha && jugada.hora
                    ? `${formatFechaCorta(jugada.fecha)} · ${jugada.hora}`
                    : ""}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-mist-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {(jugada.reproducciones ?? 0).toLocaleString("es-CL")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleShare(jugada)}
                      className="flex items-center gap-1 text-mist-600 hover:text-mist-400 transition-colors py-1 px-1"
                      title="Compartir"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleCopyLink(jugada.id)}
                      className={`flex items-center gap-1 transition-colors py-1 px-1 ${copiedLinkId === jugada.id ? "text-crystal-400" : "text-mist-600 hover:text-mist-400"}`}
                      title="Copiar enlace"
                    >
                      {copiedLinkId === jugada.id ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      )}
                    </button>
                    <Link
                      href={`/jugada/${jugada.id}`}
                      className="flex items-center gap-1 text-mist-600 hover:text-crystal-400 transition-colors py-1 px-1 -mr-1"
                      title="Ver clip"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="text-[11px]">Ver</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

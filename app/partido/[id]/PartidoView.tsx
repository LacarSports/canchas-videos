"use client";

import { useState, useEffect, useRef } from "react";
import VideoClipSelector, { type ClipLocal } from "./VideoClipSelector";
import { processClip } from "./processClip";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import InlineClipPlayer from "@/app/components/InlineClipPlayer";

/* â”€â”€ tag styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const TAG_STYLES: Record<string, string> = {
  Gol:           "bg-crystal-400/15 text-crystal-300 border-crystal-400/25",
  Atajada:       "bg-glacial-400/15 text-glacial-300 border-glacial-400/25",
  Caño:          "bg-pine-400/15 text-pine-400 border-pine-400/25",
  "Buena jugada":"bg-mist-500/12 text-mist-400 border-mist-500/22",
  Blooper:       "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Otro:          "bg-lake-600/30 text-mist-600 border-mist-700/25",
};

function tagStyle(etiqueta: string) {
  return TAG_STYLES[etiqueta] ?? TAG_STYLES["Otro"];
}

function fmt(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


/* â”€â”€ props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface Props {
  videoUrl: string;
  title: string;
  partidoId: string;
  deporte?: string | null;
  complejo?: string;
  numeroCancha?: number;
}

/* â”€â”€ component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function PartidoView({ videoUrl, title, partidoId, deporte, complejo, numeroCancha }: Props) {
  const [clips, setClips] = useState<ClipLocal[]>([]);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  // Registro de visita: una sola vez por sesión de visualización (no en pausa/replay)
  const visitaRegistrada = useRef(false);

  async function handlePlayStart() {
    if (visitaRegistrada.current) return;
    visitaRegistrada.current = true;
    try {
      // No contar visitas del dueño mientras está logueado en el panel
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;
      const sessionId = getSessionId();
      if (!sessionId) return;
      await fetch("/api/visita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partidoId, complejo, sessionId }),
      });
    } catch {
      // un fallo de registro no debe afectar la reproducción
    }
  }

  // Sidebar download state (one at a time)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Share copy feedback per clip
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  /* â”€â”€ load existing jugadas from DB on mount â”€â”€ */
  useEffect(() => {
    supabase
      .from("jugadas")
      .select("id, partido_id, etiqueta, inicio_seg, fin_seg, duracion")
      .eq("partido_id", partidoId)
      .order("creado_en", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setClips(
          data.map((j) => ({
            id: j.id as string,
            partidoId: j.partido_id as string,
            etiqueta: j.etiqueta as string,
            inicioSeg: Number(j.inicio_seg),
            finSeg: Number(j.fin_seg),
            duracion: Number(j.duracion),
            // blobUrl omitted â€” not yet downloaded
          }))
        );
      });
  }, [partidoId]);

  /* â”€â”€ handle clip from VideoClipSelector â”€â”€ */

  async function handleClipGuardado(clip: ClipLocal) {
    // Avoid duplicate if same id already in list
    setClips((prev) =>
      prev.some((c) => c.id === clip.id) ? prev : [clip, ...prev]
    );

    // Only persist to DB when saved as "destacado" (no blobUrl)
    if (!clip.blobUrl) {
      try {
        const { data } = await supabase
          .from("jugadas")
          .insert({
            partido_id: clip.partidoId,
            etiqueta: clip.etiqueta,
            inicio_seg: clip.inicioSeg,
            fin_seg: clip.finSeg,
            duracion: clip.duracion,
          })
          .select("id")
          .single();

        // Replace temp UUID with the real DB id
        if (data?.id) {
          setClips((prev) =>
            prev.map((c) => (c.id === clip.id ? { ...c, id: data.id as string } : c))
          );
        }
      } catch {
        // DB table may not exist yet â€” clip stays in local state only
      }
    }
  }

  /* â”€â”€ delete clip â”€â”€ */

/* â”€â”€ sidebar download â”€â”€ */

  async function handleSidebarDownload(clip: ClipLocal) {
    if (downloadingId) return;
    setDownloadingId(clip.id);
    setDownloadError(null);

    try {
      const url = await processClip({
        videoUrl,
        inicioSeg: clip.inicioSeg,
        finSeg: clip.finSeg,
      });

      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_lacar_${clip.etiqueta.replace(/\s+/g, "_")}_${Math.floor(clip.inicioSeg)}s.mp4`;
      a.click();

      // Keep blob URL alive for modal playback
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, blobUrl: url } : c))
      );
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setDownloadingId(null);
    }
  }

  /* â”€â”€ sidebar copy link â”€â”€ */

  function handleSidebarCopyLink(clip: ClipLocal) {
    const url = `${window.location.origin}/jugada/${clip.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedLinkId(clip.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  }

  /* â”€â”€ sidebar share â”€â”€ */

  function getSidebarShareUrl(clip: ClipLocal) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/jugada/${clip.id}`;
  }

  async function handleSidebarShare(clip: ClipLocal) {
    const url = getSidebarShareUrl(clip);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Jugada: ${clip.etiqueta}`,
          text: `Mirá esta jugada (${clip.etiqueta})`,
          url,
        });
        return;
      } catch { /* cancelled */ }
    }
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiadoId(clip.id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  /* â”€â”€ render â”€â”€ */

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5 items-start">

        {/* Main: video + clip selector */}
        <VideoClipSelector
          src={videoUrl}
          videoUrl={videoUrl}
          title={title}
          partidoId={partidoId}
          deporte={deporte}
          complejo={complejo}
          numeroCancha={numeroCancha}
          clips={clips}
          onClipGuardado={handleClipGuardado}
          onPlayStart={handlePlayStart}
        />

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-mist-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-crystal-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
              </svg>
              Jugadas destacadas del partido
            </h3>
            {clips.length > 0 && (
              <span className="text-xs text-crystal-400 bg-crystal-400/10 px-2 py-0.5 rounded-full border border-crystal-400/15">
                {clips.length}
              </span>
            )}
          </div>

          {downloadError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {downloadError}
            </p>
          )}

          {/* Empty state */}
          {clips.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-lake-800/40 rounded-xl border border-dashed border-crystal-400/10">
              <div className="w-10 h-10 rounded-full bg-crystal-400/5 border border-crystal-400/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-crystal-400/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-xs text-mist-700 leading-relaxed max-w-[180px]">
                Guarda una jugada como destacada y aparecerá aquí
              </p>
            </div>
          )}

          {/* Clip list */}
          {clips.length > 0 && (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-0.5">
              {clips.map((clip, idx) => {
                const isDownloading = downloadingId === clip.id;
                const isCopied = copiadoId === clip.id;
                const isCopiedLink = copiedLinkId === clip.id;
                const hasBlob = !!clip.blobUrl;
                const isExpanded = playingClipId === clip.id;

                return (
                  <div
                    key={clip.id}
                    className="bg-lake-800/60 border border-crystal-400/8 rounded-xl overflow-hidden hover:border-crystal-400/15 transition-colors"
                  >
                    {/* Header — click to toggle player */}
                    <button
                      onClick={() => setPlayingClipId(isExpanded ? null : clip.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-mist-700 text-[10px] font-mono shrink-0">#{clips.length - idx}</span>
                      <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full border ${tagStyle(clip.etiqueta)}`}>
                        {clip.etiqueta}
                      </span>
                      <span className="text-xs font-mono text-mist-600 flex-1 min-w-0 truncate">
                        {fmt(clip.inicioSeg)} → {fmt(clip.finSeg)}
                      </span>
                      <span className="text-xs font-mono text-mist-700 shrink-0">{fmt(clip.duracion)}</span>
                      <svg
                        className={`w-3 h-3 text-mist-700 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expandable player */}
                    <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? "max-h-[260px]" : "max-h-0"}`}>
                      {isExpanded && (
                        <InlineClipPlayer
                          videoUrl={videoUrl}
                          inicioSeg={clip.inicioSeg}
                          finSeg={clip.finSeg}
                          duracion={clip.duracion}
                          blobUrl={clip.blobUrl}
                          compact
                        />
                      )}
                    </div>

                    {/* Actions — always visible */}
                    <div className="px-3 pb-2.5 pt-1.5 space-y-1.5">
                      <button
                        onClick={() => hasBlob ? (() => {
                          const a = document.createElement("a");
                          a.href = clip.blobUrl!;
                          a.download = `clip_lacar_${clip.etiqueta.replace(/\s+/g, "_")}.mp4`;
                          a.click();
                        })() : handleSidebarDownload(clip)}
                        disabled={!!downloadingId}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-mist-600 border border-mist-500/10 hover:border-crystal-400/30 hover:text-crystal-300 rounded-lg py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isDownloading ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Procesando...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar
                          </>
                        )}
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleSidebarShare(clip)}
                          className={`flex items-center justify-center gap-1.5 text-xs border transition-all py-1.5 rounded-lg ${
                            isCopied
                              ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/5"
                              : "border-mist-500/10 text-mist-600 hover:text-mist-400 hover:border-mist-500/25"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Copiado
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                              Compartir
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSidebarCopyLink(clip)}
                          className={`flex items-center justify-center gap-1.5 text-xs border transition-all py-1.5 rounded-lg ${
                            isCopiedLink
                              ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/5"
                              : "border-mist-500/10 text-mist-600 hover:text-mist-400 hover:border-mist-500/25"
                          }`}
                        >
                          {isCopiedLink ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Copiado
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              Copiar link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

    </>
  );
}

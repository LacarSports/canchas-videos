"use client";

import { useState, useEffect, useRef } from "react";
import VideoClipSelector, { type ClipLocal } from "./VideoClipSelector";
import { processClip } from "./processClip";
import { supabase } from "@/lib/supabase";
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
}

/* â”€â”€ component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function PartidoView({ videoUrl, title, partidoId }: Props) {
  const [clips, setClips] = useState<ClipLocal[]>([]);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  // Sidebar download state (one at a time)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Share copy feedback per clip
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

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

  async function handleDeleteClip(clip: ClipLocal) {
    // Optimistic remove
    setClips((prev) => prev.filter((c) => c.id !== clip.id));
    if (playingClipId === clip.id) setPlayingClipId(null);

    try {
      await supabase.from("jugadas").delete().eq("id", clip.id);
    } catch {
      // If delete fails, restore
      setClips((prev) => [clip, ...prev]);
    }
  }

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

  /* â”€â”€ sidebar share â”€â”€ */

  function getSidebarShareUrl(clip: ClipLocal) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/jugada/${clip.id}`;
  }

  function handleSidebarCopiar(clip: ClipLocal) {
    navigator.clipboard.writeText(getSidebarShareUrl(clip)).catch(() => {});
    setCopiadoId(clip.id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  function handleSidebarWhatsApp(clip: ClipLocal) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Mirá esta jugada (${clip.etiqueta}): ${getSidebarShareUrl(clip)}`)}`,
      "_blank"
    );
  }

  async function handleSidebarInstagram(clip: ClipLocal) {
    const shareUrl = getSidebarShareUrl(clip);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Jugada: ${clip.etiqueta}`,
          text: `Mirá esta jugada (${clip.etiqueta})`,
          url: shareUrl,
        });
        return;
      } catch { /* cancelled */ }
    }
    navigator.clipboard.writeText(shareUrl).catch(() => {});
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
          clips={clips}
          onClipGuardado={handleClipGuardado}
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

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSidebarCopiar(clip)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border transition-all ${
                            isCopied
                              ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/5"
                              : "border-mist-500/10 text-mist-600 hover:text-mist-400 hover:border-mist-500/25"
                          }`}
                        >
                          {isCopied
                            ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          }
                          {isCopied ? "Copiado" : "Enlace"}
                        </button>
                        <button
                          onClick={() => handleSidebarWhatsApp(clip)}
                          className="w-8 h-7 rounded-lg border border-mist-500/10 hover:border-green-500/30 text-mist-700 hover:text-green-400 flex items-center justify-center transition-all"
                          title="WhatsApp"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleSidebarInstagram(clip)}
                          className="w-8 h-7 rounded-lg border border-mist-500/10 hover:border-pink-500/30 text-mist-700 hover:text-pink-400 flex items-center justify-center transition-all"
                          title="Instagram"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClip(clip)}
                          className="w-8 h-7 flex items-center justify-center text-mist-700 hover:text-red-400 transition-colors rounded-lg border border-mist-500/10 hover:border-red-500/20"
                          title="Eliminar jugada"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

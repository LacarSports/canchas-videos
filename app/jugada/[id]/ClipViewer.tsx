"use client";

import { useState } from "react";
import Link from "next/link";
import { processClip } from "../../partido/[id]/processClip";
import ClipPlayer from "./ClipPlayer";

const TAG_STYLES: Record<string, string> = {
  Gol:           "bg-crystal-400/15 text-crystal-300 border-crystal-400/25",
  Atajada:       "bg-glacial-400/15 text-glacial-300 border-glacial-400/25",
  Caño:          "bg-pine-400/15 text-pine-400 border-pine-400/25",
  "Buena jugada":"bg-mist-500/12 text-mist-400 border-mist-500/22",
  Blooper:       "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Otro:          "bg-lake-600/30 text-mist-600 border-mist-700/25",
};

function fmt(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  videoUrl: string;
  inicioSeg: number;
  finSeg: number;
  duracion: number;
  etiqueta: string;
  jugadaId: string;
  partidoId: string;
}

export default function ClipViewer({
  videoUrl,
  inicioSeg,
  finSeg,
  duracion,
  etiqueta,
  jugadaId,
  partidoId,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const clipUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/jugada/${jugadaId}`
      : `/jugada/${jugadaId}`;

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const url = await processClip({ videoUrl, inicioSeg, finSeg });
      setBlobUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_lacar_${etiqueta.replace(/\s+/g, "_")}_${Math.floor(inicioSeg)}s.mp4`;
      a.click();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setDownloading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(clipUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Jugada: ${etiqueta}`,
          text: `Mirá esta jugada (${etiqueta})`,
          url: clipUrl,
        });
        return;
      } catch { /* cancelled */ }
    }
    navigator.clipboard.writeText(clipUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Video */}
      <ClipPlayer
        videoUrl={videoUrl}
        inicioSeg={inicioSeg}
        finSeg={finSeg}
        duracion={duracion}
        blobUrl={blobUrl ?? undefined}
      />

      {/* Clip info */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`text-sm font-semibold px-3 py-1 rounded-full border ${
            TAG_STYLES[etiqueta] ?? TAG_STYLES["Otro"]
          }`}
        >
          {etiqueta}
        </span>
        <span className="text-mist-700 text-sm font-mono">
          {fmt(inicioSeg)} → {fmt(finSeg)}
          <span className="text-mist-700 mx-1.5">·</span>
          {fmt(duracion)}
        </span>
      </div>

      {downloadError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {downloadError}
        </p>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-crystal-400/20 bg-crystal-400/8 hover:bg-crystal-400/15 text-crystal-400 hover:text-crystal-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Procesando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar
            </>
          )}
        </button>

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border transition-all ${
            copied
              ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/8"
              : "border-mist-500/15 text-mist-600 hover:text-snow hover:border-mist-500/30 bg-white/3"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copiado
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copiar enlace
            </>
          )}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-mist-500/15 text-mist-600 hover:text-snow hover:border-mist-500/30 bg-white/3 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Compartir
        </button>
      </div>

      {/* Full match link */}
      <div className="pt-2 border-t border-crystal-400/10">
        <Link
          href={`/partido/${partidoId}`}
          className="inline-flex items-center gap-1.5 text-sm text-mist-600 hover:text-crystal-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Ver partido completo
        </Link>
      </div>
    </div>
  );
}

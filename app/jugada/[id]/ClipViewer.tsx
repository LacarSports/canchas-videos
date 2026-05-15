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

  function handleWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Mirá esta jugada (${etiqueta}): ${clipUrl}`)}`,
      "_blank"
    );
  }

  async function handleInstagram() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Jugada: ${etiqueta}`,
          text: `Mirá esta jugada (${etiqueta})`,
          url: clipUrl,
        });
        return;
      } catch {
        // User cancelled or not supported, fall through
      }
    }
    // Fallback: copy with note
    navigator.clipboard
      .writeText(clipUrl)
      .catch(() => {});
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

        {/* WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-mist-500/15 text-mist-600 hover:text-green-400 hover:border-green-500/30 bg-white/3 hover:bg-green-500/5 transition-all"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </button>

        {/* Instagram */}
        <button
          onClick={handleInstagram}
          className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl border border-mist-500/15 text-mist-600 hover:text-pink-400 hover:border-pink-500/30 bg-white/3 hover:bg-pink-500/5 transition-all"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          Instagram
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

"use client";

import { useState } from "react";

interface ClipDownloaderProps {
  videoUrl: string;
  duracionMinutos: number;
}

export default function ClipDownloader({
  videoUrl,
  duracionMinutos,
}: ClipDownloaderProps) {
  const [inicio, setInicio] = useState(0);
  const [fin, setFin] = useState(Math.min(5, duracionMinutos));
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDescargar() {
    if (inicio >= fin) {
      setError("El minuto de fin debe ser mayor al de inicio");
      return;
    }
    if (fin > duracionMinutos) {
      setError(`El partido dura solo ${duracionMinutos} minutos`);
      return;
    }

    setError(null);
    setDescargando(true);

    try {
      const params = new URLSearchParams({
        url: videoUrl,
        inicio: inicio.toString(),
        fin: fin.toString(),
      });

      const response = await fetch(`/api/clip?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al procesar el clip");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `clip_lacar_sports_min${inicio}-${fin}.mp4`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="bg-lake-800/60 rounded-xl border border-crystal-400/12 p-6">
      <h2 className="text-base font-semibold text-snow mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-crystal-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Descargar clip
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-mist-600 uppercase tracking-wide mb-1.5">
            Minuto de inicio
          </label>
          <input
            type="number"
            min={0}
            max={duracionMinutos - 1}
            value={inicio}
            onChange={(e) => setInicio(Number(e.target.value))}
            className="w-full bg-lake-950/60 border border-lake-700 rounded-lg px-3 py-2 text-snow text-sm focus:outline-none focus:ring-1 focus:ring-crystal-400/40 focus:border-crystal-400/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-mist-600 uppercase tracking-wide mb-1.5">
            Minuto de fin
          </label>
          <input
            type="number"
            min={1}
            max={duracionMinutos}
            value={fin}
            onChange={(e) => setFin(Number(e.target.value))}
            className="w-full bg-lake-950/60 border border-lake-700 rounded-lg px-3 py-2 text-snow text-sm focus:outline-none focus:ring-1 focus:ring-crystal-400/40 focus:border-crystal-400/50"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleDescargar}
        disabled={descargando}
        className="w-full bg-crystal-400 hover:bg-crystal-300 disabled:opacity-50 disabled:cursor-not-allowed text-lake-950 font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        {descargando ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Procesando clip...
          </>
        ) : (
          "Descargar clip"
        )}
      </button>

      <p className="text-xs text-mist-700 mt-3 text-center">
        Duración del partido: {duracionMinutos} minutos
      </p>
    </div>
  );
}

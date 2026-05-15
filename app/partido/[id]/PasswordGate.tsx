"use client";

import { useState } from "react";
import PartidoView from "./PartidoView";

interface Props {
  partidoId: string;
  videoUrl: string;
  title: string;
}

export default function PasswordGate({ partidoId, videoUrl, title }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/video-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partidoId, password }),
      });
      const data = await res.json();
      if (data.ok) {
        setUnlocked(true);
      } else {
        setError("Contraseña incorrecta");
      }
    } catch {
      setError("Error al verificar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (unlocked) {
    return <PartidoView videoUrl={videoUrl} title={title} partidoId={partidoId} />;
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-sm bg-lake-800/60 border border-mist-500/12 rounded-2xl p-8 backdrop-blur-sm space-y-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mx-auto">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-snow">Video privado</h2>
          <p className="text-sm text-mist-600 mt-1">Ingresa la contraseña para acceder</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 text-lake-950 text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Ver video
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import PartidoView from "./PartidoView";

interface Props {
  partidoId: string;
  videoUrl: string;
  title: string;
  deporte?: string | null;
  complejo?: string;
  numeroCancha?: number;
  /** Bloque horario del partido ("10:00 - 11:00"): para mostrar la hora real del video. */
  hora?: string;
}

export default function PasswordGate({ partidoId, videoUrl, title, deporte, complejo, numeroCancha, hora }: Props) {
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
    return <PartidoView videoUrl={videoUrl} title={title} partidoId={partidoId} deporte={deporte} complejo={complejo} numeroCancha={numeroCancha} hora={hora} />;
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-sm bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-[0_16px_40px_rgba(11,29,38,0.08)] space-y-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-soft mx-auto">
          <svg className="w-6 h-6 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink-950">Video privado</h2>
          <p className="text-sm text-ink-500 mt-1">Ingresa la contraseña para acceder</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            className="w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150"
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 rounded-xl disabled:opacity-40 text-base bg-brand hover:bg-brand-hover text-white font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? "Verificando clave…" : "Ver video"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Página a la que llega el enlace de "recuperar contraseña" del correo.
 * Supabase abre este link con una sesión temporal de tipo recovery; aquí el
 * usuario define su nueva contraseña.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError("No pudimos actualizar la contraseña. El enlace puede haber expirado; solicita uno nuevo.");
    } else {
      setDone(true);
      setTimeout(() => router.replace("/"), 2500);
    }
  }

  return (
    <main className="relative min-h-[100dvh] bg-lake-950 flex items-center justify-center px-4 overflow-hidden">
      <div
        className="absolute -top-48 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none animate-water-drift"
        style={{ background: "radial-gradient(circle, #29c4ad, transparent 70%)", filter: "blur(90px)" }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <Image
            src="/logo-small.png"
            alt="Lacar Sports"
            width={38}
            height={38}
            className="drop-shadow-[0_0_12px_rgba(41,196,173,0.5)]"
          />
          <span className="text-xl font-bold text-snow tracking-tight">
            Lacar <span className="text-crystal-400">Sports</span>
          </span>
        </Link>

        <div className="bg-lake-800/60 border border-mist-500/10 rounded-2xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
          {done ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-crystal-400/10 border border-crystal-400/25 mx-auto flex items-center justify-center">
                <svg className="w-6 h-6 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-snow">Contraseña actualizada</h1>
              <p className="text-sm text-mist-600">Ya puedes seguir usando la plataforma. Te llevamos al inicio…</p>
            </div>
          ) : hasSession === false ? (
            <div className="text-center space-y-3">
              <h1 className="text-lg font-bold text-snow">Enlace inválido o expirado</h1>
              <p className="text-sm text-mist-600">
                Solicita un nuevo enlace desde{" "}
                <Link href="/login" className="text-crystal-400 hover:text-crystal-300 underline underline-offset-2">
                  la página de inicio de sesión
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-snow mb-1 tracking-tight">Nueva contraseña</h1>
              <p className="text-sm text-mist-600 mb-6">Elige una contraseña de al menos 6 caracteres</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-mist-600 mb-2">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/50 focus:ring-1 focus:ring-crystal-400/30 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-mist-600 mb-2">
                    Repite la contraseña
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/50 focus:ring-1 focus:ring-crystal-400/30 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 text-lake-950 text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Guardar contraseña
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

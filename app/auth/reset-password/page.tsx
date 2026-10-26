"use client";

import { useState, useEffect } from "react";
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
    <main className="relative min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center px-4 overflow-hidden">

      <div className="relative z-10 w-full max-w-sm">

        <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-[0_16px_40px_rgba(11,29,38,0.08)]">
          {done ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-soft mx-auto flex items-center justify-center">
                <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-ink-950">Contraseña actualizada</h1>
              <p className="text-sm text-ink-500">Ya puedes seguir usando la plataforma. Te llevamos al inicio…</p>
            </div>
          ) : hasSession === false ? (
            <div className="text-center space-y-3">
              <h1 className="text-lg font-bold text-ink-950">Enlace inválido o expirado</h1>
              <p className="text-sm text-ink-500">
                Solicita un nuevo enlace desde{" "}
                <Link href="/login" className="text-brand-ink font-semibold underline underline-offset-2">
                  la página de inicio de sesión
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-ink-950 mb-1 tracking-tight">Nueva contraseña</h1>
              <p className="text-sm text-ink-500 mb-6">Elige una contraseña de al menos 6 caracteres</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
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
                    className="w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
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
                    className="w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-white text-base font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] flex items-center justify-center gap-2"
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

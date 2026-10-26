"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ComplejoLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/auth/complejo/dashboard");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError("Correo o contraseña incorrectos. Verifica tus credenciales.");
      setLoading(false);
    } else {
      router.replace("/auth/complejo/dashboard");
    }
  }

  if (checking) {
    return (
      <div className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center px-4 overflow-hidden">

      <div className="relative z-10 w-full max-w-sm">

        {/* Card */}
        <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-[0_16px_40px_rgba(11,29,38,0.08)]">

          {/* Header */}
          <div className="mb-6">
            <div className="w-11 h-11 rounded-2xl bg-brand text-white flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-ink-950 mb-1 tracking-tight">Mi Complejo</h1>
            <p className="text-sm text-ink-500">
              Ingresa con las credenciales de tu complejo deportivo
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="complejo@ejemplo.com"
                required
                autoComplete="email"
                className="w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-ink-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-[background-color,transform] duration-150 active:scale-[0.97] flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-500 mt-6">
          ¿No tienes acceso?{" "}
          <Link href="/" className="text-brand-ink font-semibold">
            Volver al inicio
          </Link>
        </p>

      </div>
    </main>
  );
}

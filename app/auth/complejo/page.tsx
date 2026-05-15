"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
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
      <div className="min-h-[100dvh] bg-lake-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-lake-950 flex items-center justify-center px-4 overflow-hidden">

      {/* Water ambient blobs */}
      <div
        className="absolute -top-48 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none animate-water-drift"
        style={{ background: "radial-gradient(circle, #29c4ad, transparent 70%)", filter: "blur(90px)" }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[420px] h-[420px] rounded-full pointer-events-none animate-water-drift-slow"
        style={{ background: "radial-gradient(circle, #4daec4, transparent 70%)", filter: "blur(80px)", animationDelay: "-7s" }}
      />

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <Image
            src="/logo.png"
            alt="Lacar Sports"
            width={38}
            height={38}
            className="drop-shadow-[0_0_12px_rgba(41,196,173,0.5)]"
          />
          <span className="text-xl font-bold text-snow tracking-tight">
            Lacar <span className="text-crystal-400">Sports</span>
          </span>
        </a>

        {/* Card */}
        <div className="bg-lake-800/60 border border-mist-500/10 rounded-2xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">

          {/* Header */}
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-crystal-400/10 border border-crystal-400/20 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-snow mb-1 tracking-tight">Mi Complejo</h1>
            <p className="text-sm text-mist-600">
              Ingresa con las credenciales de tu complejo deportivo
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-mist-600 mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="complejo@ejemplo.com"
                required
                autoComplete="email"
                className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/50 focus:ring-1 focus:ring-crystal-400/30 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-mist-600 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/50 focus:ring-1 focus:ring-crystal-400/30 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-crystal-400 hover:bg-crystal-300 disabled:opacity-50 disabled:cursor-not-allowed text-lake-950 font-semibold py-2.5 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_rgba(41,196,173,0.28)] flex items-center justify-center gap-2 mt-2"
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

        <p className="text-center text-xs text-mist-700 mt-6">
          ¿No tienes acceso?{" "}
          <a href="/" className="text-crystal-400/60 hover:text-crystal-400 transition-colors">
            Volver al inicio
          </a>
        </p>

      </div>
    </main>
  );
}

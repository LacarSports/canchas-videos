"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Modo = "login" | "registro" | "recuperar";

const inputCls =
  "w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/50 focus:ring-1 focus:ring-crystal-400/30 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200";
const labelCls = "block text-xs font-semibold uppercase tracking-widest text-mist-600 mb-2";
const linkCls = "text-crystal-400 hover:text-crystal-300 underline underline-offset-2";

function sanitizeNext(raw: string | null): string {
  // Solo rutas internas: evita open-redirects tipo ?next=https://malicioso.com
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const modoInicial = searchParams.get("modo") === "registro" ? "registro" : "login";

  const [modo, setModo] = useState<Modo>(modoInicial);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Si ya hay sesión, ir directo al destino
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next);
      } else {
        setChecking(false);
      }
    });
  }, [router, next]);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError(null);
    setInfo(null);
  }

  async function handleGoogle() {
    setError(null);
    if (modo === "registro" && !aceptaTerminos) {
      setError("Debes aceptar los Términos y Condiciones para continuar.");
      return;
    }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (err) setError("No se pudo iniciar con Google. Intenta con correo y contraseña.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (modo === "recuperar") {
      setLoading(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setLoading(false);
      if (err) setError("No pudimos enviar el correo. Verifica la dirección.");
      else setInfo("Te enviamos un correo con un enlace para crear una nueva contraseña.");
      return;
    }

    if (modo === "registro" && !aceptaTerminos) {
      setError("Debes aceptar los Términos y Condiciones para crear tu cuenta.");
      return;
    }

    setLoading(true);
    if (modo === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError("Correo o contraseña incorrectos.");
        setLoading(false);
      } else {
        router.replace(next);
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${next}`,
          // Guardado en user_metadata; el trigger handle_new_user lo copia a perfiles.nombre
          data: { nombre: nombre.trim() },
        },
      });
      setLoading(false);
      if (err) {
        setError(
          err.message.toLowerCase().includes("already registered")
            ? "Este correo ya tiene una cuenta. Prueba iniciar sesión."
            : "No pudimos crear la cuenta. Revisa el correo y que la contraseña tenga al menos 6 caracteres."
        );
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase no da error con correos ya registrados cuando la confirmación
        // de email está activada: responde un usuario sin identities.
        setError("Este correo ya tiene una cuenta. Prueba iniciar sesión.");
      } else if (data.session) {
        router.replace(next);
      } else {
        setInfo("¡Cuenta creada! Te enviamos un correo para confirmarla. Ábrelo y podrás seguir viendo tu partido.");
      }
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
    <main className="relative min-h-[100dvh] bg-lake-950 flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Water ambient blobs (mismo estilo que /auth/complejo) */}
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
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-snow mb-1 tracking-tight">
              {modo === "login" && "Inicia sesión"}
              {modo === "registro" && "Crea tu cuenta"}
              {modo === "recuperar" && "Recuperar contraseña"}
            </h1>
            <p className="text-sm text-mist-600">
              {modo === "login" && "Entra para ver tus partidos y descargar tus jugadas"}
              {modo === "registro" && "Solo te tomará un momento, y no tendrás que volver a hacerlo"}
              {modo === "recuperar" && "Te enviaremos un enlace a tu correo"}
            </p>
          </div>

          {/* Google */}
          {modo !== "recuperar" && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2.5 bg-snow hover:bg-white text-lake-950 font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98] mb-4"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                Continuar con Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-mist-500/15" />
                <span className="text-[11px] text-mist-700 uppercase tracking-widest">o con tu correo</span>
                <div className="flex-1 h-px bg-mist-500/15" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === "registro" && (
              <div>
                <label className={labelCls}>Nombre y apellido</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Pérez"
                  required
                  autoComplete="name"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>

            {modo !== "recuperar" && (
              <div>
                <label className={labelCls}>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={modo === "registro" ? "new-password" : "current-password"}
                  className={inputCls}
                />
                {modo === "login" && (
                  <button
                    type="button"
                    onClick={() => cambiarModo("recuperar")}
                    className="text-xs text-mist-600 hover:text-crystal-400 mt-2 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
            )}

            {/* Aceptación de T&C (obligatoria para registrarse) */}
            {modo === "registro" && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#29c4ad]"
                />
                <span className="text-xs text-mist-500 leading-relaxed">
                  Acepto los{" "}
                  <a href="/terminos" target="_blank" className={linkCls}>
                    Términos y Condiciones
                  </a>{" "}
                  y la{" "}
                  <a href="/privacidad" target="_blank" className={linkCls}>
                    Política de Privacidad
                  </a>
                  , y declaro tener al menos 14 años (contando con autorización de mis padres o
                  tutores si soy menor de 18).
                </span>
              </label>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-xs text-crystal-300 bg-crystal-400/8 border border-crystal-400/20 rounded-lg px-3 py-2">
                {info}
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
              {modo === "login" && "Iniciar sesión"}
              {modo === "registro" && "Crear cuenta"}
              {modo === "recuperar" && "Enviar enlace"}
            </button>
          </form>

          {/* Cambio de modo */}
          <p className="text-sm text-mist-600 text-center mt-5">
            {modo === "login" && (
              <>
                ¿No tienes cuenta?{" "}
                <button type="button" onClick={() => cambiarModo("registro")} className="text-crystal-400 hover:text-crystal-300 font-semibold transition-colors">
                  Créala aquí
                </button>
              </>
            )}
            {modo === "registro" && (
              <>
                ¿Ya tienes cuenta?{" "}
                <button type="button" onClick={() => cambiarModo("login")} className="text-crystal-400 hover:text-crystal-300 font-semibold transition-colors">
                  Inicia sesión
                </button>
              </>
            )}
            {modo === "recuperar" && (
              <button type="button" onClick={() => cambiarModo("login")} className="text-crystal-400 hover:text-crystal-300 font-semibold transition-colors">
                Volver a iniciar sesión
              </button>
            )}
          </p>

          {/* Nota legal para Google (el registro con Google no pasa por la casilla) */}
          {modo === "login" && (
            <p className="text-[11px] text-mist-700 text-center mt-4 leading-relaxed">
              Al continuar aceptas los{" "}
              <a href="/terminos" target="_blank" className={linkCls}>
                Términos y Condiciones
              </a>{" "}
              y la{" "}
              <a href="/privacidad" target="_blank" className={linkCls}>
                Política de Privacidad
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-lake-950 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

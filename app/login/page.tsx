"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Modo = "login" | "registro" | "recuperar";

const inputCls =
  "w-full bg-white border border-line focus:border-brand focus:ring-2 focus:ring-brand/30 text-ink-950 placeholder-ink-300 rounded-xl px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150";
const labelCls = "block text-[13px] font-semibold text-ink-700 mb-1.5";
const linkCls = "text-brand-ink font-semibold underline underline-offset-2";

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
      <div className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center px-4 py-12 overflow-hidden">

      <div className="relative z-10 w-full max-w-sm">

        <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-[0_16px_40px_rgba(11,29,38,0.08)]">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-ink-950 mb-1 tracking-tight">
              {modo === "login" && "Inicia sesión"}
              {modo === "registro" && "Crea tu cuenta"}
              {modo === "recuperar" && "Recuperar contraseña"}
            </h1>
            <p className="text-sm text-ink-500">
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
                className="w-full flex items-center justify-center gap-2.5 bg-white border border-line hover:border-ink-300 text-ink-950 font-semibold py-3.5 rounded-xl text-base transition-[border-color,transform] duration-150 active:scale-[0.97] mb-4"
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
                <div className="flex-1 h-px bg-line" />
                <span className="text-[11px] text-ink-500 uppercase tracking-widest">o con tu correo</span>
                <div className="flex-1 h-px bg-line" />
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
                    className="text-[13px] text-ink-500 hover:text-brand-ink mt-2 transition-colors"
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
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#2dc9b7]"
                />
                <span className="text-xs text-ink-500 leading-relaxed">
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
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-brand-ink bg-brand-soft rounded-xl px-3 py-2.5">
                {info}
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
              {modo === "login" && "Iniciar sesión"}
              {modo === "registro" && "Crear cuenta"}
              {modo === "recuperar" && "Enviar enlace"}
            </button>
          </form>

          {/* Cambio de modo */}
          <p className="text-sm text-ink-500 text-center mt-5">
            {modo === "login" && (
              <>
                ¿No tienes cuenta?{" "}
                <button type="button" onClick={() => cambiarModo("registro")} className="text-brand-ink font-bold">
                  Créala aquí
                </button>
              </>
            )}
            {modo === "registro" && (
              <>
                ¿Ya tienes cuenta?{" "}
                <button type="button" onClick={() => cambiarModo("login")} className="text-brand-ink font-bold">
                  Inicia sesión
                </button>
              </>
            )}
            {modo === "recuperar" && (
              <button type="button" onClick={() => cambiarModo("login")} className="text-brand-ink font-bold">
                Volver a iniciar sesión
              </button>
            )}
          </p>

          {/* Nota legal para Google (el registro con Google no pasa por la casilla) */}
          {modo === "login" && (
            <p className="text-[11px] text-ink-500 text-center mt-4 leading-relaxed">
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
        <div className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-surface flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

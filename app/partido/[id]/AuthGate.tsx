"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";

/**
 * Exige sesión iniciada para ver el contenido de un partido.
 * Buscar y navegar es libre; ver el video requiere cuenta (identificación de
 * usuarios exigida por los T&C / Ley 21.719). Tras iniciar sesión o crear la
 * cuenta se vuelve automáticamente a esta misma página (?next=).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname() ?? "/";
  const next = encodeURIComponent(pathname);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-ink-500">Abriendo partido…</p>
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md bg-white border border-line rounded-3xl p-6 sm:p-8 shadow-[0_16px_40px_rgba(11,29,38,0.08)] space-y-5 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand mx-auto">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-950">Crea tu cuenta para ver el partido</h2>
          <p className="text-sm text-ink-500 mt-1.5 leading-relaxed text-justify [text-align-last:center] hyphens-auto">
            Solo te tomará un momento y no tendrás que volver a hacerlo. Con tu cuenta puedes ver
            el partido completo, marcar tus jugadas y descargar tus clips.
          </p>
        </div>
        <div className="space-y-2.5">
          <Link
            href={`/login?modo=registro&next=${next}`}
            className="block w-full py-3.5 rounded-xl text-base bg-brand hover:bg-brand-hover text-white font-bold transition-[background-color,transform] duration-150 active:scale-[0.97]"
          >
            Crear cuenta
          </Link>
          <Link
            href={`/login?next=${next}`}
            className="block w-full py-3.5 rounded-xl border border-line text-ink-700 hover:border-ink-300 text-base font-semibold transition-[border-color,transform] duration-150 active:scale-[0.97]"
          >
            Ya tengo cuenta, iniciar sesión
          </Link>
        </div>
        <p className="text-[11px] text-ink-500 leading-relaxed text-justify [text-align-last:center] hyphens-auto">
          Pedimos una cuenta para proteger a quienes aparecen en los videos, conforme a nuestros{" "}
          <a href="/terminos" target="_blank" className="text-brand-ink font-semibold underline underline-offset-2">
            Términos y Condiciones
          </a>
          .
        </p>
      </div>
    </div>
  );
}

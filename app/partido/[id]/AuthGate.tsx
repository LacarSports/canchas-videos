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
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md bg-lake-800/60 border border-crystal-400/15 rounded-2xl p-8 backdrop-blur-sm space-y-5 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-crystal-400/10 border border-crystal-400/25 mx-auto">
          <svg className="w-6 h-6 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-snow">Crea tu cuenta para ver el partido</h2>
          <p className="text-sm text-mist-600 mt-1.5 leading-relaxed">
            Solo te tomará un momento y no tendrás que volver a hacerlo. Con tu cuenta puedes ver
            el partido completo, marcar tus jugadas y descargar tus clips.
          </p>
        </div>
        <div className="space-y-2.5">
          <Link
            href={`/login?modo=registro&next=${next}`}
            className="block w-full py-2.5 rounded-xl bg-crystal-400 hover:bg-crystal-300 text-lake-950 text-sm font-semibold transition-all active:scale-[0.98]"
          >
            Crear cuenta
          </Link>
          <Link
            href={`/login?next=${next}`}
            className="block w-full py-2.5 rounded-xl border border-mist-500/20 text-mist-400 hover:text-snow hover:border-mist-500/40 text-sm font-medium transition-all"
          >
            Ya tengo cuenta — Iniciar sesión
          </Link>
        </div>
        <p className="text-[11px] text-mist-700 leading-relaxed">
          Pedimos una cuenta para proteger a quienes aparecen en los videos, conforme a nuestros{" "}
          <a href="/terminos" target="_blank" className="text-crystal-400/80 hover:text-crystal-300 underline underline-offset-2">
            Términos y Condiciones
          </a>
          .
        </p>
      </div>
    </div>
  );
}

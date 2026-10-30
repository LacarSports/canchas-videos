"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";

/**
 * Exige sesión iniciada para ver el contenido de un partido.
 * Buscar y navegar es libre; ver el video requiere cuenta (identificación de
 * usuarios exigida por los T&C / Ley 21.719). Sin sesión se va directo a crear la
 * cuenta y, al terminar, se vuelve automáticamente a esta misma página (?next=).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/login?modo=registro&next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, session, pathname, router]);

  if (session) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-ink-500">Abriendo partido…</p>
    </div>
  );
}

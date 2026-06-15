"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { smoothScrollTo } from "@/lib/smoothScroll";

// Altura aprox. del navbar fijo (coincide con --scroll-padding-top en CSS).
const NAV_OFFSET = 88;

type NavLink = { href: string; label: string };

const PLAYER_LINKS: NavLink[] = [
  { href: "/#buscador", label: "Buscar Partido" },
  { href: "/#como-funciona", label: "Cómo Funciona" },
  { href: "/complejos", label: "Para Complejos" },
];

const OWNER_LINKS: NavLink[] = [
  { href: "/complejos#beneficios", label: "Beneficios" },
  { href: "/complejos#como-funciona", label: "Cómo Funciona" },
  { href: "/complejos#faq", label: "Preguntas" },
  { href: "/", label: "Para Jugadores" },
];

/**
 * Renderiza un <a> para anclas (#) — y un <Link> de Next para cambios de ruta
 * (prefetch + transición client-side).
 *
 * Para las anclas: si ya estás en la página destino, interceptamos el clic y
 * hacemos un scroll suave directo a la sección (sin el salto "arriba y luego
 * abajo" que provoca la navegación nativa cuando hay query params en la URL).
 * Si estás en otra página, dejamos la navegación nativa (va a la página + hash).
 */
function NavItem({
  href,
  pathname,
  className,
  onClick,
  children,
}: {
  href: string;
  pathname: string;
  className: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (href.includes("#")) {
    const [path, hash] = href.split("#");
    const targetPath = path === "" ? pathname : path;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (hash && targetPath === pathname) {
        const el = document.getElementById(hash);
        if (el) {
          e.preventDefault();
          const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
          smoothScrollTo(y);
          window.history.replaceState(null, "", `#${hash}`);
        }
      }
      onClick?.();
    };

    return (
      <a href={href} className={className} onClick={handleClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  const isOwners = pathname.startsWith("/complejos");
  const links = isOwners ? OWNER_LINKS : PLAYER_LINKS;
  const cta: NavLink = isOwners
    ? { href: "/auth/complejo", label: "Mi panel" }
    : { href: "/#buscador", label: "Buscar partido" };

  // Scroll-spy: para los links de sección de la página actual, indica si la
  // sección está arriba/abajo del scroll (flecha que rota al pasarla) y cuál
  // se está viendo ahora (estado activo).
  const [spy, setSpy] = useState<{ active: string | null; dirs: Record<string, "up" | "down"> }>({
    active: null,
    dirs: {},
  });

  useEffect(() => {
    const hashes = links
      .filter((l) => {
        const [path, hash] = l.href.split("#");
        const targetPath = path === "" ? pathname : path;
        return l.href.includes("#") && targetPath === pathname && hash;
      })
      .map((l) => l.href.split("#")[1]);

    if (hashes.length === 0) {
      setSpy({ active: null, dirs: {} });
      return;
    }

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const anchor = window.scrollY + NAV_OFFSET + 1;
        const dirs: Record<string, "up" | "down"> = {};
        let active: string | null = null;
        let activeTop = -Infinity;
        for (const hash of hashes) {
          const el = document.getElementById(hash);
          if (!el) continue;
          const top = el.getBoundingClientRect().top + window.scrollY;
          const bottom = top + el.offsetHeight;
          dirs[hash] = anchor >= top ? "up" : "down";
          if (anchor >= top && anchor < bottom && top > activeTop) {
            active = hash;
            activeTop = top;
          }
        }
        // Evita re-renders innecesarios: solo actualiza si algo cambió.
        setSpy((prev) => {
          const sameDirs =
            Object.keys(dirs).length === Object.keys(prev.dirs).length &&
            Object.keys(dirs).every((k) => prev.dirs[k] === dirs[k]);
          if (prev.active === active && sameDirs) return prev;
          return { active, dirs };
        });
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, [links, pathname]);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-lake-900 border border-mist-500/10 rounded-full px-5 h-14 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo-small.png"
              alt="Lacar Sports"
              width={32}
              height={32}
              className="drop-shadow-[0_0_8px_rgba(41,196,173,0.5)]"
              priority
            />
            <span className="text-[15px] font-bold tracking-tight text-snow">
              Lacar <span className="text-crystal-400">Sports</span>
            </span>
          </Link>

          {/* Desktop links — los enlaces in-page (#) van en gris; los que
              saltan a la otra sección (Para Complejos / Para Jugadores) en
              acento crystal con flecha. */}
          <nav className="hidden md:flex items-center gap-0.5">
            {links.map(({ href, label }) => {
              const isCross = !href.includes("#");
              const hash = href.includes("#") ? href.split("#")[1] : null;
              const dir = hash ? spy.dirs[hash] : undefined;
              const isActive = hash != null && spy.active === hash;
              const className = isCross
                ? "flex items-center gap-1 px-3.5 py-1.5 text-[13px] font-semibold text-crystal-300 hover:text-crystal-200 hover:bg-crystal-400/10 rounded-full border border-transparent transition-all duration-200"
                : isActive
                ? "flex items-center gap-1 px-3.5 py-1.5 text-[13px] font-semibold text-crystal-300 bg-crystal-400/12 border border-crystal-400/20 rounded-full transition-all duration-200"
                : "flex items-center gap-1 px-3.5 py-1.5 text-[13px] font-medium text-mist-500 hover:text-snow hover:bg-white/5 rounded-full border border-transparent transition-all duration-200";
              return (
                <NavItem key={href} href={href} pathname={pathname} className={className}>
                  {label}
                  {isCross ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  ) : dir ? (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ transform: dir === "up" ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : null}
                </NavItem>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <NavItem
            href={cta.href}
            pathname={pathname}
            className="hidden md:inline-flex items-center gap-1.5 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-semibold text-[13px] px-4 py-2 rounded-full transition-all duration-200 active:scale-[0.97] shadow-[0_0_16px_rgba(41,196,173,0.35)]"
          >
            {cta.label}
          </NavItem>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-mist-500 hover:text-snow transition-colors rounded-full"
            onPointerDown={() => setIsOpen((v) => !v)}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown */}
        {isOpen && (
          <div className="mt-2 bg-lake-900 border border-mist-500/10 rounded-2xl p-2 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
            {links.map(({ href, label }) => {
              const isCross = !href.includes("#");
              const hash = href.includes("#") ? href.split("#")[1] : null;
              const dir = hash ? spy.dirs[hash] : undefined;
              const isActive = hash != null && spy.active === hash;
              const className = isCross
                ? "flex items-center gap-1.5 px-4 py-3.5 text-[14px] font-semibold text-crystal-300 hover:text-crystal-200 hover:bg-crystal-400/10 rounded-xl transition-all duration-200"
                : isActive
                ? "flex items-center gap-1.5 px-4 py-3.5 text-[14px] font-semibold text-crystal-300 bg-crystal-400/12 border border-crystal-400/20 rounded-xl transition-all duration-200"
                : "flex items-center gap-1.5 px-4 py-3.5 text-[14px] font-medium text-mist-400 hover:text-snow hover:bg-white/5 rounded-xl transition-all duration-200";
              return (
                <NavItem
                  key={href}
                  href={href}
                  pathname={pathname}
                  onClick={() => setIsOpen(false)}
                  className={className}
                >
                  {label}
                  {isCross ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  ) : dir ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ transform: dir === "up" ? "rotate(180deg)" : "none", transition: "transform 0.3s ease" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : null}
                </NavItem>
              );
            })}
            <div className="mt-1 pt-2 border-t border-mist-500/10 px-1">
              <NavItem
                href={cta.href}
                pathname={pathname}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-semibold text-[13px] px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.97]"
              >
                {cta.label}
              </NavItem>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

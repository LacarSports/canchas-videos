"use client";

import { useState } from "react";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/#buscador",      label: "Mi Partido"    },
  { href: "/auth/complejo",  label: "Mi Complejo"   },
  { href: "/#como-funciona", label: "Cómo Funciona" },
  { href: "/faq",            label: "FAQ"           },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="bg-lake-900 border border-mist-500/10 rounded-full px-5 h-14 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
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
          </a>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3.5 py-1.5 text-[13px] font-medium text-mist-500 hover:text-snow hover:bg-white/5 rounded-full transition-all duration-200"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <a
            href="/#buscador"
            className="hidden md:inline-flex items-center gap-1.5 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-semibold text-[13px] px-4 py-2 rounded-full transition-all duration-200 active:scale-[0.97] shadow-[0_0_16px_rgba(41,196,173,0.35)]"
          >
            Buscar partido
          </a>

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
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="flex items-center px-4 py-3.5 text-[14px] font-medium text-mist-400 hover:text-snow hover:bg-white/5 rounded-xl transition-all duration-200"
              >
                {label}
              </a>
            ))}
            <div className="mt-1 pt-2 border-t border-mist-500/10 px-1">
              <a
                href="/#buscador"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-semibold text-[13px] px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.97]"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar partido
              </a>
            </div>
          </div>
        )}

      </div>
    </header>
  );
}

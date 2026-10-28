import Image from "next/image";

const SOCIALS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/lacarsports.cl/",
    color: "hover:text-[#d62976] hover:border-[#d62976]/30",
    icon: (
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    ),
  },
];

const LEGALES = [
  {
    href: "/terminos",
    titulo: "Términos y Condiciones",
    texto: "Reglas de uso del servicio y de tus videos.",
    icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5" />,
  },
  {
    href: "/privacidad",
    titulo: "Política de Privacidad",
    texto: "Qué datos guardamos y cómo los cuidamos.",
    icono: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zm-3 9l2 2 4-4" />,
  },
];

/** Dos tarjetas a Términos y Privacidad, justo antes del pie de página. */
function TarjetasLegales() {
  return (
    <section aria-label="Información legal" className="bg-white px-5 sm:px-6 pb-10 sm:pb-14">
      <div className="max-w-6xl mx-auto grid sm:grid-cols-2 gap-3 sm:gap-4">
        {LEGALES.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="group flex items-center gap-4 rounded-2xl bg-white border border-line/70 px-5 py-4 shadow-[0_10px_30px_-14px_rgba(11,29,38,0.22)] transition-[border-color,transform] duration-150 hover:border-brand/50 active:scale-[0.98]"
          >
            <span className="shrink-0 w-11 h-11 rounded-xl bg-brand-soft text-brand-ink flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {l.icono}
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold text-ink-950">{l.titulo}</span>
              <span className="block text-[13px] text-ink-500 leading-snug mt-0.5">{l.texto}</span>
            </span>
            <svg
              className="shrink-0 w-5 h-5 text-brand transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function Footer({ tarjetasLegales = true }: { tarjetasLegales?: boolean }) {
  return (
    <>
    {tarjetasLegales && <TarjetasLegales />}
    <footer className="relative bg-white border-t border-line px-6 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-7xl mx-auto relative flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo + copy */}
        <a href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-small.png"
            alt="Lacar Sports"
            width={28}
            height={28}
          />
          <span className="text-sm text-ink-500">
            © 2026{" "}
            <span className="text-ink-950 font-semibold">Lacar Sports</span>.
            Todos los derechos reservados.
          </span>
        </a>

        {/* Legal links */}
        <nav className="flex items-center gap-5 text-xs">
          <a href="/terminos" className="text-ink-500 hover:text-ink-950 transition-colors duration-200">
            Términos y Condiciones
          </a>
          <a href="/privacidad" className="text-ink-500 hover:text-ink-950 transition-colors duration-200">
            Política de Privacidad
          </a>
        </nav>

        {/* Social links */}
        <div className="flex items-center gap-2">
          {SOCIALS.map(({ name, href, icon, color }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} de Lacar Sports`}
              className={`w-10 h-10 rounded-xl bg-surface border border-line flex items-center justify-center text-ink-500 transition-all duration-200 ${color}`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                {icon}
              </svg>
            </a>
          ))}
        </div>
      </div>
    </footer>
    </>
  );
}

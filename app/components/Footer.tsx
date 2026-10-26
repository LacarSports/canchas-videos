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

export default function Footer() {
  return (
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
  );
}

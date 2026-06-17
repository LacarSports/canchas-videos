import Image from "next/image";

const SOCIALS = [
  {
    name: "Instagram",
    color: "hover:text-pink-400 hover:border-pink-400/30",
    icon: (
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    ),
  },
  {
    name: "YouTube",
    color: "hover:text-red-400 hover:border-red-400/30",
    icon: (
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    ),
  },
  {
    name: "TikTok",
    color: "hover:text-crystal-400 hover:border-crystal-400/30",
    icon: (
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    ),
  },
];

export default function Footer() {
  return (
    <footer className="relative bg-lake-950 px-6 pt-10 pb-8 overflow-hidden">
      {/* Top gradient bar */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(41,196,173,0.4), rgba(77,174,196,0.3), transparent)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(41,196,173,0.04), transparent)",
        }}
      />
      <div className="max-w-7xl mx-auto relative flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo + copy */}
        <a href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-small.png"
            alt="Lacar Sports"
            width={28}
            height={28}
            className="drop-shadow-[0_0_8px_rgba(41,196,173,0.5)]"
          />
          <span className="text-sm text-mist-600">
            © 2026{" "}
            <span className="text-mist-400 font-medium">Lacar Sports</span>.
            Todos los derechos reservados.
          </span>
        </a>

        {/* Legal links */}
        <nav className="flex items-center gap-5 text-xs">
          <a href="/terminos" className="text-mist-600 hover:text-snow transition-colors duration-200">
            Términos y Condiciones
          </a>
          <a href="/privacidad" className="text-mist-600 hover:text-snow transition-colors duration-200">
            Política de Privacidad
          </a>
        </nav>

        {/* Social links */}
        <div className="flex items-center gap-2">
          {SOCIALS.map(({ name, icon, color }) => (
            <a
              key={name}
              href="#"
              aria-label={name}
              className={`w-9 h-9 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-mist-700 transition-all duration-200 ${color}`}
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

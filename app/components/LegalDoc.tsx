import type { ReactNode } from "react";
import Footer from "./Footer";

interface Section {
  heading: string;
  body: ReactNode;
}

/**
 * Plantilla para páginas legales (Términos, Privacidad).
 * Mantiene el estilo de marca: fondo oscuro, texto claro, headings crystal.
 */
export default function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  sections: Section[];
}) {
  return (
    <main className="min-h-[100dvh] bg-lake-950">
      <div className="relative px-6 py-16 sm:py-20 overflow-hidden">
        {/* Glow sutil arriba */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(41,196,173,0.07), transparent)" }}
        />

        <article className="max-w-3xl mx-auto relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400 mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight">{title}</h1>
          <p className="text-mist-700 text-xs mt-3">Última actualización: {updated}</p>
          <div
            className="w-12 h-0.5 mt-4 mb-8 rounded-full"
            style={{ background: "linear-gradient(90deg, #29c4ad, transparent)" }}
          />

          {intro && (
            <p className="text-mist-400 text-sm leading-relaxed mb-2">{intro}</p>
          )}

          {sections.map((s, i) => (
            <section key={s.heading} className="mt-9">
              <h2 className="text-lg font-bold text-crystal-400 mb-3">
                {i + 1}. {s.heading}
              </h2>
              <div className="space-y-3 text-mist-400 text-sm leading-relaxed">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>

      <Footer />
    </main>
  );
}

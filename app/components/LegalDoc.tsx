import type { ReactNode } from "react";
import Footer from "./Footer";

interface Section {
  heading: string;
  body: ReactNode;
}

/**
 * Plantilla para páginas legales (Términos, Privacidad).
 * Mismo estilo claro que el resto de la web: fondo blanco, texto oscuro, acento turquesa.
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
    <main className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-white text-ink-950">
      <div className="px-5 sm:px-6 py-14 sm:py-20">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-ink mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink-950 tracking-tight">{title}</h1>
          <p className="text-ink-500 text-sm mt-3">Última actualización: {updated}</p>
          <div className="w-12 h-1 mt-5 mb-8 rounded-full bg-brand" />

          {intro && (
            <p className="text-ink-700 text-[15px] leading-relaxed mb-2">{intro}</p>
          )}

          {sections.map((s, i) => (
            <section key={s.heading} className="mt-10 pt-8 border-t border-line first-of-type:border-t-0 first-of-type:pt-0">
              <h2 className="text-lg sm:text-xl font-bold text-ink-950 mb-3">
                <span className="text-brand-ink">{i + 1}.</span> {s.heading}
              </h2>
              <div className="space-y-3 text-ink-700 text-[15px] leading-relaxed">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </div>

      <Footer tarjetasLegales={false} />
    </main>
  );
}

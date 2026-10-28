/**
 * Encabezado de sección de las páginas públicas: etiqueta corta, título y
 * bajada. Un solo estilo para todo el sitio.
 */
export default function SectionHeader({
  eyebrow,
  title,
  description,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink mb-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="text-[28px] sm:text-4xl font-bold text-ink-950 tracking-tight leading-[1.1] text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-ink-500 text-base mt-2.5 max-w-[52ch] leading-relaxed text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}

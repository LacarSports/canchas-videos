/**
 * Encabezado de sección de las páginas públicas: etiqueta corta, título y
 * bajada. Un solo estilo para todo el sitio (antes cada sección tenía su
 * ícono, color y línea decorativa propios).
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-crystal-400 mb-3">
        {eyebrow}
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-mist-400 text-base mt-3 max-w-[52ch] leading-relaxed text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}

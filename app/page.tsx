import Image from "next/image";
import { supabase } from "@/lib/supabase";
import SearchFilters from "./components/SearchFilters";
import StatsCounter from "./components/StatsCounter";
import PartidoCard from "./components/PartidoCard";

interface Partido {
  id: string;
  complejo: string;
  numero_cancha: number;
  ciudad: string;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  archivo_url: string;
}

interface SearchParams {
  complejo?: string;
  deporte?: string;
  cancha?: string;
  fecha?: string;
  hora?: string;
}


function buildVideoUrl(archivoUrl: string) {
  if (archivoUrl.startsWith("http")) return archivoUrl;
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return `${base}/${archivoUrl}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { complejo, deporte, cancha, fecha, hora } = await searchParams;

  const hasSearch = !!(complejo && cancha && fecha && hora);

  let partidos: Partido[] | null = null;
  if (hasSearch) {
    let query = supabase
      .from("partidos")
      .select("*")
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false });

    if (complejo) query = query.ilike("complejo", `%${complejo}%`);
    if (deporte)  query = query.eq("deporte", deporte);
    if (cancha)   query = query.eq("numero_cancha", parseInt(cancha));
    if (fecha)    query = query.eq("fecha", fecha);
    if (hora)     query = query.eq("hora", hora);

    const { data } = await query;
    partidos = data;
  }

  return (
    <main className="min-h-[100dvh] bg-lake-950">

      {/* ══════════════════════════════════════════════ */}
      {/* HERO — split screen asimétrico                */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center">

        {/* Foto de fondo */}
        <Image
          src="/hero.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        {/* Capas de overlay — legibilidad + mood */}
        <div className="absolute inset-0 bg-lake-950/70 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-lake-950/95 via-lake-950/60 to-lake-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-lake-950/80 via-transparent to-lake-950/30 pointer-events-none" />

        {/* Blobs de color — clipeados en su propio contenedor para no afectar iOS touch */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full animate-water-drift"
            style={{ background: "radial-gradient(circle, rgba(41,196,173,0.22), transparent 70%)", filter: "blur(80px)" }}
          />
          <div
            className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full animate-water-drift-slow"
            style={{ background: "radial-gradient(circle, rgba(77,174,196,0.15), transparent 70%)", filter: "blur(72px)", animationDelay: "-8s" }}
          />
          <div
            className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(41,196,173,0.08), transparent 70%)", filter: "blur(60px)" }}
          />
        </div>

        {/* Content grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full py-28 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-16 items-center">

          {/* ── Left — copy ── */}
          <div>
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[0.95] mb-6 animate-slide-up"
              style={{ animationDelay: "0.08s" }}
            >
              <span className="text-white" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 0px 40px rgba(0,0,0,0.5)" }}>Tu partido,</span>
              <br />
              <span
                className="text-crystal-400"
                style={{ textShadow: "0 0 50px rgba(41,196,173,0.6), 0 2px 20px rgba(0,0,0,0.9)" }}
              >
                tu momento.
              </span>
            </h1>

            {/* Descripción con fondo glassmorphism para legibilidad */}
            <p
              className="text-base text-white/90 mb-10 leading-relaxed max-w-[44ch] animate-slide-up px-4 py-3 rounded-xl backdrop-blur-md"
              style={{
                animationDelay: "0.16s",
                background: "rgba(9,21,32,0.55)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              Busca tu partido por complejo, cancha y fecha. Revívelo completo,
              etiqueta las jugadas y descarga los clips que quieras.
            </p>

            <div
              className="flex flex-wrap items-center gap-4 animate-slide-up"
              style={{ animationDelay: "0.24s" }}
            >
              {/* Botón glass — no compite con la foto */}
              <a
                href="#buscador"
                className="inline-flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-sm text-white transition-all duration-200 active:scale-[0.98] backdrop-blur-md"
                style={{
                  background: "rgba(41,196,173,0.85)",
                  boxShadow: "0 0 32px rgba(41,196,173,0.45), 0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                  border: "1px solid rgba(41,196,173,0.6)",
                }}
              >
                Buscar mi partido
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── Right — floating card mockup ── */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative animate-float">
              {/* Glow halo */}
              <div
                className="absolute -inset-8 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(41,196,173,0.22), transparent 70%)", filter: "blur(28px)" }}
              />

              {/* Card */}
              <div className="relative bg-lake-900/80 border border-crystal-400/20 rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl w-[340px]">

                {/* Video area */}
                <div className="aspect-video relative overflow-hidden flex items-center justify-center">

                  {/* Thumbnail real del partido */}
                  <Image
                    src="/thumbnail.png"
                    alt="Partido de fútbol"
                    fill
                    className="object-cover object-center"
                    sizes="340px"
                    priority
                  />

                  {/* Overlay: oscurece levemente para que los badges sean legibles */}
                  <div className="absolute inset-0 bg-lake-950/40" />
                  {/* Viñeta inferior para el fade hacia la card info */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-lake-900/90 to-transparent" />

                  {/* Play */}
                  <div className="relative z-10 w-14 h-14 rounded-full bg-black/40 border border-white/30 flex items-center justify-center backdrop-blur-sm shadow-[0_0_24px_rgba(0,0,0,0.5)]">
                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>

                  {/* Grabando badge */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-lake-950/70 border border-crystal-400/30 text-crystal-300 text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-crystal-400 animate-pulse" />
                    Grabando
                  </div>

                  {/* Duración */}
                  <span className="absolute bottom-2.5 right-2.5 z-10 text-[11px] font-mono text-white/80 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    60:01
                  </span>
                </div>

                {/* Card info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-snow font-semibold text-sm truncate">Complejo Lacar Norte</p>
                      <p className="text-mist-700 text-xs mt-0.5">Santiago</p>
                    </div>
                    <span className="shrink-0 bg-crystal-400/10 text-crystal-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-crystal-400/20">
                      Cancha 3
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-mist-700">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-mist-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Hoy · 20:00
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-mist-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      60 min
                    </span>
                  </div>
                </div>
              </div>

              {/* Mini card flotante decorativa */}
              <div
                className="absolute -bottom-6 -right-8 bg-lake-800/80 border border-mist-500/10 rounded-xl px-4 py-3 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-float"
                style={{ animationDelay: "-3.5s" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-crystal-400/15 border border-crystal-400/25 flex items-center justify-center">
                    <svg className="w-4 h-4 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-snow text-xs font-semibold">Gol guardado</p>
                    <p className="text-mist-600 text-[10px]">Clip de 12 seg</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-mist-700 animate-bounce">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* STATS — deshabilitado temporalmente           */}
      {/* Descomentar cuando tengamos datos reales      */}
      {/* ══════════════════════════════════════════════ */}
      {/*
      <section className="relative py-14 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f35 50%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(41,196,173,0.07), transparent)" }} />
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { value: 1240, label: "Partidos grabados",   suffix: "+", glow: "rgba(41,196,173,0.18)",  border: "border-crystal-400/20", numColor: "text-crystal-400",  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /> },
              { value: 8500, label: "Jugadas compartidas", suffix: "+", glow: "rgba(77,174,196,0.18)",  border: "border-glacial-400/20", numColor: "text-glacial-400", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> },
              { value: 12,   label: "Complejos activos",   suffix: "",  glow: "rgba(251,191,36,0.14)", border: "border-amber-400/20",   numColor: "text-amber-400",   icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" /> },
            ].map((stat) => (
              <div key={stat.label} className={`relative bg-lake-900/70 backdrop-blur-sm border ${stat.border} rounded-2xl p-7 flex items-center gap-5 overflow-hidden`}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 80% at 10% 50%, ${stat.glow}, transparent)` }} />
                <div className={`shrink-0 w-11 h-11 rounded-xl bg-lake-800/80 border ${stat.border} flex items-center justify-center`}>
                  <svg className={`w-5 h-5 ${stat.numColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{stat.icon}</svg>
                </div>
                <div>
                  <StatsCounter value={stat.value} label="" suffix={stat.suffix} numClassName={`text-3xl font-bold tracking-tight ${stat.numColor}`} />
                  <p className="text-mist-500 text-xs mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* ══════════════════════════════════════════════ */}
      {/* BUSCADOR                                       */}
      {/* ══════════════════════════════════════════════ */}
      <section id="buscador" className="relative z-10 py-20 px-6" style={{ background: "linear-gradient(160deg, #091520 0%, #0c1e33 55%, #091520 100%)" }}>
        {/* Decorativos clipeados independientemente para no afectar dropdowns */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Patrón de puntos */}
          <div className="absolute inset-0 opacity-[0.035]" style={{
            backgroundImage: "radial-gradient(circle, #7ec8c8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
          {/* Glows dinámicos */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px]" style={{ background: "radial-gradient(circle, rgba(41,196,173,0.07), transparent 70%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px]" style={{ background: "radial-gradient(circle, rgba(77,174,196,0.05), transparent 70%)" }} />
        </div>
        <div className="max-w-7xl mx-auto relative">

          {/* Section header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-crystal-400/15 border border-crystal-400/25 flex items-center justify-center">
                <svg className="w-4 h-4 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400">Búsqueda</p>
            </div>
            <h2 className="text-3xl font-bold text-snow tracking-tight mb-1">
              Encuentra tu partido
            </h2>
            <div className="w-12 h-0.5 mt-3 mb-4 rounded-full" style={{ background: "linear-gradient(90deg, #29c4ad, transparent)" }} />
            <p className="text-mist-500 text-sm">
              Filtra por complejo, número de cancha y fecha.
            </p>
          </div>

          <SearchFilters />

          {!hasSearch ? null : partidos && partidos.length > 0 ? (
            <div className="mt-10 flex flex-col gap-1.5">
              {partidos.map((partido: Partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={{
                    ...partido,
                    videoUrl: partido.archivo_url ? buildVideoUrl(partido.archivo_url) : null,
                  }}
                />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="mt-16 flex flex-col items-center text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-crystal-400/8 border border-crystal-400/15 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-crystal-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-base font-medium text-mist-500 mb-1">
                No se encontraron partidos
              </p>
              <p className="text-sm text-mist-700">
                Intenta ajustar los filtros de búsqueda
              </p>
            </div>
          )}
        </div>
      </section>


      {/* ══════════════════════════════════════════════ */}
      {/* CÓMO FUNCIONA                                  */}
      {/* ══════════════════════════════════════════════ */}
      <section id="como-funciona" className="relative py-20 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #091520 0%, #0e2035 50%, #091520 100%)" }}>
        {/* Patrón diagonal */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(45deg, rgba(41,196,173,1) 1px, transparent 1px), linear-gradient(-45deg, rgba(41,196,173,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(41,196,173,0.05), transparent)" }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(77,174,196,0.06), transparent 70%)" }} />
        <div className="max-w-5xl mx-auto relative">

          <div className="mb-14">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Proceso</p>
            </div>
            <h2 className="text-3xl font-bold text-snow tracking-tight mb-1">
              Cómo funciona
            </h2>
            <div className="w-12 h-0.5 mt-3 mb-4 rounded-full" style={{ background: "linear-gradient(90deg, #fbbf24, transparent)" }} />
            <p className="text-mist-500 text-sm max-w-md">
              En tres pasos revives y guardas los mejores momentos de tu partido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                num: "01",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
                titulo: "Busca tu partido",
                descripcion: "Filtra por complejo, cancha y fecha. Encontramos el video de tu partido en segundos.",
                glow: "rgba(41,196,173,0.12)",
                borderColor: "rgba(41,196,173,0.22)",
                iconBg: "rgba(41,196,173,0.12)",
                iconColor: "text-crystal-400",
                numColor: "rgba(41,196,173,0.12)",
                label: "text-crystal-400",
              },
              {
                num: "02",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
                titulo: "Elige el momento",
                descripcion: "Reproduce el video completo y marca el inicio y fin de la jugada que quieres guardar.",
                glow: "rgba(77,174,196,0.12)",
                borderColor: "rgba(77,174,196,0.22)",
                iconBg: "rgba(77,174,196,0.12)",
                iconColor: "text-glacial-400",
                numColor: "rgba(77,174,196,0.12)",
                label: "text-glacial-400",
              },
              {
                num: "03",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
                titulo: "Descarga tu clip",
                descripcion: "El clip se procesa directo en tu navegador y se descarga listo para compartir.",
                glow: "rgba(251,191,36,0.10)",
                borderColor: "rgba(251,191,36,0.22)",
                iconBg: "rgba(251,191,36,0.10)",
                iconColor: "text-amber-400",
                numColor: "rgba(251,191,36,0.10)",
                label: "text-amber-400",
              },
            ].map((paso) => (
              <div
                key={paso.num}
                className="relative rounded-2xl p-7 overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${paso.glow} 0%, rgba(9,21,32,0.8) 100%)`,
                  border: `1px solid ${paso.borderColor}`,
                }}
              >
                {/* Radial glow corner */}
                <div className="absolute -top-4 -right-4 w-32 h-32 pointer-events-none rounded-full" style={{ background: `radial-gradient(circle, ${paso.glow.replace('0.12','0.25').replace('0.10','0.20')}, transparent 70%)`, filter: "blur(16px)" }} />
                {/* Big number background */}
                <div
                  className="absolute -top-2 -right-2 text-[90px] font-black leading-none select-none pointer-events-none"
                  style={{ color: paso.numColor, fontVariantNumeric: "tabular-nums" }}
                >
                  {paso.num}
                </div>
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: paso.iconBg, border: `1px solid ${paso.borderColor}` }}>
                  <svg className={`w-5 h-5 ${paso.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {paso.icon}
                  </svg>
                </div>
                <h3 className="text-snow font-bold text-base mb-2">{paso.titulo}</h3>
                <p className="text-mist-500 text-sm leading-relaxed">{paso.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* FOOTER                                         */}
      {/* ══════════════════════════════════════════════ */}
      <footer className="relative bg-lake-950 px-6 pt-10 pb-8 overflow-hidden">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(41,196,173,0.4), rgba(77,174,196,0.3), transparent)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(41,196,173,0.04), transparent)" }} />
        <div className="max-w-7xl mx-auto relative flex flex-col sm:flex-row items-center justify-between gap-6">

          {/* Logo + copy */}
          <a href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Lacar Sports"
              width={28}
              height={28}
              className="drop-shadow-[0_0_8px_rgba(41,196,173,0.5)]"
            />
            <span className="text-sm text-mist-600">
              © 2026 <span className="text-mist-400 font-medium">Lacar Sports</span>. Todos los derechos reservados.
            </span>
          </a>

          {/* Social links */}
          <div className="flex items-center gap-2">
            {[
              {
                name: "Instagram",
                color: "hover:text-pink-400 hover:border-pink-400/30",
                icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />,
              },
              {
                name: "YouTube",
                color: "hover:text-red-400 hover:border-red-400/30",
                icon: <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
              },
              {
                name: "TikTok",
                color: "hover:text-crystal-400 hover:border-crystal-400/30",
                icon: <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />,
              },
            ].map(({ name, icon, color }) => (
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
    </main>
  );
}

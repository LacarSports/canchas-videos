import Image from "next/image";
import { supabase } from "@/lib/supabase";
import SearchFilters from "./components/SearchFilters";
import PartidoCard from "./components/PartidoCard";
import ResultsContainer from "./components/ResultsContainer";
import WhatsAppButton from "./components/WhatsAppButton";
import Reveal from "./components/Reveal";
import HeroParallax from "./components/HeroParallax";
import Footer from "./components/Footer";
import { HOME_TESTIMONIALS } from "@/lib/site";

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

        {/* Blobs de color — con parallax sutil al mouse (desktop). Clipeados
            en su propio contenedor para no afectar el touch en iOS. */}
        <HeroParallax strength={8} className="absolute inset-0 overflow-hidden pointer-events-none">
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
        </HeroParallax>

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

          {/* ── Right — floating card mockup (con parallax al mouse) ── */}
          <div className="hidden lg:flex justify-center items-center">
            <HeroParallax strength={18}>
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
            </HeroParallax>
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
          <Reveal className="mb-10">
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
          </Reveal>

          <SearchFilters />

          {!hasSearch ? null : partidos && partidos.length > 0 ? (
            <ResultsContainer>
              {partidos.map((partido: Partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={{
                    ...partido,
                    videoUrl: partido.archivo_url ? buildVideoUrl(partido.archivo_url) : null,
                  }}
                />
              ))}
            </ResultsContainer>
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

          <Reveal className="mb-14">
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
          </Reveal>

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
            ].map((paso, i) => (
              <Reveal key={paso.num} delay={i * 120} className="h-full">
                <div
                  className="relative h-full rounded-2xl p-7 overflow-hidden transition-transform duration-300 hover:-translate-y-1"
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* SOCIAL PROOF — stats + testimonios             */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative py-20 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #091520 0%, #0c1e33 55%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(41,196,173,0.06), transparent)" }} />
        <div className="max-w-5xl mx-auto relative">

          <Reveal className="mb-12">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-crystal-400/15 border border-crystal-400/25 flex items-center justify-center">
                <svg className="w-4 h-4 text-crystal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 10-2.5-1.34M5 11a3 3 0 102.5-1.34" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400">Comunidad</p>
            </div>
            <h2 className="text-3xl font-bold text-snow tracking-tight mb-1">
              Jugadores reviviendo sus partidos
            </h2>
            <div className="w-12 h-0.5 mt-3 mb-4 rounded-full" style={{ background: "linear-gradient(90deg, #29c4ad, transparent)" }} />
            <p className="text-mist-500 text-sm max-w-md">
              Lo que dicen quienes ya guardaron sus mejores jugadas.
            </p>
          </Reveal>

          {/* Testimonios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOME_TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120} className="h-full">
                <figure
                  className="relative h-full rounded-2xl border border-mist-500/12 p-6 flex flex-col transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: "linear-gradient(160deg, rgba(10,42,61,0.55) 0%, rgba(9,21,32,0.8) 100%)" }}
                >
                  <svg className="w-7 h-7 text-crystal-400/30 mb-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z" />
                  </svg>
                  <blockquote className="text-snow/90 text-sm leading-relaxed flex-1">
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-crystal-400/12 border border-crystal-400/25 flex items-center justify-center text-crystal-300 text-sm font-bold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-snow text-sm font-semibold leading-tight">{t.name}</p>
                      <p className="text-mist-700 text-xs mt-0.5">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      <WhatsAppButton />
    </main>
  );
}

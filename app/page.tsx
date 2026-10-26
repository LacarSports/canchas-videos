import Image from "next/image";
import { supabase } from "@/lib/supabase";
import SearchFilters from "./components/SearchFilters";
import PartidoCard from "./components/PartidoCard";
import ResultsContainer from "./components/ResultsContainer";
import WhatsAppButton from "./components/WhatsAppButton";
import Reveal from "./components/Reveal";
import HeroParallax from "./components/HeroParallax";
import Footer from "./components/Footer";
import SectionHeader from "./components/SectionHeader";
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
      // Columnas explícitas: password_hash no es legible con la anon key.
      .select("id, complejo, numero_cancha, ciudad, fecha, hora, duracion_minutos, archivo_url, deporte, privado")
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
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                tu momento.
              </span>
            </h1>

            <p
              className="text-lg text-white/85 mb-10 leading-relaxed max-w-[40ch] animate-slide-up"
              style={{ animationDelay: "0.16s", textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}
            >
              Las canchas con Lacar graban cada partido. Busca el tuyo, marca
              tu jugada y descárgala en segundos.
            </p>

            <div
              className="flex flex-wrap items-center gap-4 animate-slide-up"
              style={{ animationDelay: "0.24s" }}
            >
              <a
                href="#buscador"
                className="inline-flex items-center gap-2 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-bold px-7 py-3.5 rounded-xl text-base sm:text-sm transition-[background-color,transform] duration-200 active:scale-[0.97] shadow-[0_8px_24px_rgba(45,201,183,0.25)]"
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
              <a
                href="#buscador"
                aria-label="Buscar mi partido"
                className="group relative animate-float block cursor-pointer"
              >
                {/* Glow halo */}
                <div
                  className="absolute -inset-8 rounded-3xl pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(45,201,183,0.22), transparent 70%)", filter: "blur(28px)" }}
                />

                {/* Card */}
                <div className="relative bg-lake-900/80 border border-crystal-400/20 group-hover:border-crystal-400/45 rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl w-[340px] transition-colors duration-300">

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
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
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
              </a>
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
      <section id="buscador" className="relative z-10 py-20 px-6 bg-lake-900">
        <div className="max-w-7xl mx-auto relative">

          <Reveal className="mb-10">
            <SectionHeader
              eyebrow="Busca tu partido"
              title="Encuentra tu partido"
              description="Elige el complejo donde jugaste, la cancha, el día y la hora."
            />
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
      <section id="como-funciona" className="relative py-20 px-6 bg-lake-950">
        <div className="max-w-5xl mx-auto relative">

          <Reveal className="mb-12">
            <SectionHeader
              eyebrow="Cómo funciona"
              title="Tu jugada en tres pasos"
              description="La cámara de la cancha graba tu partido completo. Tú eliges el momento y te lo llevas."
            />
          </Reveal>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                num: "1",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
                titulo: "Busca tu partido",
                descripcion: "Elige complejo, cancha, día y hora. Para ver el video entras con tu cuenta.",
              },
              {
                num: "2",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
                titulo: "Marca tu jugada",
                descripcion: "Mira el partido y aprieta el botón al inicio y al final de la jugada. Hasta 2 minutos.",
              },
              {
                num: "3",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
                titulo: "Descárgala y compártela",
                descripcion: "El clip queda listo en tu celular para mandarlo al grupo o subirlo a redes.",
              },
            ].map((paso, i) => (
              <Reveal key={paso.num} delay={i * 100} className="h-full">
                <li className="h-full rounded-2xl p-6 bg-lake-900 border border-white/[0.06]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-crystal-400/10 text-crystal-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        {paso.icon}
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-mist-500 tabular-nums">Paso {paso.num}</span>
                  </div>
                  <h3 className="text-snow font-semibold text-lg mb-1.5">{paso.titulo}</h3>
                  <p className="text-mist-400 text-sm leading-relaxed">{paso.descripcion}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* SOCIAL PROOF — stats + testimonios             */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative py-20 px-6 bg-lake-900">
        <div className="max-w-5xl mx-auto relative">

          <Reveal className="mb-12">
            <SectionHeader
              eyebrow="Comunidad"
              title="Jugadores reviviendo sus partidos"
              description="Lo que dicen quienes ya guardaron sus mejores jugadas."
            />
          </Reveal>

          {/* Testimonios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOME_TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120} className="h-full">
                <figure
                  className="relative h-full rounded-2xl border border-white/[0.06] bg-lake-950/60 p-6 flex flex-col"
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

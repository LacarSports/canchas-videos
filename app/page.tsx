import Image from "next/image";
import { supabase } from "@/lib/supabase";
import SearchFilters from "./components/SearchFilters";
import PartidoCard from "./components/PartidoCard";
import ResultsContainer from "./components/ResultsContainer";
import WhatsAppButton from "./components/WhatsAppButton";
import Link from "next/link";
import Reveal from "./components/Reveal";
import Footer from "./components/Footer";
import SectionHeader from "./components/SectionHeader";
import MarqueeBand from "./components/MarqueeBand";
import Resenas from "./components/Resenas";
import CountUp from "./components/CountUp";
import DatosClave from "./components/DatosClave";
import { COMPLEJOS_ACTIVOS, HOME_STATS } from "@/lib/site";

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
    <main className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-white text-ink-950">

      {/* ══════════════════════════════════════════════ */}
      {/* HERO                                           */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white">
        {/* Luz suave de marca detrás del producto */}
        <div
          className="absolute -top-32 right-[-20%] w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(45,201,183,0.16), transparent 65%)" }}
        />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-14 sm:pt-12 sm:pb-20 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-center">
          {/* Texto */}
          <div className="animate-slide-up">
            <a
              href="#complejos"
              className="inline-flex items-center gap-2 bg-brand-soft text-brand-ink text-[13px] font-semibold pl-2.5 pr-3 py-1.5 rounded-full mb-5 active:scale-[0.97] transition-transform duration-150"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-brand" />
              </span>
              Ya grabando en {COMPLEJOS_ACTIVOS[0].nombre}
            </a>

            <h1 className="text-[44px] sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] text-ink-950">
              Tu partido,
              <br />
              <span className="text-brand">tu momento.</span>
            </h1>

            <p className="text-[17px] sm:text-lg text-ink-500 mt-4 leading-relaxed max-w-[38ch]">
              La cámara de tu cancha grabó el partido. Encuéntralo, marca tu jugada
              y descárgala en tu celular.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <a
                href="#buscador"
                className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white font-bold text-base px-7 py-4 rounded-2xl transition-[background-color,transform] duration-150 active:scale-[0.97] shadow-[0_10px_24px_rgba(45,201,183,0.35)]"
              >
                Buscar mi partido
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center text-ink-700 hover:text-ink-950 font-semibold text-base px-6 py-4 rounded-2xl border border-line hover:border-ink-300 transition-[border-color,transform] duration-150 active:scale-[0.97]"
              >
                Cómo funciona
              </a>
            </div>
          </div>

          {/* Producto: así se ve un partido en Lacar */}
          <div className="relative animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="relative rounded-[28px] overflow-hidden bg-ink-950 shadow-[0_24px_60px_rgba(11,29,38,0.22)] ring-1 ring-black/5">
              <div className="relative aspect-video">
                <Image
                  src="/thumbnail.png"
                  alt="Partido grabado por una cámara de Lacar"
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 1024px) 520px, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Cancha 2 · 20:00
                </span>

                {/* Botón del editor, igual al real */}
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-brand text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  Marcar inicio
                </span>
                <span className="absolute bottom-3.5 right-3 text-[11px] font-mono text-white/90 bg-black/50 px-2 py-0.5 rounded-md tabular-nums">
                  38:12
                </span>
              </div>
            </div>

            {/* Aviso flotante: jugada lista */}
            <div className="absolute -bottom-5 right-3 sm:-right-4 flex items-center gap-2.5 bg-white rounded-2xl pl-2.5 pr-4 py-2.5 shadow-[0_12px_30px_rgba(11,29,38,0.16)] border border-line animate-float">
              <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </span>
              <span>
                <span className="block text-ink-950 text-[13px] font-bold leading-tight">Jugada descargada</span>
                <span className="block text-ink-500 text-[11px]">Formato vertical · 0:14</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <MarqueeBand />

      {/* ══════════════════════════════════════════════ */}
      {/* BUSCADOR                                       */}
      {/* ══════════════════════════════════════════════ */}
      <section id="buscador" className="relative z-10 bg-surface px-5 sm:px-6 pt-16 pb-5 sm:pt-20 sm:pb-16">
        <div className="max-w-6xl mx-auto relative">
          <div className="mb-6">
            <SectionHeader
              eyebrow="Busca tu partido"
              title="Encuentra tu partido"
              description="Elige el complejo, la cancha, el día y la hora en que jugaste."
            />
          </div>

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
            <div className="mt-6 rounded-3xl bg-white border border-line flex flex-col items-center text-center px-6 py-10">
              <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-ink-950 mb-1">No encontramos ese partido</p>
              <p className="text-sm text-ink-500 max-w-[36ch]">
                Revisa la hora y la cancha. Los partidos quedan disponibles durante 7 días.
              </p>
            </div>
          )}

          {/* Datos clave: lo que el jugador pregunta antes de buscar */}
          <DatosClave />
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* CÓMO FUNCIONA                                  */}
      {/* ══════════════════════════════════════════════ */}
      <section id="como-funciona" className="relative bg-white px-5 sm:px-6 pt-8 pb-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <Reveal className="mb-8">
            <SectionHeader
              eyebrow="Cómo funciona"
              title="Tu jugada en tres pasos"
              description="No tienes que hacer nada antes de jugar. La cámara graba sola."
            />
          </Reveal>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                titulo: "Busca tu partido",
                descripcion: "Elige complejo, cancha, día y hora, y entra con tu cuenta.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
              },
              {
                titulo: "Marca tu jugada",
                descripcion: "Mira el partido y aprieta el botón al inicio y al final de la jugada.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
              },
              {
                titulo: "Descárgala y compártela",
                descripcion: "El clip queda en tu celular, listo para el grupo o tus redes.",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
              },
            ].map((paso, i) => (
              <Reveal key={paso.titulo} delay={i * 70} className="h-full">
                <li className="relative h-full flex md:flex-col gap-4 rounded-3xl bg-surface p-5 md:p-6 overflow-hidden">
                  <span className="absolute right-5 top-3 text-6xl font-black leading-none text-ink-950/[0.06] tabular-nums select-none pointer-events-none" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="relative shrink-0 w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shadow-[0_8px_18px_rgba(45,201,183,0.35)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {paso.icon}
                    </svg>
                  </span>
                  <div className="relative">
                    <p className="text-xs font-bold text-brand-ink uppercase tracking-wider">Paso {i + 1}</p>
                    <h3 className="text-ink-950 font-bold text-lg mt-0.5">{paso.titulo}</h3>
                    <p className="text-ink-500 text-[15px] leading-relaxed mt-1">{paso.descripcion}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* DÓNDE GRABAMOS                                 */}
      {/* ══════════════════════════════════════════════ */}
      <section id="complejos" className="relative bg-surface px-5 sm:px-6 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Cifras de Lacar (ver HOME_STATS: hoy son de prueba) */}
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-y-6 sm:gap-x-10 mb-14 sm:mb-16">
            {HOME_STATS.map((st) => (
              <li key={st.label} className="border-l-2 border-brand/40 pl-5">
                <p className="cifra text-[52px] sm:text-[64px]">
                  <span className="text-[0.6em] align-[0.35em] mr-0.5">+</span>
                  <CountUp value={st.value} duration={1600} />
                </p>
                <p className="cifra cifra-unidad text-base sm:text-lg mt-2">{st.label}</p>
              </li>
            ))}
          </ul>

          <Reveal className="mb-8">
            <SectionHeader
              eyebrow="Dónde grabamos"
              title="Complejos con Lacar"
              description="Si juegas aquí, tu partido ya se está grabando."
            />
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPLEJOS_ACTIVOS.map((c) => (
              <Reveal key={c.nombre}>
                <article className="rounded-3xl bg-white border border-line overflow-hidden">
                  <div className="relative aspect-[2.27/1] bg-[#22304a]">
                    <Image src={c.logo} alt={`Logo de ${c.nombre}`} fill className="object-contain" sizes="(min-width: 768px) 560px, 100vw" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 text-ink-950 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      Cámaras activas
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-ink-950 font-bold text-xl">{c.nombre}</h3>
                      <span className="bg-brand-soft text-brand-ink text-xs font-bold px-2.5 py-1 rounded-full">{c.deporte}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mt-4">
                      <a
                        href={c.reservaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm px-4 py-3 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97]"
                      >
                        Reservar cancha
                      </a>
                      <a
                        href={`https://www.instagram.com/${c.instagram}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 text-ink-950 font-semibold text-sm px-4 py-3 rounded-xl border border-line hover:border-ink-300 transition-[border-color,transform] duration-150 active:scale-[0.97]"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                        </svg>
                        @{c.instagram}
                      </a>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}

            {/* Invitación: tu complejo aún no tiene Lacar */}
            <Reveal>
              <div className="h-full rounded-3xl border-2 border-dashed border-ink-300/50 p-6 flex flex-col justify-center">
                <p className="text-ink-950 font-bold text-xl">¿Juegas en otro complejo?</p>
                <p className="text-ink-500 text-[15px] mt-1.5 leading-relaxed max-w-[40ch]">
                  Pronto vamos a estar en más canchas. Si eres dueño o conoces al administrador,
                  muéstrale cómo funciona.
                </p>
                <Link
                  href="/complejos"
                  className="self-start inline-flex items-center gap-1.5 mt-5 text-brand-ink font-bold text-[15px] active:scale-[0.97] transition-transform duration-150"
                >
                  Lacar para complejos
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* RESEÑAS                                        */}
      {/* ══════════════════════════════════════════════ */}
      <section id="resenas" className="relative bg-white px-5 sm:px-6 py-14 sm:py-20 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <SectionHeader
              eyebrow="Reseñas"
              title="Lo que dicen los jugadores"
              description="Opiniones de jugadores que ya descargaron sus jugadas."
            />
          </div>
          <Resenas />
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* DUEÑOS DE COMPLEJOS                            */}
      {/* ══════════════════════════════════════════════ */}
      <section className="px-5 sm:px-6 pb-14 sm:pb-20 bg-white">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[32px] bg-brand px-6 py-10 sm:px-12 sm:py-14">
          <div
            className="absolute -right-24 -top-24 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.28), transparent 65%)" }}
          />
          <div className="relative max-w-xl">
            <p className="text-white/85 text-xs font-bold uppercase tracking-[0.12em]">Para dueños de complejos</p>
            <h2 className="text-white text-[28px] sm:text-4xl font-black tracking-tight leading-[1.05] mt-2">
              Dale a tus jugadores un motivo más para volver.
            </h2>
            <p className="text-white/90 text-base mt-3 leading-relaxed">
              Instalamos las cámaras, todo funciona solo y tú ves la ocupación de tus canchas desde un panel.
            </p>
            <Link
              href="/complejos"
              className="inline-flex items-center gap-2 whitespace-nowrap mt-6 bg-white text-ink-950 font-bold text-base px-6 py-3.5 rounded-2xl transition-transform duration-150 active:scale-[0.97]"
            >
              Ver Lacar para complejos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      <WhatsAppButton />
    </main>
  );
}

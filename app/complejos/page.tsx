import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import HeroParallax from "../components/HeroParallax";
import Footer from "../components/Footer";
import WhatsAppButton from "../components/WhatsAppButton";
import FaqAccordion, { type FaqItem } from "../components/FaqAccordion";
import { whatsappUrl, WHATSAPP_DUENOS_MESSAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Para Complejos · Lacar Sports",
  description:
    "Cámaras automáticas para tu complejo de fútbol. Diferénciate, atrae más jugadores y monitorea tu negocio desde un panel. Instalación llave en mano.",
};

const WA = whatsappUrl(WHATSAPP_DUENOS_MESSAGE);

const BENEFICIOS = [
  {
    titulo: "Diferénciate de la competencia",
    desc: "Ofrece algo que la cancha de al lado no tiene: cada partido grabado y listo para revivir.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
    accent: "crystal",
  },
  {
    titulo: "Atrae más jugadores",
    desc: "Los jugadores eligen canchas con cámara. Reservar donde pueden grabar su partido es un imán.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 10-2.5-1.34M5 11a3 3 0 102.5-1.34" />,
    accent: "glacial",
  },
  {
    titulo: "Reportes de ocupación",
    desc: "Conoce tus horarios más demandados y la actividad real de tus canchas, mes a mes.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    accent: "amber",
  },
  {
    titulo: "100% automatizado",
    desc: "Las cámaras graban y publican los partidos solas. No necesitas operar ni vigilar nada.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    accent: "crystal",
  },
  {
    titulo: "Ingresos extra potenciales",
    desc: "Un servicio premium que suma valor a tu complejo y abre nuevas vías de ingreso.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    accent: "glacial",
  },
  {
    titulo: "Instalación Incluida",
    desc: "Nosotros llevamos las cámaras, las instalamos y dejamos todo funcionando. Tú no compras equipos.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    accent: "amber",
  },
] as const;

const ACCENTS: Record<string, { text: string; border: string; bg: string; glow: string }> = {
  crystal: { text: "text-crystal-400", border: "border-crystal-400/22", bg: "bg-crystal-400/12", glow: "rgba(41,196,173,0.12)" },
  glacial: { text: "text-glacial-400", border: "border-glacial-400/22", bg: "bg-glacial-400/12", glow: "rgba(77,174,196,0.12)" },
  amber: { text: "text-amber-400", border: "border-amber-400/22", bg: "bg-amber-400/12", glow: "rgba(251,191,36,0.10)" },
};

const PASOS = [
  {
    num: "01",
    titulo: "Instalamos las cámaras",
    desc: "Coordinamos una visita a tu complejo e instalamos todo de forma profesional, sin frenar tu operación.",
    accent: "crystal",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a3 3 0 100-6 3 3 0 000 6z" />,
  },
  {
    num: "02",
    titulo: "Graban en automático",
    desc: "Cada partido se graba y se sube solo a la plataforma. No tienes que apretar ningún botón.",
    accent: "glacial",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
  },
  {
    num: "03",
    titulo: "Sigues tu complejo desde el panel",
    desc: "Revisa el desempeño, la ocupación, las cámaras y los reportes desde cualquier dispositivo, cuando quieras.",
    accent: "amber",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />,
  },
] as const;

const FAQS: FaqItem[] = [
  {
    q: "¿Qué necesito para que Lacar Sports funcione?",
    a: "Solo tu complejo con conexión eléctrica e internet en las canchas. Nosotros llevamos las cámaras, el montaje y la configuración: no compras equipos ni software.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Es un plan mensual por cada cámara instalada, sin cuota inicial. Escríbenos por WhatsApp y te armamos una propuesta según la cantidad de canchas de tu complejo.",
  },
  {
    q: "¿Quién instala las cámaras?",
    a: "Nuestro equipo. Coordinamos una visita, instalamos y dejamos todo funcionando y probado. La instalación es profesional y pensada para no interrumpir tu operación.",
  },
  {
    q: "¿En qué deportes funciona Lacar Sports?",
    a: "En fútbol 7 y fútbol 5, pádel, tenis y básquetbol. Y muy pronto también en fútbol 11.",
  },
  {
    q: "¿Los jugadores pueden descargar y compartir sus jugadas?",
    a: "Sí. Cada jugador puede marcar las jugadas que quiera, descargarlas y compartirlas con su equipo o en redes sociales.",
  },
  {
    q: "¿Por cuánto tiempo están disponibles los videos?",
    a: "Las jugadas que los jugadores descargan son suyas para siempre. Los videos completos de los partidos quedan disponibles en la plataforma de Lacar Sports durante 7 días.",
  },
  {
    q: "¿Puedo elegir qué partidos son públicos o privados?",
    a: "Sí. Puedes marcar partidos como privados y protegerlos con una clave, para que solo quienes tú quieras puedan verlos.",
  },
  {
    q: "¿Qué reportes recibo?",
    a: "Reportes mensuales de ocupación y actividad de las canchas que tienen cámaras instaladas: horarios más usados, partidos grabados y uso de la plataforma, todo desde el panel.",
  },
  {
    q: "¿Qué pasa si una cámara falla?",
    a: "Nos contactas y nuestro soporte técnico lo soluciona lo antes posible, sin cobro adicional. La mensualidad incluye que el servicio funcione siempre.",
  },
  {
    q: "¿Necesito contratar personal para manejar el sistema?",
    a: "No. El sistema es automático: graba y publica los partidos solo. Tú entras al panel únicamente cuando quieras revisar tu actividad.",
  },
];

export default function ComplejosPage() {
  return (
    <main className="min-h-[100dvh] bg-lake-950">

      {/* ══════════════════════════════════════════════ */}
      {/* HERO DUEÑOS                                    */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center px-6 overflow-hidden">
        {/* Foto de fondo */}
        <Image
          src="/hero 2.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />

        {/* Capas de overlay — legibilidad + mood (igual que el hero de jugadores) */}
        <div className="absolute inset-0 bg-lake-950/70 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-lake-950/95 via-lake-950/60 to-lake-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-lake-950/80 via-transparent to-lake-950/30 pointer-events-none" />

        {/* Blobs de color con parallax sutil al mouse (desktop) */}
        <HeroParallax strength={8} className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full animate-water-drift" style={{ background: "radial-gradient(circle, rgba(41,196,173,0.22), transparent 70%)", filter: "blur(80px)" }} />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full animate-water-drift-slow" style={{ background: "radial-gradient(circle, rgba(77,174,196,0.15), transparent 70%)", filter: "blur(72px)", animationDelay: "-8s" }} />
        </HeroParallax>

        <div className="relative z-10 max-w-7xl mx-auto w-full py-28 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-crystal-400/10 border border-crystal-400/25 animate-slide-up" style={{ animationDelay: "0.04s" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-crystal-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-crystal-300">Para dueños de complejos</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[0.98] mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <span className="text-snow">Lleva tu complejo al</span>{" "}
              <span className="text-crystal-400" style={{ textShadow: "0 0 45px rgba(41,196,173,0.5)" }}>siguiente nivel.</span>
            </h1>

            <p className="text-base sm:text-lg text-mist-400 mb-9 leading-relaxed max-w-[52ch] animate-slide-up" style={{ animationDelay: "0.18s" }}>
              Instalamos cámaras que graban cada partido en automático. Tus jugadores reviven sus jugadas y tú monitoreas tu negocio desde un panel — sin personal extra.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 animate-slide-up" style={{ animationDelay: "0.26s" }}>
              <a
                href={WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-bold px-7 py-3.5 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] shadow-[0_0_32px_rgba(41,196,173,0.4)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.525 5.847L.057 23.882a.5.5 0 0 0 .611.61l6.037-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 0 1-5.006-1.371l-.36-.214-3.724.905.922-3.632-.235-.374A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                </svg>
                Contactar Lacar Sports
              </a>
              <Link
                href="/auth/complejo"
                className="inline-flex items-center justify-center gap-1.5 text-mist-400 hover:text-snow font-medium text-sm px-5 py-3.5 rounded-xl border border-mist-500/15 hover:border-mist-500/30 hover:bg-white/[0.03] transition-all duration-200"
              >
                Ya soy cliente → Iniciar sesión
              </Link>
            </div>
          </div>

          {/* Panel preview mockup */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative animate-float w-[360px]">
              <div className="absolute -inset-8 rounded-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(41,196,173,0.18), transparent 70%)", filter: "blur(30px)" }} />
              <div className="relative bg-lake-900/85 border border-crystal-400/20 rounded-2xl p-5 shadow-[0_32px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
                {/* topbar */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-crystal-400/70" />
                    <p className="text-snow text-sm font-semibold">Mi Complejo</p>
                  </div>
                  <span className="text-[10px] text-mist-700 font-mono">Panel</span>
                </div>
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-lake-800/70 border border-crystal-400/15 p-3">
                    <p className="text-2xl font-bold text-crystal-400 tracking-tight">78%</p>
                    <p className="text-mist-600 text-[11px] mt-0.5">Ocupación</p>
                  </div>
                  <div className="rounded-xl bg-lake-800/70 border border-glacial-400/15 p-3">
                    <p className="text-2xl font-bold text-glacial-400 tracking-tight">14</p>
                    <p className="text-mist-600 text-[11px] mt-0.5">Partidos hoy</p>
                  </div>
                </div>
                {/* bar chart */}
                <div className="rounded-xl bg-lake-800/50 border border-mist-500/10 p-3">
                  <p className="text-mist-600 text-[11px] mb-2.5">Ocupación por hora</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {[40, 55, 35, 70, 90, 65, 80, 50, 95, 60].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: "linear-gradient(to top, rgba(41,196,173,0.3), rgba(41,196,173,0.8))" }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* BENEFICIOS                                     */}
      {/* ══════════════════════════════════════════════ */}
      <section id="beneficios" className="relative py-20 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #091520 0%, #0c1e33 55%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(41,196,173,0.05), transparent)" }} />
        <div className="max-w-6xl mx-auto relative">
          <Reveal className="mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400 mb-3">Beneficios</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight mb-1">
              Por qué sumar Lacar Sports
            </h2>
            <div className="w-12 h-0.5 mt-3 mb-4 rounded-full" style={{ background: "linear-gradient(90deg, #29c4ad, transparent)" }} />
            <p className="text-mist-500 text-sm max-w-lg">
              Más que cámaras: una experiencia que tus jugadores van a querer y una herramienta para entender tu negocio.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFICIOS.map((b, i) => {
              const a = ACCENTS[b.accent];
              return (
                <Reveal key={b.titulo} delay={(i % 3) * 100} className="h-full">
                  <div
                    className={`relative h-full rounded-2xl p-7 overflow-hidden border ${a.border} transition-transform duration-300 hover:-translate-y-1`}
                    style={{ background: `linear-gradient(160deg, ${a.glow} 0%, rgba(9,21,32,0.8) 100%)` }}
                  >
                    <div className="absolute -top-4 -right-4 w-28 h-28 pointer-events-none rounded-full" style={{ background: `radial-gradient(circle, ${a.glow}, transparent 70%)`, filter: "blur(16px)" }} />
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${a.bg} border ${a.border}`}>
                      <svg className={`w-5 h-5 ${a.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {b.icon}
                      </svg>
                    </div>
                    <h3 className="text-snow font-bold text-base mb-2">{b.titulo}</h3>
                    <p className="text-mist-500 text-sm leading-relaxed">{b.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* CÓMO FUNCIONA (DUEÑOS)                         */}
      {/* ══════════════════════════════════════════════ */}
      <section id="como-funciona" className="relative py-20 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #091520 0%, #0e2035 50%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(45deg, rgba(41,196,173,1) 1px, transparent 1px), linear-gradient(-45deg, rgba(41,196,173,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="max-w-5xl mx-auto relative">
          <Reveal className="mb-14">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mb-3">Cómo funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight mb-1">
              Tres pasos y listo
            </h2>
            <div className="w-12 h-0.5 mt-3 mb-4 rounded-full" style={{ background: "linear-gradient(90deg, #fbbf24, transparent)" }} />
            <p className="text-mist-500 text-sm max-w-md">
              Nos encargamos de todo lo técnico. Tú solo disfrutas los resultados.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PASOS.map((paso, i) => {
              const a = ACCENTS[paso.accent];
              return (
                <Reveal key={paso.num} delay={i * 120} className="h-full">
                  <div className={`relative h-full rounded-2xl p-7 overflow-hidden border ${a.border} transition-transform duration-300 hover:-translate-y-1`} style={{ background: `linear-gradient(160deg, ${a.glow} 0%, rgba(9,21,32,0.8) 100%)` }}>
                    <div className="absolute -top-2 -right-2 text-[90px] font-black leading-none select-none pointer-events-none" style={{ color: a.glow, fontVariantNumeric: "tabular-nums" }}>
                      {paso.num}
                    </div>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${a.bg} border ${a.border}`}>
                      <svg className={`w-5 h-5 ${a.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {paso.icon}
                      </svg>
                    </div>
                    <h3 className="text-snow font-bold text-base mb-2">{paso.titulo}</h3>
                    <p className="text-mist-500 text-sm leading-relaxed">{paso.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* FAQ                                            */}
      {/* ══════════════════════════════════════════════ */}
      <section id="faq" className="relative py-20 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #091520 0%, #0c1e33 55%, #091520 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(77,174,196,0.05), transparent)" }} />
        <div className="max-w-3xl mx-auto relative">
          <Reveal className="mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-crystal-400 mb-3">Resolvemos tus dudas</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight mb-1">
              Preguntas frecuentes
            </h2>
            <div className="w-12 h-0.5 mt-3 rounded-full" style={{ background: "linear-gradient(90deg, #29c4ad, transparent)" }} />
          </Reveal>

          <Reveal delay={80}>
            <FaqAccordion items={FAQS} />
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* CTA FINAL                                      */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 overflow-hidden" style={{ background: "linear-gradient(160deg, #041520 0%, #0a2238 55%, #041520 100%)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full animate-aurora" style={{ background: "radial-gradient(circle, rgba(41,196,173,0.16), transparent 70%)", filter: "blur(90px)" }} />
        </div>
        <Reveal className="max-w-2xl mx-auto relative text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-snow tracking-tight mb-4">
            ¿Quieres Lacar Sports en tu complejo?
          </h2>
          <p className="text-mist-400 text-base mb-9 max-w-lg mx-auto">
            Cuéntanos sobre tu complejo y te armamos una propuesta a tu medida. Sin compromiso.
          </p>
          <a
            href={WA}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 bg-crystal-400 hover:bg-crystal-300 text-lake-950 font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 active:scale-[0.98] shadow-[0_0_40px_rgba(41,196,173,0.45)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.525 5.847L.057 23.882a.5.5 0 0 0 .611.61l6.037-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 0 1-5.006-1.371l-.36-.214-3.724.905.922-3.632-.235-.374A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
            </svg>
            Escríbenos por WhatsApp
          </a>
        </Reveal>
      </section>

      <Footer />

      <WhatsAppButton startId="como-funciona" endId="faq" />
    </main>
  );
}

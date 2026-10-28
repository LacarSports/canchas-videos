import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import Footer from "../components/Footer";
import MarqueeBand from "../components/MarqueeBand";
import SectionHeader from "../components/SectionHeader";
import WhatsAppButton from "../components/WhatsAppButton";
import FaqAccordion, { type FaqItem } from "../components/FaqAccordion";
import { whatsappUrl, WHATSAPP_DUENOS_MESSAGE, COMPLEJOS_ACTIVOS } from "@/lib/site";

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
      },
  {
    titulo: "Atrae más jugadores",
    desc: "Los jugadores eligen canchas con cámara. Reservar donde pueden grabar su partido es un imán.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 10-2.5-1.34M5 11a3 3 0 102.5-1.34" />,
      },
  {
    titulo: "Reportes de ocupación",
    desc: "Conoce tus horarios más demandados y la actividad real de tus canchas, mes a mes.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
      },
  {
    titulo: "100% automatizado",
    desc: "Las cámaras graban y publican los partidos solas. No necesitas operar ni vigilar nada.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />,
      },
  {
    titulo: "Ingresos extra potenciales",
    desc: "Un servicio premium que suma valor a tu complejo y abre nuevas vías de ingreso.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      },
  {
    titulo: "Instalación incluida",
    desc: "Nosotros llevamos las cámaras, las instalamos y dejamos todo funcionando. Tú no compras equipos.",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
      },
] as const;

const PASOS = [
  {
    num: "01",
    titulo: "Instalamos las cámaras",
    desc: "Coordinamos una visita a tu complejo e instalamos todo de forma profesional, sin frenar tu operación.",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a3 3 0 100-6 3 3 0 000 6z" />,
  },
  {
    num: "02",
    titulo: "Graban en automático",
    desc: "Cada partido se graba y se sube solo a la plataforma. No tienes que apretar ningún botón.",
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
  },
  {
    num: "03",
    titulo: "Sigues tu complejo desde el panel",
    desc: "Revisa el desempeño, la ocupación, las cámaras y los reportes desde cualquier dispositivo, cuando quieras.",
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
    <main className="min-h-[100dvh] -mt-[72px] pt-[72px] bg-white text-ink-950">

      {/* ══════════════════════════════════════════════ */}
      {/* HERO DUEÑOS                                    */}
      {/* ══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white">
        <div
          className="absolute -top-32 right-[-20%] w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(45,201,183,0.16), transparent 65%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-16 sm:pt-12 sm:pb-20 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
          {/* Copy */}
          <div className="animate-slide-up">
            <p className="inline-flex items-center gap-2 bg-brand-soft text-brand-ink text-[13px] font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-2 h-2 rounded-full bg-brand" />
              Para dueños de complejos
            </p>

            <h1 className="text-[40px] sm:text-6xl font-black tracking-tighter leading-[0.98] text-ink-950">
              Tu complejo,
              <br />
              <span className="text-brand">al siguiente nivel.</span>
            </h1>

            <p className="text-[17px] sm:text-lg text-ink-500 mt-4 leading-relaxed max-w-[44ch]">
              Instalamos cámaras que graban cada partido en automático. Tus jugadores reviven sus jugadas y tú ves tu negocio desde un panel, sin personal extra.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <a
                href={WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white font-bold text-base px-7 py-4 rounded-2xl transition-[background-color,transform] duration-150 active:scale-[0.97] shadow-[0_10px_24px_rgba(45,201,183,0.35)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.525 5.847L.057 23.882a.5.5 0 0 0 .611.61l6.037-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 0 1-5.006-1.371l-.36-.214-3.724.905.922-3.632-.235-.374A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                </svg>
                Quiero Lacar en mi complejo
              </a>
              <Link
                href="/auth/complejo"
                className="inline-flex items-center justify-center text-ink-700 hover:text-ink-950 font-semibold text-base px-6 py-4 rounded-2xl border border-line hover:border-ink-300 transition-[border-color,transform] duration-150 active:scale-[0.97]"
              >
                Ya soy cliente
              </Link>
            </div>
          </div>

          {/* Foto del complejo + vista del panel */}
          <div className="relative animate-slide-up pb-10 sm:pb-0" style={{ animationDelay: "0.1s" }}>
            <div className="relative aspect-[4/3] rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(11,29,38,0.22)]">
              <Image src="/hero 2.png" alt="Complejo deportivo con cámaras de Lacar" fill priority className="object-cover" sizes="(min-width: 1024px) 520px, 100vw" />
            </div>

            <div className="absolute -bottom-2 sm:-bottom-8 left-3 right-3 sm:left-auto sm:-right-6 sm:w-[300px] bg-white rounded-3xl border border-line p-4 shadow-[0_16px_40px_rgba(11,29,38,0.18)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-ink-950 text-sm font-bold">Mi complejo · hoy</p>
                <span className="text-[11px] font-semibold text-brand-ink bg-brand-soft px-2 py-0.5 rounded-full">Panel</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-4 items-end">
                <div>
                  <p className="text-3xl font-black text-ink-950 tracking-tight tabular-nums">78%</p>
                  <p className="text-ink-500 text-[11px]">Ocupación</p>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {[40, 55, 35, 70, 90, 65, 80, 50, 95, 60].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-brand" style={{ height: `${h}%`, opacity: 0.35 + h / 160 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* BENEFICIOS                                     */}
      {/* ══════════════════════════════════════════════ */}
      <MarqueeBand palabras={["Más jugadores", "Cero esfuerzo", "Datos reales", "Instalación incluida"]} />

      <section id="beneficios" className="relative px-5 sm:px-6 pt-16 pb-14 sm:pt-20 sm:pb-20 bg-surface">
        <div className="max-w-6xl mx-auto relative">
          <Reveal className="mb-12">
            <SectionHeader
              eyebrow="Beneficios"
              title="Por qué sumar Lacar Sports"
              description="Más que cámaras: una experiencia que tus jugadores van a querer y una herramienta para entender tu negocio."
            />
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BENEFICIOS.map((b, i) => (
              <Reveal key={b.titulo} delay={(i % 3) * 80} className="h-full">
                <div className="h-full flex sm:block gap-4 rounded-3xl p-5 sm:p-6 bg-white border border-line">
                  <div className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center sm:mb-4 bg-brand text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {b.icon}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-ink-950 font-bold text-lg mb-1">{b.titulo}</h3>
                    <p className="text-ink-500 text-[15px] leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* CÓMO FUNCIONA (DUEÑOS)                         */}
      {/* ══════════════════════════════════════════════ */}
      <section id="como-funciona" className="relative px-5 sm:px-6 py-14 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto relative">
          <Reveal className="mb-12">
            <SectionHeader
              eyebrow="Cómo funciona"
              title="Tres pasos y listo"
              description="Nos encargamos de todo lo técnico. Tú solo disfrutas los resultados."
            />
          </Reveal>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PASOS.map((paso, i) => (
              <Reveal key={paso.num} delay={i * 100} className="h-full">
                <li className="h-full rounded-3xl p-5 sm:p-6 bg-surface">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-brand text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        {paso.icon}
                      </svg>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-ink tabular-nums">Paso {Number(paso.num)}</span>
                  </div>
                  <h3 className="text-ink-950 font-bold text-lg mb-1">{paso.titulo}</h3>
                  <p className="text-ink-500 text-[15px] leading-relaxed">{paso.desc}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* FAQ                                            */}
      {/* ══════════════════════════════════════════════ */}
      <section id="faq" className="relative px-5 sm:px-6 py-14 sm:py-20 bg-surface">
        <div className="max-w-3xl mx-auto relative">
          <Reveal className="mb-10">
            <SectionHeader eyebrow="Resolvemos tus dudas" title="Preguntas frecuentes" />
          </Reveal>

          <Reveal delay={80}>
            <FaqAccordion items={FAQS} />
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ */}
      {/* CTA FINAL                                      */}
      {/* ══════════════════════════════════════════════ */}
      <section id="cta-final" className="px-5 sm:px-6 py-14 sm:py-20 bg-white">
        <Reveal className="max-w-6xl mx-auto relative overflow-hidden rounded-[32px] bg-brand px-6 py-10 sm:px-12 sm:py-14">
          <div
            className="absolute -right-24 -top-24 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.28), transparent 65%)" }}
          />
          <div className="relative max-w-xl">
            <p className="text-white/85 text-xs font-bold uppercase tracking-[0.12em]">
              {COMPLEJOS_ACTIVOS[0].nombre} ya graba sus partidos con Lacar
            </p>
            <h2 className="text-white text-[28px] sm:text-4xl font-black tracking-tight leading-[1.05] mt-2">
              ¿Quieres Lacar Sports en tu complejo?
            </h2>
            <p className="text-white/90 text-base mt-3 leading-relaxed">
              Cuéntanos sobre tu complejo y te armamos una propuesta a tu medida. Sin compromiso.
            </p>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 whitespace-nowrap mt-6 bg-white text-ink-950 font-bold text-base px-6 py-3.5 rounded-2xl transition-transform duration-150 active:scale-[0.97]"
            >
              <svg className="w-5 h-5 text-[#25d366]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.525 5.847L.057 23.882a.5.5 0 0 0 .611.61l6.037-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 0 1-5.006-1.371l-.36-.214-3.724.905.922-3.632-.235-.374A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
            </svg>
              Escríbenos por WhatsApp
            </a>
          </div>
        </Reveal>
      </section>

      <Footer />

      <WhatsAppButton startId="como-funciona" endId="cta-final" />
    </main>
  );
}

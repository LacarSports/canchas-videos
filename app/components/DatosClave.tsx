"use client";

import { useEffect, useRef } from "react";
import CountUp from "./CountUp";

const DATOS = [
  { numero: <CountUp value={7} duration={900} />, unidad: "días", texto: "para ver y descargar tu partido" },
  { numero: <CountUp value={2} duration={700} />, unidad: "min", texto: "máximo por cada jugada" },
  {
    numero: <><CountUp value={9} duration={900} />:<CountUp value={16} duration={1100} /></>,
    unidad: "",
    texto: "vertical para historias, o 16:9",
  },
  { numero: <CountUp value={1} duration={500} />, unidad: "cuenta", texto: "para ver el partido completo" },
];

/** Píxeles por segundo del avance automático en celular. */
const VELOCIDAD = 28;
/** Tras soltar el dedo, espera esto antes de volver a avanzar solo. */
const PAUSA_MS = 2500;

function Tarjeta({ d, copia = false }: { d: (typeof DATOS)[number]; copia?: boolean }) {
  return (
    <li
      aria-hidden={copia || undefined}
      className={`shrink-0 w-[200px] lg:w-auto rounded-2xl bg-white border border-line/70 px-5 py-5 shadow-[0_10px_30px_-14px_rgba(11,29,38,0.22)] ${copia ? "lg:hidden" : ""}`}
    >
      <p className="flex items-baseline gap-1.5 leading-none">
        <span className="cifra text-[44px] sm:text-[52px]">{d.numero}</span>
        {d.unidad && <span className="cifra cifra-unidad text-lg sm:text-xl">{d.unidad}</span>}
      </p>
      <p className="text-[13px] sm:text-sm text-ink-500 leading-snug mt-2.5">{d.texto}</p>
    </li>
  );
}

/**
 * Datos clave del servicio. En celular: fila horizontal que avanza sola hacia
 * la izquierda en bucle y que se puede arrastrar con el dedo (se pausa mientras
 * la tocas). En escritorio: grilla de 4, quieta.
 */
export default function DatosClave() {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const quieto = window.matchMedia("(min-width: 1024px), (prefers-reduced-motion: reduce)");

    let raf = 0;
    let ultimo = 0;
    let pos = el.scrollLeft;
    let pausadoHasta = 0;
    let tocando = false;
    // Distancia exacta entre una tarjeta y su copia: el largo de una vuelta.
    const vuelta = () => {
      const items = el.children;
      const n = DATOS.length;
      return (items[n] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft;
    };

    const paso = (t: number) => {
      raf = requestAnimationFrame(paso);
      const dt = ultimo ? Math.min(t - ultimo, 50) : 0;
      ultimo = t;
      if (quieto.matches || tocando || t < pausadoHasta) {
        pos = el.scrollLeft;
        return;
      }
      // Las tarjetas están dos veces: al completar una vuelta, se vuelve atrás sin salto.
      // Si alguien la movió por otro medio (rueda, teclado), seguimos desde ahí.
      if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
      const v = vuelta();
      pos += (VELOCIDAD * dt) / 1000;
      if (pos >= v) pos -= v;
      el.scrollLeft = pos;
    };

    const alTocar = () => { tocando = true; };
    const alSoltar = () => {
      tocando = false;
      pausadoHasta = performance.now() + PAUSA_MS;
    };
    // Si el usuario arrastra más allá de una vuelta, también la devolvemos atrás.
    const alDesplazar = () => {
      const v = vuelta();
      if (tocando && el.scrollLeft >= v) el.scrollLeft -= v;
    };

    el.addEventListener("pointerdown", alTocar);
    el.addEventListener("touchstart", alTocar, { passive: true });
    el.addEventListener("pointerup", alSoltar);
    el.addEventListener("pointercancel", alSoltar);
    el.addEventListener("touchend", alSoltar);
    el.addEventListener("scroll", alDesplazar, { passive: true });
    raf = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", alTocar);
      el.removeEventListener("touchstart", alTocar);
      el.removeEventListener("pointerup", alSoltar);
      el.removeEventListener("pointercancel", alSoltar);
      el.removeEventListener("touchend", alSoltar);
      el.removeEventListener("scroll", alDesplazar);
    };
  }, []);

  return (
    <ul
      ref={ref}
      className="flex lg:grid lg:grid-cols-4 gap-3 lg:gap-4 mt-10 sm:mt-12 -mx-5 sm:-mx-6 lg:mx-0 px-5 sm:px-6 lg:px-0 pt-1 pb-6 overflow-x-auto lg:overflow-visible overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {DATOS.map((d) => <Tarjeta key={d.texto} d={d} />)}
      {DATOS.map((d) => <Tarjeta key={`copia-${d.texto}`} d={d} copia />)}
    </ul>
  );
}

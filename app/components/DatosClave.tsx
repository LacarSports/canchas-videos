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
const VELOCIDAD = 45;
/** Segundos que tarda en volver a la velocidad normal tras soltar el dedo. */
const SUAVIDAD = 0.7;

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
 * la izquierda en bucle y que se puede arrastrar con el dedo. En escritorio:
 * grilla de 4, quieta.
 *
 * El movimiento es un translate3d calculado en cada cuadro (en la GPU, con
 * decimales), no scrollLeft: así no da saltos de a 1px en iPhone. Al soltar,
 * la fila conserva el impulso del dedo y vuelve de a poco a su velocidad.
 */
export default function DatosClave() {
  const marco = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const caja = marco.current;
    const el = pista.current;
    if (!caja || !el) return;
    const quieto = window.matchMedia("(min-width: 1024px), (prefers-reduced-motion: reduce)");

    let raf = 0;
    let ultimo = 0;
    let x = 0; // cuánto se ha corrido la fila hacia la izquierda
    let v = VELOCIDAD; // velocidad actual en px/s
    let arrastre: { id: number; desde: number; x0: number; t: number; px: number } | null = null;

    // Las tarjetas están dos veces; una vuelta es la distancia entre una y su copia.
    const vuelta = () => {
      const n = DATOS.length;
      return (el.children[n] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
    };
    const pintar = () => {
      const w = vuelta();
      x = ((x % w) + w) % w;
      el.style.transform = `translate3d(${-x}px,0,0)`;
    };

    const paso = (t: number) => {
      raf = requestAnimationFrame(paso);
      const dt = ultimo ? Math.min(t - ultimo, 50) / 1000 : 0;
      ultimo = t;
      if (quieto.matches) {
        el.style.transform = "";
        return;
      }
      if (arrastre) return;
      // Se acerca de forma suave a la velocidad normal (sin tirones al retomar).
      v += (VELOCIDAD - v) * (1 - Math.exp(-dt / SUAVIDAD * 3));
      x += v * dt;
      pintar();
    };

    const abajo = (e: PointerEvent) => {
      if (quieto.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
      arrastre = { id: e.pointerId, desde: e.clientX, x0: x, t: e.timeStamp, px: e.clientX };
      v = 0;
    };
    const mover = (e: PointerEvent) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      if (!caja.hasPointerCapture(e.pointerId) && Math.abs(e.clientX - arrastre.desde) > 6) {
        caja.setPointerCapture(e.pointerId);
      }
      const dt = (e.timeStamp - arrastre.t) / 1000;
      if (dt > 0) {
        // Velocidad del dedo, suavizada para que el impulso final no sea errático.
        const inst = -(e.clientX - arrastre.px) / dt;
        v = v * 0.6 + inst * 0.4;
      }
      arrastre.t = e.timeStamp;
      arrastre.px = e.clientX;
      x = arrastre.x0 - (e.clientX - arrastre.desde);
      pintar();
    };
    const arriba = (e: PointerEvent) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      // Si el dedo quedó quieto antes de soltar, no hay impulso.
      if (e.timeStamp - arrastre.t > 80) v = 0;
      v = Math.max(-2500, Math.min(2500, v));
      arrastre = null;
    };

    caja.addEventListener("pointerdown", abajo);
    caja.addEventListener("pointermove", mover);
    caja.addEventListener("pointerup", arriba);
    caja.addEventListener("pointercancel", arriba);
    raf = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(raf);
      caja.removeEventListener("pointerdown", abajo);
      caja.removeEventListener("pointermove", mover);
      caja.removeEventListener("pointerup", arriba);
      caja.removeEventListener("pointercancel", arriba);
    };
  }, []);

  return (
    <div
      ref={marco}
      className="mt-8 sm:mt-12 -mx-5 sm:-mx-6 lg:mx-0 overflow-hidden lg:overflow-visible touch-pan-y select-none lg:select-auto cursor-grab active:cursor-grabbing lg:cursor-auto"
    >
      <ul
        ref={pista}
        className="flex lg:grid lg:grid-cols-4 gap-3 lg:gap-4 w-max lg:w-auto px-5 sm:px-6 lg:px-0 pt-1 pb-5 will-change-transform lg:will-change-auto"
      >
        {DATOS.map((d) => <Tarjeta key={d.texto} d={d} />)}
        {DATOS.map((d) => <Tarjeta key={`copia-${d.texto}`} d={d} copia />)}
      </ul>
    </div>
  );
}

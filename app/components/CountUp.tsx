"use client";

import { useEffect, useRef } from "react";

const fmt = new Intl.NumberFormat("es-CL");

/**
 * Número que sube desde 0 hasta `value` cuando entra en pantalla.
 * Escribe el texto directo en el DOM (sin re-render por cuadro) y usa una curva
 * ease-out: arranca rápido y frena al llegar, que se siente más fluido.
 * Con "reducir movimiento" (o sin IntersectionObserver) muestra el valor final.
 */
export default function CountUp({
  value,
  duration = 1400,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const final = fmt.format(value);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      el.textContent = final;
      return;
    }

    el.textContent = "0";
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 4); // ease-out fuerte
          el.textContent = fmt.format(Math.round(eased * value));
          if (t < 1) raf = requestAnimationFrame(tick);
          else el.textContent = final;
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  // El servidor entrega el valor final (sirve sin JavaScript y para buscadores).
  // La copia invisible reserva el ancho final: el texto de al lado no se mueve mientras sube.
  return (
    <span className={`inline-grid tabular-nums ${className}`}>
      <span className="invisible col-start-1 row-start-1" aria-hidden="true">{fmt.format(value)}</span>
      <span ref={ref} className="col-start-1 row-start-1">{fmt.format(value)}</span>
    </span>
  );
}

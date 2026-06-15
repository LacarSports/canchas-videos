"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface HeroParallaxProps {
  children: ReactNode;
  /** Amplitud del desplazamiento en px (cuánto se mueve con el mouse). */
  strength?: number;
  className?: string;
}

/**
 * Aplica un parallax muy sutil a sus hijos siguiendo el mouse.
 * — Solo en dispositivos con puntero fino (desktop). En táctil no hace nada.
 * — Respeta `prefers-reduced-motion`.
 * — No interfiere con animaciones internas (float) porque el transform va
 *   en este wrapper, no en los hijos.
 */
export default function HeroParallax({
  children,
  strength = 14,
  className = "",
}: HeroParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        el.style.transform = `translate3d(${dx * strength}px, ${
          dy * strength
        }px, 0)`;
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transition: "transform 0.35s ease-out", willChange: "transform" }}
    >
      {children}
    </div>
  );
}

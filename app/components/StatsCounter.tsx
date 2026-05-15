"use client";

import { useEffect, useRef, useState } from "react";

interface StatsCounterProps {
  value: number;
  label: string;
  suffix?: string;
  duration?: number;
  numClassName?: string;
}

export default function StatsCounter({
  value,
  label,
  suffix = "",
  duration = 2000,
  numClassName = "text-crystal-400",
}: StatsCounterProps) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(value);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <div className={`text-4xl sm:text-5xl font-bold tabular-nums tracking-tight leading-none ${numClassName}`}>
        {count.toLocaleString("es-CL")}
        {suffix}
      </div>
      <div className="text-mist-600 text-sm font-medium mt-1">{label}</div>
    </div>
  );
}

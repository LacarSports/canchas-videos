"use client";

import { useRef, useEffect } from "react";
import { smoothScrollTo } from "@/lib/smoothScroll";

export default function ResultsContainer({ children }: { children: React.ReactNode }) {
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (resultadosRef.current) {
      const y = resultadosRef.current.getBoundingClientRect().top + window.scrollY - Math.round(window.innerHeight * 0.4);
      smoothScrollTo(y);
    }
  }, []);

  return (
    <div ref={resultadosRef} id="resultados" className="mt-10 flex flex-col gap-1.5">
      {children}
    </div>
  );
}

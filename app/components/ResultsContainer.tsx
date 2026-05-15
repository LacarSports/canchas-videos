"use client";

import { useRef, useEffect } from "react";

export default function ResultsContainer({ children }: { children: React.ReactNode }) {
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (resultadosRef.current) {
      const y = resultadosRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, []);

  return (
    <div ref={resultadosRef} className="mt-10 flex flex-col gap-1.5">
      {children}
    </div>
  );
}

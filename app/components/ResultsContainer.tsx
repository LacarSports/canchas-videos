"use client";

import { useRef, useEffect } from "react";

export default function ResultsContainer({ children }: { children: React.ReactNode }) {
  const resultadosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth >= 768) return;
    resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={resultadosRef} className="mt-10 flex flex-col gap-1.5">
      {children}
    </div>
  );
}

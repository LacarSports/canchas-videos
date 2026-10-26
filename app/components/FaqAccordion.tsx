"use client";

import { useId, useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Acordeón accesible para el FAQ de dueños.
 * — Botón + panel con aria-expanded / aria-controls.
 * — Navegable por teclado (es un <button>), touch target ≥44px.
 * — Una sola pregunta abierta a la vez.
 */
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;
        return (
          <div
            key={i}
            className="rounded-2xl border border-line bg-white overflow-hidden transition-colors duration-200"
            style={{
              borderColor: isOpen ? "rgba(45,201,183,0.6)" : undefined,
            }}
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full min-h-[56px] flex items-center justify-between gap-4 text-left px-5 py-4 text-ink-950 font-semibold text-[15px] transition-colors duration-200"
              >
                <span>{item.q}</span>
                <span
                  className="shrink-0 w-7 h-7 rounded-full bg-brand-soft flex items-center justify-center text-brand-ink transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="grid transition-all duration-300 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
                opacity: isOpen ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-ink-500 text-sm leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

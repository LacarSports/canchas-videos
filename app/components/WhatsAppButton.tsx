"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/site";

interface WhatsAppButtonProps {
  /** Id de la sección donde empieza a mostrarse el botón. */
  startId?: string;
  /** Id de la sección donde deja de mostrarse (su borde inferior). Por
   *  defecto coincide con startId (visible solo en esa sección). */
  endId?: string;
}

export default function WhatsAppButton({
  startId = "como-funciona",
  endId,
}: WhatsAppButtonProps = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const start = document.getElementById(startId);
    if (!start) return;
    const end = endId ? document.getElementById(endId) : null;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const startTop = start.getBoundingClientRect().top + window.scrollY;
        const endEl = end ?? start;
        const endBottom = endEl.getBoundingClientRect().bottom + window.scrollY;
        const viewTop = window.scrollY;
        const viewBottom = window.scrollY + window.innerHeight;
        // Visible cuando la banda [startTop, endBottom] se cruza con el viewport.
        setVisible(viewBottom > startTop && viewTop < endBottom);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, [startId, endId]);

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-lake-900/85 backdrop-blur-xl border border-mist-500/12 hover:border-crystal-400/35 rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_20px_rgba(41,196,173,0.15)] active:scale-[0.97]"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "translateY(0px)" : "translateY(14px)",
        transition: "opacity 600ms ease, transform 600ms ease",
      }}
    >
      <svg className="w-5 h-5 text-crystal-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.525 5.847L.057 23.882a.5.5 0 0 0 .611.61l6.037-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 0 1-5.006-1.371l-.36-.214-3.724.905.922-3.632-.235-.374A9.808 9.808 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
      </svg>
      <span className="text-[13px] font-medium text-mist-500 group-hover:text-snow transition-colors duration-200">
        Escríbenos
      </span>
    </a>
  );
}

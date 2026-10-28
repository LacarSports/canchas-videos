// ──────────────────────────────────────────────────────────────
// Configuración de marketing — centraliza datos editables del sitio
// público (WhatsApp, stats placeholder, testimonios). El panel de
// dueños y el buscador NO dependen de este archivo.
// ──────────────────────────────────────────────────────────────

/**
 * Número de WhatsApp de contacto (formato internacional, sin "+" ni espacios).
 * +569 6502 0945 → "56965020945"
 */
export const WHATSAPP_NUMBER = "56965020945";

/** Mensaje pre-llenado para los CTA de dueños de complejos. */
export const WHATSAPP_DUENOS_MESSAGE =
  "Hola! Tengo un complejo deportivo y quiero saber más sobre Lacar Sports.";

/** Construye un enlace wa.me, opcionalmente con mensaje pre-llenado. */
export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Enlace genérico (botón flotante "Escríbenos"). */
export const WHATSAPP_URL = whatsappUrl();

// ── Complejos donde ya está Lacar (sección "Dónde grabamos" del inicio) ──
export const COMPLEJOS_ACTIVOS = [
  {
    nombre: "Appadel",
    deporte: "Pádel",
    logo: "/complejos/appadel.png",
    reservaUrl: "https://www.easycancha.com/es-CL/chile/club/appadel",
    instagram: "appadel.cl",
  },
] as const;

// ── Cifras de Lacar (franja sobre "Complejos con Lacar") ──
export const HOME_STATS = [
  { value: 1, label: "complejo" },
  { value: 50, label: "jugadas grabadas" },
  { value: 12345, label: "impresiones en redes" },
] as const;

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

// ── Social proof de la home (jugadores) ──
// Números placeholder editables. Cuando haya datos reales se pueden
// conectar a Supabase. Ver [[project_lacar_sports]].
export const HOME_STATS = [
  { value: 1240, suffix: "+", label: "Partidos grabados" },
  { value: 8500, suffix: "+", label: "Jugadas compartidas" },
  { value: 12, suffix: "", label: "Complejos activos" },
] as const;

export const HOME_TESTIMONIALS = [
  {
    quote:
      "Marqué mi gol y apenas terminamos de jugar lo subí al grupo del equipo en un minuto. Una locura.",
    name: "Matías R.",
    role: "Jugador · Santiago",
  },
  {
    quote:
      "Antes la jugada quedaba solo en la memoria. Ahora la reviso, la recorto y me la guardo cuando quiero.",
    name: "Cris P.",
    role: "Jugador · Maipú",
  },
  {
    quote:
      "Encontrar el partido es súper fácil, lo busco por cancha y fecha y aparece al toque desde el celular.",
    name: "Dani F.",
    role: "Jugadora · Ñuñoa",
  },
] as const;

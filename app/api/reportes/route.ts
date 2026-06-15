import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Service role (solo servidor) para insertar/leer sin depender del RLS de `reportes`.
// Si no está, cae a la anon key (y entonces requiere policies en `reportes`).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM_EMAIL = process.env.RESEND_FROM || "Lacar Sports <onboarding@resend.dev>";

type Origen = "jugador" | "complejo";

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago" });
}

// POST: recibe un reporte, lo guarda en Supabase y notifica por email.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Cuerpo inválido" }, { status: 400 });

  const {
    origen,
    comentario,
    complejo,
    numero_cancha,
    partido_id,
    email_reportante,
    dispositivo,
    navegador,
    url_pagina,
  } = body as Record<string, unknown>;

  if (typeof comentario !== "string" || !comentario.trim()) {
    return Response.json({ error: "El comentario es obligatorio" }, { status: 400 });
  }

  const row = {
    origen: (origen === "complejo" ? "complejo" : "jugador") as Origen,
    comentario: comentario.trim(),
    complejo: typeof complejo === "string" && complejo ? complejo : null,
    numero_cancha: typeof numero_cancha === "number" ? numero_cancha : null,
    partido_id: typeof partido_id === "string" && partido_id ? partido_id : null,
    email_reportante: typeof email_reportante === "string" && email_reportante ? email_reportante : null,
    dispositivo: typeof dispositivo === "string" ? dispositivo : null,
    navegador: typeof navegador === "string" ? navegador : null,
    url_pagina: typeof url_pagina === "string" ? url_pagina : null,
    estado: "pendiente",
  };

  // 1) Guardar en Supabase
  const { data, error } = await supabase
    .from("reportes")
    .insert(row)
    .select("id, comentario, estado, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 2) Notificar por email (un fallo aquí no debe perder el reporte ya guardado)
  if (resend && ADMIN_EMAIL) {
    const cancha = row.numero_cancha != null ? `Cancha ${row.numero_cancha}` : "—";
    const fecha = fmtFecha(data?.created_at ?? new Date().toISOString());
    const lineas: [string, string][] = [
      ["Comentario", row.comentario],
      ["Complejo", row.complejo ?? "—"],
      ["Cancha", cancha],
      ["Dispositivo", row.dispositivo ?? "—"],
      ["Navegador", row.navegador ?? "—"],
      ["Fecha", fecha],
      ["URL de la página", row.url_pagina ?? "—"],
    ];
    if (row.email_reportante) lineas.push(["Email del reportante", row.email_reportante]);

    const text = lineas.map(([k, v]) => `${k}: ${v}`).join("\n");
    const html =
      `<h2 style="margin:0 0 12px">Nuevo reporte de ${row.origen}</h2>` +
      `<table cellpadding="6" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">` +
      lineas
        .map(
          ([k, v]) =>
            `<tr><td style="color:#666;vertical-align:top;white-space:nowrap"><strong>${k}</strong></td>` +
            `<td style="color:#111">${String(v).replace(/</g, "&lt;").replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("") +
      `</table>`;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `[Lacar Sports] Nuevo reporte de ${row.origen}`,
        text,
        html,
      });
    } catch {
      // el reporte ya quedó guardado; ignoramos el fallo de email
    }
  }

  return Response.json({ ok: true, reporte: data });
}

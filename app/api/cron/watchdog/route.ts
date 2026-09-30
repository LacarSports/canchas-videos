import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Watchdog de las Raspberry Pi. Pensado para correr cada 5 minutos (cron).
// Lee el último reporte de cada Pi (vista `monitoreo_ultimo`, ver
// supabase/2026-09_monitoreo.sql), detecta problemas y avisa por email:
//   - ADMIN_EMAIL: alerta técnica al abrirse y al resolverse cada problema.
//   - Dueño del complejo (complejos.owner_email): aviso simple solo si la cámara
//     lleva >= 30 min caída, y otro cuando vuelve. Requiere WATCHDOG_ALERTAR_DUENOS=true.
// El estado de cada alerta vive en `alertas_monitoreo` para no repetir correos.
// Protegido con CRON_SECRET: Vercel Cron lo manda solo como "Authorization: Bearer ...".

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM_EMAIL = process.env.RESEND_FROM || "Lacar Sports <onboarding@resend.dev>";
const ALERTAR_DUENOS = process.env.WATCHDOG_ALERTAR_DUENOS === "true";

// Umbrales
const MIN_SIN_REPORTE = 35;      // la Pi reporta cada 15 min → 2 reportes perdidos
const MIN_ANTES_DE_AVISAR_DUENO = 30;
const TEMP_MAX = 80;
const DISCO_MIN_PCT = 10;
const DESFASE_MAX_S = 120;
const ERRORES_MAX = 5;           // errores en los últimos 15 min
const PENDIENTES_MAX = 6;        // archivos de 5 min sin subir (= 30 min de atraso)

// Tipos que ve el dueño: solo lo que le afecta y entiende.
const TIPOS_DUENO = new Set(["sin_reporte", "camara_caida"]);

type Reporte = {
  instance_id: string;
  reportado_en: string;
  complejo: string;
  numero_cancha: number | null;
  deporte: string | null;
  hostname: string | null;
  ip_local: string | null;
  version: string | null;
  cpu_pct: number | null;
  ram_pct: number | null;
  temp_c: number | null;
  disco_libre_pct: number | null;
  throttled: string | null;
  internet_ok: boolean | null;
  camara_ok: boolean | null;
  camara_desfase_s: number | null;
  ultimo_segmento_subido: string | null;
  ultimo_partido_registrado: string | null;
  segmentos_pendientes: number | null;
  errores: number | null;
  ultimo_error: string | null;
};

type Alerta = {
  id: number;
  instance_id: string;
  complejo: string | null;
  numero_cancha: number | null;
  deporte: string | null;
  tipo: string;
  detalle: string | null;
  abierta_en: string;
  notificado_dueno: boolean;
};

function hora(iso: string | Date) {
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cancha(r: { numero_cancha: number | null; deporte: string | null }) {
  return `Cancha ${r.numero_cancha ?? "?"}${r.deporte ? ` (${r.deporte})` : ""}`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// Problemas actuales de una Pi según su último reporte: { tipo: detalle }
function problemasDe(r: Reporte, ahora: number): Record<string, string> {
  const p: Record<string, string> = {};
  const minutos = Math.round((ahora - new Date(r.reportado_en).getTime()) / 60000);
  if (minutos >= MIN_SIN_REPORTE) {
    // Sin reportes recientes el resto de los datos está viejo: solo esta alerta.
    p.sin_reporte = `Sin reportes hace ${minutos} min (último: ${hora(r.reportado_en)}). Pi apagada, sin internet o script detenido.`;
    return p;
  }
  if (r.camara_ok === false) p.camara_caida = `La Pi no logra comunicarse con la cámara.`;
  if (r.temp_c != null && r.temp_c >= TEMP_MAX) p.temperatura = `Temperatura CPU ${r.temp_c} °C.`;
  if (r.disco_libre_pct != null && r.disco_libre_pct < DISCO_MIN_PCT)
    p.disco = `Disco de la Pi con solo ${r.disco_libre_pct}% libre.`;
  if (r.throttled && r.throttled !== "0x0")
    p.energia = `get_throttled=${r.throttled}: bajo voltaje o sobrecalentamiento desde el último reinicio. Revisar fuente de poder.`;
  if (r.camara_desfase_s != null && Math.abs(r.camara_desfase_s) > DESFASE_MAX_S)
    p.reloj = `El reloj de la cámara difiere ${Math.round(r.camara_desfase_s)} s del de la Pi.`;
  if ((r.errores ?? 0) >= ERRORES_MAX)
    p.errores = `${r.errores} errores en el último intervalo. Último: ${r.ultimo_error ?? "—"}`;
  if ((r.segmentos_pendientes ?? 0) >= PENDIENTES_MAX)
    p.atraso = `${r.segmentos_pendientes} archivos de video esperando subida (internet lento o subida fallando).`;
  return p;
}

async function enviar(to: string | string[], subject: string, text: string, html: string) {
  if (!resend) return false;
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, text, html });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const ahora = Date.now();

  const [{ data: reportes, error: rErr }, { data: abiertas, error: aErr }] = await Promise.all([
    supabase.from("monitoreo_ultimo").select("*"),
    supabase.from("alertas_monitoreo").select("*").is("resuelta_en", null),
  ]);
  if (rErr || aErr) {
    return Response.json({ error: (rErr ?? aErr)!.message }, { status: 500 });
  }

  const reps = (reportes ?? []) as Reporte[];
  const open = (abiertas ?? []) as Alerta[];
  const repPorInstancia = new Map(reps.map((r) => [r.instance_id, r]));

  const nuevas: { r: Reporte; tipo: string; detalle: string }[] = [];
  const resueltas: Alerta[] = [];

  // 1) Abrir alertas nuevas / resolver las que ya no aplican
  for (const r of reps) {
    const probs = problemasDe(r, ahora);
    for (const [tipo, detalle] of Object.entries(probs)) {
      const yaAbierta = open.some((a) => a.instance_id === r.instance_id && a.tipo === tipo);
      if (!yaAbierta) nuevas.push({ r, tipo, detalle });
    }
    for (const a of open.filter((a) => a.instance_id === r.instance_id)) {
      if (!(a.tipo in probs)) resueltas.push(a);
    }
  }

  if (nuevas.length) {
    const { error } = await supabase.from("alertas_monitoreo").insert(
      nuevas.map(({ r, tipo, detalle }) => ({
        instance_id: r.instance_id,
        complejo: r.complejo,
        numero_cancha: r.numero_cancha,
        deporte: r.deporte,
        tipo,
        detalle,
      })),
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  if (resueltas.length) {
    const { error } = await supabase
      .from("alertas_monitoreo")
      .update({ resuelta_en: new Date(ahora).toISOString() })
      .in("id", resueltas.map((a) => a.id));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // 2) Email técnico (uno solo por ejecución, con todo lo nuevo y lo resuelto)
  if (ADMIN_EMAIL && (nuevas.length || resueltas.length)) {
    const filas: string[] = [];
    const lineas: string[] = [];
    for (const { r, tipo, detalle } of nuevas) {
      const ctx = `${r.complejo} · ${cancha(r)} · ${r.instance_id}@${r.hostname ?? "?"} (${r.ip_local ?? "?"}) · v${r.version ?? "?"}`;
      const metr = `CPU ${r.cpu_pct ?? "?"}% · RAM ${r.ram_pct ?? "?"}% · ${r.temp_c ?? "?"}°C · disco libre ${r.disco_libre_pct ?? "?"}% · internet ${r.internet_ok ? "sí" : "no"} · cámara ${r.camara_ok ? "sí" : "no"}`;
      lineas.push(`🔴 [${tipo}] ${ctx}\n   ${detalle}\n   ${metr}`);
      filas.push(
        `<tr><td style="color:#b91c1c;white-space:nowrap"><strong>🔴 ${tipo}</strong></td>` +
          `<td>${esc(ctx)}<br><span style="color:#111">${esc(detalle)}</span><br>` +
          `<span style="color:#666;font-size:12px">${esc(metr)}</span></td></tr>`,
      );
    }
    for (const a of resueltas) {
      const ctx = `${a.complejo ?? "?"} · ${cancha(a)} · ${a.instance_id}`;
      const txt = `Resuelto (abierta desde ${hora(a.abierta_en)}): ${a.detalle ?? ""}`;
      lineas.push(`🟢 [${a.tipo}] ${ctx}\n   ${txt}`);
      filas.push(
        `<tr><td style="color:#15803d;white-space:nowrap"><strong>🟢 ${a.tipo}</strong></td>` +
          `<td>${esc(ctx)}<br><span style="color:#666">${esc(txt)}</span></td></tr>`,
      );
    }
    const n = nuevas.length;
    await enviar(
      ADMIN_EMAIL,
      n ? `[Lacar Watchdog] ${n} alerta${n > 1 ? "s" : ""} nueva${n > 1 ? "s" : ""}` : `[Lacar Watchdog] Problemas resueltos`,
      lineas.join("\n\n"),
      `<table cellpadding="8" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${filas.join("")}</table>`,
    );
  }

  // 3) Avisos simples al dueño del complejo
  let avisosDueno = 0;
  if (ALERTAR_DUENOS) {
    const { data: complejos } = await supabase.from("complejos").select("name_complex, owner_email");
    const correoDe = new Map(
      (complejos ?? []).map((c: { name_complex: string; owner_email: string | null }) => [
        c.name_complex,
        (c.owner_email ?? "").split(",").map((e) => e.trim()).filter(Boolean),
      ]),
    );

    // 3a) Caída que ya dura >= 30 min y no se ha avisado
    const recienAbiertas = new Set(nuevas.map((x) => `${x.r.instance_id}|${x.tipo}`));
    const paraAvisar = open.filter(
      (a) =>
        TIPOS_DUENO.has(a.tipo) &&
        !a.notificado_dueno &&
        !resueltas.some((x) => x.id === a.id) &&
        !recienAbiertas.has(`${a.instance_id}|${a.tipo}`) &&
        ahora - new Date(a.abierta_en).getTime() >= MIN_ANTES_DE_AVISAR_DUENO * 60000,
    );
    for (const a of paraAvisar) {
      const to = correoDe.get(a.complejo ?? "") ?? [];
      if (!to.length) continue;
      const cual = cancha(a);
      const texto =
        `Hola,\n\nTe avisamos que la cámara de la ${cual} de ${a.complejo} no está funcionando ` +
        `desde las ${hora(a.abierta_en)}. Mientras tanto, los partidos de esa cancha podrían no quedar grabados.\n\n` +
        `Ya estamos al tanto y trabajando en ello. Si alguien desconectó o apagó el equipo de la cámara, ` +
        `por favor vuelve a conectarlo.\n\nEquipo Lacar Sports`;
      const ok = await enviar(
        to,
        `Lacar Sports: la cámara de la ${cual} no está funcionando`,
        texto,
        `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${esc(texto).replace(/\n/g, "<br>")}</div>`,
      );
      if (ok) {
        await supabase.from("alertas_monitoreo").update({ notificado_dueno: true }).eq("id", a.id);
        avisosDueno++;
      }
    }

    // 3b) Aviso de "volvió a funcionar" solo si antes se le avisó la caída
    for (const a of resueltas.filter((x) => x.notificado_dueno && TIPOS_DUENO.has(x.tipo))) {
      const to = correoDe.get(a.complejo ?? "") ?? [];
      if (!to.length) continue;
      const cual = cancha(a);
      const texto = `Hola,\n\nLa cámara de la ${cual} de ${a.complejo} volvió a funcionar (${hora(new Date(ahora))}).\n\nEquipo Lacar Sports`;
      if (
        await enviar(
          to,
          `Lacar Sports: la cámara de la ${cual} volvió a funcionar`,
          texto,
          `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${esc(texto).replace(/\n/g, "<br>")}</div>`,
        )
      )
        avisosDueno++;
    }
  }

  return Response.json({
    ok: true,
    instancias: reps.map((r) => ({
      instance_id: r.instance_id,
      ultimo_reporte: r.reportado_en,
      problemas: Object.keys(problemasDe(r, ahora)),
    })),
    alertas_nuevas: nuevas.length,
    alertas_resueltas: resueltas.length,
    avisos_dueno: avisosDueno,
    sin_datos: repPorInstancia.size === 0,
  });
}

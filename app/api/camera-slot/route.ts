import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { complejoDeAdmin } from "@/lib/complejos";

// Usa la service_role key (solo servidor): `camera_settings` y `partidos` no se
// pueden escribir con la anon key (supabase/2026-10_seguridad.sql).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Devuelve el complejo del usuario dueño del token, o null si el token no es
// válido o el usuario no administra ningún complejo (misma regla que /api/my-complejo).
async function complejoDelDueno(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return null;
  return complejoDeAdmin(supabase, user.email).catch(() => null);
}

type Estado = "publico" | "privado" | "bloqueado";

// Detecta tabla/columna faltante para que la UI muestre el SQL de migración
function isSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("column") && (m.includes("graba") || m.includes("fecha") || m.includes("hora") || m.includes("password_hash"));
}

export async function POST(req: Request) {
  // Solo el dueño de un complejo puede cambiar la configuración, y solo la de SU complejo.
  const complejo = await complejoDelDueno(req);
  if (!complejo) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (body.complejo && body.complejo !== complejo) {
    return Response.json({ error: "No autorizado para ese complejo" }, { status: 403 });
  }
  const { numero_cancha, deporte, fecha, horas, estado, password } = body;

  const dep: string = typeof deporte === "string" ? deporte : "";
  const horasList: string[] = Array.isArray(horas) ? horas : horas ? [horas] : [];

  if (
    typeof numero_cancha !== "number" ||
    !fecha ||
    horasList.length === 0 ||
    !["publico", "privado", "bloqueado"].includes(estado)
  ) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const est = estado as Estado;
  const graba = est !== "bloqueado";
  const passwordHash =
    est === "privado" && password ? await bcrypt.hash(password, 10) : null;

  // 1) Upsert de la política por bloque en camera_settings
  const rows = horasList.map((hora) => ({
    complejo,
    numero_cancha,
    deporte: dep,
    fecha,
    hora,
    estado: est,
    graba,
    // privado sin clave nueva: no pisar hash existente (se actualiza solo si hay password)
    ...(est === "privado"
      ? passwordHash
        ? { password_hash: passwordHash }
        : {}
      : { password_hash: null }),
  }));

  const { error: csError } = await supabase
    .from("camera_settings")
    .upsert(rows, { onConflict: "complejo,numero_cancha,deporte,fecha,hora" });

  if (csError) {
    if (isSchemaError(csError)) {
      return Response.json({ error: csError.message, schema: true }, { status: 422 });
    }
    return Response.json({ error: csError.message }, { status: 500 });
  }

  // 2) Sincronizar partidos ya grabados de esos bloques (retroactivo).
  //    OJO: partidos.hora puede venir como "HH:MM", "HH:MM:SS" o un rango "HH:MM - HH:MM",
  //    por eso NO comparamos como time: traemos los partidos de la fecha/cancha y
  //    filtramos por el prefijo HH:MM (los primeros 5 chars).
  //    bloqueado: no se tocan los partidos existentes (el bloqueo es hacia adelante).
  let partidosActualizados = 0;
  if (est !== "bloqueado") {
    // Nombre exacto del complejo: con un "contiene" (ilike %x%) un complejo cuyo
    // nombre incluye el de otro podría tocar partidos ajenos.
    let sel = supabase
      .from("partidos")
      .select("id, hora")
      .eq("numero_cancha", numero_cancha)
      .eq("fecha", fecha)
      .eq("complejo", complejo);
    // Solo los partidos del mismo deporte (cancha 1 fútbol ≠ cancha 1 pádel)
    if (dep && dep !== "—") sel = sel.eq("deporte", dep);
    const { data: candidatos, error: selError } = await sel;
    if (selError) return Response.json({ error: selError.message }, { status: 500 });

    const update =
      est === "privado"
        ? passwordHash
          ? { privado: true, password_hash: passwordHash }
          : { privado: true }
        : { privado: false, password_hash: null };

    const ids = (candidatos ?? [])
      .filter((p) => horasList.includes(String((p as { hora: string }).hora ?? "").slice(0, 5)))
      .map((p) => (p as { id: string }).id);

    if (ids.length > 0) {
      const { data: updated, error: updError } = await supabase
        .from("partidos")
        .update(update)
        .in("id", ids)
        .select("id");
      if (updError) return Response.json({ error: updError.message }, { status: 500 });
      partidosActualizados = updated?.length ?? 0;
    }
  }

  return Response.json({ ok: true, partidosActualizados });
}

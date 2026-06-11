import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Estado = "publico" | "privado" | "bloqueado";

// "19:00" -> "20:00:00" (Postgres time acepta "24:00:00" para el slot de las 23:00)
function nextHour(hora: string) {
  const h = parseInt(hora.slice(0, 2), 10) + 1;
  return `${h.toString().padStart(2, "0")}:00:00`;
}

// Detecta tabla/columna faltante para que la UI muestre el SQL de migración
function isSchemaError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("column") && (m.includes("graba") || m.includes("fecha") || m.includes("hora") || m.includes("password_hash"));
}

export async function POST(req: Request) {
  const { complejo, numero_cancha, fecha, horas, estado, password } = await req.json();

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
    complejo: complejo ?? "",
    numero_cancha,
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
    .upsert(rows, { onConflict: "complejo,numero_cancha,fecha,hora" });

  if (csError) {
    if (isSchemaError(csError)) {
      return Response.json({ error: csError.message, schema: true }, { status: 422 });
    }
    return Response.json({ error: csError.message }, { status: 500 });
  }

  // 2) Sincronizar partidos ya grabados de esos bloques (retroactivo)
  //    bloqueado: no se tocan los partidos existentes (el bloqueo es hacia adelante)
  if (est !== "bloqueado") {
    for (const hora of horasList) {
      let q = supabase
        .from("partidos")
        .update(
          est === "privado"
            ? passwordHash
              ? { privado: true, password_hash: passwordHash }
              : { privado: true }
            : { privado: false, password_hash: null },
        )
        .eq("numero_cancha", numero_cancha)
        .eq("fecha", fecha)
        .gte("hora", `${hora}:00`)
        .lt("hora", nextHour(hora));
      if (complejo) q = q.ilike("complejo", `%${complejo}%`);
      await q;
    }
  }

  return Response.json({ ok: true });
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  const { partidoId, complejo, sessionId } = await req.json();

  if (!partidoId || !sessionId) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const comp = complejo ?? "";

  // 1) Registro de la visita (una fila por reproducción)
  await supabase.from("visitas_partidos").insert({
    partido_id: partidoId,
    complejo: comp,
    session_id: sessionId,
    visited_at: now,
  });

  // 2) Resumen por usuario anónimo del complejo (UNIQUE complejo + session_id).
  //    Primero intentamos insertar; si ya existe, incrementamos total_visitas.
  const { error: insError } = await supabase.from("usuarios_complejo").insert({
    complejo: comp,
    session_id: sessionId,
    primera_visita: now,
    ultima_visita: now,
    total_visitas: 1,
  });

  if (insError) {
    const { data: existing } = await supabase
      .from("usuarios_complejo")
      .select("total_visitas")
      .eq("complejo", comp)
      .eq("session_id", sessionId)
      .single<{ total_visitas: number }>();

    await supabase
      .from("usuarios_complejo")
      .update({
        ultima_visita: now,
        total_visitas: (existing?.total_visitas ?? 0) + 1,
      })
      .eq("complejo", comp)
      .eq("session_id", sessionId);
  }

  return Response.json({ ok: true });
}

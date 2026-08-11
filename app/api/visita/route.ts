import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Cliente con service role: necesario para leer `complejos` (RLS bloquea anon)
// y así no contar al dueño viendo los videos de su propio complejo.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = serviceKey
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  : null;

export async function POST(req: Request) {
  const { partidoId, complejo, sessionId, userId, userEmail } = await req.json();

  if (!partidoId || !sessionId) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const comp = complejo ?? "";

  // El dueño del complejo viendo sus propios videos no cuenta como visita.
  // (Un jugador logueado, o un dueño viendo videos de OTRO complejo, sí cuenta.)
  if (userEmail && comp && supabaseAdmin) {
    const { data: owner } = await supabaseAdmin
      .from("complejos")
      .select("id")
      .eq("owner_email", userEmail)
      .eq("name_complex", comp)
      .maybeSingle();
    if (owner) return Response.json({ ok: true, skipped: "owner" });
  }

  // 1) Registro de la visita (una fila por reproducción)
  await supabase.from("visitas_partidos").insert({
    partido_id: partidoId,
    complejo: comp,
    session_id: sessionId,
    user_id: userId ?? null,
    visited_at: now,
  });

  // 2) Resumen por usuario del complejo (UNIQUE complejo + session_id).
  //    Primero intentamos insertar; si ya existe, incrementamos total_visitas.
  const { error: insError } = await supabase.from("usuarios_complejo").insert({
    complejo: comp,
    session_id: sessionId,
    user_id: userId ?? null,
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
        ...(userId ? { user_id: userId } : {}),
      })
      .eq("complejo", comp)
      .eq("session_id", sessionId);
  }

  return Response.json({ ok: true });
}

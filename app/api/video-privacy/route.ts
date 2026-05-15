import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  const { partidoId, privado, password } = await req.json();

  if (!partidoId || typeof privado !== "boolean") {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const update: Record<string, unknown> = { privado };

  if (privado && password) {
    update.password_hash = await bcrypt.hash(password, 10);
  } else if (!privado) {
    update.password_hash = null;
  }

  const { error } = await supabase
    .from("partidos")
    .update(update)
    .eq("id", partidoId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

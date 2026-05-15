import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  const { partidoId, password } = await req.json();

  if (!partidoId || !password) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("partidos")
    .select("password_hash")
    .eq("id", partidoId)
    .single<{ password_hash: string | null }>();

  if (error || !data?.password_hash) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const match = await bcrypt.compare(password, data.password_hash);
  return Response.json({ ok: match }, { status: match ? 200 : 401 });
}

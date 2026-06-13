import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Resuelve el complejo del dueño (complejos.name_complex) a partir de su email.
// Se hace en el servidor porque el RLS de `complejos` no permite leerla con la
// anon key. Verificamos el JWT del usuario y luego buscamos con la service_role.
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ complejo: null }, { status: 401 });

  // 1) Verifica el token y obtiene el email real del usuario logueado
  const auth = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user?.email) return Response.json({ complejo: null }, { status: 401 });

  // 2) Busca su complejo con la service_role (salta el RLS de `complejos`)
  const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON, {
    auth: { persistSession: false },
  });
  const { data, error: dbError } = await admin
    .from("complejos")
    .select("name_complex")
    .eq("owner_email", user.email)
    .limit(1);

  if (dbError) return Response.json({ complejo: null, error: dbError.message }, { status: 500 });

  return Response.json({ complejo: data?.[0]?.name_complex ?? null });
}

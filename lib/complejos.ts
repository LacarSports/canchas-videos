import type { SupabaseClient } from "@supabase/supabase-js";

// Administradores de un complejo: `complejos.owner_email` admite uno o varios
// correos separados por coma, p. ej. "dueno@club.cl, encargado@club.cl".
// La comparación ignora mayúsculas y espacios.

/** Lista normalizada de correos de `complejos.owner_email`. */
export function correosAdmin(ownerEmail: string | null | undefined): string[] {
  return (ownerEmail ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Nombre del complejo (`name_complex`) que administra este correo, o null.
 * Requiere un cliente con service_role (el RLS de `complejos` bloquea al cliente).
 */
export async function complejoDeAdmin(admin: SupabaseClient, email: string): Promise<string | null> {
  const correo = email.trim().toLowerCase();
  if (!correo) return null;
  const { data, error } = await admin.from("complejos").select("name_complex, owner_email");
  if (error) throw new Error(error.message);
  const fila = (data ?? []).find((c: { owner_email: string | null }) =>
    correosAdmin(c.owner_email).includes(correo),
  );
  return (fila as { name_complex: string } | undefined)?.name_complex ?? null;
}

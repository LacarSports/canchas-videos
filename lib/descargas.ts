import { supabase } from "@/lib/supabase";

interface RegistroDescarga {
  partidoId?: string | null;
  jugadaId?: string | null;
  complejo?: string | null;
  inicioSeg: number;
  finSeg: number;
  etiqueta?: string | null;
  tipo: "descarga" | "destacado";
  origen: "partido" | "jugada";
}

/**
 * Registra en `descargas_clips` quién descargó o guardó un clip (trazabilidad
 * exigida por los T&C §6.3). Silencioso: un fallo aquí nunca debe bloquear la
 * descarga. Si no hay sesión no registra (las vistas con descarga exigen login).
 */
export async function registrarDescarga(params: RegistroDescarga): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("descargas_clips").insert({
      user_id: session.user.id,
      email: session.user.email ?? null,
      partido_id: params.partidoId ?? null,
      jugada_id: params.jugadaId ?? null,
      complejo: params.complejo ?? null,
      inicio_seg: params.inicioSeg,
      fin_seg: params.finSeg,
      etiqueta: params.etiqueta ?? null,
      tipo: params.tipo,
      origen: params.origen,
    });
  } catch {
    // nunca interrumpir la descarga por un fallo de registro
  }
}

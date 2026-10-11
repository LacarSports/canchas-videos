/**
 * Jugadas destacadas (tabla `jugadas`). La columna `edicion` (jsonb) guarda cómo se
 * creó el clip: formato, seguimiento y ajustes de imagen, para poder volver a generarlo
 * igual en cualquier momento. Si la columna aún no existe en la base (script
 * supabase/2026-10_jugadas_edicion.sql sin ejecutar), todo sigue funcionando sin ella.
 */
import { supabase } from "@/lib/supabase";
import type { FormatoClip } from "@/lib/marcaAgua";
import type { KeyframeVista } from "@/lib/encuadre";

export interface Edicion {
  formato: FormatoClip;
  /** Encuadres con t desde el inicio del clip; null = encuadre fijo. */
  seguimiento: KeyframeVista[] | null;
  /** Centro horizontal del encuadre fijo (reel sin seguimiento). */
  cx?: number;
  velocidad?: number;
  brillo?: number;
  contraste?: number;
}

export interface JugadaRow {
  id: string;
  partido_id: string;
  etiqueta: string;
  inicio_seg: number;
  fin_seg: number;
  duracion: number;
  edicion?: Edicion | null;
}

const COLUMNAS = "id, partido_id, etiqueta, inicio_seg, fin_seg, duracion";

export async function cargarJugadas(partidoId: string): Promise<JugadaRow[]> {
  const conEdicion = await supabase.from("jugadas").select(`${COLUMNAS}, edicion`)
    .eq("partido_id", partidoId).order("creado_en", { ascending: false });
  if (!conEdicion.error) return (conEdicion.data ?? []) as JugadaRow[];
  const sinEdicion = await supabase.from("jugadas").select(COLUMNAS)
    .eq("partido_id", partidoId).order("creado_en", { ascending: false });
  return (sinEdicion.data ?? []) as JugadaRow[];
}

export async function insertarJugada(j: Omit<JugadaRow, "id">): Promise<string | null> {
  const { edicion, ...base } = j;
  const r = await supabase.from("jugadas").insert({ ...base, edicion }).select("id").single();
  if (!r.error) return (r.data?.id as string) ?? null;
  // Columna `edicion` todavía no creada: guardar sin ella
  const r2 = await supabase.from("jugadas").insert(base).select("id").single();
  return (r2.data?.id as string) ?? null;
}

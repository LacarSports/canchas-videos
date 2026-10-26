"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

interface Resena {
  id: string;
  nombre: string;
  complejo: string;
  estrellas: number;
  comentario: string;
  creado_en: string;
}

const MAX_COMENTARIO = 500;

function Estrellas({ valor, size = "w-4 h-4" }: { valor: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`${size} ${n <= valor ? "text-brand" : "text-line"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

/**
 * Reseñas de jugadores: lista de reseñas aprobadas + formulario para dejar la propia.
 * Escribir exige sesión. Las reseñas nuevas no se publican hasta que se aprueban
 * a mano en Supabase (ver SUPABASE.md → `resenas`).
 */
export default function Resenas() {
  const { session, loading: cargandoSesion } = useSession();
  const [resenas, setResenas] = useState<Resena[] | null>(null);
  const [complejos, setComplejos] = useState<string[]>([]);

  // Formulario
  const [estrellas, setEstrellas] = useState(0);
  const [nombre, setNombre] = useState("");
  const [complejo, setComplejo] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    supabase
      .from("resenas")
      .select("id, nombre, complejo, estrellas, comentario, creado_en")
      .eq("aprobada", true)
      .order("creado_en", { ascending: false })
      .limit(12)
      .then(({ data }) => setResenas((data as Resena[] | null) ?? []));

    supabase
      .from("partidos")
      .select("complejo")
      .then(({ data }) => {
        const unicos = [...new Set((data ?? []).map((p) => p.complejo as string).filter(Boolean))];
        setComplejos(unicos.sort((a, b) => a.localeCompare(b, "es")));
      });
  }, []);

  // Con sesión: precargar el nombre del perfil y ver si ya dejó su reseña
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nombre) setNombre((n) => n || data.nombre);
      });
    supabase
      .from("resenas")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEnviada(true);
      });
  }, [session?.user?.id]);

  const puedeEnviar =
    estrellas > 0 && nombre.trim() && complejo.trim() && comentario.trim().length >= 3 && !enviando;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.from("resenas").insert({
      nombre: nombre.trim(),
      complejo: complejo.trim(),
      estrellas,
      comentario: comentario.trim(),
    });
    setEnviando(false);
    if (!error) {
      setEnviada(true);
      return;
    }
    if (error.code === "23505") setEnviada(true); // ya tenía una reseña
    else setError("No pudimos guardar tu reseña. Inténtalo de nuevo en un rato.");
  }

  const total = resenas?.length ?? 0;
  const promedio = total ? resenas!.reduce((s, r) => s + r.estrellas, 0) / total : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 lg:gap-10 items-start">
      {/* ── Reseñas publicadas ── */}
      <div className="min-w-0">
        {total > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl font-bold text-ink-950 tabular-nums tracking-tight">
              {promedio.toFixed(1).replace(".", ",")}
            </span>
            <div>
              <Estrellas valor={Math.round(promedio)} />
              <p className="text-ink-500 text-xs mt-0.5">
                {total} {total === 1 ? "reseña" : "reseñas"}
              </p>
            </div>
          </div>
        )}

        {resenas === null ? (
          <div className="flex gap-3 overflow-hidden">
            {[0, 1].map((i) => (
              <div key={i} className="shrink-0 w-[82%] sm:w-72 h-44 rounded-3xl bg-white border border-line animate-pulse" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink-300/60 bg-white px-6 py-10 text-center">
            <div className="flex justify-center mb-3">
              <Estrellas valor={0} size="w-6 h-6" />
            </div>
            <p className="text-ink-950 font-semibold">Todavía no hay reseñas</p>
            <p className="text-ink-500 text-sm mt-1">Sé el primero en contar cómo te fue con tu jugada.</p>
          </div>
        ) : (
          // Móvil: carrusel horizontal con snap. Escritorio: grilla.
          <ul className="-mx-6 px-6 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:overflow-visible [scrollbar-width:none]">
            {resenas.map((r) => (
              <li
                key={r.id}
                className="snap-start shrink-0 w-[82%] sm:w-auto rounded-3xl bg-white border border-line p-5 flex flex-col"
              >
                <div className="flex items-center justify-between gap-3">
                  <Estrellas valor={r.estrellas} />
                  <span className="text-ink-300 text-xs">{fechaCorta(r.creado_en)}</span>
                </div>
                <p className="text-ink-700 text-[15px] leading-relaxed mt-3 flex-1 break-words">{r.comentario}</p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-line">
                  <span className="w-9 h-9 rounded-xl bg-brand text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {r.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink-950 text-sm font-semibold truncate">{r.nombre}</p>
                    <p className="text-ink-500 text-xs truncate">{r.complejo}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Dejar una reseña ── */}
      <div className="rounded-3xl bg-white border border-line p-5 sm:p-6 shadow-[0_12px_32px_rgba(11,29,38,0.06)]">
        <h3 className="text-ink-950 font-bold text-lg">Deja tu reseña</h3>

        {cargandoSesion ? (
          <div className="h-24 mt-4 rounded-2xl bg-surface animate-pulse" />
        ) : !session ? (
          <>
            <p className="text-ink-500 text-sm mt-1 mb-5">
              Necesitas una cuenta para opinar. Así sabemos que las reseñas son de jugadores reales.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent("/#resenas")}`}
              className="w-full inline-flex items-center justify-center bg-brand hover:bg-brand-hover text-white font-bold text-base px-5 py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97]"
            >
              Iniciar sesión para opinar
            </Link>
          </>
        ) : enviada ? (
          <div className="mt-4 rounded-2xl bg-brand-soft px-4 py-5 text-center">
            <p className="text-ink-950 font-semibold">Gracias por tu reseña</p>
            <p className="text-ink-500 text-sm mt-1">La revisamos y aparecerá aquí en unos días.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <fieldset>
              <legend className="text-[13px] font-semibold text-ink-700 mb-1.5">Tu nota</legend>
              <div className="flex gap-1" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={estrellas === n}
                    aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                    onClick={() => setEstrellas(n)}
                    className="w-11 h-11 flex items-center justify-center rounded-xl active:scale-[0.9] transition-transform duration-150"
                  >
                    <svg
                      className={`w-8 h-8 transition-colors duration-150 ${n <= estrellas ? "text-brand" : "text-line"}`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" />
                    </svg>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-700">Nombre</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoComplete="name"
                placeholder="Cómo quieres aparecer"
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base text-ink-950 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-700">Complejo deportivo</span>
              {complejos.length > 0 ? (
                <select
                  value={complejo}
                  onChange={(e) => setComplejo(e.target.value)}
                  className={`w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${complejo ? "text-ink-950" : "text-ink-300"}`}
                >
                  <option value="">Dónde jugaste</option>
                  {complejos.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={complejo}
                  onChange={(e) => setComplejo(e.target.value)}
                  maxLength={80}
                  placeholder="Dónde jugaste"
                  className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base text-ink-950 placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-700">Comentario</span>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                maxLength={MAX_COMENTARIO}
                rows={3}
                placeholder="¿Qué te pareció ver y descargar tu jugada?"
                className="w-full bg-white border border-line rounded-xl px-3.5 py-3 text-base text-ink-950 placeholder-ink-300 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <span className="text-ink-300 text-xs text-right tabular-nums">
                {comentario.length}/{MAX_COMENTARIO}
              </span>
            </label>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={!puedeEnviar}
              className="w-full inline-flex items-center justify-center gap-2 font-bold text-base px-5 py-3.5 rounded-xl transition-[background-color,transform] duration-150 bg-brand hover:bg-brand-hover text-white active:scale-[0.97] disabled:bg-surface disabled:text-ink-300 disabled:active:scale-100"
            >
              {enviando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {enviando ? "Enviando…" : "Publicar reseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

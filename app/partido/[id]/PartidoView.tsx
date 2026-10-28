"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import VideoClipSelector, { type NuevaJugada } from "./VideoClipSelector";
import { exportarClip, type FaseDescarga } from "./exportarClip";
import ElegirFormato from "./ElegirFormato";
import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import { registrarDescarga } from "@/lib/descargas";
import { cargarJugadas, insertarJugada, borrarJugada, jugadasOcultas, marcarComoMia, type Edicion } from "@/lib/jugadas";
import { guardarVideo, nombreVideo } from "@/lib/guardarVideo";
import InlineClipPlayer from "@/app/components/InlineClipPlayer";

/* ── tag styles ── */

const TAG_STYLES: Record<string, string> = {
  Gol:           "bg-brand text-white border-brand",
  Atajada:       "bg-brand-soft text-brand-ink border-brand/30",
  Caño:          "bg-brand-soft text-brand-ink border-brand/30",
  "Buena jugada":"bg-brand-soft text-brand-ink border-brand/30",
  Blooper:       "bg-surface text-ink-700 border-line",
  Otro:          "bg-surface text-ink-700 border-line",
};

function tagStyle(etiqueta: string) {
  return TAG_STYLES[etiqueta] ?? TAG_STYLES["Otro"];
}

/** Hora del día "HH:MM" en que empieza una jugada (inicio del bloque + segundo del video). */
function horaDeJugada(hora: string | undefined, seg: number): string | null {
  const m = hora?.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = Math.floor(Number(m[1]) * 3600 + Number(m[2]) * 60 + seg) % 86400;
  return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}`;
}

function fmt(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Jugada destacada en la barra lateral, con el estado de su video preparado. */
interface JugadaUI {
  /** Clave local estable (el id de la base llega después de guardar). */
  key: string;
  /** Id en la tabla `jugadas`; null mientras se guarda o si no se pudo guardar. */
  id: string | null;
  etiqueta: string;
  inicioSeg: number;
  finSeg: number;
  duracion: number;
  edicion?: Edicion | null;
  proceso?: "cola" | "procesando" | "listo" | "error";
  progreso?: number;
  blobUrl?: string;
  blob?: Blob;
  error?: string;
}

/* ── props ── */

interface Props {
  videoUrl: string;
  title: string;
  partidoId: string;
  deporte?: string | null;
  complejo?: string;
  numeroCancha?: number;
  /** Bloque horario del partido ("10:00 - 11:00"). */
  hora?: string;
}

/* ── component ── */

export default function PartidoView({ videoUrl, title, partidoId, deporte, complejo, numeroCancha, hora }: Props) {
  const [clips, setClips] = useState<JugadaUI[]>([]);
  const clipsRef = useRef<JugadaUI[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [eligiendoKey, setEligiendoKey] = useState<string | null>(null);
  // Aviso flotante: progreso de la jugada en preparación o "lista"
  const [aviso, setAviso] = useState<{ key: string; tipo: "preparando" | "lista" | "error" } | null>(null);
  const [destacadaKey, setDestacadaKey] = useState<string | null>(null);
  // Basurero: primer toque pide confirmar, el segundo borra.
  const [confirmarBorrarKey, setConfirmarBorrarKey] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmarBorrarKey) return;
    const t = setTimeout(() => setConfirmarBorrarKey(null), 3500);
    return () => clearTimeout(t);
  }, [confirmarBorrarKey]);

  // Registro de visita: una sola vez por sesión de visualización (no en pausa/replay)
  const visitaRegistrada = useRef(false);

  const handlePlayStart = useCallback(async () => {
    if (visitaRegistrada.current) return;
    visitaRegistrada.current = true;
    try {
      // Los jugadores logueados SÍ cuentan como visita; el API descarta solo
      // al dueño de ESTE complejo (verificado contra complejos.owner_email).
      const { data: { session } } = await supabase.auth.getSession();
      const sessionId = getSessionId();
      if (!sessionId) return;
      await fetch("/api/visita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoId,
          complejo,
          sessionId,
          userId: session?.user?.id ?? null,
          userEmail: session?.user?.email ?? null,
        }),
      });
    } catch {
      // un fallo de registro no debe afectar la reproducción
    }
  }, [partidoId, complejo]);

  // Share copy feedback per clip
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);

  /* ── jugadas guardadas del partido ── */
  useEffect(() => {
    cargarJugadas(partidoId).then((data) => {
      const ocultas = jugadasOcultas(partidoId);
      setClips((prev) => [
        // Las creadas en esta visita (aún sin guardar) se mantienen arriba
        ...prev.filter((c) => !c.id),
        ...data.filter((j) => !ocultas.includes(j.id)).map((j) => ({
          key: j.id,
          id: j.id,
          etiqueta: j.etiqueta,
          inicioSeg: Number(j.inicio_seg),
          finSeg: Number(j.fin_seg),
          duracion: Number(j.duracion),
          edicion: j.edicion ?? null,
        })),
      ]);
    });
  }, [partidoId]);

  // Liberar los videos preparados al salir de la página
  useEffect(() => () => { clipsRef.current.forEach((c) => c.blobUrl && URL.revokeObjectURL(c.blobUrl)); }, []);

  const actualizar = useCallback((key: string, cambios: Partial<JugadaUI>) => {
    // La cola lee clipsRef: se actualiza al tiro, sin esperar al render
    clipsRef.current = clipsRef.current.map((c) => (c.key === key ? { ...c, ...cambios } : c));
    setClips((prev) => prev.map((c) => (c.key === key ? { ...c, ...cambios } : c)));
  }, []);

  /* ── cola de preparación: un clip a la vez, en segundo plano ── */
  const colaRef = useRef<string[]>([]);
  const trabajandoRef = useRef(false);

  const procesarCola = useCallback(async () => {
    if (trabajandoRef.current) return;
    trabajandoRef.current = true;
    while (colaRef.current.length) {
      const key = colaRef.current.shift()!;
      const c = clipsRef.current.find((x) => x.key === key);
      if (!c) continue;
      const ed: Edicion = c.edicion ?? { formato: "reel", seguimiento: null };
      actualizar(key, { proceso: "procesando", progreso: 0, error: undefined });
      setAviso({ key, tipo: "preparando" });
      // La bajada cuenta hasta 30% y el recorte el resto. Se actualiza como mucho 4 veces
      // por segundo: cada actualización redibuja la barra lateral.
      let fase: FaseDescarga = "video";
      let ultimoAviso = 0;
      try {
        const { url, blob } = await exportarClip({
          videoUrl, inicioSeg: c.inicioSeg, finSeg: c.finSeg,
          formato: ed.formato,
          seguimiento: ed.seguimiento,
          vistaFija: { cx: ed.cx ?? 0.5, cy: 0.5, zoom: 1 },
          speed: ed.velocidad ?? 1, brightness: ed.brillo ?? 100, contrast: ed.contraste ?? 100,
          onFase: (f) => { fase = f; },
          onProgreso: (p) => {
            const ahora = Date.now();
            if (ahora - ultimoAviso < 250) return;
            ultimoAviso = ahora;
            actualizar(key, { progreso: fase === "procesando" ? 30 + Math.round(p * 0.7) : Math.round(p * 0.3) });
          },
        });
        actualizar(key, { proceso: "listo", progreso: 100, blobUrl: url, blob });
        setAviso({ key, tipo: "lista" });
      } catch (err) {
        actualizar(key, { proceso: "error", error: err instanceof Error ? err.message : "No se pudo preparar el video" });
        setAviso({ key, tipo: "error" });
      }
    }
    trabajandoRef.current = false;
  }, [videoUrl, actualizar]);

  const encolar = useCallback((key: string) => {
    if (!colaRef.current.includes(key)) colaRef.current.push(key);
    actualizar(key, { proceso: "cola", progreso: 0 });
    // Esperar a que el estado incluya la jugada antes de procesar
    setTimeout(() => procesarCola(), 0);
  }, [actualizar, procesarCola]);

  /* ── jugada creada en el reproductor ── */
  const handleCrearJugada = useCallback(async (j: NuevaJugada) => {
    const key = crypto.randomUUID();
    const nueva: JugadaUI = { key, id: null, ...j, proceso: "cola", progreso: 0 };
    clipsRef.current = [nueva, ...clipsRef.current];
    setClips((prev) => [nueva, ...prev]);
    encolar(key);

    registrarDescarga({
      partidoId, complejo, inicioSeg: j.inicioSeg, finSeg: j.finSeg,
      etiqueta: j.etiqueta, tipo: "destacado", origen: "partido",
    });

    try {
      const id = await insertarJugada({
        partido_id: partidoId,
        etiqueta: j.etiqueta,
        inicio_seg: j.inicioSeg,
        fin_seg: j.finSeg,
        duracion: j.duracion,
        edicion: j.edicion,
      });
      if (id) {
        actualizar(key, { id });
        marcarComoMia(id);
      }
    } catch {
      // Sin conexión con la base: la jugada queda solo en esta visita
    }
  }, [encolar, actualizar, partidoId, complejo]);

  // Marcas de la barra de tiempo: solo cambian si cambian las jugadas (no con el progreso),
  // así el reproductor no se vuelve a dibujar mientras se prepara un clip.
  const firmaMarcas = clips.map((c) => `${c.key}|${c.etiqueta}|${c.inicioSeg}|${c.finSeg}`).join(",");
  const marcas = useMemo(
    () => clips.map((c) => ({ id: c.key, etiqueta: c.etiqueta, inicioSeg: c.inicioSeg, finSeg: c.finSeg })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firmaMarcas],
  );

  /* ── preparar / descargar desde la barra lateral ── */
  function handlePreparar(c: JugadaUI, formato?: Edicion["formato"]) {
    setEligiendoKey(null);
    if (formato) actualizar(c.key, { edicion: { formato, seguimiento: null, cx: 0.5 } });
    // Para jugadas antiguas (sin formato guardado) primero se elige el formato
    else if (!c.edicion) { setEligiendoKey(c.key); return; }
    setTimeout(() => encolar(c.key), 0);
  }

  function handleDescargar(c: JugadaUI) {
    if (!c.blob || !c.blobUrl) return;
    guardarVideo(c.blob, c.blobUrl, nombreVideo(c.etiqueta, c.edicion?.formato ?? "reel"));
    registrarDescarga({
      partidoId, jugadaId: c.id ?? undefined, complejo, inicioSeg: c.inicioSeg, finSeg: c.finSeg,
      etiqueta: c.etiqueta, tipo: "descarga", origen: "partido",
    });
  }

  function handleBorrar(c: JugadaUI) {
    if (confirmarBorrarKey !== c.key) { setConfirmarBorrarKey(c.key); return; }
    setConfirmarBorrarKey(null);
    colaRef.current = colaRef.current.filter((k) => k !== c.key);
    if (c.blobUrl) URL.revokeObjectURL(c.blobUrl);
    clipsRef.current = clipsRef.current.filter((x) => x.key !== c.key);
    setClips((prev) => prev.filter((x) => x.key !== c.key));
    if (playingKey === c.key) setPlayingKey(null);
    if (aviso?.key === c.key) setAviso(null);
    if (c.id) borrarJugada(partidoId, c.id);
  }

  /* ── aviso flotante ── */
  const avisoClip = aviso ? clips.find((c) => c.key === aviso.key) : undefined;
  useEffect(() => {
    if (aviso?.tipo !== "lista" && aviso?.tipo !== "error") return;
    const t = setTimeout(() => setAviso(null), 12000);
    return () => clearTimeout(t);
  }, [aviso]);

  function verEnLista(key: string) {
    setAviso(null);
    // Si se está viendo en pantalla completa, salir para mostrar la jugada en la lista
    window.dispatchEvent(new Event("lacar:salir-pantalla-completa"));
    setPlayingKey(key);
    setDestacadaKey(key);
    setTimeout(() => document.getElementById(`jugada-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    setTimeout(() => setDestacadaKey(null), 2500);
  }

  /* ── sidebar copy link / share ── */

  function handleSidebarCopyLink(c: JugadaUI) {
    if (!c.id) return;
    navigator.clipboard.writeText(`${window.location.origin}/jugada/${c.id}`).catch(() => {});
    setCopiedLinkKey(c.key);
    setTimeout(() => setCopiedLinkKey(null), 2000);
  }

  async function handleSidebarShare(c: JugadaUI) {
    if (!c.id) return;
    const url = `${window.location.origin}/jugada/${c.id}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `Jugada: ${c.etiqueta}`, text: `Mirá esta jugada (${c.etiqueta})`, url });
        return;
      } catch { /* cancelled */ }
    }
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiadoKey(c.key);
    setTimeout(() => setCopiadoKey(null), 2000);
  }

  const iconoDescarga = (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );

  /* ── render ── */

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-5 items-start">

        {/* Main: video + clip selector */}
        <VideoClipSelector
          src={videoUrl}
          videoUrl={videoUrl}
          title={title}
          partidoId={partidoId}
          deporte={deporte}
          complejo={complejo}
          numeroCancha={numeroCancha}
          hora={hora}
          clips={marcas}
          onCrearJugada={handleCrearJugada}
          onPlayStart={handlePlayStart}
        />

        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink-950 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
              </svg>
              Jugadas destacadas del partido
            </h3>
            {clips.length > 0 && (
              <span className="text-xs font-bold text-white bg-brand px-2 py-0.5 rounded-full tabular-nums">
                {clips.length}
              </span>
            )}
          </div>

          {/* Empty state */}
          {clips.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-2xl border border-dashed border-ink-300/60">
              <div className="w-11 h-11 rounded-2xl bg-brand-soft flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-brand-ink" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed max-w-[220px]">
                Marca el inicio y el fin de una jugada en el video y aparecerá aquí
              </p>
            </div>
          )}

          {/* Clip list */}
          {clips.length > 0 && (
            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-0.5">
              {clips.map((clip, idx) => {
                const isCopied = copiadoKey === clip.key;
                const isCopiedLink = copiedLinkKey === clip.key;
                const isExpanded = playingKey === clip.key;
                const esReel = clip.edicion?.formato === "reel";

                return (
                  <div
                    key={clip.key}
                    id={`jugada-${clip.key}`}
                    className={`bg-white border rounded-2xl overflow-hidden transition-colors ${destacadaKey === clip.key ? "border-brand" : "border-line hover:border-ink-300"}`}
                  >
                    {/* Header — click to toggle player */}
                    <button
                      onClick={() => setPlayingKey(isExpanded ? null : clip.key)}
                      className="w-full flex items-center gap-2 px-3 py-3 transition-colors"
                    >
                      <span className="text-ink-300 text-[11px] font-mono shrink-0">#{clips.length - idx}</span>
                      <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full border ${tagStyle(clip.etiqueta)}`}>
                        {clip.etiqueta}
                      </span>
                      {clip.edicion && (
                        <span className="shrink-0 text-[11px] text-ink-500 border border-line rounded px-1">
                          {esReel ? "9:16" : "16:9"}
                        </span>
                      )}
                      <span className="text-[13px] font-mono text-ink-700 flex-1 min-w-0 truncate text-left">
                        {horaDeJugada(hora, clip.inicioSeg) ?? fmt(clip.inicioSeg)}
                      </span>
                      <span className="text-[13px] font-mono text-ink-500 shrink-0">{fmt(clip.duracion)}</span>
                      <svg
                        className={`w-3 h-3 text-ink-300 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expandable player: el reel se ve vertical, con su seguimiento */}
                    <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? (esReel ? "max-h-[440px]" : "max-h-[320px]") : "max-h-0"}`}>
                      {isExpanded && (
                        <InlineClipPlayer
                          // Al quedar listo el video se cambia de fuente: montar de nuevo, limpio
                          key={clip.blobUrl ? "listo" : "vivo"}
                          videoUrl={videoUrl}
                          inicioSeg={clip.inicioSeg}
                          finSeg={clip.finSeg}
                          duracion={clip.duracion}
                          blobUrl={clip.blobUrl}
                          edicion={clip.edicion}
                          className={esReel ? "aspect-[9/16] w-full max-w-[230px] mx-auto" : undefined}
                          compact
                        />
                      )}
                    </div>

                    {/* Acciones: vista previa y descarga lado a lado; abajo, compartir y borrar */}
                    <div className="px-3 pb-3 pt-1.5 space-y-2">
                      {clip.proceso === "error" && (
                        <p className="text-xs text-red-600">{clip.error}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setPlayingKey(isExpanded ? null : clip.key)}
                          aria-expanded={isExpanded}
                          className={`flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl py-2.5 border transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${
                            isExpanded ? "bg-brand-soft border-brand/40 text-brand-ink" : "bg-white border-brand text-brand-ink hover:bg-brand-soft"
                          }`}
                        >
                          {isExpanded ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          )}
                          {isExpanded ? "Cerrar" : "Vista previa"}
                        </button>

                        {(clip.proceso === "cola" || clip.proceso === "procesando") ? (
                          <div className="relative flex items-center justify-center rounded-xl bg-surface overflow-hidden text-[13px] font-semibold text-ink-700">
                            <div className="absolute inset-y-0 left-0 bg-brand/15 transition-[width] duration-300" style={{ width: `${Math.max(4, clip.progreso ?? 0)}%` }} />
                            <span className="relative flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                              {clip.proceso === "cola" ? "En espera" : <>Preparando <span className="font-mono tabular-nums">{clip.progreso ?? 0}%</span></>}
                            </span>
                          </div>
                        ) : clip.proceso === "listo" ? (
                          <button
                            onClick={() => handleDescargar(clip)}
                            className="flex items-center justify-center gap-1.5 text-sm font-bold bg-brand text-white hover:bg-brand-hover rounded-xl py-2.5 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                          >
                            {iconoDescarga}
                            Descargar
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePreparar(clip)}
                            className="flex items-center justify-center gap-1.5 text-sm font-bold bg-brand text-white hover:bg-brand-hover rounded-xl py-2.5 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                          >
                            {iconoDescarga}
                            {clip.proceso === "error" ? "Reintentar" : "Descargar"}
                          </button>
                        )}
                      </div>

                      {eligiendoKey === clip.key && (
                        <ElegirFormato
                          onElegir={(f) => handlePreparar(clip, f)}
                          onCancelar={() => setEligiendoKey(null)}
                        />
                      )}

                      <div className="flex gap-2">
                        {clip.id && (
                          <>
                            <button
                              onClick={() => handleSidebarShare(clip)}
                              className={`flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium border transition-[border-color,transform] duration-150 active:scale-[0.97] py-2 rounded-xl ${
                                isCopied ? "border-brand/50 text-brand-ink bg-brand-soft" : "border-line text-ink-700 hover:border-ink-300"
                              }`}
                            >
                              {isCopied ? "Copiado" : "Compartir link"}
                            </button>
                            <button
                              onClick={() => handleSidebarCopyLink(clip)}
                              className={`flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium border transition-[border-color,transform] duration-150 active:scale-[0.97] py-2 rounded-xl ${
                                isCopiedLink ? "border-brand/50 text-brand-ink bg-brand-soft" : "border-line text-ink-700 hover:border-ink-300"
                              }`}
                            >
                              {isCopiedLink ? "Copiado" : "Copiar link"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleBorrar(clip)}
                          aria-label={confirmarBorrarKey === clip.key ? "Confirmar borrar jugada" : "Borrar jugada"}
                          className={`shrink-0 flex items-center justify-center gap-1.5 border rounded-xl py-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                            confirmarBorrarKey === clip.key
                              ? `${clip.id ? "px-3" : "flex-1"} bg-red-50 border-red-200 text-red-600 text-[13px] font-semibold`
                              : `${clip.id ? "w-10" : "flex-1"} border-line text-ink-500 hover:text-red-600 hover:border-red-200`
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                          {confirmarBorrarKey === clip.key && "¿Borrar?"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Aviso flotante (también visible en pantalla completa): progreso y "lista".
          Va bajo la barra de navegación (72px) para no taparla. */}
      {aviso && avisoClip && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[10001] w-[min(92vw,380px)]"
          style={{ top: "calc(env(safe-area-inset-top) + 5.5rem)" }}
          role="status"
        >
          <div key={aviso.tipo} className="aviso-entrada flex items-center gap-3 bg-white border border-line rounded-2xl pl-3.5 pr-2 py-2.5 shadow-[0_14px_40px_-10px_rgba(11,29,38,0.3)]">
            {aviso.tipo === "preparando" ? (
              <>
                <span className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                  <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold text-ink-950 truncate">Preparando «{avisoClip.etiqueta}»</p>
                    <span className="text-[11px] font-mono tabular-nums text-ink-500 shrink-0">{avisoClip.progreso ?? 0}%</span>
                  </div>
                  <div className="mt-1.5 w-full bg-surface rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(4, avisoClip.progreso ?? 0)}%` }} />
                  </div>
                </div>
                <button onClick={() => setAviso(null)} className="text-xs font-semibold text-ink-500 hover:text-ink-950 px-2.5 py-2 rounded-lg active:scale-[0.97] transition-transform">Ocultar</button>
              </>
            ) : aviso.tipo === "lista" ? (
              <>
                <span className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </span>
                <p className="text-[13px] font-semibold text-ink-950 flex-1 min-w-0 truncate">«{avisoClip.etiqueta}» está lista</p>
                <button onClick={() => verEnLista(aviso.key)} className="text-xs font-semibold text-brand-ink px-2 py-2 rounded-lg active:scale-[0.97] transition-transform">Ver</button>
                <button
                  onClick={() => { handleDescargar(avisoClip); setAviso(null); }}
                  className="text-xs font-bold bg-brand text-white rounded-xl px-3.5 py-2 active:scale-[0.97] transition-transform"
                >Descargar</button>
                <button onClick={() => setAviso(null)} aria-label="Cerrar" className="text-ink-300 hover:text-ink-700 w-8 h-8 flex items-center justify-center rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </>
            ) : (
              <>
                <span className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 8v5m0 3.5h.01" /></svg>
                </span>
                <p className="text-[13px] font-semibold text-ink-950 flex-1 min-w-0">No se pudo preparar «{avisoClip.etiqueta}»</p>
                <button onClick={() => verEnLista(aviso.key)} className="text-xs font-semibold text-brand-ink px-2 py-2">Ver</button>
                <button onClick={() => setAviso(null)} aria-label="Cerrar" className="text-ink-300 hover:text-ink-700 w-8 h-8 flex items-center justify-center rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

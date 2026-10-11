"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import Hls from "hls.js";
import type { FormatoClip } from "@/lib/marcaAgua";
import MarcaAguaVivo from "@/app/components/MarcaAguaVivo";
import { ventana, zoomMinimo, haySeguimiento, compactarSeguimiento, ZOOM_MAX, type Vista, type KeyframeVista } from "@/lib/encuadre";
import { avisarReproduccion } from "./exportarClip";
import { useAjustesReproductor, setAjustes, getAjustes, filtroImagen } from "@/lib/ajustesReproductor";
import type { Edicion } from "@/lib/jugadas";
import FormularioJugada from "./FormularioJugada";
import BarraImagen from "./BarraImagen";

/** Jugada creada en el reproductor: se guarda como destacada y se prepara en segundo plano. */
export interface NuevaJugada {
  etiqueta: string;
  inicioSeg: number;
  finSeg: number;
  duracion: number;
  edicion: Edicion;
}

/** Marca de una jugada en la barra de tiempo. */
export interface MarcaJugada {
  id: string;
  etiqueta: string;
  inicioSeg: number;
  finSeg: number;
}

type Estado = "idle" | "grabando" | "preview";

// Duración máxima de un clip en segundos (también se valida en /api/clip y processClip).
export const MAX_CLIP_SEG = 120;

const ETIQUETAS_FUTBOL = ["Gol", "Caño", "Buena jugada", "Atajada", "Blooper", "Otro"] as const;
const ETIQUETAS_PADEL  = ["Smash", "Finta (amago)", "Buen Punto", "Blooper", "Otro"] as const;

function getEtiquetas(deporte?: string | null): readonly string[] {
  const d = (deporte ?? "").toLowerCase();
  if (d.includes("padel") || d.includes("pádel")) return ETIQUETAS_PADEL;
  return ETIQUETAS_FUTBOL;
}

const MARKER_COLORS: Record<string, { bg: string; text: string }> = {
  Gol:              { bg: "bg-crystal-400",  text: "text-crystal-300" },
  Atajada:          { bg: "bg-glacial-400",  text: "text-glacial-300" },
  Caño:             { bg: "bg-pine-400",     text: "text-pine-400"    },
  "Buena jugada":   { bg: "bg-mist-400",     text: "text-mist-400"    },
  Blooper:          { bg: "bg-amber-400",    text: "text-amber-300"   },
  Otro:             { bg: "bg-mist-600",     text: "text-mist-600"    },
  Smash:            { bg: "bg-crystal-400",  text: "text-crystal-300" },
  "Finta (amago)":  { bg: "bg-pine-400",     text: "text-pine-400"    },
  "Buen Punto":     { bg: "bg-mist-400",     text: "text-mist-400"    },
};

/** "10:00 - 11:00" → segundos desde medianoche del inicio (null si no se entiende). */
function inicioDelBloque(hora?: string): number | null {
  const m = hora?.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
}

/** Hora del día "HH:MM:SS". */
function fmtHora(seg: number) {
  const s = Math.floor(seg) % 86400;
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function fmt(seg: number, decimals = false) {
  const min = Math.floor(seg / 60);
  const s = decimals
    ? (seg % 60).toFixed(1).padStart(4, "0")
    : Math.floor(seg % 60).toString().padStart(2, "0");
  return `${min}:${s}`;
}

interface Props {
  src: string;
  title: string;
  videoUrl: string;
  partidoId: string;
  deporte?: string | null;
  complejo?: string;
  numeroCancha?: number;
  /** Bloque horario del partido ("10:00 - 11:00"): se muestra la hora real del momento del video. */
  hora?: string;
  clips?: MarcaJugada[];
  onCrearJugada?: (jugada: NuevaJugada) => void;
  onPlayStart?: () => void;
}

// Detecta el dispositivo a partir del user-agent: iPhone, Android o Desktop.
function detectDispositivo(): string {
  if (typeof navigator === "undefined") return "Desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  return "Desktop";
}

// Detecta el navegador: Chrome, Safari o Firefox (orden importa: Chrome incluye "Safari").
function detectNavegador(): string {
  if (typeof navigator === "undefined") return "Desconocido";
  const ua = navigator.userAgent;
  if (/Firefox\/|FxiOS/i.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS|Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Otro";
}

// memo: la página se vuelve a dibujar con el progreso de los clips en preparación;
// el reproductor solo cuando cambian sus propias props.
export default memo(VideoClipSelector);

function VideoClipSelector({ src, title, partidoId, deporte, complejo, numeroCancha, hora, clips, onCrearJugada, onPlayStart }: Props) {
  const ETIQUETAS = getEtiquetas(deporte);
  const horaBase = inicioDelBloque(hora);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  const [estado, setEstado] = useState<Estado>("idle");
  const [inicioSeg, setInicioSeg] = useState<number | null>(null);
  const [finSeg, setFinSeg] = useState<number | null>(null);
  const [autoDetenido, setAutoDetenido] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [etiquetaCustom, setEtiquetaCustom] = useState("");
  const [formatoSel, setFormatoSel] = useState<FormatoClip>("reel");
  const [conSeguimiento, setConSeguimiento] = useState(true);

  // Volumen, brillo, contraste y velocidad: compartidos con los reproductores de jugadas.
  const ajustes = useAjustesReproductor();
  const { volumen: volume, brillo: brightness, contraste: contrast, velocidad: playbackSpeed } = ajustes;
  const setVolume = (v: number) => setAjustes({ volumen: v });
  const setPlaybackSpeed = (v: number) => setAjustes({ velocidad: v });
  const [showImageSettings, setShowImageSettings] = useState(false);
  // Barra flotante de brillo/contraste (deja ver el video mientras se ajusta)
  const [showBarraImagen, setShowBarraImagen] = useState(false);

  const [prevVolume, setPrevVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Encuadre actual: centro (0–1 del cuadro original) y zoom (alto original / alto visible).
  // Se aplica directo al <video> (applyView) sin pasar por React, para que arrastrar y
  // pellizcar vayan fluidos. `zoom` (estado) solo refleja el valor para la interfaz.
  const vistaRef = useRef<Vista>({ cx: 0.5, cy: 0.5, zoom: 1 });
  const ventanaRef = useRef({ x: 0, y: 0, w: 1, h: 1, s: 1, sw: 16, sh: 9, R: 16 / 9 });
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [srcAspect, setSrcAspect] = useState(16 / 9);
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  // Seguimiento: encuadres registrados mientras se graba la jugada (tiempo de la playlist).
  const seguimientoRef = useRef<KeyframeVista[]>([]);
  const [seguimiento, setSeguimiento] = useState<KeyframeVista[]>([]);
  const estadoRef = useRef<Estado>("idle");

  // Gestos táctiles (pellizcar / arrastrar)
  const gestureRef = useRef<{ modo: "pan" | "pinch" | null; x: number; y: number; d0: number; z0: number }>({ modo: null, x: 0, y: 0, d0: 0, z0: 1 });
  const gestureMovedRef = useRef(false);

  const [buffering, setBuffering] = useState(true);
  // Porcentaje del video ya cargado (barra clara estilo YouTube en la seekbar)
  const [bufferedPct, setBufferedPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // Flash central de play/pausa (estilo YouTube), solo escritorio
  const [playFlash, setPlayFlash] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  const playFlashIdRef = useRef(0);
  const playFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [skipLeft, setSkipLeft] = useState(0);
  const [skipRight, setSkipRight] = useState(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipLeftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const seekingRef = useRef(false);
  const isSeekingDrag = useRef(false);
  const hasDraggedRef = useRef(false);
  const showMobileControlsRef = useRef(false);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [mobileControlsOpaque, setMobileControlsOpaque] = useState(false);
  const mobileAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [settingsSheetOpened, setSettingsSheetOpened] = useState(false);

  // Pantalla completa en el celular: vertical = modo reel (cuadro 9:16, lo mismo que
  // tendrá el reel descargado); celular girado = partido completo horizontal.
  const modoReel = isMobile && isCustomFullscreen && !isLandscape;

  // Reportar problema (jugador)
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportToast, setReportToast] = useState(false);

  function openReportSheet() {
    setReportError(null);
    setShowImageSettings(false);
    closeSettingsSheet();
    // El modal de reporte usa position:fixed y necesita teclado: si estamos en
    // pantalla completa quedaría tapado por el contenedor (z-index 9999), así
    // que salimos de pantalla completa antes de abrirlo.
    if (isCustomFullscreen) {
      setIsCustomFullscreen(false);
      closeMobileControls();
    }
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setShowReportSheet(true);
  }

  async function handleEnviarReporte() {
    if (!reportText.trim() || reportSending) return;
    setReportSending(true);
    setReportError(null);
    try {
      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: "jugador",
          comentario: reportText.trim(),
          complejo: complejo ?? null,
          numero_cancha: numeroCancha ?? null,
          partido_id: partidoId,
          dispositivo: detectDispositivo(),
          navegador: detectNavegador(),
          url_pagina: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      setReportText("");
      setShowReportSheet(false);
      setReportToast(true);
      setTimeout(() => setReportToast(false), 2800);
    } catch {
      setReportError("No se pudo enviar el reporte. Intenta de nuevo.");
    } finally {
      setReportSending(false);
    }
  }

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackSpeed; }, [playbackSpeed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = volume === 0;
  }, [volume]);

  useEffect(() => { estadoRef.current = estado; }, [estado]);

  // "Ver" en el aviso de jugada lista: salir de pantalla completa para mostrar la lista
  useEffect(() => {
    const salir = () => {
      setIsCustomFullscreen(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
    window.addEventListener("lacar:salir-pantalla-completa", salir);
    return () => window.removeEventListener("lacar:salir-pantalla-completa", salir);
  }, []);

  // Guarda el encuadre actual en el seguimiento mientras se graba la jugada.
  const registrarVista = useCallback(() => {
    const v = videoRef.current;
    if (!v || estadoRef.current !== "grabando") return;
    const kf = seguimientoRef.current;
    const nuevo: KeyframeVista = { t: v.currentTime, ...vistaRef.current };
    const ultimo = kf[kf.length - 1];
    if (ultimo && nuevo.t - ultimo.t < 0.03) kf[kf.length - 1] = { ...nuevo, t: Math.max(ultimo.t, nuevo.t) };
    else kf.push(nuevo);
  }, []);

  /**
   * Pinta el encuadre (vistaRef) en el <video>: el cuadro visible (frame) muestra una
   * ventana del video original con la forma del frame (16:9 normal, 9:16 en modo reel).
   * El zoom se mide como alto original / alto visible, igual que al exportar.
   */
  const applyView = useCallback(() => {
    const v = videoRef.current, frame = frameRef.current;
    if (!v || !frame) return;
    const Fw = frame.clientWidth, Fh = frame.clientHeight;
    if (!Fw || !Fh) return;
    const sw = v.videoWidth || 16, sh = v.videoHeight || 9;
    const R = Fw / Fh;
    // En el reel se puede alejar hasta ver todo el ancho (con franjas negras arriba y abajo).
    const { x, y, w, h, zoom: z } = ventana(R, sw, sh, vistaRef.current);
    vistaRef.current = { cx: (x + w / 2) / sw, cy: (y + h / 2) / sh, zoom: z };
    const s = Fw / w;
    ventanaRef.current = { x, y, w, h, s, sw, sh, R };
    v.style.width = `${sw * s}px`;
    v.style.height = `${sh * s}px`;
    v.style.transform = `translate(${-x * s}px, ${-y * s}px)`;
    registrarVista();
  }, [registrarVista]);

  /** Zoom anclado a un punto del frame (px desde su esquina), que queda fijo en pantalla. */
  const zoomEn = useCallback((nuevoZoom: number, px?: number, py?: number) => {
    const frame = frameRef.current;
    const { x, y, s, sw, sh, R } = ventanaRef.current;
    const z = Math.max(zoomMinimo(R, sw, sh), Math.min(ZOOM_MAX, nuevoZoom));
    const ax = px ?? (frame ? frame.clientWidth / 2 : 0);
    const ay = py ?? (frame ? frame.clientHeight / 2 : 0);
    // Punto del video original bajo el ancla, antes del zoom
    const srcX = x + ax / s, srcY = y + ay / s;
    const s2 = s * (z / vistaRef.current.zoom);
    const w2 = (frame?.clientWidth ?? 0) / s2, h2 = (frame?.clientHeight ?? 0) / s2;
    const x2 = srcX - ax / s2, y2 = srcY - ay / s2;
    vistaRef.current = { cx: (x2 + w2 / 2) / sw, cy: (y2 + h2 / 2) / sh, zoom: z };
    applyView();
    setZoom(Math.round(vistaRef.current.zoom * 10) / 10);
  }, [applyView]);

  /** Desplaza el encuadre según el arrastre del dedo/mouse (px de pantalla). */
  const moverVista = useCallback((dx: number, dy: number) => {
    const { s, sw, sh } = ventanaRef.current;
    const v = vistaRef.current;
    vistaRef.current = { ...v, cx: v.cx - dx / (s * sw), cy: v.cy - dy / (s * sh) };
    applyView();
  }, [applyView]);

  /** ¿Hay espacio para arrastrar? (con zoom, o en modo reel donde se ve solo una franja) */
  function puedeMover() {
    const { w, h, sw, sh } = ventanaRef.current;
    return w < sw - 1 || h < sh - 1;
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => applyView());
    ro.observe(frame);
    return () => ro.disconnect();
  }, [applyView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 15;
      if (e.deltaMode === 2) delta *= 400;
      const factor = Math.exp(-delta * 0.002);
      const rect = frameRef.current?.getBoundingClientRect();
      zoomEn(vistaRef.current.zoom * factor, rect ? e.clientX - rect.left : undefined, rect ? e.clientY - rect.top : undefined);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomEn]);

  // Gestos táctiles: un dedo arrastra el encuadre, dos dedos hacen zoom (pellizcar).
  // Listeners nativos con passive:false para poder evitar el scroll/zoom de la página.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const esControl = (t: EventTarget | null) =>
      !!(t as HTMLElement | null)?.closest?.("button, input, [data-no-gesture]");
    const distancia = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const centro = (ts: TouchList) => ({ x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 });

    const onStart = (e: TouchEvent) => {
      if (esControl(e.target)) { gestureRef.current.modo = null; return; }
      const g = gestureRef.current;
      if (e.touches.length === 1) {
        gestureMovedRef.current = false;
        g.modo = "pan"; g.x = e.touches[0].clientX; g.y = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const c = centro(e.touches);
        g.modo = "pinch"; g.d0 = distancia(e.touches); g.z0 = vistaRef.current.zoom; g.x = c.x; g.y = c.y;
        gestureMovedRef.current = true;
        e.preventDefault();
      }
    };
    const onMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (g.modo === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const c = centro(e.touches);
        const rect = frameRef.current?.getBoundingClientRect();
        moverVista(c.x - g.x, c.y - g.y);
        g.x = c.x; g.y = c.y;
        zoomEn(g.z0 * (distancia(e.touches) / g.d0), rect ? c.x - rect.left : undefined, rect ? c.y - rect.top : undefined);
      } else if (g.modo === "pan" && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - g.x, dy = t.clientY - g.y;
        if (!gestureMovedRef.current && Math.hypot(dx, dy) < 6) return;
        if (!puedeMover()) return; // sin zoom en vista normal: dejar que la página haga scroll
        e.preventDefault();
        gestureMovedRef.current = true;
        moverVista(dx, dy);
        g.x = t.clientX; g.y = t.clientY;
      }
    };
    const onEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (e.touches.length === 1) {
        // Quedó un dedo tras pellizcar: sigue arrastrando desde ahí sin saltos
        g.modo = "pan"; g.x = e.touches[0].clientX; g.y = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        g.modo = null;
      }
    };
    // Safari iOS: evita que el pellizco haga zoom a toda la página
    const onGesture = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("gesturestart", onGesture);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("gesturestart", onGesture);
    };
  }, [moverVista, zoomEn]);

  // Al cambiar de modo (pantalla completa, rotación, video cargado) recalcular el encuadre.
  useEffect(() => {
    const id = requestAnimationFrame(() => applyView());
    const t = setTimeout(applyView, 120); // por si el layout tarda (barra de Safari, rotación)
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
  }, [isCustomFullscreen, isLandscape, isFullscreen, srcAspect, applyView]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    // En fullscreen el sheet vive DENTRO del contenedor (que ya bloquea el
    // scroll del body); touchAction:none en el body además impediría hacer
    // scroll dentro del propio sheet.
    if (showSettingsSheet && !isCustomFullscreen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      };
    }
  }, [showSettingsSheet, isCustomFullscreen]);

  useEffect(() => {
    if (isCustomFullscreen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isCustomFullscreen]);

  useEffect(() => { showMobileControlsRef.current = showMobileControls; }, [showMobileControls]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") { e.preventDefault(); e.stopPropagation(); togglePlay(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); handleSkip("right"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); handleSkip("left"); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); setAjustes({ volumen: getAjustes().volumen === 0 ? 1 : 0 }); }
      else if (e.key === "g" || e.key === "G") { e.preventDefault(); setShowBarraImagen((s) => !s); }
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const check = () => {
      // No basta con el ancho: un teléfono rotado a horizontal supera los 768px
      // (iPhone landscape = 812px) y caía a los controles de escritorio, donde
      // el fullscreen nativo sobre <div> no existe en iOS. El puntero "coarse"
      // (táctil) identifica al dispositivo móvil en cualquier orientación.
      const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      setIsMobile(coarse || window.innerWidth < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    check();
    // iOS reporta dimensiones obsoletas justo al rotar: re-chequeamos con un pequeño retraso
    // para que isLandscape refleje la orientación real y no se aplique la rotación CSS encima
    // de un viewport que ya está físicamente en horizontal (doble rotación).
    const checkDeferred = () => { check(); setTimeout(check, 250); setTimeout(check, 600); };
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", checkDeferred);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", checkDeferred);
    };
  }, []);

  useEffect(() => {
    if (!src.includes(".m3u8")) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = src; video.load(); return; }
    if (!Hls.isSupported()) return;
    // Buffer adelantado generoso: permite pausar y dejar que el video cargue
    // varios minutos por delante (backBufferLength acota la memoria hacia atrás).
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 120, maxMaxBufferLength: 300, backBufferLength: 90 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      }
    });
    let userPaused = false;
    video.addEventListener("pause", () => { userPaused = true; });
    video.addEventListener("play", () => { userPaused = false; });
    video.addEventListener("waiting", () => { setTimeout(() => { if (video.paused && !userPaused) video.play().catch(() => {}); }, 800); });
    return () => hls.destroy();
  }, [src]);

  // Hasta dónde llegó la carga del rango que contiene el tiempo actual.
  const updateBuffered = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const t = v.currentTime;
    let end = t;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= t + 0.5 && v.buffered.end(i) >= t) { end = v.buffered.end(i); break; }
    }
    setBufferedPct(Math.min(100, (end / v.duration) * 100));
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const duracionClip = inicioSeg !== null && finSeg !== null ? finSeg - inicioSeg : null;
  const isGrabando = estado === "grabando";

  function getEtiquetaFinal() {
    if (!etiqueta) return "";
    return etiqueta === "Otro" ? etiquetaCustom.trim() || "Otro" : etiqueta;
  }
  function puedeActuar() { return etiqueta !== null && (etiqueta !== "Otro" || etiquetaCustom.trim() !== ""); }

  function openMobileControls() {
    setShowMobileControls(true);
    requestAnimationFrame(() => setMobileControlsOpaque(true));
    resetMobileAutoHide();
  }

  function closeMobileControls() {
    setMobileControlsOpaque(false);
    setShowVolumeSlider(false);
    if (mobileAutoHideRef.current) { clearTimeout(mobileAutoHideRef.current); mobileAutoHideRef.current = null; }
    setTimeout(() => setShowMobileControls(false), 200);
  }

  function openSettingsSheet() {
    setShowSettingsSheet(true);
    requestAnimationFrame(() => setSettingsSheetOpened(true));
  }

  function closeSettingsSheet() {
    setSettingsSheetOpened(false);
    setTimeout(() => setShowSettingsSheet(false), 300);
  }

  function resetMobileAutoHide() {
    if (mobileAutoHideRef.current) clearTimeout(mobileAutoHideRef.current);
    const v = videoRef.current;
    if (v && !v.paused) {
      mobileAutoHideRef.current = setTimeout(() => closeMobileControls(), 3000);
    }
  }

  function handleMobileVolumeTap() {
    if (!showVolumeSlider) {
      setShowVolumeSlider(true);
      if (volume === 0) setVolume(prevVolume > 0 ? prevVolume : 1);
    } else if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      setShowVolumeSlider(false);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 1);
    }
  }

  function flashPlayPause(type: "play" | "pause") {
    if (isMobile) return; // en móvil el feedback ya lo dan los controles
    const id = playFlashIdRef.current + 1;
    playFlashIdRef.current = id;
    setPlayFlash({ type, id });
    if (playFlashTimerRef.current) clearTimeout(playFlashTimerRef.current);
    playFlashTimerRef.current = setTimeout(() => setPlayFlash(null), 550);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); flashPlayPause("play"); }
    else { v.pause(); flashPlayPause("pause"); }
  }

  async function toggleFullscreen() {
    if (isMobile) {
      // Sin rotar ni bloquear orientación: vertical = modo reel, girado = horizontal.
      setIsCustomFullscreen(!isCustomFullscreen);
      return;
    }
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) { document.exitFullscreen?.().catch(() => {}); return; }
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(e => console.error("Fullscreen error:", e));
  }

  function handleSkip(direction: "left" | "right") {
    const v = videoRef.current;
    if (!v) return;
    const amount = 5;
    if (direction === "left") {
      v.currentTime = Math.max(0, v.currentTime - amount);
      setSkipLeft((prev) => {
        if (skipLeftTimerRef.current) clearTimeout(skipLeftTimerRef.current);
        skipLeftTimerRef.current = setTimeout(() => setSkipLeft(0), 900);
        return prev + amount;
      });
    } else {
      v.currentTime = Math.min(v.duration || 0, v.currentTime + amount);
      setSkipRight((prev) => {
        if (skipRightTimerRef.current) clearTimeout(skipRightTimerRef.current);
        skipRightTimerRef.current = setTimeout(() => setSkipRight(0), 900);
        return prev + amount;
      });
    }
    resetControlsTimer();
  }

  // El contenedor ya no se rota en pantalla completa: el seekbar siempre es horizontal.
  function seekToPointer(clientX: number, _clientY: number) {
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
    setCurrentTime(pct * v.duration);
  }

  function handleSeekBarMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // no mover el encuadre del video al arrastrar la barra
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingDrag.current = true;
    seekingRef.current = true;
    seekToPointer(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => seekToPointer(ev.clientX, ev.clientY);
    const onUp = () => {
      isSeekingDrag.current = false;
      seekingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (wasPlaying) videoRef.current?.play().catch(() => {});
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") { e.preventDefault(); handleSkip("right"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); handleSkip("left"); }
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
  }

  // Decide si un tap cae en el lado izquierdo o derecho del video para avanzar/retroceder.
  function tapSide(clientX: number, _clientY: number, rect: DOMRect): "left" | "right" {
    return clientX - rect.left < rect.width / 2 ? "left" : "right";
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const touch = e.changedTouches[0];
    const target = e.target as HTMLElement;
    if (target.closest("button, input") || seekBarRef.current?.contains(target)) return;
    // Arrastrar o pellizcar no cuenta como tap
    if (gestureMovedRef.current || e.touches.length > 0) { touchStartPosRef.current = null; return; }

    // Ignore pan/zoom gestures — only react to pure taps (< 8px movement)
    if (touchStartPosRef.current) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      touchStartPosRef.current = null;
      if (dx > 8 || dy > 8) return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const side: "left" | "right" = tapSide(touch.clientX, touch.clientY, rect);
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && now - last.time < 250 && last.side === side) {
      // Multi-tap detected: seek ±5s per tap, no controls toggle
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      handleSkip(side);
      // Keep updating so 3rd, 4th... taps also accumulate
      lastTapRef.current = { time: now, side };
      return;
    }

    // First tap of a sequence
    lastTapRef.current = { time: now, side };

    if (isMobile) {
      if (isGrabando) return;
      // Delay toggle so a fast second tap can cancel it and seek instead
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        lastTapRef.current = null;
        if (showMobileControlsRef.current) closeMobileControls();
        else openMobileControls();
      }, 280);
    } else {
      resetControlsTimer();
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    hasDraggedRef.current = false;
    if (!puedeMover()) return;
    e.preventDefault();
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    if (!lastMouseRef.current) return;
    hasDraggedRef.current = true;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    moverVista(dx, dy);
  }

  function stopDrag() { setIsDragging(false); lastMouseRef.current = null; }

  function handleContainerClick(e: React.MouseEvent) {
    if (hasDraggedRef.current) return;
    if (isMobile) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, a, [role='slider']")) return;
    togglePlay();
  }

  function resetView() {
    vistaRef.current = { cx: 0.5, cy: 0.5, zoom: 1 };
    applyView();
    setZoom(1);
  }

  function handleIniciarGrabacion() {
    const v = videoRef.current;
    if (!v) return;
    setInicioSeg(v.currentTime);
    setFinSeg(null); setError(null); setEtiqueta(null); setEtiquetaCustom("");
    // El encuadre actual se mantiene: desde aquí cada movimiento queda registrado.
    seguimientoRef.current = [{ t: v.currentTime, ...vistaRef.current }];
    estadoRef.current = "grabando";
    v.play().catch(() => {});
    setEstado("grabando");
  }

  function handleDetenerGrabacion(auto = false) {
    const v = videoRef.current;
    if (!v) return;
    const fin = inicioSeg !== null ? Math.min(v.currentTime, inicioSeg + MAX_CLIP_SEG) : v.currentTime;
    setFinSeg(fin);
    setAutoDetenido(auto);
    v.pause();
    registrarVista();
    seguimientoRef.current.push({ t: fin, ...vistaRef.current });
    setSeguimiento([...seguimientoRef.current]);
    setFormatoSel(modoReel || isMobile ? "reel" : "completo");
    setConSeguimiento(true);
    estadoRef.current = "preview";
    stopDrag(); setEstado("preview");
    // En pantalla completa el formulario aparece encima del video (sin salir de ella);
    // si no, en el panel de abajo.
    if (!effectiveFullscreen) {
      setTimeout(() => { controlPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 80);
    }
  }

  function resetToIdle() {
    setEstado("idle"); setInicioSeg(null); setFinSeg(null); setAutoDetenido(false); setError(null);
    setEtiqueta(null); setEtiquetaCustom("");
    setSeguimiento([]); seguimientoRef.current = [];
    estadoRef.current = "idle";
    stopDrag();
  }

  function handleDescartar() {
    resetToIdle(); videoRef.current?.pause();
  }

  /** Crea la jugada: queda en destacadas y se prepara mientras se sigue viendo el partido. */
  function handleCrearJugada() {
    if (inicioSeg === null || finSeg === null || !puedeActuar()) return;
    if (finSeg <= inicioSeg) { setError("La jugada no tiene duración válida."); return; }
    if (finSeg - inicioSeg > MAX_CLIP_SEG) { setError("Las jugadas pueden durar máximo 2 minutos."); return; }
    const usarSeguimiento = conSeguimiento && haySeguimiento(seguimiento);
    // Sin seguimiento: encuadre fijo donde estuvo la jugada, sin zoom.
    const promedioCx = seguimiento.length ? seguimiento.reduce((n, k) => n + k.cx, 0) / seguimiento.length : 0.5;
    const edicion: Edicion = {
      formato: formatoSel,
      seguimiento: usarSeguimiento
        ? compactarSeguimiento(seguimiento.map((k) => ({ ...k, t: k.t - inicioSeg })))
        : null,
      cx: formatoSel === "reel" ? Math.round(promedioCx * 10000) / 10000 : 0.5,
      velocidad: playbackSpeed, brillo: brightness, contraste: contrast,
    };
    onCrearJugada?.({ etiqueta: getEtiquetaFinal(), inicioSeg, finSeg, duracion: finSeg - inicioSeg, edicion });
    resetToIdle();
    // Seguir viendo el partido desde donde terminó la jugada
    videoRef.current?.play().catch(() => {});
  }

  const seguimientoGrabado = haySeguimiento(seguimiento);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveFullscreen = isMobile ? isCustomFullscreen : isFullscreen;

  const mobileSeekBarTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingDrag.current = true;
    seekingRef.current = true;
    seekToPointer(touch.clientX, touch.clientY);
    const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToPointer(ev.touches[0].clientX, ev.touches[0].clientY); };
    const onEnd = () => {
      isSeekingDrag.current = false; seekingRef.current = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      if (wasPlaying) videoRef.current?.play().catch(() => {});
      resetMobileAutoHide();
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  // Contenido del menú de ajustes móvil. Se comparte entre el bottom-sheet
  // normal (fixed, fuera del video) y la variante de pantalla completa (que
  // debe vivir DENTRO del contenedor fullscreen para quedar visible).
  function abrirBarraImagen() {
    setShowImageSettings(false);
    if (showSettingsSheet) closeSettingsSheet();
    setShowBarraImagen(true);
  }

  const formularioJugada = (enVideo: boolean) => (
    <FormularioJugada
      enVideo={enVideo}
      etiquetas={ETIQUETAS}
      etiqueta={etiqueta}
      etiquetaCustom={etiquetaCustom}
      onEtiqueta={(e) => { setEtiqueta(e); if (e !== "Otro") setEtiquetaCustom(""); }}
      onEtiquetaCustom={setEtiquetaCustom}
      formato={formatoSel}
      onFormato={setFormatoSel}
      haySeguimiento={seguimientoGrabado}
      conSeguimiento={conSeguimiento}
      onConSeguimiento={setConSeguimiento}
      duracionTexto={duracionClip !== null ? fmt(duracionClip) : ""}
      error={error}
      puedeCrear={puedeActuar()}
      onCrear={handleCrearJugada}
      onDescartar={handleDescartar}
    />
  );

  const settingsSheetInner = (
    <>
      <p className="text-xs font-semibold text-mist-500 uppercase tracking-wider text-center">Ajustes</p>
      <div>
        <span className="text-xs text-mist-400 block mb-2">Velocidad</span>
        <div className="flex flex-wrap gap-2">
          {([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 6] as const).map((s) => (
            <button key={s} onClick={() => setPlaybackSpeed(s)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-all ${playbackSpeed === s ? "bg-crystal-400/15 border-crystal-400/50 text-crystal-400" : "border-white/10 text-white/50"}`}
            >
              {s === 1 ? "1×" : `${s}×`}
            </button>
          ))}
        </div>
      </div>
      {/* Brillo/contraste se ajustan con una barra flotante sobre el video, para ver el resultado */}
      <button onClick={abrirBarraImagen} className="w-full flex items-center justify-center gap-2 text-xs text-snow py-2.5 border border-crystal-400/25 bg-crystal-400/5 rounded-lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
        Brillo y contraste{brightness !== 100 || contrast !== 100 ? ` · ${brightness}% / ${contrast}%` : ""}
      </button>
      <button onClick={() => setAjustes({ brillo: 100, contraste: 100, velocidad: 1 })} className="w-full text-xs text-mist-600 text-center py-2.5 border border-mist-500/10 rounded-lg">
        Restablecer todo
      </button>
      <button onClick={openReportSheet} className="w-full flex items-center justify-center gap-2 text-xs text-mist-400 hover:text-amber-300 py-2.5 border border-mist-500/10 rounded-lg transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
        Reportar problema
      </button>
    </>
  );

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        tabIndex={0}
        className={`relative overflow-hidden bg-black select-none outline-none ${isCustomFullscreen ? "" : "rounded-xl"}`}
        style={{
          cursor: zoom > 1 || modoReel ? (isDragging ? "grabbing" : "grab") : "pointer",
          // Pantalla completa o con zoom: los dedos mueven el encuadre. Sin zoom en la
          // página: un dedo hace scroll vertical y dos dedos hacen zoom en el video.
          touchAction: isCustomFullscreen || zoom > 1 ? "none" : "pan-y",
          // Unidades dinámicas (dvw/dvh) para que el contenedor ocupe sólo el viewport VISIBLE:
          // así la barra inferior de Safari nunca tapa los controles (botón de salir, seekbar).
          ...(isCustomFullscreen
            ? { position: "fixed" as const, top: 0, left: 0, width: "100dvw", height: "100dvh", zIndex: 9999 }
            : {}),
        }}
        onTouchStart={(e) => { const t = e.touches[0]; touchStartPosRef.current = { x: t.clientX, y: t.clientY }; }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => { handleMouseMove(e); resetControlsTimer(); }}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchEnd={handleTouchEnd}
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
      >
        {/* Cuadro visible: 16:9 normal; en pantalla completa vertical es el cuadro 9:16
            del reel, centrado. El <video> se posiciona dentro con applyView(). */}
        <div
          ref={frameRef}
          className="overflow-hidden"
          style={
            modoReel
              ? { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(100dvw, calc(100dvh * 9 / 16))", aspectRatio: "9 / 16" }
              : isCustomFullscreen || isFullscreen
                ? { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: `min(100%, calc(100dvh * ${srcAspect}))`, aspectRatio: `${srcAspect}` }
                : { position: "relative", width: "100%", aspectRatio: `${srcAspect}` }
          }
        >
        <video
          ref={videoRef}
          src={src.includes(".m3u8") ? undefined : src}
          preload="auto"
          className="block absolute top-0 left-0 max-w-none"
          style={{
            transformOrigin: "0 0",
            pointerEvents: isGrabando ? "none" : undefined,
            filter: filtroImagen(ajustes),
          }}
          title={title}
          draggable={false}
          playsInline
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (v && !seekingRef.current) setCurrentTime(v.currentTime);
            if (v && estado === "grabando" && inicioSeg !== null && v.currentTime - inicioSeg >= MAX_CLIP_SEG) handleDetenerGrabacion(true);
            updateBuffered();
          }}
          onProgress={updateBuffered}
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v) {
              setDuration(v.duration);
              if (v.videoWidth && v.videoHeight) setSrcAspect(v.videoWidth / v.videoHeight);
            }
            updateBuffered(); applyView();
          }}
          onResize={applyView}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setIsPlaying(true); resetControlsTimer(); }}
          onSeeked={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onPlay={() => {
            setIsPlaying(true); resetControlsTimer();
            if (isMobile && showMobileControls) resetMobileAutoHide();
            onPlayStart?.();
            avisarReproduccion(true);
          }}
          onPause={() => {
            if (!isSeekingDrag.current) {
              setIsPlaying(false); setShowControls(true);
              avisarReproduccion(false);
              if (isMobile && mobileAutoHideRef.current) { clearTimeout(mobileAutoHideRef.current); mobileAutoHideRef.current = null; }
            }
          }}
        />
        {/* Marca de agua siempre visible, igual a la del archivo descargado: esquinas en
            el reel vertical, logo abajo al centro en horizontal (desalienta grabar la pantalla) */}
        <MarcaAguaVivo formato={modoReel ? "reel" : "completo"} aspecto={srcAspect} />
        </div>

        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Hora real del momento del video (inicio del bloque + tiempo transcurrido),
            visible junto con los controles. En el celular va abajo, sobre la barra. */}
        {horaBase !== null && !isGrabando && !isMobile && (showControls || !isPlaying) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[35] pointer-events-none" style={{ marginTop: isCustomFullscreen ? "env(safe-area-inset-top)" : undefined }}>
            <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs font-mono tabular-nums">
              <svg className="w-3 h-3 text-crystal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
              {fmtHora(horaBase + currentTime)}
            </div>
          </div>
        )}

        {/* Móvil grabando: indicación de cómo seguir la jugada */}
        {isMobile && isGrabando && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none whitespace-nowrap" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-white/80 text-xs">
              Arrastra para seguir la jugada · Pellizca para zoom
            </div>
          </div>
        )}

        {/* Flash central de play/pausa (estilo YouTube) — solo escritorio */}
        {playFlash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div key={playFlash.id} className="play-flash-indicator w-16 h-16 rounded-full bg-black/55 flex items-center justify-center backdrop-blur-sm">
              {playFlash.type === "play" ? (
                <svg className="w-8 h-8 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              )}
            </div>
          </div>
        )}

        {playbackSpeed !== 1 && (
          <div className="absolute top-3 right-3 pointer-events-none z-10">
            <div className="bg-crystal-400/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-mono">{playbackSpeed}×</div>
          </div>
        )}

        {skipLeft > 0 && (
          <div className="absolute left-0 inset-y-0 w-2/5 flex flex-col items-center justify-center gap-2 pointer-events-none z-20">
            <div className="bg-white/15 rounded-full w-14 h-14 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6l2 2-4 4 4 4-2 2-6-6zm7 0l2 2-4 4 4 4-2 2-6-6z" /></svg>
            </div>
            <span className="text-white text-xs font-semibold bg-black/50 px-2 py-0.5 rounded-full">-{skipLeft}s</span>
          </div>
        )}
        {skipRight > 0 && (
          <div className="absolute right-0 inset-y-0 w-2/5 flex flex-col items-center justify-center gap-2 pointer-events-none z-20">
            <div className="bg-white/15 rounded-full w-14 h-14 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11 6l2 2 4 4-4 4-2 2-2-2 4-4-4-4zm7 0l2 2 4 4-4 4-2 2-2-2 4-4-4-4z" transform="translate(-6,0)" />
                <path d="M9 6l-2 2 4 4-4 4 2 2 6-6zm7 0l-2 2 4 4-4 4 2 2 6-6z" transform="translate(-4,0)" />
              </svg>
            </div>
            <span className="text-white text-xs font-semibold bg-black/50 px-2 py-0.5 rounded-full">+{skipRight}s</span>
          </div>
        )}

        {/* ── Desktop: recording overlay ── */}
        {!isMobile && (
          <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-3 z-30 pointer-events-none">
            {estado === "idle" && (showControls || !isPlaying) && (
              <button
                onClick={handleIniciarGrabacion}
                className="pointer-events-auto flex items-center gap-2 bg-crystal-400/15 hover:bg-crystal-400/25 backdrop-blur-sm border border-crystal-400/50 text-crystal-400 font-medium px-6 py-3 rounded-full text-sm transition-all"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-crystal-400 animate-pulse" />
                Marcar inicio
              </button>
            )}
            {isGrabando && inicioSeg !== null && (
              <>
                <div className="pointer-events-none bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-crystal-400 text-sm font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-crystal-400 animate-pulse" />
                  Desde {fmt(inicioSeg, true)}
                  {zoom > 1.05 && <span className="text-crystal-400/60 text-xs ml-1">{zoom.toFixed(1)}×</span>}
                </div>
                <button
                  onClick={() => handleDetenerGrabacion()}
                  className="pointer-events-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/25 text-white font-medium px-6 py-3 rounded-full text-sm transition-all"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  Marcar fin
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Desktop: zoom hint ── */}
        {!isMobile && !isGrabando && (
          <div className={`absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-white/40 text-xs pointer-events-none whitespace-nowrap transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
            {zoom <= 1 ? "Scroll para hacer zoom · Clic y arrastra para mover" : "Arrastra para mover la vista"}
          </div>
        )}
        {!isMobile && isGrabando && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-white/50 text-xs pointer-events-none whitespace-nowrap">
            {zoom <= 1 ? "Scroll para hacer zoom · Clic y arrastra para mover" : "Arrastra para mover la vista"}
          </div>
        )}

        {/* ── Desktop: video controls bar ── */}
        {!isMobile && !isGrabando && (
          <div className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${showControls || !isPlaying || showImageSettings ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />
            <div className="relative px-3 pb-2.5 pt-8 space-y-1">
              <div
                ref={seekBarRef}
                data-no-gesture
                className="w-full h-4 flex items-center cursor-pointer relative group -my-1.5"
                onMouseDown={handleSeekBarMouseDown}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const touch = e.touches[0];
                  const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
                  isSeekingDrag.current = true; seekingRef.current = true;
                  seekToPointer(touch.clientX, touch.clientY);
                  const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToPointer(ev.touches[0].clientX, ev.touches[0].clientY); };
                  const onEnd = () => {
                    isSeekingDrag.current = false; seekingRef.current = false;
                    window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd);
                    if (wasPlaying) videoRef.current?.play().catch(() => {});
                  };
                  window.addEventListener("touchmove", onMove, { passive: false });
                  window.addEventListener("touchend", onEnd);
                }}
              >
                <div className="w-full h-1 bg-white/20 rounded-full relative pointer-events-none">
                  <div className="absolute inset-y-0 left-0 bg-white/35 rounded-full pointer-events-none" style={{ width: `${bufferedPct}%` }} />
                  <div className="relative h-full bg-crystal-400 rounded-full pointer-events-none" style={{ width: `${pct}%` }} />
                  <div className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md pointer-events-none -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
                  {clips && duration > 0 && clips.map((clip) => {
                    const pctMark = Math.min(100, Math.max(0, (clip.inicioSeg / duration) * 100));
                    const mc = MARKER_COLORS[clip.etiqueta] ?? MARKER_COLORS.Otro;
                    return (
                      <div key={clip.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 group/mark pointer-events-auto" style={{ left: `${pctMark}%` }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (!v) return; v.currentTime = clip.inicioSeg; setCurrentTime(clip.inicioSeg); }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/mark:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                          <div className="bg-black/90 border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                            <div className={`text-[11px] font-semibold ${mc.text}`}>{clip.etiqueta}</div>
                            <div className="text-white/50 text-[10px] font-mono mt-0.5">{fmt(clip.inicioSeg)} → {fmt(clip.finSeg)}</div>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-black/90" />
                        </div>
                        <div className={`w-2.5 h-2.5 rotate-45 ${mc.bg} border border-white/40 cursor-pointer hover:scale-125 transition-transform shadow-sm`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button onClick={() => handleSkip("left")} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10" title="Retroceder 5s (←)">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="8" y="14" fontSize="6" fontWeight="bold" fill="currentColor">5</text></svg>
                </button>
                <button onClick={() => handleSkip("right")} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10" title="Avanzar 5s (→)">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="8" y="14" fontSize="6" fontWeight="bold" fill="currentColor">5</text></svg>
                </button>
                <span className="text-white/55 text-xs font-mono ml-1 tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
                <div className="flex-1" />
                {zoom > 1.05 && (
                  <button onClick={(e) => { e.stopPropagation(); resetView(); }} className="text-[10px] text-crystal-400 font-mono border border-crystal-400/30 rounded-full px-2 py-0.5 hover:bg-crystal-400/10 transition-colors">
                    {zoom.toFixed(1)}× ✕
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowImageSettings(s => !s); }}
                    className={`w-7 h-7 flex items-center justify-center transition-colors rounded-lg hover:bg-white/10 ${showImageSettings ? "text-crystal-400" : "text-white/80 hover:text-white"}`}
                    title="Ajustes (G)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {showImageSettings && (
                    <div className="absolute bottom-9 right-0 bg-lake-900/95 border border-mist-500/15 rounded-xl p-3.5 w-56 backdrop-blur-sm shadow-xl space-y-3.5 z-20" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <span className="text-[11px] text-mist-400 block mb-1.5">Velocidad</span>
                        <div className="flex flex-wrap gap-1">
                          {([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 6] as const).map((s) => (
                            <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-all ${playbackSpeed === s ? "bg-crystal-400/15 border-crystal-400/50 text-crystal-400" : "border-white/10 text-white/50 hover:text-white hover:border-white/25"}`}>
                              {s === 1 ? "1×" : `${s}×`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={abrirBarraImagen} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-snow py-1.5 border border-crystal-400/25 bg-crystal-400/5 hover:bg-crystal-400/10 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                        Brillo y contraste
                      </button>
                      <button onClick={() => setAjustes({ brillo: 100, contraste: 100, velocidad: 1 })} className="w-full text-[11px] text-mist-600 hover:text-snow text-center py-1 hover:bg-white/5 rounded-lg transition-colors">Restablecer todo</button>
                      <div className="border-t border-mist-500/10 pt-2">
                        <button onClick={(e) => { e.stopPropagation(); openReportSheet(); }} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-mist-500 hover:text-amber-300 text-center py-1.5 hover:bg-white/5 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
                          Reportar problema
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                  <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10" title={volume === 0 ? "Activar sonido" : "Silenciar"}>
                    {volume === 0 ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                    ) : volume < 0.5 ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                    )}
                  </button>
                  <div className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? "w-16 opacity-100" : "w-0 opacity-0"}`}>
                    <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-16 accent-crystal-400 h-1 rounded-full cursor-pointer" />
                  </div>
                </div>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); toggleFullscreen(); }} style={{ touchAction: "manipulation" }} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10" title={effectiveFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
                  {effectiveFullscreen ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile controls overlay ── */}
        {isMobile && (showMobileControls || isGrabando) && (
          <div
            className={`absolute inset-0 z-30 transition-opacity duration-200 ${mobileControlsOpaque || isGrabando ? "opacity-100" : "opacity-0"}`}
            onTouchEnd={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("button, input") || seekBarRef.current?.contains(target)) return;
              e.stopPropagation();
              if (isGrabando) return;
              if (gestureMovedRef.current || e.touches.length > 0) return; // arrastre/pellizco, no tap
              if (showImageSettings) { setShowImageSettings(false); return; }
              const touch = e.changedTouches[0];
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const side: "left" | "right" = tapSide(touch.clientX, touch.clientY, rect);
              const now = Date.now();
              const last = lastTapRef.current;
              if (last && now - last.time < 250 && last.side === side) {
                if (singleTapTimerRef.current) { clearTimeout(singleTapTimerRef.current); singleTapTimerRef.current = null; }
                handleSkip(side);
                lastTapRef.current = { time: now, side };
                return;
              }
              lastTapRef.current = { time: now, side };
              if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = setTimeout(() => {
                singleTapTimerRef.current = null;
                lastTapRef.current = null;
                closeMobileControls();
              }, 280);
            }}
          >
            {/* Degradado para leer los controles; mientras se graba no se oscurece la jugada */}
            {!isGrabando && <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/80 pointer-events-none" />}

            {/* TOP-LEFT: Marcar inicio / Marcar fin (misma posición) */}
            <div className="absolute top-3 left-3 z-10">
              {estado === "idle" && !isGrabando && (
                <button
                  className="pointer-events-auto flex items-center gap-1.5 bg-crystal-400/20 backdrop-blur-sm border border-crystal-400/45 text-crystal-400 font-medium px-3 py-2 rounded-full text-sm active:scale-95 transition-transform"
                  onClick={(e) => { e.stopPropagation(); handleIniciarGrabacion(); closeMobileControls(); }}
                >
                  <span className="w-2 h-2 rounded-full bg-crystal-400 animate-pulse" />
                  Marcar inicio
                </button>
              )}
              {isGrabando && inicioSeg !== null && (
                <button
                  className="pointer-events-auto flex items-center gap-1.5 bg-black/55 backdrop-blur-sm border border-white/25 text-white font-medium px-3 py-2 rounded-full text-sm active:scale-95 transition-transform"
                  onClick={(e) => { e.stopPropagation(); handleDetenerGrabacion(); }}
                >
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  <span>Marcar fin</span>
                  <span className="text-white/50 text-[11px] font-mono">· {fmt(inicioSeg, true)}</span>
                </button>
              )}
            </div>

            {/* TOP-RIGHT: Settings + Volume */}
            {!isGrabando && (
              <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openSettingsSheet(); resetMobileAutoHide(); }}
                    className="w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-sm text-white/85 bg-black/40"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMobileVolumeTap(); resetMobileAutoHide(); }}
                    className="w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-sm text-white/85 bg-black/40"
                  >
                    {volume === 0 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                    ) : volume < 0.5 ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                    )}
                  </button>
                </div>
                {showVolumeSlider && (
                  <div className="bg-black/75 rounded-xl px-4 py-2.5 backdrop-blur-sm" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                    <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-32 accent-crystal-400 h-1.5 rounded-full cursor-pointer" />
                  </div>
                )}
              </div>
            )}

            {/* CENTER: play/pause + skip — se ocultan durante la grabación para no tapar la jugada */}
            {!isGrabando && (
              <div className="absolute inset-0 flex items-center justify-center gap-10 pointer-events-none">
                <button className="pointer-events-auto flex flex-col items-center gap-1 text-white active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); handleSkip("left"); resetMobileAutoHide(); }}>
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="7.5" y="14.5" fontSize="6.5" fontWeight="bold" fill="currentColor">5</text></svg>
                  <span className="text-xs font-semibold">-5s</span>
                </button>
                <button className="pointer-events-auto flex items-center justify-center bg-white/25 rounded-full backdrop-blur-sm active:scale-95 transition-transform" style={{ width: 68, height: 68 }} onClick={(e) => { e.stopPropagation(); togglePlay(); resetMobileAutoHide(); }}>
                  {isPlaying ? (
                    <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1 text-white active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); handleSkip("right"); resetMobileAutoHide(); }}>
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="7.5" y="14.5" fontSize="6.5" fontWeight="bold" fill="currentColor">5</text></svg>
                  <span className="text-xs font-semibold">+5s</span>
                </button>
              </div>
            )}

            {/* BOTTOM: time + fullscreen + seekbar */}
            {!isGrabando && (
              <div className="absolute bottom-0 left-0 right-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div className="relative flex items-center justify-between px-3 pb-1.5">
                  <span className="text-white/75 text-xs font-mono tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
                  {/* Hora real del momento: se actualiza mientras se arrastra la barra */}
                  {horaBase !== null && (
                    <span className={`absolute left-1/2 -translate-x-1/2 ${isCustomFullscreen ? "" : "bottom-0"} flex items-center gap-1 bg-black/50 rounded-full px-2.5 py-0.5 text-white text-xs font-mono tabular-nums pointer-events-none`}>
                      <svg className="w-3 h-3 text-crystal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
                      {fmtHora(horaBase + currentTime)}
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); resetMobileAutoHide(); }} className="w-11 h-11 flex items-center justify-center text-white/85 active:scale-95 transition-transform">
                    {isCustomFullscreen ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                    ) : (
                      <svg className="w-6 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 28 20">
                        <path d="M5 7V4h4M5 13v3h4M23 7V4h-4M23 13v3h-4" />
                      </svg>
                    )}
                  </button>
                </div>
                <div
                  ref={seekBarRef}
                  data-no-gesture
                  className="w-full h-8 flex items-center cursor-pointer px-3"
                  onTouchStart={mobileSeekBarTouchStart}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full h-1 bg-white/20 rounded-full relative pointer-events-none">
                    <div className="absolute inset-y-0 left-0 bg-white/35 rounded-full" style={{ width: `${bufferedPct}%` }} />
                    <div className="relative h-full bg-crystal-400 rounded-full" style={{ width: `${pct}%` }} />
                    <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }} />
                    {clips && duration > 0 && clips.map((clip) => {
                      const pctMark = Math.min(100, Math.max(0, (clip.inicioSeg / duration) * 100));
                      const mc = MARKER_COLORS[clip.etiqueta] ?? MARKER_COLORS.Otro;
                      return (
                        <div key={clip.id} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-auto" style={{ left: `${pctMark}%` }}
                          onTouchEnd={(e) => { e.stopPropagation(); const v = videoRef.current; if (!v) return; v.currentTime = clip.inicioSeg; setCurrentTime(clip.inicioSeg); }}
                        >
                          <div className={`w-3 h-3 rotate-45 ${mc.bg} border border-white/40`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nueva jugada en pantalla completa: el formulario aparece encima del
            video, sin salir de la pantalla completa ── */}
        {estado === "preview" && effectiveFullscreen && (
          <div
            data-no-gesture
            className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto bg-lake-900/95 backdrop-blur-sm border-t border-mist-500/10 rounded-t-2xl z-50 px-4 pt-4 sm:max-w-md sm:mx-auto"
            style={{ touchAction: "pan-y", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {formularioJugada(true)}
          </div>
        )}

        {/* ── Brillo/contraste sobre el video (pantalla completa o escritorio) ── */}
        {showBarraImagen && (effectiveFullscreen || !isMobile) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[46]" style={{ marginTop: isCustomFullscreen ? "env(safe-area-inset-top)" : undefined }}>
            <BarraImagen onCerrar={() => setShowBarraImagen(false)} />
          </div>
        )}

        {/* ── Ajustes en pantalla completa móvil ──
            El bottom-sheet normal usa position:fixed y queda TAPADO por el
            contenedor fullscreen (z-index 9999). Acá se renderiza DENTRO del
            contenedor y tocar fuera lo cierra sin salir de pantalla completa. */}
        {showSettingsSheet && isCustomFullscreen && (
          <>
            <div
              className="absolute inset-0 bg-black/60 z-[45]"
              onClick={(e) => { e.stopPropagation(); closeSettingsSheet(); }}
              onTouchEnd={(e) => { e.stopPropagation(); closeSettingsSheet(); }}
            />
            <div
              className={`absolute inset-x-0 bottom-0 max-h-[75%] overflow-y-auto bg-lake-900 border-t border-mist-500/10 rounded-t-2xl z-50 px-5 pt-3 pb-4 space-y-3 transition-transform duration-300 ${settingsSheetOpened ? "translate-y-0" : "translate-y-full"}`}
              style={{ touchAction: "pan-y", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {settingsSheetInner}
            </div>
          </>
        )}
      </div>

      {/* Brillo/contraste en el celular sin pantalla completa: debajo del video, para no taparlo */}
      {showBarraImagen && isMobile && !effectiveFullscreen && (
        <div className="flex justify-center">
          <BarraImagen onCerrar={() => setShowBarraImagen(false)} />
        </div>
      )}

      {/* ── Mobile settings bottom sheet ── */}
      {showSettingsSheet && !isCustomFullscreen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={closeSettingsSheet} onTouchEnd={closeSettingsSheet} />
          <div
            className={`fixed bottom-0 left-0 right-0 bg-lake-900 border-t border-mist-500/10 rounded-t-2xl z-50 px-5 pt-4 pb-10 space-y-4 transition-transform duration-300 ${settingsSheetOpened ? "translate-y-0" : "translate-y-full"}`}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-mist-500/30 rounded-full mx-auto mb-1" />
            {settingsSheetInner}
          </div>
        </>
      )}

      {/* ── Reportar problema (modal / bottom-sheet) ── */}
      {showReportSheet && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowReportSheet(false)} onTouchEnd={() => setShowReportSheet(false)} />
          <div
            className="fixed z-[60] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md bg-lake-900 border-t sm:border border-mist-500/12 rounded-t-2xl sm:rounded-2xl px-5 pt-4 pb-8 sm:p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-mist-500/30 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-snow flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
                Reportar problema
              </h3>
              <button onClick={() => setShowReportSheet(false)} className="w-7 h-7 flex items-center justify-center text-mist-600 hover:text-snow rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Describe tu problema"
              rows={4}
              autoFocus
              className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow placeholder-mist-700 rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none"
            />
            {reportError && <p className="text-xs text-red-400">{reportError}</p>}
            <button
              onClick={handleEnviarReporte}
              disabled={!reportText.trim() || reportSending}
              className="w-full py-2.5 rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 disabled:cursor-not-allowed text-lake-950 text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {reportSending && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              )}
              Enviar reporte
            </button>
          </div>
        </>
      )}

      {/* ── Toast de reporte enviado ── */}
      {reportToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 bg-lake-800 border border-crystal-400/30 text-snow text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          <svg className="w-4 h-4 text-crystal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          Reporte enviado, gracias
        </div>
      )}

      {/* ── Control panel ── */}
      <div ref={controlPanelRef} className="bg-lake-800/60 rounded-xl border border-crystal-400/8 p-5 space-y-4">
        {estado === "idle" && (
          <p className="text-xs text-mist-600 text-center leading-relaxed">
            Reproduce el video y presiona el botón en el video cuando quieras marcar el inicio de tu jugada. Los clips pueden durar hasta 2 minutos.
          </p>
        )}
        {isGrabando && inicioSeg !== null && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-crystal-400/5 border border-crystal-400/12 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-crystal-400 animate-pulse shrink-0" />
            <span className="text-crystal-400 text-sm">Desde <span className="font-mono">{fmt(inicioSeg, true)}</span></span>
            <span className="text-xs text-mist-600">· máx 2 min</span>
            {zoom > 1.05 && <span className="ml-auto text-xs text-crystal-400/60 font-mono">{zoom.toFixed(1)}× zoom</span>}
          </div>
        )}
        {estado === "preview" && inicioSeg !== null && finSeg !== null && !effectiveFullscreen && (
          <div className="space-y-3">
            {autoDetenido && (
              <div className="flex items-center gap-1.5 text-xs text-crystal-400/70 bg-crystal-400/5 border border-crystal-400/8 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                La jugada se cerró automáticamente al llegar a los 2 minutos
              </div>
            )}
            {formularioJugada(false)}
          </div>
        )}
        {estado === "preview" && effectiveFullscreen && (
          <p className="text-xs text-mist-600 text-center">Completa los datos de la jugada en el video.</p>
        )}
      </div>
    </div>
  );
}

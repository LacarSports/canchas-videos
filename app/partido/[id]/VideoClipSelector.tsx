"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import { processClip, type FaseDescarga, type CropParams } from "./processClip";

export interface ClipLocal {
  id: string;
  partidoId: string;
  etiqueta: string;
  inicioSeg: number;
  finSeg: number;
  duracion: number;
  blobUrl?: string;
}

type Estado = "idle" | "grabando" | "preview" | "descargando";

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
  clips?: ClipLocal[];
  onClipGuardado?: (clip: ClipLocal) => void;
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

export default function VideoClipSelector({ src, title, videoUrl, partidoId, deporte, complejo, numeroCancha, clips, onClipGuardado, onPlayStart }: Props) {
  const ETIQUETAS = getEtiquetas(deporte);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  const [estado, setEstado] = useState<Estado>("idle");
  const [inicioSeg, setInicioSeg] = useState<number | null>(null);
  const [finSeg, setFinSeg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<FaseDescarga | null>(null);
  const [progreso, setProgreso] = useState(0);

  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [etiquetaCustom, setEtiquetaCustom] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showImageSettings, setShowImageSettings] = useState(false);

  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);

  const [cropParams, setCropParams] = useState<CropParams | null>(null);

  const [buffering, setBuffering] = useState(true);
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
  const guardadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMobileControlsRef = useRef(false);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [mobileControlsOpaque, setMobileControlsOpaque] = useState(false);
  const mobileAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [settingsSheetOpened, setSettingsSheetOpened] = useState(false);

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

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  useEffect(() => {
    if (zoom <= 1) { setPanX(0); setPanY(0); return; }
    const el = containerRef.current;
    if (!el) return;
    const maxPanX = (el.clientWidth * (zoom - 1)) / 2;
    const maxPanY = (el.clientHeight * (zoom - 1)) / 2;
    setPanX((p) => Math.max(-maxPanX, Math.min(maxPanX, p)));
    setPanY((p) => Math.max(-maxPanY, Math.min(maxPanY, p)));
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 15;
      if (e.deltaMode === 2) delta *= 400;
      const factor = Math.exp(-delta * 0.002);
      const newZoom = Math.max(1, Math.min(4, zoomRef.current * factor));
      zoomRef.current = newZoom;
      setZoom(newZoom);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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
    if (showSettingsSheet) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      };
    }
  }, [showSettingsSheet]);

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
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); setVolume((v) => v === 0 ? 1 : 0); }
      else if (e.key === "g" || e.key === "G") { e.preventDefault(); setShowImageSettings((s) => !s); }
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!src.includes(".m3u8")) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = src; video.load(); return; }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 60, maxMaxBufferLength: 120 });
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
  function getShareUrl() {
    if (typeof window === "undefined" || inicioSeg === null || finSeg === null) return "";
    return `${window.location.origin}${window.location.pathname}?t=${Math.floor(inicioSeg)}-${Math.floor(finSeg)}`;
  }

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
      if (isCustomFullscreen) {
        setIsCustomFullscreen(false);
        try { (screen.orientation as any)?.unlock?.(); } catch {}
      } else {
        setIsCustomFullscreen(true);
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch {}
      }
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

  function seekToClientX(clientX: number) {
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
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingDrag.current = true;
    seekingRef.current = true;
    seekToClientX(e.clientX);
    const onMove = (ev: MouseEvent) => seekToClientX(ev.clientX);
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

  // Decide si un tap cae en el lado izquierdo o derecho del VIDEO para avanzar/retroceder.
  // En fullscreen vertical el contenedor se rota 90° (horario) por CSS, así que el eje
  // izquierda↔derecha del video corre verticalmente en la pantalla: el lado derecho queda
  // en la mitad inferior y el izquierdo en la superior. En el resto de los casos (no
  // fullscreen, o fullscreen ya en landscape sin rotación) se divide por el eje horizontal.
  function tapSide(clientX: number, clientY: number, rect: DOMRect): "left" | "right" {
    if (isCustomFullscreen && !isLandscape) {
      return clientY - rect.top < rect.height / 2 ? "left" : "right";
    }
    return clientX - rect.left < rect.width / 2 ? "left" : "right";
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const touch = e.changedTouches[0];
    const target = e.target as HTMLElement;
    if (target.closest("button, input") || seekBarRef.current?.contains(target)) return;

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
    if (zoomRef.current <= 1) return;
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
    const el = containerRef.current;
    if (!el) return;
    const z = zoomRef.current;
    const maxPanX = (el.clientWidth * (z - 1)) / 2;
    const maxPanY = (el.clientHeight * (z - 1)) / 2;
    setPanX((p) => Math.max(-maxPanX, Math.min(maxPanX, p + dx)));
    setPanY((p) => Math.max(-maxPanY, Math.min(maxPanY, p + dy)));
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
    setZoom(1); setPanX(0); setPanY(0);
    zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0;
  }

  function handleIniciarGrabacion() {
    const v = videoRef.current;
    if (!v) return;
    setInicioSeg(v.currentTime);
    setFinSeg(null); setError(null); setEtiqueta(null); setEtiquetaCustom(""); setGuardado(false); setCropParams(null);
    resetView();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    v.play().catch(() => {});
    setEstado("grabando");
  }

  function handleDetenerGrabacion() {
    const v = videoRef.current;
    if (!v) return;
    setFinSeg(v.currentTime);
    v.pause();
    const z = zoomRef.current;
    if (z > 1.01) {
      setCropParams({ zoom: z, panX: panXRef.current, panY: panYRef.current, containerW: v.clientWidth, containerH: v.clientHeight, videoW: v.videoWidth, videoH: v.videoHeight });
    } else {
      setCropParams(null);
    }
    resetView(); stopDrag(); setEstado("preview");
    const scrollToPanel = () => setTimeout(() => { controlPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 80);
    if (isCustomFullscreen) {
      setIsCustomFullscreen(false);
      closeMobileControls();
      try { (screen.orientation as any)?.unlock?.(); } catch {}
      setTimeout(scrollToPanel, 150);
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().then(scrollToPanel).catch(scrollToPanel);
    } else {
      scrollToPanel();
    }
  }

  function resetToIdle() {
    setEstado("idle"); setInicioSeg(null); setFinSeg(null); setError(null); setFase(null); setProgreso(0);
    setEtiqueta(null); setEtiquetaCustom(""); setGuardado(false); setCropParams(null);
    resetView(); stopDrag();
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
  }

  function handleReintentar() {
    if (guardadoTimerRef.current) { clearTimeout(guardadoTimerRef.current); guardadoTimerRef.current = null; }
    resetToIdle(); videoRef.current?.pause();
  }

  function handleGuardarDestacado() {
    if (inicioSeg === null || finSeg === null || !puedeActuar()) return;
    onClipGuardado?.({ id: crypto.randomUUID(), partidoId, etiqueta: getEtiquetaFinal(), inicioSeg, finSeg, duracion: finSeg - inicioSeg });
    setGuardado(true);
    guardadoTimerRef.current = setTimeout(() => { guardadoTimerRef.current = null; resetToIdle(); }, 1500);
  }

  async function handleDescargar() {
    if (inicioSeg === null || finSeg === null) return;
    if (finSeg <= inicioSeg) { setError("El clip no tiene duración válida."); return; }
    setError(null); setEstado("descargando"); setFase("ffmpeg"); setProgreso(0);
    try {
      const url = await processClip({ videoUrl, inicioSeg, finSeg, crop: cropParams ?? undefined, speed: playbackSpeed, brightness, contrast, onFase: (f) => setFase(f), onProgreso: (p) => setProgreso(p) });
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      const a = document.createElement("a");
      a.href = url; a.download = `clip_lacar_sports_${Math.floor(inicioSeg)}s-${Math.floor(finSeg)}s.mp4`; a.click();
      onClipGuardado?.({ id: crypto.randomUUID(), partidoId, etiqueta: getEtiquetaFinal(), inicioSeg, finSeg, duracion: finSeg - inicioSeg, blobUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el clip");
    } finally {
      setEstado("preview"); setFase(null); setProgreso(0);
    }
  }

  function copiar(txt: string) { navigator.clipboard.writeText(txt).catch(() => {}); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }

  async function handleShare() {
    const url = getShareUrl(); const et = getEtiquetaFinal();
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: et ? `Jugada: ${et}` : "Jugada en Lacar Sports", text: et ? `Mirá esta jugada (${et})` : "Mirá esta jugada", url });
        return;
      } catch { /* cancelled */ }
    }
    copiar(url);
  }

  const labelFase: Record<FaseDescarga, string> = {
    ffmpeg: "Cargando editor...",
    video: `Descargando video${progreso > 0 ? ` ${progreso}%` : ""}`,
    procesando: `${[cropParams ? "zoom" : null, playbackSpeed !== 1 ? `${playbackSpeed}×` : null, (brightness !== 100 || contrast !== 100) ? "imagen" : null].filter(Boolean).join(" + ") || "clip"}...${progreso > 0 ? ` ${progreso}%` : ""}`,
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveFullscreen = isMobile ? isCustomFullscreen : isFullscreen;

  const mobileSeekBarTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingDrag.current = true;
    seekingRef.current = true;
    seekToClientX(touch.clientX);
    const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToClientX(ev.touches[0].clientX); };
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

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        tabIndex={0}
        className={`relative overflow-hidden bg-black select-none outline-none ${isCustomFullscreen ? "" : "rounded-xl"}`}
        style={{
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "pointer",
          touchAction: "manipulation",
          ...(isCustomFullscreen
            ? isLandscape
              ? { position: "fixed" as const, top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }
              // Portrait: rotate container 90° so video fills the screen horizontally
              : { position: "fixed" as const, top: "calc((100vh - 100vw) / 2)", left: "calc((100vw - 100vh) / 2)", width: "100vh", height: "100vw", transform: "rotate(90deg)", transformOrigin: "center center", zIndex: 9999 }
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
        <video
          ref={videoRef}
          src={src.includes(".m3u8") ? undefined : src}
          preload="metadata"
          className="w-full block"
          style={{
            transform: zoom !== 1 ? `translate(${panX}px, ${panY}px) scale(${zoom})` : undefined,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.12s ease",
            pointerEvents: isGrabando ? "none" : undefined,
            filter: (brightness !== 100 || contrast !== 100) ? `brightness(${brightness}%) contrast(${contrast}%)` : undefined,
          }}
          title={title}
          draggable={false}
          playsInline
          onTimeUpdate={() => { const v = videoRef.current; if (v && !seekingRef.current) setCurrentTime(v.currentTime); }}
          onLoadedMetadata={() => { const v = videoRef.current; if (v) setDuration(v.duration); }}
          onWaiting={() => setBuffering(true)}
          onSeeking={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setIsPlaying(true); resetControlsTimer(); }}
          onSeeked={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onPlay={() => {
            setIsPlaying(true); resetControlsTimer();
            if (isMobile && showMobileControls) resetMobileAutoHide();
            onPlayStart?.();
          }}
          onPause={() => {
            if (!isSeekingDrag.current) {
              setIsPlaying(false); setShowControls(true);
              if (isMobile && mobileAutoHideRef.current) { clearTimeout(mobileAutoHideRef.current); mobileAutoHideRef.current = null; }
            }
          }}
        />

        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
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
                  onClick={handleDetenerGrabacion}
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
                className="w-full h-4 flex items-center cursor-pointer relative group -my-1.5"
                onMouseDown={handleSeekBarMouseDown}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const touch = e.touches[0];
                  const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
                  isSeekingDrag.current = true; seekingRef.current = true;
                  seekToClientX(touch.clientX);
                  const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToClientX(ev.touches[0].clientX); };
                  const onEnd = () => {
                    isSeekingDrag.current = false; seekingRef.current = false;
                    window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd);
                    if (wasPlaying) videoRef.current?.play().catch(() => {});
                  };
                  window.addEventListener("touchmove", onMove, { passive: false });
                  window.addEventListener("touchend", onEnd);
                }}
              >
                <div className="w-full h-1 bg-white/25 rounded-full relative pointer-events-none">
                  <div className="h-full bg-crystal-400 rounded-full pointer-events-none" style={{ width: `${pct}%` }} />
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
                  <button onClick={(e) => { e.stopPropagation(); setZoom(1); setPanX(0); setPanY(0); zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0; }} className="text-[10px] text-crystal-400 font-mono border border-crystal-400/30 rounded-full px-2 py-0.5 hover:bg-crystal-400/10 transition-colors">
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
                      <div>
                        <div className="flex justify-between mb-1.5"><span className="text-[11px] text-mist-400">Brillo</span><span className="text-[11px] font-mono text-mist-600">{brightness}%</span></div>
                        <input type="range" min={50} max={200} step={5} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-crystal-400 h-1 rounded-full cursor-pointer" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1.5"><span className="text-[11px] text-mist-400">Contraste</span><span className="text-[11px] font-mono text-mist-600">{contrast}%</span></div>
                        <input type="range" min={50} max={200} step={5} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-crystal-400 h-1 rounded-full cursor-pointer" />
                      </div>
                      <button onClick={() => { setBrightness(100); setContrast(100); setPlaybackSpeed(1); }} className="w-full text-[11px] text-mist-600 hover:text-snow text-center py-1 hover:bg-white/5 rounded-lg transition-colors">Restablecer todo</button>
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
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/80 pointer-events-none" />

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

            {/* CENTER: play/pause + skip (siempre visible, también durante grabación) */}
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

            {/* BOTTOM: time + fullscreen + seekbar */}
            {!isGrabando && (
              <div className="absolute bottom-0 left-0 right-0">
                <div className="flex items-center justify-between px-3 pb-1.5">
                  <span className="text-white/75 text-xs font-mono tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
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
                  className="w-full h-6 flex items-center cursor-pointer px-3"
                  onTouchStart={mobileSeekBarTouchStart}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-full h-1 bg-white/30 rounded-full relative pointer-events-none">
                    <div className="h-full bg-crystal-400 rounded-full" style={{ width: `${pct}%` }} />
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
      </div>

      {/* ── Mobile settings bottom sheet ── */}
      {showSettingsSheet && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={closeSettingsSheet} onTouchEnd={closeSettingsSheet} />
          <div
            className={`fixed bottom-0 left-0 right-0 bg-lake-900 border-t border-mist-500/10 rounded-t-2xl z-50 px-5 pt-4 pb-10 space-y-4 transition-transform duration-300 ${settingsSheetOpened ? "translate-y-0" : "translate-y-full"}`}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-mist-500/30 rounded-full mx-auto mb-1" />
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
            <div>
              <div className="flex justify-between mb-2"><span className="text-xs text-mist-400">Brillo</span><span className="text-xs font-mono text-mist-600">{brightness}%</span></div>
              <input type="range" min={50} max={200} step={5} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-crystal-400 h-1.5 rounded-full cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between mb-2"><span className="text-xs text-mist-400">Contraste</span><span className="text-xs font-mono text-mist-600">{contrast}%</span></div>
              <input type="range" min={50} max={200} step={5} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-crystal-400 h-1.5 rounded-full cursor-pointer" />
            </div>
            <button onClick={() => { setBrightness(100); setContrast(100); setPlaybackSpeed(1); }} className="w-full text-xs text-mist-600 text-center py-2.5 border border-mist-500/10 rounded-lg">
              Restablecer todo
            </button>
            <button onClick={openReportSheet} className="w-full flex items-center justify-center gap-2 text-xs text-mist-400 hover:text-amber-300 py-2.5 border border-mist-500/10 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" /></svg>
              Reportar problema
            </button>
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
            Reproduce el video y presiona el botón en el video cuando quieras marcar el inicio de tu jugada
          </p>
        )}
        {isGrabando && inicioSeg !== null && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-crystal-400/5 border border-crystal-400/12 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-crystal-400 animate-pulse shrink-0" />
            <span className="text-crystal-400 text-sm">Desde <span className="font-mono">{fmt(inicioSeg, true)}</span></span>
            {zoom > 1.05 && <span className="ml-auto text-xs text-crystal-400/60 font-mono">{zoom.toFixed(1)}× zoom</span>}
          </div>
        )}
        {(estado === "preview" || estado === "descargando") && inicioSeg !== null && finSeg !== null && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 divide-x divide-crystal-400/8 text-center border border-crystal-400/8 rounded-lg overflow-hidden">
              {[{ label: "Inicio", val: fmt(inicioSeg) }, { label: "Fin", val: fmt(finSeg) }, { label: "Duración", val: fmt(duracionClip!), accent: true }].map(({ label, val, accent }) => (
                <div key={label} className="py-2.5 px-2">
                  <div className="text-xs text-mist-600 mb-0.5">{label}</div>
                  <div className={`font-mono text-sm ${accent ? "text-crystal-400 font-semibold" : "text-white"}`}>{val}</div>
                </div>
              ))}
            </div>
            {cropParams && (
              <div className="flex items-center gap-1.5 text-xs text-crystal-400/70 bg-crystal-400/5 border border-crystal-400/8 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                Zoom {cropParams.zoom.toFixed(1)}× guardado — el clip incluirá el encuadre
              </div>
            )}
            {(playbackSpeed !== 1 || brightness !== 100 || contrast !== 100) && (
              <div className="flex flex-wrap gap-1.5 text-xs text-crystal-400/70 bg-crystal-400/5 border border-crystal-400/8 rounded-lg px-3 py-2">
                {playbackSpeed !== 1 && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>{playbackSpeed}×</span>}
                {brightness !== 100 && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>Brillo {brightness}%</span>}
                {contrast !== 100 && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="M12 2a10 10 0 010 20V2z" fill="currentColor" stroke="none"/></svg>Contraste {contrast}%</span>}
                <span className="text-mist-700 ml-1">— se aplicarán al clip</span>
              </div>
            )}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-mist-600 uppercase tracking-wide flex items-center gap-1.5">Etiqueta tu jugada <span className="text-crystal-400 normal-case tracking-normal font-normal">(obligatorio)</span></p>
              <div className="flex flex-wrap gap-2">
                {ETIQUETAS.map((e) => (
                  <button key={e} type="button" onClick={() => { setEtiqueta(e); if (e !== "Otro") setEtiquetaCustom(""); }} disabled={estado === "descargando"}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:opacity-40 ${etiqueta === e ? "bg-crystal-400/12 border-crystal-400 text-crystal-400" : "border-mist-500/15 text-mist-500 hover:border-mist-500/30 hover:text-snow"}`}
                  >{e}</button>
                ))}
              </div>
              {etiqueta === "Otro" && (
                <input type="text" placeholder="Describe tu jugada..." value={etiquetaCustom} onChange={(e) => setEtiquetaCustom(e.target.value)} disabled={estado === "descargando"} autoFocus
                  className="w-full bg-lake-950 border border-crystal-400/15 rounded-lg px-3 py-2 text-sm text-white placeholder-mist-700 focus:outline-none focus:ring-1 focus:ring-crystal-400/40 disabled:opacity-40" />
              )}
            </div>
            {estado === "descargando" && fase && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-mist-600"><span>{labelFase[fase]}</span>{progreso > 0 && <span>{progreso}%</span>}</div>
                <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                  <div className="bg-crystal-400 h-full rounded-full transition-all duration-300" style={{ width: progreso > 0 ? `${progreso}%` : "45%", animation: progreso === 0 ? "pulse 1.5s ease-in-out infinite" : "none" }} />
                </div>
              </div>
            )}
            {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleReintentar} disabled={estado === "descargando"} className="py-2.5 rounded-lg text-xs border border-mist-500/15 text-mist-600 hover:text-snow hover:border-mist-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Otro Clip</button>
              <button onClick={handleGuardarDestacado} disabled={!puedeActuar() || estado === "descargando" || guardado}
                className={`py-2.5 rounded-lg text-xs border transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1 ${guardado ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/5" : "border-mist-500/15 text-mist-500 hover:text-crystal-400 hover:border-crystal-400/30 disabled:opacity-40"}`}
              >
                {guardado ? (<><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Guardado</>) : "Guardar destacado"}
              </button>
              <button onClick={handleDescargar} disabled={!puedeActuar() || estado === "descargando"} className="py-2.5 rounded-lg text-xs border border-crystal-400/30 bg-crystal-400/8 text-crystal-400 hover:bg-crystal-400/15 hover:border-crystal-400/50 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                {estado === "descargando" ? (<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>) : (<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>)}
                {estado === "descargando" ? "..." : "Descargar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

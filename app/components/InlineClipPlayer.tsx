"use client";

import { useRef, useState, useEffect } from "react";
import Hls from "hls.js";

function fmtSeg(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  videoUrl: string;
  inicioSeg: number;
  finSeg: number;
  duracion: number;
  blobUrl?: string;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
}

export default function InlineClipPlayer({ videoUrl, inicioSeg, finSeg, duracion, blobUrl, onClose, compact = false, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const mobileAutoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  // Flash central de play/pausa (estilo YouTube), solo escritorio
  const [playFlash, setPlayFlash] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  const playFlashIdRef = useRef(0);
  const playFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [relTime, setRelTime] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [mobileControlsOpaque, setMobileControlsOpaque] = useState(false);

  const src = blobUrl ?? videoUrl;
  const clipStart = blobUrl ? 0 : inicioSeg;
  const clipEnd = blobUrl ? duracion : finSeg;
  const pct = duracion > 0 ? Math.min(100, (relTime / duracion) * 100) : 0;

  const ic = compact ? "w-3.5 h-3.5" : "w-4 h-4";
  const btn = compact ? "w-6 h-6" : "w-7 h-7";

  useEffect(() => {
    const onOrientationChange = () => { document.documentElement.style.zoom = "1"; };
    window.addEventListener("orientationchange", onOrientationChange);
    return () => window.removeEventListener("orientationchange", onOrientationChange);
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
    if (isCustomFullscreen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isCustomFullscreen]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = volume === 0;
  }, [volume]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const isHls = src.includes(".m3u8");
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) { video.src = src; return; }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 60, maxMaxBufferLength: 120, startPosition: clipStart });
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
  }, [src, clipStart]);

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
    if (direction === "left") v.currentTime = Math.max(clipStart, v.currentTime - amount);
    else v.currentTime = Math.min(clipEnd, v.currentTime + amount);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); handleSkip("right"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); handleSkip("left"); }
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
  }

  function seekToClientX(clientX: number) {
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duracion) return;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = clipStart + fraction * duracion;
    v.currentTime = Math.max(clipStart, Math.min(clipEnd, newTime));
    setRelTime(fraction * duracion);
  }

  function handleSeekBarMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingRef.current = true;
    seekToClientX(e.clientX);
    const onMove = (ev: MouseEvent) => seekToClientX(ev.clientX);
    const onUp = () => {
      isSeekingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (wasPlaying) videoRef.current?.play().catch(() => {});
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const mobileSeekBarTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingRef.current = true;
    seekToClientX(touch.clientX);
    const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToClientX(ev.touches[0].clientX); };
    const onEnd = () => {
      isSeekingRef.current = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      if (wasPlaying) videoRef.current?.play().catch(() => {});
      resetMobileAutoHide();
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

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
    const side: "left" | "right" = touch.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.time < 300 && last.side === side) {
      handleSkip(side);
      lastTapRef.current = null;
      return;
    }
    lastTapRef.current = { time: now, side };
    if (isMobile) {
      if (showMobileControls) closeMobileControls();
      else openMobileControls();
    }
  }

  const effectiveFullscreen = isMobile ? isCustomFullscreen : isFullscreen;

  const VolumeIcon = () => {
    if (volume === 0) return (
      <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
    );
    if (volume < 0.5) return (
      <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
    );
    return (
      <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative overflow-hidden bg-black outline-none ${isCustomFullscreen ? "" : (isFullscreen ? "flex items-center justify-center" : (className ?? "aspect-video"))}`}
      style={isCustomFullscreen ? { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 } : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={(e) => { const t = e.touches[0]; touchStartPosRef.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={handleTouchEnd}
      onClick={() => { if (!isMobile) togglePlay(); }}
    >
      <video
        ref={videoRef}
        className={`object-contain ${(isFullscreen && !isCustomFullscreen) ? "" : "w-full h-full"}`}
        style={(isFullscreen && !isCustomFullscreen) ? { width: "100%", height: "auto" } : undefined}
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = clipStart; }}
        onCanPlay={(e) => { setBuffering(false); (e.target as HTMLVideoElement).play().catch(() => {}); }}
        onSeeking={() => setBuffering(true)}
        onSeeked={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onPlay={() => {
          setIsPlaying(true); setBuffering(false);
          if (isMobile && showMobileControls) resetMobileAutoHide();
        }}
        onPause={() => {
          if (!isSeekingRef.current) {
            setIsPlaying(false);
            if (isMobile && mobileAutoHideRef.current) { clearTimeout(mobileAutoHideRef.current); mobileAutoHideRef.current = null; }
          }
        }}
        onError={() => setBuffering(false)}
        onTimeUpdate={(e) => {
          const v = e.target as HTMLVideoElement;
          if (v.currentTime >= clipEnd) { v.pause(); v.currentTime = clipStart; setRelTime(0); }
          else { setRelTime(Math.max(0, v.currentTime - clipStart)); }
        }}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Flash central de play/pausa (estilo YouTube) — solo escritorio */}
      {playFlash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div key={playFlash.id} className={`play-flash-indicator rounded-full bg-black/55 flex items-center justify-center backdrop-blur-sm ${compact ? "w-12 h-12" : "w-16 h-16"}`}>
            {playFlash.type === "play" ? (
              <svg className={`text-white ml-0.5 ${compact ? "w-6 h-6" : "w-8 h-8"}`} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className={`text-white ${compact ? "w-6 h-6" : "w-8 h-8"}`} fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            )}
          </div>
        </div>
      )}

      {/* ── Desktop controls overlay ── */}
      {!isMobile && (
        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent ${compact ? "px-2 pb-2 pt-6" : "px-3 pb-2.5 pt-8"}`}>
          <div
            ref={seekBarRef}
            className="w-full h-4 flex items-center cursor-pointer relative group mb-0.5"
            onMouseDown={handleSeekBarMouseDown}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
              isSeekingRef.current = true;
              seekToClientX(touch.clientX);
              const onMove = (ev: TouchEvent) => { ev.preventDefault(); if (ev.touches[0]) seekToClientX(ev.touches[0].clientX); };
              const onEnd = () => {
                isSeekingRef.current = false;
                window.removeEventListener("touchmove", onMove);
                window.removeEventListener("touchend", onEnd);
                if (wasPlaying) videoRef.current?.play().catch(() => {});
              };
              window.addEventListener("touchmove", onMove, { passive: false });
              window.addEventListener("touchend", onEnd);
            }}
          >
            <div className="w-full h-0.5 bg-white/25 rounded-full relative pointer-events-none group-hover:h-1 transition-all duration-150">
              <div className="h-full bg-crystal-400 rounded-full pointer-events-none" style={{ width: `${pct}%`, transition: isSeekingRef.current ? "none" : "width 0.1s linear" }} />
              <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md pointer-events-none -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={`${btn} flex items-center justify-center text-white/80 hover:text-white transition-colors`}>
              {isPlaying ? (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg className={`${ic} ml-0.5`} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <span className="text-white/55 text-xs font-mono tabular-nums">{fmtSeg(relTime)} / {fmtSeg(duracion)}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-1" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
              <button
                onClick={(e) => { e.stopPropagation(); if (volume === 0) setVolume(1); else setVolume(0); setShowVolumeSlider(v => !v); }}
                className={`${btn} flex items-center justify-center text-white/60 hover:text-white transition-colors`}
                title={volume === 0 ? "Activar sonido" : "Silenciar"}
              >
                <VolumeIcon />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? "w-14 opacity-100" : "w-0 opacity-0"}`}>
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-14 accent-crystal-400 h-1 rounded-full cursor-pointer" />
              </div>
            </div>
            <button type="button" onPointerDown={(e) => { e.preventDefault(); toggleFullscreen(); }} className={`${btn} min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-white/60 hover:text-white transition-colors`} style={{ touchAction: "manipulation" }} title={effectiveFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
              {effectiveFullscreen ? (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
              ) : (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              )}
            </button>
            {onClose && (
              <button onClick={(e) => { e.stopPropagation(); onClose(); }} className={`${btn} flex items-center justify-center text-white/60 hover:text-red-400 transition-colors`}>
                <svg className={ic} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile controls overlay ── */}
      {isMobile && showMobileControls && (
        <div
          className={`absolute inset-0 z-30 transition-opacity duration-200 ${mobileControlsOpaque ? "opacity-100" : "opacity-0"}`}
          onTouchEnd={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("button, input") || seekBarRef.current?.contains(target)) return;
            e.stopPropagation();
            closeMobileControls();
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/80 pointer-events-none" />

          {/* Close button (top-left) */}
          {onClose && (
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-3 left-3 w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-sm text-white/85 bg-black/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}

          {/* TOP-RIGHT: Volume */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
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
            {showVolumeSlider && (
              <div className="bg-black/75 rounded-xl px-4 py-2.5 backdrop-blur-sm" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-28 accent-crystal-400 h-1.5 rounded-full cursor-pointer" />
              </div>
            )}
          </div>

          {/* CENTER: Skip + Play */}
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
          <div className="absolute bottom-0 left-0 right-0">
            <div className="flex items-center justify-between px-3 pb-1.5">
              <span className="text-white/75 text-xs font-mono tabular-nums">{fmtSeg(relTime)} / {fmtSeg(duracion)}</span>
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
                <div className="h-full bg-crystal-400 rounded-full" style={{ width: `${pct}%`, transition: isSeekingRef.current ? "none" : "width 0.1s linear" }} />
                <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

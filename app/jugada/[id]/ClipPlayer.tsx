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
}

export default function ClipPlayer({ videoUrl, inicioSeg, finSeg, duracion, blobUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [relTime, setRelTime] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const src = blobUrl ?? videoUrl;
  const clipStart = blobUrl ? 0 : inicioSeg;
  const clipEnd = blobUrl ? duracion : finSeg;
  const pct = duracion > 0 ? Math.min(100, (relTime / duracion) * 100) : 0;

  // HLS init
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const isHls = src.includes(".m3u8");
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      startPosition: clipStart,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      }
    });
    let userPaused = false;
    video.addEventListener("pause", () => { userPaused = true; });
    video.addEventListener("play", () => { userPaused = false; });
    video.addEventListener("waiting", () => {
      setTimeout(() => { if (video.paused && !userPaused) video.play().catch(() => {}); }, 800);
    });
    return () => hls.destroy();
  }, [src, clipStart]);

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
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Auto-hide controls: show when paused, hide 3s after play
  useEffect(() => {
    if (isPlaying) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    }
  }, [isPlaying]);

  // Auto-focus container on mount so keyboard shortcuts work immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Global keyboard shortcuts — capture:true fires before any element handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setShowSettings(s => !s);
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Non-passive wheel listener for zoom (React's onWheel is passive by default)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => {
        const next = Math.min(8, Math.max(1, z - e.deltaY * 0.005));
        if (next <= 1) { setPanX(0); setPanY(0); return 1; }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function revealControls() {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) { // iOS Safari
        (videoRef.current as any).webkitEnterFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  }

  function handleSkip(dir: "left" | "right") {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = dir === "left"
      ? Math.max(clipStart, v.currentTime - 5)
      : Math.min(clipEnd, v.currentTime + 5);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case " ": e.preventDefault(); togglePlay(); break;
      case "ArrowRight": e.preventDefault(); handleSkip("right"); break;
      case "ArrowLeft": e.preventDefault(); handleSkip("left"); break;
      case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
      case "m": case "M": e.preventDefault(); setMuted(m => !m); break;
    }
  }

  function seekToClientX(clientX: number) {
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duracion) return;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = clipStart + fraction * duracion;
    v.currentTime = Math.max(clipStart, Math.min(clipEnd, t));
    setRelTime(fraction * duracion);
  }

  function handleSeekMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const wasPlaying = !videoRef.current?.paused;
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

  function handleSeekTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    const wasPlaying = !videoRef.current?.paused;
    isSeekingRef.current = true;
    seekToClientX(e.touches[0].clientX);
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      if (ev.touches[0]) seekToClientX(ev.touches[0].clientX);
    };
    const onEnd = () => {
      isSeekingRef.current = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      if (wasPlaying) videoRef.current?.play().catch(() => {});
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  // Pan drag — only active when zoomed in
  function handleVideoMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    e.preventDefault();
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    const onMove = (ev: MouseEvent) => {
      dragMovedRef.current = true;
      setPanX(dragStartRef.current.panX + (ev.clientX - dragStartRef.current.x));
      setPanY(dragStartRef.current.panY + (ev.clientY - dragStartRef.current.y));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleVideoClick() {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    togglePlay();
    revealControls();
  }

  // panX/panY are stored in screen-space pixels.
  // translate is applied before scale, so divide by zoom for pre-scale coords.
  const videoStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    cursor: zoom > 1 ? "grab" : "pointer",
    transformOrigin: "center center",
    userSelect: "none",
  };

  const controlsVisible = showControls || !isPlaying || showSettings;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative overflow-hidden bg-black outline-none ${isFullscreen ? "flex items-center justify-center" : "aspect-video rounded-2xl border border-crystal-400/10"}`}
      onKeyDown={handleKeyDown}
      onMouseMove={revealControls}
      onMouseEnter={revealControls}
    >
      <video
        ref={videoRef}
        className={`object-contain ${isFullscreen ? "" : "w-full h-full"}`}
        playsInline
        preload="metadata"
        style={isFullscreen ? { ...videoStyle, width: "100%", height: "auto" } : videoStyle}
        onMouseDown={handleVideoMouseDown}
        onClick={handleVideoClick}
        onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = clipStart; }}
        onCanPlay={(e) => { setBuffering(false); (e.target as HTMLVideoElement).play().catch(() => {}); }}
        onSeeking={() => setBuffering(true)}
        onSeeked={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onPlay={() => { setIsPlaying(true); setBuffering(false); }}
        onPause={() => { if (!isSeekingRef.current) setIsPlaying(false); }}
        onError={() => setBuffering(false)}
        onTimeUpdate={(e) => {
          const v = e.target as HTMLVideoElement;
          if (v.currentTime >= clipEnd) {
            v.pause();
            v.currentTime = clipStart;
            setRelTime(0);
          } else {
            setRelTime(Math.max(0, v.currentTime - clipStart));
          }
        }}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Controls gradient overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-14 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Seek bar */}
        <div
          ref={seekBarRef}
          className="w-full h-4 flex items-center cursor-pointer relative group mb-1"
          onMouseDown={handleSeekMouseDown}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleSeekTouchStart}
        >
          <div className="w-full h-0.5 bg-white/25 rounded-full relative pointer-events-none group-hover:h-1 transition-all duration-150">
            <div
              className="h-full bg-crystal-400 rounded-full pointer-events-none"
              style={{ width: `${pct}%`, transition: isSeekingRef.current ? "none" : "width 0.1s linear" }}
            />
            <div
              className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md pointer-events-none -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-7 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip −5s */}
          <button
            onClick={() => handleSkip("left")}
            title="−5s (←)"
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>

          {/* Skip +5s */}
          <button
            onClick={() => handleSkip("right")}
            title="+5s (→)"
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>

          {/* Time */}
          <span className="text-white/50 text-xs font-mono tabular-nums ml-2 select-none">
            {fmtSeg(relTime)} / {fmtSeg(duracion)}
          </span>

          <div className="flex-1" />

          {/* Zoom reset pill — only visible when zoomed */}
          {zoom > 1 && (
            <button
              onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
              className="text-[10px] text-crystal-400 font-mono border border-crystal-400/30 rounded-full px-2 py-0.5 hover:bg-crystal-400/10 mr-0.5 transition-colors select-none"
              title="Resetear zoom (scroll para ajustar)"
            >
              {zoom.toFixed(1)}× ✕
            </button>
          )}

          {/* Settings (speed + brightness + contrast) */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }}
              className={`w-7 h-7 flex items-center justify-center transition-colors ${showSettings ? "text-crystal-400" : "text-white/80 hover:text-white"}`}
              title="Ajustes de imagen y velocidad (G)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {showSettings && (
              <div
                className="absolute bottom-9 right-0 bg-lake-900/95 border border-mist-500/15 rounded-xl p-3.5 w-56 backdrop-blur-sm shadow-xl space-y-3.5 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Speed */}
                <div>
                  <span className="text-[11px] text-mist-400 block mb-1.5">Velocidad</span>
                  <div className="flex flex-wrap gap-1">
                    {([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4] as const).map((s) => (
                      <button key={s} onClick={() => setPlaybackSpeed(s)}
                        className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-all ${
                          playbackSpeed === s
                            ? "bg-crystal-400/15 border-crystal-400/50 text-crystal-400"
                            : "border-white/10 text-white/50 hover:text-white hover:border-white/25"
                        }`}
                      >
                        {s === 1 ? "1×" : `${s}×`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Brightness */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11px] text-mist-400">Brillo</span>
                    <span className="text-[11px] font-mono text-mist-600">{brightness}%</span>
                  </div>
                  <input type="range" min={50} max={200} value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-crystal-400 h-1 rounded-full cursor-pointer" />
                </div>
                {/* Contrast */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[11px] text-mist-400">Contraste</span>
                    <span className="text-[11px] font-mono text-mist-600">{contrast}%</span>
                  </div>
                  <input type="range" min={50} max={200} value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-crystal-400 h-1 rounded-full cursor-pointer" />
                </div>
                <button
                  onClick={() => { setBrightness(100); setContrast(100); setPlaybackSpeed(1); }}
                  className="w-full text-[11px] text-mist-600 hover:text-snow text-center py-1 hover:bg-white/5 rounded-lg transition-colors"
                >
                  Restablecer todo
                </button>
              </div>
            )}
          </div>

          {/* Mute */}
          <button
            onClick={() => setMuted(m => !m)}
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white transition-colors"
            title={muted ? "Activar sonido (M)" : "Silenciar (M)"}
          >
            {muted ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-7 md:h-7 flex items-center justify-center text-white/55 hover:text-white transition-colors"
            title={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  /** Pre-processed blob URL (already trimmed to clip). If provided, shows 0-based time. */
  blobUrl?: string;
  onClose?: () => void;
  /** Use smaller controls (for sidebar / small cards) */
  compact?: boolean;
  /** Extra className for the container (default is aspect-video) */
  className?: string;
}

export default function InlineClipPlayer({
  videoUrl,
  inicioSeg,
  finSeg,
  duracion,
  blobUrl,
  onClose,
  compact = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [relTime, setRelTime] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const src = blobUrl ?? videoUrl;
  const clipStart = blobUrl ? 0 : inicioSeg;
  const clipEnd = blobUrl ? duracion : finSeg;
  const pct = duracion > 0 ? Math.min(100, (relTime / duracion) * 100) : 0;

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
    v.muted = volume === 0;
  }, [volume]);

  /* ── HLS source initialization ── */
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

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      }
    });

    let userPaused = false;
    video.addEventListener("pause", () => { userPaused = true; });
    video.addEventListener("play", () => { userPaused = false; });
    video.addEventListener("waiting", () => {
      setTimeout(() => {
        if (video.paused && !userPaused) video.play().catch(() => {});
      }, 800);
    });

    return () => hls.destroy();
  }, [src, clipStart]);

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

  function handleSkip(direction: "left" | "right") {
    const v = videoRef.current;
    if (!v) return;
    const amount = 5;
    if (direction === "left") {
      v.currentTime = Math.max(clipStart, v.currentTime - amount);
    } else {
      v.currentTime = Math.min(clipEnd, v.currentTime + amount);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); handleSkip("right"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); handleSkip("left"); }
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
  }

  /* ── seek bar ── */
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

  function handleSeekBarTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
    isSeekingRef.current = true;
    seekToClientX(touch.clientX);

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

  const ic = compact ? "w-3.5 h-3.5" : "w-4 h-4";
  const btn = compact ? "w-6 h-6" : "w-7 h-7";
  const pad = compact ? "px-2 pb-2 pt-6" : "px-3 pb-2.5 pt-8";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative overflow-hidden bg-black outline-none ${isFullscreen ? "flex items-center justify-center" : (className ?? "aspect-video")}`}
      onKeyDown={handleKeyDown}
    >
      <video
        ref={videoRef}
        className={`object-contain ${isFullscreen ? "" : "w-full h-full"}`}
        style={isFullscreen ? { width: "100%", height: "auto" } : undefined}
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          (e.target as HTMLVideoElement).currentTime = clipStart;
        }}
        onCanPlay={(e) => {
          setBuffering(false);
          (e.target as HTMLVideoElement).play().catch(() => {});
        }}
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
          <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Click body to play/pause */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ bottom: compact ? 68 : 82, touchAction: "manipulation" }}
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent ${pad}`}>
        {/* Seekable progress bar */}
        <div
          ref={seekBarRef}
          className="w-full h-4 flex items-center cursor-pointer relative group mb-0.5"
          onMouseDown={handleSeekBarMouseDown}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleSeekBarTouchStart}
        >
          <div className="w-full h-0.5 bg-white/25 rounded-full relative pointer-events-none group-hover:h-1 transition-all duration-150">
            <div
              className="h-full bg-crystal-400 rounded-full pointer-events-none"
              style={{ width: `${pct}%`, transition: isSeekingRef.current ? "none" : "width 0.1s linear" }}
            />
            <div
              className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md pointer-events-none -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className={`${btn} flex items-center justify-center text-white/80 hover:text-white transition-colors`}
          >
            {isPlaying ? (
              <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className={`${ic} ml-0.5`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="text-white/55 text-xs font-mono tabular-nums">
            {fmtSeg(relTime)} / {fmtSeg(duracion)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div
            className="flex items-center gap-1"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={() => {
                if (volume === 0) {
                  setVolume(1);
                } else {
                  setVolume(0);
                }
                setShowVolumeSlider((v) => !v);
              }}
              className={`${btn} flex items-center justify-center text-white/60 hover:text-white transition-colors`}
              title={volume === 0 ? "Activar sonido" : "Silenciar"}
            >
              {volume === 0 ? (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 0.5 ? (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? "w-14 opacity-100" : "w-0 opacity-0"}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-14 accent-crystal-400 h-1 rounded-full cursor-pointer"
              />
            </div>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${btn} min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-white/60 hover:text-white transition-colors`}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg className={ic} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className={`${btn} flex items-center justify-center text-white/60 hover:text-red-400 transition-colors`}
            >
              <svg className={ic} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

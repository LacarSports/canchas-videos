"use client";

import { useEffect, useState } from "react";
import { crearMarcaAgua, type FormatoClip } from "@/lib/marcaAgua";

// Una imagen por formato/proporción para toda la página
const cache = new Map<string, Promise<string>>();

function imagenMarca(formato: FormatoClip, aspecto: number): Promise<string> {
  const W = formato === "reel" ? 540 : 1920;
  const H = formato === "reel" ? 960 : Math.round(1920 / aspecto);
  const clave = `${formato}-${W}x${H}`;
  if (!cache.has(clave)) {
    cache.set(clave, crearMarcaAgua(formato, W, H).then((c) => c.toDataURL("image/png")));
  }
  return cache.get(clave)!;
}

/**
 * Marca de agua sobre el video mientras se mira (la misma que llevan los clips
 * descargados): logo arriba al centro en ambos formatos. Así grabar la
 * pantalla no sirve para sacar el video sin marca. Va dentro del cuadro del video.
 */
export default function MarcaAguaVivo({ formato, aspecto = 16 / 9 }: { formato: FormatoClip; aspecto?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    imagenMarca(formato, aspecto).then((u) => { if (vivo) setUrl(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [formato, aspecto]);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-10" />
  );
}

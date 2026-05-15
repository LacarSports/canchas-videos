import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");

  if (!url) return Response.json({ error: "Missing url" }, { status: 400 });
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return Response.json({ error: "URL inválida" }, { status: 400 });
  }

  const startSec = startParam ? parseFloat(startParam) : 0;
  const endSec = endParam ? parseFloat(endParam) : Infinity;

  try {
    const m3u8Res = await fetch(url);
    if (!m3u8Res.ok) {
      return Response.json({ error: "Error al obtener playlist HLS" }, { status: 502 });
    }
    const m3u8Text = await m3u8Res.text();

    // Base URL for resolving relative segment paths
    const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

    type Segment = { uri: string; duration: number; start: number };
    const segments: Segment[] = [];
    let pendingDuration = 0;
    let elapsed = 0;

    for (const line of m3u8Text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#EXTINF:")) {
        pendingDuration = parseFloat(trimmed.slice(8).split(",")[0]);
      } else if (trimmed && !trimmed.startsWith("#")) {
        const uri = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
        segments.push({ uri, duration: pendingDuration, start: elapsed });
        elapsed += pendingDuration;
        pendingDuration = 0;
      }
    }

    // Keep segments that overlap [startSec, endSec)
    const needed = segments.filter(
      (s) => s.start + s.duration > startSec && s.start < endSec
    );

    if (needed.length === 0) {
      return Response.json({ error: "Sin segmentos para el rango indicado" }, { status: 404 });
    }

    const segmentStart = needed[0].start;

    // Download all needed segments in parallel
    const buffers = await Promise.all(
      needed.map(async (seg) => {
        const res = await fetch(seg.uri);
        if (!res.ok) throw new Error(`Error ${res.status} en segmento`);
        return new Uint8Array(await res.arrayBuffer());
      })
    );

    // Concatenate into single binary
    const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const buf of buffers) { out.set(buf, offset); offset += buf.length; }

    return new Response(out, {
      headers: {
        "Content-Type": "video/mp2t",
        "Content-Length": totalLen.toString(),
        "X-Segment-Start": segmentStart.toString(),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-Segment-Start",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return Response.json({ error: msg }, { status: 502 });
  }
}

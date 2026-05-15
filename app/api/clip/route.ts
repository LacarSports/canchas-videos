import { NextRequest } from "next/server";
import { spawn } from "child_process";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const inicioSeg = request.nextUrl.searchParams.get("inicio_seg");
  const finSeg = request.nextUrl.searchParams.get("fin_seg");

  if (!url || !inicioSeg || !finSeg) {
    return Response.json(
      { error: "Parámetros requeridos: url, inicio_seg, fin_seg" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const inicio = parseFloat(inicioSeg);
  const duracion = parseFloat(finSeg) - inicio;

  if (duracion <= 0) {
    return Response.json(
      { error: "El timestamp de fin debe ser mayor al de inicio" },
      { status: 400 }
    );
  }

  return new Promise<Response>((resolve) => {
    const chunks: Buffer[] = [];

    const isHls = url.includes(".m3u8");
    const ffmpegArgs = [
      "-ss", inicio.toString(),
      "-i", url,
      "-t", duracion.toString(),
      "-c", "copy",
      ...(isHls ? ["-bsf:a", "aac_adtstoasc"] : []),
      "-f", "mp4",
      "-movflags", "frag_keyframe+empty_moov",
      "-loglevel", "error",
      "pipe:1",
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

    ffmpeg.on("close", (code: number) => {
      if (code !== 0) {
        resolve(
          Response.json(
            { error: "Error al procesar el clip. Verifica que FFmpeg esté instalado en el servidor." },
            { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
          )
        );
        return;
      }

      const buffer = Buffer.concat(chunks);
      resolve(
        new Response(buffer, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="clip_lacar_sports_${Math.floor(inicio)}s-${Math.floor(parseFloat(finSeg))}s.mp4"`,
            "Content-Length": buffer.length.toString(),
            "Access-Control-Allow-Origin": "*",
          },
        })
      );
    });

    ffmpeg.on("error", () => {
      resolve(
        Response.json(
          { error: "FFmpeg no está disponible en este servidor." },
          { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
        )
      );
    });
  });
}

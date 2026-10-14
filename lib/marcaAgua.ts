/**
 * Client-only. Dibuja las marcas de agua de Lacar Sports sobre un canvas transparente
 * del tamaño exacto del video de salida. Se genera una sola vez por descarga y luego
 * se pinta encima de cada cuadro.
 *
 * Una sola marca para todos los clips: logo LS + "Lacar Sports" arriba al centro, algo
 * transparente para no tapar el partido. En el reel (9:16) va más abajo, fuera de la
 * franja superior que tapan los controles de Instagram/TikTok.
 */

export type FormatoClip = "reel" | "completo";

// Colores de marca (globals.css): glacial-500, glacial-400, crystal-400, glacial-300.
const CELESTE = "#4daec4";
const CELESTE_CLARO = "#82d8ed";
const TURQUESA_CLARO = "#72edd9"; // crystal-300: más legible sobre pasto/cancha

// viewBox del SVG del logo LS (marca/logo-lacar-blanco.svg).
const LOGO_RATIO = 964 / 783;

let _logo: Promise<HTMLImageElement> | null = null;

function cargarLogo(): Promise<HTMLImageElement> {
  if (_logo) return _logo;
  _logo = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { _logo = null; reject(new Error("No se pudo cargar el logo")); };
    img.src = "/marca-agua/ls.svg";
  });
  return _logo;
}

/** Logo LS rellenado con el degradado de marca en un canvas propio. */
function logoTenido(logo: HTMLImageElement, alto: number): HTMLCanvasElement {
  const w = Math.round(alto * LOGO_RATIO);
  const h = Math.round(alto);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(logo, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in";
  const g = ctx.createLinearGradient(0, h, w, 0);
  g.addColorStop(0, CELESTE);
  g.addColorStop(1, TURQUESA_CLARO);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

async function dibujarMarca(ctx: CanvasRenderingContext2D, W: number, H: number, formato: FormatoClip) {
  const logo = await cargarLogo();
  // Mismo tamaño relativo al ancho en ambos formatos (en 16:9 equivale a 5,8% del alto).
  const alto = Math.min(H * 0.058, W * 0.06);
  const ls = logoTenido(logo, alto);

  // Misma tipografía de la web (Geist, cargada por next/font).
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
  const size = Math.round(alto * 0.66);
  ctx.font = `700 ${size}px ${familia}`;
  ctx.textBaseline = "middle";
  const gap = alto * 0.3;
  const espacio = ctx.measureText(" ").width;
  const wLacar = ctx.measureText("Lacar").width;
  const wSports = ctx.measureText("Sports").width;
  const total = ls.width + gap + wLacar + espacio + wSports;

  const x0 = (W - total) / 2;
  const y0 = formato === "reel" ? H * 0.11 : H * 0.04;
  const yTexto = y0 + alto / 2;

  // Cápsula oscura translúcida detrás: se lee sobre cielo claro o cancha oscura sin tapar.
  const padX = alto * 0.45, padY = alto * 0.22;
  ctx.save();
  ctx.fillStyle = "rgba(5, 15, 25, 0.32)";
  ctx.beginPath();
  ctx.roundRect(x0 - padX, y0 - padY, total + padX * 2, alto + padY * 2, (alto + padY * 2) / 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = alto * 0.2;
  ctx.drawImage(ls, x0, y0);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Lacar", x0 + ls.width + gap, yTexto);
  const xs = x0 + ls.width + gap + wLacar + espacio;
  const g = ctx.createLinearGradient(xs, 0, xs + wSports, 0);
  g.addColorStop(0, CELESTE_CLARO);
  g.addColorStop(1, TURQUESA_CLARO);
  ctx.fillStyle = g;
  ctx.fillText("Sports", xs, yTexto);
  ctx.restore();
}

/** Canvas transparente W×H con la marca de agua del formato pedido. */
export async function crearMarcaAgua(formato: FormatoClip, W: number, H: number): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  await dibujarMarca(ctx, W, H, formato);
  return c;
}

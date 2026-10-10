/**
 * Client-only. Dibuja las marcas de agua de Lacar Sports sobre un canvas transparente
 * del tamaño exacto del video de salida. Se genera una sola vez por descarga y luego
 * se pinta encima de cada cuadro.
 *
 * - "reel" (9:16): curvas en esquina superior derecha e inferior izquierda + logo LS.
 * - "completo" (16:9): logo LS + "Lacar Sports" abajo al centro.
 */

export type FormatoClip = "reel" | "completo";

// Colores de marca (globals.css): glacial-500, glacial-400, crystal-400, glacial-300.
const AZUL = "#318eaa";
const CELESTE = "#4daec4";
const TURQUESA = "#29c4ad";
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

/** Logo LS rellenado con un degradado (o blanco) en un canvas propio. */
function logoTenido(logo: HTMLImageElement, alto: number, relleno: "blanco" | "degradado"): HTMLCanvasElement {
  const w = Math.round(alto * LOGO_RATIO);
  const h = Math.round(alto);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(logo, 0, 0, w, h);
  if (relleno === "degradado") {
    ctx.globalCompositeOperation = "source-in";
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, CELESTE);
    g.addColorStop(1, TURQUESA_CLARO);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

/**
 * Esquina superior derecha del reel, calcada del diseño de referencia (720×1280):
 * una zona clara pegada a la esquina, una banda más oscura que la rodea (su borde
 * interior es donde empieza el video) y una línea de acento separada, en forma de
 * media luna. La esquina inferior izquierda es la misma figura girada 180°.
 * Coordenadas en la base 720×1280; el llamador escala al tamaño real.
 */
function dibujarEsquina(ctx: CanvasRenderingContext2D) {
  // Banda oscura: del borde superior (x=420) al borde derecho (y=315).
  const banda = ctx.createLinearGradient(420, 0, 720, 315);
  banda.addColorStop(0, AZUL);
  banda.addColorStop(1, "#2a7d99");
  ctx.fillStyle = banda;
  ctx.beginPath();
  ctx.moveTo(420, 0);
  ctx.lineTo(720, 0);
  ctx.lineTo(720, 315);
  ctx.bezierCurveTo(700, 80, 570, 15, 420, 0);
  ctx.closePath();
  ctx.fill();

  // Zona clara de la esquina (detrás del logo).
  const clara = ctx.createRadialGradient(720, 0, 0, 720, 0, 260);
  clara.addColorStop(0, CELESTE_CLARO);
  clara.addColorStop(0.55, CELESTE);
  clara.addColorStop(1, TURQUESA);
  ctx.fillStyle = clara;
  ctx.beginPath();
  ctx.moveTo(485, 0);
  ctx.lineTo(720, 0);
  ctx.lineTo(720, 235);
  ctx.bezierCurveTo(705, 60, 610, 12, 485, 0);
  ctx.closePath();
  ctx.fill();

  // Acento: media luna puntiaguda en ambos extremos, separada de la banda.
  const acento = ctx.createLinearGradient(548, 68, 708, 335);
  acento.addColorStop(0, TURQUESA_CLARO);
  acento.addColorStop(1, "#4fd8c4");
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.moveTo(548, 68);
  ctx.bezierCurveTo(636, 94, 698, 172, 708, 335);
  ctx.bezierCurveTo(674, 190, 616, 118, 548, 68);
  ctx.closePath();
  ctx.fill();
}

async function marcaReel(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const logo = await cargarLogo();
  const sx = W / 720, sy = H / 1280;

  ctx.save();
  ctx.scale(sx, sy);
  dibujarEsquina(ctx);
  ctx.translate(720, 1280);
  ctx.rotate(Math.PI);
  dibujarEsquina(ctx);
  ctx.restore();

  // Logo LS blanco sobre la zona clara de cada esquina.
  const ls = logoTenido(logo, 46 * sy, "blanco");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6 * sy;
  ctx.drawImage(ls, W - 22 * sx - ls.width, 28 * sy);
  ctx.drawImage(ls, 17 * sx, H - 30 * sy - ls.height);
  ctx.restore();
}

async function marcaCompleto(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const logo = await cargarLogo();
  const alto = H * 0.058;
  const ls = logoTenido(logo, alto, "degradado");

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
  const y0 = H - H * 0.045 - alto;
  const yTexto = y0 + alto / 2;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = alto * 0.3;
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
  if (formato === "reel") await marcaReel(ctx, W, H);
  else await marcaCompleto(ctx, W, H);
  return c;
}

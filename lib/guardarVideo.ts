/**
 * Entrega un video ya preparado al usuario. En el celular abre el menú nativo de
 * compartir (desde ahí se guarda en la galería o se manda a Instagram/WhatsApp);
 * en el computador lo descarga como archivo.
 *
 * Debe llamarse directo desde el toque del usuario y sin esperas previas: Safari
 * solo permite abrir el menú de compartir dentro del gesto.
 */
export function guardarVideo(blob: Blob, blobUrl: string, nombre: string): void {
  const tactil = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (tactil && typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
    const archivo = new File([blob], nombre, { type: "video/mp4" });
    if (navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo] }).catch((e: unknown) => {
        // Cerrar el menú no es un error; si el navegador lo bloquea, descargar el archivo
        if (!(e instanceof Error && e.name === "AbortError")) descargar(blobUrl, nombre);
      });
      return;
    }
  }
  descargar(blobUrl, nombre);
}

function descargar(blobUrl: string, nombre: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = nombre;
  a.click();
}

/** Nombre de archivo: lacar-sports_<etiqueta>_<formato>.mp4 */
export function nombreVideo(etiqueta: string, formato: string) {
  const e = (etiqueta || "jugada").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return `lacar-sports_${e}_${formato}.mp4`;
}

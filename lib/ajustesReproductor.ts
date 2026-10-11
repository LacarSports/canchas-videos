"use client";

/**
 * Ajustes compartidos por todos los reproductores de la página (partido completo y
 * jugadas destacadas): si en uno se silencia o se sube el brillo, cambia en todos.
 * Se recuerdan en la pestaña (sessionStorage) para que no se pierdan al recargar.
 */
import { useSyncExternalStore } from "react";

export interface AjustesReproductor {
  volumen: number;    // 0–1
  brillo: number;     // % (100 = normal)
  contraste: number;  // % (100 = normal)
  velocidad: number;  // 1 = normal
}

const CLAVE = "lacar_ajustes_reproductor";
const INICIAL: AjustesReproductor = { volumen: 1, brillo: 100, contraste: 100, velocidad: 1 };

let estado: AjustesReproductor = INICIAL;
let cargado = false;
const suscriptores = new Set<() => void>();

function cargar() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  try {
    const guardado = sessionStorage.getItem(CLAVE);
    if (guardado) estado = { ...INICIAL, ...JSON.parse(guardado) };
  } catch { /* sin almacenamiento: valores por defecto */ }
}

export function setAjustes(cambios: Partial<AjustesReproductor>) {
  cargar();
  estado = { ...estado, ...cambios };
  try { sessionStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* ignorar */ }
  suscriptores.forEach((fn) => fn());
}

function suscribir(fn: () => void) {
  suscriptores.add(fn);
  return () => { suscriptores.delete(fn); };
}

function leer() { cargar(); return estado; }

/** Valor actual fuera de React (p. ej. en atajos de teclado). */
export function getAjustes(): AjustesReproductor { return leer(); }

export function useAjustesReproductor(): AjustesReproductor {
  return useSyncExternalStore(suscribir, leer, () => INICIAL);
}

/** Filtro CSS para brillo/contraste, o undefined si están normales. */
export function filtroImagen(a: AjustesReproductor) {
  return a.brillo !== 100 || a.contraste !== 100 ? `brightness(${a.brillo}%) contrast(${a.contraste}%)` : undefined;
}

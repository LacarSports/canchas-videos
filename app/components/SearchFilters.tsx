"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { smoothScrollTo } from "@/lib/smoothScroll";
import { useState, useEffect, useRef, Suspense, useTransition, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ── utils ──────────────────────────────────────────────── */

function getLast8Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
}

function formatFechaLabel(fecha: string, last8: string[]): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (fecha === last8[0])
    return `Hoy · ${date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`;
  if (fecha === last8[1])
    return `Ayer · ${date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`;
  return date.toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "short" });
}

/* ── shared outside-click hook ──────────────────────────── */

/*
  Usa pointerdown (en lugar de mousedown + touchstart por separado) para
  detectar toques fuera del dropdown tanto en desktop como en iOS.
  El callback onClose se guarda en un ref para que el effect no se recree
  en cada render (evita que la arrow function inline rompa la estabilidad).
*/
function useOutsideClose(
  isOpen: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    function handleOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onCloseRef.current(); }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, containerRef]);
}

/* ── ComboField — texto libre + dropdown (solo para complejo) */

interface ComboFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onSelect: (val: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Faltó completarla al tocar "Ver partido": se tiñe de rojo suave. */
  error?: boolean;
}

/* Casilla que faltó completar: rojo suave, sin gritar. */
const ERROR_CASILLA = "bg-red-50 border-red-300 ring-2 ring-red-200/70";

function ComboField({ id, label, placeholder, value, onChange, options, onSelect, isOpen, onOpen, onClose, error }: ComboFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filterQuery, setFilterQuery] = useState("");

  useOutsideClose(isOpen, onClose, containerRef);

  // Reset filter when dropdown opens so ALL options are visible
  useEffect(() => { if (isOpen) setFilterQuery(""); }, [isOpen]);

  const filtered = options.filter((opt) => {
    const q = filterQuery.toLowerCase();
    return !q || opt.toLowerCase().includes(q);
  });

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className={`block text-[13px] font-semibold mb-1.5 transition-colors ${error ? "text-red-500" : "text-ink-700"}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setFilterQuery(e.target.value); }}
          onFocus={onOpen}
          onClick={onOpen}
          autoComplete="off"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          className={`w-full border text-ink-950 rounded-xl px-3.5 pr-9 py-2.5 text-base sm:text-sm placeholder-ink-300 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-[background-color,border-color,box-shadow] duration-200 ${error ? ERROR_CASILLA : "bg-white border-line hover:border-ink-300"}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className={`w-3.5 h-3.5 text-ink-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1.5 bg-white border border-line rounded-xl shadow-[0_16px_40px_rgba(11,29,38,0.14)] overflow-hidden">
          {filtered.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  // Se elige en el "click" y no al apoyar el dedo: si el desplegable se cerrara al
                  // apoyar, el mismo toque caería en lo que hay debajo (p. ej. "Ver partido").
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { onSelect(opt); onClose(); if (document.activeElement instanceof HTMLElement) { document.activeElement.blur(); } /* Ocultar teclado en móvil */ }}
                  className="w-full text-left px-4 py-3 text-[15px] text-ink-700 hover:bg-brand-soft hover:text-ink-950 transition-colors"
                  style={{ touchAction: "manipulation" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3.5 text-sm text-ink-500 text-center">
              {options.length === 0 ? "Cargando..." : "Sin resultados"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SelectField — solo dropdown, sin texto libre ───────── */

interface SelectFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  displayValue?: string;
  options: string[];
  displayOptions?: string[];
  onSelect: (val: string) => void;
  disabled?: boolean;
  /** Buscando las opciones: se muestra "Cargando…" y no se puede abrir. */
  loading?: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  error?: boolean;
}

function SelectField({ id, label, placeholder, value, displayValue, options, displayOptions, onSelect, disabled: disabledProp, loading, isOpen, onOpen, onClose, error }: SelectFieldProps) {
  const disabled = disabledProp || loading;
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClose(isOpen, onClose, containerRef);

  const shown = displayValue || value;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className={`block text-[13px] font-semibold mb-1.5 transition-colors ${error ? "text-red-500" : disabled ? "text-ink-300" : "text-ink-700"}`}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        onPointerDown={disabled ? undefined : (e) => { e.preventDefault(); if (isOpen) onClose(); else onOpen(); }}
        disabled={disabled}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        className={`relative w-full border rounded-xl px-3.5 pr-9 py-2.5 text-base sm:text-sm text-left transition-all duration-200 focus:outline-none ${
          error
            ? `${ERROR_CASILLA} ${disabled ? "text-red-300 cursor-not-allowed" : "cursor-pointer"}`
            : disabled
            ? "bg-surface border-line text-ink-300 cursor-not-allowed"
            : isOpen
            ? "bg-white border-brand ring-2 ring-brand/30 text-ink-950"
            : "bg-white border-line hover:border-ink-300 cursor-pointer"
        } ${!disabled && shown ? "text-ink-950" : !disabled ? (error ? "text-red-500" : "text-ink-500") : ""}`}
      >
        {loading ? <span className="text-ink-500">Cargando…</span> : shown || placeholder}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin align-[-2px]" />
          ) : (
            <svg className={`w-3.5 h-3.5 text-ink-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1.5 bg-white border border-line rounded-xl shadow-[0_16px_40px_rgba(11,29,38,0.14)] overflow-hidden">
          {options.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              {options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  // Se elige en el "click": así el toque no atraviesa al botón de buscar de abajo
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { onSelect(opt); onClose(); }}
                  className={`w-full text-left px-4 py-3 text-[15px] hover:bg-brand-soft hover:text-ink-950 transition-colors ${opt === value ? "text-brand-ink font-semibold bg-brand-soft" : "text-ink-700"}`}
                  style={{ touchAction: "manipulation" }}
                >
                  {displayOptions ? displayOptions[i] : opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3.5 text-sm text-ink-500 text-center">No hay opciones disponibles</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Filters ────────────────────────────────────────────── */

type Casilla = "complejo" | "cancha" | "fecha" | "hora";

function Filters() {
  const router = useRouter();
  const sp = useSearchParams();

  const [last8] = useState<string[]>(() => getLast8Days());

  const initFecha = sp.get("fecha") ?? "";

  const [complejo, setComplejo] = useState(sp.get("complejo") ?? "");
  const [complejoSel, setComplejoSel] = useState(sp.get("complejo") ?? "");
  const [deporteSel, setDeporteSel] = useState(sp.get("deporte") ?? "");
  const [canchaSel, setCanchaSel] = useState(sp.get("cancha") ?? "");
  const [fechaRaw, setFechaRaw] = useState(initFecha);
  const [fechaDisplay, setFechaDisplay] = useState(() =>
    initFecha ? formatFechaLabel(initFecha, getLast8Days()) : ""
  );
  const [hora, setHora] = useState(sp.get("hora") ?? "");

  const [openField, setOpenField] = useState<string | null>(null);

  const [complejoOpts, setComplejoOpts] = useState<string[]>([]);
  const [deporteOpts, setDeporteOpts] = useState<string[]>([]);
  const [canchaOpts, setCanchaOpts] = useState<string[]>([]);
  const [fechaOpts, setFechaOpts] = useState<string[]>([]);
  const [fechaDisplayOpts, setFechaDisplayOpts] = useState<string[]>([]);
  const [horaOpts, setHoraOpts] = useState<string[]>([]);

  // Qué opciones se están buscando en la base (para avisar "Cargando…" en cada campo)
  const [cargando, setCargando] = useState({ complejo: true, deporte: false, cancha: false, fecha: false, hora: false });
  const marcarCarga = useCallback((campo: keyof typeof cargando, valor: boolean) =>
    setCargando((c) => (c[campo] === valor ? c : { ...c, [campo]: valor })), []);
  // Búsqueda en curso (la página trae los partidos del servidor)
  const [buscando, startBuscar] = useTransition();
  // "Ver partido": buscando el partido elegido para abrirlo directo
  const [abriendo, setAbriendo] = useState(false);

  // Al volver (p. ej. desde un partido) se rellenan los filtros guardados, sin buscar solo:
  // el partido se abre únicamente con el botón "Ver partido".
  useEffect(() => {
    if (sp.get("complejo")) return;
    try {
      const saved = sessionStorage.getItem("lacar_filters");
      if (!saved) return;
      const s = JSON.parse(saved) as Record<string, string>;
      if (s.complejo)  { setComplejo(s.complejo);  setComplejoSel(s.complejo); }
      if (s.deporte)   setDeporteSel(s.deporte);
      if (s.cancha)    setCanchaSel(s.cancha);
      if (s.fechaRaw)  { setFechaRaw(s.fechaRaw); setFechaDisplay(s.fechaDisplay || formatFechaLabel(s.fechaRaw, last8)); }
      if (s.hora)      setHora(s.hora);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all complejo options once
  useEffect(() => {
    supabase.from("partidos").select("complejo").order("complejo").then(({ data }) => {
      marcarCarga("complejo", false);
      if (!data) return;
      const seen = new Map<string, string>();
      for (const r of data) {
        const val = (r.complejo as string).trim();
        const key = val.toLowerCase();
        if (!seen.has(key)) seen.set(key, val);
      }
      setComplejoOpts([...seen.values()].sort((a, b) => a.localeCompare(b, "es")));
    });
  }, [marcarCarga]);

  // Fetch deporte options when complejo changes
  useEffect(() => {
    if (!complejoSel) { setDeporteOpts([]); marcarCarga("deporte", false); return; }
    let vigente = true;
    setDeporteOpts([]);
    marcarCarga("deporte", true);
    supabase
      .from("partidos").select("deporte").ilike("complejo", complejoSel)
      .then(({ data }) => {
        if (!vigente) return;
        marcarCarga("deporte", false);
        if (!data) return;
        const unique = [
          ...new Set(data.map((r) => r.deporte as string | null).filter((d): d is string => !!d)),
        ].sort((a, b) => a.localeCompare(b, "es"));
        setDeporteOpts(unique);
        if (unique.length === 1) setDeporteSel(unique[0]);
      });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complejoSel]);

  // Fetch cancha options when complejo or deporte changes
  useEffect(() => {
    if (!complejoSel) { setCanchaOpts([]); marcarCarga("cancha", false); return; }
    let vigente = true;
    marcarCarga("cancha", true);
    let q = supabase.from("partidos").select("numero_cancha").ilike("complejo", complejoSel);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    q.then(({ data }) => {
      if (!vigente) return;
      marcarCarga("cancha", false);
      if (!data) return;
      const unique = [...new Set(data.map((r) => String(r.numero_cancha as number)))].sort(
        (a, b) => Number(a) - Number(b)
      );
      setCanchaOpts(unique);
    });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complejoSel, deporteSel]);

  // Fetch fecha options (last 8 days) when complejo, deporte, or cancha changes
  useEffect(() => {
    if (!complejoSel) { setFechaOpts([]); setFechaDisplayOpts([]); marcarCarga("fecha", false); return; }
    let vigente = true;
    marcarCarga("fecha", true);
    let q = supabase.from("partidos").select("fecha").ilike("complejo", complejoSel).in("fecha", last8);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    if (canchaSel)  q = q.eq("numero_cancha", parseInt(canchaSel));
    q.then(({ data }) => {
      if (!vigente) return;
      marcarCarga("fecha", false);
      if (!data) return;
      const unique = [...new Set(data.map((r) => r.fecha as string))].sort().reverse();
      setFechaOpts(unique);
      setFechaDisplayOpts(unique.map((f) => formatFechaLabel(f, last8)));
    });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complejoSel, deporteSel, canchaSel, last8]);

  // Fetch hora options when complejo, deporte, cancha, or fecha changes
  useEffect(() => {
    if (!complejoSel || !fechaRaw) { setHoraOpts([]); marcarCarga("hora", false); return; }
    let vigente = true;
    marcarCarga("hora", true);
    let q = supabase.from("partidos").select("hora").ilike("complejo", complejoSel).eq("fecha", fechaRaw);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    if (canchaSel)  q = q.eq("numero_cancha", parseInt(canchaSel));
    q.then(({ data }) => {
      if (!vigente) return;
      marcarCarga("hora", false);
      if (!data) return;
      const unique = [...new Set(data.map((r) => r.hora as string))].sort();
      setHoraOpts(unique);
    });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complejoSel, deporteSel, canchaSel, fechaRaw]);

  /* ── handlers ── */

  function handleComplejoChange(val: string) {
    setComplejo(val);
    const exactMatch = complejoOpts.find((o) => o.toLowerCase() === val.trim().toLowerCase());
    if (exactMatch && exactMatch !== complejoSel) {
      setComplejoSel(exactMatch);
      setDeporteSel(""); setCanchaSel("");
      setFechaRaw(""); setFechaDisplay(""); setHora("");
    } else if (!exactMatch && complejoSel && val !== complejoSel) {
      setComplejoSel("");
      setDeporteSel(""); setCanchaSel("");
      setFechaRaw(""); setFechaDisplay(""); setHora("");
    }
  }

  function handleSelectComplejo(val: string) {
    setComplejo(val); setComplejoSel(val);
    setDeporteSel(""); setCanchaSel("");
    setFechaRaw(""); setFechaDisplay(""); setHora("");
  }

  function handleSelectDeporte(val: string) {
    setDeporteSel(val);
    setCanchaSel("");
    setFechaRaw(""); setFechaDisplay(""); setHora("");
  }

  function handleSelectCancha(val: string) {
    setCanchaSel(val);
    setFechaRaw(""); setFechaDisplay(""); setHora("");
  }

  function handleSelectFecha(raw: string) {
    setFechaRaw(raw);
    setFechaDisplay(formatFechaLabel(raw, last8));
    setHora("");
  }

  /* ── submit ── */

  const canBuscar = !!complejoSel && !!canchaSel && !!fechaRaw && !!hora;

  // Casillas que faltaban al tocar "Ver partido". Cada una deja de marcarse
  // apenas la persona elige algo en ella.
  const valores: Record<Casilla, string> = { complejo: complejoSel, cancha: canchaSel, fecha: fechaRaw, hora };
  const [faltan, setFaltan] = useState<Casilla[]>([]);
  const faltanVivas = faltan.filter((c) => !valores[c]);
  if (faltanVivas.length !== faltan.length) setFaltan(faltanVivas);
  const marcada = (c: Casilla) => faltan.includes(c) && !valores[c];
  const hayFiltros = !!(complejo || deporteSel || canchaSel || fechaRaw || hora);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (abriendo) return;
    if (!canBuscar) {
      setFaltan((Object.keys(valores) as Casilla[]).filter((c) => !valores[c]));
      return;
    }
    const params = new URLSearchParams();
    params.set("complejo", complejoSel);
    if (deporteSel) params.set("deporte", deporteSel);
    params.set("cancha", canchaSel);
    params.set("fecha", fechaRaw);
    params.set("hora", hora);
    try {
      sessionStorage.setItem(
        "lacar_filters",
        JSON.stringify({ complejo: complejoSel, deporte: deporteSel, cancha: canchaSel, fechaRaw, fechaDisplay, hora })
      );
    } catch {}

    // Con todos los filtros puestos normalmente hay un solo partido: se abre directo.
    // Mismo criterio que la búsqueda de la página de inicio (app/page.tsx).
    setAbriendo(true);
    let q = supabase.from("partidos").select("id")
      .ilike("complejo", `%${complejoSel}%`)
      .eq("numero_cancha", parseInt(canchaSel))
      .eq("fecha", fechaRaw)
      .eq("hora", hora)
      .limit(2);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    const { data } = await q;
    if (data?.length === 1) {
      // La página del partido muestra "Abriendo partido…" mientras carga
      router.push(`/partido/${data[0].id}`);
      return;
    }
    // Ninguno o varios (o falló la consulta): mostrar la lista de resultados como antes
    setAbriendo(false);
    if (window.location.search === `?${params.toString()}`) {
      const el = document.getElementById(window.innerWidth < 768 ? "resultados" : "buscador");
      if (el) smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - 80);
      return;
    }
    startBuscar(() => router.push(`/?${params.toString()}`, { scroll: false }));
  }

  function handleLimpiar() {
    setComplejo(""); setComplejoSel("");
    setDeporteSel(""); setCanchaSel("");
    setFechaRaw(""); setFechaDisplay(""); setHora("");
    try { sessionStorage.removeItem("lacar_filters"); } catch {}
    router.push("/#buscador");
  }

  const cargandoAlgo = !!complejoSel && (cargando.deporte || cargando.cancha || cargando.fecha || (!!fechaRaw && cargando.hora));

  /* ── hint for missing field ── */
  const missingHint = !canBuscar && complejoSel
    ? `Elige ${!canchaSel ? "cancha" : !fechaRaw ? "fecha" : "hora"} para buscar`
    : null;

  return (
    /*
      Sin backdrop-blur-sm en el form: en iOS Safari, backdrop-filter crea una capa
      GPU con el tamaño exacto del elemento, recortando los dropdowns position:absolute
      que desbordan hacia abajo. Al quitarlo, los dropdowns son visibles en móvil.
    */
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-3xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(11,29,38,0.06)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">

        {/* Complejo — texto libre */}
        <ComboField
          id="complejo"
          label="Complejo"
          placeholder="Busca tu complejo..."
          value={complejo}
          onChange={handleComplejoChange}
          options={complejoOpts}
          onSelect={handleSelectComplejo}
          error={marcada("complejo")}
          isOpen={openField === "complejo"}
          onOpen={() => setOpenField("complejo")}
          onClose={() => setOpenField(null)}
        />

        {/* Deporte — solo dropdown */}
        <SelectField
          id="deporte"
          label="Deporte"
          placeholder={!complejoSel ? "Elige un complejo" : "Selecciona deporte"}
          value={deporteSel}
          options={deporteOpts}
          onSelect={handleSelectDeporte}
          disabled={!complejoSel || deporteOpts.length <= 1}
          loading={!!complejoSel && cargando.deporte}
          isOpen={openField === "deporte"}
          onOpen={() => setOpenField("deporte")}
          onClose={() => setOpenField(null)}
        />

        {/* Cancha — solo dropdown */}
        <SelectField
          id="cancha"
          label="Número de cancha"
          placeholder={!complejoSel ? "Elige un complejo" : "Cancha"}
          value={canchaSel}
          options={canchaOpts}
          onSelect={handleSelectCancha}
          disabled={!complejoSel}
          loading={!!complejoSel && cargando.cancha}
          error={marcada("cancha")}
          isOpen={openField === "cancha"}
          onOpen={() => setOpenField("cancha")}
          onClose={() => setOpenField(null)}
        />

        {/* Fecha — solo dropdown */}
        <SelectField
          id="fecha"
          label="Fecha"
          placeholder={!complejoSel ? "Elige un complejo" : "Fecha"}
          value={fechaRaw}
          displayValue={fechaDisplay}
          options={fechaOpts}
          displayOptions={fechaDisplayOpts}
          onSelect={handleSelectFecha}
          disabled={!complejoSel}
          loading={!!complejoSel && cargando.fecha}
          error={marcada("fecha")}
          isOpen={openField === "fecha"}
          onOpen={() => setOpenField("fecha")}
          onClose={() => setOpenField(null)}
        />

        {/* Hora — solo dropdown */}
        <SelectField
          id="hora"
          label="Hora"
          placeholder={!complejoSel || !fechaRaw ? "Elige complejo y fecha" : "Hora"}
          value={hora}
          options={horaOpts}
          onSelect={setHora}
          disabled={!complejoSel || !fechaRaw}
          loading={!!complejoSel && !!fechaRaw && cargando.hora}
          error={marcada("hora")}
          isOpen={openField === "hora"}
          onOpen={() => setOpenField("hora")}
          onClose={() => setOpenField(null)}
        />
      </div>

      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <button
          type="submit"
          disabled={buscando || abriendo}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold px-6 py-3.5 sm:py-3 rounded-xl text-base sm:text-sm transition-[background-color,transform] duration-150 ${
            buscando || abriendo
              ? "bg-brand/80 text-white cursor-wait"
              : canBuscar
              ? "bg-brand hover:bg-brand-hover text-white active:scale-[0.97] shadow-[0_8px_20px_rgba(45,201,183,0.3)]"
              : "bg-brand/45 text-white active:scale-[0.97]"
          }`}
        >
          {buscando || abriendo ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
            </svg>
          )}
          {abriendo ? "Abriendo partido…" : buscando ? "Buscando partido…" : "Ver partido"}
        </button>

        {!buscando && !abriendo && cargandoAlgo && (
          <span className="text-xs text-ink-500 flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Cargando opciones…
          </span>
        )}
        {!buscando && !abriendo && !cargandoAlgo && missingHint && (
          <span className="text-xs text-ink-500">{missingHint}</span>
        )}

        {hayFiltros && (
          <button
            type="button"
            onClick={handleLimpiar}
            className="ml-auto text-ink-500 hover:text-ink-950 text-sm font-medium px-3 py-2 rounded-xl hover:bg-surface transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </form>
  );
}

/* ── export with Suspense boundary ─────────────────────── */

export default function SearchFilters() {
  return (
    <Suspense fallback={<div className="h-36 bg-surface rounded-3xl border border-line animate-pulse" />}>
      <Filters />
    </Suspense>
  );
}

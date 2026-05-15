"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
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
}

function ComboField({ id, label, placeholder, value, onChange, options, onSelect, isOpen, onOpen, onClose }: ComboFieldProps) {
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
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest mb-2 text-mist-600">
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
          className="w-full bg-lake-950/60 border border-lake-700 text-snow rounded-xl px-3.5 pr-9 py-2.5 text-sm placeholder-lake-600 focus:outline-none focus:ring-1 focus:ring-crystal-400/60 focus:border-crystal-400/50 hover:border-mist-700/50 transition-all duration-200"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className={`w-3.5 h-3.5 text-mist-700 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1.5 bg-lake-800 border border-lake-700 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          {filtered.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); onSelect(opt); onClose(); }}
                  className="w-full text-left px-4 py-3 text-sm text-mist-400 hover:bg-crystal-400/8 hover:text-snow transition-colors"
                  style={{ touchAction: "manipulation" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3.5 text-sm text-mist-700 text-center">
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
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function SelectField({ id, label, placeholder, value, displayValue, options, displayOptions, onSelect, disabled, isOpen, onOpen, onClose }: SelectFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClose(isOpen, onClose, containerRef);

  const shown = displayValue || value;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className={`block text-xs font-semibold uppercase tracking-widest mb-2 transition-colors ${disabled ? "text-lake-600" : "text-mist-600"}`}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        onPointerDown={disabled ? undefined : (e) => { e.preventDefault(); if (isOpen) onClose(); else onOpen(); }}
        disabled={disabled}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        className={`relative w-full bg-lake-950/60 border rounded-xl px-3.5 pr-9 py-2.5 text-sm text-left transition-all duration-200 focus:outline-none ${
          disabled
            ? "border-lake-700/50 text-lake-600 cursor-not-allowed"
            : isOpen
            ? "border-crystal-400/50 ring-1 ring-crystal-400/60 text-snow"
            : "border-lake-700 hover:border-mist-700/50 cursor-pointer"
        } ${!disabled && shown ? "text-snow" : !disabled ? "text-lake-600" : ""}`}
      >
        {shown || placeholder}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className={`w-3.5 h-3.5 text-mist-700 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 z-[200] mt-1.5 bg-lake-800 border border-lake-700 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] overflow-hidden">
          {options.length > 0 ? (
            <div className="max-h-52 overflow-y-auto">
              {options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); onSelect(opt); onClose(); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-crystal-400/8 hover:text-snow transition-colors ${opt === value ? "text-crystal-400 bg-crystal-400/5" : "text-mist-400"}`}
                  style={{ touchAction: "manipulation" }}
                >
                  {displayOptions ? displayOptions[i] : opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3.5 text-sm text-mist-700 text-center">Cargando...</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Filters ────────────────────────────────────────────── */

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

  // Restore from sessionStorage when URL has no search params (e.g. navigating back from a partido)
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
      if (!data) return;
      const seen = new Map<string, string>();
      for (const r of data) {
        const val = (r.complejo as string).trim();
        const key = val.toLowerCase();
        if (!seen.has(key)) seen.set(key, val);
      }
      setComplejoOpts([...seen.values()].sort((a, b) => a.localeCompare(b, "es")));
    });
  }, []);

  // Fetch deporte options when complejo changes
  useEffect(() => {
    if (!complejoSel) { setDeporteOpts([]); return; }
    supabase
      .from("partidos").select("deporte").ilike("complejo", complejoSel)
      .then(({ data }) => {
        if (!data) return;
        const unique = [
          ...new Set(data.map((r) => r.deporte as string | null).filter((d): d is string => !!d)),
        ].sort((a, b) => a.localeCompare(b, "es"));
        setDeporteOpts(unique);
        if (unique.length === 1) setDeporteSel(unique[0]);
      });
  }, [complejoSel]);

  // Fetch cancha options when complejo or deporte changes
  useEffect(() => {
    if (!complejoSel) { setCanchaOpts([]); return; }
    let q = supabase.from("partidos").select("numero_cancha").ilike("complejo", complejoSel);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    q.then(({ data }) => {
      if (!data) return;
      const unique = [...new Set(data.map((r) => String(r.numero_cancha as number)))].sort(
        (a, b) => Number(a) - Number(b)
      );
      setCanchaOpts(unique);
    });
  }, [complejoSel, deporteSel]);

  // Fetch fecha options (last 8 days) when complejo, deporte, or cancha changes
  useEffect(() => {
    if (!complejoSel) { setFechaOpts([]); setFechaDisplayOpts([]); return; }
    let q = supabase.from("partidos").select("fecha").ilike("complejo", complejoSel).in("fecha", last8);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    if (canchaSel)  q = q.eq("numero_cancha", parseInt(canchaSel));
    q.then(({ data }) => {
      if (!data) return;
      const unique = [...new Set(data.map((r) => r.fecha as string))].sort().reverse();
      setFechaOpts(unique);
      setFechaDisplayOpts(unique.map((f) => formatFechaLabel(f, last8)));
    });
  }, [complejoSel, deporteSel, canchaSel, last8]);

  // Fetch hora options when complejo, deporte, cancha, or fecha changes
  useEffect(() => {
    if (!complejoSel || !fechaRaw) { setHoraOpts([]); return; }
    let q = supabase.from("partidos").select("hora").ilike("complejo", complejoSel).eq("fecha", fechaRaw);
    if (deporteSel) q = q.eq("deporte", deporteSel);
    if (canchaSel)  q = q.eq("numero_cancha", parseInt(canchaSel));
    q.then(({ data }) => {
      if (!data) return;
      const unique = [...new Set(data.map((r) => r.hora as string))].sort();
      setHoraOpts(unique);
    });
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
  const hayFiltros = !!(complejo || deporteSel || canchaSel || fechaRaw || hora);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canBuscar) return;
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
    router.push(`/?${params.toString()}#buscador`);
  }

  function handleLimpiar() {
    setComplejo(""); setComplejoSel("");
    setDeporteSel(""); setCanchaSel("");
    setFechaRaw(""); setFechaDisplay(""); setHora("");
    try { sessionStorage.removeItem("lacar_filters"); } catch {}
    router.push("/#buscador");
  }

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
    <form onSubmit={handleSubmit} className="bg-lake-800/50 border border-lake-700/60 rounded-2xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* Complejo — texto libre */}
        <ComboField
          id="complejo"
          label="Complejo"
          placeholder="Busca tu complejo..."
          value={complejo}
          onChange={handleComplejoChange}
          options={complejoOpts}
          onSelect={handleSelectComplejo}
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
          isOpen={openField === "hora"}
          onOpen={() => setOpenField("hora")}
          onClose={() => setOpenField(null)}
        />
      </div>

      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <button
          type="submit"
          disabled={!canBuscar}
          className={`inline-flex items-center gap-2 font-semibold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 ${
            canBuscar
              ? "bg-crystal-400 hover:bg-crystal-300 text-lake-950 active:scale-[0.98] shadow-[0_0_20px_rgba(41,196,173,0.28)]"
              : "bg-lake-700/60 text-mist-600 cursor-not-allowed"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Buscar partidos
        </button>

        {missingHint && (
          <span className="text-xs text-mist-700">{missingHint}</span>
        )}

        {hayFiltros && (
          <button
            type="button"
            onClick={handleLimpiar}
            className="ml-auto text-mist-600 hover:text-snow text-sm font-medium px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
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
    <Suspense fallback={<div className="h-36 bg-lake-800/50 rounded-2xl border border-lake-700/60 animate-pulse" />}>
      <Filters />
    </Suspense>
  );
}

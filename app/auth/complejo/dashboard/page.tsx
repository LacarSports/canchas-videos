"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { processClip } from "../../../partido/[id]/processClip";
import InlineClipPlayer from "../../../components/InlineClipPlayer";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TYPES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TabId = "inicio" | "ocupacion" | "camaras" | "reportes" | "videos" | "streaming";

interface Partido {
  id: string;
  complejo: string;
  numero_cancha: number;
  ciudad: string;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  archivo_url: string;
}

interface Jugada {
  id: string;
  partido_id: string;
  etiqueta: string;
  inicio_seg: number;
  fin_seg: number;
  duracion: number;
  creado_en: string;
  partidos: {
    complejo: string;
    numero_cancha: number;
    fecha: string;
    hora: string;
    archivo_url?: string;
    deporte?: string;
  } | null;
}

interface CameraState {
  id?: string;
  estado: "publico" | "privado" | "bloqueado";
}

interface HorarioRegla {
  id: string;
  complejo: string;
  numero_cancha: number;
  dia_semana: number | null;
  fecha_especifica: string | null;
  hora_inicio: string;
  hora_fin: string;
  grabar: boolean;
}

interface PartidoPriv {
  id: string;
  numero_cancha: number;
  fecha: string;
  hora: string;
  duracion_minutos: number;
  privado: boolean;
  password_hash: string | null;
}

interface Heartbeat {
  cancha: string;
  complejo: string | null;
  ultimo_heartbeat: string | null;
  estado: string | null;
  ip_local: string | null;
  detalle: string | null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtSeg(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getMonthRange(year: number, month: number) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${lastDay}`,
  };
}

const TAG_STYLES: Record<string, string> = {
  Gol:             "bg-crystal-400/15 text-crystal-300 border-crystal-400/25",
  Atajada:         "bg-glacial-400/15 text-glacial-300 border-glacial-400/25",
  Caño:            "bg-pine-400/15 text-pine-400 border-pine-400/25",
  "Buena jugada":  "bg-mist-500/12 text-mist-400 border-mist-500/22",
  Blooper:         "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Otro:            "bg-lake-600/30 text-mist-600 border-mist-700/25",
  Smash:           "bg-crystal-400/15 text-crystal-300 border-crystal-400/25",
  "Finta (amago)": "bg-pine-400/15 text-pine-400 border-pine-400/25",
  "Buen Punto":    "bg-mist-500/12 text-mist-400 border-mist-500/22",
};

const ETIQUETAS = ["Gol", "Caño", "Buena jugada", "Atajada", "Blooper", "Otro"];

const ETIQUETAS_BY_DEPORTE: Record<string, string[]> = {
  futbol: ["Gol", "Caño", "Buena jugada", "Atajada", "Blooper", "Otro"],
  padel:  ["Smash", "Finta (amago)", "Buen Punto", "Blooper", "Otro"],
};

const HORA_SLOTS = Array.from({ length: 17 }, (_, i) =>
  `${(i + 7).toString().padStart(2, "0")}:00`
);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SIDEBAR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "ocupacion",
    label: "Ocupación",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "camaras",
    label: "Cámaras",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "videos",
    label: "Videos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
      </svg>
    ),
  },
  {
    id: "streaming",
    label: "Streaming",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  },
];

function Sidebar({
  activeTab,
  onTabChange,
  onLogout,
  complejo,
  open,
  onClose,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onLogout: () => void;
  complejo?: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-60 bg-lake-900 border-r border-mist-500/8 flex flex-col z-40 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Subtle top glow */}
        <div
          className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(41,196,173,0.12), transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative px-5 py-5 border-b border-mist-500/8">
          <a href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Lacar Sports"
              width={28}
              height={28}
              className="drop-shadow-[0_0_8px_rgba(41,196,173,0.45)]"
            />
            <span className="text-sm font-bold text-snow tracking-tight">
              Lacar <span className="text-crystal-400">Sports</span>
            </span>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === item.id
                  ? "bg-crystal-400/12 text-crystal-300 border border-crystal-400/20"
                  : "text-mist-600 hover:text-snow hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className={activeTab === item.id ? "text-crystal-400" : "text-mist-700"}>
                {item.icon}
              </span>
              {item.label}
              {item.id === "streaming" && (
                <span className="ml-auto text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                  LIVE
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-mist-500/8 space-y-1">
          {complejo && (
            <div className="px-3 py-2 mb-1">
              <p className="text-[10px] text-mist-700 uppercase tracking-wider mb-0.5">Complejo</p>
              <p className="text-xs text-mist-400 font-medium truncate">{complejo}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-mist-700 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: INICIO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface CameraInfo {
  numero_cancha: number;
  deporte: string;
  estado: "publico" | "privado" | "bloqueado";
}

function TabInicio({ user, complejo }: { user: User | null; complejo?: string }) {
  const [stats, setStats] = useState({ partidos: 0, jugadas: 0, minutos: 0 });
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const { start, end } = getMonthRange(now.getFullYear(), now.getMonth() + 1);

    async function load() {
      let qP = supabase
        .from("partidos")
        .select("id, duracion_minutos", { count: "exact" })
        .gte("fecha", start)
        .lte("fecha", end);
      if (complejo) qP = qP.ilike("complejo", `%${complejo}%`);

      const { data: ps, count: pCount } = await qP;
      const minutos = (ps ?? []).reduce(
        (s: number, p: { duracion_minutos: number }) => s + (p.duracion_minutos ?? 0),
        0
      );

      let qJ = supabase
        .from("jugadas")
        .select("id", { count: "exact" })
        .gte("creado_en", start + "T00:00:00");

      const { count: jCount } = await qJ;

      // Cámaras: deporte más reciente por cancha + estado
      let qCanchas = supabase
        .from("partidos")
        .select("numero_cancha, deporte")
        .order("fecha", { ascending: false });
      if (complejo) qCanchas = qCanchas.ilike("complejo", `%${complejo}%`);
      const { data: canchaData } = await qCanchas;

      // Deporte más reciente por cancha (primera aparición en orden desc)
      const deporteMap: Record<number, string> = {};
      for (const row of (canchaData ?? []) as { numero_cancha: number; deporte: string }[]) {
        if (!(row.numero_cancha in deporteMap)) {
          deporteMap[row.numero_cancha] = row.deporte ?? "â€”";
        }
      }

      const { data: csData } = await supabase
        .from("camera_settings")
        .select("numero_cancha, estado")
        .eq("complejo", complejo ?? "");

      const estadoMap: Record<number, "publico" | "privado" | "bloqueado"> = {};
      for (const c of (csData ?? []) as { numero_cancha: number; estado: string }[]) {
        estadoMap[c.numero_cancha] = c.estado as "publico" | "privado" | "bloqueado";
      }

      const cams: CameraInfo[] = Object.entries(deporteMap).map(([cancha, deporte]) => ({
        numero_cancha: Number(cancha),
        deporte,
        estado: estadoMap[Number(cancha)] ?? "publico",
      })).sort((a, b) => a.numero_cancha - b.numero_cancha);

      setStats({ partidos: pCount ?? 0, jugadas: jCount ?? 0, minutos });
      setCameras(cams);
      setLoading(false);
    }
    load();
  }, [complejo]);

  const nombre =
    (user?.user_metadata?.nombre as string) ??
    user?.email?.split("@")[0] ??
    "Administrador";

  const statCards = [
    {
      label: "Partidos este mes",
      value: stats.partidos,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      accent: "text-crystal-400",
      bg: "bg-crystal-400/10 border-crystal-400/20",
    },
    {
      label: "Jugadas guardadas",
      value: stats.jugadas,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      accent: "text-mist-400",
      bg: "bg-mist-500/10 border-mist-500/20",
    },
    {
      label: "Minutos grabados",
      value: stats.minutos,
      suffix: " min",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      accent: "text-glacial-400",
      bg: "bg-glacial-400/10 border-glacial-400/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-snow tracking-tight">Bienvenido, {nombre}</h2>
        <p className="text-mist-600 text-sm mt-1">
          {new Date().toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 backdrop-blur-sm">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${s.bg} ${s.accent}`}>
              {s.icon}
            </div>
            <div className={`text-2xl font-bold ${s.accent}`}>
              {loading ? (
                <span className="inline-block w-10 h-6 bg-white/5 rounded animate-pulse" />
              ) : (
                <>{s.value}{"suffix" in s ? s.suffix : ""}</>
              )}
            </div>
            <div className="text-xs text-mist-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-snow mb-4">Estado de cámaras</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cameras.length === 0 ? (
          <p className="text-mist-600 text-sm text-center py-6">No se encontraron cámaras registradas</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cameras.map((cam) => {
              const opt = CAMERA_OPTIONS.find((o) => o.value === cam.estado) ?? CAMERA_OPTIONS[0];
              const isActive = cam.estado !== "bloqueado";
              return (
                <div
                  key={cam.numero_cancha}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-lake-900/50 border-mist-500/12"
                      : "bg-lake-950/40 border-mist-500/6 opacity-50"
                  }`}
                >
                  {/* Indicador */}
                  <div className={`shrink-0 w-2 h-2 rounded-full ${
                    cam.estado === "publico"   ? "bg-crystal-400 shadow-[0_0_6px_rgba(41,196,173,0.7)]" :
                    cam.estado === "privado"   ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" :
                                                "bg-mist-700"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-snow leading-tight">Cancha {cam.numero_cancha}</p>
                    <p className="text-xs text-mist-600 truncate mt-0.5">{cam.deporte}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${opt.color}`}>
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: OCUPACIÃ“N
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabOcupacion({ complejo }: { complejo?: string }) {
  const today = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(today);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [canchas, setCanchas] = useState<number[]>([1, 2, 3]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from("partidos").select("*").eq("fecha", fecha).order("hora");
    if (complejo) q = q.ilike("complejo", `%${complejo}%`);
    q.then(({ data }) => {
      const ps = (data ?? []) as Partido[];
      setPartidos(ps);
      const nums = Array.from(new Set(ps.map((p) => p.numero_cancha))).sort((a, b) => a - b) as number[];
      setCanchas(nums.length > 0 ? nums : [1, 2, 3]);
      setLoading(false);
    });
  }, [fecha, complejo]);

  function getPartido(cancha: number, hora: string) {
    return partidos.find((p) => p.numero_cancha === cancha && p.hora.substring(0, 5) === hora);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-snow tracking-tight">Ocupación de Canchas</h2>
          <p className="text-sm text-mist-600 mt-0.5">Horarios grabados por cancha y día</p>
        </div>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="bg-lake-800/60 border border-crystal-400/20 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-4 py-2 outline-none transition-all"
        />
      </div>

      <div className="flex items-center gap-5 text-xs text-mist-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-crystal-400/25 border border-crystal-400/35 inline-block" />
          Grabado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white/5 border border-white/10 inline-block" />
          Libre
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-mist-500/8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="bg-lake-900 text-mist-700 text-xs font-medium text-left px-4 py-2.5 sticky left-0 z-10 min-w-[100px] border-b border-mist-500/8">
                  Cancha
                </th>
                {HORA_SLOTS.map((h) => (
                  <th key={h} className="bg-lake-900 text-mist-700 text-xs font-medium text-center px-1 py-2.5 border-b border-mist-500/8 min-w-[52px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canchas.map((c, ri) => (
                <tr key={c}>
                  <td className={`bg-lake-800/60 text-mist-400 text-xs font-semibold px-4 py-3 sticky left-0 z-10 ${ri < canchas.length - 1 ? "border-b border-mist-500/8" : ""}`}>
                    Cancha {c}
                  </td>
                  {HORA_SLOTS.map((h) => {
                    const p = getPartido(c, h);
                    return (
                      <td
                        key={h}
                        title={p ? `${p.complejo} Â· ${p.duracion_minutos} min` : undefined}
                        className={`text-center text-xs py-3 transition-colors ${
                          ri < canchas.length - 1 ? "border-b border-mist-500/8" : ""
                        } ${
                          p
                            ? "bg-crystal-400/18 text-crystal-400"
                            : "bg-lake-950 text-mist-700"
                        }`}
                      >
                        {p ? (
                          <svg className="w-3 h-3 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        ) : "â€”"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && partidos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Partidos grabados", value: partidos.length },
            { label: "Canchas activas", value: canchas.length },
            { label: "Minutos grabados", value: partidos.reduce((s, p) => s + p.duracion_minutos, 0) + " min" },
            { label: "Horas totales", value: Math.round((partidos.reduce((s, p) => s + p.duracion_minutos, 0) / 60) * 10) / 10 + "h" },
          ].map((s) => (
            <div key={s.label} className="bg-lake-800/60 border border-mist-500/8 rounded-xl p-4">
              <div className="text-xl font-bold text-crystal-400">{s.value}</div>
              <div className="text-xs text-mist-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && partidos.length === 0 && (
        <div className="text-center py-12 text-mist-600 text-sm">
          No hay partidos grabados en esta fecha
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: CÃMARAS â€” sub-componentes
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DIAS_SEMANA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const DIAS_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function CamarasHorarios({ canchas, complejo }: { canchas: number[]; complejo?: string }) {
  const today = new Date().toISOString().split("T")[0];
  const [cancha, setCancha] = useState<number>(canchas[0] ?? 1);
  const [mode, setMode] = useState<"semana" | "fecha">("semana");
  const [dia, setDia] = useState(1); // 0=domingo..6=sábado
  const [fecha, setFecha] = useState(today);
  const [reglas, setReglas] = useState<HorarioRegla[]>([]);
  const [loadingReglas, setLoadingReglas] = useState(false);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [grabar, setGrabar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableError, setTableError] = useState(false);

  useEffect(() => {
    if (canchas.length > 0 && !canchas.includes(cancha)) setCancha(canchas[0]);
  }, [canchas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setLoadingReglas(true);
      let q = supabase
        .from("horarios_grabacion")
        .select("*")
        .eq("complejo", complejo ?? "")
        .eq("numero_cancha", cancha)
        .order("hora_inicio");

      if (mode === "semana") {
        q = q.eq("dia_semana", dia).is("fecha_especifica", null);
      } else {
        q = q.eq("fecha_especifica", fecha).is("dia_semana", null);
      }

      const { data, error } = await q;
      if (error) {
        if (error.code === "42P01") setTableError(true);
      } else {
        setTableError(false);
        setReglas((data ?? []) as HorarioRegla[]);
      }
      setLoadingReglas(false);
    }
    load();
  }, [cancha, mode, dia, fecha, complejo]);

  async function addRegla() {
    if (!horaInicio || !horaFin || horaFin <= horaInicio) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      complejo: complejo ?? "",
      numero_cancha: cancha,
      hora_inicio: horaInicio + ":00",
      hora_fin: horaFin + ":00",
      grabar,
    };
    if (mode === "semana") {
      payload.dia_semana = dia;
    } else {
      payload.fecha_especifica = fecha;
    }
    const { data, error } = await supabase
      .from("horarios_grabacion")
      .insert(payload)
      .select()
      .single();
    if (!error && data) {
      setReglas((r) => [...r, data as HorarioRegla].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
    }
    setSaving(false);
  }

  async function deleteRegla(id: string) {
    await supabase.from("horarios_grabacion").delete().eq("id", id);
    setReglas((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      {tableError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-300 mb-1">Tabla horarios_grabacion no encontrada</p>
          <p className="text-xs text-amber-400/70 mb-2">Ejecuta este SQL en Supabase:</p>
          <pre className="bg-black/30 rounded-lg p-3 text-xs text-amber-200/80 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE horarios_grabacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complejo text NOT NULL,
  numero_cancha integer NOT NULL,
  dia_semana integer NULL,
  fecha_especifica date NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  grabar boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE horarios_grabacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON horarios_grabacion FOR ALL USING (true);`}</pre>
        </div>
      )}

      {/* Cancha selector */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-mist-600">Cancha:</label>
        <div className="flex gap-1">
          {canchas.map((c) => (
            <button
              key={c}
              onClick={() => setCancha(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                cancha === c
                  ? "bg-crystal-400/15 text-crystal-300 border-crystal-400/25"
                  : "border-white/8 text-mist-600 hover:text-snow hover:border-white/15"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-lake-900/60 border border-mist-500/8 rounded-xl p-1 w-fit">
        {(["semana", "fecha"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === m
                ? "bg-crystal-400/12 text-crystal-300 border border-crystal-400/20"
                : "text-mist-600 hover:text-snow"
            }`}
          >
            {m === "semana" ? "Por día de semana" : "Fecha específica"}
          </button>
        ))}
      </div>

      {/* Day selector (semana) or date picker (fecha) */}
      {mode === "semana" ? (
        <div className="flex gap-1 flex-wrap">
          {DIAS_SEMANA.map((d, i) => (
            <button
              key={i}
              onClick={() => setDia(i)}
              className={`w-10 h-10 rounded-xl text-xs font-semibold border transition-all ${
                dia === i
                  ? "bg-crystal-400/15 text-crystal-300 border-crystal-400/25"
                  : "border-white/8 text-mist-600 hover:text-snow hover:border-white/15"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="bg-lake-800/60 border border-crystal-400/20 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-4 py-2 outline-none transition-all"
        />
      )}

      {/* Existing rules */}
      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-mist-400 uppercase tracking-wider">
          Reglas para {mode === "semana" ? DIAS_LABELS[dia] : fecha} â€” Cancha {cancha}
        </h4>
        {loadingReglas ? (
          <div className="flex justify-center py-4">
            <div className="w-4 h-4 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reglas.length === 0 ? (
          <p className="text-xs text-mist-700 py-2">Sin reglas configuradas â€” se graba por defecto</p>
        ) : (
          <div className="space-y-1.5">
            {reglas.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-lake-900/60 rounded-xl px-3 py-2.5">
                <span className="text-xs font-mono text-mist-400 w-28 shrink-0">
                  {r.hora_inicio.slice(0, 5)} â€“ {r.hora_fin.slice(0, 5)}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  r.grabar
                    ? "bg-crystal-400/10 text-crystal-300 border-crystal-400/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {r.grabar ? "Graba" : "No graba"}
                </span>
                <button
                  onClick={() => deleteRegla(r.id)}
                  className="ml-auto text-mist-700 hover:text-red-400 transition-colors"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add rule form */}
      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-mist-400 uppercase tracking-wider">Agregar regla</h4>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-mist-600 mb-1">Desde</label>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-mist-600 mb-1">Hasta</label>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <button
              onClick={() => setGrabar(!grabar)}
              className={`relative w-10 h-5 rounded-full border transition-all ${
                grabar
                  ? "bg-crystal-400/30 border-crystal-400/40"
                  : "bg-lake-950 border-mist-700"
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                grabar ? "left-5 bg-crystal-400" : "left-0.5 bg-mist-700"
              }`} />
            </button>
            <span className="text-xs text-mist-500">{grabar ? "Graba" : "No graba"}</span>
          </div>
          <button
            onClick={addRegla}
            disabled={saving || tableError || !horaInicio || !horaFin || horaFin <= horaInicio}
            className="px-4 py-2 rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 text-lake-950 text-xs font-semibold transition-all active:scale-[0.98] flex items-center gap-1.5"
          >
            {saving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Agregar
          </button>
        </div>
        {horaFin && horaInicio && horaFin <= horaInicio && (
          <p className="text-xs text-red-400">La hora de fin debe ser mayor a la de inicio</p>
        )}
      </div>
    </div>
  );
}

function CamarasPrivacidad({ canchas, complejo }: { canchas: number[]; complejo?: string }) {
  const today = new Date().toISOString().split("T")[0];
  const [cancha, setCancha] = useState<number>(canchas[0] ?? 1);
  const [fecha, setFecha] = useState(today);
  const [partidos, setPartidos] = useState<PartidoPriv[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [columnError, setColumnError] = useState(false);

  useEffect(() => {
    if (canchas.length > 0 && !canchas.includes(cancha)) setCancha(canchas[0]);
  }, [canchas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("partidos")
        .select("id, numero_cancha, fecha, hora, duracion_minutos, privado, password_hash")
        .ilike("complejo", `%${complejo ?? ""}%`)
        .eq("numero_cancha", cancha)
        .eq("fecha", fecha)
        .order("hora");
      if (error) {
        if (error.message.includes("column") && error.message.includes("privado")) {
          setColumnError(true);
        }
      } else {
        setColumnError(false);
        setPartidos((data ?? []) as PartidoPriv[]);
      }
      setLoading(false);
    }
    load();
  }, [cancha, fecha, complejo]);

  function togglePrivado(id: string, current: boolean) {
    setPartidos((ps) => ps.map((p) => p.id === id ? { ...p, privado: !current } : p));
    if (!current) {
      setPasswords((pw) => ({ ...pw, [id]: pw[id] ?? "" }));
    }
  }

  async function savePartido(p: PartidoPriv) {
    setSaving((s) => ({ ...s, [p.id]: true }));
    await fetch("/api/video-privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partidoId: p.id, privado: p.privado, password: passwords[p.id] ?? "" }),
    });
    setSaving((s) => ({ ...s, [p.id]: false }));
    setSaved((s) => ({ ...s, [p.id]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [p.id]: false })), 2000);
  }

  return (
    <div className="space-y-4">
      {columnError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-300 mb-1">Columnas de privacidad no encontradas</p>
          <p className="text-xs text-amber-400/70 mb-2">Ejecuta este SQL en Supabase:</p>
          <pre className="bg-black/30 rounded-lg p-3 text-xs text-amber-200/80 overflow-x-auto">{`ALTER TABLE partidos ADD COLUMN privado boolean DEFAULT false;
ALTER TABLE partidos ADD COLUMN password_hash text NULL;`}</pre>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-mist-600">Cancha:</label>
          <div className="flex gap-1">
            {canchas.map((c) => (
              <button
                key={c}
                onClick={() => setCancha(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  cancha === c
                    ? "bg-crystal-400/15 text-crystal-300 border-crystal-400/25"
                    : "border-white/8 text-mist-600 hover:text-snow hover:border-white/15"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="bg-lake-800/60 border border-crystal-400/20 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-4 py-2 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : partidos.length === 0 ? (
        <div className="text-center py-10 text-mist-600 text-sm">
          No hay partidos grabados en esta fecha
        </div>
      ) : (
        <div className="space-y-2">
          {partidos.map((p) => (
            <div key={p.id} className="bg-lake-800/60 border border-mist-500/8 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-snow">{p.hora.slice(0, 5)}</span>
                  <span className="text-xs text-mist-600 ml-2">{p.duracion_minutos} min</span>
                </div>
                {/* Toggle privado */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePrivado(p.id, p.privado)}
                    className={`relative w-10 h-5 rounded-full border transition-all ${
                      p.privado
                        ? "bg-amber-500/30 border-amber-500/40"
                        : "bg-lake-950 border-mist-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      p.privado ? "left-5 bg-amber-400" : "left-0.5 bg-mist-700"
                    }`} />
                  </button>
                  <span className={`text-xs font-medium ${p.privado ? "text-amber-400" : "text-mist-600"}`}>
                    {p.privado ? "Privado" : "Público"}
                  </span>
                </div>
              </div>

              {/* Password field if private */}
              {p.privado && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={p.password_hash ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña de acceso"}
                    value={passwords[p.id] ?? ""}
                    onChange={(e) => setPasswords((pw) => ({ ...pw, [p.id]: e.target.value }))}
                    className="flex-1 bg-lake-950/60 border border-lake-700 focus:border-amber-500/40 text-snow placeholder-mist-700 rounded-xl px-3 py-2 text-xs outline-none transition-all"
                  />
                </div>
              )}

              <button
                onClick={() => savePartido(p)}
                disabled={saving[p.id]}
                className="w-full py-1.5 text-xs font-semibold rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 text-lake-950 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                {saving[p.id] ? (
                  <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Guardando...</>
                ) : saved[p.id] ? (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Guardado</>
                ) : "Guardar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MONITOREO DE CANCHAS (sub-tab de Cámaras)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CamarasMonitoreo({ canchas, complejo }: { canchas: number[]; complejo?: string }) {
  const [beats, setBeats] = useState<Heartbeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function load() {
    const { data, error } = await supabase.from("heartbeat").select("*");

    if (error) {
      if (error.code === "42P01") setTableError(true);
      setLoading(false);
      return;
    }

    setTableError(false);
    console.log("[heartbeat] raw data from Supabase:", JSON.stringify(data, null, 2));
    setBeats((data ?? []) as Heartbeat[]);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [complejo]); // eslint-disable-line react-hooks/exhaustive-deps

  function statusOf(beat: Heartbeat | null): "verde" | "amarillo" | "rojo" {
    if (!beat) { console.log("[heartbeat] statusOf: beat is null â†’ rojo"); return "rojo"; }
    if (!beat.ultimo_heartbeat) { console.log("[heartbeat] statusOf: ultimo_heartbeat is null â†’ amarillo"); return "amarillo"; }
    const ts = beat.ultimo_heartbeat;
    const utcTs = /Z$|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + "Z";
    const diffMs = Date.now() - new Date(utcTs).getTime();
    console.log(`[heartbeat] cancha=${beat.cancha} | ts="${ts}" | utcTs="${utcTs}" | Date.now()=${Date.now()} | parsed=${new Date(utcTs).getTime()} | diffMs=${diffMs}`);
    if (diffMs < 3_600_000)  return "verde";
    if (diffMs < 10_800_000) return "amarillo";
    return "rojo";
  }

  function fmtDateTime(iso: string | null) {
    if (!iso) return "â€”";
    const d = new Date(iso);
    return (
      d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }) +
      " " +
      d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    );
  }

  const DOT: Record<string, string> = {
    verde:    "bg-emerald-400 shadow-[0_0_7px_2px_rgba(52,211,153,0.45)]",
    amarillo: "bg-amber-400   shadow-[0_0_7px_2px_rgba(251,191,36,0.45)]",
    rojo:     "bg-red-500     shadow-[0_0_7px_2px_rgba(239,68,68,0.45)]",
  };
  const ICON_RING: Record<string, string> = {
    verde:    "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
    amarillo: "bg-amber-400/10  border-amber-400/20  text-amber-400",
    rojo:     "bg-red-500/10    border-red-500/20    text-red-400",
  };
  const STATUS_LABEL: Record<string, string> = {
    verde: "En línea", amarillo: "Sin reporte reciente", rojo: "Desconectado",
  };
  const STATUS_TEXT: Record<string, string> = {
    verde: "text-emerald-400", amarillo: "text-amber-400", rojo: "text-red-400",
  };

  // Normalize heartbeat keys: trim + lowercase for matching
  const beatMap: Record<string, Heartbeat> = {};
  for (const b of beats) beatMap[b.cancha.trim().toLowerCase()] = b;

  function findBeat(c: number): Heartbeat | null {
    // Try exact string, then padded, then just the number
    return beatMap[String(c)] ?? beatMap[String(c).toLowerCase()] ?? beatMap[`cancha${c}`] ?? beatMap[`cancha_${c}`] ?? null;
  }

  // All unique display keys: first the heartbeat rows, then partidos not covered
  const seen = new Set<string>();
  const displayItems: { key: string; beat: Heartbeat | null }[] = [];

  for (const b of beats) {
    const k = b.cancha;
    if (!seen.has(k)) { seen.add(k); displayItems.push({ key: k, beat: b }); }
  }
  for (const c of canchas) {
    const beat = findBeat(c);
    const k = String(c);
    if (!beat && !seen.has(k)) { seen.add(k); displayItems.push({ key: k, beat: null }); }
  }

  return (
    <div className="space-y-4">
      {tableError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-300 mb-1">Tabla heartbeat no encontrada</p>
          <p className="text-xs text-amber-400/70 mb-2">Asegúrate de que la tabla exista en Supabase con RLS habilitado y política de acceso.</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-mist-600">
          Actualizado: {lastRefresh.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} Â· refresco cada 5 min
        </p>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-1.5 text-xs text-mist-500 hover:text-crystal-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar ahora
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tableError ? null : displayItems.length === 0 ? (
        <div className="text-center py-10 text-mist-600 text-sm">Sin cámaras registradas</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayItems.map(({ key, beat }) => {
            const st = statusOf(beat);
            return (
              <div key={key} className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-snow text-sm">Cancha {key}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[st]}`} />
                      <span className={`text-xs font-medium ${STATUS_TEXT[st]}`}>{STATUS_LABEL[st]}</span>
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${ICON_RING[st]}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs border-t border-mist-500/8 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mist-600 shrink-0">Último reporte</span>
                    <span className="text-mist-400 font-mono text-right">{fmtDateTime(beat?.ultimo_heartbeat ?? null)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mist-600 shrink-0">Estado</span>
                    <span className="text-mist-400">{beat?.estado ?? "â€”"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mist-600 shrink-0">IP local</span>
                    <span className="text-mist-400 font-mono">{beat?.ip_local ?? "â€”"}</span>
                  </div>
                  {beat?.detalle && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-mist-600 shrink-0">Detalle</span>
                      <span className="text-mist-400 text-right break-all">{beat.detalle}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: CÃMARAS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CAMERA_OPTIONS: { value: CameraState["estado"]; label: string; desc: string; color: string }[] = [
  { value: "publico",   label: "Público",   desc: "Cualquier usuario puede ver los videos",       color: "text-crystal-400 bg-crystal-400/10 border-crystal-400/30" },
  { value: "privado",   label: "Privado",   desc: "Solo el complejo puede acceder",               color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { value: "bloqueado", label: "Bloqueado", desc: "La cámara no graba ni muestra videos",         color: "text-red-400 bg-red-500/10 border-red-500/30" },
];

function TabCamaras({ complejo }: { complejo?: string }) {
  const [subTab, setSubTab] = useState<"config" | "horarios" | "privacidad" | "monitoreo">("config");
  const [canchas, setCanchas] = useState<number[]>([]);
  const [settings, setSettings] = useState<Record<number, CameraState>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(false);

  useEffect(() => {
    async function load() {
      let qP = supabase.from("partidos").select("numero_cancha");
      if (complejo) qP = qP.ilike("complejo", `%${complejo}%`);
      const { data: pData } = await qP;
      const nums = Array.from(new Set((pData ?? []).map((p: { numero_cancha: number }) => p.numero_cancha))).sort((a, b) => (a as number) - (b as number)) as number[];
      const list = nums.length > 0 ? nums : [1, 2, 3];
      setCanchas(list);

      const { data: csData, error: csError } = await supabase.from("camera_settings").select("*").eq("complejo", complejo ?? "");

      if (csError) {
        setTableError(true);
        const def: Record<number, CameraState> = {};
        list.forEach((n) => { def[n] = { estado: "publico" }; });
        setSettings(def);
      } else {
        const map: Record<number, CameraState> = {};
        for (const n of list) {
          const existing = (csData ?? []).find((c: { numero_cancha: number; estado: string; id: string }) => c.numero_cancha === n);
          map[n] = existing ? { id: existing.id, estado: existing.estado } : { estado: "publico" };
        }
        setSettings(map);
      }
      setLoading(false);
    }
    load();
  }, [complejo]);

  async function saveCamera(cancha: number) {
    const setting = settings[cancha];
    if (!setting || tableError) return;
    setSaving((s) => ({ ...s, [cancha]: true }));
    if (setting.id) {
      await supabase.from("camera_settings").update({ estado: setting.estado }).eq("id", setting.id);
    } else {
      const { data } = await supabase.from("camera_settings").upsert({ complejo: complejo ?? "", numero_cancha: cancha, estado: setting.estado }).select("id").single();
      if (data?.id) setSettings((s) => ({ ...s, [cancha]: { ...s[cancha], id: data.id } }));
    }
    setSaving((s) => ({ ...s, [cancha]: false }));
    setSaved((s) => ({ ...s, [cancha]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [cancha]: false })), 2000);
  }

  const SUB_TABS = [
    { id: "config" as const, label: "Configuración" },
    { id: "horarios" as const, label: "Horarios" },
    { id: "privacidad" as const, label: "Privacidad" },
    { id: "monitoreo" as const, label: "Monitoreo" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-snow tracking-tight">Control de Cámaras</h2>
        <p className="text-sm text-mist-600 mt-0.5">Configura grabación, horarios y acceso por cancha</p>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-lake-900/60 border border-mist-500/8 rounded-xl p-1 w-fit">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === t.id
                ? "bg-crystal-400/12 text-crystal-300 border border-crystal-400/20"
                : "text-mist-600 hover:text-snow border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Config sub-tab */}
      {subTab === "config" && (
        <>
          {tableError && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-300 mb-1">Tabla camera_settings no encontrada</p>
              <p className="text-xs text-amber-400/70 mb-2">Ejecuta este SQL en Supabase para habilitarla:</p>
              <pre className="bg-black/30 rounded-lg p-3 text-xs text-amber-200/80 overflow-x-auto">{`CREATE TABLE camera_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complejo TEXT NOT NULL,
  numero_cancha INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'publico',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(complejo, numero_cancha)
);
ALTER TABLE camera_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON camera_settings FOR ALL USING (true);`}</pre>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {canchas.map((c) => {
                const setting = settings[c];
                const currentOpt = CAMERA_OPTIONS.find((o) => o.value === setting?.estado) ?? CAMERA_OPTIONS[0];
                return (
                  <div key={c} className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-snow text-sm">Cancha {c}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border mt-1 inline-block ${currentOpt.color}`}>
                          {currentOpt.label}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-crystal-400/10 border border-crystal-400/20 flex items-center justify-center text-crystal-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {CAMERA_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSettings((s) => ({ ...s, [c]: { ...s[c], estado: opt.value } }))}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm border transition-all text-left ${
                            setting?.estado === opt.value ? opt.color : "border-white/8 text-mist-500 hover:border-white/15 hover:text-mist-400"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 ${setting?.estado === opt.value ? "border-current bg-current" : "border-mist-700"}`} />
                          <div>
                            <div className="font-medium leading-tight">{opt.label}</div>
                            <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => saveCamera(c)}
                      disabled={saving[c] || tableError}
                      className="w-full py-2 text-xs font-semibold rounded-xl bg-crystal-400 hover:bg-crystal-300 disabled:opacity-40 text-lake-950 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      {saving[c] ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Guardando...
                        </>
                      ) : saved[c] ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Guardado
                        </>
                      ) : "Guardar cambios"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Horarios sub-tab */}
      {subTab === "horarios" && (
        loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CamarasHorarios canchas={canchas} complejo={complejo} />
        )
      )}

      {/* Privacidad sub-tab */}
      {subTab === "privacidad" && (
        loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CamarasPrivacidad canchas={canchas} complejo={complejo} />
        )
      )}

      {/* Monitoreo sub-tab */}
      {subTab === "monitoreo" && (
        loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <CamarasMonitoreo canchas={canchas} complejo={complejo} />
        )
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: REPORTES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function BarChart({ data, colorClass }: { data: { label: string; value: number }[]; colorClass: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-mist-500 w-28 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 bg-lake-950 rounded-full h-2 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-xs text-mist-500 w-8 text-right shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function TabReportes({ complejo }: { complejo?: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<{
    totalPartidos: number;
    totalMinutos: number;
    totalJugadas: number;
    jugadasPorEtiqueta: Record<string, number>;
    horasPorCancha: Record<number, number>;
    jugadasPorCancha: Record<number, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { start, end } = getMonthRange(year, month);
    async function load() {
      let qP = supabase.from("partidos").select("id, numero_cancha, duracion_minutos").gte("fecha", start).lte("fecha", end);
      if (complejo) qP = qP.ilike("complejo", `%${complejo}%`);
      const { data: ps } = await qP;
      const partidoIds = (ps ?? []).map((p: { id: string }) => p.id);
      let jugadas: Jugada[] = [];
      if (partidoIds.length > 0) {
        const { data: jd } = await supabase.from("jugadas").select("id, etiqueta, partido_id, partidos(numero_cancha)").in("partido_id", partidoIds);
        jugadas = (jd ?? []) as unknown as Jugada[];
      }
      const totalPartidos = (ps ?? []).length;
      const totalMinutos = (ps ?? []).reduce((s: number, p: { duracion_minutos: number }) => s + (p.duracion_minutos ?? 0), 0);
      const totalJugadas = jugadas.length;
      const jugadasPorEtiqueta: Record<string, number> = {};
      const jugadasPorCancha: Record<number, number> = {};
      for (const j of jugadas) {
        jugadasPorEtiqueta[j.etiqueta] = (jugadasPorEtiqueta[j.etiqueta] ?? 0) + 1;
        const nc = (j.partidos as { numero_cancha?: number } | null)?.numero_cancha;
        if (nc) jugadasPorCancha[nc] = (jugadasPorCancha[nc] ?? 0) + 1;
      }
      const horasPorCancha: Record<number, number> = {};
      for (const p of ps ?? []) {
        const { numero_cancha: nc, duracion_minutos: dm } = p as { numero_cancha: number; duracion_minutos: number };
        horasPorCancha[nc] = (horasPorCancha[nc] ?? 0) + (dm ?? 0);
      }
      setReport({ totalPartidos, totalMinutos, totalJugadas, jugadasPorEtiqueta, horasPorCancha, jugadasPorCancha });
      setLoading(false);
    }
    load();
  }, [year, month, complejo]);

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-snow tracking-tight">Reporte Mensual</h2>
          <p className="text-sm text-mist-600 mt-0.5">Estadísticas de actividad del complejo</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-lake-800/60 border border-crystal-400/20 text-snow text-sm rounded-xl px-3 py-2 outline-none">
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-lake-800/60 border border-crystal-400/20 text-snow text-sm rounded-xl px-3 py-2 outline-none">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        report && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Partidos grabados", value: report.totalPartidos,                                          color: "text-crystal-400" },
                { label: "Jugadas guardadas", value: report.totalJugadas,                                           color: "text-mist-400" },
                { label: "Minutos grabados",  value: report.totalMinutos + " min",                                  color: "text-glacial-400" },
                { label: "Horas grabadas",    value: Math.round((report.totalMinutos / 60) * 10) / 10 + " h",       color: "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="bg-lake-800/60 border border-mist-500/8 rounded-xl p-4 backdrop-blur-sm">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-mist-600 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-snow mb-4">Jugadas por etiqueta</h3>
                {Object.keys(report.jugadasPorEtiqueta).length === 0 ? (
                  <p className="text-mist-600 text-sm text-center py-4">Sin datos</p>
                ) : (
                  <BarChart colorClass="bg-crystal-400/50" data={ETIQUETAS.filter((e) => report.jugadasPorEtiqueta[e] > 0).map((e) => ({ label: e, value: report.jugadasPorEtiqueta[e] ?? 0 }))} />
                )}
              </div>

              <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-snow mb-4">Horas grabadas por cancha</h3>
                {Object.keys(report.horasPorCancha).length === 0 ? (
                  <p className="text-mist-600 text-sm text-center py-4">Sin datos</p>
                ) : (
                  <BarChart colorClass="bg-glacial-400/50" data={Object.entries(report.horasPorCancha).sort(([a], [b]) => Number(a) - Number(b)).map(([nc, min]) => ({ label: `Cancha ${nc}`, value: Math.round((min / 60) * 10) / 10 }))} />
                )}
              </div>

              <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 lg:col-span-2 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-snow mb-4">Jugadas compartidas por cancha</h3>
                {Object.keys(report.jugadasPorCancha).length === 0 ? (
                  <p className="text-mist-600 text-sm text-center py-4">Sin datos</p>
                ) : (
                  <BarChart colorClass="bg-mist-500/50" data={Object.entries(report.jugadasPorCancha).sort(([a], [b]) => Number(a) - Number(b)).map(([nc, count]) => ({ label: `Cancha ${nc}`, value: count }))} />
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: VIDEOS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabVideos({ complejo }: { complejo?: string }) {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();

  const [fechaInicio, setFechaInicio] = useState(sevenDaysAgo);
  const [fechaFin, setFechaFin] = useState(today);
  const [deporte, setDeporte] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [duracionMax, setDuracionMax] = useState("");

  const etiquetasDisponibles = deporte ? (ETIQUETAS_BY_DEPORTE[deporte] ?? ETIQUETAS) : ETIQUETAS;
  const [jugadas, setJugadas] = useState<Jugada[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  function buildVideoUrl(archivoUrl: string) {
    if (archivoUrl.startsWith("http")) return archivoUrl;
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""}/${archivoUrl}`;
  }

  async function runSearch(inicio: string, fin: string, dep: string, tag: string, durMax: string) {
    setLoading(true);
    setSearched(true);
    let q = supabase.from("jugadas").select("id, partido_id, etiqueta, inicio_seg, fin_seg, duracion, creado_en, partidos(complejo, numero_cancha, fecha, hora, archivo_url, deporte)").order("creado_en", { ascending: false }).limit(60);
    if (tag) q = q.eq("etiqueta", tag);
    if (durMax) q = q.lt("duracion", Number(durMax) + 1);
    const { data } = await q;
    let results = (data ?? []) as unknown as Jugada[];
    results = results.filter((j) => {
      const p = j.partidos;
      if (!p) return false;
      if (complejo && !p.complejo.toLowerCase().includes(complejo.toLowerCase())) return false;
      if (p.fecha < inicio || p.fecha > fin) return false;
      if (dep) {
        const d = (p.deporte ?? "").toLowerCase();
        if (dep === "padel" && !d.includes("padel") && !d.includes("pádel")) return false;
        if (dep === "futbol" && (d.includes("padel") || d.includes("pádel"))) return false;
      }
      return true;
    });
    setJugadas(results);
    setLoading(false);
  }

  // Carga automática al montar con la semana pasada
  useEffect(() => { runSearch(sevenDaysAgo, today, "", "", ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch(fechaInicio, fechaFin, deporte, etiqueta, duracionMax);
  }

  function getClipUrl(j: Jugada) { return `${window.location.origin}/jugada/${j.id}`; }
  function handleCopy(j: Jugada) { navigator.clipboard.writeText(getClipUrl(j)).catch(() => {}); setCopied(j.id); setTimeout(() => setCopied(null), 2000); }

  async function handleShare(j: Jugada) {
    const url = getClipUrl(j);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: `Jugada: ${j.etiqueta}`, text: `Mirá esta jugada (${j.etiqueta})`, url }); return; } catch { /* cancelled */ }
    }
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(j.id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDownload(j: Jugada) {
    if (downloadingId || !j.partidos?.archivo_url) return;
    setDownloadingId(j.id);
    setDownloadError(null);
    try {
      const url = await processClip({ videoUrl: buildVideoUrl(j.partidos.archivo_url), inicioSeg: j.inicio_seg, finSeg: j.fin_seg });
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_lacar_${j.etiqueta.replace(/\s+/g, "_")}_${Math.floor(j.inicio_seg)}s.mp4`;
      a.click();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Error al procesar");
    } finally { setDownloadingId(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-snow tracking-tight">Biblioteca de Videos</h2>
        <p className="text-sm text-mist-600 mt-0.5">Busca y comparte las mejores jugadas para promoción</p>
      </div>

      <form onSubmit={handleSearch} className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 backdrop-blur-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-mist-600 mb-1.5">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              min={sevenDaysAgo}
              max={today}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-mist-600 mb-1.5">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              min={sevenDaysAgo}
              max={today}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-mist-600 mb-1.5">Deporte</label>
            <select
              value={deporte}
              onChange={(e) => { setDeporte(e.target.value); setEtiqueta(""); }}
              className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all"
            >
              <option value="">Todos los deportes</option>
              <option value="futbol">Fútbol 7</option>
              <option value="padel">Pádel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-mist-600 mb-1.5">Jugada</label>
            <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none transition-all">
              <option value="">Todas</option>
              {etiquetasDisponibles.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-mist-600 mb-1.5">Duración máx. (seg)</label>
            <input type="number" placeholder="ej: 30" value={duracionMax} onChange={(e) => setDuracionMax(e.target.value)} className="w-full bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow text-sm rounded-xl px-3 py-2 outline-none placeholder-mist-700 transition-all" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="bg-crystal-400 hover:bg-crystal-300 disabled:opacity-50 text-lake-950 font-semibold px-6 py-2 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center gap-2">
          {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
          Buscar jugadas
        </button>
      </form>

      {downloadError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{downloadError}</p>
      )}

      {searched && (
        <div>
          <p className="text-xs text-mist-600 mb-3">{jugadas.length} resultado{jugadas.length !== 1 ? "s" : ""}</p>
          {jugadas.length === 0 ? (
            <div className="text-center py-12 text-mist-600 text-sm">No se encontraron jugadas con esos filtros</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {jugadas.map((j, idx) => {
                const isDownloading = downloadingId === j.id;
                const isCopied = copied === j.id;
                const isExpanded = playingId === j.id && !!j.partidos?.archivo_url;

                return (
                  <div key={j.id} className="bg-lake-800/70 border border-mist-500/8 rounded-xl overflow-hidden hover:border-crystal-400/20 transition-colors backdrop-blur-sm">
                    {/* Header — click to toggle player */}
                    <button
                      onClick={() => j.partidos?.archivo_url && setPlayingId(playingId === j.id ? null : j.id)}
                      disabled={!j.partidos?.archivo_url}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors disabled:cursor-default text-left"
                    >
                      <span className="text-mist-700 text-[10px] font-mono shrink-0">#{jugadas.length - idx}</span>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TAG_STYLES[j.etiqueta] ?? TAG_STYLES.Otro}`}>
                        {j.etiqueta}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-mist-400 font-medium truncate">{j.partidos?.complejo ?? "—"}</div>
                        <div className="text-[10px] text-mist-500 mt-0.5">
                          Cancha {j.partidos?.numero_cancha}{j.partidos?.deporte ? ` · ${j.partidos.deporte}` : ""}
                        </div>
                        <div className="text-[10px] text-mist-600 font-mono mt-0.5">
                          {j.partidos?.fecha ? new Date(j.partidos.fecha + "T00:00:00").toLocaleDateString("es-CL") : ""}
                          {j.partidos?.hora ? ` · ${j.partidos.hora}` : ""}
                        </div>
                        <div className="text-[10px] text-mist-500 font-mono">
                          {fmtSeg(j.inicio_seg)}{" → "}{fmtSeg(j.fin_seg)}{" · "}{fmtSeg(j.duracion)}
                        </div>
                      </div>
                      {j.partidos?.archivo_url && (
                        <svg
                          className={`w-3 h-3 text-mist-600 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {/* Expandable player */}
                    <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExpanded ? "max-h-[260px]" : "max-h-0"}`}>
                      {isExpanded && (
                        <InlineClipPlayer
                          videoUrl={buildVideoUrl(j.partidos!.archivo_url!)}
                          inicioSeg={j.inicio_seg}
                          finSeg={j.fin_seg}
                          duracion={j.duracion}
                          compact
                        />
                      )}
                    </div>

                    {/* Actions — always visible */}
                    <div className="px-3 pb-2.5 pt-1.5 space-y-1.5">
                      <button onClick={() => handleDownload(j)} disabled={!!downloadingId} className="w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg border border-white/8 text-mist-500 hover:text-crystal-300 hover:border-crystal-400/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                        {isDownloading ? (
                          <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Procesando...</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Descargar</>
                        )}
                      </button>
                      <button onClick={() => handleShare(j)} className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs border transition-all ${isCopied ? "border-crystal-400/40 text-crystal-400 bg-crystal-400/5" : "border-white/8 text-mist-500 hover:text-mist-400 hover:border-white/15"}`}>
                        {isCopied
                          ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copiado</>
                          : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>Compartir</>
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TAB: STREAMING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TabStreaming() {
  const [streamKey, setStreamKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("yt_stream_key") ?? "";
    return "";
  });
  const [saved, setSaved] = useState(false);

  function saveKey() { localStorage.setItem("yt_stream_key", streamKey); setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-snow tracking-tight">Streaming en YouTube</h2>
        <p className="text-sm text-mist-600 mt-0.5">Transmite en vivo desde las canchas a tu canal de YouTube</p>
      </div>

      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-snow">Cómo configurar el streaming</h3>
        <div className="space-y-3">
          {[
            { num: "01", title: "Habilita YouTube Live", desc: 'Ve a YouTube Studio â†’ "Ir en vivo" â†’ Configura un evento de transmisión' },
            { num: "02", title: "Copia tu clave de transmisión", desc: "En YouTube Studio encontrarás la Clave de Stream. Pégala abajo." },
            { num: "03", title: "Configura OBS Studio", desc: "En OBS: Configuración â†’ Emisión â†’ Servicio: YouTube. Ingresa la URL RTMP y tu clave." },
            { num: "04", title: "Inicia la transmisión", desc: 'Haz clic en "Iniciar transmisión" en OBS para ir en vivo.' },
          ].map((step) => (
            <div key={step.num} className="flex gap-4">
              <span className="text-xs font-bold text-crystal-400 shrink-0 mt-0.5">{step.num}</span>
              <div>
                <div className="text-sm font-medium text-mist-300">{step.title}</div>
                <div className="text-xs text-mist-600 mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-snow">URL del servidor RTMP</h3>
        <div className="flex items-center gap-3 bg-lake-950/60 border border-lake-700 rounded-xl px-4 py-3">
          <code className="text-sm text-crystal-300 flex-1 font-mono">{RTMP_URL}</code>
          <button onClick={() => navigator.clipboard.writeText(RTMP_URL).catch(() => {})} className="text-xs text-mist-600 hover:text-crystal-400 transition-colors shrink-0">
            Copiar
          </button>
        </div>
      </div>

      <div className="bg-lake-800/60 border border-mist-500/8 rounded-2xl p-5 space-y-3 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-snow">Clave de transmisión</h3>
        <p className="text-xs text-mist-600">Guardada localmente en este navegador. Nunca compartir públicamente.</p>
        <div className="flex gap-3">
          <input type="password" value={streamKey} onChange={(e) => setStreamKey(e.target.value)} placeholder="Pega tu clave de YouTube aquí" className="flex-1 bg-lake-950/60 border border-lake-700 focus:border-crystal-400/40 text-snow placeholder-mist-700 rounded-xl px-4 py-2.5 text-sm outline-none transition-all" />
          <button onClick={saveKey} className="px-4 py-2.5 rounded-xl bg-crystal-400 hover:bg-crystal-300 text-lake-950 text-sm font-semibold transition-all active:scale-[0.97] shrink-0">
            {saved ? "Guardado âœ“" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm transition-all">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
          Abrir YouTube Studio
        </a>
        <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-mist-400 px-4 py-2 rounded-xl text-sm transition-all">
          Descargar OBS Studio
        </a>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN DASHBOARD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/auth/complejo");
      else { setUser(session.user); setLoading(false); }
    });
  }, [router]);

  async function handleLogout() { await supabase.auth.signOut(); router.replace("/auth/complejo"); }

  const complejo = user?.user_metadata?.complejo as string | undefined;

  const TAB_TITLES: Record<TabId, string> = {
    inicio: "Inicio", ocupacion: "Ocupación", camaras: "Cámaras",
    reportes: "Reportes", videos: "Videos", streaming: "Streaming",
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-lake-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-mist-600 text-sm">Cargando panel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-lake-950 flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} complejo={complejo} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 lg:pl-60 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-lake-950/90 backdrop-blur-xl border-b border-mist-500/8 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <button className="lg:hidden w-8 h-8 flex items-center justify-center text-mist-500 hover:text-snow transition-colors" onClick={() => setSidebarOpen(true)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-mist-700 hidden sm:block">Panel</span>
            <span className="text-xs text-mist-700 hidden sm:block">/</span>
            <span className="text-sm font-semibold text-mist-400 truncate">
              {TAB_TITLES[activeTab]}{complejo ? ` â€” ${complejo}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-mist-600 hidden sm:block truncate max-w-[180px]">{user?.email}</span>
            <div className="w-7 h-7 rounded-full bg-crystal-400/15 border border-crystal-400/25 flex items-center justify-center text-crystal-300 text-xs font-bold uppercase">
              {user?.email?.[0] ?? "A"}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-8">
          {activeTab === "inicio"    && <TabInicio    user={user} complejo={complejo} />}
          {activeTab === "ocupacion" && <TabOcupacion complejo={complejo} />}
          {activeTab === "camaras"   && <TabCamaras   complejo={complejo} />}
          {activeTab === "reportes"  && <TabReportes  complejo={complejo} />}
          {activeTab === "videos"    && <TabVideos    complejo={complejo} />}
          {activeTab === "streaming" && <TabStreaming />}
        </div>
      </div>
    </div>
  );
}

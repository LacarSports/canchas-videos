/**
 * Se muestra apenas se toca un partido, mientras el servidor trae sus datos: el
 * usuario ve al tiro que la página está abriendo su partido.
 */
export default function CargandoPartido() {
  return (
    <main className="min-h-screen bg-lake-950">
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2240 60%, #091520 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-3 animate-pulse">
          <div className="h-4 w-32 rounded bg-white/5 mb-6" />
          <div className="h-3 w-16 rounded bg-crystal-400/20" />
          <div className="h-8 w-64 max-w-full rounded bg-white/10" />
          <div className="h-4 w-48 rounded bg-white/5" />
        </div>
      </div>
      {/* Aviso neutro (sin reproductor): después puede venir el video, la clave o el
          inicio de sesión, y no debe parecer que "cargaba el video y se devolvió" */}
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="w-7 h-7 border-2 border-crystal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-mist-500">Abriendo partido…</p>
      </div>
    </main>
  );
}

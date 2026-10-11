-- Jugadas: guardar cómo se creó cada clip (formato reel/completo, seguimiento del
-- zoom y movimiento, ajustes de imagen) para poder volver a generarlo igual.
-- Ejecutar en Supabase → SQL Editor. Es compatible con la versión anterior de la web
-- (la columna es opcional y la web funciona con o sin ella).

ALTER TABLE jugadas ADD COLUMN IF NOT EXISTS edicion jsonb;

COMMENT ON COLUMN jugadas.edicion IS
  'Cómo se creó el clip: {formato: "reel"|"completo", seguimiento: [{t,cx,cy,zoom}] | null, cx, velocidad, brillo, contraste}. t en segundos desde el inicio de la jugada; cx/cy centro 0–1 del cuadro original; zoom = alto original / alto visible.';

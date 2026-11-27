CREATE TABLE archivos_hallazgos (
  id SERIAL PRIMARY KEY,
  hallazgo_id INTEGER NOT NULL REFERENCES hallazgos(id) ON DELETE CASCADE,
  seguimiento_id INTEGER REFERENCES seguimientos_hallazgos(id) ON DELETE CASCADE,
  nombre_archivo VARCHAR(255) NOT NULL,
  archivo_url TEXT NOT NULL UNIQUE,
  tipo_mime VARCHAR(150) NOT NULL,
  tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX archivos_hallazgos_hallazgo_idx ON archivos_hallazgos(hallazgo_id);
CREATE INDEX archivos_hallazgos_seguimiento_idx ON archivos_hallazgos(seguimiento_id);

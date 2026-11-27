CREATE TABLE evidencias_acciones_correctivas (
  id SERIAL PRIMARY KEY,
  seguimiento_id INTEGER NOT NULL REFERENCES seguimientos_acciones_correctivas(id),
  nombre_archivo VARCHAR(255) NOT NULL,
  archivo_url TEXT NOT NULL UNIQUE,
  tipo_mime VARCHAR(150) NOT NULL,
  tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes > 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX evidencias_acciones_seguimiento_idx ON evidencias_acciones_correctivas(seguimiento_id);

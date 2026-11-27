CREATE TABLE IF NOT EXISTS macroprocesos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE procesos
    ADD COLUMN IF NOT EXISTS macroproceso_id INTEGER REFERENCES macroprocesos(id);

CREATE INDEX IF NOT EXISTS idx_procesos_macroproceso
    ON procesos(macroproceso_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_documento_nombre_normalizado
    ON tipos_documento(LOWER(nombre));

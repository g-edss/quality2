CREATE TABLE IF NOT EXISTS tipos_indicador (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE indicadores
    ADD COLUMN IF NOT EXISTS tipo_indicador_id INTEGER REFERENCES tipos_indicador(id);

CREATE INDEX IF NOT EXISTS idx_indicadores_tipo
    ON indicadores(tipo_indicador_id);

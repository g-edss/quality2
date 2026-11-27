CREATE TABLE IF NOT EXISTS documento_revisiones_programadas (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL
        REFERENCES documentos(id),
    version_documento_id INTEGER NOT NULL
        REFERENCES documento_versiones(id),
    revisado_por INTEGER NOT NULL
        REFERENCES usuarios(id),
    resultado VARCHAR(30) NOT NULL
        CHECK (
            resultado IN (
                'sin_cambios',
                'requiere_cambio'
            )
        ),
    comentario TEXT,
    proxima_revision_anterior DATE NOT NULL,
    proxima_revision_nueva DATE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documento_revisiones_documento
    ON documento_revisiones_programadas(documento_id);

CREATE INDEX IF NOT EXISTS idx_documento_revisiones_fecha
    ON documento_revisiones_programadas(creado_en);
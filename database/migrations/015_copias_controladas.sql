CREATE SEQUENCE IF NOT EXISTS copias_controladas_folio_seq;

CREATE TABLE IF NOT EXISTS copias_controladas (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(30) NOT NULL UNIQUE,
    documento_id INTEGER NOT NULL
        REFERENCES documentos(id),
    version_documento_id INTEGER NOT NULL
        REFERENCES documento_versiones(id),
    destinatario_nombre VARCHAR(200) NOT NULL,
    comentarios TEXT,
    fecha_vigencia DATE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'activa'
        CHECK (
            estado IN (
                'activa',
                'requiere_retiro',
                'retirada',
                'cancelada'
            )
        ),
    creada_por INTEGER NOT NULL
        REFERENCES usuarios(id),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retirada_por INTEGER
        REFERENCES usuarios(id),
    retirada_en TIMESTAMPTZ,
    motivo_retiro TEXT,
    archivo_pdf_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_copias_controladas_documento
    ON copias_controladas(documento_id);

CREATE INDEX IF NOT EXISTS idx_copias_controladas_version
    ON copias_controladas(version_documento_id);

CREATE INDEX IF NOT EXISTS idx_copias_controladas_estado
    ON copias_controladas(estado);

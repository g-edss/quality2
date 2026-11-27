CREATE TABLE solicitudes_copias_controladas (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL REFERENCES documentos(id),
    version_documento_id INTEGER NOT NULL REFERENCES documento_versiones(id),
    destinatario_nombre VARCHAR(200) NOT NULL,
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    solicitada_por INTEGER NOT NULL REFERENCES usuarios(id),
    solicitada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resuelta_por INTEGER REFERENCES usuarios(id),
    resuelta_en TIMESTAMPTZ,
    comentario_resolucion TEXT,
    copia_controlada_id INTEGER UNIQUE REFERENCES copias_controladas(id)
);

CREATE INDEX idx_solicitudes_copias_estado
    ON solicitudes_copias_controladas(estado, solicitada_en DESC);

CREATE INDEX idx_solicitudes_copias_solicitante
    ON solicitudes_copias_controladas(solicitada_por, solicitada_en DESC);

CREATE UNIQUE INDEX uq_solicitudes_copias_pendientes
    ON solicitudes_copias_controladas (
        documento_id, version_documento_id, solicitada_por,
        LOWER(destinatario_nombre)
    ) WHERE estado = 'pendiente';

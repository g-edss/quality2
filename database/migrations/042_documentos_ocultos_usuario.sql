CREATE TABLE IF NOT EXISTS usuario_documentos_ocultos (
    usuario_id    INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    documento_id  INTEGER     NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, documento_id)
);

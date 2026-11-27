ALTER TABLE documentos
    ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN justificacion TEXT,
    ADD COLUMN proteger_impresion BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN permite_descarga_original BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN revision_programada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN revision_cada_meses INTEGER,
    ADD COLUMN proxima_revision DATE;


ALTER TABLE documentos
    ADD CONSTRAINT documentos_revision_programada_check
    CHECK (
        (
            revision_programada = FALSE
            AND revision_cada_meses IS NULL
            AND proxima_revision IS NULL
        )
        OR
        (
            revision_programada = TRUE
            AND revision_cada_meses IS NOT NULL
            AND revision_cada_meses > 0
            AND proxima_revision IS NOT NULL
        )
    );

UPDATE documentos d
SET permite_descarga_original = TRUE
FROM tipos_documento td
WHERE td.id = d.tipo_documento_id
  AND (
      d.origen = 'externo'
      OR LOWER(td.nombre) = 'registro'
      OR UPPER(COALESCE(d.codigo, '')) LIKE 'REG-%'
  );


UPDATE documentos d
SET proteger_impresion = FALSE
FROM tipos_documento td
WHERE td.id = d.tipo_documento_id
  AND (
      LOWER(td.nombre) = 'registro'
      OR UPPER(COALESCE(d.codigo, '')) LIKE 'REG-%'
  );

CREATE TABLE documento_registro_config (
    documento_id INTEGER PRIMARY KEY
        REFERENCES documentos(id)
        ON DELETE CASCADE,

    donde_conserva VARCHAR(255) NOT NULL,
    quien_conserva VARCHAR(255) NOT NULL,
    frecuencia_uso VARCHAR(160) NOT NULL,
    almacenamiento_proteccion TEXT NOT NULL,
    tiempo_retencion VARCHAR(160) NOT NULL,
    disposicion_final TEXT NOT NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE normas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(80) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE documento_normas (
    documento_id INTEGER NOT NULL
        REFERENCES documentos(id)
        ON DELETE CASCADE,

    norma_id INTEGER NOT NULL
        REFERENCES normas(id),

    PRIMARY KEY (documento_id, norma_id)
);


CREATE INDEX idx_documento_normas_norma
    ON documento_normas(norma_id);

CREATE TABLE documentos_relacionados (
    id SERIAL PRIMARY KEY,

    documento_id INTEGER NOT NULL
        REFERENCES documentos(id)
        ON DELETE CASCADE,

    documento_relacionado_id INTEGER NOT NULL
        REFERENCES documentos(id)
        ON DELETE CASCADE,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT documentos_relacionados_distintos_check
        CHECK (documento_id <> documento_relacionado_id)
);


CREATE UNIQUE INDEX documentos_relacionados_unicos
    ON documentos_relacionados (
        LEAST(documento_id, documento_relacionado_id),
        GREATEST(documento_id, documento_relacionado_id)
    );


CREATE INDEX idx_documentos_relacionados_documento
    ON documentos_relacionados(documento_id);


CREATE INDEX idx_documentos_relacionados_relacionado
    ON documentos_relacionados(documento_relacionado_id);

ALTER TABLE registros
    ADD COLUMN documento_registro_id INTEGER
        REFERENCES documentos(id);


CREATE INDEX idx_registros_documento_registro
    ON registros(documento_registro_id);
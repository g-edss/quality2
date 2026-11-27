ALTER TABLE registros
    ADD COLUMN documento_version_id INTEGER
        REFERENCES documento_versiones(id);

CREATE INDEX idx_registros_documento_version
    ON registros(documento_version_id);
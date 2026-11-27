CREATE TABLE IF NOT EXISTS usuario_registro_permisos (
    usuario_id    INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    documento_id  INTEGER     NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    accion        VARCHAR(20) NOT NULL
                  CHECK (accion IN ('cargar', 'editar', 'descargar', 'eliminar')),
    permitido     BOOLEAN     NOT NULL,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, documento_id, accion)
);

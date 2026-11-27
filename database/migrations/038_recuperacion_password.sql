ALTER TABLE usuarios
ADD COLUMN sesion_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE recuperaciones_password (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ
);

CREATE INDEX idx_recuperaciones_password_usuario
ON recuperaciones_password (usuario_id, creado_en DESC);

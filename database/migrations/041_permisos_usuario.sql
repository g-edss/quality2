CREATE TABLE IF NOT EXISTS usuario_permisos (
    usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso     VARCHAR(60)  NOT NULL,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, permiso)
);

INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, p.permiso
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  JOIN (VALUES
    ('revisor',     'modulo.visorDocumental'),
    ('revisor',     'modulo.documentos'),
    ('revisor',     'modulo.almacenRegistros'),
    ('revisor',     'modulo.solicitudes'),
    ('revisor',     'modulo.auditorias'),
    ('revisor',     'modulo.accionesCorrectivas'),
    ('revisor',     'modulo.juntas'),
    ('revisor',     'modulo.indicadores'),
    ('aprobador',   'modulo.visorDocumental'),
    ('aprobador',   'modulo.documentos'),
    ('aprobador',   'modulo.almacenRegistros'),
    ('aprobador',   'modulo.solicitudes'),
    ('aprobador',   'modulo.auditorias'),
    ('aprobador',   'modulo.accionesCorrectivas'),
    ('aprobador',   'modulo.juntas'),
    ('aprobador',   'modulo.indicadores'),
    ('responsable', 'modulo.visorDocumental'),
    ('responsable', 'modulo.solicitudes'),
    ('responsable', 'modulo.almacenRegistros'),
    ('responsable', 'modulo.juntas'),
    ('responsable', 'modulo.indicadores'),
    ('visor',       'modulo.visorDocumental')
  ) AS p(rol, permiso) ON p.rol = r.clave
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT DISTINCT ver.usuario_id, plantilla.permiso
  FROM (VALUES
    ('visorDocumental', 'visorDocumental.descargarOriginal', 'todos'),
    ('visorDocumental', 'visorDocumental.solicitarCopia', 'todos'),
    ('documentos', 'documentos.crear', 'responsable'),
    ('documentos', 'documentos.confirmarRevision', 'responsable'),
    ('documentos', 'documentos.reportes', 'responsable'),
    ('documentos', 'documentos.reportes', 'revisor'),
    ('documentos', 'documentos.reportes', 'aprobador'),
    ('solicitudes', 'solicitudes.solicitarCambio', 'todos'),
    ('solicitudes', 'solicitudes.solicitarBaja', 'todos'),
    ('solicitudes', 'solicitudes.cancelar', 'todos'),
    ('solicitudes', 'solicitudes.reenviar', 'todos'),
    ('auditorias', 'auditorias.reportes', 'todos'),
    ('accionesCorrectivas', 'accionesCorrectivas.seguimiento', 'todos'),
    ('accionesCorrectivas', 'accionesCorrectivas.reportes', 'todos'),
    ('juntas', 'juntas.convocar', 'todos'),
    ('juntas', 'juntas.modificar', 'todos'),
    ('juntas', 'juntas.iniciar', 'todos'),
    ('juntas', 'juntas.minutas', 'todos'),
    ('juntas', 'juntas.compromisos', 'todos'),
    ('juntas', 'juntas.avances', 'todos'),
    ('juntas', 'juntas.revisarAvances', 'todos'),
    ('juntas', 'juntas.cerrar', 'todos'),
    ('indicadores', 'indicadores.capturarMediciones', 'todos'),
    ('indicadores', 'indicadores.editarMediciones', 'todos')
  ) AS plantilla(modulo, permiso, rol)
  JOIN usuario_permisos ver
    ON ver.permiso = 'modulo.' || plantilla.modulo
  JOIN usuarios u ON u.id = ver.usuario_id
  JOIN roles r ON r.id = u.rol_id
 WHERE plantilla.rol = 'todos' OR plantilla.rol = r.clave
ON CONFLICT DO NOTHING;
INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT DISTINCT ver.usuario_id, plantilla.permiso
  FROM (VALUES
    ('almacenRegistros', 'almacenRegistros.crearFormato', 'responsable')
  ) AS plantilla(modulo, permiso, rol)
  JOIN usuario_permisos ver
    ON ver.permiso = 'modulo.' || plantilla.modulo
  JOIN usuarios u ON u.id = ver.usuario_id
  JOIN roles r ON r.id = u.rol_id
 WHERE plantilla.rol = 'todos' OR plantilla.rol = r.clave
ON CONFLICT DO NOTHING;

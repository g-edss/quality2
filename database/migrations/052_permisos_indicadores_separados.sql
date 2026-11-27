INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT usuario_id, 'catalogo.indicadores'
FROM usuario_permisos
WHERE permiso = 'modulo.indicadores'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT usuario_id, 'indicadores.tiposIndicador'
FROM usuario_permisos
WHERE permiso = 'catalogo.indicadores'
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permisos (usuario_id, permiso)
SELECT usuario_id, 'indicadores.unidadesMedida'
FROM usuario_permisos
WHERE permiso = 'catalogo.indicadores'
ON CONFLICT DO NOTHING;

DELETE FROM usuario_permisos
WHERE permiso = 'modulo.indicadores';
INSERT INTO normas (codigo, nombre, activo)
VALUES
  ('ISO 14001:2015', 'Sistema de gestión ambiental', TRUE),
  ('ISO 45001:2018', 'Sistema de gestión de seguridad y salud en el trabajo', TRUE)
ON CONFLICT (codigo) DO NOTHING;
ALTER TABLE auditorias
  ADD COLUMN tipo_auditoria VARCHAR(10) NOT NULL DEFAULT 'interna'
  CHECK (tipo_auditoria IN ('interna', 'externa'));
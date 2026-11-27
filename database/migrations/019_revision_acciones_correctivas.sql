ALTER TABLE acciones_correctivas DROP CONSTRAINT acciones_correctivas_estado_check;
ALTER TABLE acciones_correctivas ADD CONSTRAINT acciones_correctivas_estado_check
  CHECK (estado IN ('propuesta', 'aceptada', 'rechazada', 'en_seguimiento', 'en_revision', 'cerrada'));
ALTER TABLE acciones_correctivas
  ADD COLUMN cerrado_en TIMESTAMPTZ,
  ADD COLUMN cerrado_por INTEGER REFERENCES usuarios(id);

ALTER TABLE seguimientos_acciones_correctivas DROP CONSTRAINT seguimientos_acciones_correctivas_estado_resultante_check;
ALTER TABLE seguimientos_acciones_correctivas ADD CONSTRAINT seguimientos_acciones_correctivas_estado_resultante_check
  CHECK (estado_resultante IN ('en_seguimiento', 'en_revision', 'cerrada'));
ALTER TABLE seguimientos_acciones_correctivas
  ADD COLUMN tipo_evento VARCHAR(20) NOT NULL DEFAULT 'avance'
    CHECK (tipo_evento IN ('avance', 'aceptacion', 'correcciones'));

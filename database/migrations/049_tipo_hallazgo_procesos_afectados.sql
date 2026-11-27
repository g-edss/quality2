ALTER TABLE acciones_correctivas
  ADD COLUMN tipo_hallazgo VARCHAR(40)
  CHECK (
    tipo_hallazgo IS NULL OR
    tipo_hallazgo IN (
      'No Conformidad mayor',
      'No Conformidad menor',
      'Oportunidad de Mejora',
      'Fortaleza'
    )
  ),
  ADD COLUMN afecta_otros_procesos BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE acciones_correctivas_procesos_afectados (
  accion_id INTEGER NOT NULL
    REFERENCES acciones_correctivas(id) ON DELETE CASCADE,
  proceso_id INTEGER NOT NULL
    REFERENCES procesos(id),
  PRIMARY KEY (accion_id, proceso_id)
);

CREATE INDEX acciones_correctivas_procesos_afectados_proceso_idx
  ON acciones_correctivas_procesos_afectados(proceso_id);
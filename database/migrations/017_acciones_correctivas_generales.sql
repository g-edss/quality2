ALTER TABLE acciones_correctivas ALTER COLUMN hallazgo_id DROP NOT NULL;

ALTER TABLE acciones_correctivas
  ADD COLUMN titulo VARCHAR(200),
  ADD COLUMN proceso_id INTEGER REFERENCES procesos(id),
  ADD COLUMN responsable_id INTEGER REFERENCES usuarios(id),
  ADD COLUMN creado_por INTEGER REFERENCES usuarios(id),
  ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'Correctiva' CHECK (tipo IN ('Correctiva', 'Preventiva')),
  ADD COLUMN prioridad VARCHAR(10) NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  ADD COLUMN origen TEXT NOT NULL DEFAULT '',
  ADD COLUMN fecha_ocurrencia DATE,
  ADD COLUMN fecha_compromiso DATE,
  ADD CONSTRAINT acciones_fechas_validas CHECK (fecha_compromiso IS NULL OR fecha_ocurrencia IS NULL OR fecha_compromiso >= fecha_ocurrencia);

CREATE INDEX acciones_correctivas_proceso_idx ON acciones_correctivas(proceso_id);

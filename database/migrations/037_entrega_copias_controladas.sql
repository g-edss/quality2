ALTER TABLE copias_controladas
DROP CONSTRAINT copias_controladas_estado_check;

ALTER TABLE copias_controladas
ADD CONSTRAINT copias_controladas_estado_check
CHECK (estado IN (
    'pendiente_entrega', 'activa', 'requiere_retiro', 'retirada', 'cancelada'
));

ALTER TABLE copias_controladas
ALTER COLUMN estado SET DEFAULT 'pendiente_entrega';

ALTER TABLE copias_controladas
ADD COLUMN entregada_por INTEGER REFERENCES usuarios(id),
ADD COLUMN entregada_en TIMESTAMPTZ,
ADD COLUMN recibida_por_nombre VARCHAR(200),
ADD COLUMN observaciones_entrega TEXT;

ALTER TABLE procesos
    ADD COLUMN IF NOT EXISTS codigo_area VARCHAR(8) NOT NULL DEFAULT 'SDS',
    ADD COLUMN IF NOT EXISTS codigo_proceso VARCHAR(8);

UPDATE procesos
SET codigo_proceso = 'P' || LPAD(id::text, 2, '0')
WHERE codigo_proceso IS NULL;

ALTER TABLE procesos
    ALTER COLUMN codigo_proceso SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS procesos_codigo_area_proceso_key
    ON procesos (codigo_area, codigo_proceso);

CREATE TABLE IF NOT EXISTS documento_codigo_secuencias (
    prefijo VARCHAR(8) NOT NULL,
    codigo_area VARCHAR(8) NOT NULL,
    codigo_proceso VARCHAR(8) NOT NULL,
    ultimo_numero INTEGER NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
    PRIMARY KEY (prefijo, codigo_area, codigo_proceso)
);

INSERT INTO documento_codigo_secuencias (
    prefijo,
    codigo_area,
    codigo_proceso,
    ultimo_numero
)
SELECT
    partes.capturas[1],
    partes.capturas[2],
    partes.capturas[4],
    MAX(partes.capturas[3]::INTEGER)
FROM documentos documento
CROSS JOIN LATERAL regexp_match(
    documento.codigo,
    '^([A-Z0-9]+)-([A-Z0-9]+)-([0-9]+)-([A-Z0-9]+)$'
) AS partes(capturas)
WHERE partes.capturas IS NOT NULL
GROUP BY partes.capturas[1], partes.capturas[2], partes.capturas[4]
ON CONFLICT (prefijo, codigo_area, codigo_proceso)
DO UPDATE SET ultimo_numero = GREATEST(
    documento_codigo_secuencias.ultimo_numero,
    EXCLUDED.ultimo_numero
);

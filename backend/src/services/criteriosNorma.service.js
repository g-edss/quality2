import { pool, query } from "../config/db.js";

function crearError(mensaje, status) {
    const error = new Error(mensaje);
    error.status = status;
    error.publico = mensaje;
    return error;
}

function validarId(valor, nombre) {
    const id = Number(valor);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw crearError(`${nombre} no es válido.`, 400);
    }

    return id;
}

function validarIdsCriterios(valores) {
    if (!Array.isArray(valores)) {
        throw crearError("La lista de criterios no es válida.", 400);
    }

    const ids = valores.map((valor) => validarId(valor, "El criterio"));
    return [...new Set(ids)];
}

export async function listarCriterios() {
    const { rows } = await query(
        `SELECT id, codigo, descripcion, activo, creado_en
     FROM criterios_norma
     ORDER BY codigo, id`,
    );

    return rows;
}

export async function crearCriterio({ codigo, descripcion }) {
    const { rows } = await query(
        `INSERT INTO criterios_norma (codigo, descripcion)
     VALUES ($1, $2)
     RETURNING id, codigo, descripcion, activo, creado_en`,
        [codigo, descripcion],
    );

    return rows[0];
}

export async function actualizarCriterio(
    criterioId,
    { codigo, descripcion, activo },
) {
    const id = validarId(criterioId, "El criterio");

    const { rows } = await query(
        `UPDATE criterios_norma
     SET codigo = $2, descripcion = $3, activo = $4
     WHERE id = $1
     RETURNING id, codigo, descripcion, activo, creado_en`,
        [id, codigo, descripcion, activo],
    );

    if (!rows[0]) throw crearError("El criterio no existe.", 404);

    return rows[0];
}

export async function listarCriteriosDeNorma(normaId) {
    const id = validarId(normaId, "La norma");
    const norma = await query("SELECT id FROM normas WHERE id = $1", [id]);

    if (!norma.rows[0]) throw crearError("La norma no existe.", 404);

    const { rows } = await query(
        `SELECT
       c.id,
       c.codigo,
       c.descripcion,
       c.activo,
       c.creado_en,
       (nc.criterio_id IS NOT NULL) AS asignado
     FROM criterios_norma c
     LEFT JOIN norma_criterios nc
       ON nc.criterio_id = c.id AND nc.norma_id = $1
     WHERE c.activo = TRUE
     ORDER BY c.codigo, c.id`,
        [id],
    );

    return rows;
}

export async function guardarCriteriosDeNorma(normaId, valores) {
    const id = validarId(normaId, "La norma");
    const criterioIds = validarIdsCriterios(valores);
    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");

        const norma = await cliente.query(
            "SELECT id FROM normas WHERE id = $1 AND activo = TRUE FOR UPDATE",
            [id],
        );

        if (!norma.rows[0]) {
            throw crearError("La norma no existe o está inactiva.", 400);
        }

        if (criterioIds.length > 0) {
            const resultado = await cliente.query(
                `SELECT COUNT(*)::integer AS total
         FROM criterios_norma
         WHERE id = ANY($1::integer[]) AND activo = TRUE`,
                [criterioIds],
            );

            if (resultado.rows[0].total !== criterioIds.length) {
                throw crearError(
                    "Uno o más criterios no existen o están inactivos.",
                    400,
                );
            }
        }

        await cliente.query("DELETE FROM norma_criterios WHERE norma_id = $1", [
            id,
        ]);

        if (criterioIds.length > 0) {
            await cliente.query(
                `INSERT INTO norma_criterios (norma_id, criterio_id)
         SELECT $1, criterio_id
         FROM unnest($2::integer[]) AS ids(criterio_id)`,
                [id, criterioIds],
            );
        }

        await cliente.query("COMMIT");
        return await listarCriteriosDeNorma(id);
    } catch (error) {
        await cliente.query("ROLLBACK");
        throw error;
    } finally {
        cliente.release();
    }
}

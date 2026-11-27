import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/config/db.js";
import { registrarHallazgo } from "../src/controllers/auditorias.controller.js";

test("el hallazgo exige criterio y evidencia, y PostgreSQL acepta la consulta", async () => {
  const original = pool.connect;
  const base = {
    descripcion: " Falta autorización ",
    criterio: " Procedimiento, apartado 4 ",
    evidencia_observada: " Registro CAM-01 sin firma ",
    responsable_id: 9,
  };
  let insercion;
  let consultas = 0;

  pool.connect = async () => ({
    async query(sql, params) {
      consultas++;
      if (sql.includes("INSERT INTO hallazgos")) {
        insercion = { sql, params };
        return { rows: [{ id: 5, auditoria_id: 3, estado: "abierto" }] };
      }
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("FROM auditorias")) {
        return { rows: [{ id: 3, estado: "ejecucion" }] };
      }
      return { rows: [] };
    },
    release() {},
  });

  async function enviar(body) {
    let status = 200;
    let respuesta;
    await registrarHallazgo(
      { params: { id: "3" }, body, auth: { sub: "7" } },
      { status(valor) { status = valor; return this; }, json(valor) { respuesta = valor; } },
      error => { throw error; },
    );
    return { status, respuesta };
  }

  try {
    assert.equal((await enviar({ ...base, criterio: " " })).status, 400);
    assert.equal((await enviar({ ...base, evidencia_observada: " " })).status, 400);
    assert.equal(consultas, 0);
    assert.equal((await enviar(base)).status, 201);
    assert.deepEqual(insercion.params, [
      3, "Falta autorización", 9, 7,
      "Procedimiento, apartado 4", "Registro CAM-01 sin firma",
      null, null,
    ]);
  } finally {
    pool.connect = original;
  }

  try {
    const { rows } = await pool.query("EXPLAIN " + insercion.sql, insercion.params);
    assert.ok(rows.length > 0);
  } finally {
    await pool.end();
  }
});

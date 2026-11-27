import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/config/db.js";
import { finalizarInforme, revisarHallazgo } from "../src/services/auditorias.service.js";

test("emitir informe deja pendientes en seguimiento", async () => {
  const original = pool.connect;
  let estadoGuardado;
  pool.connect = async () => ({
    async query(sql, params) {
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("FROM auditorias") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: 3, estado: "ejecucion" }] };
      }
      if (sql.includes("FROM hallazgos")) return { rows: [{ id: 2 }] };
      if (sql.includes("UPDATE auditorias")) {
        estadoGuardado = params[3];
        assert.equal(params[4], false);
        return { rows: [{ id: 3, estado: estadoGuardado }] };
      }
      return { rows: [] };
    },
    release() {},
  });

  try {
    const resultado = await finalizarInforme(3, 7, "Se revisó el proceso.");
    assert.equal(estadoGuardado, "en_seguimiento");
    assert.equal(resultado.estado, "en_seguimiento");
  } finally {
    pool.connect = original;
  }
});

test("emitir informe sin hallazgos pendientes cierra la auditoría", async () => {
  const original = pool.connect;
  pool.connect = async () => ({
    async query(sql, params) {
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("FROM auditorias") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: 3, estado: "ejecucion" }] };
      }
      if (sql.includes("FROM hallazgos")) return { rows: [] };
      if (sql.includes("UPDATE auditorias")) {
        assert.equal(params[3], "cerrada");
        assert.equal(params[4], true);
        return { rows: [{ id: 3, estado: "cerrada" }] };
      }
      return { rows: [] };
    },
    release() {},
  });

  try {
    assert.equal((await finalizarInforme(3, 7, "Sin hallazgos.")).estado, "cerrada");
  } finally {
    pool.connect = original;
  }
});

test("aceptar un hallazgo antes del informe no cierra la auditoría", async () => {
  const original = pool.connect;
  let cierres = 0;
  pool.connect = async () => ({
    async query(sql) {
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("JOIN hallazgos h")) {
        return { rows: [{ id: 2, estado: "en_revision", auditoria_estado: "ejecucion" }] };
      }
      if (sql.includes("UPDATE hallazgos")) {
        return { rows: [{ id: 2, auditoria_id: 3, estado: "cerrado" }] };
      }
      if (sql.includes("UPDATE auditorias")) cierres++;
      return { rows: [] };
    },
    release() {},
  });

  try {
    const resultado = await revisarHallazgo(3, 2, 7, "aceptar", "Validado");
    assert.equal(resultado.auditoria_cerrada, false);
    assert.equal(cierres, 0);
  } finally {
    pool.connect = original;
  }
});

test("aceptar el último hallazgo tras el informe cierra la auditoría", async () => {
  const original = pool.connect;
  pool.connect = async () => ({
    async query(sql) {
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("JOIN hallazgos h")) {
        return { rows: [{ id: 2, estado: "en_revision", auditoria_estado: "en_seguimiento" }] };
      }
      if (sql.includes("UPDATE hallazgos")) {
        return { rows: [{ id: 2, auditoria_id: 3, estado: "cerrado" }] };
      }
      if (sql.includes("FROM hallazgos")) return { rows: [] };
      if (sql.includes("UPDATE auditorias")) return { rows: [{ id: 3 }] };
      return { rows: [] };
    },
    release() {},
  });

  try {
    const resultado = await revisarHallazgo(3, 2, 7, "aceptar", "Validado");
    assert.equal(resultado.auditoria_cerrada, true);
  } finally {
    pool.connect = original;
  }
});

test("PostgreSQL acepta los tipos de la consulta del informe sin guardar datos", async () => {
  const original = pool.connect;
  let actualizacion;
  pool.connect = async () => ({
    async query(sql, params) {
      if (sql.includes("FROM usuarios u")) return { rows: [{ id: 7 }] };
      if (sql.includes("FROM auditorias") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: 3, estado: "ejecucion" }] };
      }
      if (sql.includes("FROM hallazgos")) return { rows: [{ id: 2 }] };
      if (sql.includes("UPDATE auditorias")) {
        actualizacion = { sql, params };
        return { rows: [{ id: 3, estado: "en_seguimiento" }] };
      }
      return { rows: [] };
    },
    release() {},
  });

  try {
    await finalizarInforme(3, 7, "Informe de prueba.");
  } finally {
    pool.connect = original;
  }

  try {
    assert.ok(actualizacion);
    const { rows } = await pool.query("EXPLAIN " + actualizacion.sql, actualizacion.params);
    assert.ok(rows.length > 0);
  } finally {
    await pool.end();
  }
});

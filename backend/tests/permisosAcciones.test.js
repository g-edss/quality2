import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MODULOS,
  catalogoParaFrontend,
  permisosPorDefecto,
  tieneAccionPorDefecto,
} from "../src/config/permisos.js";

const MIGRACIONES_PLANTILLA = [
  "044_permisos_acciones_modulos.sql",
  "054_permiso_crear_formato_registros.sql",
];

async function leerMigracion(nombre) {
  for (const carpeta of ["../database/migrations/", "../../database/migrations/"]) {
    try {
      return await readFile(new URL(carpeta + nombre, import.meta.url), "utf8");
    } catch {
      // probar la siguiente ubicación
    }
  }
  return null;
}

async function leerPlantillaMigracion() {
  const textos = await Promise.all(MIGRACIONES_PLANTILLA.map(leerMigracion));
  if (textos.some((sql) => sql === null)) return null;
  return [...textos.join("\n").matchAll(/\('(\w+)', '([\w.]+)', '(\w+)'\)/g)].map(
    ([, modulo, permiso, rol]) => ({ modulo, permiso, rol }),
  );
}

test("la migración 044 da exactamente las acciones por defecto de la configuración", async (t) => {
  const plantilla = await leerPlantillaMigracion();
  if (!plantilla)
    return t.skip("No se encontró la migración desde esta carpeta.");

  for (const rol of ["responsable", "revisor", "aprobador", "visor"]) {
    for (const modulo of MODULOS) {
      const esperadas = modulo.acciones
        .filter((a) => tieneAccionPorDefecto(rol, a))
        .map((a) => `${modulo.clave}.${a.clave}`)
        .sort();
      const deMigracion = [
        ...new Set(
          plantilla
            .filter(
              (f) =>
                f.modulo === modulo.clave &&
                (f.rol === "todos" || f.rol === rol),
            )
            .map((f) => f.permiso),
        ),
      ].sort();
      assert.deepEqual(deMigracion, esperadas, `${rol} en ${modulo.clave}`);
    }
  }
});

test("los defaults copian lo que permitía el código antes", () => {
  const tiene = (rol, permiso) => permisosPorDefecto(rol).includes(permiso);
  assert.equal(tiene("visor", "solicitudes.solicitarCambio"), false); //
  assert.equal(tiene("revisor", "solicitudes.solicitarCambio"), true);
  assert.equal(tiene("aprobador", "solicitudes.aprobar"), false);
  assert.equal(tiene("aprobador", "documentos.crear"), false);
  assert.equal(tiene("aprobador", "documentos.reportes"), true);
  assert.equal(tiene("responsable", "documentos.crear"), false);
  assert.equal(tiene("revisor", "auditorias.planear"), false);
  assert.equal(tiene("revisor", "auditorias.reportes"), true);
  assert.equal(tiene("revisor", "auditorias.hallazgos"), false);
  assert.equal(tiene("responsable", "auditorias.reportes"), false);
  assert.equal(tiene("visor", "visorDocumental.solicitarCopia"), true);
});

test("el catálogo omite Ver módulo para Indicadores y conserva los defaults por rol", () => {
  const catalogo = catalogoParaFrontend();

  for (const modulo of catalogo.modulos) {
    if (modulo.clave === "indicadores") {
      assert.equal(
        modulo.acciones.some(
          (accion) => accion.permiso === "modulo.indicadores",
        ),
        false,
      );
      assert.ok(
        modulo.acciones.some(
          (accion) => accion.permiso === "indicadores.tiposIndicador",
        ),
      );
      assert.ok(
        modulo.acciones.some(
          (accion) => accion.permiso === "indicadores.unidadesMedida",
        ),
      );
    } else {
      assert.equal(modulo.acciones[0].permiso, `modulo.${modulo.clave}`);
    }
  }

  assert.ok(permisosPorDefecto("responsable").includes("catalogo.indicadores"));
  assert.equal(
    permisosPorDefecto("responsable").includes("modulo.indicadores"),
    false,
  );
  assert.deepEqual(catalogo.porRol.visor.registros, {
    cargar: false,
    descargar: true,
  });
  assert.deepEqual(catalogo.porRol.responsable.registros, {
    cargar: true,
    descargar: true,
  });
  assert.ok(
    catalogo.porRol.admin_general.permisos.includes("auditorias.planear"),
  );
});

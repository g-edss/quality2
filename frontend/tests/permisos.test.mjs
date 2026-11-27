import test from "node:test";
import assert from "node:assert/strict";
import { puedeAcceder, tienePermiso } from "../src/config/permisos.js";

const usuario = (rol_clave, permisos = []) => ({ rol_clave, permisos });

test("el admin entra a todo sin importar su lista", () => {
  const admin = usuario("admin_general");
  assert.equal(puedeAcceder(admin, "usuarios"), true);
  assert.equal(puedeAcceder(admin, "auditorias"), true);
  assert.equal(tienePermiso(admin, "catalogo.procesos"), true);
});

test("los demás roles dependen de sus permisos guardados", () => {
  const visor = usuario("visor", [
    "modulo.visorDocumental",
    "catalogo.procesos",
  ]);
  assert.equal(puedeAcceder(visor, "visorDocumental"), true);
  assert.equal(puedeAcceder(visor, "procesos"), true);
  assert.equal(puedeAcceder(visor, "juntas"), false);
  assert.equal(puedeAcceder(visor, "usuarios"), false);
});

test("el inicio siempre es accesible y una ruta desconocida no", () => {
  const sinPermisos = usuario("responsable");
  assert.equal(puedeAcceder(sinPermisos, "dashboard"), true);
  assert.equal(puedeAcceder(sinPermisos, "rutaInventada"), false);
  assert.equal(puedeAcceder(null, "dashboard"), false);
});

test("los permisos de indicadores y sus catálogos auxiliares son independientes", () => {
  const catalogo = usuario("revisor", ["catalogo.indicadores"]);
  assert.equal(puedeAcceder(catalogo, "indicadores"), true);
  assert.equal(puedeAcceder(catalogo, "tipoIndicador"), false);
  assert.equal(puedeAcceder(catalogo, "unidadMedida"), false);

  const tipos = usuario("responsable", ["indicadores.tiposIndicador"]);
  assert.equal(puedeAcceder(tipos, "tipoIndicador"), true);
  assert.equal(puedeAcceder(tipos, "indicadores"), false);

  const unidades = usuario("responsable", ["indicadores.unidadesMedida"]);
  assert.equal(puedeAcceder(unidades, "unidadMedida"), true);
  assert.equal(puedeAcceder(unidades, "indicadores"), false);
});

import express from 'express';
import cors from 'cors';

import healthRoutes from './routes/health.routes.js';
import procesosRoutes from './routes/procesos.routes.js';
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import auditoresRoutes from './routes/auditores.routes.js';
import indicadoresRoutes from './routes/indicadores.routes.js';
import medicionesIndicadoresRoutes from './routes/medicionesIndicadores.routes.js';
import unidadesmedidaRoutes from './routes/unidadesmedida.routes.js';
import tiposIndicadorRoutes from './routes/tiposIndicador.routes.js';
import macroprocesosRoutes from './routes/macroprocesos.routes.js';
import documentosRoutes from './routes/documentos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import solicitudesRoutes from './routes/solicitudes.routes.js';
import notificacionesRoutes from './routes/notificaciones.routes.js';
import accionesCorrectivasRoutes from './routes/accionesCorrectivas.routes.js';
import auditoriasRoutes from './routes/auditorias.routes.js';
import juntasRoutes from './routes/juntas.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import busquedaRoutes from './routes/busqueda.routes.js';
import normasRoutes from './routes/normas.routes.js';
import solicitudesCopiasRoutes from './routes/solicitudesCopias.routes.js';
import permisosRoutes from './routes/permisos.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth, requirePermiso } from './middlewares/auth.js';

const modulo = (clave) => [requireAuth, requirePermiso(`modulo.${clave}`)];

export const app = express();

const origenesPermitidos = (process.env.CORS_ORIGENES || 'http://localhost:5400,http://localhost:5173')
  .split(',')
  .map(origen => origen.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origen, responder) {
    responder(null, !origen || origenesPermitidos.includes(origen));
  },
}));
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/procesos', procesosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auditores', auditoresRoutes);
app.use('/api/indicadores', indicadoresRoutes);
app.use('/api/indicadores', medicionesIndicadoresRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/registros', modulo('almacenRegistros'), registrosRoutes);
app.use('/api/solicitudes', modulo('solicitudes'), solicitudesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/acciones-correctivas', modulo('accionesCorrectivas'), accionesCorrectivasRoutes);
app.use('/api/auditorias', modulo('auditorias'), auditoriasRoutes);
app.use('/api/juntas', modulo('juntas'), juntasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/busqueda', busquedaRoutes);
app.use('/api/normas', normasRoutes);
app.use('/api/copias-controladas', solicitudesCopiasRoutes);
app.use('/api/unidades-medida', unidadesmedidaRoutes);
app.use('/api/tipos-indicador', tiposIndicadorRoutes);
app.use('/api/macroprocesos', macroprocesosRoutes);
app.use('/api/permisos', permisosRoutes);

app.get('/', (_req, res) => {
  res.json({ servicio: 'WEB 360 de Calidad — API', estado: 'ok' });
});

app.use(errorHandler);

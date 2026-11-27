<template>
  <section class="auditorias-page">
    <p v-if="error" class="auditorias-aviso auditorias-aviso--error" role="alert">{{ error }}</p>
    <p v-if="mensaje" class="auditorias-aviso" :class="`auditorias-aviso--${tipoMensaje}`" role="status">{{ mensaje }}
    </p>
    <p v-if="cargando">Cargando auditorías…</p>

    <div class="auditorias-page__top">
      <div>
        <h1 class="auditorias-page__title">Auditorías Internas</h1>
        <p class="pagina-subtitulo">Planea auditorías, registra hallazgos y da seguimiento hasta cerrarlos.</p>
      </div>

      <span class="auditorias-page__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
    </div>

    <div class="auditorias-card">

      <div class="auditorias-card__actions">
        <button v-if="puede('planear')" class="auditorias-btn" @click="abrirPlaneacion">Nueva
          planeación</button>

        <button v-if="vistaActual === 'flujo' && puede('reportes')" class="auditorias-btn" @click="abrirReportes">
          <span>▥</span>
          Reportes
        </button>

        <button v-else class="auditorias-btn" @click="volverAlFlujo">
          <span>←</span>
          Volver al flujo
        </button>

      </div>

      <template v-if="vistaActual === 'flujo'">

        <h2 class="auditorias-flow__title">
          Flujo de la aplicación
        </h2>

        <div class="auditorias-flow">

          <div class="auditorias-flow__col">
            <button class="auditorias-step auditorias-step--arrow"
              :class="{ 'auditorias-step--active': etapaActiva === 1 }" @mouseenter="etapaActiva = 1"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(1)">
              <svg class="auditorias-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6" />
                <path d="M9 16h4" />
              </svg>
              <span class="auditorias-step__text">
                Realizar<br>
                planeación
              </span>
            </button>

            <span class="auditorias-connector">
              <span class="auditorias-connector__line"></span>
              <span class="auditorias-connector__dot"></span>
            </span>

            <span class="auditorias-flow__role">Administrador</span>
          </div>

          <span class="auditorias-flow__arrow">→</span>

          <div class="auditorias-flow__col">
            <button class="auditorias-step auditorias-step--arrow"
              :class="{ 'auditorias-step--active': etapaActiva === 2 }" @mouseenter="etapaActiva = 2"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(2)">
              <svg class="auditorias-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="10" r="6" />
                <line x1="14.5" y1="14.5" x2="20" y2="20" />
              </svg>
              <span class="auditorias-step__text">
                Ejecutar auditoría<br>
                y emitir informe
              </span>
            </button>

            <span class="auditorias-connector">
              <span class="auditorias-connector__line"></span>
              <span class="auditorias-connector__dot"></span>
            </span>

            <span class="auditorias-flow__role">Administrador</span>
          </div>

          <span class="auditorias-flow__arrow">→</span>

          <div class="auditorias-flow__col">
            <button class="auditorias-step auditorias-step--arrow"
              :class="{ 'auditorias-step--active': etapaActiva === 3 }" @mouseenter="etapaActiva = 3"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(3)">
              <svg class="auditorias-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="14 7 21 7 21 14" />
              </svg>
              <span class="auditorias-step__text">
                Seguimiento de<br>
                hallazgos
              </span>
            </button>

            <span class="auditorias-connector">
              <span class="auditorias-connector__line"></span>
              <span class="auditorias-connector__dot"></span>
            </span>

            <span class="auditorias-flow__role">Responsable</span>
          </div>

          <span class="auditorias-flow__arrow">→</span>

          <div class="auditorias-flow__col">
            <button class="auditorias-step auditorias-step--decision"
              :class="{ 'auditorias-step--active': etapaActiva === 4 }" @mouseenter="etapaActiva = 4"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(4)">
              <svg class="auditorias-step__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span class="auditorias-step__text">
                Revisar<br>
                acciones
              </span>
            </button>

            <span class="auditorias-connector">
              <span class="auditorias-connector__line"></span>
              <span class="auditorias-connector__dot"></span>
            </span>

            <span class="auditorias-flow__role">Administrador</span>
          </div>

          <span class="auditorias-flow__arrow">→</span>

          <div class="auditorias-flow__col">
            <div class="auditorias-finish">
              <strong>Hallazgo cerrado</strong>
              <span>
                Cierre automático de
                hallazgos
              </span>
            </div>
          </div>

          <span class="auditorias-flow__arrow">→</span>

          <div class="auditorias-flow__col">
            <div class="auditorias-finish auditorias-finish--wide">
              <strong>Auditoría cerrada</strong>
              <span>
                Después del informe y de resolver
                todos los hallazgos
              </span>
            </div>
          </div>

        </div>

      </template>

      <template v-else>

        <h2 class="auditorias-flow__title">
          Selecciona una auditoría para ver su reporte
        </h2>

        <div class="auditorias-reportes-list">
          <button class="auditorias-btn" :disabled="cargando" @click="cargarDatos">Actualizar lista</button>
          <p v-if="!cargando && !auditorias.length">Todavía no hay auditorías registradas.</p>
          <button v-for="auditoria in auditorias" :key="auditoria.id" class="auditorias-reportes-item"
            @click="verReporte(auditoria)">
            <div class="auditorias-reportes-item__main">
              <strong>AUD-{{ auditoria.id }} · {{ auditoria.titulo }}</strong>
              <span class="auditorias-reportes-item__area">{{ auditoria.area }}</span>
              <span class="auditorias-reportes-item__area">Auditor: {{ auditoria.auditor }} · Programada: {{
                formatearFecha(auditoria.fecha_programada) }}</span>
            </div>

            <div class="auditorias-reportes-item__meta">
              <span class="auditorias-badge" :class="claseEstado(auditoria.estado)">
                {{ auditoria.estado }}
              </span>
              <span v-if="auditoriaAtrasada(auditoria)" class="auditorias-badge auditorias-badge--rechazo">
                {{ textoAtraso(auditoria.fecha_programada, 'Atrasada') }}
              </span>
              <span class="auditorias-reportes-item__fecha">
                {{ auditoria.fechaPlaneacion || 'Sin fecha' }}
              </span>
              <span class="auditorias-reportes-item__arrow">›</span>
            </div>
          </button>
        </div>

      </template>

    </div>

    <div v-if="mostrarPlaneacion" class="auditorias-modal-overlay" @click.self="cerrarPlaneacion">
      <div class="auditorias-modal">
        <div class="auditorias-modal__header">
          <h3 class="auditorias-modal__title">Nueva planeación de auditoría</h3>
          <button class="auditorias-modal__close" aria-label="Cerrar" @click="cerrarPlaneacion">×</button>
        </div>
        <form class="auditorias-formulario" @submit.prevent="guardarPlaneacion">
          <div class="auditorias-modal__body">
            <p v-if="errorFormulario" class="auditorias-aviso auditorias-aviso--error" role="alert">{{ errorFormulario
            }}
            </p>
            <p v-if="!cargando && (!procesos.length || !auditores.length)">Para crear una planeación necesitas un
              proceso
              activo y un auditor activo en los catálogos.</p>
            <label class="auditorias-campo">Nombre de la auditoría *
              <input v-model="formulario.nombre" class="auditorias-input" required maxlength="200">
            </label>
            <label class="auditorias-campo">Proceso auditado *
              <select v-model="formulario.proceso_id" class="auditorias-input" required>
                <option value="" disabled>Selecciona un proceso</option>
                <option v-for="proceso in procesos" :key="proceso.id" :value="proceso.id">{{ proceso.nombre }}</option>
              </select>
            </label>
            <label class="auditorias-campo">Auditor asignado *
              <select v-model="formulario.auditor_catalogo_id" class="auditorias-input" required>
                <option value="" disabled>Selecciona un auditor</option>
                <option v-for="auditor in auditores" :key="auditor.id" :value="auditor.id">{{ auditor.codigo }} · {{
                  auditor.nombre }}</option>
              </select>
            </label>
            <label class="auditorias-campo">
              Tipo de auditoría *
              <select v-model="formulario.tipo_auditoria" class="auditorias-input" required>
                <option value="interna">Interna</option>
                <option value="externa">Externa</option>
              </select>
            </label>
            <label class="auditorias-campo">Fecha programada *
              <input v-model="formulario.fecha_programada" class="auditorias-input" type="date" required>
            </label>
            <label class="auditorias-campo">Alcance *
              <textarea v-model="formulario.alcance" class="auditorias-input" rows="4" required maxlength="10000"
                placeholder="Describe qué se revisará"></textarea>
            </label>
            <label class="auditorias-campo">Comentarios (opcionales)
              <textarea v-model="formulario.comentarios" class="auditorias-input" rows="3" maxlength="5000"></textarea>
            </label>
            <p>Registrada por: {{ auth.usuario?.nombre }}. Se guardará en estado Planeación.</p>
          </div>
          <div class="auditorias-modal__footer">
            <button type="button" class="auditorias-btn" :disabled="guardando"
              @click="cerrarPlaneacion">Cancelar</button>
            <button type="submit" class="auditorias-btn-cerrar"
              :disabled="guardando || cargando || !procesos.length || !auditores.length">{{ guardando ? 'Guardando…' :
                'Guardar planeación' }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="mostrarModalReporte && auditoriaSeleccionada" class="auditorias-modal-overlay"
      @click.self="cerrarModalReporte">
      <div class="auditorias-modal auditorias-modal--report">

        <div class="auditorias-modal__header">
          <h3 class="auditorias-modal__title">Reporte de auditoría</h3>
          <button class="auditorias-modal__close" aria-label="Cerrar" @click="cerrarModalReporte">×</button>
        </div>

        <div class="auditorias-modal__body">

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Título de la auditoría</span>
            <span class="auditorias-report-field__value auditorias-report-field__value--big">
              {{ auditoriaSeleccionada.titulo }}
            </span>
          </div>

          <div class="auditorias-report-row">
            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Área / proceso auditado</span>
              <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.area || 'Sin registrar' }}</span>
            </div>

            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Estado</span>
              <span class="auditorias-badge" :class="claseEstado(auditoriaSeleccionada.estado)">
                {{ auditoriaSeleccionada.estado }}
              </span>
            </div>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Tipo de auditoría</span>
            <span class="auditorias-report-field__value">
              {{ auditoriaSeleccionada.tipo_auditoria === 'externa' ? 'Externa' : 'Interna' }}
            </span>
          </div>

          <div class="auditorias-report-row">
            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Fecha de planeación</span>
              <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.fechaPlaneacion || 'Sin registrar'
              }}</span>
            </div>

            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Fecha de ejecución</span>
              <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.fechaEjecucion || 'Aún no ejecutada'
              }}</span>
            </div>
          </div>

          <div class="auditorias-report-row">
            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Responsable de planeación</span>
              <span class="auditorias-report-field__value">
                {{ auditoriaSeleccionada.responsablePlaneacion || 'Sin registrar' }}
              </span>
            </div>

            <div class="auditorias-report-field">
              <span class="auditorias-report-field__label">Auditor asignado</span>
              <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.auditor || 'Sin registrar' }}</span>
            </div>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Auditores involucrados</span>

            <ul v-if="auditoriaSeleccionada.auditores && auditoriaSeleccionada.auditores.length"
              class="auditorias-report-list">
              <li v-for="persona in auditoriaSeleccionada.auditores" :key="persona">{{ persona }}</li>
            </ul>
            <span v-else class="auditorias-report-field__value auditorias-report-field__value--muted">
              Sin registrar
            </span>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Fecha programada</span>
            <span class="auditorias-report-field__value">{{ formatearFecha(auditoriaSeleccionada.fecha_programada)
            }}</span>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Alcance y procesos que intervienen</span>
            <span class="auditorias-report-field__value">
              {{ auditoriaSeleccionada.alcance || 'Sin registrar' }}
            </span>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Hallazgos registrados</span>

            <div v-if="auditoriaSeleccionada.hallazgos?.length" class="auditorias-table-scroll">
              <table class="auditorias-report-table auditorias-report-table--hallazgos">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Hallazgo</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="hallazgo in auditoriaSeleccionada.hallazgos" :key="hallazgo.id">
                    <td>HAL-{{ hallazgo.id }}</td>
                    <td>
                      {{ hallazgo.descripcion }}
                      <div><strong>Criterio revisado:</strong>
                        {{ hallazgo.criterio || 'No registrado en este hallazgo anterior' }}
                      </div>
                      <div v-if="hallazgo.norma_codigo && hallazgo.criterio_codigo">
                        <strong>Norma vinculada:</strong>
                        {{ hallazgo.norma_codigo }} — {{ hallazgo.norma_nombre }}
                        <br>
                        <strong>Criterio vinculado:</strong>
                        {{ hallazgo.criterio_codigo }} — {{ hallazgo.criterio_descripcion }}
                      </div>
                      <div><strong>Evidencia observada:</strong>
                        {{ hallazgo.evidencia_observada || 'No registrada en este hallazgo anterior' }}
                      </div>
                      <div>
                        <strong>Acciones correctivas relacionadas:</strong>
                        <ul v-if="hallazgo.acciones_correctivas?.length" class="auditorias-report-list">
                          <li v-for="accion in hallazgo.acciones_correctivas" :key="accion.id">
                            AC-{{ accion.id }} · {{ accion.titulo }} ·
                            <span class="auditorias-badge" :class="claseEstadoAccion(accion.estado)">
                              {{ nombreEstadoAccion(accion.estado) }}
                            </span>
                          </li>
                        </ul>
                        <span v-else>Sin acción correctiva relacionada.</span>
                        <button
                          v-if="tienePermiso(auth.usuario, 'accionesCorrectivas.levantar') && auditoriaSeleccionada.estadoInterno !== 'cerrada'"
                          type="button" class="auditorias-btn" :disabled="guardandoAccion || cargando"
                          @click="abrirModalAccion(hallazgo)">
                          Crear acción correctiva
                        </button>
                        <div
                          v-if="tienePermiso(auth.usuario, 'accionesCorrectivas.levantar') && accionesDisponiblesParaHallazgo(hallazgo).length > 0"
                          class="auditorias-campo">
                          <label :for="`vincular-accion-${hallazgo.id}`">Vincular una acción existente</label>
                          <select :id="`vincular-accion-${hallazgo.id}`" v-model="accionesElegidasPorHallazgo[hallazgo.id]"
                            class="auditorias-input" :disabled="vinculandoAccion || cargando">
                            <option value="">Selecciona una acción</option>
                            <option v-for="accion in accionesDisponiblesParaHallazgo(hallazgo)" :key="accion.id"
                              :value="String(accion.id)">
                              AC-{{ accion.id }} · {{ accion.titulo }} · {{ nombreEstadoAccion(accion.estado) }}
                            </option>
                          </select>

                          <button type="button" class="auditorias-btn"
                            :disabled="vinculandoAccion || cargando || !accionesElegidasPorHallazgo[hallazgo.id]"
                            @click="vincularAccionExistente(hallazgo)">
                            {{ vinculandoAccion ? 'Vinculando…' : 'Vincular acción' }}
                          </button>
                        </div>
                      </div>
                      <div v-if="hallazgo.archivos?.length" class="auditorias-report-files">
                        <button v-for="archivo in hallazgo.archivos" :key="archivo.id" type="button"
                          class="auditorias-report-file" :disabled="descargandoArchivo !== null"
                          @click="descargarArchivoHallazgo(hallazgo.id, archivo)">
                          📎 {{ archivo.nombre }}
                        </button>
                      </div>
                      <div>
                        <small>
                          Registrado por {{ hallazgo.registrado_por || 'Sin registrar' }}
                          el {{ mostrarFechaHora(hallazgo.creado_en) }}
                        </small>
                      </div>
                    </td>
                    <td>{{ hallazgo.responsable }}</td>
                    <td>
                      <span class="auditorias-badge" :class="claseEstadoHallazgo(hallazgo.estado)">
                        {{ nombreEstadoHallazgo(hallazgo.estado) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <span v-else class="auditorias-report-field__value auditorias-report-field__value--muted">
              Todavía no hay hallazgos registrados.
            </span>
            <p v-if="errorSeguimiento" class="auditorias-aviso auditorias-aviso--error" role="alert">
              {{ errorSeguimiento }}
            </p>
            <p v-if="errorDescarga" class="auditorias-aviso auditorias-aviso--error" role="alert">{{ errorDescarga }}
            </p>

            <div v-for="hallazgo in auditoriaSeleccionada.hallazgos || []" :key="`seguimiento-${hallazgo.id}`"
              class="auditorias-report-field">
              <h4>Avances de HAL-{{ hallazgo.id }}</h4>

              <ul v-if="hallazgo.seguimientos?.length" class="auditorias-report-list">
                <li v-for="avance in hallazgo.seguimientos" :key="avance.id">
                  <strong v-if="avance.tipo === 'aceptacion'">Aceptado: </strong>
                  <strong v-else-if="avance.tipo === 'correcciones'">Correcciones solicitadas: </strong>
                  {{ avance.comentario }}
                  <small>
                    — {{ avance.usuario }},
                    {{ mostrarFechaHora(avance.creado_en) }}
                  </small>
                  <div v-if="avance.archivos?.length" class="auditorias-report-files">
                    <button v-for="archivo in avance.archivos" :key="archivo.id" type="button"
                      class="auditorias-report-file" :disabled="descargandoArchivo !== null"
                      @click="descargarArchivoHallazgo(hallazgo.id, archivo)">
                      📎 {{ archivo.nombre }}
                    </button>
                  </div>
                </li>
              </ul>

              <span v-else class="auditorias-report-field__value auditorias-report-field__value--muted">
                Todavía no hay avances.
              </span>

              <form v-if="puedeDarSeguimiento(hallazgo)" @submit.prevent="guardarSeguimiento(hallazgo)">
                <label class="auditorias-campo">
                  ¿Qué hiciste para atender este hallazgo? *
                  <textarea v-model="comentariosSeguimiento[hallazgo.id]" class="auditorias-input" rows="3"
                    maxlength="10000" required :disabled="guardandoSeguimiento"
                    placeholder="Describe el trabajo realizado"></textarea>
                </label>
                <label class="auditorias-campo">
                  Archivos que respaldan el avance (opcionales)
                  <input :key="claveArchivosSeguimiento[hallazgo.id] || 0" type="file" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" :disabled="guardandoSeguimiento"
                    @change="seleccionarArchivosSeguimiento(hallazgo.id, $event)">
                </label>
                <p>Hasta 5 archivos de 25 MB cada uno: PDF, Office, PNG o JPEG.</p>

                <button type="submit" class="auditorias-btn-cerrar" :disabled="guardandoSeguimiento || cargando">
                  {{ guardandoSeguimiento ? 'Guardando…' : 'Guardar avance' }}
                </button>
              </form>
              <button v-if="puedeDarSeguimiento(hallazgo) && hallazgo.seguimientos?.length" type="button"
                class="auditorias-btn" :disabled="enviandoRevisionHallazgo || guardandoSeguimiento || cargando"
                @click="enviarHallazgoARevision(hallazgo)">
                {{ enviandoRevisionHallazgo ? 'Enviando…' : 'Enviar HAL-' + hallazgo.id + ' a revisión' }}
              </button>
              <div v-if="puedeRevisarHallazgo(hallazgo)">
                <label class="auditorias-campo">
                  Observaciones de la revisión
                  <textarea v-model="comentariosRevisionHallazgo[hallazgo.id]" class="auditorias-input" rows="3"
                    maxlength="10000" :disabled="revisandoHallazgo"
                    placeholder="Obligatorio si vas a solicitar correcciones"></textarea>
                </label>

                <button type="button" class="auditorias-btn" :disabled="revisandoHallazgo || cargando"
                  @click="revisarHallazgo(hallazgo, 'correcciones')">
                  Solicitar correcciones
                </button>

                <button type="button" class="auditorias-btn-cerrar" :disabled="revisandoHallazgo || cargando"
                  @click="revisarHallazgo(hallazgo, 'aceptar')">
                  Aceptar y cerrar HAL-{{ hallazgo.id }}
                </button>
              </div>
            </div>
          </div>

          <form v-if="puede('hallazgos') && auditoriaSeleccionada.estadoInterno === 'ejecucion'"
            @submit.prevent="guardarHallazgo">
            <h4>Registrar hallazgo</h4>

            <p v-if="errorNuevoHallazgo" class="auditorias-aviso auditorias-aviso--error" role="alert">
              {{ errorNuevoHallazgo }}
            </p>

            <label class="auditorias-campo">
              Descripción del hallazgo *
              <textarea v-model="nuevoHallazgo.descripcion" class="auditorias-input" rows="4" maxlength="10000" required
                :disabled="guardandoHallazgo" placeholder="Describe qué encontraste y dónde ocurrió"></textarea>
            </label>

            <label class="auditorias-campo">
              Norma relacionada
              <select v-model="nuevoHallazgo.norma_id" class="auditorias-input" :disabled="guardandoHallazgo"
                @change="nuevoHallazgo.criterio_id = ''">
                <option value="">Sin norma relacionada</option>
                <option v-for="norma in auditoriaSeleccionada.normas || []" :key="norma.id" :value="String(norma.id)">
                  {{ norma.codigo }} — {{ norma.nombre }}
                </option>
              </select>
            </label>

            <label v-if="nuevoHallazgo.norma_id" class="auditorias-campo">
              Criterio de la norma
              <select v-model="nuevoHallazgo.criterio_id" class="auditorias-input" :disabled="guardandoHallazgo">
                <option value="">Sin criterio seleccionado</option>
                <option v-for="criterio in (auditoriaSeleccionada.normas || [])
                  .find(norma => String(norma.id) === nuevoHallazgo.norma_id)?.criterios || []" :key="criterio.id"
                  :value="String(criterio.id)">
                  {{ criterio.codigo }} — {{ criterio.descripcion }}
                </option>
              </select>
            </label>

            <label class="auditorias-campo">
              Regla o criterio revisado *
              <textarea v-model="nuevoHallazgo.criterio" class="auditorias-input" rows="3" maxlength="10000" required
                :disabled="guardandoHallazgo"
                placeholder="Ej. Procedimiento de cambios, apartado 4: cada cambio debe tener autorización"></textarea>
            </label>

            <label class="auditorias-campo">
              Evidencia observada *
              <textarea v-model="nuevoHallazgo.evidencia_observada" class="auditorias-input" rows="3" maxlength="10000"
                required :disabled="guardandoHallazgo"
                placeholder="Ej. En el registro CAM-01 del 29/09/2026 no aparece la autorización"></textarea>
            </label>

            <label class="auditorias-campo">
              Responsable *
              <select v-model="nuevoHallazgo.responsable_id" class="auditorias-input" required
                :disabled="guardandoHallazgo">
                <option value="" disabled>Selecciona un responsable</option>
                <option v-for="persona in responsablesHallazgo" :key="persona.id" :value="persona.id">
                  {{ persona.nombre }}
                </option>
              </select>
            </label>

            <label class="auditorias-campo">
              Archivos de la evidencia observada (opcionales)
              <input :key="claveArchivosHallazgo" type="file" multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" :disabled="guardandoHallazgo"
                @change="seleccionarArchivosHallazgo">
            </label>
            <p>Hasta 5 archivos de 25 MB cada uno: PDF, Office, PNG o JPEG.</p>

            <p v-if="!responsablesHallazgo.length">
              Necesitas un usuario activo para asignar el hallazgo.
            </p>

            <button type="submit" class="auditorias-btn-cerrar"
              :disabled="guardandoHallazgo || cargando || !responsablesHallazgo.length">
              {{ guardandoHallazgo ? 'Guardando…' : 'Guardar hallazgo' }}
            </button>
          </form>

          <form v-if="puede('finalizarInforme') && auditoriaSeleccionada.estadoInterno === 'ejecucion'"
            class="auditorias-report-field" @submit.prevent="finalizarInforme">
            <h4>Terminar revisión y emitir informe</h4>
            <p>Después de emitir el informe ya no podrás agregar hallazgos. Los pendientes continuarán en seguimiento.
            </p>
            <p v-if="errorInforme" class="auditorias-aviso auditorias-aviso--error" role="alert">{{ errorInforme }}</p>
            <label class="auditorias-campo">
              Conclusión de la auditoría *
              <textarea v-model="conclusionInforme" class="auditorias-input" rows="4" maxlength="10000" required
                :disabled="finalizandoInforme" placeholder="Resume qué se revisó y el resultado obtenido"></textarea>
            </label>
            <button type="submit" class="auditorias-btn-cerrar" :disabled="finalizandoInforme || cargando">
              {{ finalizandoInforme ? 'Emitiendo…' : 'Emitir informe' }}
            </button>
          </form>

          <div v-if="auditoriaSeleccionada.informe_emitido_en" class="auditorias-report-field">
            <span class="auditorias-report-field__label">Informe de auditoría emitido</span>
            <span class="auditorias-report-field__value">
              {{ auditoriaSeleccionada.fechaInforme }} por {{ auditoriaSeleccionada.informe_emitido_por_nombre }}
            </span>
            <span class="auditorias-report-field__label">Conclusión</span>
            <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.conclusion }}</span>
          </div>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Comentarios generales</span>
            <span class="auditorias-report-field__value">
              {{ auditoriaSeleccionada.comentarios || 'Sin registrar' }}
            </span>
          </div>

          <div v-if="auditoriaSeleccionada.archivos && auditoriaSeleccionada.archivos.length"
            class="auditorias-report-field">
            <span class="auditorias-report-field__label">Archivos adjuntos</span>

            <div class="auditorias-report-files">
              <span v-for="archivo in auditoriaSeleccionada.archivos" :key="archivo" class="auditorias-report-file">
                📎 {{ archivo }}
              </span>
            </div>
          </div>

          <template v-if="auditoriaSeleccionada.estado === 'Cerrada'">
            <div class="auditorias-report-field auditorias-report-field--closure">
              <span class="auditorias-report-field__label">Información de cierre</span>

              <div class="auditorias-report-row">
                <div class="auditorias-report-field">
                  <span class="auditorias-report-field__label">Fecha de cierre</span>
                  <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.fechaCierre || 'Sin registrar'
                  }}</span>
                </div>

                <div class="auditorias-report-field">
                  <span class="auditorias-report-field__label">Tiempo desde el inicio hasta resolver los
                    hallazgos</span>
                  <span class="auditorias-report-field__value">{{ auditoriaSeleccionada.duracion || 'Sin registrar'
                  }}</span>
                </div>
              </div>

              <span class="auditorias-report-field__label">Cerrada por</span>
              <ul
                v-if="auditoriaSeleccionada.cierre && auditoriaSeleccionada.cierre.personas && auditoriaSeleccionada.cierre.personas.length"
                class="auditorias-report-list">
                <li v-for="persona in auditoriaSeleccionada.cierre.personas" :key="persona">{{ persona }}</li>
              </ul>
              <span v-else class="auditorias-report-field__value auditorias-report-field__value--muted">
                Sin registrar
              </span>
            </div>
          </template>

          <div class="auditorias-report-field">
            <span class="auditorias-report-field__label">Historial de seguimiento y modificaciones</span>

            <table v-if="auditoriaSeleccionada.historial && auditoriaSeleccionada.historial.length"
              class="auditorias-report-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in auditoriaSeleccionada.historial" :key="index">
                  <td>{{ item.fecha }}</td>
                  <td>{{ item.usuario }}</td>
                  <td>{{ item.comentario }}</td>
                </tr>
              </tbody>
            </table>
            <span v-else class="auditorias-report-field__value auditorias-report-field__value--muted">
              Sin movimientos registrados
            </span>
          </div>

        </div>

        <p v-if="errorEjecucion" class="auditorias-aviso auditorias-aviso--error" role="alert">
          {{ errorEjecucion }}
        </p>

        <p v-if="auditoriaSeleccionada.iniciada_en" class="auditorias-aviso auditorias-aviso--info">
          Ejecución iniciada por {{ auditoriaSeleccionada.iniciada_por_nombre }}
          el {{ auditoriaSeleccionada.fechaEjecucion }}
        </p>

        <div class="auditorias-modal__footer">
          <button v-if="puede('iniciar') && auditoriaSeleccionada.estadoInterno === 'planeacion'"
            class="auditorias-btn-cerrar" :disabled="iniciandoEjecucion || cargando" @click="iniciarEjecucion">
            {{ iniciandoEjecucion ? 'Iniciando…' : 'Iniciar ejecución' }}
          </button>

          <button class="auditorias-btn" :disabled="iniciandoEjecucion || guardandoHallazgo || finalizandoInforme"
            @click="cerrarModalReporte">
            Cerrar
          </button>
        </div>

      </div>
    </div>

    <div v-if="mostrarModalAccion" class="auditorias-modal-overlay" @click.self="cerrarModalAccion">
      <div class="auditorias-modal">
        <div class="auditorias-modal__header">
          <h3 class="auditorias-modal__title">Crear acción correctiva</h3>
          <button class="auditorias-modal__close" type="button" aria-label="Cerrar"
            @click="cerrarModalAccion">×</button>
        </div>

        <form class="auditorias-formulario" @submit.prevent="guardarAccionDesdeHallazgo">
          <div class="auditorias-modal__body">
            <p>
              Se relacionará con HAL-{{ hallazgoParaAccion?.id }} de AUD-{{ auditoriaSeleccionada?.id }}.
            </p>

            <p v-if="errorAccionHallazgo" class="auditorias-aviso auditorias-aviso--error" role="alert">
              {{ errorAccionHallazgo }}
            </p>

            <label class="auditorias-campo">
              Título de la acción *
              <input v-model="formAccionHallazgo.titulo" class="auditorias-input" maxlength="200" required
                placeholder="Ej. Corregir registros sin firma">
            </label>

            <label class="auditorias-campo">
              Qué se hará para corregirlo *
              <textarea v-model="formAccionHallazgo.descripcion" class="auditorias-input" rows="4" maxlength="10000"
                required placeholder="Describe la solución que se realizará"></textarea>
            </label>

            <label class="auditorias-campo">
              Responsable de seguimiento *
              <select v-model="formAccionHallazgo.responsableId" class="auditorias-input" required>
                <option value="" disabled>Selecciona un responsable</option>
                <option v-for="persona in responsablesHallazgo" :key="persona.id" :value="String(persona.id)">
                  {{ persona.nombre }}
                </option>
              </select>
            </label>

            <label class="auditorias-campo">
              Tipo de hallazgo *
              <select v-model="formAccionHallazgo.tipoHallazgo" class="auditorias-input" required>
                <option value="" disabled>Selecciona el tipo</option>
                <option value="No Conformidad mayor">No Conformidad mayor</option>
                <option value="No Conformidad menor">No Conformidad menor</option>
                <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                <option value="Fortaleza">Fortaleza</option>
              </select>
            </label>

            <label class="auditorias-campo">
              Fecha de ocurrencia *
              <input v-model="formAccionHallazgo.fechaOcurrencia" class="auditorias-input" type="date" required>
            </label>

            <label class="auditorias-campo">
              Fecha compromiso (opcional)
              <input v-model="formAccionHallazgo.fechaCompromiso" class="auditorias-input" type="date">
            </label>
          </div>

          <div class="auditorias-modal__footer">
            <button type="button" class="auditorias-btn" :disabled="guardandoAccion"
              @click="cerrarModalAccion">Cancelar</button>
            <button type="submit" class="auditorias-btn-cerrar"
              :disabled="guardandoAccion || cargando || !responsablesHallazgo.length">
              {{ guardandoAccion ? 'Guardando…' : 'Guardar acción' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { confirmarAccion } from '@/utils/dialogos';
import { tienePermiso } from "@/config/permisos";
import { estaVencida, mostrarFecha, mostrarFechaHora, textoAtraso } from "@/utils/fechas";

const auth = useAuthStore();
const puede = (accion) => tienePermiso(auth.usuario, `auditorias.${accion}`);
const vistaActual = ref("flujo");
const etapaActiva = ref(null);
const auditorias = ref([]);
const accionesCorrectivas = ref([]);
const accionesElegidasPorHallazgo = ref({});
const vinculandoAccion = ref(false);
const procesos = ref([]);
const auditores = ref([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref("");
const errorFormulario = ref("");
const mensaje = ref("");
const tipoMensaje = ref("info");
const mostrarPlaneacion = ref(false);
const mostrarModalReporte = ref(false);
const auditoriaSeleccionada = ref(null);
const iniciandoEjecucion = ref(false);
const errorEjecucion = ref("");
const responsablesHallazgo = ref([]);
const guardandoHallazgo = ref(false);
const errorNuevoHallazgo = ref("");
const archivosHallazgo = ref([]);
const claveArchivosHallazgo = ref(0);
const nuevoHallazgo = ref({
  descripcion: "",
  criterio: "",
  evidencia_observada: "",
  responsable_id: "",
  norma_id: "",
  criterio_id: "",
});
const comentariosSeguimiento = ref({});
const guardandoSeguimiento = ref(false);
const enviandoRevisionHallazgo = ref(false);
const errorSeguimiento = ref("");
const archivosSeguimiento = ref({});
const claveArchivosSeguimiento = ref({});
const descargandoArchivo = ref(null);
const errorDescarga = ref("");
const comentariosRevisionHallazgo = ref({});
const revisandoHallazgo = ref(false);
const conclusionInforme = ref("");
const finalizandoInforme = ref(false);
const errorInforme = ref("");
const mostrarModalAccion = ref(false);
const hallazgoParaAccion = ref(null);
const guardandoAccion = ref(false);
const errorAccionHallazgo = ref("");
const formAccionHallazgo = ref({
  titulo: "",
  descripcion: "",
  responsableId: "",
  tipoHallazgo: "",
  fechaOcurrencia: "",
  fechaCompromiso: "",
});

function formularioVacio() {
  return {
    nombre: "",
    tipo_auditoria: "interna",
    proceso_id: "",
    auditor_catalogo_id: "",
    fecha_programada: "",
    alcance: "",
    comentarios: "",
  };
}
const formulario = ref(formularioVacio());

function formatearFecha(fecha) {
  return mostrarFecha(fecha, "Sin registrar");
}

function calcularDuracion(inicio, fin) {
  if (!inicio || !fin) return "";

  const minutos = Math.max(
    0,
    Math.round((new Date(fin) - new Date(inicio)) / 60000)
  );
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const restantes = minutos % 60;

  return [
    dias ? `${dias} día${dias === 1 ? "" : "s"}` : "",
    horas ? `${horas} h` : "",
    `${restantes} min`,
  ].filter(Boolean).join(" ");
}

function adaptarAuditoria(auditoria) {
  const fechaRegistro = mostrarFechaHora(auditoria.creado_en, "");
  const fechaInicio = mostrarFechaHora(auditoria.iniciada_en, "");

  const historial = [{
    fecha: fechaRegistro,
    usuario: auditoria.solicitante,
    comentario: "Registro de la auditoría.",
  }];

  const fechaCierre = mostrarFechaHora(auditoria.cerrada_en, "");
  const fechaInforme = mostrarFechaHora(auditoria.informe_emitido_en, "");

  if (fechaInicio) {
    historial.push({
      fecha: fechaInicio,
      usuario: auditoria.iniciada_por_nombre,
      comentario: "Inicio de ejecución de la auditoría.",
    });
  }

  if (fechaInforme) {
    historial.push({
      fecha: fechaInforme,
      usuario: auditoria.informe_emitido_por_nombre,
      comentario: "Informe emitido. Conclusión: " + auditoria.conclusion,
    });
  }

  if (fechaCierre) {
    historial.push({
      fecha: fechaCierre,
      usuario: auditoria.cerrada_por_nombre,
      comentario: fechaInforme
        ? "Cierre después de emitir el informe y resolver todos los hallazgos."
        : "Cierre registrado antes de separar el informe del seguimiento.",
    });
  }

  return {
    ...auditoria,
    estadoInterno: auditoria.estado,
    titulo: auditoria.nombre,
    area: auditoria.proceso || "Sin proceso vinculado",
    estado: ({
      planeacion: "Planeación",
      ejecucion: "En ejecución",
      en_seguimiento: "En seguimiento",
      cerrada: "Cerrada",
    })[auditoria.estado] || auditoria.estado,
    fechaPlaneacion: fechaRegistro,
    fechaEjecucion: fechaInicio,
    fechaInforme,
    fechaCierre,
    duracion: calcularDuracion(auditoria.iniciada_en, auditoria.cerrada_en),
    cierre: auditoria.cerrada_por_nombre
      ? { personas: [auditoria.cerrada_por_nombre] }
      : null,
    responsablePlaneacion: auditoria.solicitante,
    auditores: [
      `${auditoria.auditor_codigo ? auditoria.auditor_codigo + " · " : ""}${auditoria.auditor}`,
    ],
    historial,
  };
}

async function cargarDatos() {
  if (cargando.value) return;
  cargando.value = true;
  error.value = "";
  try {
    const accionesCorrectivasPromise = tienePermiso(
      auth.usuario,
      "modulo.accionesCorrectivas"
    )
      ? api.get("/acciones-correctivas")
      : Promise.resolve([]);

    const [lista, catalogos, accionesLista] = await Promise.all([
      api.get("/auditorias"),
      api.get("/auditorias/catalogos"),
      accionesCorrectivasPromise,
    ]);
    auditorias.value = lista.map(adaptarAuditoria);
    procesos.value = catalogos.procesos;
    auditores.value = catalogos.auditores;
    responsablesHallazgo.value = catalogos.responsables || [];
    accionesCorrectivas.value = accionesLista || [];
  } catch (e) {
    error.value = e.message || "No se pudieron cargar las auditorías.";
  } finally {
    cargando.value = false;
  }
}

async function abrirReportes() {
  mensaje.value = "";
  vistaActual.value = "reportes";
  await cargarDatos();
}

function volverAlFlujo() {
  mensaje.value = "";
  vistaActual.value = "flujo";
}

async function seleccionarEtapa(etapa) {
  if (etapa === 1) {
    await abrirPlaneacion();
    return;
  }

  tipoMensaje.value = "info";

  if (etapa === 2) {
    mensaje.value = "Abre una auditoría en Planeación y pulsa Iniciar ejecución.";
    await abrirReportes();
    return;
  }

  mensaje.value = etapa === 3
    ? "Abre una auditoría para registrar avances en sus hallazgos."
    : "Abre una auditoría para revisar los avances enviados.";
}

async function abrirPlaneacion() {
  if (!puede("planear")) {
    tipoMensaje.value = "info";
    mensaje.value = "No tienes permiso para planear auditorías.";
    return;
  }
  formulario.value = formularioVacio();
  errorFormulario.value = "";
  mensaje.value = "";
  mostrarPlaneacion.value = true;
  await cargarDatos();
}

function cerrarPlaneacion() {
  if (!guardando.value) mostrarPlaneacion.value = false;
}

async function guardarPlaneacion() {
  if (guardando.value || cargando.value) return;
  const datos = formulario.value;
  if (!datos.nombre.trim() || !datos.alcance.trim() || !datos.proceso_id || !datos.auditor_catalogo_id || !datos.fecha_programada) {
    errorFormulario.value = "Completa nombre, proceso, auditor, fecha programada y alcance.";
    return;
  }
  guardando.value = true;
  errorFormulario.value = "";
  try {
    const nueva = await api.post("/auditorias", {
      ...datos, nombre: datos.nombre.trim(), alcance: datos.alcance.trim(),
      comentarios: datos.comentarios.trim(), proceso_id: Number(datos.proceso_id),
      auditor_catalogo_id: Number(datos.auditor_catalogo_id),
    });
    mostrarPlaneacion.value = false;
    vistaActual.value = "reportes";
    tipoMensaje.value = "exito";
    mensaje.value = `Auditoría AUD-${nueva.id} guardada correctamente en Planeación.`;
    await cargarDatos();
  } catch (e) {
    errorFormulario.value = e.message || "No se pudo guardar la planeación.";
  } finally {
    guardando.value = false;
  }
}

function auditoriaAtrasada(auditoria) {
  return auditoria?.estadoInterno === "planeacion" && estaVencida(auditoria.fecha_programada);
}

function claseEstado(estado) {
  if (["Cerrada", "Cumplido"].includes(estado)) return "auditorias-badge--exito";
  if (["En ejecución", "En seguimiento"].includes(estado)) return "auditorias-badge--proceso";
  if (estado === "Pendiente") return "auditorias-badge--pendiente";
  return "auditorias-badge--neutro";
}

function verReporte(auditoria) {
  errorEjecucion.value = "";
  errorNuevoHallazgo.value = "";
  errorDescarga.value = "";
  archivosHallazgo.value = [];
  claveArchivosHallazgo.value++;
  archivosSeguimiento.value = {};
  nuevoHallazgo.value = {
    descripcion: "",
    criterio: "",
    evidencia_observada: "",
    responsable_id: "",
    norma_id: "",
    criterio_id: "",
  };
  conclusionInforme.value = "";
  errorInforme.value = "";
  auditoriaSeleccionada.value = auditoria;
  mostrarModalReporte.value = true;
}

function cerrarModalReporte() {
  if (iniciandoEjecucion.value || guardandoHallazgo.value ||
    guardandoSeguimiento.value || enviandoRevisionHallazgo.value ||
    revisandoHallazgo.value || finalizandoInforme.value) return;

  mostrarModalReporte.value = false;
  auditoriaSeleccionada.value = null;
}

async function iniciarEjecucion() {
  const auditoria = auditoriaSeleccionada.value;

  if (
    iniciandoEjecucion.value ||
    !auditoria ||
    auditoria.estadoInterno !== "planeacion" ||
    !puede("iniciar")
  ) {
    return;
  }

  if (!await confirmarAccion({ titulo: 'Iniciar auditoría', mensaje: `¿Iniciar la ejecución de AUD-${auditoria.id}?`, confirmarTexto: 'Iniciar ejecución' })) {
    return;
  }

  iniciandoEjecucion.value = true;
  errorEjecucion.value = "";

  try {
    await api.post(`/auditorias/${auditoria.id}/iniciar-ejecucion`, {});

    tipoMensaje.value = "exito";
    mensaje.value = `Auditoría AUD-${auditoria.id} iniciada correctamente.`;

    await cargarDatos();

    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;

    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorEjecucion.value = e.message || "No se pudo iniciar la ejecución.";
  } finally {
    iniciandoEjecucion.value = false;
  }
}

function validarArchivos(archivos) {
  const extensiones = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g)$/i;
  if (archivos.length > 5 || archivos.some(archivo =>
    !archivo.size || archivo.size > 25 * 1024 * 1024 ||
    !extensiones.test(archivo.name) || archivo.name.length > 255)) {
    return "Selecciona hasta 5 archivos no vacíos, de formatos permitidos y de máximo 25 MB cada uno.";
  }
  return "";
}

function seleccionarArchivosHallazgo(evento) {
  const archivos = Array.from(evento.target.files || []);
  errorNuevoHallazgo.value = validarArchivos(archivos);
  archivosHallazgo.value = errorNuevoHallazgo.value ? [] : archivos;
  if (errorNuevoHallazgo.value) evento.target.value = "";
}

function seleccionarArchivosSeguimiento(hallazgoId, evento) {
  const archivos = Array.from(evento.target.files || []);
  errorSeguimiento.value = validarArchivos(archivos);
  archivosSeguimiento.value[hallazgoId] = errorSeguimiento.value ? [] : archivos;
  if (errorSeguimiento.value) evento.target.value = "";
}

async function descargarArchivoHallazgo(hallazgoId, archivo) {
  if (descargandoArchivo.value !== null) return;
  descargandoArchivo.value = archivo.id;
  errorDescarga.value = "";
  let url;

  try {
    const blob = await api.getBlob(
      `/auditorias/${auditoriaSeleccionada.value.id}/hallazgos/${hallazgoId}/archivos/${archivo.id}`
    );
    url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = archivo.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } catch (e) {
    errorDescarga.value = e.message || "No se pudo descargar el archivo.";
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    descargandoArchivo.value = null;
  }
}

async function finalizarInforme() {
  const auditoria = auditoriaSeleccionada.value;
  const conclusion = conclusionInforme.value.trim();

  if (finalizandoInforme.value || cargando.value || !auditoria ||
    auditoria.estadoInterno !== "ejecucion" ||
    !puede("finalizarInforme")) return;

  if (!conclusion) {
    errorInforme.value = "Escribe la conclusión antes de emitir el informe.";
    return;
  }

  const pendientes = auditoria.hallazgos?.filter(hallazgo => hallazgo.estado !== "cerrado").length || 0;
  const pregunta = pendientes
    ? `¿Emitir el informe de AUD-${auditoria.id}? ${pendientes} hallazgo(s) seguirán pendientes y ya no podrás registrar nuevos.`
    : `¿Emitir el informe de AUD-${auditoria.id}? Como no quedan hallazgos pendientes, la auditoría se cerrará.`;

  if (!await confirmarAccion({ titulo: 'Emitir informe', mensaje: pregunta, confirmarTexto: 'Emitir informe' })) return;

  finalizandoInforme.value = true;
  errorInforme.value = "";

  try {
    const resultado = await api.post(`/auditorias/${auditoria.id}/finalizar-informe`, { conclusion });
    conclusionInforme.value = "";
    tipoMensaje.value = "exito";
    mensaje.value = resultado.estado === "cerrada"
      ? `Informe emitido y AUD-${auditoria.id} cerrada: no hay hallazgos pendientes.`
      : `Informe emitido. AUD-${auditoria.id} continúa En seguimiento hasta resolver los hallazgos.`;

    await cargarDatos();
    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;
    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorInforme.value = e.message || "No se pudo emitir el informe.";
  } finally {
    finalizandoInforme.value = false;
  }
}

function nombreEstadoHallazgo(estado) {
  return ({
    abierto: "Abierto",
    en_revision: "En revisión",
    cerrado: "Cerrado",
  })[estado] || estado;
}

function nombreEstadoAccion(estado) {
  return ({
    propuesta: "Levantada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    en_seguimiento: "En seguimiento",
    en_revision: "En revisión",
    cerrada: "Cerrada",
  })[estado] || estado || "Sin estado";
}

function claseEstadoHallazgo(estado) {
  return ({
    abierto: 'auditorias-badge--pendiente',
    en_revision: 'auditorias-badge--proceso',
    cerrado: 'auditorias-badge--exito',
  })[estado] || 'auditorias-badge--neutro';
}

function claseEstadoAccion(estado) {
  return ({
    propuesta: 'auditorias-badge--pendiente',
    aceptada: 'auditorias-badge--exito',
    rechazada: 'auditorias-badge--rechazo',
    en_seguimiento: 'auditorias-badge--proceso',
    en_revision: 'auditorias-badge--proceso',
    cerrada: 'auditorias-badge--exito',
  })[estado] || 'auditorias-badge--neutro';
}

function accionesDisponiblesParaHallazgo(hallazgo) {
  const procesoId = Number(auditoriaSeleccionada.value?.proceso_id);

  return accionesCorrectivas.value.filter(accion =>
    Number(accion.proceso_id) === procesoId &&
    (accion.hallazgo_id === null || accion.hallazgo_id === undefined)
  );
}

async function vincularAccionExistente(hallazgo) {
  const auditoria = auditoriaSeleccionada.value;
  const accionId = Number(accionesElegidasPorHallazgo.value[hallazgo.id]);

  if (!auditoria || !Number.isSafeInteger(accionId) || accionId <= 0) {
    errorSeguimiento.value = "Selecciona una acción correctiva válida.";
    return;
  }

  vinculandoAccion.value = true;
  errorSeguimiento.value = "";

  try {
    await api.patch(`/acciones-correctivas/${accionId}/hallazgo`, {
      hallazgo_id: Number(hallazgo.id),
    });

    tipoMensaje.value = "exito";
    mensaje.value = `La acción AC-${accionId} quedó vinculada con HAL-${hallazgo.id}.`;

    await cargarDatos();

    const auditoriaActualizada =
      auditorias.value.find(item => item.id === auditoria.id) || null;

    auditoriaSeleccionada.value = auditoriaActualizada;
    mostrarModalReporte.value = !!auditoriaActualizada;
  } catch (e) {
    errorSeguimiento.value = e.message || "No se pudo vincular la acción.";
  } finally {
    vinculandoAccion.value = false;
  }
}

function fechaHoyLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function abrirModalAccion(hallazgo) {
  if (!tienePermiso(auth.usuario, "accionesCorrectivas.levantar")) return;

  hallazgoParaAccion.value = hallazgo;
  formAccionHallazgo.value = {
    titulo: `Acción correctiva por HAL-${hallazgo.id}`,
    descripcion: "",
    responsableId: String(hallazgo.responsable_id || ""),
    tipoHallazgo: "",
    fechaOcurrencia: fechaHoyLocal(),
    fechaCompromiso: "",
  };
  errorAccionHallazgo.value = "";
  mostrarModalAccion.value = true;
}

function cerrarModalAccion() {
  if (guardandoAccion.value) return;
  mostrarModalAccion.value = false;
  hallazgoParaAccion.value = null;
}

async function guardarAccionDesdeHallazgo() {
  if (guardandoAccion.value || !hallazgoParaAccion.value || !auditoriaSeleccionada.value) return;

  const hallazgo = hallazgoParaAccion.value;
  const auditoria = auditoriaSeleccionada.value;
  const formulario = formAccionHallazgo.value;

  if (
    !formulario.titulo.trim() ||
    !formulario.descripcion.trim() ||
    !formulario.responsableId ||
    !formulario.tipoHallazgo ||
    !formulario.fechaOcurrencia
  ) {
    errorAccionHallazgo.value = "Completa los campos obligatorios.";
    return;
  }

  guardandoAccion.value = true;
  errorAccionHallazgo.value = "";

  try {
    const nueva = await api.post("/acciones-correctivas", {
      hallazgo_id: Number(hallazgo.id),
      titulo: formulario.titulo.trim(),
      descripcion: formulario.descripcion.trim(),
      proceso_id: Number(auditoria.proceso_id),
      responsable_id: Number(formulario.responsableId),
      tipo: "Correctiva",
      tipo_hallazgo: formulario.tipoHallazgo,
      afecta_otros_procesos: false,
      procesos_afectados: [],
      origen: `Auditoría AUD-${auditoria.id}, hallazgo HAL-${hallazgo.id}`,
      fecha_ocurrencia: formulario.fechaOcurrencia,
      fecha_compromiso: formulario.fechaCompromiso || null,
    });

    mostrarModalAccion.value = false;
    tipoMensaje.value = "exito";
    mensaje.value = `Acción AC-${nueva.id} creada y vinculada con HAL-${hallazgo.id}.`;

    await cargarDatos();

    const auditoriaActualizada = auditorias.value.find(item => item.id === auditoria.id) || null;
    auditoriaSeleccionada.value = auditoriaActualizada;
    mostrarModalReporte.value = !!auditoriaActualizada;
  } catch (e) {
    errorAccionHallazgo.value = e.message || "No se pudo crear la acción correctiva.";
  } finally {
    guardandoAccion.value = false;
  }
}

async function guardarHallazgo() {
  const auditoria = auditoriaSeleccionada.value;
  const datos = nuevoHallazgo.value;

  if (
    guardandoHallazgo.value ||
    cargando.value ||
    !auditoria ||
    auditoria.estadoInterno !== "ejecucion" ||
    !puede("hallazgos")
  ) {
    return;
  }

  if (!datos.descripcion.trim() || !datos.criterio.trim() ||
    !datos.evidencia_observada.trim() || !datos.responsable_id) {
    errorNuevoHallazgo.value = "Completa la descripción, el criterio, la evidencia observada y el responsable.";
    return;
  }

  guardandoHallazgo.value = true;
  errorNuevoHallazgo.value = "";

  try {
    const formulario = new FormData();
    formulario.append("descripcion", datos.descripcion.trim());
    formulario.append("criterio", datos.criterio.trim());
    formulario.append("norma_id", datos.norma_id || "");
    formulario.append("criterio_id", datos.criterio_id || "");
    formulario.append("evidencia_observada", datos.evidencia_observada.trim());
    formulario.append("responsable_id", String(datos.responsable_id));
    archivosHallazgo.value.forEach(archivo => formulario.append("archivos", archivo));

    const hallazgo = await api.postForm(
      `/auditorias/${auditoria.id}/hallazgos`,
      formulario
    );

    nuevoHallazgo.value = {
      descripcion: "",
      criterio: "",
      evidencia_observada: "",
      responsable_id: "",
      norma_id: "",
      criterio_id: "",
    };
    archivosHallazgo.value = [];
    claveArchivosHallazgo.value++;

    tipoMensaje.value = "exito";
    mensaje.value = `Hallazgo HAL-${hallazgo.id} guardado correctamente en AUD-${auditoria.id}.`;

    await cargarDatos();

    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;

    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorNuevoHallazgo.value = e.message || "No se pudo guardar el hallazgo.";
  } finally {
    guardandoHallazgo.value = false;
  }
}

function puedeDarSeguimiento(hallazgo) {
  return ["ejecucion", "en_seguimiento"].includes(auditoriaSeleccionada.value?.estadoInterno) &&
    hallazgo.estado === "abierto" &&
    Number(hallazgo.responsable_id) === Number(auth.usuario?.id);
}

async function guardarSeguimiento(hallazgo) {
  const auditoria = auditoriaSeleccionada.value;
  const comentario = comentariosSeguimiento.value[hallazgo.id]?.trim();

  if (guardandoSeguimiento.value || !puedeDarSeguimiento(hallazgo)) return;

  if (!comentario) {
    errorSeguimiento.value = "Escribe qué hiciste antes de guardar.";
    return;
  }

  guardandoSeguimiento.value = true;
  errorSeguimiento.value = "";

  try {
    const formulario = new FormData();
    formulario.append("comentario", comentario);
    (archivosSeguimiento.value[hallazgo.id] || [])
      .forEach(archivo => formulario.append("archivos", archivo));

    await api.postForm(
      `/auditorias/${auditoria.id}/hallazgos/${hallazgo.id}/seguimientos`,
      formulario
    );

    comentariosSeguimiento.value[hallazgo.id] = "";
    archivosSeguimiento.value[hallazgo.id] = [];
    claveArchivosSeguimiento.value[hallazgo.id] = (claveArchivosSeguimiento.value[hallazgo.id] || 0) + 1;
    tipoMensaje.value = "exito";
    mensaje.value = `Avance guardado en HAL-${hallazgo.id}.`;

    await cargarDatos();

    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;

    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorSeguimiento.value = e.message || "No se pudo guardar el avance.";
  } finally {
    guardandoSeguimiento.value = false;
  }
}

async function enviarHallazgoARevision(hallazgo) {
  const auditoria = auditoriaSeleccionada.value;

  if (enviandoRevisionHallazgo.value ||
    guardandoSeguimiento.value ||
    !puedeDarSeguimiento(hallazgo) ||
    !hallazgo.seguimientos?.length) {
    return;
  }

  if (!await confirmarAccion({
    titulo: 'Enviar hallazgo a revisión',
    mensaje: `¿Enviar HAL-${hallazgo.id} a revisión? Ya no podrás agregar avances mientras esté en revisión.`,
    confirmarTexto: 'Enviar a revisión',
  })) {
    return;
  }

  enviandoRevisionHallazgo.value = true;
  errorSeguimiento.value = "";

  try {
    await api.post(
      `/auditorias/${auditoria.id}/hallazgos/${hallazgo.id}/enviar-revision`,
      {}
    );

    tipoMensaje.value = "exito";
    mensaje.value = `HAL-${hallazgo.id} fue enviado a revisión.`;

    await cargarDatos();

    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;

    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorSeguimiento.value = e.message || "No se pudo enviar el hallazgo a revisión.";
  } finally {
    enviandoRevisionHallazgo.value = false;
  }
}

function puedeRevisarHallazgo(hallazgo) {
  const esAdmin = auth.usuario?.rol_clave === "admin_general";
  const esSuyo = Number(hallazgo.responsable_id) === Number(auth.usuario?.id);
  return puede("hallazgos") &&
    (esAdmin || !esSuyo) &&
    ["ejecucion", "en_seguimiento"].includes(auditoriaSeleccionada.value?.estadoInterno) &&
    hallazgo.estado === "en_revision";
}

async function revisarHallazgo(hallazgo, decision) {
  const auditoria = auditoriaSeleccionada.value;
  const comentario = comentariosRevisionHallazgo.value[hallazgo.id]?.trim() || "";

  if (revisandoHallazgo.value || !puedeRevisarHallazgo(hallazgo)) return;

  if (decision === "correcciones" && !comentario) {
    errorSeguimiento.value = "Escribe qué debe corregirse antes de continuar.";
    return;
  }

  const pregunta = decision === "aceptar"
    ? `¿Aceptar el avance y cerrar HAL-${hallazgo.id}?`
    : `¿Devolver HAL-${hallazgo.id} al responsable para correcciones?`;

  if (!await confirmarAccion({ titulo: decision === 'aceptar' ? 'Aceptar avance' : 'Solicitar correcciones', mensaje: pregunta, confirmarTexto: decision === 'aceptar' ? 'Aceptar avance' : 'Devolver hallazgo' })) return;

  revisandoHallazgo.value = true;
  errorSeguimiento.value = "";

  try {
    const resultado = await api.post(
      `/auditorias/${auditoria.id}/hallazgos/${hallazgo.id}/revision`,
      { decision, comentario }
    );

    comentariosRevisionHallazgo.value[hallazgo.id] = "";
    tipoMensaje.value = "exito";
    mensaje.value = decision === "aceptar"
      ? resultado.auditoria_cerrada
        ? `HAL-${hallazgo.id} y AUD-${auditoria.id} fueron cerrados.`
        : `HAL-${hallazgo.id} fue aceptado y cerrado.`
      : `HAL-${hallazgo.id} volvió a Abierto para correcciones.`;

    await cargarDatos();

    auditoriaSeleccionada.value = error.value
      ? null
      : auditorias.value.find(item => item.id === auditoria.id) || null;

    mostrarModalReporte.value = !!auditoriaSeleccionada.value;
  } catch (e) {
    errorSeguimiento.value = e.message || "No se pudo revisar el hallazgo.";
  } finally {
    revisandoHallazgo.value = false;
  }
}

onMounted(cargarDatos);
</script>

<style>
@import '@/assets/styles/Auditorias.css';
</style>

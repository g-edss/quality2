<template>
  <section class="acciones-page">

    <p v-if="error" class="acciones-aviso acciones-aviso--error" role="alert">{{ error }}</p>
    <p v-if="mensaje" class="acciones-aviso" :class="`acciones-aviso--${tipoMensaje}`" role="status">{{ mensaje }}</p>
    <p v-if="cargando">Cargando acciones y catálogos…</p>
    <div class="acciones-page__top">
      <div>
        <h1 class="acciones-page__title">Acciones Correctivas</h1>
        <p class="pagina-subtitulo">Levanta acciones, da seguimiento a los avances y revisa que queden resueltas.</p>
      </div>
    </div>

    <div class="acciones-card">

      <div class="acciones-card__actions">

        <button v-if="puede('levantar')" class="acciones-btn" @click="abrirModalGeneral">
          <span>+</span>
          Acciones correctivas generales
        </button>

        <button v-if="puede('modificar')" class="acciones-btn" @click="abrirModificar">
          <span>✎</span>
          Modificar acciones
        </button>

        <button v-if="vistaActual === 'flujo' && puede('reportes')" class="acciones-btn" @click="abrirReportes">
          <span>▥</span>
          Reportes
        </button>

        <button v-if="vistaActual !== 'flujo'" class="acciones-btn" @click="volverAlFlujo">
          <span>←</span>
          Volver al flujo
        </button>

      </div>

      <template v-if="vistaActual === 'flujo'">

        <h2 class="acciones-flow__title">
          Flujo de la aplicación
        </h2>

        <div class="acciones-flow">

          <div class="acciones-flow__col">
            <button class="acciones-step acciones-step--arrow" :class="{ 'acciones-step--active': etapaActiva === 1 }"
              @mouseenter="etapaActiva = 1" @mouseleave="etapaActiva = null" :disabled="!puede('levantar')"
              :title="puede('levantar') ? '' : 'No tienes permiso para levantar acciones correctivas'"
              @click="seleccionarEtapa(1)">
              <span class="acciones-step__text">
                Levantar acción<br>
                correctiva
              </span>
            </button>

            <span class="acciones-connector">
              <span class="acciones-connector__line"></span>
              <span class="acciones-connector__dot"></span>
            </span>

            <span class="acciones-flow__role">Administrador</span>
          </div>

          <span class="acciones-flow__arrow">→</span>

          <div class="acciones-flow__col">
            <button class="acciones-step acciones-step--arrow acciones-step--current"
              :class="{ 'acciones-step--active': etapaActiva === 2 }" @mouseenter="etapaActiva = 2"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(2)">
              <span class="acciones-step__text">
                Seguimiento a<br>
                acción correctiva
              </span>
            </button>

            <span class="acciones-connector">
              <span class="acciones-connector__line"></span>
              <span class="acciones-connector__dot"></span>
            </span>

            <span class="acciones-flow__role">Responsable</span>
          </div>

          <span class="acciones-flow__arrow">→</span>

          <div class="acciones-flow__col">
            <button class="acciones-step acciones-step--decision"
              :class="{ 'acciones-step--active': etapaActiva === 3 }" @mouseenter="etapaActiva = 3"
              @mouseleave="etapaActiva = null" @click="seleccionarEtapa(3)">
              <span class="acciones-step__text">
                Revisar<br>
                acciones
              </span>
            </button>

            <span class="acciones-connector">
              <span class="acciones-connector__line"></span>
              <span class="acciones-connector__dot"></span>
            </span>

            <span class="acciones-flow__role">Administrador</span>
          </div>

          <span class="acciones-flow__arrow">→</span>

          <div class="acciones-flow__col">
            <div class="acciones-finish">
              <strong>Acción cerrada</strong>
              <span>
                Una vez aceptada se
                cerrará la acción de
                manera automática
              </span>
            </div>
          </div>

        </div>

      </template>

      <template v-else>

        <h2 class="acciones-flow__title">
          {{ tituloLista }}
        </h2>

        <div class="acciones-filtros">
          <div class="acciones-field">
            <label class="acciones-field__label" for="buscar-acciones">Buscar</label>
            <input id="buscar-acciones" v-model="filtrosReporte.busqueda" class="acciones-input" type="search"
              placeholder="ID, título, proceso, solicitante o responsable">
          </div>
          <div class="acciones-field">
            <label class="acciones-field__label" for="estado-acciones">Estado</label>
            <select id="estado-acciones" v-model="filtrosReporte.estado" class="acciones-select">
              <option value="">Todos</option>
              <option v-for="estado in estadosReporte" :key="estado" :value="estado">{{ nombreEstado(estado) }}</option>
            </select>
          </div>
          <div class="acciones-field">
            <label class="acciones-field__label" for="proceso-acciones">Proceso</label>
            <select id="proceso-acciones" v-model="filtrosReporte.proceso" class="acciones-select">
              <option value="">Todos</option>
              <option v-for="proceso in procesosReporte" :key="proceso.id" :value="proceso.id">{{ proceso.nombre }}
              </option>
            </select>
          </div>
          <div class="acciones-field">
            <label class="acciones-field__label" for="responsable-acciones">Responsable</label>
            <select id="responsable-acciones" v-model="filtrosReporte.responsable" class="acciones-select">
              <option value="">Todos</option>
              <option v-for="responsable in responsablesReporte" :key="responsable.id" :value="responsable.id">{{
                responsable.nombre }}</option>
            </select>
          </div>
        </div>
        <div class="acciones-reporte-herramientas">
          <button class="acciones-btn" @click="limpiarFiltros">Limpiar filtros</button>
          <button class="acciones-btn" :disabled="cargando" @click="cargarDatos">Actualizar lista</button>
          <button v-if="puede('reportes')" class="acciones-btn-save"
            :disabled="cargando || !!error || !accionesVisibles.length" @click="descargarReporteCsv">Descargar reporte
            CSV</button>
        </div>
        <p role="status">Mostrando {{ accionesVisibles.length }} de {{ accionesDeEtapa.length }} acciones de esta lista.
        </p>
        <p v-if="!cargando && !accionesVisibles.length">No hay acciones que coincidan con los filtros.</p>
        <div class="acciones-reportes-list">
          <button v-for="accion in accionesVisibles" :key="accion.id" class="acciones-reportes-item"
            @click="filtroEtapa === 'modificar' ? abrirEdicion(accion) : verReporte(accion)">
            <div class="acciones-reportes-item__main">
              <strong>AC-{{ accion.id }} · {{ accion.titulo }}</strong>
              <span class="acciones-reportes-item__area">{{ accion.area || 'Sin área asignada' }}</span>
              <span class="acciones-reportes-item__area">Responsable: {{ accion.responsableSeguimiento }}</span>
            </div>

            <div class="acciones-reportes-item__meta">
              <span class="acciones-badge" :class="claseEstado(accion.estado)">
                {{ accion.estado }}
              </span>
              <span v-if="accionVencida(accion)" class="acciones-badge acciones-badge--rechazo">
                {{ textoAtraso(accion.fecha_compromiso, 'Vencida') }}
              </span>
              <span class="acciones-reportes-item__fecha">
                {{ accion.fechaLevantamiento || 'Sin fecha' }}
              </span>
              <span class="acciones-reportes-item__arrow">›</span>
            </div>
          </button>
        </div>

      </template>

    </div>

    <div v-if="mostrarModalGeneral" class="acciones-modal-overlay" @click.self="cerrarModalGeneral">
      <div class="acciones-modal">

        <div class="acciones-modal__header">
          <h3 class="acciones-modal__title">
            {{ accionEditandoId ? `Modificar AC-${accionEditandoId}` : 'Nueva acción correctiva' }}
          </h3>
          <button class="acciones-modal__close" aria-label="Cerrar" @click="cerrarModalGeneral">×</button>
        </div>

        <div class="acciones-modal__body">
          <p v-if="errorFormulario" class="acciones-aviso acciones-aviso--error" role="alert">{{ errorFormulario }}</p>
          <p>Obligatorios: título, proceso, responsable, fecha de ocurrencia y descripción.</p>
          <div class="acciones-field">
            <label class="acciones-field__label" for="accion-titulo">Título de la acción</label>
            <input id="accion-titulo" v-model="formGeneral.titulo" maxlength="200" type="text" class="acciones-input"
              placeholder="Ej. Corregir folio faltante en registros">
          </div>

          <div class="acciones-modal__row">
            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-proceso">Área / proceso relacionado</label>
              <select id="accion-proceso" v-model="formGeneral.procesoId" class="acciones-select" :disabled="!!accionEditandoId"
                @change="actualizarProcesoPrincipal">
                <option value="" disabled>Selecciona un proceso</option>
                <option v-for="proceso in procesos" :key="proceso.id" :value="proceso.id">{{ proceso.nombre }}</option>
              </select>
            </div>

            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-tipo">Tipo</label>
              <select id="accion-tipo" v-model="formGeneral.tipo" class="acciones-select">
                <option value="Correctiva">Correctiva</option>
                <option value="Preventiva">Preventiva</option>
              </select>
            </div>
          </div>

          <div class="acciones-modal__row">
            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-tipo-hallazgo">Tipo de hallazgo *</label>
              <select id="accion-tipo-hallazgo" v-model="formGeneral.tipoHallazgo" class="acciones-select">
                <option value="No Conformidad mayor">No Conformidad mayor</option>
                <option value="No Conformidad menor">No Conformidad menor</option>
                <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                <option value="Fortaleza">Fortaleza</option>
              </select>
            </div>

            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-fecha-ocurrencia">Fecha de ocurrencia *</label>
              <input id="accion-fecha-ocurrencia" v-model="formGeneral.fechaOcurrencia" type="date" class="acciones-input">
              <label class="acciones-field__label" for="accion-fecha-compromiso">Fecha compromiso (opcional)</label>
              <input id="accion-fecha-compromiso" v-model="formGeneral.fechaCompromiso" type="date" class="acciones-input">
            </div>
          </div>

          <div class="acciones-field">
            <label class="acciones-field__label" for="accion-afecta">¿Afecta otros procesos? *</label>
            <select id="accion-afecta" v-model="formGeneral.afectaOtrosProcesos" class="acciones-select" :disabled="!!accionEditandoId"
              @change="actualizarAfectacion">
              <option :value="false">No</option>
              <option :value="true">Sí</option>
            </select>
          </div>

          <div v-if="formGeneral.afectaOtrosProcesos" class="acciones-field">
            <span class="acciones-field__label">Procesos afectados *</span>

            <div class="acciones-procesos-checklist">
              <label v-for="proceso in procesos.filter(
                item => String(item.id) !== String(formGeneral.procesoId)
              )" :key="proceso.id" class="acciones-procesos-checklist__item">
                <input v-model="formGeneral.procesosAfectados" type="checkbox" :value="Number(proceso.id)"
                  :disabled="!!accionEditandoId">
                <span>{{ proceso.nombre }}</span>
              </label>

              <p v-if="!procesos.some(
                item => String(item.id) !== String(formGeneral.procesoId)
              )" class="acciones-procesos-checklist__empty">
                No hay otros procesos activos disponibles.
              </p>
            </div>
          </div>

          <div class="acciones-modal__row">
            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-levanta">Responsable de levantamiento</label>
              <input id="accion-levanta" :value="accionEditandoId ? formGeneral.solicitante : (auth.usuario?.nombre || 'Usuario actual')"
                readonly type="text" class="acciones-input">
            </div>

            <div class="acciones-field">
              <label class="acciones-field__label" for="accion-responsable">Responsable de seguimiento</label>
              <select id="accion-responsable" v-model="formGeneral.responsableId" class="acciones-select">
                <option value="" disabled>Selecciona un responsable</option>
                <option v-for="usuario in responsables" :key="usuario.id" :value="usuario.id">{{ usuario.nombre }}
                </option>
              </select>
            </div>
          </div>

          <div class="acciones-field">
            <label class="acciones-field__label" for="accion-origen">Origen / hallazgo relacionado</label>
            <textarea id="accion-origen" v-model="formGeneral.origen" maxlength="5000" class="acciones-textarea"
              placeholder="¿De dónde surge esta acción? (auditoría, riesgo, queja, etc.)"></textarea>
          </div>

          <div class="acciones-field">
            <label class="acciones-field__label" for="accion-descripcion">Descripción / plan de acción</label>
            <textarea id="accion-descripcion" v-model="formGeneral.descripcion" maxlength="10000" class="acciones-textarea"
              placeholder="Describe qué se va a hacer para corregir el problema"></textarea>
          </div>

        </div>

        <div class="acciones-modal__footer">
          <button class="acciones-btn-cancel" @click="cerrarModalGeneral">Cancelar</button>
          <button class="acciones-btn-save" :disabled="guardando ||
            cargando ||
            !formGeneral.titulo.trim() ||
            !formGeneral.procesoId ||
            !formGeneral.responsableId ||
            !formGeneral.fechaOcurrencia ||
            !formGeneral.descripcion.trim() ||
            (formGeneral.afectaOtrosProcesos && !formGeneral.procesosAfectados.length)
            " @click="accionEditandoId ? guardarCambiosAccion() : guardarAccionGeneral()">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>

      </div>
    </div>

    <div v-if="mostrarModalReporte && accionSeleccionada" class="acciones-modal-overlay"
      @click.self="cerrarModalReporte">
      <div class="acciones-modal">

        <div class="acciones-modal__header">
          <h3 class="acciones-modal__title">Reporte de acción correctiva</h3>
          <button class="acciones-modal__close" aria-label="Cerrar" @click="cerrarModalReporte">×</button>
        </div>

        <div class="acciones-modal__body">

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Título de la acción</span>
            <span class="acciones-report-field__value acciones-report-field__value--big">
              {{ accionSeleccionada.titulo }}
            </span>
          </div>

          <div class="acciones-report-row">
            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Área / proceso</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.area || 'Sin registrar' }}</span>
            </div>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Estado</span>
              <span class="acciones-badge" :class="claseEstado(accionSeleccionada.estado)">
                {{ accionSeleccionada.estado }}
              </span>
            </div>
          </div>

          <div class="acciones-report-row">
            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Tipo</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.tipo || 'Sin registrar' }}</span>
            </div>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Tipo de hallazgo</span>
              <span class="acciones-report-field__value">
                {{ accionSeleccionada.tipo_hallazgo || 'Sin clasificar' }}
              </span>
            </div>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">¿Afecta otros procesos?</span>
              <span class="acciones-report-field__value">
                {{ accionSeleccionada.afecta_otros_procesos ? 'Sí' : 'No' }}
              </span>
              <ul v-if="accionSeleccionada.procesos_afectados?.length">
                <li v-for="proceso in accionSeleccionada.procesos_afectados" :key="proceso.id">
                  {{ proceso.nombre }}
                </li>
              </ul>
              <span v-else class="acciones-report-field__value acciones-report-field__value--muted">
                Sin otros procesos registrados
              </span>
            </div>
          </div>

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Origen / hallazgo relacionado</span>
            <span class="acciones-report-field__value">
              {{ accionSeleccionada.origen || 'Sin registrar' }}
            </span>
          </div>

          <div class="acciones-report-row">
            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Responsable de levantamiento</span>
              <span class="acciones-report-field__value">
                {{ accionSeleccionada.responsableLevantamiento || 'Sin registrar' }}
              </span>
            </div>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Responsable de seguimiento</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.responsableSeguimiento || 'Sin registrar'
              }}</span>
            </div>
          </div>

          <div class="acciones-report-row">
            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Fecha de levantamiento</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.fechaLevantamiento || 'Sin registrar'
              }}</span>
            </div>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Fecha compromiso</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.fechaCompromiso || 'Sin registrar'
              }}</span>
              <span v-if="accionVencida(accionSeleccionada)" class="acciones-badge acciones-badge--rechazo">
                {{ textoAtraso(accionSeleccionada.fecha_compromiso, 'Vencida') }}
              </span>
            </div>
          </div>

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Fecha de ocurrencia</span>
            <span class="acciones-report-field__value">{{ mostrarFecha(accionSeleccionada.fecha_ocurrencia,
              'Sin registrar') }}</span>
          </div>

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Descripción / plan de acción</span>
            <span class="acciones-report-field__value">
              {{ accionSeleccionada.descripcion || 'Sin registrar' }}
            </span>
          </div>

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Seguimientos</span>
            <p v-if="errorDescarga" class="acciones-aviso acciones-aviso--error" role="alert">{{ errorDescarga }}</p>

            <div v-if="accionSeleccionada.seguimientos && accionSeleccionada.seguimientos.length"
              class="acciones-report-seguimientos">
              <article v-for="(item, index) in accionSeleccionada.seguimientos" :key="index"
                class="acciones-report-seguimiento">
                <div class="acciones-report-seguimiento__cabecera">
                  <strong>{{ nombreEvento(item.tipo) }}</strong>
                  <span class="acciones-badge" :class="claseEstado(nombreEstado(item.estado))">{{
                    nombreEstado(item.estado)
                  }}</span>
                </div>
                <small>{{ formatearFechaHora(item.fecha) }} · {{ item.usuario }}</small>
                <p>{{ item.comentario || 'Sin comentario' }}</p>
                <div v-for="evidencia in item.evidencias || []" :key="evidencia.id" class="acciones-evidencia">
                  <button class="acciones-btn-cancel" :disabled="descargandoEvidencia !== null"
                    @click="descargarEvidencia(evidencia)">
                    {{ descargandoEvidencia === evidencia.id ? 'Descargando…' : evidencia.nombre }}
                  </button>
                  <small>{{ formatearTamano(evidencia.tamano_bytes) }} · Subida por {{ item.usuario }} · {{
                    formatearFechaHora(evidencia.fecha) }}</small>
                </div>
              </article>
            </div>
            <span v-else class="acciones-report-field__value acciones-report-field__value--muted">
              Todavía no se han registrado avances.
            </span>
          </div>

          <div class="acciones-report-field">
            <span class="acciones-report-field__label">Comentarios generales</span>
            <span class="acciones-report-field__value">
              {{ accionSeleccionada.comentarios || 'Sin registrar' }}
            </span>
          </div>

          <div v-if="accionSeleccionada.archivos && accionSeleccionada.archivos.length" class="acciones-report-field">
            <span class="acciones-report-field__label">Archivos adjuntos</span>

            <div class="acciones-report-files">
              <span v-for="archivo in accionSeleccionada.archivos" :key="archivo" class="acciones-report-file">
                📎 {{ archivo }}
              </span>
            </div>
          </div>

          <div v-if="accionSeleccionada.estado === 'Cerrada'"
            class="acciones-report-field acciones-report-field--closure">
            <span class="acciones-report-field__label">Información de cierre</span>

            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Fecha de cierre</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.fechaCierre || 'Sin registrar' }}</span>
            </div>
            <div class="acciones-report-field">
              <span class="acciones-report-field__label">Aceptada y cerrada por</span>
              <span class="acciones-report-field__value">{{ accionSeleccionada.cerrado_por_nombre || 'Sin registrar'
              }}</span>
            </div>
          </div>

          <div v-if="puedeDarSeguimiento(accionSeleccionada)" class="acciones-field">
            <label class="acciones-field__label" for="avance-accion">Registrar seguimiento *</label>
            <p>Describe qué hiciste. Puedes guardar varios avances y enviarla a revisión cuando termines.</p>
            <textarea id="avance-accion" v-model="comentarioSeguimiento" class="acciones-textarea" maxlength="10000"
              :disabled="guardandoSeguimiento"
              placeholder="Describe las actividades realizadas y sus resultados"></textarea>
            <label class="acciones-field__label" for="evidencias-accion">Evidencias (opcionales)</label>
            <input :key="claveEvidencias" id="evidencias-accion" type="file" multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" :disabled="guardandoSeguimiento"
              @change="seleccionarEvidencias">
            <p>Hasta 5 archivos por avance, máximo 25 MB cada uno. PDF, Word, Excel, PowerPoint, PNG o JPEG.</p>
            <ul v-if="archivosSeguimiento.length">
              <li v-for="(archivo, indice) in archivosSeguimiento" :key="indice">{{ archivo.name }} · {{
                formatearTamano(archivo.size) }}</li>
            </ul>
            <p v-if="errorSeguimiento" class="acciones-aviso acciones-aviso--error" role="alert">{{ errorSeguimiento }}
            </p>
            <div class="acciones-modal__footer">
              <button class="acciones-btn-save" :disabled="guardandoSeguimiento || !comentarioSeguimiento.trim()"
                @click="guardarSeguimiento(false)">Guardar avance</button>
              <button class="acciones-btn-save" :disabled="guardandoSeguimiento || !comentarioSeguimiento.trim()"
                @click="guardarSeguimiento(true)">Enviar a revisión</button>
            </div>
            <p v-if="guardandoSeguimiento" role="status">Guardando seguimiento…</p>
          </div>
          <p v-else-if="accionSeleccionada.estadoInterno === 'en_revision' && !puedeRevisar(accionSeleccionada)">Enviada
            a
            revisión.</p>

          <div v-if="puedeRevisar(accionSeleccionada)" class="acciones-field">
            <label class="acciones-field__label" for="revision-accion">Revisión del administrador</label>
            <p>Aceptar cierra la acción. Para devolverla, explica qué debe corregir el responsable.</p>
            <textarea id="revision-accion" v-model="comentarioRevision" class="acciones-textarea" maxlength="10000"
              :disabled="guardandoRevision"
              placeholder="Comentario opcional al aceptar; obligatorio al solicitar correcciones"></textarea>
            <p v-if="errorRevision" class="acciones-aviso acciones-aviso--error" role="alert">{{ errorRevision }}</p>
            <div class="acciones-modal__footer">
              <button class="acciones-btn-cancel" :disabled="guardandoRevision || !comentarioRevision.trim()"
                @click="guardarRevision('correcciones')">Solicitar correcciones</button>
              <button class="acciones-btn-save" :disabled="guardandoRevision"
                @click="guardarRevision('aceptar')">Aceptar y
                cerrar</button>
            </div>
            <p v-if="guardandoRevision" role="status">Guardando decisión…</p>
          </div>

        </div>

        <div class="acciones-modal__footer">
          <button class="acciones-btn-cerrar" @click="cerrarModalReporte">Cerrar</button>
        </div>

      </div>
    </div>

  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { tienePermiso } from "@/config/permisos";
import { filtrarAcciones, generarCsvAcciones } from "@/utils/reporteAcciones.mjs";
import { estaVencida, mostrarFecha, mostrarFechaHora, textoAtraso } from "@/utils/fechas";

const auth = useAuthStore();

const puede = (accion) => tienePermiso(auth.usuario, `accionesCorrectivas.${accion}`);
const vistaActual = ref("flujo");
const etapaActiva = ref(null);
const acciones = ref([]);
const procesos = ref([]);
const responsables = ref([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref("");
const errorFormulario = ref("");
const mensaje = ref("");
const tipoMensaje = ref("info");
const mostrarModalGeneral = ref(false);
const mostrarModalReporte = ref(false);
const accionSeleccionada = ref(null);
const accionEditandoId = ref(null);
const filtroEtapa = ref("todos");
const comentarioSeguimiento = ref("");
const errorSeguimiento = ref("");
const guardandoSeguimiento = ref(false);
const archivosSeguimiento = ref([]);
const claveEvidencias = ref(0);
const errorDescarga = ref("");
const descargandoEvidencia = ref(null);
const comentarioRevision = ref("");
const errorRevision = ref("");
const guardandoRevision = ref(false);
const filtrosReporte = ref({ busqueda: "", estado: "", proceso: "", responsable: "" });
const estadosReporte = ["propuesta", "en_seguimiento", "en_revision", "cerrada", "aceptada", "rechazada"];
const accionesDeEtapa = computed(() => acciones.value.filter(accion => {
  if (filtroEtapa.value === "seguimiento") return puedeDarSeguimiento(accion);
  if (filtroEtapa.value === "revision") return accion.estadoInterno === "en_revision";
  if (filtroEtapa.value === "modificar") return ["propuesta", "en_seguimiento"].includes(accion.estadoInterno);
  return true;
}));
const tituloLista = computed(() => ({
  seguimiento: "Mis acciones pendientes de seguimiento",
  revision: "Acciones enviadas a revisión",
  modificar: "Selecciona una acción para modificarla",
})[filtroEtapa.value] || "Selecciona una acción correctiva para ver su reporte");
const accionesVisibles = computed(() => filtrarAcciones(accionesDeEtapa.value, filtrosReporte.value));
const procesosReporte = computed(() => opcionesReporte("proceso_id", "area"));
const responsablesReporte = computed(() => opcionesReporte("responsable_id", "responsableSeguimiento"));

function opcionesReporte(campoId, campoNombre) {
  const opciones = new Map();
  acciones.value.forEach(accion => {
    if (accion[campoId] != null) opciones.set(accion[campoId], { id: accion[campoId], nombre: accion[campoNombre] });
  });
  return [...opciones.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function limpiarFiltros() {
  filtrosReporte.value = { busqueda: "", estado: "", proceso: "", responsable: "" };
}

function descargarReporteCsv() {
  if (cargando.value || error.value || !accionesVisibles.value.length) return;
  const csv = generarCsvAcciones(accionesVisibles.value);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `reporte-acciones-correctivas-${fechaLocalHoy()}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nombreEstado(estado) {
  return ({
    propuesta: "Levantada", aceptada: "Aceptada", rechazada: "Rechazada",
    en_seguimiento: "En seguimiento", en_revision: "En revisión", cerrada: "Cerrada"
  })[estado] || estado;
}

function nombreEvento(tipo) {
  return ({ avance: "Seguimiento", aceptacion: "Aceptación y cierre", correcciones: "Solicitud de correcciones" })[tipo] || "Seguimiento";
}

function puedeRevisar(accion) {
  const esAdmin = auth.usuario?.rol_clave === "admin_general";
  const esSuya = Number(accion?.responsable_id) === Number(auth.usuario?.id);
  return puede("revisar") && (esAdmin || !esSuya) && accion?.estadoInterno === "en_revision";
}

function formatearFechaHora(fecha) {
  return mostrarFechaHora(fecha);
}

function formatearTamano(bytes) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function seleccionarEvidencias(evento) {
  const archivos = Array.from(evento.target.files || []);
  const extensiones = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g)$/i;
  const invalidos = archivos.length > 5 || archivos.some(archivo =>
    !archivo.size || archivo.size > 25 * 1024 * 1024 || !extensiones.test(archivo.name) || archivo.name.length > 255);
  errorSeguimiento.value = invalidos ? "Selecciona hasta 5 archivos no vacíos, de formatos permitidos, máximo 25 MB cada uno y nombres de hasta 255 caracteres." : "";
  archivosSeguimiento.value = invalidos ? [] : archivos;
  if (invalidos) evento.target.value = "";
}

async function descargarEvidencia(evidencia) {
  if (descargandoEvidencia.value !== null) return;
  descargandoEvidencia.value = evidencia.id;
  errorDescarga.value = "";
  let url;
  try {
    const blob = await api.getBlob(`/acciones-correctivas/${accionSeleccionada.value.id}/evidencias/${evidencia.id}/archivo`);
    url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = evidencia.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } catch (e) {
    errorDescarga.value = e.message || "No se pudo descargar la evidencia.";
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    descargandoEvidencia.value = null;
  }
}

function puedeDarSeguimiento(accion) {
  return !!accion && puede("seguimiento") && Number(accion.responsable_id) === Number(auth.usuario?.id) &&
    ["propuesta", "en_seguimiento"].includes(accion.estadoInterno);
}

function fechaLocalHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

const formGeneralVacio = () => ({
  titulo: "",
  procesoId: "",
  responsableId: "",
  tipo: "Correctiva",
  tipoHallazgo: "No Conformidad menor",
  afectaOtrosProcesos: false,
  procesosAfectados: [],
  fechaOcurrencia: fechaLocalHoy(),
  fechaCompromiso: "",
  origen: "",
  descripcion: "",
});
const formGeneral = ref(formGeneralVacio());
function actualizarProcesoPrincipal() {
  formGeneral.value.procesosAfectados =
    formGeneral.value.procesosAfectados.filter(
      (id) => String(id) !== String(formGeneral.value.procesoId),
    );
}

function actualizarAfectacion() {
  if (!formGeneral.value.afectaOtrosProcesos) {
    formGeneral.value.procesosAfectados = [];
  }
}

function adaptarAccion(accion) {
  return {
    ...accion,
    area: accion.proceso || "Sin proceso vinculado",
    estadoInterno: accion.estado,
    estado: nombreEstado(accion.estado),
    responsableLevantamiento: accion.solicitante || "Sin solicitante vinculado",
    responsableSeguimiento: accion.responsable || "Sin responsable vinculado",
    fechaLevantamiento: mostrarFecha(accion.creado_en, ""),
    fechaCompromiso: mostrarFecha(accion.fecha_compromiso, ""),
    seguimientos: accion.seguimientos || [], archivos: [], comentarios: "",
    fechaCierre: accion.cerrado_en ? formatearFechaHora(accion.cerrado_en) : "",
  };
}

async function cargarDatos() {
  if (cargando.value) return;
  cargando.value = true;
  error.value = "";
  try {
    const [lista, catalogoProcesos, usuarios] = await Promise.all([
      api.get("/acciones-correctivas"), api.get("/procesos"), api.get("/usuarios"),
    ]);
    acciones.value = lista.map(adaptarAccion);
    procesos.value = catalogoProcesos.filter(p => p.estatus === "activo");
    responsables.value = usuarios.filter(u => u.activo);
  } catch (e) {
    error.value = e.message || "No se pudieron cargar los datos.";
  } finally {
    cargando.value = false;
  }
}

async function abrirReportes() {
  limpiarFiltros();
  filtroEtapa.value = "todos";
  mensaje.value = "";
  vistaActual.value = "reportes";
  await cargarDatos();
}

function volverAlFlujo() {
  mensaje.value = "";
  vistaActual.value = "flujo";
}

async function seleccionarEtapa(etapa) {
  limpiarFiltros();
  tipoMensaje.value = "info";
  if (etapa === 1) {
    if (puede("levantar")) abrirModalGeneral();
  }
  else {
    filtroEtapa.value = etapa === 2 ? "seguimiento" : "revision";
    vistaActual.value = "reportes";
    mensaje.value = etapa === 2 ? "Abre una acción asignada a ti para registrar el seguimiento." : "Abre una acción para revisar sus avances. Quien la revisa puede aceptarla o solicitar correcciones.";
    await cargarDatos();
  }
}

function accionVencida(accion) {
  return ["propuesta", "en_seguimiento"].includes(accion?.estadoInterno) &&
    estaVencida(accion.fecha_compromiso);
}

function claseEstado(estado) {
  if (estado === "Cerrada" || estado === "Aceptada") return "acciones-badge--exito";
  if (["En seguimiento", "En revisión"].includes(estado)) return "acciones-badge--proceso";
  if (estado === "Levantada") return "acciones-badge--pendiente";
  if (estado === "Rechazada") return "acciones-badge--rechazo";
  return "acciones-badge--neutro";
}

function clasePrioridad(prioridad) {
  return ({ Alta: "acciones-badge--alta", Media: "acciones-badge--media" })[prioridad] || "acciones-badge--baja";
}

async function abrirModalGeneral() {
  accionEditandoId.value = null;
  formGeneral.value = formGeneralVacio();
  errorFormulario.value = "";
  mensaje.value = "";
  mostrarModalGeneral.value = true;
  await cargarDatos();
}

function cerrarModalGeneral() {
  if (!guardando.value) mostrarModalGeneral.value = false;
}

async function guardarAccionGeneral() {
  if (guardando.value || cargando.value) return;
  const form = formGeneral.value;
  if (!form.titulo.trim() || !form.procesoId || !form.responsableId || !form.fechaOcurrencia || !form.descripcion.trim()) {
    errorFormulario.value = "Completa los campos obligatorios.";
    return;
  }
  guardando.value = true;
  errorFormulario.value = "";
  try {
    const nueva = await api.post("/acciones-correctivas", {
      titulo: form.titulo.trim(), proceso_id: Number(form.procesoId),
      responsable_id: Number(form.responsableId), tipo: form.tipo, tipo_hallazgo: form.tipoHallazgo,
      afecta_otros_procesos: form.afectaOtrosProcesos,
      procesos_afectados: form.afectaOtrosProcesos
        ? form.procesosAfectados
        : [],
      fecha_ocurrencia: form.fechaOcurrencia, fecha_compromiso: form.fechaCompromiso || null,
      origen: form.origen.trim(), descripcion: form.descripcion.trim(),
    });
    mostrarModalGeneral.value = false;
    vistaActual.value = "reportes";
    filtroEtapa.value = "todos";
    limpiarFiltros();
    tipoMensaje.value = "exito";
    mensaje.value = `Acción AC-${nueva.id} guardada correctamente.`;
    await cargarDatos();
  } catch (e) {
    errorFormulario.value = e.message || "No se pudo guardar la acción.";
  } finally {
    guardando.value = false;
  }
}

async function abrirModificar() {
  limpiarFiltros();
  filtroEtapa.value = "modificar";
  vistaActual.value = "reportes";
  tipoMensaje.value = "info";
  mensaje.value = "Solo se pueden modificar acciones levantadas o en seguimiento.";
  await cargarDatos();
}

function abrirEdicion(accion) {
  accionEditandoId.value = accion.id;
  formGeneral.value = {
    titulo: accion.titulo || "",
    procesoId: accion.proceso_id ?? "",
    responsableId: accion.responsable_id ?? "",
    tipo: accion.tipo || "Correctiva",
    tipoHallazgo: accion.tipo_hallazgo || "No Conformidad menor",
    afectaOtrosProcesos: !!accion.afecta_otros_procesos,
    procesosAfectados: (accion.procesos_afectados || []).map(proceso => Number(proceso.id)),
    fechaOcurrencia: accion.fecha_ocurrencia || fechaLocalHoy(),
    fechaCompromiso: accion.fecha_compromiso || "",
    origen: accion.origen || "",
    descripcion: accion.descripcion || "",
    solicitante: accion.responsableLevantamiento,
  };
  errorFormulario.value = "";
  mostrarModalGeneral.value = true;
}

async function guardarCambiosAccion() {
  if (guardando.value || cargando.value) return;
  const form = formGeneral.value;
  if (!form.titulo.trim() || !form.responsableId || !form.fechaOcurrencia || !form.descripcion.trim()) {
    errorFormulario.value = "Completa los campos obligatorios.";
    return;
  }
  guardando.value = true;
  errorFormulario.value = "";
  const id = accionEditandoId.value;
  try {
    await api.put(`/acciones-correctivas/${id}`, {
      titulo: form.titulo.trim(),
      responsable_id: Number(form.responsableId),
      tipo: form.tipo,
      tipo_hallazgo: form.tipoHallazgo,
      fecha_ocurrencia: form.fechaOcurrencia,
      fecha_compromiso: form.fechaCompromiso || null,
      origen: form.origen.trim(),
      descripcion: form.descripcion.trim(),
    });
    mostrarModalGeneral.value = false;
    accionEditandoId.value = null;
    tipoMensaje.value = "exito";
    mensaje.value = `Acción AC-${id} modificada correctamente.`;
    await cargarDatos();
  } catch (e) {
    errorFormulario.value = e.message || "No se pudo modificar la acción.";
  } finally {
    guardando.value = false;
  }
}

function verReporte(accion) {
  archivosSeguimiento.value = [];
  claveEvidencias.value++;
  errorDescarga.value = "";
  comentarioRevision.value = "";
  errorRevision.value = "";
  comentarioSeguimiento.value = "";
  errorSeguimiento.value = "";
  accionSeleccionada.value = accion;
  mostrarModalReporte.value = true;
}

function cerrarModalReporte() {
  if (guardandoSeguimiento.value || guardandoRevision.value) return;
  mostrarModalReporte.value = false;
  accionSeleccionada.value = null;
}

async function guardarSeguimiento(enviarRevision) {
  if (guardandoSeguimiento.value || !comentarioSeguimiento.value.trim() || !puedeDarSeguimiento(accionSeleccionada.value)) return;
  const id = accionSeleccionada.value.id;
  guardandoSeguimiento.value = true;
  errorSeguimiento.value = "";
  try {
    const formulario = new FormData();
    formulario.append("comentario", comentarioSeguimiento.value.trim());
    formulario.append("enviar_revision", String(enviarRevision));
    archivosSeguimiento.value.forEach(archivo => formulario.append("archivos", archivo));
    await api.postForm(`/acciones-correctivas/${id}/seguimientos`, formulario);
    comentarioSeguimiento.value = "";
    archivosSeguimiento.value = [];
    claveEvidencias.value++;
    tipoMensaje.value = "exito";
    mensaje.value = enviarRevision ? `Acción AC-${id} enviada al administrador para revisión.` : `Avance de la acción AC-${id} guardado correctamente.`;
    await cargarDatos();
    const actualizada = acciones.value.find(accion => accion.id === id);
    if (error.value) {
      mostrarModalReporte.value = false;
      accionSeleccionada.value = null;
    } else {
      accionSeleccionada.value = actualizada || null;
      mostrarModalReporte.value = !!actualizada;
    }
  } catch (e) {
    errorSeguimiento.value = e.message || "No se pudo guardar el seguimiento.";
  } finally {
    guardandoSeguimiento.value = false;
  }
}

async function guardarRevision(decision) {
  if (guardandoRevision.value || !puedeRevisar(accionSeleccionada.value)) return;
  if (decision === "correcciones" && !comentarioRevision.value.trim()) {
    errorRevision.value = "Explica qué debe corregir el responsable.";
    return;
  }
  const id = accionSeleccionada.value.id;
  guardandoRevision.value = true;
  errorRevision.value = "";
  try {
    await api.post(`/acciones-correctivas/${id}/revision`, {
      decision, comentario: comentarioRevision.value.trim(),
    });
    comentarioRevision.value = "";
    tipoMensaje.value = "exito";
    mensaje.value = decision === "aceptar" ? `Acción AC-${id} aceptada y cerrada correctamente.` : `Acción AC-${id} devuelta al responsable para correcciones.`;
    await cargarDatos();
    accionSeleccionada.value = error.value ? null : acciones.value.find(accion => accion.id === id) || null;
    mostrarModalReporte.value = !!accionSeleccionada.value;
  } catch (e) {
    errorRevision.value = e.message || "No se pudo guardar la revisión.";
  } finally {
    guardandoRevision.value = false;
  }
}

onMounted(cargarDatos);
</script>

<style>
@import '@/assets/styles/AccionesC.css';
</style>

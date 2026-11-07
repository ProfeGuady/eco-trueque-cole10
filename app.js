import {
  isSupabaseConfigured,
  obtenerItemsDonados,
  agregarItemDonado,
  crearSolicitudAnonima,
  obtenerColectasDelegados,
  sumarAporteAlimento,
  crearCampaniaAlimento,
  obtenerResumenMatematico
} from './db.js';

let estadoFiltro = 'todos';
let cacheItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  registrarServiceWorker();
  configurarEstadoConexion();
  configurarPestanas();
  configurarFiltrosCatalogo();
  configurarModalesYFormularios();
  await recargarTodo();
});

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function configurarEstadoConexion() {
  const badge = document.getElementById('dbStatusBadge');
  if (!badge) return;
  if (isSupabaseConfigured()) {
    badge.textContent = '☁️ Supabase Activo';
    badge.style.background = '#1B5E20';
  } else {
    badge.textContent = '📱 Modo Aula Local';
  }
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ==========================================================================
   1. NAVEGACIÓN ENTRE PESTAÑAS
   ========================================================================== */
function activarPestana(nombreTab) {
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${nombreTab}`);
  });
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === nombreTab);
  });
}

function configurarPestanas() {
  const params = new URLSearchParams(window.location.search);
  const tabInicial = params.get('tab');
  if (tabInicial && ['catalogo', 'pedir', 'colectas', 'matematica'].includes(tabInicial)) {
    activarPestana(tabInicial);
  }

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => activarPestana(btn.dataset.tab));
  });
}

/* ==========================================================================
   2. CATÁLOGO ANÓNIMO DE UNIFORMES Y ÚTILES
   ========================================================================== */
function configurarFiltrosCatalogo() {
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      estadoFiltro = chip.dataset.filter;
      renderizarCatalogo();
    });
  });
}

function renderizarCatalogo() {
  const grid = document.getElementById('catalogoGrid');
  if (!grid) return;

  const filtrados = cacheItems.filter((item) =>
    estadoFiltro === 'todos' ? true : item.categoria === estadoFiltro
  );

  if (filtrados.length === 0) {
    grid.innerHTML = `<div class="card"><p>No hay artículos cargados en esta categoría.</p></div>`;
    return;
  }

  grid.innerHTML = filtrados
    .map((item) => {
      const esUniforme = item.categoria === 'uniforme';
      const badgeClass = esUniforme ? 'badge-uniforme' : 'badge-utiles';
      const badgeTexto = esUniforme ? '👕 Uniforme' : '✏️ Útiles';
      const sinStock = Number(item.stock) <= 0;

      return `
        <article class="card">
          <div>
            <div class="card-header">
              <span class="badge ${badgeClass}">${badgeTexto}</span>
              <span class="anon-pill">🤍 Donante anónimo</span>
            </div>
            <h3 style="font-size: 1.02rem; margin-top: 0.6rem;">${escaparHtml(item.nombre)}</h3>
            <p style="font-size: 0.84rem; color: var(--texto-sec); margin-top: 0.2rem;">
              ${escaparHtml(item.talle_detalle || 'Disponible en el colegio')}
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
            <span style="font-size: 0.82rem; font-weight: 600; color: ${sinStock ? '#999' : 'var(--verde)'};">
              ${sinStock ? 'Sin stock momentáneo' : `Disponibles: ${item.stock}`}
            </span>
            <button
              class="btn btn-accent btn-sm btn-lo-necesito"
              data-id="${item.id}"
              data-nombre="${escaparHtml(item.nombre)}"
              ${sinStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}
            >
              🤝 Lo necesito
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-lo-necesito').forEach((btn) => {
    btn.addEventListener('click', () => {
      abrirModalLoNecesito(btn.dataset.id, btn.dataset.nombre);
    });
  });
}

function poblarSelectSolicitud() {
  const select = document.getElementById('pedidoItemSelect');
  const grupoLibre = document.getElementById('grupoDetalleLibre');
  if (!select) return;

  const opcionesCat = cacheItems
    .filter((i) => i.stock > 0)
    .map(
      (i) =>
        `<option value="${i.id}" data-nombre="${escaparHtml(i.nombre)}">${escaparHtml(
          i.nombre
        )} (${escaparHtml(i.talle_detalle)})</option>`
    )
    .join('');

  select.innerHTML = `
    <option value="">Seleccioná del catálogo o elegí pedido libre...</option>
    ${opcionesCat}
    <option value="libre">✨ Otro útil o talle de uniforme (escribir manualmente)</option>
  `;

  select.onchange = () => {
    if (select.value === 'libre') {
      grupoLibre.style.display = 'block';
    } else {
      grupoLibre.style.display = 'none';
    }
  };
}

/* ==========================================================================
   3. COLECTAS DE ALIMENTOS NO PERECEDEROS
   ========================================================================== */
async function renderizarColectas() {
  const grid = document.getElementById('colectasGrid');
  if (!grid) return;

  const colectas = await obtenerColectasDelegados();
  grid.innerHTML = colectas
    .map((c) => {
      const porcentaje = Math.min(100, Math.round((c.actual_unidades / c.meta_unidades) * 100));
      return `
        <article class="card">
          <div>
            <div class="card-header">
              <span class="badge badge-alimentos">🥫 Colecta Solidaria</span>
              <span class="anon-pill">${escaparHtml(c.generacion_legado)}</span>
            </div>
            <h3 style="font-size: 1rem; margin-top: 0.55rem;">${escaparHtml(c.campania_alimento)}</h3>
            <p style="font-size: 0.8rem; color: var(--texto-sec);">
              Coordina: ${escaparHtml(c.curso)}
            </p>
            <div class="progress-wrap" aria-label="Progreso ${porcentaje}%">
              <div class="progress-bar" style="width: ${porcentaje}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600;">
              <span>Recaudado: ${c.actual_unidades} u.</span>
              <span style="color: var(--naranja);">${porcentaje}% de ${c.meta_unidades} u.</span>
            </div>
          </div>
          <button
            class="btn btn-outline btn-sm btn-sumar-alimento"
            data-id="${c.id}"
            data-nombre="${escaparHtml(c.campania_alimento)}"
          >
            ➕ Aportar 1 unidad / paquete
          </button>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-sumar-alimento').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await sumarAporteAlimento(btn.dataset.id, 1);
      mostrarToast(`¡Gracias! Se sumó 1 aporte a "${btn.dataset.nombre}".`);
      await recargarTodo();
    });
  });
}

/* ==========================================================================
   4. PANEL MATEMÁTICO (PORCENTAJES, PROPORCIONES Y TEXTILES)
   ========================================================================== */
async function renderizarPanelMatematico() {
  const resumen = await obtenerResumenMatematico();

  const elReutilizados = document.getElementById('kpiReutilizados');
  const elEstudiantes = document.getElementById('kpiEstudiantes');
  const elTextiles = document.getElementById('kpiTextiles');
  const elPorcAlim = document.getElementById('kpiPorcentajeAlimentos');

  if (!elReutilizados) return;

  const porcGlobalAlimentos =
    resumen.totalMetaAlimentos > 0
      ? Math.round((resumen.totalActualAlimentos / resumen.totalMetaAlimentos) * 100)
      : 0;

  elReutilizados.textContent = resumen.totalArticulosReutilizados;
  elEstudiantes.textContent = resumen.estudiantesAsistidos;
  elTextiles.textContent = `${resumen.kgTextiles} kg`;
  elPorcAlim.textContent = `${porcGlobalAlimentos}%`;

  // Gráfico 1: Proporción Prendas vs Útiles
  const totalReut = Math.max(1, resumen.totalArticulosReutilizados);
  const porcUniformes = Math.round((resumen.prendasReutilizadas / totalReut) * 100);
  const porcUtiles = Math.round((resumen.utilesReutilizados / totalReut) * 100);

  const chartRubros = document.getElementById('chartRubros');
  chartRubros.innerHTML = `
    <div class="bar-row">
      <span>👕 Uniformes</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${porcUniformes}%"></div>
      </div>
      <strong>${porcUniformes}%</strong>
    </div>
    <div class="bar-row">
      <span>✏️ Útiles</span>
      <div class="bar-track">
        <div class="bar-fill orange" style="width: ${porcUtiles}%"></div>
      </div>
      <strong>${porcUtiles}%</strong>
    </div>
  `;

  // Cálculo de razón matemática simplificada
  const mcd = calcularMCD(resumen.prendasReutilizadas, resumen.utilesReutilizados) || 1;
  const razonPrendas = Math.round(resumen.prendasReutilizadas / mcd);
  const razonUtiles = Math.round(resumen.utilesReutilizados / mcd);

  document.getElementById('formulaProporcion').innerHTML = `
    <strong>📘 Análisis de Proporción (5° y 4° Año):</strong><br/>
    • <strong>Razón Uniformes / Útiles:</strong> ${resumen.prendasReutilizadas} : ${resumen.utilesReutilizados}
    (simplificada <strong>${razonPrendas} : ${razonUtiles}</strong>).<br/>
    • <strong>Fórmula de porcentaje:</strong> <code>(Parte / Total) × 100</code> →
    (${resumen.prendasReutilizadas} / ${resumen.totalArticulosReutilizados}) × 100 = <strong>${porcUniformes}%</strong> en indumentaria escolar.
  `;

  // Gráfico 2: Colectas de alimentos
  const chartColectas = document.getElementById('chartColectas');
  chartColectas.innerHTML = resumen.colectas
    .map((c) => {
      const pct = Math.min(100, Math.round((c.actual_unidades / c.meta_unidades) * 100));
      const etiquetaCorta = c.campania_alimento.split('(')[0].trim();
      return `
        <div class="bar-row">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escaparHtml(etiquetaCorta)}">
            ${escaparHtml(etiquetaCorta)}
          </span>
          <div class="bar-track">
            <div class="bar-fill ${pct >= 75 ? '' : 'orange'}" style="width: ${pct}%"></div>
          </div>
          <strong>${pct}%</strong>
        </div>
      `;
    })
    .join('');

  document.getElementById('formulaImpactoTextil').innerHTML = `
    <strong>🌍 Cálculo de Huella Textil y Metas:</strong><br/>
    • <strong>Masa textil recuperada:</strong> <code>∑ (Prendas × Peso unitario kg)</code> = <strong>${resumen.kgTextiles} kg</strong> de tela que siguen en uso dentro del Colegio N° 10.<br/>
    • <strong>Progreso alimentario total:</strong> ${resumen.totalActualAlimentos} de ${resumen.totalMetaAlimentos} unidades (${porcGlobalAlimentos}%).
  `;
}

function calcularMCD(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/* ==========================================================================
   5. MODALES Y FORMULARIOS
   ========================================================================== */
function abrirModalLoNecesito(id, nombre) {
  const modal = document.getElementById('modalLoNecesito');
  document.getElementById('modalItemId').value = id;
  document.getElementById('modalItemNombre').textContent = `Artículo: ${nombre}`;
  modal.classList.add('open');
}

function configurarModalesYFormularios() {
  const modalNecesito = document.getElementById('modalLoNecesito');
  const modalDonar = document.getElementById('modalDonar');

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => {
    modalNecesito.classList.remove('open');
  });

  document.getElementById('btnAbrirDonar')?.addEventListener('click', () => {
    modalDonar.classList.add('open');
  });

  document.getElementById('btnCerrarDonar')?.addEventListener('click', () => {
    modalDonar.classList.remove('open');
  });

  // Confirmar "Lo necesito" desde el modal del catálogo
  document.getElementById('formModalLoNecesito')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item_id = document.getElementById('modalItemId').value;
    const item_nombre = document.getElementById('modalItemNombre').textContent.replace('Artículo: ', '');
    const usuario_interno = document.getElementById('modalUsuario').value;
    const curso = document.getElementById('modalCurso').value;

    await crearSolicitudAnonima({
      item_id,
      item_nombre,
      tipo: 'catalogo',
      usuario_interno,
      curso
    });

    e.target.reset();
    modalNecesito.classList.remove('open');
    mostrarToast('🔒 Solicitud anónima registrada. Nadie verá tu nombre.');
    await recargarTodo();
  });

  // Formulario de Solicitud Anónima desde la pestaña "Lo necesito"
  document.getElementById('formPedidoLibre')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = document.getElementById('pedidoItemSelect');
    const esLibre = select.value === 'libre';
    const detalleLibre = document.getElementById('pedidoDetalleLibre').value;
    const optSeleccionada = select.options[select.selectedIndex];

    const item_id = esLibre ? null : select.value;
    const item_nombre = esLibre
      ? detalleLibre || 'Solicitud libre de útil/uniforme'
      : optSeleccionada.dataset.nombre || optSeleccionada.textContent;

    const usuario_interno = document.getElementById('pedidoUsuario').value;
    const curso = document.getElementById('pedidoCurso').value;

    await crearSolicitudAnonima({
      item_id,
      item_nombre,
      tipo: esLibre ? 'pedido_libre' : 'catalogo',
      usuario_interno,
      curso
    });

    e.target.reset();
    document.getElementById('grupoDetalleLibre').style.display = 'none';
    mostrarToast('🔒 Pedido guardado en forma 100% anónima para gestión interna.');
    await recargarTodo();
  });

  // Formulario para sumar donación anónima
  document.getElementById('formDonarItem')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await agregarItemDonado({
      categoria: document.getElementById('donarCategoria').value,
      nombre: document.getElementById('donarNombre').value,
      talle_detalle: document.getElementById('donarDetalle').value,
      stock: document.getElementById('donarStock').value
    });

    e.target.reset();
    modalDonar.classList.remove('open');
    mostrarToast('🌱 ¡Gracias! Tu donación se sumó al catálogo de forma anónima.');
    await recargarTodo();
  });

  // Formulario de nueva colecta de alimentos
  document.getElementById('formNuevaColecta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await crearCampaniaAlimento({
      campania_alimento: document.getElementById('inputAlimentoLibre').value,
      meta_unidades: document.getElementById('inputMetaLibre').value,
      curso: document.getElementById('inputCursoColecta').value
    });

    e.target.reset();
    mostrarToast('🥫 Nueva meta de colecta publicada.');
    await recargarTodo();
  });
}

async function recargarTodo() {
  cacheItems = await obtenerItemsDonados();
  renderizarCatalogo();
  poblarSelectSolicitud();
  await renderizarColectas();
  await renderizarPanelMatematico();
}

function escaparHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


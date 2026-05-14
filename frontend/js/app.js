// ============================================================================
// Aplicação de interface
// ----------------------------------------------------------------------------
// Controla a experiência SPA: navegação entre views, carregamento das planilhas,
// renderização de tabelas/KPIs, rastreio orçamentário e exportação em PDF.
// A leitura e normalização dos dados ficam nos serviços em backend/.
// ============================================================================

import {
    carregarCatalogoAplicacao,
    carregarDadosAplicacao,
    carregarDadosFormalizacaoProfor,
    carregarDadosDiagnosticoOuvidorias,
    carregarDadosOrcamento,
    obterDadosDoacoes2023,
    obterDadosFaf2021,
    obterDadosFormalizacaoProfor,
    obterDadosDiagnosticoOuvidorias,
    obterDadosProfor2022,
    processarArquivoPlanilhaSelecionado,
    obterDadosOrcamento,
    obterDadosContatos,
    carregarDadosContatos,
    fetchJsonApiOnasp,
    obterUrlApiOnasp,
    obterModoDadosOnasp,
    estaEmModoPublicacaoEstatica
} from '../../backend/services/data-service.js?v=20260513-02';
import {
    calcularResumoFinanceiro,
    calcularResumoInstrumentos,
    calculateStateMetrics,
    processarDadosAgregados
} from '../../backend/services/analytics.js?v=20260428-2';
import {
    MENSAGEM_MODO_PUBLICACAO,
    aplicarModoSomenteLeitura,
    dadosPaginaEmModoEstatico
} from './core/static-mode.js?v=20260507-05';

// ========================================================================
// CONFIGURACOES E ESTADO
// ========================================================================

let dadosFaf = [];
let tabelaInstancia = null;
let chartInstancia = null;
let estadoAtualPDF = '';
let dadosFinanceirosValidados = false;
let filtroTabelaAtual = null;
let filtroDataTableRegistrado = false;
let orcamentoItensRastreioAbertos = new Set();
let proforConvenioAtual = null;
let proforFiltroAreaAtual = 'OUVIDORIA';
let formalizacaoUfAtual = null;
let diagnosticoOuvidoriaAtual = null;
let diagnosticoUfAtual = '';
let parametrosMinimosModoEdicao = false;
let parametrosMinimosAlteracoesPendentes = {};
let parametrosMinimosEditorAtivo = null;
let formalizacaoEditoresAbertos = new Set();
let formalizacaoAlteracoesPendentes = {};
let contatosMapaIndiceUf = {};
let contatosMapaUfAtual = '';
let orcamentoAlteracoesPendentes = {};
let orcamentoEditoresAbertos = new Set();
let orcamentoNovosProcessos = [];
let orcamentoProcessosInativos = new Set();
let orcamentoDivisaoRecursoEmAndamento = false;
let orcamentoMovimentacoes = [];
let orcamentoAlocacaoEmAndamento = false;
let orcamentoRenderizacaoSequencia = 0;
let orcamentoOutrosProcessosExpandido = false;
let orcamentoEventosDelegadosConfigurados = false;
let erroCarregamentoOrcamento = null;
let baseAplicacaoCarregamentoPromise = null;
const errosCarregamentoView = {};
const DEBUG_PERF_ONASP = (() => {
    if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') {
        return false;
    }

    try {
        return new URLSearchParams(window.location.search).has('debugPerf');
    } catch {
        return false;
    }
})();
let resumoPublicacaoSistemaCache = null;
let faf2021UfDetalheAtual = '';
const APP_CACHE_VERSION = '20260507-05';
const ANALYTICS_CACHE_VERSION = '20260428-2';

function registrarPerfOrcamento(etapa, inicio, detalhes = {}) {
    if (!DEBUG_PERF_ONASP || typeof console === 'undefined' || typeof performance === 'undefined') {
        return;
    }

    const duracaoMs = typeof inicio === 'number'
        ? Number((performance.now() - inicio).toFixed(2))
        : null;
    console.info(`[perf:orcamento] ${etapa}`, {
        duracaoMs,
        ...detalhes
    });
}

// Mantém o idioma do DataTables local para evitar CORS e dependência externa em ambiente restrito ou no GitHub Pages.
const DATATABLES_LANGUAGE_PT_BR = {
    decimal: ',',
    thousands: '.',
    emptyTable: 'Nenhum registro encontrado',
    info: 'Mostrando _START_ até _END_ de _TOTAL_ registros',
    infoEmpty: 'Mostrando 0 até 0 de 0 registros',
    infoFiltered: '(filtrado de _MAX_ registros no total)',
    lengthMenu: 'Mostrar _MENU_ registros',
    loadingRecords: 'Carregando...',
    processing: 'Processando...',
    search: 'Pesquisar:',
    zeroRecords: 'Nenhum registro encontrado',
    paginate: {
        first: 'Primeiro',
        last: 'Último',
        next: 'Próximo',
        previous: 'Anterior'
    },
    aria: {
        sortAscending: ': ativar para ordenar a coluna em ordem crescente',
        sortDescending: ': ativar para ordenar a coluna em ordem decrescente'
    }
};

// Ordem fixa usada em filtros, exportações e seleção de UFs.
const ORDEM_REGIOES = ["NORTE", "NORDESTE", "CENTRO-OESTE", "SUDESTE", "SUL"];
// Metadados visuais do mapa de contatos; os dados oficiais continuam vindo da base consolidada da aplicação.
const CONTATOS_MAPA_UFS = {
    AC: { nome: 'Acre', regiao: 'Norte', x: 14.37, y: 38.35 },
    AL: { nome: 'Alagoas', regiao: 'Nordeste', x: 89.38, y: 39.05 },
    AP: { nome: 'Amapá', regiao: 'Norte', x: 55.37, y: 13.61 },
    AM: { nome: 'Amazonas', regiao: 'Norte', x: 27.27, y: 26.60 },
    BA: { nome: 'Bahia', regiao: 'Nordeste', x: 78.08, y: 45.91 },
    CE: { nome: 'Ceará', regiao: 'Nordeste', x: 82.75, y: 28.78 },
    DF: { nome: 'Distrito Federal', regiao: 'Centro-Oeste', x: 64.61, y: 53.59 },
    ES: { nome: 'Espírito Santo', regiao: 'Sudeste', x: 80.40, y: 62.39 },
    GO: { nome: 'Goiás', regiao: 'Centro-Oeste', x: 60.56, y: 54.19 },
    MA: { nome: 'Maranhão', regiao: 'Nordeste', x: 70.17, y: 28.75 },
    MT: { nome: 'Mato Grosso', regiao: 'Centro-Oeste', x: 46.63, y: 47.01 },
    MS: { nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste', x: 49.00, y: 64.14 },
    MG: { nome: 'Minas Gerais', regiao: 'Sudeste', x: 71.53, y: 59.79 },
    PA: { nome: 'Pará', regiao: 'Norte', x: 52.92, y: 26.21 },
    PB: { nome: 'Paraíba', regiao: 'Nordeste', x: 88.91, y: 33.49 },
    PR: { nome: 'Paraná', regiao: 'Sul', x: 56.15, y: 74.13 },
    PE: { nome: 'Pernambuco', regiao: 'Nordeste', x: 86.31, y: 36.29 },
    PI: { nome: 'Piauí', regiao: 'Nordeste', x: 75.31, y: 34.10 },
    RJ: { nome: 'Rio de Janeiro', regiao: 'Sudeste', x: 75.99, y: 68.46 },
    RN: { nome: 'Rio Grande do Norte', regiao: 'Nordeste', x: 89.27, y: 30.51 },
    RO: { nome: 'Rondônia', regiao: 'Norte', x: 31.28, y: 42.28 },
    RR: { nome: 'Roraima', regiao: 'Norte', x: 34.50, y: 12.13 },
    RS: { nome: 'Rio Grande do Sul', regiao: 'Sul', x: 52.39, y: 85.91 },
    SC: { nome: 'Santa Catarina', regiao: 'Sul', x: 58.69, y: 80.19 },
    SE: { nome: 'Sergipe', regiao: 'Nordeste', x: 87.56, y: 41.52 },
    SP: { nome: 'São Paulo', regiao: 'Sudeste', x: 62.54, y: 68.63 },
    TO: { nome: 'Tocantins', regiao: 'Norte', x: 63.44, y: 40.51 }
};
const CONTATOS_MAPA_REGION_CLASSES = {
    Norte: 'is-norte',
    Nordeste: 'is-nordeste',
    'Centro-Oeste': 'is-centro-oeste',
    Sudeste: 'is-sudeste',
    Sul: 'is-sul'
};
const CONTATOS_MAPA_DESTAQUES = {
    CE: { variante: 'callout', labelX: -26, labelY: -16, z: 5 },
    RN: { variante: 'callout', labelX: 31, labelY: -12, z: 9 },
    PB: { variante: 'callout', labelX: 31, labelY: 12, z: 8 },
    PE: { variante: 'callout', labelX: -38, labelY: -30, z: 10 },
    PI: { variante: 'callout', labelX: -22, labelY: 24, z: 6 },
    AL: { variante: 'callout', labelX: 32, labelY: 8, z: 7 },
    SE: { variante: 'callout', labelX: 30, labelY: 30, z: 6 },
    DF: { variante: 'callout', labelX: 34, labelY: -20, z: 6 },
    ES: { variante: 'callout', labelX: 25, labelY: -8, z: 5 },
    RJ: { variante: 'callout', labelX: 25, labelY: 12, z: 5 },
    PR: { variante: 'callout', labelX: -25, labelY: -4, z: 5 },
    SC: { variante: 'callout', labelX: 25, labelY: 8, z: 5 }
};
const VIEWS_REPASSES_FUNPEN = new Set([
    'detalhamento',
    'estado-detalhe',
    'profor2022',
    'profor-convenio-detalhe',
    'faf2021',
    'faf2021-detalhe',
    'doacoes2023',
    'doacoes2023-detalhe',
    'formalizacao',
    'formalizacao-detalhe',
    'diagnostico-ouvidorias'
]);
const TODAS_UFS_BRASIL = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];
const UFS_SEM_OUVIDORIA_ESPECIFICA = ["PA", "RO", "RR", "RS", "SC", "SE", "TO"];
let catalogoAplicacao = {
    configuracao: {},
    regioes: {},
    nomesEstados: {},
    imagensBandeiras: {},
    infoConvenios: {},
    dadosBase: []
};

// ========================================================================
// UI HELPERS
// ========================================================================

const UI_ICONS = {
    edit: 'fa-pen-to-square',
    split: 'fa-code-branch',
    save: 'fa-floppy-disk',
    cancel: 'fa-xmark',
    history: 'fa-clock-rotate-left',
    exportExcel: 'fa-file-excel',
    exportPdf: 'fa-file-pdf',
    add: 'fa-circle-plus',
    back: 'fa-arrow-left',
    warning: 'fa-triangle-exclamation',
    success: 'fa-check-circle',
    info: 'fa-circle-info',
    lock: 'fa-lock',
    search: 'fa-magnifying-glass',
    filter: 'fa-filter',
    refresh: 'fa-rotate-right',
    allocate: 'fa-right-left'
};

const STATUS_UI = {
    CONCLUIDO: { label: 'Concluído', classe: 'success', icon: 'fa-check-circle' },
    PENDENTE: { label: 'Pendente', classe: 'warning', icon: 'fa-clock' },
    EM_ANDAMENTO: { label: 'Em andamento', classe: 'primary', icon: 'fa-spinner' },
    VALIDAR: { label: 'Validar', classe: 'info', icon: 'fa-circle-question' },
    CRITICO: { label: 'Crítico', classe: 'danger', icon: 'fa-triangle-exclamation' },
    NAO_APLICA: { label: 'Não se aplica', classe: 'secondary', icon: 'fa-ban' }
};

const VIEW_ERROR_MESSAGES = {
    orcamento: {
        titulo: 'Não foi possível carregar Orçamento 2026.',
        detalhe: 'Verifique se o servidor local está ativo ou se o arquivo orcamento-2026.json foi publicado.'
    },
    formalizacao: {
        titulo: 'Não foi possível carregar Formalização PROFOR.',
        detalhe: 'Verifique a API local ou o arquivo formalizacao-profor.json.'
    },
    'formalizacao-detalhe': {
        titulo: 'Não foi possível carregar o detalhe da Formalização PROFOR.',
        detalhe: 'Verifique os dados da UF selecionada.'
    },
    'diagnostico-ouvidorias': {
        titulo: 'Não foi possível carregar Parâmetros Mínimos.',
        detalhe: 'Verifique a base local ou o arquivo parametros-minimos.json.'
    },
    contatos: {
        titulo: 'Não foi possível carregar Contatos UFs.',
        detalhe: 'Verifique a origem dos dados de contatos.'
    },
    'status-sistema': {
        titulo: 'Não foi possível carregar Status do Sistema.',
        detalhe: 'Verifique se os dados locais ou os arquivos publicados estão disponíveis.'
    }
};

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function normalizarChaveStatusUi(status) {
    const texto = normalizarTexto(status || '');

    if (texto.includes('CONCLUID')) return 'CONCLUIDO';
    if (texto.includes('ANDAMENTO')) return 'EM_ANDAMENTO';
    if (texto.includes('VALIDAR')) return 'VALIDAR';
    if (texto.includes('CRITICO')) return 'CRITICO';
    if (texto.includes('NAO SE APLICA')) return 'NAO_APLICA';
    if (texto.includes('PENDENTE')) return 'PENDENTE';

    return 'PENDENTE';
}

function renderStatusBadge(status, options = {}) {
    const chave = normalizarChaveStatusUi(status);
    const config = STATUS_UI[chave] || STATUS_UI.PENDENTE;
    const label = options.label || config.label;
    const extraClass = options.className || '';

    return `
        <span class="app-status-badge app-status-badge-${config.classe} ${extraClass}">
            <i class="fas ${config.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(label)}</span>
        </span>
    `;
}

function renderActionButton({
    id = '',
    type,
    label,
    onClick,
    variant = 'outline-primary',
    size = 'sm',
    backend = false,
    disabled = false,
    title = '',
    extraClass = '',
    iconOnly = false,
    attributes = ''
}) {
    const icon = UI_ICONS[type] || 'fa-circle';
    const backendAttr = backend ? 'data-requer-backend="true"' : '';
    const disabledAttr = disabled ? 'disabled aria-disabled="true"' : '';
    const titleAttr = title ? `title="${escapeHtml(title)}"` : '';
    const onClickAttr = onClick ? `onclick="${onClick}"` : '';
    const idAttr = id ? `id="${escapeHtml(id)}"` : '';
    const labelHtml = iconOnly
        ? `<span class="visually-hidden">${escapeHtml(label)}</span>`
        : `<span>${escapeHtml(label)}</span>`;

    return `
        <button type="button"
            class="btn btn-${size} btn-${variant} ${iconOnly ? 'btn-icon-only' : 'btn-icon-text'} ${extraClass}"
            ${idAttr}
            ${onClickAttr}
            ${backendAttr}
            ${disabledAttr}
            ${titleAttr}
            ${attributes}>
            <i class="fas ${icon}" aria-hidden="true"></i>
            ${labelHtml}
        </button>
    `;
}

function renderKpiCard({
    titulo,
    valor,
    descricao = '',
    icon = 'fa-chart-simple',
    variant = '',
    valueClass = '',
    extraClass = ''
}) {
    return `
        <div class="card kpi-card ${variant ? `kpi-card-${variant}` : ''} ${extraClass}">
            <div class="kpi-title">
                <i class="fas ${icon}" aria-hidden="true"></i>
                ${escapeHtml(titulo)}
            </div>
            <div class="kpi-value ${valueClass}">${valor}</div>
            ${descricao ? `<div class="kpi-desc">${escapeHtml(descricao)}</div>` : ''}
        </div>
    `;
}

function renderPublicationNotice() {
    return `
        <div class="publication-mode-notice" role="status">
            <i class="fas ${UI_ICONS.lock}" aria-hidden="true"></i>
            <span>${escapeHtml(MENSAGEM_MODO_PUBLICACAO)}</span>
        </div>
    `;
}

function renderizarAvisoModoPublicacao() {
    return renderPublicationNotice();
}

function renderEmptyState({
    titulo = 'Nenhum dado disponível.',
    descricao = '',
    icon = 'fa-inbox'
}) {
    return `
        <div class="app-empty-state">
            <i class="fas ${icon}" aria-hidden="true"></i>
            <h3>${escapeHtml(titulo)}</h3>
            ${descricao ? `<p>${escapeHtml(descricao)}</p>` : ''}
        </div>
    `;
}

function renderErrorState({
    titulo = 'Não foi possível carregar esta página.',
    detalhe = '',
    error = null
}) {
    const mensagemErro = error?.message ? escapeHtml(error.message) : '';

    return `
        <div class="app-error-state alert alert-danger m-4">
            <div class="app-error-title">
                <i class="fas ${UI_ICONS.warning}" aria-hidden="true"></i>
                <strong>${escapeHtml(titulo)}</strong>
            </div>
            ${detalhe ? `<div>${escapeHtml(detalhe)}</div>` : ''}
            ${mensagemErro ? `<small class="d-block mt-2 text-muted">${mensagemErro}</small>` : ''}
        </div>
    `;
}

function renderSystemModeBadge(modo, rotulo = '') {
    if (modo === 'estatico') {
        return `
            <span class="app-status-badge app-status-badge-warning">
                <i class="fas fa-lock" aria-hidden="true"></i>
                <span>${escapeHtml(rotulo || 'Publicação estática')}</span>
            </span>
        `;
    }

    if (modo === 'api') {
        return `
            <span class="app-status-badge app-status-badge-success">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <span>${escapeHtml(rotulo || 'Local')}</span>
            </span>
        `;
    }

    return `
        <span class="app-status-badge app-status-badge-secondary">
            <i class="fas fa-circle-info" aria-hidden="true"></i>
            <span>${escapeHtml(rotulo || 'Não identificado')}</span>
        </span>
    `;
}

async function carregarResumoPublicacaoSistema() {
    if (resumoPublicacaoSistemaCache) return resumoPublicacaoSistemaCache;

    try {
        const resposta = await fetch(`frontend/data/publicados/resumo-publicacao.json?v=${APP_CACHE_VERSION}`, {
            cache: 'no-store'
        });

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        resumoPublicacaoSistemaCache = await resposta.json();
        return resumoPublicacaoSistemaCache;
    } catch (error) {
        resumoPublicacaoSistemaCache = {
            indisponivel: true,
            mensagem: `Resumo de publicação não disponível. ${error.message}`
        };
        return resumoPublicacaoSistemaCache;
    }
}

function obterMensagemSalvamento(payload) {
    return payload?.message || 'Alterações salvas com sucesso. Dados públicos atualizados.';
}

function fecharMenuLateral() {
    const sidebar = document.getElementById('app-sidebar');
    const offcanvas = sidebar && window.bootstrap?.Offcanvas?.getInstance(sidebar);
    if (offcanvas) offcanvas.hide();
}

function alternarPastaRepassesFunpen(forceOpen = null) {
    const botao = document.getElementById('btn-repasses-funpen');
    const submenu = document.getElementById('submenu-repasses-funpen');
    if (!botao || !submenu) return;

    const deveAbrir = forceOpen === null
        ? submenu.classList.contains('d-none')
        : Boolean(forceOpen);
    submenu.classList.toggle('d-none', !deveAbrir);
    botao.setAttribute('aria-expanded', String(deveAbrir));
    botao.classList.toggle('active', deveAbrir);
}

function obterUfsOrdenadasParaExportacao() {
    const ufsPorRegiao = ORDEM_REGIOES.flatMap((regiao) => catalogoAplicacao.regioes?.[regiao] || []);
    const ufsComDados = Array.from(new Set(dadosFaf.map((item) => item.uf).filter(Boolean))).sort();
    const ufsOrdenadas = ufsPorRegiao.length ? ufsPorRegiao : ufsComDados;

    return Array.from(new Set(ufsOrdenadas)).filter((uf) => (
        catalogoAplicacao.nomesEstados?.[uf] || ufsComDados.includes(uf)
    ));
}

function renderizarOpcoesExportacaoUf() {
    const listas = Array.from(document.querySelectorAll('#detail-uf-export-list'));
    if (listas.length === 0) return;

    listas.forEach((lista) => {
        lista.innerHTML = '';

        if (!dadosFinanceirosValidados) {
            const aviso = document.createElement('span');
            aviso.className = 'sidebar-helper-text';
            aviso.textContent = 'Carregue uma planilha válida para exportar relatórios estaduais.';
            lista.appendChild(aviso);
            return;
        }

        obterUfsOrdenadasParaExportacao().forEach((uf) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'sidebar-uf-option';
            botao.textContent = uf;
            botao.title = catalogoAplicacao.nomesEstados?.[uf] || uf;
            botao.addEventListener('click', () => exportarRelatorioEstadoSelecionado(uf));
            lista.appendChild(botao);
        });
    });
}

function abrirSelecaoUfExportacao() {
    const painel = document.getElementById('detail-uf-export-panel');
    const botao = document.getElementById('btn-detail-export-state-pdf');
    if (!painel || !botao) return;

    if (!dadosFinanceirosValidados) {
        mostrarAlertaCarregamentoPlanilha(
            'Dados financeiros indisponiveis: carregue uma planilha valida antes de exportar relatórios estaduais.',
            true,
            'danger'
        );
        return;
    }

    renderizarOpcoesExportacaoUf();
    const vaiAbrir = painel.classList.contains('d-none');
    painel.classList.toggle('d-none', !vaiAbrir);
    botao.setAttribute('aria-expanded', String(vaiAbrir));

    if (vaiAbrir) {
        painel.querySelector('button')?.focus();
    }
}

async function exportarRelatorioEstadoSelecionado(uf) {
    if (!dadosFinanceirosValidados) return;
    abrirDetalheEstado(uf);
    await new Promise(resolve => setTimeout(resolve, 180));
    await exportarRelatorioPDF();
}

// ========================================================================
// NAVEGACAO
// ========================================================================

function atualizarNavegacao(viewName = 'dashboard') {
    const viewAtiva = viewName === 'estado-detalhe'
        ? 'detalhamento'
        : viewName === 'profor-convenio-detalhe'
            ? 'profor2022'
            : viewName === 'formalizacao-detalhe'
                ? 'formalizacao'
            : viewName === 'faf2021-detalhe'
                ? 'faf2021'
                : viewName === 'doacoes2023-detalhe'
                    ? 'doacoes2023'
                    : viewName;
    document.body.dataset.currentView = viewName;

    document.querySelectorAll('.app-menu-link').forEach((botao) => {
        const ativo = botao.dataset.view === viewAtiva;
        botao.classList.toggle('active', ativo);
        if (ativo) {
            botao.setAttribute('aria-current', 'page');
        } else {
            botao.removeAttribute('aria-current');
        }
    });

    const btnExportarRelatorioDetalhe = document.getElementById('btn-detail-export-state-pdf');
    if (btnExportarRelatorioDetalhe) {
        const podeExportarRelatorio = dadosFinanceirosValidados;
        btnExportarRelatorioDetalhe.disabled = !podeExportarRelatorio;
        btnExportarRelatorioDetalhe.setAttribute('aria-disabled', String(!podeExportarRelatorio));
    }

    const btnExportDashboard = document.getElementById('btn-export-dashboard');
    if (btnExportDashboard) {
        btnExportDashboard.classList.toggle('d-none', viewName !== 'dashboard');
    }

    const btnDetalhamentoHeader = document.querySelector('#header-actions button[onclick="toggleView(\'detalhamento\')"]');
    if (btnDetalhamentoHeader) {
        btnDetalhamentoHeader.classList.toggle('d-none', viewName !== 'dashboard');
    }

    alternarPastaRepassesFunpen(VIEWS_REPASSES_FUNPEN.has(viewName));
}

// ========================================================================
// LOADING / ALERTAS
// ========================================================================

function showLoading(mensagem = 'Processando...') {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    if (msgEl) msgEl.textContent = mensagem;
    if (overlay) overlay.classList.remove('d-none');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('d-none');
}

async function carregarLogoParaPDF() {
    return carregarLogoLocalParaPDF();
}

// ========================================================================
// CARREGAMENTO DE DADOS
// ========================================================================

        const LOGO_SENAPPEN_LOCAL = './frontend/assets/senappen-logo.png';

        async function carregarLogoLocalParaPDF() {
            const logoImg = document.getElementById('img-logo-senappen');
            if (!logoImg) return;

            const fallback = document.getElementById('logo-senappen-fallback');
            logoImg.width = 210;
            logoImg.height = 64;
            logoImg.style.width = '';
            logoImg.style.height = '';
            logoImg.style.objectFit = 'contain';

            logoImg.onload = () => {
                logoImg.classList.remove('d-none');
                fallback?.classList.add('d-none');
            };
            logoImg.onerror = () => {
                logoImg.classList.add('d-none');
                fallback?.classList.remove('d-none');
            };

            if (!logoImg.getAttribute('src')?.includes('senappen-logo.png')) {
                logoImg.src = LOGO_SENAPPEN_LOCAL;
            }
        }

        function abrirSeletorManualPlanilha() {
            const input = document.getElementById('input-planilha-convenios');
            if (input) input.click();
        }

        function mostrarAlertaCarregamentoPlanilha(mensagem, permitirSelecaoManual = false, tipo = 'warning') {
            const alerta = document.getElementById('alerta-carregamento-planilha');
            if (!alerta) return;
            alerta.innerHTML = '';
            alerta.classList.remove('alert-warning', 'alert-danger', 'alert-success', 'alert-info');
            alerta.classList.add(`alert-${tipo}`);

            const texto = document.createElement('span');
            texto.textContent = mensagem;
            alerta.appendChild(texto);

            if (permitirSelecaoManual) {
                const wrapper = document.createElement('div');
                wrapper.className = 'mt-2';

                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'btn btn-sm btn-outline-primary btn-icon-text';
                botao.innerHTML = '<i class="fas fa-file-excel" aria-hidden="true"></i><span>Selecionar planilha manualmente</span>';
                botao.addEventListener('click', abrirSeletorManualPlanilha);

                wrapper.appendChild(botao);
                alerta.appendChild(wrapper);
            }

            alerta.classList.remove('d-none');
        }

        function ocultarAlertaCarregamentoPlanilha() {
            const alerta = document.getElementById('alerta-carregamento-planilha');
            if (!alerta) return;
            alerta.textContent = '';
            alerta.classList.add('d-none');
        }

        function configurarEstadoDadosValidados(validado) {
            dadosFinanceirosValidados = validado;
            const btnExportDashboard = document.getElementById('btn-export-dashboard');
            const botoesDetalhamento = document.querySelectorAll(`
                button[onclick="toggleView('detalhamento')"],
                button[onclick="toggleView('profor2022')"],
                .app-menu-link[data-view="detalhamento"],
                .app-menu-link[data-view="profor2022"]
            `);

            [btnExportDashboard, ...botoesDetalhamento].forEach((botao) => {
                if (!botao) return;
                botao.disabled = !validado;
                botao.classList.toggle('disabled', !validado);
                botao.setAttribute('aria-disabled', String(!validado));
            });

            atualizarNavegacao(document.body.dataset.currentView || 'dashboard');
            renderizarOpcoesExportacaoUf();

            if (!validado) {
                const painelExportacaoUf = document.getElementById('detail-uf-export-panel');
                const btnExportarRelatorioMenu = document.getElementById('btn-detail-export-state-pdf');
                painelExportacaoUf?.classList.add('d-none');
                btnExportarRelatorioMenu?.setAttribute('aria-expanded', 'false');
            }
        }

        function bloquearDadosFinanceiros(error) {
            dadosFaf = [];
            configurarEstadoDadosValidados(false);
            initDashboard(dadosFaf);
            renderDetailsView();
            if (document.body.dataset.currentView === 'profor2022') {
                renderProfor2022View();
            }
            mostrarAlertaCarregamentoPlanilha(
                `Dados financeiros indisponiveis: a planilha nao foi carregada ou validada. ${error.message}`,
                true,
                'danger'
            );
        }

        async function processarSelecaoManualPlanilha(event) {
            const arquivoSelecionado = event.target.files?.[0];
            if (!arquivoSelecionado) return;

            try {
        showLoading('Lendo e validando planilha...');
                dadosFaf = await processarArquivoPlanilhaSelecionado(arquivoSelecionado, catalogoAplicacao);
                configurarEstadoDadosValidados(true);
                ocultarAlertaCarregamentoPlanilha();
                initDashboard(dadosFaf);
                renderDetailsView();
                if (document.body.dataset.currentView === 'profor2022') {
                    renderProfor2022View();
                } else if (document.body.dataset.currentView === 'profor-convenio-detalhe' && proforConvenioAtual) {
                    abrirDetalheConvenioProfor(proforConvenioAtual, proforFiltroAreaAtual);
                }
            } catch (error) {
                console.error('Falha ao processar a planilha selecionada manualmente:', error);
                bloquearDadosFinanceiros(error);
            } finally {
                event.target.value = '';
            hideLoading();
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            carregarLogoLocalParaPDF();

            const inputPlanilha = document.getElementById('input-planilha-convenios');
            if (inputPlanilha) {
                inputPlanilha.addEventListener('change', processarSelecaoManualPlanilha);
            }

            document.getElementById('btn-repasses-funpen')?.addEventListener('click', () => alternarPastaRepassesFunpen());

            const btnSelecionarPlanilha = document.getElementById('btn-selecionar-planilha');
            if (btnSelecionarPlanilha) {
                btnSelecionarPlanilha.addEventListener('click', () => {
                    fecharMenuLateral();
                    abrirSeletorManualPlanilha();
                });
            }

            const filtroAtivoBadge = document.getElementById('filtroAtivoBadge');
            if (filtroAtivoBadge) {
                filtroAtivoBadge.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        filtroAtivoBadge.click();
                    }
                });
            }

            atualizarNavegacao('dashboard');
            document.getElementById('view-dashboard').style.display = 'block';
            const inicioBootstrapMinimo = DEBUG_PERF_ONASP ? performance.now() : 0;
            registrarPerfOrcamento('bootstrap:minimo', inicioBootstrapMinimo, {
                viewInicial: document.body.dataset.currentView || 'dashboard'
            });
        });

        // --- CONTROLE DE VISUALIZACAO (SPA) ---
        // Alterna entre as views principais sem recarregar a página. A view de
        // orçamento é carregada sob demanda porque depende de uma planilha extra.
        function obterMensagemCarregamentoView(viewName) {
            if (viewName === 'orcamento' && !obterDadosOrcamento()) return 'Carregando Orçamento 2026...';
            if (['formalizacao', 'formalizacao-detalhe'].includes(viewName) && !obterDadosFormalizacaoProfor()) return 'Carregando Formalização PROFOR...';
            if (viewName === 'diagnostico-ouvidorias' && !obterDadosDiagnosticoOuvidorias()) return 'Carregando Parâmetros Mínimos...';
            if (viewName === 'contatos' && (!obterDadosContatos() || !obterDadosContatos().disponivel)) return 'Carregando Contatos UFs...';
            return '';
        }

        async function garantirDadosDaView(viewName) {
            if (['dashboard', 'detalhamento', 'estado-detalhe', 'profor2022', 'profor-convenio-detalhe', 'faf2021', 'faf2021-detalhe', 'doacoes2023', 'doacoes2023-detalhe'].includes(viewName)) {
                await garantirDadosBaseAplicacao();
            }

            if (viewName === 'orcamento' && !obterDadosOrcamento()) {
                const inicioOrcamento = DEBUG_PERF_ONASP ? performance.now() : 0;
                await carregarDadosOrcamento();
                registrarPerfOrcamento('garantirDadosDaView:carregarDadosOrcamento', inicioOrcamento, {
                    viewName,
                    cacheExiste: Boolean(obterDadosOrcamento())
                });
                erroCarregamentoOrcamento = null;
            }

            if (viewName === 'orcamento') {
                const inicioMovimentacoes = DEBUG_PERF_ONASP ? performance.now() : 0;
                await carregarMovimentacoesOrcamento2026();
                registrarPerfOrcamento('garantirDadosDaView:carregarMovimentacoesOrcamento2026', inicioMovimentacoes, {
                    viewName,
                    movimentacoes: orcamentoMovimentacoes.length
                });
            }

            if (['formalizacao', 'formalizacao-detalhe'].includes(viewName) && !obterDadosFormalizacaoProfor()) {
                await carregarDadosFormalizacaoProfor();
            }

            if (viewName === 'diagnostico-ouvidorias' && !obterDadosDiagnosticoOuvidorias()) {
                await carregarDadosDiagnosticoOuvidorias();
            }

            if (viewName === 'contatos' && (!obterDadosContatos() || !obterDadosContatos().disponivel)) {
                await carregarDadosContatos();
            }
        }

        async function garantirDadosBaseAplicacao() {
            if (baseAplicacaoCarregamentoPromise) {
                return baseAplicacaoCarregamentoPromise;
            }

            const catalogoAplicacaoCarregado = Boolean(catalogoAplicacao?.dadosBase?.length)
                && Boolean(catalogoAplicacao?.configuracao?.arquivoPlanilhaConvenios);
            if (catalogoAplicacaoCarregado && Array.isArray(dadosFaf) && dadosFaf.length && dadosFinanceirosValidados) {
                return { catalogoAplicacao, dadosFaf };
            }

            const inicioBase = DEBUG_PERF_ONASP ? performance.now() : 0;
            baseAplicacaoCarregamentoPromise = (async () => {
                if (!catalogoAplicacaoCarregado) {
                    catalogoAplicacao = await carregarCatalogoAplicacao();
                }

                if (!Array.isArray(dadosFaf) || !dadosFaf.length || !dadosFinanceirosValidados) {
                    dadosFaf = await carregarDadosAplicacao(catalogoAplicacao);
                    configurarEstadoDadosValidados(true);
                    ocultarAlertaCarregamentoPlanilha();
                    initDashboard(dadosFaf);
                    renderDetailsView();
                }

                if (document.body.dataset.currentView === 'profor2022') {
                    renderProfor2022View();
                } else if (document.body.dataset.currentView === 'profor-convenio-detalhe' && proforConvenioAtual) {
                    abrirDetalheConvenioProfor(proforConvenioAtual, proforFiltroAreaAtual);
                }

                aplicarModoSomenteLeitura();
                registrarPerfOrcamento('garantirDadosBaseAplicacao', inicioBase, {
                    totalRegistros: Array.isArray(dadosFaf) ? dadosFaf.length : 0,
                    catalogoCarregado: Boolean(catalogoAplicacao)
                });
                return { catalogoAplicacao, dadosFaf };
            })().catch((error) => {
                console.error('Falha ao carregar a base geral da aplicacao:', error);
                bloquearDadosFinanceiros(error);
                return null;
            }).finally(() => {
                baseAplicacaoCarregamentoPromise = null;
            });

            return baseAplicacaoCarregamentoPromise;
        }

        function renderizarErroView(viewName, error) {
            const ids = {
                orcamento: 'view-orcamento',
                formalizacao: 'view-formalizacao-profor',
                'formalizacao-detalhe': 'view-formalizacao-profor-detalhe',
                'diagnostico-ouvidorias': 'view-diagnostico-ouvidorias',
                contatos: 'view-contatos',
                'status-sistema': 'view-status-sistema'
            };
            const view = document.getElementById(ids[viewName]);
            if (!view) return;
            const config = VIEW_ERROR_MESSAGES[viewName] || {
                titulo: 'Não foi possível carregar esta página.',
                detalhe: 'Tente recarregar a aplicação ou verificar a origem dos dados.'
            };

            view.innerHTML = renderErrorState({
                titulo: config.titulo,
                detalhe: config.detalhe,
                error
            });
            view.style.display = 'block';
            aplicarModoSomenteLeitura();
        }

        function formatarDataStatusSistema(valor) {
            if (!valor) return 'Não disponível';
            const data = new Date(valor);
            return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleString('pt-BR');
        }

        function obterModoContatosStatusSistema() {
            if (estaEmModoPublicacaoEstatica()) {
                return { modo: 'estatico', rotulo: 'Publicação estática' };
            }

            const dadosContatos = obterDadosContatos();
            if (dadosContatos?.disponivel) {
                return { modo: 'api', rotulo: 'Local' };
            }

            return { modo: 'api', rotulo: 'Local / indisponível' };
        }

        function montarAlertasStatusSistema({ dadosOrcamento, dadosFormalizacao, dadosDiagnostico, dadosContatos, resumoPublicacao }) {
            const alertas = [];

            if (estaEmModoPublicacaoEstatica()) {
                alertas.push('A aplicação está em modo publicação estática: ações de edição permanecem bloqueadas.');
            }

            if (!dadosOrcamento?.itens?.length) {
                alertas.push('Orçamento 2026 sem itens carregados.');
            }

            if (!dadosFormalizacao?.propostas?.length) {
                alertas.push('Formalização PROFOR sem propostas carregadas.');
            }

            if (!dadosDiagnostico?.respostas?.length) {
                alertas.push('Parâmetros Mínimos sem registros carregados.');
            }

            if (!dadosContatos?.disponivel) {
                alertas.push('Contatos UFs indisponíveis ou não carregados.');
            }

            if (resumoPublicacao?.indisponivel) {
                alertas.push('Resumo de publicação não disponível.');
            }

            return alertas;
        }

        async function renderStatusSistemaView() {
            const container = document.getElementById('view-status-sistema');
            if (!container) return;

            container.style.display = 'block';

            const [dadosOrcamento, dadosFormalizacao, dadosDiagnostico, dadosContatos, resumoPublicacao] = await Promise.all([
                obterDadosOrcamento() || carregarDadosOrcamento().catch(() => null),
                obterDadosFormalizacaoProfor() || carregarDadosFormalizacaoProfor().catch(() => null),
                obterDadosDiagnosticoOuvidorias() || carregarDadosDiagnosticoOuvidorias().catch(() => null),
                obterDadosContatos() || carregarDadosContatos().catch(() => null),
                carregarResumoPublicacaoSistema()
            ]);

            const modoAplicacao = estaEmModoPublicacaoEstatica() ? 'estatico' : 'api';
            const modoContatos = obterModoContatosStatusSistema();
            const totalRegistrosHome = Array.isArray(catalogoAplicacao?.dadosBase) ? catalogoAplicacao.dadosBase.length : 0;
            const totalItensOrcamento = Array.isArray(dadosOrcamento?.itens) ? dadosOrcamento.itens.length : 0;
            const totalPropostasFormalizacao = Array.isArray(dadosFormalizacao?.propostas) ? dadosFormalizacao.propostas.length : 0;
            const respostasDiagnostico = Array.isArray(dadosDiagnostico?.respostas) ? dadosDiagnostico.respostas : [];
            const totalUfsDiagnostico = new Set(respostasDiagnostico.map((item) => item.uf).filter(Boolean)).size;
            const totalContatosUfs = dadosContatos?.disponivel
                ? new Set([
                    ...Array.from(dadosContatos?.cadastroPorUf?.keys?.() || []),
                    ...Array.from(dadosContatos?.pessoasPorUf?.keys?.() || [])
                ]).size
                : 0;
            const alertas = montarAlertasStatusSistema({
                dadosOrcamento,
                dadosFormalizacao,
                dadosDiagnostico,
                dadosContatos,
                resumoPublicacao
            });

            container.innerHTML = `
                <section class="view-heading">
                    ${renderActionButton({
                        type: 'back',
                        label: 'Voltar ao Painel Geral',
                        onClick: "toggleView('dashboard')",
                        variant: 'outline-secondary',
                        extraClass: 'pdf-hidden'
                    })}
                    <div>
                        <p class="section-eyebrow mb-1">Diagnóstico técnico</p>
                        <h2>Status do Sistema</h2>
                    </div>
                </section>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Resumo do ambiente">
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Ambiente',
                            valor: renderSystemModeBadge(modoAplicacao, modoAplicacao === 'estatico' ? 'Publicação estática' : 'Local'),
                            descricao: 'Modo geral da aplicação',
                            icon: 'fa-server',
                            variant: modoAplicacao === 'estatico' ? 'warning' : 'success'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Cache do front-end',
                            valor: `<span>${APP_CACHE_VERSION}</span>`,
                            descricao: `analytics ${ANALYTICS_CACHE_VERSION}`,
                            icon: 'fa-code-branch',
                            variant: 'info'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Última publicação',
                            valor: `<span>${escapeHtml(formatarDataStatusSistema(resumoPublicacao?.publicadoEm))}</span>`,
                            descricao: resumoPublicacao?.fonte || 'Resumo de publicação não disponível',
                            icon: 'fa-cloud-arrow-up',
                            variant: resumoPublicacao?.indisponivel ? 'warning' : 'success'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Alertas ativos',
                            valor: `<span>${alertas.length}</span>`,
                            descricao: alertas.length ? 'Pontos para conferir' : 'Nenhum alerta relevante',
                            icon: 'fa-triangle-exclamation',
                            variant: alertas.length ? 'warning' : 'success'
                        })}
                    </div>
                </section>

                <section class="system-status-panel mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Modo por página</p>
                            <h2>Fontes de dados</h2>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm app-data-table system-status-table">
                            <thead>
                                <tr>
                                    <th>Página</th>
                                    <th>Modo</th>
                                    <th>Observação</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Home</td>
                                    <td>${renderSystemModeBadge(obterModoDadosOnasp('aplicacao'), obterModoDadosOnasp('aplicacao') === 'estatico' ? 'Publicação estática' : 'Local')}</td>
                                    <td>Catálogo e dados-base da aplicação</td>
                                </tr>
                                <tr>
                                    <td>Orçamento 2026</td>
                                    <td>${renderSystemModeBadge(obterModoDadosOnasp('orcamento2026'), obterModoDadosOnasp('orcamento2026') === 'estatico' ? 'Publicação estática' : 'Local')}</td>
                                    <td>${totalItensOrcamento} item(ns) carregado(s)</td>
                                </tr>
                                <tr>
                                    <td>Formalização PROFOR</td>
                                    <td>${renderSystemModeBadge(obterModoDadosOnasp('formalizacaoProfor'), obterModoDadosOnasp('formalizacaoProfor') === 'estatico' ? 'Publicação estática' : 'Local')}</td>
                                    <td>${totalPropostasFormalizacao} proposta(s)/UF(s)</td>
                                </tr>
                                <tr>
                                    <td>Parâmetros Mínimos</td>
                                    <td>${renderSystemModeBadge(obterModoDadosOnasp('parametrosMinimos'), obterModoDadosOnasp('parametrosMinimos') === 'estatico' ? 'Publicação estática' : 'Local')}</td>
                                    <td>${respostasDiagnostico.length} registro(s) e ${totalUfsDiagnostico} UF(s)</td>
                                </tr>
                                <tr>
                                    <td>Contatos</td>
                                    <td>${renderSystemModeBadge(modoContatos.modo, modoContatos.rotulo)}</td>
                                    <td>${dadosContatos?.disponivel ? `${totalContatosUfs} UF(s) com contatos` : 'Indisponível'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Dados carregados">
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Home',
                            valor: `<span>${totalRegistrosHome}</span>`,
                            descricao: 'Registros da base principal',
                            icon: 'fa-home',
                            variant: totalRegistrosHome ? 'success' : 'warning'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Orçamento',
                            valor: `<span>${totalItensOrcamento}</span>`,
                            descricao: 'Itens orçamentários',
                            icon: 'fa-wallet',
                            variant: totalItensOrcamento ? 'success' : 'warning'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Formalização',
                            valor: `<span>${totalPropostasFormalizacao}</span>`,
                            descricao: 'UFs/propostas carregadas',
                            icon: 'fa-file-signature',
                            variant: totalPropostasFormalizacao ? 'success' : 'warning'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Parâmetros',
                            valor: `<span>${respostasDiagnostico.length}</span>`,
                            descricao: `${totalUfsDiagnostico} UF(s) com diagnóstico`,
                            icon: 'fa-clipboard-check',
                            variant: respostasDiagnostico.length ? 'success' : 'warning'
                        })}
                    </div>
                </section>

                <section class="system-status-panel mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Alertas úteis</p>
                            <h2>Validação rápida</h2>
                        </div>
                    </div>
                    ${alertas.length ? `
                        <div class="system-status-alert-list">
                            ${alertas.map((alerta) => `
                                <div class="system-status-alert-item">
                                    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
                                    <span>${escapeHtml(alerta)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : renderEmptyState({
                        titulo: 'Nenhum alerta relevante no momento.',
                        descricao: 'Os dados principais e a publicação estão disponíveis para consulta.',
                        icon: 'fa-circle-check'
                    })}
                </section>
            `;

            aplicarModoSomenteLeitura();
        }

        async function toggleView(viewName) {
            if (viewName === 'orcamento' && !obterDadosOrcamento()) {
                const inicioToggleOrcamento = DEBUG_PERF_ONASP ? performance.now() : 0;
                document.getElementById('view-dashboard').style.display = 'none';
                document.getElementById('view-detalhamento').style.display = 'none';
                document.getElementById('view-estado-detalhe').style.display = 'none';
                const viewProfor = document.getElementById('view-profor-2022');
                const viewProforDetalhe = document.getElementById('view-profor-convenio-detalhe');
                const viewFaf = document.getElementById('view-faf-2021');
                const viewFafDetalhe = document.getElementById('view-faf-2021-detalhe');
                const viewDoacoes = document.getElementById('view-doacoes-2023');
                const viewDoacoesDetalhe = document.getElementById('view-doacoes-2023-detalhe');
                const viewOrcamento = document.getElementById('view-orcamento');
                const viewFormalizacao = document.getElementById('view-formalizacao-profor');
                const viewContatos = document.getElementById('view-contatos');
                const viewDiagnosticoOuvidorias = document.getElementById('view-diagnostico-ouvidorias');
                const viewFormalizacaoDetalhe = document.getElementById('view-formalizacao-profor-detalhe');
                const viewStatusSistema = document.getElementById('view-status-sistema');
                if (viewProfor) viewProfor.style.display = 'none';
                if (viewProforDetalhe) viewProforDetalhe.style.display = 'none';
                if (viewFaf) viewFaf.style.display = 'none';
                if (viewFafDetalhe) viewFafDetalhe.style.display = 'none';
                if (viewDoacoes) viewDoacoes.style.display = 'none';
                if (viewDoacoesDetalhe) viewDoacoesDetalhe.style.display = 'none';
                if (viewOrcamento) viewOrcamento.style.display = 'none';
                if (viewFormalizacao) viewFormalizacao.style.display = 'none';
                if (viewContatos) viewContatos.style.display = 'none';
                if (viewDiagnosticoOuvidorias) viewDiagnosticoOuvidorias.style.display = 'none';
                if (viewFormalizacaoDetalhe) viewFormalizacaoDetalhe.style.display = 'none';
                if (viewStatusSistema) viewStatusSistema.style.display = 'none';

                renderOrcamentoViewSkeleton();
                registrarPerfOrcamento('toggleView:orcamento skeleton', inicioToggleOrcamento);

                try {
                    const inicioDadosOrcamento = DEBUG_PERF_ONASP ? performance.now() : 0;
                    await garantirDadosDaView(viewName);
                    registrarPerfOrcamento('toggleView:orcamento dados', inicioDadosOrcamento, {
                        viewName,
                        temDados: Boolean(obterDadosOrcamento())
                    });
                    delete errosCarregamentoView[viewName];
                    const inicioRenderOrcamento = DEBUG_PERF_ONASP ? performance.now() : 0;
                    renderOrcamentoView();
                    registrarPerfOrcamento('toggleView:orcamento render', inicioRenderOrcamento, {
                        viewName
                    });
                } catch (error) {
                    errosCarregamentoView[viewName] = error;
                    erroCarregamentoOrcamento = error;
                    console.error(`Falha ao carregar ${viewName}:`, error);
                    renderizarErroView(viewName, error);
                }
                return;
            }

            const mensagemCarregamento = obterMensagemCarregamentoView(viewName);
            if (mensagemCarregamento) showLoading(mensagemCarregamento);

            try {
                await garantirDadosDaView(viewName);
                delete errosCarregamentoView[viewName];
            } catch (error) {
                errosCarregamentoView[viewName] = error;
                if (viewName === 'orcamento') erroCarregamentoOrcamento = error;
                console.error(`Falha ao carregar ${viewName}:`, error);
            } finally {
                if (mensagemCarregamento) hideLoading();
            }

            const podeAbrirOrcamento = viewName === 'orcamento' && obterDadosOrcamento();
            const podeAbrirContatos = viewName === 'contatos' && obterDadosContatos();
            const podeAbrirDiagnosticoOuvidorias = viewName === 'diagnostico-ouvidorias' && obterDadosDiagnosticoOuvidorias();
            const podeAbrirFormalizacao = ['formalizacao', 'formalizacao-detalhe'].includes(viewName);
            const podeAbrirStatusSistema = viewName === 'status-sistema';
            const podeAbrirComDadosEstaticos = ['faf2021', 'faf2021-detalhe', 'doacoes2023', 'doacoes2023-detalhe'].includes(viewName);

            if (!dadosFinanceirosValidados && viewName !== 'dashboard' && !podeAbrirOrcamento && !podeAbrirContatos && !podeAbrirDiagnosticoOuvidorias && !podeAbrirFormalizacao && !podeAbrirStatusSistema && !podeAbrirComDadosEstaticos) {
                mostrarAlertaCarregamentoPlanilha(
                    'Dados financeiros indisponiveis: carregue uma planilha valida antes de acessar detalhes ou exportacoes.',
                    true,
                    'danger'
                );
                viewName = 'dashboard';
            }

            document.getElementById('view-dashboard').style.display = 'none';
            document.getElementById('view-detalhamento').style.display = 'none';
            document.getElementById('view-estado-detalhe').style.display = 'none';
            const viewProfor = document.getElementById('view-profor-2022');
            const viewProforDetalhe = document.getElementById('view-profor-convenio-detalhe');
            const viewFaf = document.getElementById('view-faf-2021');
            const viewFafDetalhe = document.getElementById('view-faf-2021-detalhe');
            const viewDoacoes = document.getElementById('view-doacoes-2023');
            const viewDoacoesDetalhe = document.getElementById('view-doacoes-2023-detalhe');
            const viewOrcamento = document.getElementById('view-orcamento');
            const viewFormalizacao = document.getElementById('view-formalizacao-profor');
            const viewContatos = document.getElementById('view-contatos');
            const viewDiagnosticoOuvidorias = document.getElementById('view-diagnostico-ouvidorias');
            const viewFormalizacaoDetalhe = document.getElementById('view-formalizacao-profor-detalhe');
            const viewStatusSistema = document.getElementById('view-status-sistema');
            if (viewProfor) viewProfor.style.display = 'none';
            if (viewProforDetalhe) viewProforDetalhe.style.display = 'none';
            if (viewFaf) viewFaf.style.display = 'none';
            if (viewFafDetalhe) viewFafDetalhe.style.display = 'none';
            if (viewDoacoes) viewDoacoes.style.display = 'none';
            if (viewDoacoesDetalhe) viewDoacoesDetalhe.style.display = 'none';
            if (viewOrcamento) viewOrcamento.style.display = 'none';
            if (viewFormalizacao) viewFormalizacao.style.display = 'none';
            if (viewContatos) viewContatos.style.display = 'none';
            if (viewDiagnosticoOuvidorias) viewDiagnosticoOuvidorias.style.display = 'none';
            if (viewFormalizacaoDetalhe) viewFormalizacaoDetalhe.style.display = 'none';
            if (viewStatusSistema) viewStatusSistema.style.display = 'none';

            if (viewName === 'detalhamento') {
                renderDetailsView();
                document.getElementById('view-detalhamento').style.display = 'block';
            } else if (viewName === 'estado-detalhe') {
                document.getElementById('view-estado-detalhe').style.display = 'block';
            } else if (viewName === 'profor2022') {
                renderProfor2022View();
            } else if (viewName === 'profor-convenio-detalhe') {
                if (viewProforDetalhe) viewProforDetalhe.style.display = 'block';
            } else if (viewName === 'faf2021') {
                renderFaf2021View();
            } else if (viewName === 'faf2021-detalhe') {
                if (viewFafDetalhe) viewFafDetalhe.style.display = 'block';
            } else if (viewName === 'doacoes2023') {
                renderDoacoes2023View();
            } else if (viewName === 'doacoes2023-detalhe') {
                if (viewDoacoesDetalhe) viewDoacoesDetalhe.style.display = 'block';
            } else if (viewName === 'orcamento') {
                if (errosCarregamentoView[viewName]) {
                    renderizarErroView(viewName, errosCarregamentoView[viewName]);
                } else {
                    renderOrcamentoView();
                }
            } else if (viewName === 'contatos') {
                if (errosCarregamentoView[viewName]) {
                    renderizarErroView(viewName, errosCarregamentoView[viewName]);
                } else {
                    renderContatosView();
                }
            } else if (viewName === 'diagnostico-ouvidorias') {
                if (errosCarregamentoView[viewName]) {
                    renderizarErroView(viewName, errosCarregamentoView[viewName]);
                } else {
                    renderDiagnosticoOuvidoriasView();
                }
            } else if (viewName === 'formalizacao') {
                if (errosCarregamentoView[viewName]) {
                    renderizarErroView(viewName, errosCarregamentoView[viewName]);
                } else {
                    renderFormalizacaoProforView();
                }
            } else if (viewName === 'formalizacao-detalhe') {
                if (errosCarregamentoView[viewName]) {
                    renderizarErroView(viewName, errosCarregamentoView[viewName]);
                } else {
                    renderFormalizacaoProforDetalheView();
                }
            } else if (viewName === 'status-sistema') {
                await renderStatusSistemaView();
            } else {
                document.getElementById('view-dashboard').style.display = 'block';
            }

            atualizarNavegacao(viewName);
            fecharMenuLateral();
            aplicarModoSomenteLeitura();
            window.scrollTo(0, 0);
        }

        // ========================================================================
        // DASHBOARD
        // ========================================================================
        function initDashboard(data) {
            if (chartInstancia) chartInstancia.destroy();
            if (tabelaInstancia) {
                tabelaInstancia.destroy();
                $('#tabelaItens').empty(); 
                // Cabeçalho da tabela
                $('#tabelaItens').html('<thead><tr><th class="text-center">Inst.</th><th>UF</th><th>Objeto</th><th class="text-center">Qtd.</th><th class="text-end">Valor Unit. (R$)</th><th class="text-end">Valor Total (R$)</th><th class="text-end">Executado (R$)</th><th class="text-center">%</th></tr></thead><tbody></tbody>');
            }

            const analise = processarDadosAgregados(data);
            const resumoInstrumentos = calcularResumoInstrumentos(data);
            
            renderKPIs(analise.global, analise.ufsUnicas, resumoInstrumentos);
            renderChart(analise.dadosPorUF);
            registrarFiltroDataTable();
            filtroTabelaAtual = null;
            initTable(data);
            
            atualizarOpcoesFiltrosVisiveis(obterEstadoFiltroAtual());
            
            setupEventListeners();
            atualizarCardsDinamicos();
        }

        // ========================================================================
        // DETALHAMENTO
        // ========================================================================
        function renderDetailsView() {
            const container = document.getElementById('container-estados');
            container.innerHTML = ''; 

            if (!dadosFinanceirosValidados) {
                container.innerHTML = '<div class="alert alert-danger">Dados financeiros indisponiveis. Carregue uma planilha valida para visualizar o detalhamento por estado.</div>';
                return;
            }

            const corRegiao = {
                "NORTE": "bg-norte",
                "NORDESTE": "bg-nordeste",
                "CENTRO-OESTE": "bg-centro-oeste",
                "SUDESTE": "bg-sudeste",
                "SUL": "bg-sul"
            };

            ORDEM_REGIOES.forEach(regiao => {
                const regionHeader = document.createElement('div');
                regionHeader.className = 'region-title';
                regionHeader.textContent = regiao;
                container.appendChild(regionHeader);

                const row = document.createElement('div');
                row.className = 'row g-4'; 

                const estadosDaRegiao = catalogoAplicacao.regioes[regiao] || [];
                const bgClass = corRegiao[regiao] || "";
                
                estadosDaRegiao.forEach(uf => {
                    const metrics = calculateStateMetrics(uf, dadosFaf);
                    const nomeEstado = catalogoAplicacao.nomesEstados[uf] || uf;
                    const safeUf = escapeHtml(uf);
                    const safeNomeEstado = escapeHtml(nomeEstado);
                    
                    const flagUrl = catalogoAplicacao.imagensBandeiras[uf] || "";
                    const safeFlagUrl = escapeHtml(flagUrl);
                    
                    const imgElement = flagUrl 
                        ? `<img src="${safeFlagUrl}" alt="Bandeira ${safeUf}" class="state-flag" onerror="this.onerror=null;this.src='';this.style.display='none';this.nextElementSibling.style.display='inline-block';"> <i class="fas fa-flag text-secondary flag-placeholder flag-placeholder-hidden"></i>`
                        : `<i class="fas fa-flag text-secondary flag-placeholder"></i>`;

                    const col = document.createElement('div');
                    col.className = 'col-md-6 col-lg-4';

                    col.innerHTML = `
                        <div class="state-detail-card ${bgClass}" onclick="abrirDetalheEstado('${safeUf}')">
                            <div class="state-header">
                                ${imgElement}
                                <h3 class="state-name">${safeNomeEstado} (${safeUf})</h3>
                            </div>
                            <div class="mini-card-grid">
                                <div class="mini-card">
                                    <div class="mini-card-label">Total Repassado</div>
                                    <div class="mini-card-value text-primary">${formatMoney(metrics.totalRepassado)}</div>
                                </div>
                                <div class="mini-card">
                                    <div class="mini-card-label">Execução Global</div>
                                    <div class="mini-card-value">${formatPercent(metrics.execGlobal)}</div>
                                </div>
                                <div class="mini-card">
                                    <div class="mini-card-label">Convênios</div>
                                    <div class="mini-card-value">${formatMoney(metrics.convVal)}</div>
                                </div>
                                <div class="mini-card">
                                    <div class="mini-card-label">% Exec. Convênios</div>
                                    <div class="mini-card-value">${formatPercent(metrics.convExecPct)}</div>
                                </div>
                                <div class="mini-card">
                                    <div class="mini-card-label">Fundo a Fundo 2021</div>
                                    <div class="mini-card-value">${formatMoney(metrics.fafVal)}</div>
                                </div>
                                <div class="mini-card">
                                    <div class="mini-card-label">% Exec. FAF</div>
                                    <div class="mini-card-value">${formatPercent(metrics.fafExecPct)}</div>
                                </div>
                                <div class="mini-card mini-card-full">
                                    <div class="mini-card-label">Valor Doado</div>
                                    <div class="mini-card-value text-warning">${formatMoney(metrics.doacVal)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    row.appendChild(col);
                });

                container.appendChild(row);
            });
        }

        // --- RELATÓRIO DETALHADO POR ESTADO (NOVO) ---
        function abrirDetalheEstado(uf) {
            if (!dadosFinanceirosValidados) {
                toggleView('dashboard');
                return;
            }

            estadoAtualPDF = uf;
            const itensUF = dadosFaf.filter(d => d.uf === uf);
            const nomeEstado = catalogoAplicacao.nomesEstados[uf] || uf;
            const flagUrl = catalogoAplicacao.imagensBandeiras[uf] || "";
            const safeUf = escapeHtml(uf);
            const safeNomeEstado = escapeHtml(nomeEstado);
            const safeFlagUrl = escapeHtml(flagUrl);
            
            // 1. Montar Header
            const imgElement = flagUrl 
                ? `<img src="${safeFlagUrl}" alt="Bandeira ${safeUf}" class="state-flag report-state-flag me-3">`
                : `<i class="fas fa-flag text-secondary report-state-icon me-3"></i>`;
            
            // O infoConvenioHtml foi removido daqui e passado para a secção das listas (passo 4)
            
            document.getElementById('estado-detalhe-header').innerHTML = `
                <div class="d-flex align-items-center pb-2 mt-2">
                    ${imgElement}
                    <h2 class="text-primary mb-0 fw-bold">Relatório Estadual: ${safeNomeEstado} (${safeUf})</h2>
                </div>
                <hr class="mt-2 mb-3">
            `;

            // 2. Montar KPIs
            const metrics = calculateStateMetrics(uf, dadosFaf);
            document.getElementById('estado-detalhe-kpis').innerHTML = `
                <div class="col-md-3 mb-3">
                    <div class="card kpi-card bg-white border-primary border-start border-4">
                        <div class="kpi-title">Total Repassado (UF)</div>
                        <div class="kpi-value text-money">${formatMoney(metrics.totalRepassado)}</div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card kpi-card bg-white border-success border-start border-4">
                        <div class="kpi-title">Total Executado (UF)</div>
                        <div class="kpi-value text-money text-success">${formatMoney(metrics.totalExecutado)}</div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card kpi-card bg-white border-info border-start border-4">
                        <div class="kpi-title">Exec. Global (Conv/FAF)</div>
                        <div class="kpi-value">${formatPercent(metrics.execGlobal)}</div>
                    </div>
                </div>
                <div class="col-md-3 mb-3">
                    <div class="card kpi-card bg-white border-warning border-start border-4">
                        <div class="kpi-title">Total Doado (UF)</div>
                        <div class="kpi-value text-money text-warning">${formatMoney(metrics.doacVal)}</div>
                    </div>
                </div>
            `;

            // 3. Separar itens por instrumento
            const itensFAF = itensUF.filter(i => normalizarBusca(i.instrumento).includes("faf"));
            const itensConv = itensUF.filter(i => normalizarBusca(i.instrumento).includes("conv"));
            const itensDoac = itensUF.filter(i => normalizarBusca(i.instrumento).includes("doa"));

            // 4. Função auxiliar para gerar tabelas agrupadas
            const gerarTabela = (titulo, itens, corCard, valRepassado, valExecutado, pctExecutado) => {
                if (itens.length === 0) return '';
                
                const isDoacao = normalizarBusca(titulo).includes('doacoes');
                let cardsHtml = '';
                let theadHtml = '';
                let linhas = '';

                if (isDoacao) {
                    // Cards Específicos para Doações
                    cardsHtml = `
                        <div class="row mb-3 g-2">
                            <div class="col-md-6">
                                <div class="border rounded p-2 text-center bg-white shadow-sm">
                                    <div class="text-muted small text-uppercase fw-bold mb-1">Total de Itens Doados</div>
                                    <div class="fs-5 fw-bold text-dark">${itens.length}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="border rounded p-2 text-center bg-white shadow-sm">
                                    <div class="text-muted small text-uppercase fw-bold mb-1">Valor Estimado das Doações</div>
                                    <div class="fs-5 fw-bold text-warning">${formatMoney(valRepassado)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    theadHtml = `
                        <tr>
                            <th>Objeto</th>
                            <th class="text-center">Qtd</th>
                            <th class="text-end">V. Unitário Estimado</th>
                            <th class="text-end">V. Total Estimado</th>
                        </tr>
                    `;
                    linhas = itens.map(item => {
                        const valTotal = parseFloat(item.valorTotal) || 0;
                        const safeObjeto = escapeHtml(item.objeto);
                        return `
                            <tr>
                                <td data-label="Objeto">${safeObjeto}</td>
                                <td data-label="Qtd" class="text-center align-middle">${escapeHtml(item.quantidade)}</td>
                                <td data-label="V. Unitário Estimado" class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                                <td data-label="V. Total Estimado" class="text-end font-monospace align-middle text-warning fw-bold">${formatMoney(valTotal)}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    // Cards para FAF e Convênios
                    cardsHtml = `
                        <div class="row mb-3 g-2">
                            <div class="col-md-4">
                                <div class="border rounded p-2 text-center bg-white shadow-sm">
                                    <div class="text-muted small text-uppercase fw-bold mb-1">Valor Previsto</div>
                                    <div class="fs-5 fw-bold text-primary">${formatMoney(valRepassado)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="border rounded p-2 text-center bg-white shadow-sm">
                                    <div class="text-muted small text-uppercase fw-bold mb-1">Valor Executado</div>
                                    <div class="fs-5 fw-bold text-success">${formatMoney(valExecutado)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="border rounded p-2 text-center bg-white shadow-sm">
                                    <div class="text-muted small text-uppercase fw-bold mb-1">Avanço Financeiro</div>
                                    <div class="fs-5 fw-bold" style="color: ${getProgressColor(pctExecutado)}">${formatPercent(pctExecutado)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    theadHtml = `
                        <tr>
                            <th>Objeto</th>
                            <th class="text-center">Qtd</th>
                            <th class="text-end">V. Unitário</th>
                            <th class="text-end">V. Total Previsto</th>
                            <th class="text-end">Executado</th>
                            <th class="text-center progress-column">%</th>
                        </tr>
                    `;
                    linhas = itens.map(item => {
                        const valTotal = parseFloat(item.valorTotal) || 0;
                        const valExec = parseFloat(item.valorExecutado) || 0;
                        const pct = valTotal > 0 ? (valExec / valTotal) * 100 : 0;
                        const execucaoAcimaPrevisto = valExec - valTotal > 0.01;
                        const safeObjeto = escapeHtml(item.objeto);
                        
                        return `
                            <tr class="${execucaoAcimaPrevisto ? 'table-warning' : ''}">
                                <td data-label="Objeto">${safeObjeto}</td>
                                <td data-label="Qtd" class="text-center align-middle">${escapeHtml(item.quantidade)}</td>
                                <td data-label="V. Unitário" class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                                <td data-label="V. Total Previsto" class="text-end font-monospace align-middle">${formatMoney(valTotal)}</td>
                                <td data-label="Executado" class="text-end font-monospace align-middle ${valExec > 0 ? 'text-success fw-bold' : ''}">${formatMoney(valExec)}</td>
                                <td data-label="%" class="text-center align-middle progress-cell" title="${execucaoAcimaPrevisto ? 'Execucao acima do valor previsto' : ''}">
                                    <div class="custom-progress-pill">
                                        <div class="pill-fill" style="width: ${getProgressWidth(pct)}%; background-color: ${getProgressColor(pct)}"></div>
                                        <div class="pill-text">${formatPercent(pct)}</div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }

                const safeTitulo = escapeHtml(titulo);

                return `
                    <div class="card mb-4 shadow-sm border-0">
                        <div class="card-header text-white ${corCard} d-flex justify-content-between align-items-center py-3">
                            <h5 class="mb-0 fw-bold"><i class="fas fa-list-ul me-2"></i> ${safeTitulo}</h5>
                            <span class="badge bg-light text-dark fs-6">${itens.length} iten(s)</span>
                        </div>
                        <div class="card-body bg-light">
                            ${cardsHtml}
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered table-hover bg-white mb-0">
                                    <thead class="table-light">
                                        ${theadHtml}
                                    </thead>
                                    <tbody>${linhas}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            };

            let htmlListas = '';
            
            let fafHtml = gerarTabela('Fundo a Fundo (FAF)', itensFAF, 'bg-primary', metrics.fafVal, metrics.fafExec, metrics.fafExecPct);
            if (fafHtml) {
                // Remove a margem inferior padrão do card para colar o texto da observação logo abaixo
                fafHtml = fafHtml.replace('card mb-4', 'card mb-1');
                fafHtml += `
                    <div class="text-muted small mb-4 px-2 report-note">
                        <i class="fas fa-asterisk me-1"></i> Os dados foram atualizados até abril de 2026 e podem não refletir a execução real, uma vez que ainda se está na janela de submissão dos relatórios de execução atualizados.
                    </div>
                `;
            }
            htmlListas += fafHtml;
            
            // Gera a tabela de convênios primeiro para ver se ela existe
            let convHtml = gerarTabela('Convênio', itensConv, 'bg-success', metrics.convVal, metrics.convExec, metrics.convExecPct);
            
            // Só insere o Card de Aviso do Convênio SE houver uma tabela de convênios para mostrar
            if (convHtml !== '' && catalogoAplicacao.infoConvenios[uf]) {
                const info = catalogoAplicacao.infoConvenios[uf];
                htmlListas += `
                    <div class="alert bg-white border border-success border-start-0 border-end-0 border-bottom-0 border-start border-4 shadow-sm mb-2 d-flex align-items-center">
                        <i class="fas fa-file-contract fa-2x text-success me-3 opacity-75"></i>
                        <div>
                            <h6 class="mb-1 fw-bold text-dark convenio-title">Convênio Nº ${escapeHtml(info.numero)}/${escapeHtml(info.ano)}</h6>
                            <div class="text-muted small">
                                <span class="me-3"><i class="fas fa-calendar-alt me-1 text-secondary"></i> <strong>Vencimento:</strong> <span class="badge bg-danger">${escapeHtml(info.vencimento)}</span></span>
                                <span><i class="fas fa-folder-open me-1 text-secondary"></i> <strong>Processo SEI:</strong> <span class="font-monospace">${escapeHtml(info.sei)}</span></span>
                            </div>
                        </div>
                    </div>
                `;
            }
            htmlListas += convHtml;
            
            htmlListas += gerarTabela('Doações', itensDoac, 'bg-warning text-dark', metrics.doacVal, 0, 0);

            if (htmlListas === '') {
                htmlListas = '<div class="alert alert-info">Nenhum item registrado para este estado.</div>';
            }

            document.getElementById('estado-detalhe-listas').innerHTML = htmlListas;

            // 5. Exibir a View
            toggleView('estado-detalhe');
        }

        // --- MÓDULO PROFOR 2022 ---
        function formatarQuantidadeProfor(valor) {
            const numero = Number(valor);
            if (!Number.isFinite(numero)) return escapeHtml(valor);

            return numero.toLocaleString('pt-BR', {
                maximumFractionDigits: Number.isInteger(numero) ? 0 : 2
            });
        }

        function calcularResumoConveniosProfor(convenios) {
            const resumo = convenios.reduce((acc, convenio) => {
                acc.valorGlobal += Number(convenio.valorGlobal) || 0;
                acc.valorRepasse += Number(convenio.valorRepasse) || 0;
                acc.valorContrapartida += Number(convenio.valorContrapartida) || 0;
                acc.valorExecutadoGeral += Number(convenio.valorExecutadoGeral) || 0;
                acc.previstoOuvidoria += Number(convenio.previstoOuvidoria) || 0;
                acc.valorExecutadoOuvidoria += Number(convenio.valorExecutadoOuvidoria) || 0;
                acc.saldoDisponivelOuvidoria += Number(convenio.saldoDisponivelOuvidoria) || 0;
                return acc;
            }, {
                totalConvenios: convenios.length,
                valorGlobal: 0,
                valorRepasse: 0,
                valorContrapartida: 0,
                valorExecutadoGeral: 0,
                previstoOuvidoria: 0,
                valorExecutadoOuvidoria: 0,
                saldoDisponivelOuvidoria: 0
            });

            resumo.execucaoGeralPercentual = resumo.valorGlobal > 0
                ? (resumo.valorExecutadoGeral / resumo.valorGlobal) * 100
                : 0;
            resumo.execucaoOuvidoriaPercentual = resumo.previstoOuvidoria > 0
                ? (resumo.valorExecutadoOuvidoria / resumo.previstoOuvidoria) * 100
                : 0;

            return resumo;
        }

        function obterDiasAteDataPtBr(dataPtBr) {
            const match = String(dataPtBr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!match) return null;

            const [, dia, mes, ano] = match;
            const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            data.setHours(0, 0, 0, 0);

            return Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
        }

        function renderizarCountdownVigenciaProfor(convenio) {
            const dias = obterDiasAteDataPtBr(convenio.vencimento);
            if (dias === null) {
                return '<span class="profor-countdown profor-countdown-neutral">Prazo não informado</span>';
            }

            let classe = 'profor-countdown-ok';
            let texto = `${dias.toLocaleString('pt-BR')} dias`;
            let titulo = `Faltam ${dias.toLocaleString('pt-BR')} dias para o fim da vigência`;

            if (dias < 0) {
                classe = 'profor-countdown-danger';
                texto = `${Math.abs(dias).toLocaleString('pt-BR')} dias vencido`;
                titulo = `Vigência encerrada há ${Math.abs(dias).toLocaleString('pt-BR')} dias`;
            } else if (dias === 0) {
                classe = 'profor-countdown-danger';
                texto = 'vence hoje';
                titulo = 'A vigência se encerra hoje';
            } else if (dias <= 180) {
                classe = 'profor-countdown-danger';
            } else if (dias <= 365) {
                classe = 'profor-countdown-warning';
            }

            return `<span class="profor-countdown ${classe}" title="${escapeHtml(titulo)}">${escapeHtml(texto)}</span>`;
        }

        function isSaldoDisponivelAltoProfor(convenio) {
            const saldo = Number(convenio.saldoDisponivelOuvidoria) || 0;
            const previsto = Number(convenio.previstoOuvidoria) || 0;
            return saldo > 100000 || (previsto > 0 && saldo > previsto * 0.5);
        }

        function obterAlertasProfor(convenio) {
            const alertas = [];
            const execucaoOuvidoria = Number(convenio.execucaoOuvidoriaPercentual) || 0;
            const saldoDisponivel = Number(convenio.saldoDisponivelOuvidoria) || 0;
            const diasVencimento = obterDiasAteDataPtBr(convenio.vencimento);
            const temExecucaoAcimaPrevisto = (convenio.planoAplicacao || []).some((item) => (
                (Number(item.valorExecutado) || 0) - (Number(item.valorPrevisto) || 0) > 0.01
            ));

            if (execucaoOuvidoria <= 0) {
                alertas.push({ tipo: 'danger', texto: 'Sem execução da Ouvidoria' });
            } else if (execucaoOuvidoria < 50) {
                alertas.push({ tipo: 'warning', texto: 'Execução baixa' });
            } else if (execucaoOuvidoria >= 100) {
                alertas.push({ tipo: 'success', texto: 'Ouvidoria executada' });
            }

            if (saldoDisponivel < 0) {
                alertas.push({ tipo: 'danger', texto: 'Saldo disponível negativo' });
            } else if (isSaldoDisponivelAltoProfor(convenio)) {
                alertas.push({ tipo: 'info', texto: 'Saldo disponível alto' });
            }

            if (diasVencimento !== null && diasVencimento < 0) {
                alertas.push({ tipo: 'danger', texto: 'Vencimento expirado' });
            } else if (diasVencimento !== null && diasVencimento <= 365) {
                alertas.push({ tipo: 'warning', texto: `Vence em ${diasVencimento} dias` });
            }

            if (temExecucaoAcimaPrevisto) {
                alertas.push({ tipo: 'warning', texto: 'Item acima do previsto' });
            }

            return alertas;
        }

        function renderizarBadgesAlertaProfor(convenio, limite = 4) {
            const alertas = obterAlertasProfor(convenio).slice(0, limite);
            if (alertas.length === 0) {
                return '<span class="profor-alert-badge profor-alert-neutral">Sem alerta crítico</span>';
            }

            return alertas.map((alerta) => (
                `<span class="profor-alert-badge profor-alert-${escapeHtml(alerta.tipo)}">${escapeHtml(alerta.texto)}</span>`
            )).join('');
        }

        function convenioAtendeSituacaoProfor(convenio, situacao) {
            const execucao = Number(convenio.execucaoOuvidoriaPercentual) || 0;
            const saldo = Number(convenio.saldoDisponivelOuvidoria) || 0;
            const diasVencimento = obterDiasAteDataPtBr(convenio.vencimento);

            if (!situacao) return true;
            if (situacao === 'sem-execucao') return execucao <= 0;
            if (situacao === 'baixa-execucao') return execucao > 0 && execucao < 50;
            if (situacao === 'execucao-integral') return execucao >= 100;
            if (situacao === 'saldo-negativo') return saldo < 0;
            if (situacao === 'vencimento-proximo') return diasVencimento !== null && diasVencimento >= 0 && diasVencimento <= 365;
            if (situacao === 'saldo-alto') return isSaldoDisponivelAltoProfor(convenio);
            return true;
        }

        function convenioPassaFiltrosProfor(convenio) {
            const busca = normalizarBusca(document.getElementById('filtroProforBusca')?.value || '');
            const uf = document.getElementById('filtroProforUf')?.value || '';
            const situacao = document.getElementById('filtroProforSituacao')?.value || '';
            const textoConvenio = normalizarBusca([
                convenio.uf,
                convenio.numero,
                convenio.ano,
                convenio.vencimento
            ].join(' '));

            return (!uf || convenio.uf === uf)
                && convenioAtendeSituacaoProfor(convenio, situacao)
                && (!busca || textoConvenio.includes(busca));
        }

        function obterIndiceRegiaoProfor(uf) {
            const regiao = ORDEM_REGIOES.find((nomeRegiao) => (
                (catalogoAplicacao.regioes?.[nomeRegiao] || []).includes(uf)
            ));
            const indice = ORDEM_REGIOES.indexOf(regiao);
            return indice >= 0 ? indice : ORDEM_REGIOES.length;
        }

        function obterNomeEstadoOrdenacaoProfor(uf) {
            return catalogoAplicacao.nomesEstados?.[uf] || uf;
        }

        function ordenarConveniosProfor(convenios) {
            const ordenacao = document.getElementById('ordenacaoProfor')?.value || 'alfabetica';
            const compararAlfabetico = (a, b) => (
                obterNomeEstadoOrdenacaoProfor(a.uf).localeCompare(obterNomeEstadoOrdenacaoProfor(b.uf), 'pt-BR')
                || a.uf.localeCompare(b.uf, 'pt-BR')
            );
            const compararExecucao = (a, b, direcao = 'desc') => {
                const diferenca = (Number(a.execucaoOuvidoriaPercentual) || 0) - (Number(b.execucaoOuvidoriaPercentual) || 0);
                return direcao === 'asc'
                    ? diferenca || compararAlfabetico(a, b)
                    : -diferenca || compararAlfabetico(a, b);
            };

            return [...convenios].sort((a, b) => {
                if (ordenacao === 'regiao') {
                    return obterIndiceRegiaoProfor(a.uf) - obterIndiceRegiaoProfor(b.uf)
                        || compararAlfabetico(a, b);
                }

                if (ordenacao === 'execucao-desc') {
                    return compararExecucao(a, b, 'desc');
                }

                if (ordenacao === 'execucao-asc') {
                    return compararExecucao(a, b, 'asc');
                }

                return compararAlfabetico(a, b);
            });
        }

        function atualizarTabelaProfor2022(dadosProfor) {
            const tbody = document.getElementById('profor-table-body');
            const resumoContainer = document.getElementById('profor-selected-summary');
            if (!tbody || !resumoContainer) return;

            const conveniosFiltrados = dadosProfor.convenios.filter(convenioPassaFiltrosProfor);
            const conveniosOrdenados = ordenarConveniosProfor(conveniosFiltrados);
            const resumo = calcularResumoConveniosProfor(conveniosFiltrados);

            resumoContainer.innerHTML = `
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div>
                        <div class="kpi-title mb-0">Convênios filtrados</div>
                        <div class="kpi-value">${resumo.totalConvenios}</div>
                    </div>
                    <i class="fas fa-filter card-watermark" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div>
                        <div class="kpi-title mb-0">Valor global filtrado</div>
                        <div class="kpi-value text-money">${formatMoney(resumo.valorGlobal)}</div>
                    </div>
                    <i class="fas fa-file-invoice-dollar card-watermark" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div>
                        <div class="kpi-title mb-0">Previsto Ouvidoria</div>
                        <div class="kpi-value text-money">${formatMoney(resumo.previstoOuvidoria)}</div>
                    </div>
                    <i class="fas fa-headset card-watermark text-info" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div>
                        <div class="kpi-title mb-0">Execução Ouvidoria</div>
                        <div class="kpi-value">${formatPercent(resumo.execucaoOuvidoriaPercentual)}</div>
                    </div>
                    <i class="fas fa-chart-line card-watermark text-success" aria-hidden="true"></i>
                </div>
            `;

            if (conveniosFiltrados.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-muted py-4">Nenhum convênio encontrado para os filtros selecionados.</td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = conveniosOrdenados.map((convenio) => {
                const execucao = Number(convenio.execucaoOuvidoriaPercentual) || 0;
                const saldoDisponivel = Number(convenio.saldoDisponivelOuvidoria) || 0;
                const safeUf = escapeHtml(convenio.uf);
                const safeNumero = escapeHtml(convenio.numero);
                const safeAno = escapeHtml(convenio.ano);
                const rowClass = saldoDisponivel < 0 ? 'profor-row profor-row-risk' : 'profor-row';

                return `
                    <tr class="${rowClass}" data-profor-uf="${safeUf}" role="button" tabindex="0">
                        <td data-label="Convênio" class="align-middle">
                            <div class="profor-convenio-cell">
                                <span class="badge bg-secondary badge-uf">${safeUf}</span>
                                <div>
                                    <strong>Convênio Nº ${safeNumero}/${safeAno}</strong>
                                </div>
                            </div>
                        </td>
                        <td data-label="Vencimento" class="align-middle text-center">${escapeHtml(convenio.vencimento || '-')}</td>
                        <td data-label="Countdown" class="align-middle text-center">${renderizarCountdownVigenciaProfor(convenio)}</td>
                        <td data-label="Valor Global" class="align-middle text-end font-monospace">${formatMoney(convenio.valorGlobal)}</td>
                        <td data-label="Previsto Ouvidoria" class="align-middle text-end font-monospace">${formatMoney(convenio.previstoOuvidoria)}</td>
                        <td data-label="Execução Ouvidoria" class="align-middle progress-cell">
                            <div class="custom-progress-pill">
                                <div class="pill-fill" style="width: ${getProgressWidth(execucao)}%; background-color: ${getProgressColor(execucao)}"></div>
                                <div class="pill-text">${formatPercent(execucao)}</div>
                            </div>
                        </td>
                        <td data-label="Saldo p/ Ouvidoria" class="align-middle text-end font-monospace ${saldoDisponivel < 0 ? 'text-danger fw-bold' : ''}">${formatMoney(saldoDisponivel)}</td>
                        <td data-label="Sinais de gestão" class="align-middle">
                            <div class="profor-alert-list">${renderizarBadgesAlertaProfor(convenio)}</div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function registrarEventosProfor2022(dadosProfor) {
            const atualizar = () => atualizarTabelaProfor2022(dadosProfor);

            document.getElementById('filtroProforBusca')?.addEventListener('input', atualizar);
            document.getElementById('filtroProforUf')?.addEventListener('change', atualizar);
            document.getElementById('filtroProforSituacao')?.addEventListener('change', atualizar);
            document.getElementById('ordenacaoProfor')?.addEventListener('change', atualizar);
            document.getElementById('btnLimparFiltroProfor')?.addEventListener('click', () => {
                const busca = document.getElementById('filtroProforBusca');
                const uf = document.getElementById('filtroProforUf');
                const situacao = document.getElementById('filtroProforSituacao');
                const ordenacao = document.getElementById('ordenacaoProfor');
                if (busca) busca.value = '';
                if (uf) uf.value = '';
                if (situacao) situacao.value = '';
                if (ordenacao) ordenacao.value = 'alfabetica';
                atualizar();
            });

            const tbody = document.getElementById('profor-table-body');
            tbody?.addEventListener('click', (event) => {
                const row = event.target.closest('[data-profor-uf]');
                if (row) abrirDetalheConvenioProfor(row.dataset.proforUf);
            });
            tbody?.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const row = event.target.closest('[data-profor-uf]');
                if (!row) return;
                event.preventDefault();
                abrirDetalheConvenioProfor(row.dataset.proforUf);
            });
        }

        function renderProfor2022View() {
            const container = document.getElementById('view-profor-2022');
            if (!container) return;

            container.style.display = 'block';
            const dadosProfor = obterDadosProfor2022();
            if (!dadosFinanceirosValidados || !dadosProfor) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Dados do PROFOR 2022 indisponíveis. Carregue uma planilha financeira válida para visualizar os convênios.</div>';
                return;
            }

            const resumo = dadosProfor.resumo;
            const opcoesUf = dadosProfor.convenios
                .map((convenio) => `<option value="${escapeHtml(convenio.uf)}">${escapeHtml(convenio.uf)} - ${escapeHtml(catalogoAplicacao.nomesEstados?.[convenio.uf] || convenio.uf)}</option>`)
                .join('');

            container.innerHTML = `
                <section class="dashboard-intro profor-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Transferências da União</p>
                        <h2>PROFOR 2022</h2>
                        <p>Convênios vigentes e plano de aplicação por UF</p>
                    </div>
                    <div class="intro-badges" aria-label="Resumo PROFOR 2022">
                        <span><i class="fas fa-file-contract" aria-hidden="true"></i> ${resumo.totalConvenios} convênios</span>
                        <span><i class="fas fa-calendar-check" aria-hidden="true"></i> 2022</span>
                        <span><i class="fas fa-headset" aria-hidden="true"></i> Ouvidoria</span>
                    </div>
                </section>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3 profor-kpi-grid" aria-label="Indicadores PROFOR 2022">
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-file-contract" aria-hidden="true"></i>Convênios vigentes</div>
                            <div class="kpi-value">${resumo.totalConvenios}</div>
                            <div class="kpi-desc">Instrumentos da aba Geral</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-scale-balanced" aria-hidden="true"></i>Valor Global</div>
                            <div class="kpi-value text-money">${formatMoney(resumo.valorGlobal)}</div>
                            <div class="kpi-desc">Repasse + contrapartida</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-building-columns" aria-hidden="true"></i>Valor de Repasse</div>
                            <div class="kpi-value text-money">${formatMoney(resumo.valorRepasse)}</div>
                            <div class="kpi-desc">União pactuada</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-handshake" aria-hidden="true"></i>Contrapartida</div>
                            <div class="kpi-value text-money">${formatMoney(resumo.valorContrapartida)}</div>
                            <div class="kpi-desc">Valor pactuado pelos convenentes</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-info">
                            <div class="kpi-title"><i class="fas fa-chart-pie" aria-hidden="true"></i>Execução Geral</div>
                            <div class="kpi-value">${formatPercent(resumo.execucaoGeralPercentual)}</div>
                            <div class="kpi-desc">${formatMoney(resumo.valorExecutadoGeral)} executados</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-headset" aria-hidden="true"></i>Previsto Ouvidoria</div>
                            <div class="kpi-value text-money">${formatMoney(resumo.previstoOuvidoria)}</div>
                            <div class="kpi-desc">Plano de aplicação ONASP</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-check-circle" aria-hidden="true"></i>Execução Ouvidoria</div>
                            <div class="kpi-value">${formatPercent(resumo.execucaoOuvidoriaPercentual)}</div>
                            <div class="kpi-desc">${formatMoney(resumo.valorExecutadoOuvidoria)} executados</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-warning">
                            <div class="kpi-title"><i class="fas fa-coins" aria-hidden="true"></i>Rendimentos atuais</div>
                            <div class="kpi-value text-money text-warning">${formatMoney(resumo.saldoRendimentosAtual)}</div>
                            <div class="kpi-desc">Saldo de rendimentos registrado</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card ${resumo.saldoDisponivelOuvidoria < 0 ? 'kpi-card-warning' : ''}">
                            <div class="kpi-title"><i class="fas fa-vault" aria-hidden="true"></i>Saldo p/ Ouvidoria</div>
                            <div class="kpi-value text-money ${resumo.saldoDisponivelOuvidoria < 0 ? 'text-danger' : ''}">${formatMoney(resumo.saldoDisponivelOuvidoria)}</div>
                            <div class="kpi-desc">Disponível para destinação</div>
                        </div>
                    </div>
                </section>

                <section class="filter-section mb-4" aria-label="Filtros PROFOR 2022">
                    <div class="filter-toolbar">
                        <div class="filter-title">
                            <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                            <strong>Filtros</strong>
                        </div>
                        <div class="filter-search-actions">
                            <input type="text" id="filtroProforBusca" class="form-control" placeholder="Buscar por UF, convênio ou vencimento..." aria-label="Buscar convênios PROFOR 2022">
                            <button id="btnLimparFiltroProfor" type="button" class="btn btn-outline-secondary btn-icon-text">
                                <i class="fas fa-undo" aria-hidden="true"></i>
                                <span>Limpar</span>
                            </button>
                        </div>
                    </div>
                    <div class="budget-filter-grid profor-filter-grid">
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroProforUf">UF</label>
                            <select id="filtroProforUf" class="form-select">
                                <option value="">Todas</option>
                                ${opcoesUf}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroProforSituacao">Sinal de gestão</label>
                            <select id="filtroProforSituacao" class="form-select">
                                <option value="">Todos</option>
                                <option value="sem-execucao">Sem execução da Ouvidoria</option>
                                <option value="baixa-execucao">Execução baixa</option>
                                <option value="execucao-integral">Execução integral</option>
                                <option value="saldo-negativo">Saldo negativo</option>
                                <option value="vencimento-proximo">Vencimento em até 12 meses</option>
                                <option value="saldo-alto">Saldo disponível alto</option>
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="ordenacaoProfor">Ordenar por</label>
                            <select id="ordenacaoProfor" class="form-select">
                                <option value="alfabetica">Ordem alfabética</option>
                                <option value="regiao">Regiões</option>
                                <option value="execucao-desc">Execução: maior para menor</option>
                                <option value="execucao-asc">Execução: menor para maior</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section class="budget-insight-grid profor-insight-grid mb-4" id="profor-selected-summary" aria-label="Resumo da seleção PROFOR 2022"></section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Convênios</p>
                            <h2>Carteira PROFOR 2022</h2>
                        </div>
                        <small class="text-muted"><i class="fas fa-mouse-pointer me-1" aria-hidden="true"></i> Clique em uma linha para abrir o detalhe</small>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table profor-data-table">
                            <thead>
                                <tr>
                                    <th>Convênio</th>
                                    <th class="text-center">Vencimento</th>
                                    <th class="text-center">Countdown</th>
                                    <th class="text-end">Valor Global</th>
                                    <th class="text-end">Previsto Ouvidoria</th>
                                    <th class="text-center">Execução Ouvidoria</th>
                                    <th class="text-end">Saldo p/ Ouvidoria</th>
                                    <th>Sinais de gestão</th>
                                </tr>
                            </thead>
                            <tbody id="profor-table-body"></tbody>
                        </table>
                    </div>
                </section>
            `;

            registrarEventosProfor2022(dadosProfor);
            atualizarTabelaProfor2022(dadosProfor);
        }

        function obterAreasPlanoProfor(convenio) {
            const areasBase = ['OUVIDORIA', 'CORREGEDORIA', 'ESCOLA PENAL', 'N/A'];
            const areasExistentes = Array.from(new Set(
                (convenio.planoAplicacao || []).map((item) => item.area).filter(Boolean)
            ));
            return [
                '',
                ...areasBase.filter((area) => areasExistentes.includes(area)),
                ...areasExistentes.filter((area) => !areasBase.includes(area)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
            ];
        }

        function renderizarKpiDetalheProfor(rotulo, valor, descricao = '', extraClass = '', icone = 'fa-circle-info') {
            return `
                <div class="col">
                    <div class="card kpi-card ${extraClass}">
                        <div class="kpi-title"><i class="fas ${icone}" aria-hidden="true"></i>${escapeHtml(rotulo)}</div>
                        <div class="kpi-value text-money">${valor}</div>
                        ${descricao ? `<div class="kpi-desc">${escapeHtml(descricao)}</div>` : ''}
                    </div>
                </div>
            `;
        }

        function renderizarResumoAreasProfor(convenio) {
            const resumoPorArea = (convenio.planoAplicacao || []).reduce((acc, item) => {
                const area = item.area || 'Não informado';
                acc[area] = acc[area] || { itens: 0, previsto: 0, executado: 0 };
                acc[area].itens += 1;
                acc[area].previsto += Number(item.valorPrevisto) || 0;
                acc[area].executado += Number(item.valorExecutado) || 0;
                return acc;
            }, {});

            return Object.entries(resumoPorArea).map(([area, resumo]) => {
                const percentual = resumo.previsto > 0 ? (resumo.executado / resumo.previsto) * 100 : 0;
                return `
                    <div class="profor-area-summary">
                        <div class="profor-area-summary-title">${escapeHtml(area)}</div>
                        <strong>${formatMoney(resumo.previsto)}</strong>
                        <span>${resumo.itens} item(ns) | ${formatPercent(percentual)}</span>
                    </div>
                `;
            }).join('');
        }

        function renderizarPlanoAplicacaoProfor(convenio, areaSelecionada = proforFiltroAreaAtual) {
            const tableBody = document.getElementById('profor-detail-plan-body');
            const resumo = document.getElementById('profor-detail-plan-summary');
            const areaLabel = document.getElementById('profor-detail-plan-area-label');
            if (!tableBody || !resumo || !areaLabel) return;

            proforFiltroAreaAtual = areaSelecionada;
            document.querySelectorAll('.profor-area-filter').forEach((botao) => {
                const ativo = botao.dataset.area === areaSelecionada;
                botao.classList.toggle('active', ativo);
                botao.setAttribute('aria-pressed', String(ativo));
            });

            const itens = (convenio.planoAplicacao || []).filter((item) => (
                !areaSelecionada || normalizarBusca(item.area) === normalizarBusca(areaSelecionada)
            ));
            const totalPrevisto = itens.reduce((total, item) => total + (Number(item.valorPrevisto) || 0), 0);
            const totalExecutado = itens.reduce((total, item) => total + (Number(item.valorExecutado) || 0), 0);
            const totalSaldo = itens.reduce((total, item) => total + (Number(item.saldo) || 0), 0);
            const percentual = totalPrevisto > 0 ? (totalExecutado / totalPrevisto) * 100 : 0;

            areaLabel.textContent = areaSelecionada || 'Todas as áreas';
            resumo.innerHTML = `
                <div class="profor-plan-summary-item">
                    <span>Itens</span>
                    <strong>${itens.length}</strong>
                </div>
                <div class="profor-plan-summary-item">
                    <span>Previsto</span>
                    <strong>${formatMoney(totalPrevisto)}</strong>
                </div>
                <div class="profor-plan-summary-item">
                    <span>Executado</span>
                    <strong>${formatMoney(totalExecutado)}</strong>
                </div>
                <div class="profor-plan-summary-item">
                    <span>Saldo</span>
                    <strong class="${totalSaldo < 0 ? 'text-danger' : ''}">${formatMoney(totalSaldo)}</strong>
                </div>
                <div class="profor-plan-summary-item">
                    <span>Execução</span>
                    <strong>${formatPercent(percentual)}</strong>
                </div>
            `;

            if (itens.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center text-muted py-4">Nenhum item localizado para a área selecionada.</td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = itens.map((item) => {
                const percentualItem = Number(item.percentualExecucao) || 0;
                const execucaoAcimaPrevisto = (Number(item.valorExecutado) || 0) - (Number(item.valorPrevisto) || 0) > 0.01;
                const saldo = Number(item.saldo) || 0;

                return `
                    <tr class="${execucaoAcimaPrevisto || saldo < 0 ? 'table-warning' : ''}">
                        <td data-label="Área" class="align-middle"><span class="profor-area-pill">${escapeHtml(item.area)}</span></td>
                        <td data-label="Natureza" class="align-middle">${escapeHtml(item.natureza)}</td>
                        <td data-label="Descrição" class="align-middle"><span class="truncate-text">${escapeHtml(item.descricao)}</span></td>
                        <td data-label="Qtd." class="text-center align-middle">${formatarQuantidadeProfor(item.quantidade)}</td>
                        <td data-label="Valor Unit." class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                        <td data-label="Previsto" class="text-end font-monospace align-middle">${formatMoney(item.valorPrevisto)}</td>
                        <td data-label="Executado" class="text-end font-monospace align-middle ${item.valorExecutado > 0 ? 'text-success fw-bold' : 'text-muted'}">${formatMoney(item.valorExecutado)}</td>
                        <td data-label="Saldo" class="text-end font-monospace align-middle ${saldo < 0 ? 'text-danger fw-bold' : ''}">${formatMoney(saldo)}</td>
                        <td data-label="Economicidade" class="text-end font-monospace align-middle">${formatMoney(item.saldoEconomicidade)}</td>
                        <td data-label="%" class="text-center align-middle progress-cell" title="${execucaoAcimaPrevisto ? 'Execução acima do valor previsto' : ''}">
                            <div class="custom-progress-pill">
                                <div class="pill-fill" style="width: ${getProgressWidth(percentualItem)}%; background-color: ${getProgressColor(percentualItem)}"></div>
                                <div class="pill-text">${formatPercent(percentualItem)}</div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function abrirDetalheConvenioProfor(uf, areaInicial = 'OUVIDORIA') {
            const dadosProfor = obterDadosProfor2022();
            const container = document.getElementById('view-profor-convenio-detalhe');
            if (!dadosProfor || !container) {
                toggleView('profor2022');
                return;
            }

            const convenio = dadosProfor.convenios.find((item) => item.uf === uf);
            if (!convenio) {
                toggleView('profor2022');
                return;
            }

            proforConvenioAtual = uf;
            proforFiltroAreaAtual = areaInicial;

            const nomeEstado = catalogoAplicacao.nomesEstados?.[uf] || uf;
            const flagUrl = catalogoAplicacao.imagensBandeiras?.[uf] || '';
            const imgElement = flagUrl
                ? `<img src="${escapeHtml(flagUrl)}" alt="Bandeira ${escapeHtml(uf)}" class="state-flag report-state-flag me-3">`
                : '<i class="fas fa-flag text-secondary report-state-icon me-3"></i>';
            const areas = obterAreasPlanoProfor(convenio);
            const areaButtons = areas.map((area) => {
                const label = area || 'Todas';
                return `
                    <button type="button" class="profor-area-filter ${area === areaInicial ? 'active' : ''}" data-area="${escapeHtml(area)}" aria-pressed="${area === areaInicial}">
                        ${escapeHtml(label)}
                    </button>
                `;
            }).join('');

            container.innerHTML = `
                <div class="report-actions pdf-hidden">
                    <button type="button" class="btn btn-outline-secondary btn-icon-text" onclick="toggleView('profor2022')">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <span>Voltar para PROFOR 2022</span>
                    </button>
                </div>

                <div class="report-content profor-detail-content">
                    <section class="profor-detail-header">
                        <div class="d-flex align-items-center">
                            ${imgElement}
                            <div>
                                <p class="section-eyebrow mb-1">Convênio PROFOR 2022</p>
                                <h2>Convênio Nº ${escapeHtml(convenio.numero)}/${escapeHtml(convenio.ano)} - ${escapeHtml(nomeEstado)} (${escapeHtml(uf)})</h2>
                                <div class="profor-detail-meta">
                                    <span><i class="fas fa-folder-open" aria-hidden="true"></i> SEI ${escapeHtml(convenio.processoSei)}</span>
                                    <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> Vencimento ${escapeHtml(convenio.vencimento || '-')}</span>
                                    <span><i class="fas fa-hourglass-half" aria-hidden="true"></i> ${renderizarCountdownVigenciaProfor(convenio)}</span>
                                    <span><i class="fas fa-file-signature" aria-hidden="true"></i> ${escapeHtml(convenio.quantidadeTa)} TA</span>
                                </div>
                            </div>
                        </div>
                        <div class="profor-alert-list">${renderizarBadgesAlertaProfor(convenio, 8)}</div>
                    </section>

                    <section class="row my-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Detalhes financeiros do convênio">
                        ${renderizarKpiDetalheProfor('Valor Global', formatMoney(convenio.valorGlobal), 'Total pactuado', '', 'fa-scale-balanced')}
                        ${renderizarKpiDetalheProfor('Valor de Repasse', formatMoney(convenio.valorRepasse), 'União', '', 'fa-building-columns')}
                        ${renderizarKpiDetalheProfor('Contrapartida', formatMoney(convenio.valorContrapartida), 'Pactuada', '', 'fa-handshake')}
                        ${renderizarKpiDetalheProfor('Repasse Desembolsado', formatMoney(convenio.repasseDesembolsado), 'Liberado ao convenente', 'kpi-card-info', 'fa-money-bill-transfer')}
                        ${renderizarKpiDetalheProfor('Countdown da Vigência', renderizarCountdownVigenciaProfor(convenio), `Vencimento em ${convenio.vencimento || '-'}`, 'kpi-card-warning', 'fa-hourglass-half')}
                        ${renderizarKpiDetalheProfor('Execução Geral', formatPercent((convenio.valorGlobal > 0 ? convenio.valorExecutadoGeral / convenio.valorGlobal * 100 : 0)), formatMoney(convenio.valorExecutadoGeral), 'kpi-card-success', 'fa-chart-line')}
                        ${renderizarKpiDetalheProfor('Previsto Ouvidoria', formatMoney(convenio.previstoOuvidoria), `${convenio.totalItensOuvidoria} item(ns)`, '', 'fa-headset')}
                        ${renderizarKpiDetalheProfor('Execução Ouvidoria', formatPercent(convenio.execucaoOuvidoriaPercentual), formatMoney(convenio.valorExecutadoOuvidoria), 'kpi-card-success', 'fa-check-circle')}
                        ${renderizarKpiDetalheProfor('Saldo p/ Ouvidoria', formatMoney(convenio.saldoDisponivelOuvidoria), 'Disponível para destinação', convenio.saldoDisponivelOuvidoria < 0 ? 'kpi-card-warning' : '', 'fa-vault')}
                    </section>

                    <section class="profor-finance-grid mb-4" aria-label="Saldos e rendimentos">
                        <div class="profor-finance-item">
                            <span>Rendimento aprovado</span>
                            <strong>${formatMoney(convenio.rendimentoAprovado)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Saldo de rendimentos atual</span>
                            <strong>${formatMoney(convenio.saldoRendimentosAtual)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Saldo residual capital</span>
                            <strong class="${convenio.saldoResidualCapital < 0 ? 'text-danger' : ''}">${formatMoney(convenio.saldoResidualCapital)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Saldo residual custeio</span>
                            <strong class="${convenio.saldoResidualCusteio < 0 ? 'text-danger' : ''}">${formatMoney(convenio.saldoResidualCusteio)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Contrapartida integralizada</span>
                            <strong>${formatMoney(convenio.contrapartidaIntegralizada)}</strong>
                        </div>
                    </section>

                    <section class="profor-area-section mb-4" aria-label="Resumo por área">
                        <div class="section-header compact">
                            <div>
                                <p class="section-eyebrow mb-1">Distribuição do plano</p>
                                <h2>Valores por área</h2>
                            </div>
                        </div>
                        <div class="profor-area-summary-grid">
                            ${renderizarResumoAreasProfor(convenio)}
                        </div>
                    </section>

                    <section class="table-container profor-plan-section mb-0">
                        <div class="section-header compact">
                            <div>
                                <p class="section-eyebrow mb-1">Plano de aplicação</p>
                                <h2 id="profor-detail-plan-area-label">Ouvidoria</h2>
                            </div>
                        </div>
                        <div class="profor-area-filter-bar" aria-label="Filtrar plano por área">
                            ${areaButtons}
                        </div>
                        <div class="profor-plan-summary" id="profor-detail-plan-summary"></div>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover w-100 app-data-table profor-plan-table">
                                <thead>
                                    <tr>
                                        <th>Área</th>
                                        <th>Natureza</th>
                                        <th>Descrição</th>
                                        <th class="text-center">Qtd.</th>
                                        <th class="text-end">Valor Unit.</th>
                                        <th class="text-end">Previsto</th>
                                        <th class="text-end">Executado</th>
                                        <th class="text-end">Saldo</th>
                                        <th class="text-end">Economicidade</th>
                                        <th class="text-center">%</th>
                                    </tr>
                                </thead>
                                <tbody id="profor-detail-plan-body"></tbody>
                            </table>
                        </div>
                    </section>
                </div>
            `;

            document.querySelectorAll('.profor-area-filter').forEach((botao) => {
                botao.addEventListener('click', () => renderizarPlanoAplicacaoProfor(convenio, botao.dataset.area || ''));
            });
            renderizarPlanoAplicacaoProfor(convenio, areaInicial);
            toggleView('profor-convenio-detalhe');
        }

        // --- MÓDULO FUNPEN: FAF 2021 E DOAÇÕES 2023 ---
        function calcularResumoItensFunpen(itens) {
            const resumo = itens.reduce((acc, item) => {
                acc.valorTotal += Number(item.valorTotal) || 0;
                acc.valorExecutado += Number(item.valorExecutado) || 0;
                acc.quantidade += Number(item.quantidade) || 0;
                if (item.uf) acc.ufs.add(item.uf);
                return acc;
            }, {
                valorTotal: 0,
                valorExecutado: 0,
                quantidade: 0,
                ufs: new Set()
            });

            const saldo = resumo.valorTotal - resumo.valorExecutado;
            return {
                totalItens: itens.length,
                totalUfs: resumo.ufs.size,
                quantidade: resumo.quantidade,
                valorTotal: resumo.valorTotal,
                valorExecutado: resumo.valorExecutado,
                saldo,
                percentualExecucao: resumo.valorTotal > 0 ? (resumo.valorExecutado / resumo.valorTotal) * 100 : 0,
                valorMedioPorUf: resumo.ufs.size > 0 ? resumo.valorTotal / resumo.ufs.size : 0
            };
        }

        function obterUfsOrdenadasFunpen(itens) {
            return Array.from(new Set(itens.map((item) => item.uf).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        }

        function obterItensPorUfFunpen(itens) {
            return itens.reduce((acc, item) => {
                acc[item.uf] = acc[item.uf] || [];
                acc[item.uf].push(item);
                return acc;
            }, {});
        }

        function obterNomeEstadoFunpen(uf) {
            return catalogoAplicacao.nomesEstados?.[uf] || uf;
        }

        async function carregarDadosFaf2021Editaveis(forcarRecarregamento = false) {
            if (forcarRecarregamento) {
                try {
                    catalogoAplicacao = await carregarCatalogoAplicacao(true);
                    dadosFaf = await carregarDadosAplicacao(catalogoAplicacao);
                } catch (error) {
                    console.warn('Falha ao recarregar os dados base da aplicação após salvar FAF 2021.', error);
                }
            }

            return obterDadosFaf2021();
        }

        function obterIndiceRegiaoFunpen(uf) {
            const regiao = ORDEM_REGIOES.find((nomeRegiao) => (
                (catalogoAplicacao.regioes?.[nomeRegiao] || []).includes(uf)
            ));
            const indice = ORDEM_REGIOES.indexOf(regiao);
            return indice >= 0 ? indice : ORDEM_REGIOES.length;
        }

        function compararAlfabeticoFunpen(a, b) {
            return obterNomeEstadoFunpen(a.uf).localeCompare(obterNomeEstadoFunpen(b.uf), 'pt-BR')
                || String(a.objeto || '').localeCompare(String(b.objeto || ''), 'pt-BR');
        }

        function ordenarItensFunpen(itens, ordenacao, tipo) {
            return [...itens].sort((a, b) => {
                if (ordenacao === 'regiao') {
                    return obterIndiceRegiaoFunpen(a.uf) - obterIndiceRegiaoFunpen(b.uf)
                        || compararAlfabeticoFunpen(a, b);
                }

                if (tipo === 'faf') {
                    if (ordenacao === 'execucao-desc') {
                        return ((Number(b.percentualExecucao) || 0) - (Number(a.percentualExecucao) || 0))
                            || compararAlfabeticoFunpen(a, b);
                    }
                    if (ordenacao === 'execucao-asc') {
                        return ((Number(a.percentualExecucao) || 0) - (Number(b.percentualExecucao) || 0))
                            || compararAlfabeticoFunpen(a, b);
                    }
                    if (ordenacao === 'valor-desc') {
                        return ((Number(b.valorTotal) || 0) - (Number(a.valorTotal) || 0))
                            || compararAlfabeticoFunpen(a, b);
                    }
                }

                if (tipo === 'doacoes') {
                    if (ordenacao === 'valor-desc') {
                        return ((Number(b.valorTotal) || 0) - (Number(a.valorTotal) || 0))
                            || compararAlfabeticoFunpen(a, b);
                    }
                    if (ordenacao === 'quantidade-desc') {
                        return ((Number(b.quantidade) || 0) - (Number(a.quantidade) || 0))
                            || compararAlfabeticoFunpen(a, b);
                    }
                }

                return compararAlfabeticoFunpen(a, b);
            });
        }

        function itemFafAtendeSituacao(item, situacao) {
            const percentual = Number(item.percentualExecucao) || 0;
            const saldo = Number(item.saldo) || 0;
            const valorTotal = Number(item.valorTotal) || 0;
            const valorExecutado = Number(item.valorExecutado) || 0;

            if (!situacao) return true;
            if (situacao === 'sem-execucao') return valorExecutado <= 0;
            if (situacao === 'baixa-execucao') return percentual > 0 && percentual < 50;
            if (situacao === 'execucao-integral') return percentual >= 100 && valorExecutado <= valorTotal + 0.01;
            if (situacao === 'saldo-alto') return saldo > 100000 || (valorTotal > 0 && saldo > valorTotal * 0.5);
            if (situacao === 'acima-previsto') return valorExecutado - valorTotal > 0.01;
            return true;
        }

        function obterItensFiltradosFunpen(itens, tipo) {
            const prefixo = tipo === 'faf' ? 'Faf' : 'Doacoes';
            const busca = normalizarBusca(document.getElementById(`filtro${prefixo}Busca`)?.value || '');
            const uf = document.getElementById(`filtro${prefixo}Uf`)?.value || '';
            const situacao = document.getElementById(`filtro${prefixo}Situacao`)?.value || '';

            return itens.filter((item) => {
                const textoBusca = normalizarBusca([
                    item.uf,
                    obterNomeEstadoFunpen(item.uf),
                    item.objeto
                ].join(' '));
                return (!uf || item.uf === uf)
                    && (tipo !== 'faf' || itemFafAtendeSituacao(item, situacao))
                    && (!busca || textoBusca.includes(busca));
            });
        }

        function renderizarKpiFunpen(rotulo, valor, descricao = '', icone = 'fa-circle-info', extraClass = '') {
            return `
                <div class="col">
                    <div class="card kpi-card ${extraClass}">
                        <div class="kpi-title"><i class="fas ${icone}" aria-hidden="true"></i>${escapeHtml(rotulo)}</div>
                        <div class="kpi-value">${valor}</div>
                        ${descricao ? `<div class="kpi-desc">${escapeHtml(descricao)}</div>` : ''}
                    </div>
                </div>
            `;
        }

        function renderizarBadgesFaf(item) {
            const badges = [];
            const percentual = Number(item.percentualExecucao) || 0;
            const valorTotal = Number(item.valorTotal) || 0;
            const valorExecutado = Number(item.valorExecutado) || 0;
            const saldo = Number(item.saldo) || 0;

            if (valorExecutado <= 0) {
                badges.push({ tipo: 'danger', texto: 'Sem execução' });
            } else if (percentual < 50) {
                badges.push({ tipo: 'warning', texto: 'Execução baixa' });
            } else if (percentual >= 100 && valorExecutado <= valorTotal + 0.01) {
                badges.push({ tipo: 'success', texto: 'Execução integral' });
            }
            if (saldo > 100000 || (valorTotal > 0 && saldo > valorTotal * 0.5)) {
                badges.push({ tipo: 'info', texto: 'Saldo alto' });
            }
            if (valorExecutado - valorTotal > 0.01) {
                badges.push({ tipo: 'warning', texto: 'Acima do previsto' });
            }

            if (badges.length === 0) {
                return '<span class="profor-alert-badge profor-alert-neutral">Sem alerta crítico</span>';
            }

            return badges.slice(0, 3).map((badge) => (
                `<span class="profor-alert-badge profor-alert-${escapeHtml(badge.tipo)}">${escapeHtml(badge.texto)}</span>`
            )).join('');
        }

        function renderizarResumoFiltroFunpen(containerId, resumo, tipo) {
            const container = document.getElementById(containerId);
            if (!container) return;

            if (tipo === 'doacoes') {
                container.innerHTML = `
                    <div class="card kpi-card dynamic-card profor-insight-card py-2">
                        <div><div class="kpi-title mb-0">Itens filtrados</div><div class="kpi-value">${resumo.totalItens}</div></div>
                        <i class="fas fa-filter card-watermark" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card profor-insight-card py-2">
                        <div><div class="kpi-title mb-0">UFs filtradas</div><div class="kpi-value">${resumo.totalUfs}</div></div>
                        <i class="fas fa-map-marker-alt card-watermark" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card profor-insight-card py-2">
                        <div><div class="kpi-title mb-0">Valor estimado</div><div class="kpi-value text-money">${formatMoney(resumo.valorTotal)}</div></div>
                        <i class="fas fa-gift card-watermark" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card profor-insight-card py-2">
                        <div><div class="kpi-title mb-0">Valor médio/UF</div><div class="kpi-value text-money">${formatMoney(resumo.valorMedioPorUf)}</div></div>
                        <i class="fas fa-chart-column card-watermark" aria-hidden="true"></i>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div><div class="kpi-title mb-0">Itens filtrados</div><div class="kpi-value">${resumo.totalItens}</div></div>
                    <i class="fas fa-filter card-watermark" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div><div class="kpi-title mb-0">Valor previsto</div><div class="kpi-value text-money">${formatMoney(resumo.valorTotal)}</div></div>
                    <i class="fas fa-landmark card-watermark" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div><div class="kpi-title mb-0">Valor executado</div><div class="kpi-value text-money">${formatMoney(resumo.valorExecutado)}</div></div>
                    <i class="fas fa-check-circle card-watermark" aria-hidden="true"></i>
                </div>
                <div class="card kpi-card dynamic-card profor-insight-card py-2">
                    <div><div class="kpi-title mb-0">Execução</div><div class="kpi-value">${formatPercent(resumo.percentualExecucao)}</div></div>
                    <i class="fas fa-chart-line card-watermark" aria-hidden="true"></i>
                </div>
            `;
        }

        function validarValorExecutadoFaf2021(valor) {
            if (typeof valor === 'number' && Number.isFinite(valor)) {
                if (valor < 0) throw new Error('Valor executado não pode ser negativo.');
                return valor;
            }

            const texto = String(valor ?? '').trim();
            if (!texto) {
                throw new Error('Valor executado é obrigatório.');
            }

            const normalizado = texto.replace(/^R\$/i, '').replace(/\s+/g, '');
            const numero = normalizado.includes(',') && normalizado.includes('.')
                ? Number.parseFloat(normalizado.replace(/\./g, '').replace(',', '.'))
                : normalizado.includes(',')
                    ? Number.parseFloat(normalizado.replace(',', '.'))
                    : Number.parseFloat(normalizado);

            if (!Number.isFinite(numero)) {
                throw new Error('Valor executado inválido.');
            }

            if (numero < 0) {
                throw new Error('Valor executado não pode ser negativo.');
            }

            return numero;
        }

        function renderizarBotaoEdicaoFaf2021(item) {
            return renderActionButton({
                type: 'edit',
                label: 'Editar execução',
                variant: 'outline-primary',
                size: 'sm',
                backend: true,
                iconOnly: true,
                title: 'Editar execução do item',
                extraClass: 'faf2021-row-action',
                attributes: `data-faf2021-editar-item="${escapeHtml(item.itemId)}"`
            });
        }

        function renderizarEditorExecucaoFaf2021(item) {
            return `
                <div class="modal fade" id="modalFaf2021Execucao" tabindex="-1" aria-hidden="true" data-faf2021-item-id="${escapeHtml(item.itemId)}">
                    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <div>
                                    <p class="section-eyebrow mb-1">FAF 2021</p>
                                    <h5 class="modal-title">Editar execução</h5>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <div class="faf2021-editor-summary">
                                    <div><span>UF</span><strong>${escapeHtml(item.uf || '-')}</strong></div>
                                    <div><span>Objeto</span><strong>${escapeHtml(item.objeto || '-')}</strong></div>
                                    <div><span>Quantidade</span><strong>${formatarQuantidadeProfor(item.quantidade)}</strong></div>
                                    <div><span>Valor unitário</span><strong>${formatMoney(item.valorUnitario)}</strong></div>
                                    <div><span>Valor total</span><strong>${formatMoney(item.valorTotal)}</strong></div>
                                    <div><span>Executado atual</span><strong>${formatMoney(item.valorExecutado)}</strong></div>
                                    <div><span>Instrumento</span><strong>${escapeHtml(item.instrumento || '-')}</strong></div>
                                    <div><span>Atualizado em</span><strong>${escapeHtml(item.atualizadoEm || '-')}</strong></div>
                                </div>

                                <div class="row g-3 mt-1">
                                    <div class="col-md-6">
                                        <label class="form-label" for="faf2021ValorExecutado">Novo valor executado</label>
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="faf2021ValorExecutado"
                                            min="0"
                                            step="0.01"
                                            inputmode="decimal"
                                            value="${escapeHtml(String(item.valorExecutado ?? 0))}"
                                        >
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label" for="faf2021SenhaEdicao">Senha de confirmação</label>
                                        <input
                                            type="password"
                                            class="form-control"
                                            id="faf2021SenhaEdicao"
                                            autocomplete="current-password"
                                        >
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label" for="faf2021ObservacaoExecucao">Observação da execução</label>
                                        <textarea class="form-control" id="faf2021ObservacaoExecucao" rows="3" maxlength="1000" placeholder="Observação opcional">${escapeHtml(item.observacaoExecucao || '')}</textarea>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'faf2021SalvarExecucao',
                                    type: 'save',
                                    label: 'Salvar',
                                    variant: 'primary',
                                    backend: true
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function fecharEditorExecucaoFaf2021() {
            removerModalOnasp('modalFaf2021Execucao');
        }

        function obterItemFaf2021PorId(itemId) {
            const dados = obterDadosFaf2021();
            return (dados?.itens || []).find((item) => String(item.itemId) === String(itemId)) || null;
        }

        function abrirEditorExecucaoFaf2021(itemId) {
            if (dadosPaginaEmModoEstatico('faf2021') || dadosPaginaEmModoEstatico('faf2021-detalhe')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const item = obterItemFaf2021PorId(itemId);
            if (!item) {
                alert('Item FAF 2021 não localizado.');
                return;
            }

            fecharEditorExecucaoFaf2021();
            document.body.insertAdjacentHTML('beforeend', renderizarEditorExecucaoFaf2021(item));

            const modalElement = document.getElementById('modalFaf2021Execucao');
            const modal = new window.bootstrap.Modal(modalElement);
            modal.show();

            document.getElementById('faf2021SalvarExecucao')?.addEventListener('click', async () => {
                await salvarExecucaoFaf2021(item.itemId, modal);
            });
        }

        async function salvarExecucaoFaf2021(itemId, modal = null) {
            if (dadosPaginaEmModoEstatico('faf2021') || dadosPaginaEmModoEstatico('faf2021-detalhe')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const item = obterItemFaf2021PorId(itemId);
            if (!item) {
                alert('Item FAF 2021 não localizado.');
                return;
            }

            let valorExecutado;
            let observacaoExecucao = '';

            try {
                valorExecutado = validarValorExecutadoFaf2021(document.getElementById('faf2021ValorExecutado')?.value);
                observacaoExecucao = String(document.getElementById('faf2021ObservacaoExecucao')?.value || '').trim();
                if (/<[^>]+>/.test(observacaoExecucao)) {
                    throw new Error('Observação não pode conter HTML.');
                }
            } catch (error) {
                alert(error.message);
                return;
            }

            const password = document.getElementById('faf2021SenhaEdicao')?.value || '';

            try {
                const { resposta, payload } = await fetchJsonApiOnasp('/api/faf2021/salvar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password,
                        itemId: item.itemId,
                        uf: item.uf,
                        objeto: item.objeto,
                        valorExecutado,
                        observacaoExecucao
                    })
                });

                if (!resposta.ok || !payload.success) {
                    alert(payload.message || 'Não foi possível salvar.');
                    return;
                }

                if (modal) modal.hide();
                fecharEditorExecucaoFaf2021();
                await carregarDadosFaf2021Editaveis(true);
                if (faf2021UfDetalheAtual) {
                    abrirDetalheFaf2021(faf2021UfDetalheAtual);
                } else {
                    renderFaf2021View();
                }
                alert(obterMensagemSalvamento(payload));
            } catch (error) {
                alert(`Não foi possível salvar: ${error.message}`);
            }
        }

        function atualizarTabelaFaf2021(dados) {
            const tbody = document.getElementById('faf-table-body');
            if (!tbody) return;
            const itensFiltrados = obterItensFiltradosFunpen(dados.itens, 'faf');
            const itensOrdenados = ordenarItensFunpen(itensFiltrados, document.getElementById('filtroFafOrdenacao')?.value || 'alfabetica', 'faf');
            const resumo = calcularResumoItensFunpen(itensFiltrados);
            renderizarResumoFiltroFunpen('faf-selected-summary', resumo, 'faf');

            if (itensOrdenados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">Nenhum item FAF 2021 localizado para os filtros selecionados.</td></tr>';
                return;
            }

            tbody.innerHTML = itensOrdenados.map((item) => {
                const saldo = Number(item.saldo) || 0;
                const percentual = Number(item.percentualExecucao) || 0;
                return `
                    <tr class="profor-row" tabindex="0" data-faf-uf="${escapeHtml(item.uf)}" data-faf2021-item-id="${escapeHtml(item.itemId)}">
                        <td data-label="UF" class="align-middle"><span class="badge badge-uf">${escapeHtml(item.uf)}</span></td>
                        <td data-label="Objeto" class="align-middle"><span class="truncate-text">${escapeHtml(item.objeto)}</span></td>
                        <td data-label="Qtd." class="text-center align-middle">${formatarQuantidadeProfor(item.quantidade)}</td>
                        <td data-label="Valor unit." class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                        <td data-label="Previsto" class="text-end font-monospace align-middle">${formatMoney(item.valorTotal)}</td>
                        <td data-label="Executado" class="text-end font-monospace align-middle ${item.valorExecutado > 0 ? 'text-success fw-bold' : 'text-muted'}">${formatMoney(item.valorExecutado)}</td>
                        <td data-label="Saldo" class="text-end font-monospace align-middle ${saldo < 0 ? 'text-danger fw-bold' : ''}">${formatMoney(saldo)}</td>
                        <td data-label="%" class="text-center align-middle progress-cell">
                            <div class="custom-progress-pill">
                                <div class="pill-fill" style="width: ${getProgressWidth(percentual)}%; background-color: ${getProgressColor(percentual)}"></div>
                                <div class="pill-text">${formatPercent(percentual)}</div>
                            </div>
                        </td>
                        <td data-label="Sinais" class="align-middle"><div class="profor-alert-list">${renderizarBadgesFaf(item)}</div></td>
                        <td data-label="Ações" class="text-center align-middle faf2021-actions-cell">
                            ${renderizarBotaoEdicaoFaf2021(item)}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function registrarEventosFaf2021(dados) {
            const atualizar = () => atualizarTabelaFaf2021(dados);
            ['filtroFafBusca', 'filtroFafUf', 'filtroFafSituacao', 'filtroFafOrdenacao'].forEach((id) => {
                const evento = id === 'filtroFafBusca' ? 'input' : 'change';
                document.getElementById(id)?.addEventListener(evento, atualizar);
            });
            document.getElementById('btnLimparFiltroFaf')?.addEventListener('click', () => {
                ['filtroFafBusca', 'filtroFafUf', 'filtroFafSituacao'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                const ordenacao = document.getElementById('filtroFafOrdenacao');
                if (ordenacao) ordenacao.value = 'alfabetica';
                atualizar();
            });
            const tbody = document.getElementById('faf-table-body');
            tbody?.addEventListener('click', (event) => {
                const botaoEdicao = event.target.closest('[data-faf2021-editar-item]');
                if (botaoEdicao) {
                    event.preventDefault();
                    event.stopPropagation();
                    abrirEditorExecucaoFaf2021(botaoEdicao.dataset.faf2021EditarItem);
                    return;
                }
                const row = event.target.closest('[data-faf-uf]');
                if (row) abrirDetalheFaf2021(row.dataset.fafUf);
            });
            tbody?.addEventListener('keydown', (event) => {
                const botaoEdicao = event.target.closest('[data-faf2021-editar-item]');
                if (botaoEdicao) {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    abrirEditorExecucaoFaf2021(botaoEdicao.dataset.faf2021EditarItem);
                    return;
                }
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const row = event.target.closest('[data-faf-uf]');
                if (!row) return;
                event.preventDefault();
                abrirDetalheFaf2021(row.dataset.fafUf);
            });
        }

        function renderFaf2021View() {
            const container = document.getElementById('view-faf-2021');
            if (!container) return;
            container.style.display = 'block';
            faf2021UfDetalheAtual = '';
            const dados = obterDadosFaf2021();
            if (!dados || !dados.itens?.length) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Dados do FAF 2021 indisponíveis.</div>';
                return;
            }

            const resumo = dados.resumo;
            const optionsUf = dados.filtros.ufs.map((uf) => `<option value="${escapeHtml(uf)}">${escapeHtml(uf)} - ${escapeHtml(obterNomeEstadoFunpen(uf))}</option>`).join('');
            container.innerHTML = `
                <section class="dashboard-intro profor-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Repasses FUNPEN</p>
                        <h2>FAF 2021</h2>
                        <p>Fundo a Fundo por UF e item pactuado</p>
                    </div>
                    <div class="intro-badges" aria-label="Resumo FAF 2021">
                        <span><i class="fas fa-landmark" aria-hidden="true"></i> ${resumo.totalUfs} UFs</span>
                        <span><i class="fas fa-list-check" aria-hidden="true"></i> ${resumo.totalItens} itens</span>
                    </div>
                </section>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 profor-kpi-grid" aria-label="Indicadores FAF 2021">
                    ${renderizarKpiFunpen('UFs atendidas', resumo.totalUfs, 'Unidades federativas com FAF', 'fa-map-marker-alt', 'kpi-card-success')}
                    ${renderizarKpiFunpen('Itens', resumo.totalItens, 'Itens cadastrados na base', 'fa-list-check')}
                    ${renderizarKpiFunpen('Valor previsto', `<span class="text-money">${formatMoney(resumo.valorTotal)}</span>`, 'Total pactuado', 'fa-landmark')}
                    ${renderizarKpiFunpen('Valor executado', `<span class="text-money">${formatMoney(resumo.valorExecutado)}</span>`, 'Execução registrada', 'fa-check-circle', 'kpi-card-success')}
                    ${renderizarKpiFunpen('Execução', formatPercent(resumo.percentualExecucao), 'Executado / previsto', 'fa-chart-line', 'kpi-card-info')}
                    ${renderizarKpiFunpen('Saldo a executar', `<span class="text-money">${formatMoney(resumo.saldo)}</span>`, 'Valor ainda não executado', 'fa-vault', 'kpi-card-warning')}
                </section>

                <section class="filter-section mb-4" aria-label="Filtros FAF 2021">
                    <div class="filter-toolbar">
                        <div class="filter-title"><i class="fas fa-filter text-secondary" aria-hidden="true"></i><strong>Filtros</strong></div>
                        <div class="filter-search-actions">
                            <input type="text" id="filtroFafBusca" class="form-control" placeholder="Buscar por UF ou objeto..." aria-label="Buscar itens FAF 2021">
                            <button id="btnLimparFiltroFaf" type="button" class="btn btn-outline-secondary btn-icon-text">
                                <i class="fas fa-undo" aria-hidden="true"></i><span>Limpar</span>
                            </button>
                        </div>
                    </div>
                    <div class="budget-filter-grid profor-filter-grid">
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFafUf">UF</label>
                            <select id="filtroFafUf" class="form-select"><option value="">Todas</option>${optionsUf}</select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFafSituacao">Sinal de gestão</label>
                            <select id="filtroFafSituacao" class="form-select">
                                <option value="">Todos</option>
                                <option value="sem-execucao">Sem execução</option>
                                <option value="baixa-execucao">Execução baixa</option>
                                <option value="execucao-integral">Execução integral</option>
                                <option value="saldo-alto">Saldo a executar alto</option>
                                <option value="acima-previsto">Execução acima do previsto</option>
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFafOrdenacao">Ordenar por</label>
                            <select id="filtroFafOrdenacao" class="form-select">
                                <option value="alfabetica">Ordem alfabética</option>
                                <option value="regiao">Regiões</option>
                                <option value="execucao-desc">Execução: maior para menor</option>
                                <option value="execucao-asc">Execução: menor para maior</option>
                                <option value="valor-desc">Valor previsto: maior para menor</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section class="budget-insight-grid profor-insight-grid mb-4" id="faf-selected-summary" aria-label="Resumo da seleção FAF 2021"></section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div><p class="section-eyebrow mb-1">Itens</p><h2>Carteira FAF 2021</h2></div>
                        <small class="text-muted"><i class="fas fa-mouse-pointer me-1" aria-hidden="true"></i> Clique em uma linha para abrir o detalhe da UF</small>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table profor-plan-table">
                            <thead>
                                <tr>
                                    <th>UF</th><th>Objeto</th><th class="text-center">Qtd.</th><th class="text-end">Valor Unit.</th>
                                    <th class="text-end">Previsto</th><th class="text-end">Executado</th><th class="text-end">Saldo</th>
                                    <th class="text-center">%</th><th>Sinais de gestão</th><th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="faf-table-body"></tbody>
                        </table>
                    </div>
                </section>
            `;
            registrarEventosFaf2021(dados);
            atualizarTabelaFaf2021(dados);
        }

        function abrirDetalheFaf2021(uf) {
            const dados = obterDadosFaf2021();
            const container = document.getElementById('view-faf-2021-detalhe');
            if (!dados || !container) {
                toggleView('faf2021');
                return;
            }
            const itens = dados.itens.filter((item) => item.uf === uf);
            if (!itens.length) {
                faf2021UfDetalheAtual = '';
                toggleView('faf2021');
                return;
            }
            faf2021UfDetalheAtual = uf;
            const resumo = calcularResumoItensFunpen(itens);
            const nomeEstado = obterNomeEstadoFunpen(uf);
            container.innerHTML = `
                <div class="report-actions pdf-hidden">
                    <button type="button" class="btn btn-outline-secondary btn-icon-text" onclick="toggleView('faf2021')">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i><span>Voltar para FAF 2021</span>
                    </button>
                </div>
                <div class="report-content profor-detail-content">
                    <section class="profor-detail-header">
                        <div class="d-flex align-items-center">
                            <span class="badge badge-uf me-3">${escapeHtml(uf)}</span>
                            <div>
                                <p class="section-eyebrow mb-1">Fundo a Fundo 2021</p>
                                <h2>${escapeHtml(nomeEstado)} (${escapeHtml(uf)})</h2>
                                <div class="profor-detail-meta">
                                    <span><i class="fas fa-list-check" aria-hidden="true"></i> ${resumo.totalItens} item(ns)</span>
                                    <span><i class="fas fa-chart-line" aria-hidden="true"></i> ${formatPercent(resumo.percentualExecucao)} executado</span>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="row my-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Resumo FAF por UF">
                        ${renderizarKpiDetalheProfor('Valor previsto', formatMoney(resumo.valorTotal), 'Total FAF da UF', '', 'fa-landmark')}
                        ${renderizarKpiDetalheProfor('Valor executado', formatMoney(resumo.valorExecutado), 'Execução registrada', 'kpi-card-success', 'fa-check-circle')}
                        ${renderizarKpiDetalheProfor('Saldo a executar', formatMoney(resumo.saldo), 'Previsto menos executado', 'kpi-card-warning', 'fa-vault')}
                        ${renderizarKpiDetalheProfor('Execução', formatPercent(resumo.percentualExecucao), `${resumo.totalItens} item(ns)`, 'kpi-card-info', 'fa-chart-line')}
                    </section>
                    <section class="table-container mb-0">
                        <div class="section-header compact"><div><p class="section-eyebrow mb-1">Itens</p><h2>Plano FAF 2021 da UF</h2></div></div>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover w-100 app-data-table profor-plan-table">
                                <thead>
                                    <tr>
                                        <th>Objeto</th><th class="text-center">Qtd.</th><th class="text-end">Valor Unit.</th>
                                        <th class="text-end">Previsto</th><th class="text-end">Executado</th><th class="text-end">Saldo</th>
                                        <th class="text-center">%</th><th>Sinais</th><th class="text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itens.map((item) => {
                                        const percentual = Number(item.percentualExecucao) || 0;
                                        return `
                                            <tr>
                                                <td data-label="Objeto">${escapeHtml(item.objeto)}</td>
                                                <td data-label="Qtd." class="text-center">${formatarQuantidadeProfor(item.quantidade)}</td>
                                                <td data-label="Valor Unit." class="text-end font-monospace small">${formatMoney(item.valorUnitario)}</td>
                                                <td data-label="Previsto" class="text-end font-monospace">${formatMoney(item.valorTotal)}</td>
                                                <td data-label="Executado" class="text-end font-monospace ${item.valorExecutado > 0 ? 'text-success fw-bold' : 'text-muted'}">${formatMoney(item.valorExecutado)}</td>
                                                <td data-label="Saldo" class="text-end font-monospace">${formatMoney(item.saldo)}</td>
                                                <td data-label="%" class="text-center progress-cell">
                                                    <div class="custom-progress-pill">
                                                        <div class="pill-fill" style="width: ${getProgressWidth(percentual)}%; background-color: ${getProgressColor(percentual)}"></div>
                                                        <div class="pill-text">${formatPercent(percentual)}</div>
                                                    </div>
                                                </td>
                                                <td data-label="Sinais"><div class="profor-alert-list">${renderizarBadgesFaf(item)}</div></td>
                                                <td data-label="Ações" class="text-center align-middle faf2021-actions-cell">
                                                    ${renderizarBotaoEdicaoFaf2021(item)}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            `;
            const tabelaDetalhe = container.querySelector('tbody');
            tabelaDetalhe?.addEventListener('click', (event) => {
                const botaoEdicao = event.target.closest('[data-faf2021-editar-item]');
                if (!botaoEdicao) return;
                event.preventDefault();
                event.stopPropagation();
                abrirEditorExecucaoFaf2021(botaoEdicao.dataset.faf2021EditarItem);
            });
            tabelaDetalhe?.addEventListener('keydown', (event) => {
                const botaoEdicao = event.target.closest('[data-faf2021-editar-item]');
                if (!botaoEdicao) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                abrirEditorExecucaoFaf2021(botaoEdicao.dataset.faf2021EditarItem);
            });
            toggleView('faf2021-detalhe');
        }

        function atualizarTabelaDoacoes2023(dados) {
            const tbody = document.getElementById('doacoes-table-body');
            if (!tbody) return;
            const itensFiltrados = obterItensFiltradosFunpen(dados.itens, 'doacoes');
            const itensOrdenados = ordenarItensFunpen(itensFiltrados, document.getElementById('filtroDoacoesOrdenacao')?.value || 'alfabetica', 'doacoes');
            renderizarResumoFiltroFunpen('doacoes-selected-summary', calcularResumoItensFunpen(itensFiltrados), 'doacoes');

            if (itensOrdenados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Nenhuma doação localizada para os filtros selecionados.</td></tr>';
                return;
            }

            tbody.innerHTML = itensOrdenados.map((item) => `
                <tr class="profor-row" tabindex="0" data-doacoes-uf="${escapeHtml(item.uf)}">
                    <td data-label="UF" class="align-middle"><span class="badge badge-uf">${escapeHtml(item.uf)}</span></td>
                    <td data-label="Objeto" class="align-middle"><span class="truncate-text">${escapeHtml(item.objeto)}</span></td>
                    <td data-label="Qtd." class="text-center align-middle">${formatarQuantidadeProfor(item.quantidade)}</td>
                    <td data-label="Valor unit." class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                    <td data-label="Valor total" class="text-end font-monospace align-middle text-warning fw-bold">${formatMoney(item.valorTotal)}</td>
                </tr>
            `).join('');
        }

        function registrarEventosDoacoes2023(dados) {
            const atualizar = () => atualizarTabelaDoacoes2023(dados);
            ['filtroDoacoesBusca', 'filtroDoacoesUf', 'filtroDoacoesOrdenacao'].forEach((id) => {
                const evento = id === 'filtroDoacoesBusca' ? 'input' : 'change';
                document.getElementById(id)?.addEventListener(evento, atualizar);
            });
            document.getElementById('btnLimparFiltroDoacoes')?.addEventListener('click', () => {
                ['filtroDoacoesBusca', 'filtroDoacoesUf'].forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                const ordenacao = document.getElementById('filtroDoacoesOrdenacao');
                if (ordenacao) ordenacao.value = 'alfabetica';
                atualizar();
            });
            const tbody = document.getElementById('doacoes-table-body');
            tbody?.addEventListener('click', (event) => {
                const row = event.target.closest('[data-doacoes-uf]');
                if (row) abrirDetalheDoacoes2023(row.dataset.doacoesUf);
            });
            tbody?.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const row = event.target.closest('[data-doacoes-uf]');
                if (!row) return;
                event.preventDefault();
                abrirDetalheDoacoes2023(row.dataset.doacoesUf);
            });
        }

        function renderDoacoes2023View() {
            const container = document.getElementById('view-doacoes-2023');
            if (!container) return;
            container.style.display = 'block';
            const dados = obterDadosDoacoes2023();
            if (!dados || !dados.itens?.length) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Dados de Doações 2023 indisponíveis.</div>';
                return;
            }

            const resumo = dados.resumo;
            const optionsUf = dados.filtros.ufs.map((uf) => `<option value="${escapeHtml(uf)}">${escapeHtml(uf)} - ${escapeHtml(obterNomeEstadoFunpen(uf))}</option>`).join('');
            container.innerHTML = `
                <section class="dashboard-intro profor-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Repasses FUNPEN</p>
                        <h2>DOAÇÕES 2023</h2>
                        <p>Bens doados por UF e valor estimado</p>
                    </div>
                    <div class="intro-badges" aria-label="Resumo Doações 2023">
                        <span><i class="fas fa-gift" aria-hidden="true"></i> ${resumo.totalItens} itens</span>
                        <span><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${resumo.totalUfs} UFs</span>
                    </div>
                </section>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3 profor-kpi-grid" aria-label="Indicadores Doações 2023">
                    ${renderizarKpiFunpen('UFs contempladas', resumo.totalUfs, 'Unidades federativas com doações', 'fa-map-marker-alt', 'kpi-card-success')}
                    ${renderizarKpiFunpen('Itens doados', resumo.totalItens, 'Registros de doação', 'fa-gift')}
                    ${renderizarKpiFunpen('Valor estimado total', `<span class="text-money">${formatMoney(resumo.valorTotal)}</span>`, 'Valor total dos bens', 'fa-coins', 'kpi-card-warning')}
                    ${renderizarKpiFunpen('Valor médio por UF', `<span class="text-money">${formatMoney(resumo.valorMedioPorUf)}</span>`, 'Valor estimado / UF', 'fa-chart-column')}
                    ${renderizarKpiFunpen('Maior concentração', escapeHtml(resumo.ufMaiorConcentracao || '-'), resumo.valorMaiorConcentracao ? formatMoney(resumo.valorMaiorConcentracao) : '', 'fa-location-dot', 'kpi-card-info')}
                </section>

                <section class="filter-section mb-4" aria-label="Filtros Doações 2023">
                    <div class="filter-toolbar">
                        <div class="filter-title"><i class="fas fa-filter text-secondary" aria-hidden="true"></i><strong>Filtros</strong></div>
                        <div class="filter-search-actions">
                            <input type="text" id="filtroDoacoesBusca" class="form-control" placeholder="Buscar por UF ou objeto..." aria-label="Buscar doações 2023">
                            <button id="btnLimparFiltroDoacoes" type="button" class="btn btn-outline-secondary btn-icon-text">
                                <i class="fas fa-undo" aria-hidden="true"></i><span>Limpar</span>
                            </button>
                        </div>
                    </div>
                    <div class="budget-filter-grid profor-filter-grid">
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroDoacoesUf">UF</label>
                            <select id="filtroDoacoesUf" class="form-select"><option value="">Todas</option>${optionsUf}</select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroDoacoesOrdenacao">Ordenar por</label>
                            <select id="filtroDoacoesOrdenacao" class="form-select">
                                <option value="alfabetica">Ordem alfabética</option>
                                <option value="regiao">Regiões</option>
                                <option value="valor-desc">Valor estimado: maior para menor</option>
                                <option value="quantidade-desc">Quantidade: maior para menor</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section class="budget-insight-grid profor-insight-grid mb-4" id="doacoes-selected-summary" aria-label="Resumo da seleção Doações 2023"></section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div><p class="section-eyebrow mb-1">Bens doados</p><h2>Carteira DOAÇÕES 2023</h2></div>
                        <small class="text-muted"><i class="fas fa-mouse-pointer me-1" aria-hidden="true"></i> Clique em uma linha para abrir o detalhe da UF</small>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table funpen-donation-table">
                            <thead>
                                <tr>
                                    <th>UF</th><th>Objeto</th><th class="text-center">Qtd.</th>
                                    <th class="text-end">Valor Unit. Estimado</th><th class="text-end">Valor Total Estimado</th>
                                </tr>
                            </thead>
                            <tbody id="doacoes-table-body"></tbody>
                        </table>
                    </div>
                </section>
            `;
            registrarEventosDoacoes2023(dados);
            atualizarTabelaDoacoes2023(dados);
        }

        function abrirDetalheDoacoes2023(uf) {
            const dados = obterDadosDoacoes2023();
            const container = document.getElementById('view-doacoes-2023-detalhe');
            if (!dados || !container) {
                toggleView('doacoes2023');
                return;
            }
            const itens = dados.itens.filter((item) => item.uf === uf);
            if (!itens.length) {
                toggleView('doacoes2023');
                return;
            }
            const resumo = calcularResumoItensFunpen(itens);
            const nomeEstado = obterNomeEstadoFunpen(uf);
            container.innerHTML = `
                <div class="report-actions pdf-hidden">
                    <button type="button" class="btn btn-outline-secondary btn-icon-text" onclick="toggleView('doacoes2023')">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i><span>Voltar para DOAÇÕES 2023</span>
                    </button>
                </div>
                <div class="report-content profor-detail-content">
                    <section class="profor-detail-header">
                        <div class="d-flex align-items-center">
                            <span class="badge badge-uf me-3">${escapeHtml(uf)}</span>
                            <div>
                                <p class="section-eyebrow mb-1">Doações 2023</p>
                                <h2>${escapeHtml(nomeEstado)} (${escapeHtml(uf)})</h2>
                                <div class="profor-detail-meta">
                                    <span><i class="fas fa-gift" aria-hidden="true"></i> ${resumo.totalItens} item(ns) doado(s)</span>
                                    <span><i class="fas fa-coins" aria-hidden="true"></i> ${formatMoney(resumo.valorTotal)} estimados</span>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="row my-4 row-cols-1 row-cols-md-3 g-3" aria-label="Resumo de doações por UF">
                        ${renderizarKpiDetalheProfor('Itens doados', String(resumo.totalItens), 'Registros da UF', '', 'fa-gift')}
                        ${renderizarKpiDetalheProfor('Quantidade', formatarQuantidadeProfor(resumo.quantidade), 'Total físico', 'kpi-card-info', 'fa-boxes-stacked')}
                        ${renderizarKpiDetalheProfor('Valor estimado', formatMoney(resumo.valorTotal), 'Valor total dos bens', 'kpi-card-warning', 'fa-coins')}
                    </section>
                    <section class="table-container mb-0">
                        <div class="section-header compact"><div><p class="section-eyebrow mb-1">Bens</p><h2>Doações da UF</h2></div></div>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover w-100 app-data-table funpen-donation-table">
                                <thead>
                                    <tr>
                                        <th>Objeto</th><th class="text-center">Qtd.</th>
                                        <th class="text-end">Valor Unit. Estimado</th><th class="text-end">Valor Total Estimado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itens.map((item) => `
                                        <tr>
                                            <td data-label="Objeto">${escapeHtml(item.objeto)}</td>
                                            <td data-label="Qtd." class="text-center">${formatarQuantidadeProfor(item.quantidade)}</td>
                                            <td data-label="Valor Unit. Estimado" class="text-end font-monospace small">${formatMoney(item.valorUnitario)}</td>
                                            <td data-label="Valor Total Estimado" class="text-end font-monospace text-warning fw-bold">${formatMoney(item.valorTotal)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            `;
            toggleView('doacoes2023-detalhe');
        }

        // ========================================================================
        // FORMALIZACAO PROFOR
        // ========================================================================
        function obterClasseAlertaFormalizacao(severidade) {
            if (severidade === 'critico') return 'danger';
            if (severidade === 'moderado') return 'warning';
            if (severidade === 'informativo') return 'info';
            return 'neutral';
        }

        function renderizarBadgeAlertaFormalizacao(alerta) {
            const classe = obterClasseAlertaFormalizacao(alerta.severidade);
            return `<span class="profor-alert-badge profor-alert-${classe}" title="${escapeHtml(alerta.mensagem)}">${escapeHtml(alerta.tipo)}</span>`;
        }

        function renderizarAtalhosUfFormalizacao(ufs = []) {
            return ufs.map((uf) => `
                <button type="button" class="formalizacao-uf-shortcut" data-formalizacao-uf="${escapeHtml(uf)}" title="Abrir detalhamento de ${escapeHtml(uf)}">
                    ${escapeHtml(uf)}
                </button>
            `).join('');
        }

        function renderizarStatusFormalizacao(proposta) {
            const temCritico = proposta.alertas.some((alerta) => alerta.severidade === 'critico');
            const classe = proposta.aptaCelebracao
                ? 'success'
                : temCritico
                    ? 'danger'
                    : proposta.progressoGeral >= 70
                        ? 'warning'
                        : 'info';
            return `<span class="budget-status formalizacao-status-${classe}">${escapeHtml(proposta.situacaoGeral)}</span>`;
        }

        function renderizarProgressoFormalizacao(percentual, rotulo = '') {
            const valor = getProgressWidth(percentual);
            return `
                <div class="custom-progress-pill formalizacao-progress" title="${escapeHtml(rotulo || formatPercent(valor))}">
                    <div class="pill-fill" style="width: ${valor}%; background-color: ${getProgressColor(valor)}"></div>
                    <div class="pill-text">${formatPercent(valor)}</div>
                </div>
            `;
        }

        function filtrarPropostasFormalizacao(dados) {
            const busca = normalizarBusca(document.getElementById('filtroFormalizacaoBusca')?.value || '');
            const uf = document.getElementById('filtroFormalizacaoUf')?.value || '';
            const regiao = document.getElementById('filtroFormalizacaoRegiao')?.value || '';
            const status = document.getElementById('filtroFormalizacaoStatus')?.value || '';
            const ouvidoria = document.getElementById('filtroFormalizacaoOuvidoria')?.value || '';
            const pendencia = document.getElementById('filtroFormalizacaoPendencia')?.value || '';

            return dados.propostas.filter((proposta) => {
                const textoBusca = normalizarBusca([
                    proposta.uf,
                    proposta.estado,
                    proposta.idProposta,
                    proposta.numeroProposta,
                    proposta.situacaoGeral,
                    proposta.gestor.nome,
                    proposta.gestor.email,
                    proposta.gestor.telefone,
                    proposta.cadastroInstitucional?.orgao,
                    proposta.cadastroInstitucional?.sigla,
                    proposta.cadastroInstitucional?.cnpj,
                    proposta.cadastroInstitucional?.emailGabinete,
                    proposta.contatosPessoas?.map((contato) => [
                        contato.papel,
                        contato.cargo,
                        contato.nome,
                        contato.telefone,
                        contato.email
                    ].join(' ')).join(' ')
                ].join(' '));

                const passaPendencia = !pendencia
                    || (pendencia === 'alerta-critico' && proposta.alertas.some((alerta) => alerta.severidade === 'critico'))
                    || (pendencia === 'condicao-suspensiva' && proposta.condicaoSuspensiva.exige)
                    || (pendencia === 'com-pendencia' && (
                        proposta.alertas.some((alerta) => alerta.severidade === 'critico' || alerta.severidade === 'moderado')
                        || (proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida)
                        || !proposta.aptaCelebracao
                    ))
                    || (pendencia === 'condicao' && proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida)
                    || (pendencia === 'financeiro' && (!proposta.validacoes.valorRepasseOk || !proposta.validacoes.valorGlobalOk || !proposta.plano.fechaComValorGlobal))
                    || (pendencia === 'falabr' && !proposta.falaBr.previsto)
                    || (pendencia === 'documentos' && (!proposta.progressoDocumentosProjeto.completo || !proposta.progressoDocumentosFormalizacao.completo))
                    || (pendencia === 'plano' && !proposta.plano.fechaComValorGlobal)
                    || (pendencia === 'aptas' && proposta.aptaCelebracao);
                const passaOuvidoria = !ouvidoria
                    || (ouvidoria === 'institucionalizada' && proposta.condicaoSuspensiva.exige && proposta.condicaoSuspensiva.resolvida)
                    || (ouvidoria === 'sem-institucionalizacao' && proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida)
                    || (ouvidoria === 'nao-se-aplica' && !proposta.condicaoSuspensiva.exige);

                return (!busca || textoBusca.includes(busca))
                    && (!uf || proposta.uf === uf)
                    && (!regiao || obterRegiaoPorUf(proposta.uf) === regiao)
                    && (!status || proposta.situacaoGeral === status)
                    && passaOuvidoria
                    && passaPendencia;
            });
        }

        function renderizarBandeiraCardFormalizacao(proposta) {
            const flagUrl = catalogoAplicacao.imagensBandeiras?.[proposta.uf] || '';
            const safeUf = escapeHtml(proposta.uf);

            if (!flagUrl) {
                return `<span class="formalizacao-card-flag-placeholder" aria-label="Bandeira ${safeUf}"><i class="fas fa-flag" aria-hidden="true"></i></span>`;
            }

            return `
                <span class="formalizacao-card-flag-wrap">
                    <img
                        src="${escapeHtml(flagUrl)}"
                        alt="Bandeira ${safeUf}"
                        class="formalizacao-card-flag"
                        onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.classList.remove('d-none');"
                    >
                    <span class="formalizacao-card-flag-placeholder d-none" aria-label="Bandeira ${safeUf}">
                        <i class="fas fa-flag" aria-hidden="true"></i>
                    </span>
                </span>
            `;
        }

        function renderizarBadgeOuvidoriaFormalizacao(proposta) {
            if (!proposta.condicaoSuspensiva.exige) return '';

            return proposta.condicaoSuspensiva.resolvida
                ? '<span class="profor-alert-badge profor-alert-success">Ouvidoria institucionalizada</span>'
                : '<span class="profor-alert-badge profor-alert-danger">Sem ouvidoria institucionalizada</span>';
        }

        function renderizarBadgeCondicaoSuspensivaFormalizacao(proposta) {
            if (!proposta?.condicaoSuspensiva?.exige) return '';

            if (proposta.condicaoSuspensiva.resolvida) {
                return '<span class="app-status-badge app-status-badge-success"><i class="fas fa-landmark" aria-hidden="true"></i><span>Condição suspensiva resolvida</span></span>';
            }

            return '<span class="app-status-badge app-status-badge-danger"><i class="fas fa-landmark" aria-hidden="true"></i><span>Condição suspensiva: ato normativo publicado pendente</span></span>';
        }

        function renderizarResumoTrilhaFormalizacao(proposta) {
            const trilha = Array.isArray(proposta?.trilha) ? proposta.trilha : [];
            if (!trilha.length) return '';

            return `
                <div class="formalizacao-stage-strip" aria-label="Resumo da trilha da formalização">
                    ${trilha.map((etapa) => `
                        <span class="formalizacao-stage-pill formalizacao-stage-pill-${escapeHtml(etapa.estado || 'pendente')}">
                            ${escapeHtml(etapa.rotulo)}
                        </span>
                    `).join('')}
                </div>
            `;
        }

        function obterEstadoChecklistDocumentoFormalizacao(documento, indice, indiceAtual) {
            const status = normalizarBusca(documento.statusAnalise || '');

            if (status.includes('reprovado') || status.includes('correcao') || status.includes('pendente')) {
                return 'risco';
            }

            if (documento.enviado) {
                return 'concluida';
            }

            return indice === indiceAtual ? 'atual' : 'pendente';
        }

        function renderizarChecklistCardFormalizacao(proposta, tipo, titulo, documentos, progresso) {
            const id = `formalizacao-check-${tipo}-${proposta.uf}`;
            const exigidos = documentos.filter((documento) => documento.obrigatorio && !normalizarBusca(documento.statusAnalise || '').includes('nao se aplica'));
            const lista = exigidos.length ? exigidos : documentos;
            const primeiroPendente = lista.findIndex((documento) => !documento.enviado);
            const indiceAtual = primeiroPendente >= 0 ? primeiroPendente : lista.length - 1;

            return `
                <div class="formalizacao-card-checklist">
                    <button
                        type="button"
                        class="formalizacao-card-check-toggle"
                        data-formalizacao-check-toggle="${escapeHtml(id)}"
                        aria-expanded="false"
                        aria-controls="${escapeHtml(id)}"
                    >
                        <span>${escapeHtml(titulo)}</span>
                        <strong>${progresso.enviados}/${progresso.total}</strong>
                        <i class="fas fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <div id="${escapeHtml(id)}" class="formalizacao-card-check-panel d-none">
                        <ol class="formalizacao-card-doc-timeline">
                            ${lista.map((documento, indice) => {
                                const estado = obterEstadoChecklistDocumentoFormalizacao(documento, indice, indiceAtual);
                                const status = documento.enviado ? (documento.statusAnalise || 'Enviado') : 'Não enviado';
                                return `
                                    <li class="formalizacao-card-doc-step formalizacao-card-doc-step-${estado}">
                                        <span class="formalizacao-card-doc-marker" aria-hidden="true">
                                            <i class="fas ${estado === 'concluida' ? 'fa-check' : estado === 'risco' ? 'fa-triangle-exclamation' : 'fa-circle'}"></i>
                                        </span>
                                        <div>
                                            <strong>${escapeHtml(documento.nome || 'Documento')}</strong>
                                            ${renderizarStatusDocumentoFormalizacao(status)}
                                        </div>
                                    </li>
                                `;
                            }).join('')}
                        </ol>
                    </div>
                </div>
            `;
        }

        function renderizarCartaoFormalizacao(proposta) {
            const alertasCriticos = proposta.alertas.filter((alerta) => alerta.severidade === 'critico').length;
            const planoClasse = proposta.plano.fechaComValorGlobal ? 'success' : 'danger';
            const condicao = proposta.condicaoSuspensiva.exige
                ? proposta.condicaoSuspensiva.situacao
                : 'Não se aplica';
            const emEdicao = formalizacaoItemEmEdicao(proposta.uf);

            return `
                <article class="formalizacao-card ${alertasCriticos ? 'formalizacao-card-risk' : ''} ${emEdicao ? 'formalizacao-card-editing' : ''}">
                    <div class="formalizacao-card-header">
                        <div class="formalizacao-card-title-row">
                            ${renderizarBandeiraCardFormalizacao(proposta)}
                            <div>
                                <h3>${escapeHtml(proposta.estado)}</h3>
                                <p>${escapeHtml(proposta.numeroProposta || proposta.idProposta)}</p>
                            </div>
                        </div>
                        ${renderizarStatusFormalizacao(proposta)}
                    </div>
                    <div class="formalizacao-card-metrics">
                        <div><span>Valor global</span><strong>${formatMoney(proposta.valorGlobal)}</strong></div>
                        <div><span>Repasse</span><strong>${formatMoney(proposta.valorRepasse)}</strong></div>
                        <div><span>Contrapartida</span><strong>${formatMoney(proposta.valorContrapartida)}</strong></div>
                    </div>
                    <div class="formalizacao-card-progress">
                        <div>
                            <span>Projeto</span>
                            ${renderizarProgressoFormalizacao(proposta.progressoDocumentosProjeto.percentual, 'Documentos do projeto')}
                        </div>
                        <div>
                            <span>Formalização</span>
                            ${renderizarProgressoFormalizacao(proposta.progressoDocumentosFormalizacao.percentual, 'Documentos da formalização')}
                        </div>
                    </div>
                    ${renderizarResumoTrilhaFormalizacao(proposta)}
                    <div class="formalizacao-card-tags">
                        <span class="profor-alert-badge profor-alert-${planoClasse}">${escapeHtml(proposta.situacaoPlano)}</span>
                        ${renderizarBadgeCondicaoSuspensivaFormalizacao(proposta)}
                        ${proposta.falaBr.previsto ? '<span class="profor-alert-badge profor-alert-success">Fala.BR previsto</span>' : '<span class="profor-alert-badge profor-alert-danger">Fala.BR pendente</span>'}
                        ${renderizarBadgeOuvidoriaFormalizacao(proposta)}
                    </div>
                    <div class="formalizacao-card-checklists">
                        ${renderizarChecklistCardFormalizacao(proposta, 'projeto', 'Docs do projeto', proposta.documentosProjeto, proposta.progressoDocumentosProjeto)}
                        ${renderizarChecklistCardFormalizacao(proposta, 'formalizacao', 'Docs da formalização', proposta.documentosFormalizacao, proposta.progressoDocumentosFormalizacao)}
                    </div>
                    <div class="formalizacao-card-actions">
                        ${renderActionButton({
                            type: 'info',
                            label: 'Ver detalhe',
                            variant: 'outline-primary',
                            extraClass: 'formalizacao-open-button',
                            title: `Abrir detalhamento de ${proposta.uf}`,
                            attributes: `data-formalizacao-uf="${escapeHtml(proposta.uf)}"`
                        })}
                        ${!dadosPaginaEmModoEstatico('formalizacaoProfor') ? renderActionButton({
                            type: emEdicao ? 'success' : 'edit',
                            label: emEdicao ? 'Fechar edição' : 'Editar',
                            variant: emEdicao ? 'primary' : 'outline-primary',
                            backend: true,
                            title: emEdicao ? `Fechar edição de ${proposta.uf}` : `Editar acompanhamento de ${proposta.uf}`,
                            attributes: `data-formalizacao-toggle-editor="${escapeHtml(proposta.uf)}"`
                        }) : ''}
                    </div>
                    ${renderizarPainelEdicaoFormalizacaoUf(proposta, 1)}
                </article>
            `;
        }

        function calcularResumoSelecaoFormalizacao(propostas) {
            return propostas.reduce((resumo, proposta) => {
                resumo.valorGlobal += Number(proposta.valorGlobal) || 0;
                resumo.alertasCriticos += proposta.alertas.filter((alerta) => alerta.severidade === 'critico').length;
                resumo.aptas += proposta.aptaCelebracao ? 1 : 0;
                resumo.planosOk += proposta.plano.fechaComValorGlobal ? 1 : 0;
                resumo.progresso += proposta.progressoGeral;
                return resumo;
            }, { valorGlobal: 0, alertasCriticos: 0, aptas: 0, planosOk: 0, progresso: 0 });
        }

        function renderizarAlertasConsolidadosFormalizacao(alertas) {
            const alertasPrioritarios = alertas
                .filter((alerta) => alerta.severidade !== 'informativo')
                .slice(0, 10);

            if (!alertasPrioritarios.length) {
                return `
                    <div class="formalizacao-empty-state">
                        <i class="fas fa-circle-check" aria-hidden="true"></i>
                        <span>Nenhuma pendência crítica ou moderada encontrada na seleção atual.</span>
                    </div>
                `;
            }

            return alertasPrioritarios.map((alerta) => `
                <button type="button" class="formalizacao-alert-item" data-formalizacao-uf="${escapeHtml(alerta.uf)}">
                    <span class="profor-alert-badge profor-alert-${obterClasseAlertaFormalizacao(alerta.severidade)}">${escapeHtml(alerta.uf)}</span>
                    <strong>${escapeHtml(alerta.tipo)}</strong>
                    <span>${escapeHtml(alerta.mensagem)}</span>
                </button>
            `).join('');
        }

        function obterClasseDiagnostico(severidade = 'success') {
            if (severidade === 'danger') return 'danger';
            if (severidade === 'warning') return 'warning';
            return 'success';
        }

        function renderizarItensDiagnostico(itens = [], renderItem = (item) => item, limite = 8) {
            if (!itens.length) {
                return '<span class="diagnostic-empty">Nenhuma ocorrência</span>';
            }

            const exibidos = itens.slice(0, limite);
            const restante = itens.length - exibidos.length;
            return `
                <ul class="diagnostic-list">
                    ${exibidos.map((item) => `<li>${renderItem(item)}</li>`).join('')}
                    ${restante > 0 ? `<li>+ ${restante} ocorrência(s)</li>` : ''}
                </ul>
            `;
        }

        // Painel superior da Formalização: transforma inconsistências da planilha
        // em itens acionáveis antes que o usuário abra cada UF.
        function renderizarDiagnosticoFormalizacao(diagnostico = {}) {
            const classe = obterClasseDiagnostico(diagnostico.severidadeGeral);
            const totalPendencias = [
                ...(diagnostico.ufsFaltantes || []),
                ...(diagnostico.ufsExcedentes || []),
                ...(diagnostico.repassesDivergentes || []),
                ...(diagnostico.condicoesSuspensivasPendentes || []),
                ...(diagnostico.condicoesSuspensivasSemChecklist || []),
                ...(diagnostico.documentosObrigatoriosIncompletos || []),
                ...(diagnostico.documentosSemDicionario || []),
                ...(diagnostico.documentosEnviadosSemLink || [])
            ].length;

            return `
                <section class="data-diagnostic-panel data-diagnostic-${classe} mb-4" aria-label="Diagnóstico da base PROFOR">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Controle de qualidade</p>
                            <h2>Diagnóstico da base PROFOR</h2>
                        </div>
                        <span class="profor-alert-badge profor-alert-${classe}">${totalPendencias ? `${totalPendencias} ocorrência(s)` : 'Sem inconsistências'}</span>
                    </div>
                    <div class="diagnostic-metric-grid">
                        <div><span>UFs esperadas/localizadas</span><strong>${(diagnostico.ufsEsperadas || []).length}/${(diagnostico.ufsEncontradas || []).length}</strong></div>
                        <div><span>UFs faltantes</span><strong>${(diagnostico.ufsFaltantes || []).length}</strong></div>
                        <div><span>UFs excedentes</span><strong>${(diagnostico.ufsExcedentes || []).length}</strong></div>
                        <div><span>Repasse esperado</span><strong>${formatMoney(diagnostico.totalRepasseEsperado || 0)}</strong></div>
                        <div><span>Repasse encontrado</span><strong>${formatMoney(diagnostico.totalRepasseEncontrado || 0)}</strong></div>
                        <div><span>Repasse divergente</span><strong>${(diagnostico.repassesDivergentes || []).length}</strong></div>
                    </div>
                    <div class="diagnostic-detail-grid">
                        <div>
                            <h3>Estrutura</h3>
                            ${renderizarItensDiagnostico([
                                ...(diagnostico.ufsFaltantes || []).map((uf) => ({ texto: `UF faltante: ${uf}` })),
                                ...(diagnostico.ufsExcedentes || []).map((uf) => ({ texto: `UF fora da rodada: ${uf}` })),
                                ...(diagnostico.repassesDivergentes || []).map((item) => ({ texto: `${item.uf}: ${formatMoney(item.valor)} em vez de ${formatMoney(item.esperado)}` }))
                            ], (item) => escapeHtml(item.texto))}
                        </div>
                        <div>
                            <h3>Documentos</h3>
                            ${renderizarItensDiagnostico([
                                ...(diagnostico.condicoesSuspensivasPendentes || []).map((item) => ({ texto: `${item.uf}: condição suspensiva ${item.situacao}` })),
                                ...(diagnostico.condicoesSuspensivasSemChecklist || []).map((item) => ({ texto: `${item.uf}: sem item de ato normativo no checklist` })),
                                ...(diagnostico.documentosSemDicionario || []).map((item) => ({ texto: `${item.uf || item.idProposta}: ${item.codigo} sem dicionário` })),
                                ...(diagnostico.documentosEnviadosSemLink || []).map((item) => ({ texto: `${item.uf}: ${item.codigo} enviado sem link` })),
                                ...(diagnostico.documentosObrigatoriosIncompletos || []).map((item) => ({ texto: `${item.uf}: ${item.codigo} pendente` }))
                            ], (item) => escapeHtml(item.texto))}
                        </div>
                    </div>
                </section>
            `;
        }

        function atualizarListaFormalizacao(dados) {
            const propostas = filtrarPropostasFormalizacao(dados);
            const resumoSelecao = calcularResumoSelecaoFormalizacao(propostas);
            const progressoMedio = propostas.length ? resumoSelecao.progresso / propostas.length : 0;
            const selectedSummary = document.getElementById('formalizacao-selected-summary');
            const cardGrid = document.getElementById('formalizacao-card-grid');
            const tbody = document.getElementById('formalizacao-table-body');
            const alertasContainer = document.getElementById('formalizacao-alert-list');

            if (selectedSummary) {
                selectedSummary.innerHTML = `
                    <div class="budget-insight-card kpi-card">
                        <div class="kpi-title"><i class="fas fa-filter" aria-hidden="true"></i>UFs na seleção</div>
                        <div class="kpi-value">${propostas.length}</div>
                        <div class="kpi-desc">de ${dados.resumo.totalPropostas} propostas</div>
                    </div>
                    <div class="budget-insight-card kpi-card">
                        <div class="kpi-title"><i class="fas fa-scale-balanced" aria-hidden="true"></i>Valor Global</div>
                        <div class="kpi-value text-money">${formatMoney(resumoSelecao.valorGlobal)}</div>
                        <div class="kpi-desc">repasse + contrapartida</div>
                    </div>
                    <div class="budget-insight-card kpi-card ${resumoSelecao.alertasCriticos ? 'kpi-card-warning' : 'kpi-card-success'}">
                        <div class="kpi-title"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>Alertas críticos</div>
                        <div class="kpi-value">${resumoSelecao.alertasCriticos}</div>
                        <div class="kpi-desc">${resumoSelecao.aptas} apta(s) à celebração</div>
                    </div>
                    <div class="budget-insight-card kpi-card kpi-card-info">
                        <div class="kpi-title"><i class="fas fa-chart-line" aria-hidden="true"></i>Progresso médio</div>
                        <div class="kpi-value">${formatPercent(progressoMedio)}</div>
                        <div class="kpi-desc">${resumoSelecao.planosOk} plano(s) compatíveis</div>
                    </div>
                `;
            }

            if (alertasContainer) {
                const ufsSelecionadas = new Set(propostas.map((proposta) => proposta.uf));
                const alertas = dados.resumo.alertas.filter((alerta) => ufsSelecionadas.has(alerta.uf));
                alertasContainer.innerHTML = renderizarAlertasConsolidadosFormalizacao(alertas);
            }

            if (cardGrid) {
                cardGrid.innerHTML = propostas.length
                    ? propostas.map(renderizarCartaoFormalizacao).join('')
                    : renderEmptyState({
                        titulo: 'Nenhuma proposta encontrada.',
                        descricao: 'Ajuste os filtros aplicados para localizar outras UFs ou registros.',
                        icon: 'fa-search'
                    });
            }

            if (!tbody) return;
            tbody.innerHTML = propostas.length ? propostas.map((proposta) => {
                const alertasCriticos = proposta.alertas.filter((alerta) => alerta.severidade === 'critico');
                return `
                    <tr class="profor-row ${alertasCriticos.length ? 'profor-row-risk' : ''}" tabindex="0" data-formalizacao-uf="${escapeHtml(proposta.uf)}">
                        <td data-label="UF" class="align-middle">
                            <div class="profor-convenio-cell">
                                <span class="badge badge-uf">${escapeHtml(proposta.uf)}</span>
                                <div>
                                    <strong>${escapeHtml(proposta.estado)}</strong>
                                    <span>${escapeHtml(proposta.numeroProposta || proposta.idProposta)}</span>
                                </div>
                            </div>
                        </td>
                        <td data-label="Status" class="align-middle text-center">${renderizarStatusFormalizacao(proposta)}</td>
                        <td data-label="Valor Global" class="align-middle text-end font-monospace">${formatMoney(proposta.valorGlobal)}</td>
                        <td data-label="Projeto" class="align-middle text-center">${renderizarProgressoFormalizacao(proposta.progressoDocumentosProjeto.percentual)}</td>
                        <td data-label="Formalização" class="align-middle text-center">${renderizarProgressoFormalizacao(proposta.progressoDocumentosFormalizacao.percentual)}</td>
                        <td data-label="Plano" class="align-middle text-center">
                            <span class="profor-alert-badge profor-alert-${proposta.plano.fechaComValorGlobal ? 'success' : 'danger'}">${proposta.plano.fechaComValorGlobal ? 'Compatível' : 'Divergente'}</span>
                        </td>
                        <td data-label="Cond. suspensiva" class="align-middle text-center">
                            <span class="profor-alert-badge profor-alert-${!proposta.condicaoSuspensiva.exige ? 'neutral' : proposta.condicaoSuspensiva.resolvida ? 'success' : 'danger'}">${escapeHtml(proposta.condicaoSuspensiva.situacao)}</span>
                        </td>
                        <td data-label="Alertas" class="align-middle">
                            <div class="profor-alert-list">${proposta.alertas.length ? proposta.alertas.slice(0, 4).map(renderizarBadgeAlertaFormalizacao).join('') : '<span class="profor-alert-badge profor-alert-success">Sem alerta</span>'}</div>
                        </td>
                        <td data-label="Ações" class="align-middle text-center">
                            <div class="budget-row-actions justify-content-center">
                                ${renderizarBotaoEdicaoFormalizacao(proposta.uf)}
                        ${formalizacaoItemEmEdicao(proposta.uf) ? `
                        ${renderActionButton({
                            type: 'save',
                            label: 'Salvar alterações',
                            variant: 'primary',
                            backend: true,
                            disabled: !obterQuantidadeAlteracoesFormalizacao(proposta.uf),
                            onClick: `salvarAlteracoesFormalizacao('${escapeHtml(proposta.uf)}')`,
                            title: 'Salvar alterações',
                            iconOnly: true,
                            extraClass: 'budget-row-action',
                            attributes: `data-formalizacao-salvar-linha="${escapeHtml(proposta.uf)}"`
                        })}
                        ${renderActionButton({
                            type: 'cancel',
                            label: 'Cancelar edição',
                            variant: 'outline-secondary',
                            backend: true,
                            onClick: `cancelarEdicaoFormalizacao('${escapeHtml(proposta.uf)}')`,
                            title: 'Cancelar edição',
                            iconOnly: true,
                            extraClass: 'budget-row-action',
                            attributes: `data-formalizacao-cancelar-linha="${escapeHtml(proposta.uf)}"`
                        })}
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                    ${renderizarPainelEdicaoFormalizacaoUf(proposta, 9)}
                `;
            }).join('') : `
                <tr>
                    <td colspan="9" class="py-4">
                        ${renderEmptyState({
                            titulo: 'Nenhuma proposta encontrada.',
                            descricao: 'Ajuste os filtros aplicados para localizar outras UFs ou registros.',
                            icon: 'fa-search'
                        })}
                    </td>
                </tr>
            `;

            document.querySelectorAll('[data-formalizacao-uf]').forEach((elemento) => {
                elemento.addEventListener('click', () => abrirDetalheFormalizacaoProfor(elemento.dataset.formalizacaoUf));
                if (elemento.tagName !== 'BUTTON') {
                    elemento.addEventListener('keydown', (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        abrirDetalheFormalizacaoProfor(elemento.dataset.formalizacaoUf);
                    });
                }
            });

            document.querySelectorAll('[data-formalizacao-check-toggle]').forEach((botao) => {
                botao.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const painel = document.getElementById(botao.dataset.formalizacaoCheckToggle);
                    if (!painel) return;
                    const deveAbrir = painel.classList.contains('d-none');
                    painel.classList.toggle('d-none', !deveAbrir);
                    botao.setAttribute('aria-expanded', String(deveAbrir));
                });
            });

            registrarEventosBotoesEdicaoFormalizacao(dados);
            registrarEventosCamposEdicaoFormalizacao();
        }

        function registrarEventosBotoesEdicaoFormalizacao(dados) {
            document.querySelectorAll('[data-formalizacao-toggle-editor]').forEach((botao) => {
                if (botao.dataset.formalizacaoEventoRegistrado === '1') return;
                botao.dataset.formalizacaoEventoRegistrado = '1';
                botao.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const uf = botao.dataset.formalizacaoToggleEditor;
                    if (formalizacaoEditoresAbertos.has(uf)) {
                        formalizacaoEditoresAbertos.delete(uf);
                    } else {
                        abrirEditorFormalizacao(uf);
                        return;
                    }
                    renderFormalizacaoProforView();
                });
            });

            document.querySelectorAll('[data-formalizacao-salvar-linha]').forEach((botao) => {
                if (botao.dataset.formalizacaoEventoRegistrado === '1') return;
                botao.dataset.formalizacaoEventoRegistrado = '1';
                botao.addEventListener('click', (event) => {
                    event.stopPropagation();
                    salvarAlteracoesFormalizacao(botao.dataset.formalizacaoSalvarLinha);
                });
            });

            document.querySelectorAll('[data-formalizacao-cancelar-linha]').forEach((botao) => {
                if (botao.dataset.formalizacaoEventoRegistrado === '1') return;
                botao.dataset.formalizacaoEventoRegistrado = '1';
                botao.addEventListener('click', (event) => {
                    event.stopPropagation();
                    cancelarEdicaoFormalizacao(botao.dataset.formalizacaoCancelarLinha);
                });
            });
        }

        function registrarEventosCamposEdicaoFormalizacao() {
            document.querySelectorAll('[data-formalizacao-status-uf]').forEach((campo) => {
                if (campo.dataset.formalizacaoEventoRegistrado === '1') return;
                campo.dataset.formalizacaoEventoRegistrado = '1';
                campo.addEventListener('change', () => {
                    atualizarClasseStatusFormalizacaoSelect(campo);
                    registrarAlteracaoFormalizacao(
                        campo.dataset.formalizacaoStatusUf,
                        campo.dataset.formalizacaoStatusEtapa,
                        'status',
                        campo.dataset.formalizacaoStatusOriginal,
                        campo.value
                    );
                });
            });

            document.querySelectorAll('[data-formalizacao-observacao-uf]').forEach((campo) => {
                if (campo.dataset.formalizacaoEventoRegistrado === '1') return;
                campo.dataset.formalizacaoEventoRegistrado = '1';
                campo.addEventListener('change', () => {
                    registrarAlteracaoFormalizacao(
                        campo.dataset.formalizacaoObservacaoUf,
                        campo.dataset.formalizacaoObservacaoEtapa,
                        'observacao',
                        campo.dataset.formalizacaoObservacaoOriginal,
                        campo.value
                    );
                });
            });
        }

        function registrarEventosFormalizacao(dados) {
            ['filtroFormalizacaoBusca', 'filtroFormalizacaoUf', 'filtroFormalizacaoRegiao', 'filtroFormalizacaoStatus', 'filtroFormalizacaoOuvidoria', 'filtroFormalizacaoPendencia']
                .forEach((id) => {
                    const elemento = document.getElementById(id);
                    if (!elemento) return;
                    const evento = elemento.tagName === 'INPUT' ? 'input' : 'change';
                    elemento.addEventListener(evento, () => atualizarListaFormalizacao(dados));
                });

            document.querySelectorAll('[data-formalizacao-pendencia-rapida]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const seletor = document.getElementById('filtroFormalizacaoPendencia');
                    if (seletor) seletor.value = botao.dataset.formalizacaoPendenciaRapida || '';
                    document.querySelectorAll('[data-formalizacao-pendencia-rapida]').forEach((item) => {
                        item.classList.toggle('active', item === botao);
                        item.setAttribute('aria-pressed', String(item === botao));
                    });
                    atualizarListaFormalizacao(dados);
                });
            });

            document.getElementById('btnLimparFiltroFormalizacao')?.addEventListener('click', () => {
                ['filtroFormalizacaoBusca', 'filtroFormalizacaoUf', 'filtroFormalizacaoRegiao', 'filtroFormalizacaoStatus', 'filtroFormalizacaoOuvidoria', 'filtroFormalizacaoPendencia']
                    .forEach((id) => {
                        const elemento = document.getElementById(id);
                        if (elemento) elemento.value = '';
                    });
                document.querySelectorAll('[data-formalizacao-pendencia-rapida]').forEach((item, index) => {
                    const ativo = index === 0;
                    item.classList.toggle('active', ativo);
                    item.setAttribute('aria-pressed', String(ativo));
                });
                atualizarListaFormalizacao(dados);
            });

            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) {
                aplicarModoSomenteLeitura();
                return;
            }

            document.getElementById('btnHistoricoFormalizacao')?.addEventListener('click', abrirHistoricoFormalizacao);

            document.getElementById('btnExportarFormalizacao')?.addEventListener('click', () => {
                if (obterQuantidadeAlteracoesFormalizacao()) {
                    alert('Existem alterações não salvas. Salve antes de exportar para que o Excel reflita os dados atualizados.');
                    return;
                }
                window.location.href = obterUrlApiOnasp('/api/formalizacao-profor/exportar');
            });

            registrarEventosCamposEdicaoFormalizacao();
        }

        const STATUS_FORMALIZACAO_EDICAO = ['PENDENTE', 'EM ANDAMENTO', 'CONCLUÍDO', 'COM PENDÊNCIA', 'NÃO SE APLICA', 'VALIDAR'];
        const STATUS_FORMALIZACAO_LABELS = {
            PENDENTE: 'Pendente',
            'EM ANDAMENTO': 'Em andamento',
            CONCLUÍDO: 'Concluído',
            'COM PENDÊNCIA': 'Com pendência',
            'NÃO SE APLICA': 'Não se aplica',
            VALIDAR: 'Validar'
        };
        const STATUS_FORMALIZACAO_SELECT_CLASSES = {
            PENDENTE: 'warning',
            'EM ANDAMENTO': 'primary',
            CONCLUÍDO: 'success',
            'COM PENDÊNCIA': 'danger',
            'NÃO SE APLICA': 'secondary',
            VALIDAR: 'info'
        };

        function obterRotuloStatusFormalizacao(status) {
            return STATUS_FORMALIZACAO_LABELS[status] || status;
        }

        function obterClasseStatusFormalizacaoSelect(status) {
            return STATUS_FORMALIZACAO_SELECT_CLASSES[status] || 'secondary';
        }

        function atualizarClasseStatusFormalizacaoSelect(elemento) {
            if (!elemento) return;
            const valor = String(elemento.value || 'PENDENTE');
            const classeVisual = obterClasseStatusFormalizacaoSelect(valor);
            elemento.classList.remove(
                'formalizacao-status-select-success',
                'formalizacao-status-select-warning',
                'formalizacao-status-select-primary',
                'formalizacao-status-select-danger',
                'formalizacao-status-select-secondary',
                'formalizacao-status-select-info'
            );
            elemento.classList.add('formalizacao-status-select', `formalizacao-status-select-${classeVisual}`);
        }

        function obterQuantidadeAlteracoesFormalizacao(uf = '') {
            if (uf) return Object.keys(formalizacaoAlteracoesPendentes[uf] || {}).length;
            return Object.values(formalizacaoAlteracoesPendentes)
                .reduce((total, etapas) => total + Object.keys(etapas || {}).length, 0);
        }

        function obterAlteracaoFormalizacao(uf, etapa) {
            return formalizacaoAlteracoesPendentes[uf]?.[etapa] || null;
        }

        function obterAlteracoesFormalizacaoPorUf(uf) {
            const alteracoes = formalizacaoAlteracoesPendentes[uf] || {};
            return Object.keys(alteracoes).length ? { [uf]: alteracoes } : {};
        }

        function formalizacaoItemEmEdicao(uf) {
            return formalizacaoEditoresAbertos.has(String(uf));
        }

        function rerenderFormalizacaoContextoAtual() {
            const viewAtual = document.body.dataset.currentView || 'formalizacao';
            if (viewAtual === 'formalizacao-detalhe') {
                renderFormalizacaoProforDetalheView();
                return;
            }

            renderFormalizacaoProforView();
        }

        function abrirEditorFormalizacao(uf) {
            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            formalizacaoEditoresAbertos.add(String(uf));
            rerenderFormalizacaoContextoAtual();
        }

        function cancelarEdicaoFormalizacao(uf) {
            cancelarEdicaoFormalizacaoUf(uf);
        }

        function cancelarEdicaoFormalizacaoUf(uf) {
            delete formalizacaoAlteracoesPendentes[uf];
            formalizacaoEditoresAbertos.delete(String(uf));
            rerenderFormalizacaoContextoAtual();
        }

        function registrarAlteracaoFormalizacao(uf, etapa, campo, valorOriginal, novoValor) {
            const proposta = obterDadosFormalizacaoProfor()?.propostas?.find((item) => item.uf === uf);
            const etapaAtual = proposta?.etapasFormalizacao?.find((item) => item.key === etapa);
            const pendenteAtual = obterAlteracaoFormalizacao(uf, etapa) || {};
            const statusOriginal = etapaAtual?.status || 'PENDENTE';
            const observacaoOriginal = etapaAtual?.observacao || '';
            const proximo = {
                status: pendenteAtual.status ?? statusOriginal,
                observacao: pendenteAtual.observacao ?? observacaoOriginal
            };

            proximo[campo] = novoValor;

            if (!formalizacaoAlteracoesPendentes[uf]) {
                formalizacaoAlteracoesPendentes[uf] = {};
            }

            if (String(proximo.status) === String(statusOriginal) && String(proximo.observacao) === String(observacaoOriginal)) {
                delete formalizacaoAlteracoesPendentes[uf][etapa];
                if (!Object.keys(formalizacaoAlteracoesPendentes[uf]).length) {
                    delete formalizacaoAlteracoesPendentes[uf];
                }
            } else {
                formalizacaoAlteracoesPendentes[uf][etapa] = proximo;
            }

            rerenderFormalizacaoContextoAtual();
        }

        function salvarAlteracoesFormalizacao(uf = '') {
            const dados = obterDadosFormalizacaoProfor();
            abrirModalSenhaFormalizacao(dados, uf);
        }

        function renderizarAcoesFormalizacao() {
            const modoEstatico = dadosPaginaEmModoEstatico('formalizacaoProfor');
            const totalAlteracoes = obterQuantidadeAlteracoesFormalizacao();
            if (modoEstatico) {
                formalizacaoEditoresAbertos = new Set();
                formalizacaoAlteracoesPendentes = {};
            }

            return `
                <section class="diagnostico-action-bar diagnostico-block mb-4" aria-label="Ações da formalização PROFOR">
                    <div>
                        <p class="section-eyebrow mb-1">Atualização</p>
                        <h2>Formalização PROFOR</h2>
                        ${modoEstatico ? renderizarAvisoModoPublicacao() : ''}
                        ${modoEstatico
                            ? '<small class="text-muted">Dados carregados dos JSONs publicados.</small>'
                            : totalAlteracoes
                                ? `<small class="text-muted">${totalAlteracoes} alteração(ões) pendente(s) nas UFs.</small>`
                                : '<small class="text-muted">Edite cada UF pelo botão no fim da linha.</small>'}
                    </div>
                    <div class="diagnostico-action-buttons">
                        ${renderActionButton({
                            id: 'btnExportarFormalizacao',
                            type: 'exportExcel',
                            label: 'Exportar Excel',
                            variant: 'outline-success',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btnHistoricoFormalizacao',
                            type: 'history',
                            label: 'Histórico',
                            variant: 'outline-dark',
                            backend: true,
                            disabled: modoEstatico
                        })}
                    </div>
                </section>
            `;
        }

        function renderizarControleEtapaFormalizacao(proposta, etapa) {
            const pendente = obterAlteracaoFormalizacao(proposta.uf, etapa.key);
            const statusAtual = pendente?.status ?? etapa.status ?? 'PENDENTE';
            const observacaoAtual = obterObservacaoFormalizacaoVisivel(pendente?.observacao ?? etapa.observacao ?? '');

            if (!formalizacaoItemEmEdicao(proposta.uf)) {
                return `
                    <div class="d-flex flex-column gap-1">
                        <span class="budget-status">${escapeHtml(statusAtual)}</span>
                        ${observacaoAtual ? `<small class="text-muted">${escapeHtml(observacaoAtual)}</small>` : ''}
                    </div>
                `;
            }

            return `
                <div class="d-flex flex-column gap-2">
                    <select
                        class="form-select form-select-sm formalizacao-status-select formalizacao-status-select-${obterClasseStatusFormalizacaoSelect(statusAtual)}"
                        data-formalizacao-status-uf="${escapeHtml(proposta.uf)}"
                        data-formalizacao-status-etapa="${escapeHtml(etapa.key)}"
                        data-formalizacao-status-original="${escapeHtml(etapa.status || 'PENDENTE')}"
                    >
                        ${STATUS_FORMALIZACAO_EDICAO.map((status) => `
                            <option value="${escapeHtml(status)}" ${statusAtual === status ? 'selected' : ''}>${escapeHtml(obterRotuloStatusFormalizacao(status))}</option>
                        `).join('')}
                    </select>
                    <input
                        type="text"
                        class="form-control form-control-sm"
                        value="${escapeHtml(pendente?.observacao ?? etapa.observacao ?? '')}"
                        placeholder="Observação curta"
                        data-formalizacao-observacao-uf="${escapeHtml(proposta.uf)}"
                        data-formalizacao-observacao-etapa="${escapeHtml(etapa.key)}"
                        data-formalizacao-observacao-original="${escapeHtml(etapa.observacao || '')}"
                    >
                </div>
            `;
        }

        function renderizarBotaoEdicaoFormalizacao(uf) {
            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) return '';

            const id = String(uf);
            const ativo = formalizacaoItemEmEdicao(id);
            return renderActionButton({
                type: ativo ? 'success' : 'edit',
                label: ativo ? 'Fechar edição' : 'Editar',
                variant: ativo ? 'primary' : 'outline-primary',
                backend: true,
                title: ativo ? 'Fechar edição desta UF' : 'Editar esta UF',
                extraClass: 'budget-row-action budget-row-action-edit',
                attributes: `data-formalizacao-toggle-editor="${escapeHtml(id)}" aria-pressed="${ativo ? 'true' : 'false'}"`
            });
        }

        function renderizarResumoEdicaoFormalizacao(proposta) {
            // Nota: Os campos de condição suspensiva, Fala.BR e observação geral (observacoes)
            // não foram adicionados como inputs editáveis porque o endpoint atual do backend
            // (/api/formalizacao-profor/salvar) não suporta salvá-los no payload.
            // A edição da Formalização é baseada estritamente nas etapas (status/observação) existentes.
            const observacaoVisivel = obterObservacaoFormalizacaoVisivel(proposta.observacoes);
            const falaBr = proposta.falaBr?.previsto ? 'Previsto no cronograma' : 'Pendente no cronograma';

            return `
                <div class="formalizacao-edit-meta">
                    <div class="formalizacao-edit-meta-item">
                        <span>Status geral atual</span>
                        ${renderStatusBadge(proposta.situacaoGeral || 'Pendente')}
                    </div>
                    <div class="formalizacao-edit-meta-item">
                        <span>Condição suspensiva</span>
                        ${proposta.condicaoSuspensiva?.exige
                            ? renderizarBadgeCondicaoSuspensivaFormalizacao(proposta)
                            : '<span class="app-status-badge app-status-badge-secondary"><i class="fas fa-ban" aria-hidden="true"></i><span>Não se aplica</span></span>'}
                    </div>
                    <div class="formalizacao-edit-meta-item">
                        <span>Situação do Fala.BR</span>
                        <strong>${escapeHtml(falaBr)}</strong>
                    </div>
                    <div class="formalizacao-edit-meta-item formalizacao-edit-meta-item-wide">
                        <span>Observação consolidada</span>
                        <strong>${escapeHtml(observacaoVisivel || 'Sem observação consolidada.')}</strong>
                    </div>
                    <div class="formalizacao-edit-meta-item formalizacao-edit-meta-item-wide">
                        <span>Aviso sobre o escopo de edição</span>
                        <strong>No modelo atual, esta tela salva exclusivamente o status e a observação de cada etapa.</strong>
                    </div>
                </div>
            `;
        }

        function renderizarPainelEdicaoFormalizacaoUf(proposta, colspan = 9) {
            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) return '';
            if (!formalizacaoItemEmEdicao(proposta.uf)) return '';

            const etapas = proposta.etapasFormalizacao || [];
            const alteracoesUf = obterQuantidadeAlteracoesFormalizacao(proposta.uf);

            const painelHtml = `
                <div class="budget-edit-panel formalizacao-edit-panel" data-requer-backend="true">
                    <div class="budget-edit-panel-header">
                        <strong>Editar acompanhamento da Formalização - ${escapeHtml(proposta.uf)}</strong>
                        <span>As alterações desta UF ficam pendentes até clicar em Salvar alterações.</span>
                    </div>
                    ${renderizarResumoEdicaoFormalizacao(proposta)}
                    <div class="budget-edit-grid formalizacao-edit-grid">
                        ${etapas.map((etapa) => `
                            <label>
                                <span>${escapeHtml(etapa.label)}</span>
                                ${renderizarControleEtapaFormalizacao(proposta, etapa)}
                            </label>
                        `).join('')}
                    </div>
                        <div class="budget-edit-panel-actions formalizacao-edit-actions">
                            ${renderActionButton({
                                type: 'save',
                                label: 'Salvar alterações',
                                variant: 'primary',
                                backend: true,
                                disabled: !alteracoesUf,
                                onClick: `salvarAlteracoesFormalizacao('${escapeHtml(proposta.uf)}')`,
                                attributes: `data-formalizacao-salvar-linha="${escapeHtml(proposta.uf)}"`
                            })}
                            ${renderActionButton({
                                type: 'cancel',
                                label: 'Cancelar',
                                variant: 'outline-secondary',
                                backend: true,
                                onClick: `cancelarEdicaoFormalizacao('${escapeHtml(proposta.uf)}')`,
                                attributes: `data-formalizacao-cancelar-linha="${escapeHtml(proposta.uf)}"`
                            })}
                        </div>
                </div>
            `;

            if (colspan === 1) {
                return `<div class="pdf-hidden mt-3" data-requer-backend="true">${painelHtml}</div>`;
            }

            return `
                <tr class="budget-edit-row pdf-hidden">
                    <td colspan="${colspan}">
                        ${painelHtml}
                    </td>
                </tr>
            `;
        }

        function renderizarPainelEdicaoFormalizacao(dados) {
            const etapas = dados.etapas || [];
            const propostas = dados.propostas || [];
            const modoEstatico = dadosPaginaEmModoEstatico('formalizacaoProfor');

            if (!etapas.length || !propostas.length) return '';

            return `
                <section class="table-container mb-5 formalizacao-advanced-panel">
                    <details>
                        <summary class="section-header compact">
                            <div>
                                <p class="section-eyebrow mb-1">${modoEstatico ? 'Publicação' : 'Modo local'}</p>
                                <h2>Modo avançado / matriz por etapa</h2>
                            </div>
                            <small class="text-muted">${modoEstatico ? 'Dados somente leitura' : 'As mudanças ficam pendentes até o botão Salvar alterações'}</small>
                        </summary>
                        <div class="table-responsive mt-3">
                            <table class="table table-sm table-hover w-100 app-data-table formalizacao-data-table">
                                <thead>
                                    <tr>
                                        <th>UF</th>
                                        ${etapas.map((etapa) => `<th>${escapeHtml(etapa.label)}</th>`).join('')}
                                        <th class="text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${propostas.map((proposta) => `
                                        <tr>
                                            <td data-label="UF"><strong>${escapeHtml(proposta.uf)}</strong></td>
                                            ${etapas.map((etapaConfig) => {
                                                const etapa = proposta.etapasFormalizacao?.find((item) => item.key === etapaConfig.key) || etapaConfig;
                                                return `<td data-label="${escapeHtml(etapaConfig.label)}">${renderizarControleEtapaFormalizacao(proposta, etapa)}</td>`;
                                            }).join('')}
                                            <td data-label="Ações" class="text-center">
                                                <div class="budget-row-actions justify-content-center">
                                                    ${renderizarBotaoEdicaoFormalizacao(proposta.uf)}
                                                    ${formalizacaoItemEmEdicao(proposta.uf) ? `
                                                    ${renderActionButton({
                                                        type: 'save',
                                                        label: 'Salvar alterações',
                                                        variant: 'primary',
                                                        backend: true,
                                                        disabled: !obterQuantidadeAlteracoesFormalizacao(proposta.uf),
                                                        title: 'Salvar alterações',
                                                        iconOnly: true,
                                                        extraClass: 'budget-row-action',
                                                        attributes: `data-formalizacao-salvar-linha="${escapeHtml(proposta.uf)}"`
                                                    })}
                                                    ${renderActionButton({
                                                        type: 'cancel',
                                                        label: 'Cancelar edição',
                                                        variant: 'outline-secondary',
                                                        backend: true,
                                                        title: 'Cancelar edição',
                                                        iconOnly: true,
                                                        extraClass: 'budget-row-action',
                                                        attributes: `data-formalizacao-cancelar-linha="${escapeHtml(proposta.uf)}"`
                                                    })}
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </section>
            `;
        }

        function obterObservacaoFormalizacaoVisivel(texto = '') {
            const valor = String(texto || '').trim();
            if (!valor) return '';
            if (normalizarBusca(valor).includes('preenchimento simulado para modelagem')) {
                return '';
            }
            return valor;
        }

        function removerModalOnasp(id) {
            const modalExistente = document.getElementById(id);
            if (modalExistente) {
                window.bootstrap?.Modal?.getInstance(modalExistente)?.dispose();
                modalExistente.remove();
            }
        }

        function abrirModalSenhaFormalizacao(dados, ufEscopo = '') {
            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const totalAlteracoes = obterQuantidadeAlteracoesFormalizacao(ufEscopo);
            if (!totalAlteracoes) {
                alert('Não há alterações para salvar.');
                return;
            }

            const detalheEscopo = ufEscopo ? ` da UF ${escapeHtml(ufEscopo)}` : '';
            removerModalOnasp('modalSenhaFormalizacao');
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="modalSenhaFormalizacao" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Confirmar alterações</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <p>Você está prestes a salvar ${totalAlteracoes} alteração(ões)${detalheEscopo} na Formalização PROFOR.</p>
                                <label class="form-label" for="senhaFormalizacao">Senha de confirmação</label>
                                <input type="password" class="form-control" id="senhaFormalizacao" autocomplete="current-password">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'confirmarSalvarFormalizacao',
                                    type: 'save',
                                    label: 'Confirmar e salvar',
                                    variant: 'primary',
                                    backend: true
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `);

            const modalElement = document.getElementById('modalSenhaFormalizacao');
            const modal = new window.bootstrap.Modal(modalElement);
            modal.show();
            document.getElementById('confirmarSalvarFormalizacao')?.addEventListener('click', async () => {
                await salvarFormalizacaoComSenha(document.getElementById('senhaFormalizacao')?.value || '', modal, ufEscopo);
            });
        }

        async function salvarFormalizacaoComSenha(password, modal, ufEscopo = '') {
            if (dadosPaginaEmModoEstatico('formalizacaoProfor')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const changes = ufEscopo
                ? obterAlteracoesFormalizacaoPorUf(ufEscopo)
                : formalizacaoAlteracoesPendentes;

            try {
                const { resposta, payload } = await fetchJsonApiOnasp('/api/formalizacao-profor/salvar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password,
                        changes
                    })
                });

                if (!resposta.ok || !payload.success) {
                    alert(payload.message || 'Não foi possível salvar.');
                    return;
                }

                if (ufEscopo) {
                    delete formalizacaoAlteracoesPendentes[ufEscopo];
                    formalizacaoEditoresAbertos.delete(String(ufEscopo));
                } else {
                    formalizacaoAlteracoesPendentes = {};
                    formalizacaoEditoresAbertos = new Set();
                }
                modal.hide();
                await carregarDadosFormalizacaoProfor(true);
                rerenderFormalizacaoContextoAtual();
                alert(obterMensagemSalvamento(payload));
            } catch (error) {
                alert(`Não foi possível salvar: ${error.message}`);
            }
        }

        async function abrirHistoricoFormalizacao() {
            try {
                const { payload } = await fetchJsonApiOnasp('/api/formalizacao-profor/historico');
                const historico = payload.historico || [];

                removerModalOnasp('modalHistoricoFormalizacao');
                document.body.insertAdjacentHTML('beforeend', `
                    <div class="modal fade" id="modalHistoricoFormalizacao" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-lg modal-dialog-scrollable">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Histórico da Formalização PROFOR</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                                </div>
                                <div class="modal-body">
                                    ${historico.length ? `
                                        <div class="table-responsive">
                                            <table class="table table-sm app-data-table">
                                                <thead><tr><th>Data</th><th>UF</th><th>Campo</th><th>Anterior</th><th>Novo</th></tr></thead>
                                                <tbody>
                                                    ${historico.map((item) => `
                                                        <tr>
                                                            <td>${escapeHtml(item.alteradoEm ? new Date(item.alteradoEm).toLocaleString('pt-BR') : '')}</td>
                                                            <td>${escapeHtml(item.registro || '')}</td>
                                                            <td>${escapeHtml(item.campo || '')}</td>
                                                            <td>${escapeHtml(item.valorAnterior || '')}</td>
                                                            <td>${escapeHtml(item.valorNovo || '')}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    ` : '<div class="diagnostico-empty-state">Nenhuma alteração registrada.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                new window.bootstrap.Modal(document.getElementById('modalHistoricoFormalizacao')).show();
            } catch (error) {
                alert(`Não foi possível carregar o histórico: ${error.message}`);
            }
        }

        function renderFormalizacaoProforView() {
            const container = document.getElementById('view-formalizacao-profor');
            if (!container) return;

            container.style.display = 'block';
            const dados = obterDadosFormalizacaoProfor();
            if (!dados) {
                container.innerHTML = renderErrorState({
                    titulo: VIEW_ERROR_MESSAGES.formalizacao.titulo,
                    detalhe: VIEW_ERROR_MESSAGES.formalizacao.detalhe
                });
                aplicarModoSomenteLeitura();
                return;
            }

            const propostas = Array.isArray(dados.propostas) ? dados.propostas : [];
            if (propostas.length === 0) {
                container.innerHTML = renderEmptyState({
                    titulo: 'Nenhuma proposta de formalização disponível.',
                    descricao: 'Verifique se os dados da base PROFOR foram carregados ou publicados corretamente.',
                    icon: 'fa-file-signature'
                });
                aplicarModoSomenteLeitura();
                return;
            }

            const resumo = dados.resumo || {};
            const filtrosResumo = resumo.filtros || {};
            const ufsFiltro = Array.isArray(filtrosResumo.ufs) && filtrosResumo.ufs.length
                ? filtrosResumo.ufs
                : propostas.map((proposta) => proposta.uf).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const statusFiltro = Array.isArray(filtrosResumo.status) ? filtrosResumo.status : [];
            const opcoesUf = ufsFiltro.map((uf) => `<option value="${escapeHtml(uf)}">${escapeHtml(uf)}</option>`).join('');
            const opcoesRegiao = ORDEM_REGIOES
                .filter((regiao) => (catalogoAplicacao.regioes?.[regiao] || []).some((uf) => ufsFiltro.includes(uf)))
                .map((regiao) => `<option value="${escapeHtml(regiao)}">${escapeHtml(regiao)}</option>`)
                .join('');
            const opcoesStatus = statusFiltro.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('');
            const atalhosUf = renderizarAtalhosUfFormalizacao(dados.ufsAutorizadas || ufsFiltro);
            const quantidadeCondicaoSuspensiva = propostas.filter((proposta) => proposta.condicaoSuspensiva?.exige).length;

            container.innerHTML = `
                <section class="dashboard-intro formalizacao-intro">
                    <div>
                        <p class="section-eyebrow mb-1">PROFOR/ONASP 2026</p>
                        <h2>Formalização PROFOR 2026</h2>
                    </div>
                    <div class="intro-badges" aria-label="Resumo da formalização PROFOR/ONASP">
                        <span><i class="fas fa-map-location-dot" aria-hidden="true"></i> ${resumo.totalPropostas} UFs</span>
                        <span><i class="fas fa-building-columns" aria-hidden="true"></i> ${formatMoney(dados.valorRepassePadrao)} por UF</span>
                        <span><i class="fas fa-file-contract" aria-hidden="true"></i> Convênios</span>
                    </div>
                </section>

                ${renderizarDiagnosticoFormalizacao(dados.diagnostico)}

                ${renderizarAcoesFormalizacao()}

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3" aria-label="Indicadores de formalização">
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'UFs elegíveis',
                            valor: `<span>${resumo.totalPropostas}</span>`,
                            descricao: 'UFs contempladas na rodada',
                            icon: 'fa-file-signature',
                            variant: 'success'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Valor total previsto',
                            valor: `<span class="text-money">${formatMoney(resumo.totalValorGlobal)}</span>`,
                            descricao: 'Repasse + contrapartida',
                            icon: 'fa-scale-balanced'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'UFs com condição suspensiva',
                            valor: `<span>${quantidadeCondicaoSuspensiva}</span>`,
                            descricao: 'PA, RR, RS e SE quando aplicável',
                            icon: 'fa-landmark',
                            variant: quantidadeCondicaoSuspensiva ? 'warning' : ''
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Aptas à celebração',
                            valor: `<span>${resumo.aptasCelebracao}</span>`,
                            descricao: `${resumo.planosCompativeis} plano(s) compatíveis`,
                            icon: 'fa-circle-check',
                            variant: 'info'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Pendências críticas',
                            valor: `<span>${resumo.alertasCriticos}</span>`,
                            descricao: `${resumo.propostasComAlertaCritico} UF(s) com alerta crítico`,
                            icon: 'fa-triangle-exclamation',
                            variant: resumo.alertasCriticos ? 'warning' : 'success'
                        })}
                    </div>
                </section>

                <section class="formalizacao-quick-filter-panel mb-4" aria-label="Recortes rápidos da formalização">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Filtros simples</p>
                            <h2>Recorte da lista</h2>
                        </div>
                    </div>
                    <div class="contact-uf-chip-list diagnostico-uf-chip-list formalizacao-quick-filter-grid">
                        <button type="button" class="contact-uf-filter-chip formalizacao-quick-filter-chip active" data-formalizacao-pendencia-rapida="">Todas</button>
                        <button type="button" class="contact-uf-filter-chip formalizacao-quick-filter-chip" data-formalizacao-pendencia-rapida="condicao-suspensiva">Com condição suspensiva</button>
                        <button type="button" class="contact-uf-filter-chip formalizacao-quick-filter-chip" data-formalizacao-pendencia-rapida="com-pendencia">Com pendência</button>
                        <button type="button" class="contact-uf-filter-chip formalizacao-quick-filter-chip" data-formalizacao-pendencia-rapida="aptas">Aptas à celebração</button>
                    </div>
                </section>

                <section class="filter-section mb-4" aria-label="Filtros da formalização">
                    <div class="filter-toolbar">
                        <div class="filter-title">
                            <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                            <strong>Filtros</strong>
                        </div>
                        <div class="filter-search-actions">
                            <input type="text" id="filtroFormalizacaoBusca" class="form-control" placeholder="Buscar por UF, proposta, contato, órgão ou status..." aria-label="Buscar formalização">
                            <button id="btnLimparFiltroFormalizacao" type="button" class="btn btn-outline-secondary btn-icon-text">
                                <i class="fas fa-undo" aria-hidden="true"></i>
                                <span>Limpar</span>
                            </button>
                        </div>
                    </div>
                    <div class="budget-filter-grid formalizacao-filter-grid">
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFormalizacaoUf">UF</label>
                            <select id="filtroFormalizacaoUf" class="form-select">
                                <option value="">Todas</option>
                                ${opcoesUf}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFormalizacaoRegiao">Região</label>
                            <select id="filtroFormalizacaoRegiao" class="form-select">
                                <option value="">Todos</option>
                                ${opcoesRegiao}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFormalizacaoStatus">Status geral</label>
                            <select id="filtroFormalizacaoStatus" class="form-select">
                                <option value="">Todos</option>
                                ${opcoesStatus}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFormalizacaoOuvidoria">Ouvidoria</label>
                            <select id="filtroFormalizacaoOuvidoria" class="form-select">
                                <option value="">Todas</option>
                                <option value="institucionalizada">Institucionalizada</option>
                                <option value="sem-institucionalizacao">Sem institucionalização</option>
                                <option value="nao-se-aplica">Não se aplica</option>
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroFormalizacaoPendencia">Pendência</label>
                            <select id="filtroFormalizacaoPendencia" class="form-select">
                                <option value="">Todas</option>
                                <option value="condicao-suspensiva">Com condição suspensiva</option>
                                <option value="com-pendencia">Com pendência</option>
                                <option value="alerta-critico">Com alerta crítico</option>
                                <option value="condicao">Condição suspensiva pendente</option>
                                <option value="financeiro">Divergência financeira</option>
                                <option value="falabr">Fala.BR pendente</option>
                                <option value="documentos">Documentação incompleta</option>
                                <option value="plano">Plano divergente</option>
                                <option value="aptas">Aptas à celebração</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section class="formalizacao-shortcut-panel mb-4" aria-label="Acesso rápido por UF">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Acesso rápido</p>
                            <h2>Detalhamento por UF</h2>
                        </div>
                        <small class="text-muted">Abra a tramitação de qualquer uma das 14 propostas com um clique</small>
                    </div>
                    <div class="formalizacao-shortcut-grid">
                        ${atalhosUf}
                    </div>
                </section>

                <section class="budget-insight-grid formalizacao-insight-grid mb-4" id="formalizacao-selected-summary" aria-label="Resumo da seleção"></section>

                <section class="formalizacao-alert-panel mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Alertas e pendências</p>
                            <h2>Providências prioritárias</h2>
                        </div>
                    </div>
                    <div class="formalizacao-alert-list" id="formalizacao-alert-list"></div>
                </section>

                <section class="formalizacao-card-grid mb-4" id="formalizacao-card-grid" aria-label="Cards por UF"></section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Propostas</p>
                            <h2>Base de acompanhamento</h2>
                        </div>
                        <small class="text-muted"><i class="fas fa-mouse-pointer me-1" aria-hidden="true"></i> Clique em uma linha para abrir a UF</small>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table formalizacao-data-table">
                            <thead>
                                <tr>
                                    <th>UF</th>
                                    <th class="text-center">Status</th>
                                    <th class="text-end">Valor Global</th>
                                    <th class="text-center">Projeto</th>
                                    <th class="text-center">Formalização</th>
                                    <th class="text-center">Plano</th>
                                    <th class="text-center">Cond. suspensiva</th>
                                    <th>Alertas</th>
                                    <th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="formalizacao-table-body"></tbody>
                        </table>
                    </div>
                </section>

                ${renderizarPainelEdicaoFormalizacao(dados)}
            `;

            registrarEventosFormalizacao(dados);
            atualizarListaFormalizacao(dados);
            aplicarModoSomenteLeitura();
        }

        function abrirDetalheFormalizacaoProfor(uf) {
            formalizacaoUfAtual = uf;
            toggleView('formalizacao-detalhe');
        }

        function renderizarCampoFormalizacao(rotulo, valor, icone = 'fa-circle-info') {
            return `
                <div class="formalizacao-info-item">
                    <span><i class="fas ${icone}" aria-hidden="true"></i>${escapeHtml(rotulo)}</span>
                    <strong>${escapeHtml(valor || '-')}</strong>
                </div>
            `;
        }

        function renderizarCadastroInstitucionalFormalizacao(proposta) {
            const cadastro = proposta.cadastroInstitucional || {};

            return `
                <section class="table-container mb-4">
                    <div class="section-header compact">
                        <p class="section-eyebrow mb-0">Cadastro</p>
                    </div>
                    <div class="formalizacao-info-grid">
                        ${renderizarCampoFormalizacao('Órgão', cadastro.orgao || proposta.gestor.orgao, 'fa-building')}
                        ${renderizarCampoFormalizacao('Sigla', cadastro.sigla, 'fa-signature')}
                        ${renderizarCampoFormalizacao('CNPJ', cadastro.cnpj, 'fa-id-card')}
                        ${renderizarCampoFormalizacao('Endereço', cadastro.endereco, 'fa-location-dot')}
                        ${renderizarCampoFormalizacao('CEP', cadastro.cep, 'fa-map-pin')}
                        ${renderizarCampoFormalizacao('Região', cadastro.regiao || obterRegiaoPorUf(proposta.uf), 'fa-map-location-dot')}
                    </div>
                </section>
            `;
        }

        function renderizarContatosInstitucionaisFormalizacao(proposta) {
            const contatos = proposta.contatosPessoas || [];

            return `
                <section class="table-container mb-4">
                    <div class="section-header compact">
                        <p class="section-eyebrow mb-0">Contatos</p>
                        ${proposta.contatosDisponiveis ? '' : '<span class="profor-alert-badge profor-alert-warning">Contatos indisponíveis</span>'}
                    </div>
                    ${contatos.length ? `
                        <div class="table-responsive">
                            <table class="table table-sm table-hover w-100 app-data-table formalizacao-contact-table">
                                <thead>
                                    <tr>
                                        <th>Papel</th>
                                        <th>Nome</th>
                                        <th>Cargo/Função</th>
                                        <th>Telefone/Contato</th>
                                        <th>E-mail</th>
                                        <th>Observações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${contatos.map((contato) => `
                                        <tr>
                                            <td data-label="Papel"><strong>${escapeHtml(contato.papel || '-')}</strong></td>
                                            <td data-label="Nome">${escapeHtml(contato.nome || '-')}</td>
                                            <td data-label="Cargo/Função">${escapeHtml(contato.cargo || '-')}</td>
                                            <td data-label="Telefone/Contato">${escapeHtml(contato.telefone || '-')}</td>
                                            <td data-label="E-mail">${escapeHtml(contato.email || '-')}</td>
                                            <td data-label="Observações">${escapeHtml(contato.observacoes || '-')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="formalizacao-empty-state">
                            <i class="fas fa-address-book" aria-hidden="true"></i>
                            <span>Nenhum contato institucional localizado para esta UF.</span>
                        </div>
                    `}
                </section>
            `;
        }

        function renderizarTrilhaFormalizacao(trilha) {
            const icones = {
                'proposta-cadastrada': 'fa-file-circle-plus',
                'docs-projeto': 'fa-folder-tree',
                'projeto-aprovado': 'fa-circle-check',
                'docs-formalizacao': 'fa-file-signature',
                'condicao-suspensiva': 'fa-landmark',
                'plano-validado': 'fa-list-check',
                'apta-celebracao': 'fa-handshake',
                'convenio-celebrado': 'fa-pen-nib',
                'instrumento-publicado': 'fa-newspaper'
            };

            return `
                <ol class="formalizacao-timeline" style="--formalizacao-steps: ${trilha.length};">
                    ${trilha.map((etapa) => `
                        <li class="formalizacao-step formalizacao-step-${etapa.estado}" ${etapa.estado === 'atual' ? 'aria-current="step"' : ''}>
                            <span class="formalizacao-step-marker" aria-hidden="true">
                                <i class="fas ${icones[etapa.chave] || 'fa-circle'}"></i>
                            </span>
                            <span class="formalizacao-step-label">${escapeHtml(etapa.rotulo)}</span>
                        </li>
                    `).join('')}
                </ol>
            `;
        }

        function renderizarStatusDocumentoFormalizacao(status) {
            const normalizado = normalizarBusca(status);
            const classe = normalizado.includes('validado')
                ? 'success'
                : normalizado.includes('reprovado') || normalizado.includes('correcao') || normalizado.includes('pendente')
                    ? 'danger'
                    : normalizado.includes('analise') || normalizado.includes('enviado')
                        ? 'warning'
                        : normalizado.includes('aplica')
                            ? 'neutral'
                            : 'default';
            return `<span class="formalizacao-doc-status formalizacao-doc-status-${classe}">${escapeHtml(status || 'Não enviado')}</span>`;
        }

        function renderizarLinkDocumentoFormalizacao(link) {
            if (!link) {
                return '<span class="text-muted">-</span>';
            }

            if (/^https?:\/\//i.test(link)) {
                return `
                    <a class="budget-link-button" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-up-right-from-square" aria-hidden="true"></i>
                        <span>Abrir</span>
                    </a>
                `;
            }

            return `<span class="formalizacao-doc-ref">${escapeHtml(link)}</span>`;
        }

        function renderizarTabelaDocumentosFormalizacao(titulo, documentos, progresso, incluirResponsavel = false) {
            return `
                <section class="table-container mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Documentos</p>
                            <h2>${escapeHtml(titulo)}</h2>
                        </div>
                        <div class="formalizacao-doc-progress">
                            <strong>${progresso.enviados} de ${progresso.total} enviados</strong>
                            ${renderizarProgressoFormalizacao(progresso.percentual)}
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table formalizacao-doc-table">
                            <thead>
                                <tr>
                                    <th>Documento</th>
                                    <th class="text-center">Enviado?</th>
                                    <th>Status</th>
                                    <th>Data envio</th>
                                    <th>Pendência</th>
                                    ${incluirResponsavel ? '<th>Unidade</th>' : ''}
                                    <th>Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${documentos.map((documento) => `
                                    <tr>
                                        <td data-label="Documento"><strong>${escapeHtml(documento.nome)}</strong></td>
                                        <td data-label="Enviado?" class="text-center">
                                            <span class="profor-alert-badge profor-alert-${documento.enviado ? 'success' : 'danger'}">${documento.enviado ? 'Sim' : 'Não'}</span>
                                        </td>
                                        <td data-label="Status">${renderizarStatusDocumentoFormalizacao(documento.statusAnalise)}</td>
                                        <td data-label="Data envio">${escapeHtml(documento.dataEnvio || '-')}</td>
                                        <td data-label="Pendência">${escapeHtml(documento.pendencia || '-')}</td>
                                        ${incluirResponsavel ? `<td data-label="Unidade">${escapeHtml(documento.unidadeResponsavel || '-')}</td>` : ''}
                                        <td data-label="Link">${renderizarLinkDocumentoFormalizacao(documento.link)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        function renderizarResumoPlanoFormalizacao(titulo, itens) {
            if (!itens.length) return '';

            return `
                <div class="formalizacao-plan-breakdown">
                    <h3>${escapeHtml(titulo)}</h3>
                    <div>
                        ${itens.map((item) => `
                            <span>
                                <strong>${escapeHtml(item.nome)}</strong>
                                ${formatMoney(item.total)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderizarCondicaoSuspensivaFormalizacao(proposta) {
            if (!proposta.condicaoSuspensiva.exige) {
                return '';
            }

            const condicao = proposta.condicaoSuspensiva;
            return `
                <section class="table-container mb-4 formalizacao-condition-panel ${condicao.resolvida ? 'formalizacao-condition-ok' : 'formalizacao-condition-risk'}">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Condição suspensiva</p>
                            <h2>Ato normativo da ouvidoria própria/autônoma</h2>
                        </div>
                        ${renderizarBadgeCondicaoSuspensivaFormalizacao(proposta)}
                    </div>
                    <div class="formalizacao-info-grid">
                        ${renderizarCampoFormalizacao('Exige condição suspensiva?', 'Sim', 'fa-landmark')}
                        ${renderizarCampoFormalizacao('Ato normativo enviado?', condicao.atoEnviado ? 'Sim' : 'Não', 'fa-file-arrow-up')}
                        ${renderizarCampoFormalizacao('Ato normativo publicado?', condicao.atoPublicado ? 'Sim' : 'Não', 'fa-newspaper')}
                        ${renderizarCampoFormalizacao('Data de publicação', condicao.dataPublicacao || '-', 'fa-calendar-day')}
                        ${renderizarCampoFormalizacao('Link ou referência', condicao.linkReferencia || '-', 'fa-link')}
                    </div>
                </section>
            `;
        }

        function renderizarPlanoAplicacaoFormalizacao(proposta) {
            const plano = proposta.plano;
            return `
                <section class="table-container mb-4">
                    <div class="section-header compact">
                        <p class="section-eyebrow mb-0">Plano de aplicação</p>
                        <span class="profor-alert-badge profor-alert-${plano.fechaComValorGlobal ? 'success' : 'danger'}">${escapeHtml(proposta.situacaoPlano)}</span>
                    </div>

                    <div class="profor-plan-summary">
                        <div class="profor-plan-summary-item"><span>Total do plano</span><strong>${formatMoney(plano.total)}</strong></div>
                        <div class="profor-plan-summary-item"><span>Valor global</span><strong>${formatMoney(proposta.valorGlobal)}</strong></div>
                        <div class="profor-plan-summary-item"><span>Diferença</span><strong class="${Math.abs(plano.diferenca) > 0.01 ? 'text-danger' : 'text-success'}">${formatMoney(plano.diferenca)}</strong></div>
                        <div class="profor-plan-summary-item"><span>Itens</span><strong>${plano.quantidadeItens}</strong></div>
                        <div class="profor-plan-summary-item"><span>Inelegíveis</span><strong class="${plano.itensInelegiveis.length ? 'text-danger' : 'text-success'}">${plano.itensInelegiveis.length}</strong></div>
                    </div>

                    <div class="formalizacao-plan-breakdowns">
                        ${renderizarResumoPlanoFormalizacao('Por categoria', plano.porCategoria)}
                        ${renderizarResumoPlanoFormalizacao('Por natureza', plano.porNatureza)}
                        ${renderizarResumoPlanoFormalizacao('Por fonte', plano.porFonte)}
                    </div>

                    <div class="table-responsive mt-3">
                        <table class="table table-sm table-hover w-100 app-data-table profor-plan-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Descrição</th>
                                    <th class="text-center">Qtd.</th>
                                    <th class="text-center">Unid.</th>
                                    <th class="text-end">Valor Unit.</th>
                                    <th class="text-end">Valor Total</th>
                                    <th>Natureza</th>
                                    <th class="text-center">Elegível</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${plano.itens.map((item) => {
                                    const inelegivel = plano.itensInelegiveis.some((alertaItem) => alertaItem.idItem === item.idItem);
                                    return `
                                        <tr class="${inelegivel ? 'table-warning' : ''}">
                                            <td data-label="Item"><strong>${escapeHtml(item.item || '-')}</strong></td>
                                            <td data-label="Descrição"><span class="truncate-text">${escapeHtml(item.descricao || '-')}</span></td>
                                            <td data-label="Qtd." class="text-center">${formatarQuantidadeProfor(item.quantidade)}</td>
                                            <td data-label="Unid." class="text-center">${escapeHtml(item.unidade || '-')}</td>
                                            <td data-label="Valor Unit." class="text-end font-monospace">${formatMoney(item.valorUnitario)}</td>
                                            <td data-label="Valor Total" class="text-end font-monospace fw-bold">${formatMoney(item.valorTotal)}</td>
                                            <td data-label="Natureza">${escapeHtml(item.naturezaDespesa || '-')}</td>
                                            <td data-label="Elegível" class="text-center">
                                                <span class="profor-alert-badge profor-alert-${inelegivel ? 'danger' : 'success'}">${escapeHtml(item.elegivel || 'Sim')}</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        function renderFormalizacaoProforDetalheView() {
            const container = document.getElementById('view-formalizacao-profor-detalhe');
            const dados = obterDadosFormalizacaoProfor();
            if (!container) return;

            const propostas = Array.isArray(dados?.propostas) ? dados.propostas : [];
            const proposta = propostas.find((item) => item.uf === formalizacaoUfAtual || item.idProposta === formalizacaoUfAtual);
            if (!dados || !proposta) {
                container.innerHTML = renderErrorState({
                    titulo: VIEW_ERROR_MESSAGES['formalizacao-detalhe'].titulo,
                    detalhe: VIEW_ERROR_MESSAGES['formalizacao-detalhe'].detalhe
                });
                container.style.display = 'block';
                aplicarModoSomenteLeitura();
                return;
            }

            const flagUrl = catalogoAplicacao.imagensBandeiras?.[proposta.uf] || '';
            const imgElement = flagUrl
                ? `<img src="${escapeHtml(flagUrl)}" alt="Bandeira ${escapeHtml(proposta.uf)}" class="state-flag report-state-flag me-3">`
                : '<i class="fas fa-flag text-secondary report-state-icon me-3"></i>';
            const alertasCriticos = proposta.alertas.filter((alerta) => alerta.severidade === 'critico');

            container.style.display = 'block';
            container.innerHTML = `
                <div class="report-actions pdf-hidden">
                    ${renderActionButton({
                        type: 'back',
                        label: 'Voltar para Formalização',
                        onClick: "toggleView('formalizacao')",
                        variant: 'outline-secondary'
                    })}
                </div>

                <div class="report-content profor-detail-content formalizacao-detail-content">
                    <section class="profor-detail-header">
                        <div class="d-flex align-items-center">
                            ${imgElement}
                            <div>
                                <p class="section-eyebrow mb-1">Formalização PROFOR/ONASP 2026</p>
                                <h2>${escapeHtml(proposta.estado)} — ${escapeHtml(proposta.uf)}</h2>
                                <div class="profor-detail-meta">
                                    <span><i class="fas fa-file-contract" aria-hidden="true"></i> Proposta ${escapeHtml(proposta.numeroProposta || '-')}</span>
                                    <span><i class="fas fa-layer-group" aria-hidden="true"></i> ${escapeHtml(proposta.grupo || '-')}</span>
                                    <span><i class="fas fa-calendar-alt" aria-hidden="true"></i> ${escapeHtml(proposta.ano || '-')}</span>
                                    <span><i class="fas fa-clock" aria-hidden="true"></i> Atualização ${escapeHtml(proposta.ultimaAtualizacao || '-')}</span>
                                </div>
                            </div>
                        </div>
                        <div class="formalizacao-detail-actions">
                            <div class="profor-alert-list">${proposta.alertas.length ? proposta.alertas.slice(0, 8).map(renderizarBadgeAlertaFormalizacao).join('') : '<span class="profor-alert-badge profor-alert-success">Sem alerta</span>'}</div>
                            ${!dadosPaginaEmModoEstatico('formalizacaoProfor') ? renderActionButton({
                                type: formalizacaoItemEmEdicao(proposta.uf) ? 'success' : 'edit',
                                label: formalizacaoItemEmEdicao(proposta.uf) ? 'Fechar edição' : 'Editar',
                                variant: formalizacaoItemEmEdicao(proposta.uf) ? 'primary' : 'outline-primary',
                                backend: true,
                                title: formalizacaoItemEmEdicao(proposta.uf)
                                    ? `Fechar edição de ${proposta.uf}`
                                    : `Editar acompanhamento de ${proposta.uf}`,
                                attributes: `data-formalizacao-toggle-editor="${escapeHtml(proposta.uf)}" aria-pressed="${formalizacaoItemEmEdicao(proposta.uf) ? 'true' : 'false'}"`
                            }) : ''}
                        </div>
                    </section>

                    ${renderizarPainelEdicaoFormalizacaoUf(proposta, 1)}

                    <section class="row my-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Indicadores da proposta">
                        ${renderizarKpiDetalheProfor('Valor de Repasse', formatMoney(proposta.valorRepasse), 'Regra PROFOR/ONASP', proposta.validacoes.valorRepasseOk ? '' : 'kpi-card-warning', 'fa-building-columns')}
                        ${renderizarKpiDetalheProfor('Contrapartida', formatMoney(proposta.valorContrapartida), formatPercent(proposta.percentualContrapartida), '', 'fa-handshake')}
                        ${renderizarKpiDetalheProfor('Valor Global', formatMoney(proposta.valorGlobal), 'Repasse + contrapartida', proposta.validacoes.valorGlobalOk ? '' : 'kpi-card-warning', 'fa-scale-balanced')}
                        ${renderizarKpiDetalheProfor('Progresso Geral', formatPercent(proposta.progressoGeral), 'Cálculo ponderado', 'kpi-card-info', 'fa-chart-line')}
                        ${renderizarKpiDetalheProfor('Docs do Projeto', `${proposta.progressoDocumentosProjeto.enviados}/${proposta.progressoDocumentosProjeto.total}`, formatPercent(proposta.progressoDocumentosProjeto.percentual), proposta.progressoDocumentosProjeto.completo ? 'kpi-card-success' : 'kpi-card-warning', 'fa-folder-tree')}
                        ${renderizarKpiDetalheProfor('Docs Formalização', `${proposta.progressoDocumentosFormalizacao.enviados}/${proposta.progressoDocumentosFormalizacao.total}`, formatPercent(proposta.progressoDocumentosFormalizacao.percentual), proposta.progressoDocumentosFormalizacao.completo ? 'kpi-card-success' : 'kpi-card-warning', 'fa-file-signature')}
                        ${renderizarKpiDetalheProfor('Total do Plano', formatMoney(proposta.plano.total), proposta.situacaoPlano, proposta.plano.fechaComValorGlobal ? 'kpi-card-success' : 'kpi-card-warning', 'fa-list-check')}
                        ${renderizarKpiDetalheProfor('Alertas Críticos', String(alertasCriticos.length), proposta.aptaCelebracao ? 'Apta à celebração' : 'Verificar pendências', alertasCriticos.length ? 'kpi-card-warning' : 'kpi-card-success', 'fa-triangle-exclamation')}
                    </section>

                    <section class="table-container mb-4">
                        <div class="section-header compact">
                            <div>
                                <p class="section-eyebrow mb-1">Trilha</p>
                                <h2>Andamento da formalização</h2>
                            </div>
                            ${renderizarStatusFormalizacao(proposta)}
                        </div>
                        ${renderizarTrilhaFormalizacao(proposta.trilha)}
                    </section>

                    ${renderizarTabelaDocumentosFormalizacao('Documentos do projeto', proposta.documentosProjeto, proposta.progressoDocumentosProjeto)}
                    ${renderizarTabelaDocumentosFormalizacao('Documentos da formalização', proposta.documentosFormalizacao, proposta.progressoDocumentosFormalizacao, true)}
                    ${renderizarCondicaoSuspensivaFormalizacao(proposta)}
                    ${renderizarPlanoAplicacaoFormalizacao(proposta)}

                    <section class="formalizacao-alert-panel mb-0">
                        <div class="section-header compact">
                            <div>
                                <p class="section-eyebrow mb-1">Observações e pendências</p>
                                <h2>Alertas da UF</h2>
                            </div>
                        </div>
                        <div class="formalizacao-detail-alerts">
                            ${proposta.alertas.length ? proposta.alertas.map((alerta) => `
                                <div class="formalizacao-detail-alert formalizacao-detail-alert-${obterClasseAlertaFormalizacao(alerta.severidade)}">
                                    ${renderizarBadgeAlertaFormalizacao(alerta)}
                                    <span>${escapeHtml(alerta.mensagem)}</span>
                                </div>
                            `).join('') : '<div class="formalizacao-empty-state"><i class="fas fa-circle-check" aria-hidden="true"></i><span>Nenhum alerta calculado para esta UF.</span></div>'}
                        </div>
                        ${obterObservacaoFormalizacaoVisivel(proposta.observacoes) ? `<p class="formalizacao-observation">${escapeHtml(obterObservacaoFormalizacaoVisivel(proposta.observacoes))}</p>` : ''}
                    </section>

                    ${renderizarCadastroInstitucionalFormalizacao(proposta)}
                    ${renderizarContatosInstitucionaisFormalizacao(proposta)}
                </div>
            `;
            registrarEventosBotoesEdicaoFormalizacao(dados);
            registrarEventosCamposEdicaoFormalizacao();
            aplicarModoSomenteLeitura();
        }

        // --- MÓDULO DE ORÇAMENTO 2026 ---
        // Contrato visual do fluxo padrão. Cada etapa aponta para propriedades
        // preenchidas pelo data-service a partir das abas de andamento.
        const ETAPAS_RASTREIO_ORCAMENTO = [
            { chave: 'planejamento', rotulo: 'Planejamento', icone: 'fa-clipboard-list' },
            { chave: 'processo-sei', rotulo: 'Processo SEI autuado', icone: 'fa-folder-open', valorCampo: 'processoSei', linkCampo: 'linkProcessoSei', dataCampo: 'dataProcessoSei' },
            { chave: 'estudo-tecnico', rotulo: 'ETP/Especificação concluída', icone: 'fa-magnifying-glass-chart', valorCampo: 'estudoTecnico', linkCampo: 'linkEstudoTecnico', dataCampo: 'dataEstudoTecnico' },
            { chave: 'termo-referencia', rotulo: 'Termo de Referência elaborado', icone: 'fa-file-lines', valorCampo: 'termoReferencia', linkCampo: 'linkTermoReferencia', dataCampo: 'dataTermoReferencia' },
            { chave: 'pesquisa-precos', rotulo: 'Pesquisa de preços concluída', icone: 'fa-tags', valorCampo: 'pesquisaPrecos', linkCampo: 'linkPesquisaPrecos', dataCampo: 'dataPesquisaPrecos' },
            { chave: 'autorizacao-autoridade', rotulo: 'Autorização da autoridade competente', icone: 'fa-user-check', valorCampo: 'autorizacaoAutoridade', linkCampo: 'linkAutorizacaoAutoridade', dataCampo: 'dataAutorizacaoAutoridade' },
            { chave: 'parecer-juridico', rotulo: 'Parecer jurídico', icone: 'fa-gavel', valorCampo: 'parecerJuridico', linkCampo: 'linkParecerJuridico', dataCampo: 'dataParecerJuridico' },
            { chave: 'empenhado', rotulo: 'Empenhado', icone: 'fa-file-invoice-dollar', valorCampo: 'empenho', linkCampo: 'linkEmpenho', dataCampo: 'dataEmpenho' },
            { chave: 'contratado', rotulo: 'Contratado', icone: 'fa-file-signature', valorCampo: 'contrato', linkCampo: 'linkContrato', dataCampo: 'dataContratacao' },
            { chave: 'ordem-servico', rotulo: 'Ordem de Serviço Emitida', icone: 'fa-clipboard-check', valorCampo: 'ordemServico', linkCampo: 'linkOrdemServico', dataCampo: 'dataOrdemServico' },
            { chave: 'entregue', rotulo: 'Entregue', icone: 'fa-box-open', dataCampo: 'dataEntrega' },
            { chave: 'ordem-bancaria', rotulo: 'Ordem Bancária realizada', icone: 'fa-money-check-alt', valorCampo: 'ordemBancaria', linkCampo: 'linkOrdemBancaria', dataCampo: 'dataOrdemBancaria' }
        ];

        // Fluxo especial do PROFOR/convênios. Ele tem etapas próprias e não deve
        // ser misturado ao fluxo normal de contratação.
        const ETAPAS_RASTREIO_PROFOR = [
            { chave: 'autuacao', rotulo: 'Autuação', icone: 'fa-folder-open', valorCampos: ['proforAutuacao', 'processoSei'], linkCampos: ['linkProforAutuacao', 'linkProcessoSei'], dataCampos: ['dataProforAutuacao', 'dataProcessoSei'] },
            { chave: 'parecer-tecnico', rotulo: 'Parecer técnico', icone: 'fa-file-circle-check', valorCampo: 'proforParecerTecnico', linkCampo: 'linkProforParecerTecnico', dataCampo: 'dataProforParecerTecnico' },
            { chave: 'minuta-edital', rotulo: 'Minuta de edital', icone: 'fa-file-lines', valorCampo: 'proforMinutaEdital', linkCampo: 'linkProforMinutaEdital', dataCampo: 'dataProforMinutaEdital' },
            { chave: 'ddo-cgof', rotulo: 'DDO (CGOF)', icone: 'fa-coins', valorCampo: 'proforDdoCgof', linkCampo: 'linkProforDdoCgof', dataCampo: 'dataProforDdoCgof' },
            { chave: 'abertura-programa', rotulo: 'Abertura de programa (CGGIR)', icone: 'fa-bullhorn', valorCampo: 'proforAberturaPrograma', linkCampo: 'linkProforAberturaPrograma', dataCampo: 'dataProforAberturaPrograma' },
            { chave: 'parecer-conjur', rotulo: 'Parecer jurídico (CONJUR)', icone: 'fa-gavel', valorCampo: 'proforParecerConjur', linkCampo: 'linkProforParecerConjur', dataCampo: 'dataProforParecerConjur' },
            { chave: 'publicacao-gabsec', rotulo: 'Publicação (GABSEC)', icone: 'fa-newspaper', valorCampo: 'proforPublicacaoGabsec', linkCampo: 'linkProforPublicacaoGabsec', dataCampo: 'dataProforPublicacaoGabsec' }
        ];

        const CAMPOS_EDICAO_RASTREIO_PROCESSO = [
            { campo: 'processo_sei', rotulo: 'Processo SEI' },
            { campo: 'link_processo_sei', rotulo: 'Link do Processo SEI' },
            { campo: 'data_processo_sei', rotulo: 'Data do Processo SEI' },
            { campo: 'demanda_formalizada', rotulo: 'Demanda formalizada' },
            { campo: 'link_demanda_formalizada', rotulo: 'Link da demanda formalizada' },
            { campo: 'data_demanda_formalizada', rotulo: 'Data da demanda formalizada' },
            { campo: 'estudo_tecnico', rotulo: 'Estudo técnico' },
            { campo: 'link_estudo_tecnico', rotulo: 'Link do estudo técnico' },
            { campo: 'data_estudo_tecnico', rotulo: 'Data do estudo técnico' },
            { campo: 'termo_referencia', rotulo: 'Termo de Referência' },
            { campo: 'link_termo_referencia', rotulo: 'Link do Termo de Referência' },
            { campo: 'data_termo_referencia', rotulo: 'Data do Termo de Referência' },
            { campo: 'pesquisa_precos', rotulo: 'Pesquisa de preços' },
            { campo: 'link_pesquisa_precos', rotulo: 'Link da pesquisa de preços' },
            { campo: 'data_pesquisa_precos', rotulo: 'Data da pesquisa de preços' },
            { campo: 'autorizacao_autoridade', rotulo: 'Autorização da autoridade' },
            { campo: 'link_autorizacao_autoridade', rotulo: 'Link da autorização da autoridade' },
            { campo: 'data_autorizacao_autoridade', rotulo: 'Data da autorização da autoridade' },
            { campo: 'parecer_juridico', rotulo: 'Parecer jurídico' },
            { campo: 'link_parecer_juridico', rotulo: 'Link do parecer jurídico' },
            { campo: 'data_parecer_juridico', rotulo: 'Data do parecer jurídico' },
            { campo: 'empenho', rotulo: 'Empenho' },
            { campo: 'link_empenho', rotulo: 'Link do empenho' },
            { campo: 'data_empenho', rotulo: 'Data do empenho' },
            { campo: 'contrato', rotulo: 'Contrato' },
            { campo: 'link_contrato', rotulo: 'Link do contrato' },
            { campo: 'data_contratacao', rotulo: 'Data da contratação' },
            { campo: 'ordem_servico', rotulo: 'Ordem de Serviço' },
            { campo: 'link_ordem_servico', rotulo: 'Link da Ordem de Serviço' },
            { campo: 'data_ordem_servico', rotulo: 'Data da Ordem de Serviço' },
            { campo: 'data_entrega', rotulo: 'Data da entrega' },
            { campo: 'ordem_bancaria', rotulo: 'Ordem bancária' },
            { campo: 'link_ordem_bancaria', rotulo: 'Link da ordem bancária' },
            { campo: 'data_ordem_bancaria', rotulo: 'Data da ordem bancária' }
        ];

        const CAMPOS_EDICAO_RASTREIO_PROFOR = [
            { campo: 'profor_autuacao', rotulo: 'Autuação PROFOR' },
            { campo: 'link_profor_autuacao', rotulo: 'Link da autuação PROFOR' },
            { campo: 'data_profor_autuacao', rotulo: 'Data da autuação PROFOR' },
            { campo: 'profor_parecer_tecnico', rotulo: 'Parecer técnico PROFOR' },
            { campo: 'link_profor_parecer_tecnico', rotulo: 'Link do parecer técnico PROFOR' },
            { campo: 'data_profor_parecer_tecnico', rotulo: 'Data do parecer técnico PROFOR' },
            { campo: 'profor_minuta_edital', rotulo: 'Minuta de edital PROFOR' },
            { campo: 'link_profor_minuta_edital', rotulo: 'Link da minuta de edital PROFOR' },
            { campo: 'data_profor_minuta_edital', rotulo: 'Data da minuta de edital PROFOR' },
            { campo: 'profor_ddo_cgof', rotulo: 'DDO (CGOF) PROFOR' },
            { campo: 'link_profor_ddo_cgof', rotulo: 'Link do DDO (CGOF) PROFOR' },
            { campo: 'data_profor_ddo_cgof', rotulo: 'Data do DDO (CGOF) PROFOR' },
            { campo: 'profor_abertura_programa', rotulo: 'Abertura de programa PROFOR' },
            { campo: 'link_profor_abertura_programa', rotulo: 'Link da abertura de programa PROFOR' },
            { campo: 'data_profor_abertura_programa', rotulo: 'Data da abertura de programa PROFOR' },
            { campo: 'profor_parecer_conjur', rotulo: 'Parecer jurídico PROFOR' },
            { campo: 'link_profor_parecer_conjur', rotulo: 'Link do parecer jurídico PROFOR' },
            { campo: 'data_profor_parecer_conjur', rotulo: 'Data do parecer jurídico PROFOR' },
            { campo: 'profor_publicacao_gabsec', rotulo: 'Publicação GABSEC PROFOR' },
            { campo: 'link_profor_publicacao_gabsec', rotulo: 'Link da publicação GABSEC PROFOR' },
            { campo: 'data_profor_publicacao_gabsec', rotulo: 'Data da publicação GABSEC PROFOR' }
        ];

        function obterTotalResumoOrcamento(resumos, nome) {
            const chave = normalizarBusca(nome);
            return resumos?.find((item) => normalizarBusca(item.nome) === chave)?.total || 0;
        }

        function renderizarOpcoesFiltroOrcamento(opcoes) {
            return opcoes.map((valor) => (
                `<option value="${escapeHtml(valor)}">${escapeHtml(valor)}</option>`
            )).join('');
        }

        function calcularResumoItensOrcamento(itens) {
            return itens.reduce((resumo, item) => {
                const valorTotal = Number(item.valorPrevisto ?? item.valorTotal) || 0;
                const valorEstimado = Number(item.valorEstimadoPesquisaPreco) || 0;
                resumo.total += valorTotal;
                resumo.quantidade += 1;
                resumo.frentes.add(item.frente);
                resumo.modalidades.add(item.modalidade);
                resumo.status[item.status] = (resumo.status[item.status] || 0) + valorTotal;
                resumo.emExecucao += valorEstimado;
                resumo.empenhado += Number(item.valorEmpenhado) || 0;
                resumo.executado += Number(item.valorExecutado) || 0;
                return resumo;
            }, {
                total: 0,
                quantidade: 0,
                emExecucao: 0,
                empenhado: 0,
                executado: 0,
                frentes: new Set(),
                modalidades: new Set(),
                status: {}
            });
        }

        function normalizarClassificacaoGerencialOrcamento(valor) {
            const texto = normalizarBusca(valor).replace(/\s+/g, '_');
            if (['aparelhamento', 'sim', 's', '1', 'true'].includes(texto)) return 'APARELHAMENTO';
            return 'NAO_APARELHAMENTO';
        }

        function itemEhAparelhamentoOrcamento(item) {
            return normalizarClassificacaoGerencialOrcamento(item?.classificacaoGerencial) === 'APARELHAMENTO'
                || item?.ehAparelhamento === true;
        }

        function calcularResumoAparelhamentoFrontend(itens) {
            const itensAparelhamento = itens.filter((item) => (
                itemEhAparelhamentoOrcamento(item)
                && item.compoeOrcamento !== false
                && item.ativo !== false
            ));
            const previstoAparelhamento = itensAparelhamento.reduce((total, item) => total + (Number(item.valorPrevisto) || 0), 0);
            const emExecucaoAparelhamento = itensAparelhamento.reduce((total, item) => total + (Number(item.valorEmExecucaoConsiderado ?? item.valorEstimadoPesquisaPreco) || 0), 0);
            const pendentesPesquisaPreco = itensAparelhamento.filter((item) => {
                const status = normalizarBusca(item.status);
                return normalizarBooleanOrcamento(item.processoAutuado)
                    && (Number(item.valorEstimadoPesquisaPreco) || 0) <= 0
                    && !status.includes('cancelado')
                    && !status.includes('suspenso');
            });

            return {
                previstoAparelhamento,
                emExecucaoAparelhamento,
                saldoAparelhamento: previstoAparelhamento - emExecucaoAparelhamento,
                quantidadeItensAparelhamento: itensAparelhamento.length,
                quantidadePendentesPesquisaPreco: pendentesPesquisaPreco.length
            };
        }

        function itemUsaRastreioProfor(item) {
            const tipoRastreio = normalizarBusca(item.tipoRastreio);
            return tipoRastreio.includes('profor')
                || tipoRastreio.includes('convenio')
                || normalizarBusca(item.id) === 'conv-001'
                || normalizarBusca(item.descricao).includes('profor')
                || normalizarBusca(item.descricao).includes('programa de aparelhamento');
        }

        // Alguns itens são acompanhados só como planejamento financeiro, sem
        // trilha processual individual na interface.
        function itemSemRastreioOrcamento(item) {
            const descricao = normalizarBusca(item.descricao);
            const id = normalizarBusca(item.id);
            return id === 'pess-001'
                || id === 'curs-001'
                || descricao === 'diarias'
                || descricao.includes('inscricoes em cursos para servidores');
        }

        function itemPodeExibirRastreioOrcamento(item) {
            return !itemSemRastreioOrcamento(item);
        }

        function filtrarItensOrcamento(budgetData) {
            const busca = normalizarBusca(document.getElementById('filtroOrcamentoBusca')?.value || '');
            const status = document.getElementById('filtroOrcamentoStatus')?.value || '';
            const natureza = document.getElementById('filtroOrcamentoNatureza')?.value || '';
            const modalidade = document.getElementById('filtroOrcamentoModalidade')?.value || '';

            return budgetData.itens.filter((item) => {
                const textoBusca = normalizarBusca([
                    item.id,
                    item.frente,
                    item.descricao,
                    item.natureza,
                    item.modalidade,
                    item.abrangencia,
                    item.status,
                    item.processoSei,
                    item.valorEstimadoPesquisaPreco,
                    item.classificacaoGerencial,
                    item.ehAparelhamento ? 'Aparelhamento' : 'Não aparelhamento',
                    item.observacao,
                    item.proforAutuacao,
                    item.proforParecerTecnico,
                    item.proforMinutaEdital,
                    item.proforDdoCgof,
                    item.proforAberturaPrograma,
                    item.proforParecerConjur,
                    item.proforPublicacaoGabsec,
                    item.demandaFormalizada,
                    item.estudoTecnico,
                    item.termoReferencia,
                    item.pesquisaPrecos,
                    item.autorizacaoAutoridade,
                    item.parecerJuridico,
                    item.empenho,
                    item.contrato,
                    item.ordemServico,
                    item.ordemBancaria
                ].join(' '));

                return (!busca || textoBusca.includes(busca))
                    && (!status || item.status === status)
                    && (!natureza || item.natureza === natureza)
                    && (!modalidade || item.modalidade === modalidade);
            });
        }

        // Mantém a tabela organizada por frente. "Pessoal" vai ao final para
        // separar despesas administrativas das entregas finalísticas.
        function agruparItensOrcamentoPorFrente(itens) {
            const grupos = itens.reduce((mapa, item) => {
                const frente = item.frente || 'Não informado';
                if (!mapa.has(frente)) {
                    mapa.set(frente, []);
                }
                mapa.get(frente).push(item);
                return mapa;
            }, new Map());

            return Array.from(grupos.entries())
                .map(([frente, itensGrupo]) => ({
                    frente,
                    itens: itensGrupo,
                    resumo: calcularResumoItensOrcamento(itensGrupo)
                }))
                .sort((a, b) => {
                    const aPessoal = normalizarBusca(a.frente) === 'pessoal';
                    const bPessoal = normalizarBusca(b.frente) === 'pessoal';
                    if (aPessoal !== bPessoal) return aPessoal ? 1 : -1;
                    return b.resumo.total - a.resumo.total || a.frente.localeCompare(b.frente, 'pt-BR');
                });
        }

        function renderizarStatusOrcamento(status) {
            const statusNormalizado = normalizarBusca(status);
            const classe = statusNormalizado.includes('execucao')
                ? 'budget-status-running'
                : statusNormalizado.includes('planejado')
                    ? 'budget-status-planned'
                    : 'budget-status-default';
            return `<span class="budget-status ${classe}">${escapeHtml(status || 'Não informado')}</span>`;
        }

        function renderClassificacaoOrcamentoBadge(item) {
            if (normalizarClassificacaoGerencialOrcamento(item?.classificacaoGerencial) === 'APARELHAMENTO') {
                return `
                    <span class="app-status-badge app-status-badge-success budget-classification-badge">
                        <i class="fas fa-boxes-stacked" aria-hidden="true"></i>
                        <span>Aparelhamento</span>
                    </span>
                `;
            }

            return `
                <span class="app-status-badge app-status-badge-secondary budget-classification-badge">
                    <i class="fas fa-ban" aria-hidden="true"></i>
                    <span>Não aparelhamento</span>
                </span>
            `;
        }

        function renderizarClassificacaoGerencialOrcamento(classificacao, saldoAparelhamento = 0) {
            const ehAparelhamento = normalizarClassificacaoGerencialOrcamento(classificacao) === 'APARELHAMENTO';
            return `
                <div class="budget-classification-cell">
                    ${renderClassificacaoOrcamentoBadge({ classificacaoGerencial: classificacao })}
                    ${ehAparelhamento ? `<span class="budget-classification-balance">Saldo: ${formatMoney(saldoAparelhamento)}</span>` : ''}
                </div>
            `;
        }

        function renderizarLinksOrcamento(item) {
            const links = [
                {
                    url: item.linkProcessoSei,
                    rotulo: 'SEI',
                    titulo: item.processoSei || 'Processo SEI',
                    icone: 'fa-folder-open'
                }
            ].filter((link) => link.url && link.url !== '-');

            if (!links.length) {
                return item.processoSei
                    ? `<span class="budget-tracking-ref budget-sei-fallback" title="${escapeHtml(item.processoSei)}">SEI</span>`
                    : '';
            }

            return `
                <div class="budget-link-list budget-action-buttons">
                    ${links.map((link) => `
                        <a class="budget-link-button btn btn-outline-primary budget-row-action"
                           href="${escapeHtml(link.url)}"
                           target="_blank"
                           rel="noopener noreferrer"
                           title="${escapeHtml(link.titulo)}">
                            <i class="fas ${link.icone}" aria-hidden="true"></i>
                        </a>
                    `).join('')}
                </div>
            `;
        }

        function possuiValorOrcamento(valor) {
            const texto = normalizarBusca(valor);
            return Boolean(texto && texto !== '-' && texto !== 'nao informado' && texto !== 'n/a');
        }

        function statusOrcamentoContem(item, termos) {
            const status = normalizarBusca(item.status);
            return termos.some((termo) => status.includes(normalizarBusca(termo)));
        }

        function statusOrcamentoTemToken(item, token) {
            return normalizarBusca(item.status).split(/[^a-z0-9]+/).includes(normalizarBusca(token));
        }

        function obterIndiceEtapaRastreioPorChave(chave, etapas = ETAPAS_RASTREIO_ORCAMENTO) {
            const indice = etapas.findIndex((etapa) => etapa.chave === chave);
            return indice >= 0 ? indice : 0;
        }

        function obterPrimeiroValorRastreio(item, campo, campos = []) {
            const camposParaTestar = [...(campo ? [campo] : []), ...campos];
            const campoEncontrado = camposParaTestar.find((nomeCampo) => possuiValorOrcamento(item[nomeCampo]));
            return campoEncontrado ? item[campoEncontrado] : '';
        }

        // A etapa atual é a etapa mais avançada com alguma evidência preenchida:
        // documento, link, data ou status compatível.
        function obterIndiceEtapaAtualProfor(item) {
            if (
                possuiValorOrcamento(item.proforPublicacaoGabsec)
                || possuiValorOrcamento(item.linkProforPublicacaoGabsec)
                || statusOrcamentoContem(item, ['publicacao', 'publicado', 'gabsec'])
            ) return obterIndiceEtapaRastreioPorChave('publicacao-gabsec', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforParecerConjur)
                || possuiValorOrcamento(item.linkProforParecerConjur)
                || statusOrcamentoContem(item, ['parecer juridico', 'conjur'])
            ) return obterIndiceEtapaRastreioPorChave('parecer-conjur', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforAberturaPrograma)
                || possuiValorOrcamento(item.linkProforAberturaPrograma)
                || statusOrcamentoContem(item, ['abertura de programa', 'abertura programa', 'cggir'])
            ) return obterIndiceEtapaRastreioPorChave('abertura-programa', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforDdoCgof)
                || possuiValorOrcamento(item.linkProforDdoCgof)
                || statusOrcamentoContem(item, ['ddo', 'cgof'])
            ) return obterIndiceEtapaRastreioPorChave('ddo-cgof', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforMinutaEdital)
                || possuiValorOrcamento(item.linkProforMinutaEdital)
                || statusOrcamentoContem(item, ['minuta de edital', 'minuta edital', 'edital'])
            ) return obterIndiceEtapaRastreioPorChave('minuta-edital', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforParecerTecnico)
                || possuiValorOrcamento(item.linkProforParecerTecnico)
                || statusOrcamentoContem(item, ['parecer tecnico'])
            ) return obterIndiceEtapaRastreioPorChave('parecer-tecnico', ETAPAS_RASTREIO_PROFOR);

            if (
                possuiValorOrcamento(item.proforAutuacao)
                || possuiValorOrcamento(item.linkProforAutuacao)
                || possuiValorOrcamento(item.processoSei)
                || possuiValorOrcamento(item.linkProcessoSei)
                || statusOrcamentoContem(item, ['autuacao', 'autuado', 'processo sei', 'sei autuado'])
            ) return obterIndiceEtapaRastreioPorChave('autuacao', ETAPAS_RASTREIO_PROFOR);

            return 0;
        }

        function obterIndiceEtapaAtualOrcamento(item) {
            if (
                possuiValorOrcamento(item.ordemBancaria)
                || possuiValorOrcamento(item.linkOrdemBancaria)
                || statusOrcamentoContem(item, ['ordem bancaria', 'pago', 'pagamento'])
                || statusOrcamentoTemToken(item, 'ob')
            ) return obterIndiceEtapaRastreioPorChave('ordem-bancaria');

            if (
                possuiValorOrcamento(item.dataEntrega)
                || statusOrcamentoContem(item, ['entregue', 'entrega'])
            ) return obterIndiceEtapaRastreioPorChave('entregue');

            if (
                possuiValorOrcamento(item.ordemServico)
                || possuiValorOrcamento(item.linkOrdemServico)
                || statusOrcamentoContem(item, ['ordem de servico', 'ordem servico', 'os emitida'])
                || statusOrcamentoTemToken(item, 'os')
            ) return obterIndiceEtapaRastreioPorChave('ordem-servico');

            if (
                possuiValorOrcamento(item.contrato)
                || possuiValorOrcamento(item.linkContrato)
                || statusOrcamentoContem(item, ['contratado', 'contratacao', 'contrato'])
            ) return obterIndiceEtapaRastreioPorChave('contratado');

            if (
                possuiValorOrcamento(item.empenho)
                || possuiValorOrcamento(item.linkEmpenho)
                || statusOrcamentoContem(item, ['empenhado', 'empenho'])
            ) return obterIndiceEtapaRastreioPorChave('empenhado');

            if (
                possuiValorOrcamento(item.parecerJuridico)
                || possuiValorOrcamento(item.linkParecerJuridico)
                || statusOrcamentoContem(item, ['parecer'])
            ) return obterIndiceEtapaRastreioPorChave('parecer-juridico');

            if (
                possuiValorOrcamento(item.autorizacaoAutoridade)
                || possuiValorOrcamento(item.linkAutorizacaoAutoridade)
                || statusOrcamentoContem(item, ['autorizado', 'autorizacao', 'aprovado', 'aprovacao', 'autoridade competente', 'gestor'])
            ) return obterIndiceEtapaRastreioPorChave('autorizacao-autoridade');

            if (
                possuiValorOrcamento(item.pesquisaPrecos)
                || possuiValorOrcamento(item.linkPesquisaPrecos)
                || statusOrcamentoContem(item, ['pesquisa de preco', 'pesquisa preco', 'mapa de preco', 'orcamento estimado', 'cotacao'])
            ) return obterIndiceEtapaRastreioPorChave('pesquisa-precos');

            if (
                possuiValorOrcamento(item.termoReferencia)
                || possuiValorOrcamento(item.linkTermoReferencia)
                || statusOrcamentoContem(item, ['termo de referencia'])
                || statusOrcamentoTemToken(item, 'tr')
            ) return obterIndiceEtapaRastreioPorChave('termo-referencia');

            if (
                possuiValorOrcamento(item.estudoTecnico)
                || possuiValorOrcamento(item.linkEstudoTecnico)
                || statusOrcamentoContem(item, ['estudo tecnico', 'especificacao'])
                || statusOrcamentoTemToken(item, 'etp')
            ) return obterIndiceEtapaRastreioPorChave('estudo-tecnico');

            if (
                possuiValorOrcamento(item.processoSei)
                || possuiValorOrcamento(item.linkProcessoSei)
                || statusOrcamentoContem(item, ['processo sei', 'sei autuado'])
            ) return obterIndiceEtapaRastreioPorChave('processo-sei');

            return 0;
        }

        function obterIndiceEtapaAtualDoItemOrcamento(item) {
            return itemUsaRastreioProfor(item)
                ? obterIndiceEtapaAtualProfor(item)
                : obterIndiceEtapaAtualOrcamento(item);
        }

        function obterEtapasRastreioOrcamento(item) {
            const etapasBase = itemUsaRastreioProfor(item) ? ETAPAS_RASTREIO_PROFOR : ETAPAS_RASTREIO_ORCAMENTO;
            const etapaAtual = obterIndiceEtapaAtualDoItemOrcamento(item);
            return etapasBase.map((etapa, indice) => ({
                ...etapa,
                estado: indice < etapaAtual ? 'concluida' : indice === etapaAtual ? 'atual' : 'pendente',
                data: obterPrimeiroValorRastreio(item, etapa.dataCampo, etapa.dataCampos),
                valor: obterPrimeiroValorRastreio(item, etapa.valorCampo, etapa.valorCampos),
                link: obterPrimeiroValorRastreio(item, etapa.linkCampo, etapa.linkCampos)
            }));
        }

        function obterIdRastreioOrcamento(item) {
            const idSeguro = String(item.id || item.descricao || 'item')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '') || 'item';
            return `budget-tracking-${idSeguro}`;
        }

        function renderizarMetaEtapaRastreio(etapa) {
            const meta = [];

            if (possuiValorOrcamento(etapa.data)) {
                meta.push(`<span class="budget-tracking-date">${escapeHtml(etapa.data)}</span>`);
            }

            if (possuiValorOrcamento(etapa.link)) {
                const textoLink = possuiValorOrcamento(etapa.valor) ? etapa.valor : 'Abrir registro';
                meta.push(`
                    <a class="budget-tracking-link" href="${escapeHtml(etapa.link)}" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(textoLink)}
                    </a>
                `);
            } else if (possuiValorOrcamento(etapa.valor)) {
                meta.push(`<span class="budget-tracking-ref">${escapeHtml(etapa.valor)}</span>`);
            }

            return meta.join('');
        }

        // Renderiza uma linha extra abaixo do item da tabela. Essa linha só entra
        // no DOM quando o item está expandido, permitindo múltiplas trilhas.
        function renderizarRastreioOrcamento(item) {
            const etapas = obterEtapasRastreioOrcamento(item);
            const etapaAtual = etapas.find((etapa) => etapa.estado === 'atual') || etapas[0];
            const idRastreio = obterIdRastreioOrcamento(item);

            return `
                <tr class="budget-tracking-row pdf-hidden" id="${escapeHtml(idRastreio)}">
                    <td colspan="11" class="budget-tracking-cell">
                        <div class="budget-tracking-panel" aria-label="Rastreio processual de ${escapeHtml(item.descricao)}">
                            <div class="budget-tracking-header">
                                <div class="budget-tracking-header-copy">
                                    <span class="budget-tracking-eyebrow">Andamento processual</span>
                                    <strong>${escapeHtml(etapaAtual.rotulo)}</strong>
                                </div>
                                <div class="budget-tracking-header-right">
                                    <div class="budget-tracking-status">
                                        <span>Status informado</span>
                                        <strong>${escapeHtml(item.status || 'Não informado')}</strong>
                                    </div>
                                </div>
                            </div>
                            <ol class="budget-tracking-timeline" style="--budget-tracking-steps: ${etapas.length};">
                                ${etapas.map((etapa) => `
                                    <li class="budget-tracking-step budget-tracking-step-${etapa.estado}" ${etapa.estado === 'atual' ? 'aria-current="step"' : ''}>
                                        <span class="budget-tracking-marker" aria-hidden="true">
                                            <i class="fas ${etapa.icone}"></i>
                                        </span>
                                        <span class="budget-tracking-copy">
                                            <span class="budget-tracking-label">${escapeHtml(etapa.rotulo)}</span>
                                            ${renderizarMetaEtapaRastreio(etapa)}
                                        </span>
                                    </li>
                                `).join('')}
                            </ol>
                        </div>
                    </td>
                </tr>
            `;
        }

        function registrarEventosRastreioOrcamento(tbody, budgetData) {
            tbody.querySelectorAll('.budget-tracking-toggle').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const itemId = botao.dataset.budgetItemId;
                    if (orcamentoItensRastreioAbertos.has(itemId)) {
                        orcamentoItensRastreioAbertos.delete(itemId);
                    } else {
                        orcamentoItensRastreioAbertos.add(itemId);
                    }
                    atualizarTabelaOrcamento(budgetData);
                });
            });
        }

        function orcamentoItemEmEdicao(itemId) {
            return orcamentoEditoresAbertos.has(String(itemId));
        }

        function normalizarBooleanOrcamento(valor) {
            if (valor === true || valor === 1) return true;
            const texto = String(valor ?? '').trim().toLowerCase();
            return ['1', 'true', 'sim', 's'].includes(texto);
        }

        function renderizarBotaoEdicaoOrcamento(itemId, opcoes = {}) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) return '';

            const id = String(itemId);
            const ativo = orcamentoItemEmEdicao(id);
            const labelEditar = opcoes.labelEditar || 'Editar';
            const labelFechar = opcoes.labelFechar || 'Fechar edição';
            const titleEditar = opcoes.titleEditar || 'Editar este item';
            const titleFechar = opcoes.titleFechar || 'Fechar edição deste item';
            const extraClass = ['budget-row-action', opcoes.extraClass || ''].filter(Boolean).join(' ');
            return renderActionButton({
                type: ativo ? 'success' : 'edit',
                label: ativo ? labelFechar : labelEditar,
                variant: ativo ? 'primary' : 'outline-primary',
                backend: true,
                iconOnly: opcoes.iconOnly ?? true,
                title: ativo ? titleFechar : titleEditar,
                extraClass,
                attributes: `data-orcamento-toggle-editor="${escapeHtml(id)}" aria-pressed="${ativo ? 'true' : 'false'}"`
            });
        }

        function itemEhProcessoVinculadoOrcamento(item) {
            return normalizarBusca(item?.tipoProcesso) === 'vinculado';
        }

        function itemPodeDividirRecursoOrcamento(item) {
            return Boolean(item)
                && item.ativo !== false
                && item.compoeOrcamento !== false
                && !itemEhProcessoVinculadoOrcamento(item);
        }

        function obterTodosItensOrcamentoParaDivisao(budgetData) {
            return [
                ...(budgetData?.itens || []),
                ...(budgetData?.outrosProcessos || [])
            ];
        }

        // Contexto de renderização evita varreduras repetidas de itens e movimentações em cada linha.
        function prepararContextoRenderizacaoOrcamento(budgetData, movimentacoes = orcamentoMovimentacoes) {
            const itens = obterTodosItensOrcamentoParaDivisao(budgetData);
            const contexto = {
                itens,
                filhosPorPai: new Map(),
                movimentacoesRecebidasPorId: new Map(),
                movimentacoesCedidasPorId: new Map(),
                valorFilhosPorPai: new Map(),
                resumoSaldoPorId: new Map()
            };

            itens.forEach((item) => {
                const itemId = normalizarBusca(item?.id);
                const paiId = normalizarBusca(item?.processoPaiId);
                const valorPrevisto = Number(item?.valorPrevisto) || 0;

                if (paiId && itemEhProcessoVinculadoOrcamento(item) && item.ativo !== false) {
                    if (!contexto.filhosPorPai.has(paiId)) {
                        contexto.filhosPorPai.set(paiId, []);
                    }
                    contexto.filhosPorPai.get(paiId).push(item);
                    contexto.valorFilhosPorPai.set(paiId, (contexto.valorFilhosPorPai.get(paiId) || 0) + valorPrevisto);
                }

                if (itemId) {
                    contexto.resumoSaldoPorId.set(itemId, null);
                }
            });

            (Array.isArray(movimentacoes) ? movimentacoes : []).forEach((movimentacao) => {
                const destinoId = normalizarBusca(movimentacao?.destinoId);
                const origemId = normalizarBusca(movimentacao?.origemId);
                const valor = Number(movimentacao?.valor) || 0;

                if (destinoId) {
                    contexto.movimentacoesRecebidasPorId.set(
                        destinoId,
                        (contexto.movimentacoesRecebidasPorId.get(destinoId) || 0) + valor
                    );
                }
                if (origemId) {
                    contexto.movimentacoesCedidasPorId.set(
                        origemId,
                        (contexto.movimentacoesCedidasPorId.get(origemId) || 0) + valor
                    );
                }
            });

            return contexto;
        }

        function calcularSaldoBasicoDisponivelOrcamento(item, budgetData = obterDadosOrcamento()) {
            if (!item) return 0;

            const itens = obterTodosItensOrcamentoParaDivisao(budgetData);
            const totalFilhos = itens
                .filter((registro) => (
                    normalizarBusca(registro?.processoPaiId) === normalizarBusca(item.id)
                    && itemEhProcessoVinculadoOrcamento(registro)
                    && registro.ativo !== false
                ))
                .reduce((total, registro) => total + (Number(registro.valorPrevisto) || 0), 0);

            const valorPrevisto = Number(item.valorPrevisto ?? item.valorTotal) || 0;
            const valorEmpenhado = Number(item.valorEmpenhado) || 0;
            const valorExecutado = Number(item.valorExecutado) || 0;

            return Math.max(0, valorPrevisto - valorEmpenhado - valorExecutado - totalFilhos);
        }

        // Consolida apenas a leitura visual do envelope; o valor original permanece preservado no banco.
        function calcularResumoSaldoVisualOrcamento(item, budgetData, movimentacoes, contextoRenderizacao = null) {
            if (!item) {
                return {
                    valorOriginal: 0, valorRecebidoPorAlocacao: 0, valorCedidoPorAlocacao: 0,
                    valorDistribuidoParaFilhos: 0, envelopeVisualAjustado: 0,
                    valorEmpenhado: 0, valorExecutado: 0, saldoTransferivelEstimado: 0,
                    temMovimentacao: false, temFilhos: false, temAlerta: false
                };
            }
            const contexto = contextoRenderizacao?.itens ? contextoRenderizacao : prepararContextoRenderizacaoOrcamento(budgetData, movimentacoes);
            const id = normalizarBusca(item.id);
            const resumoCache = contexto.resumoSaldoPorId.get(id);
            if (resumoCache) {
                return resumoCache;
            }
            const valorRecebidoPorAlocacao = contexto.movimentacoesRecebidasPorId.get(id) || 0;
            const valorCedidoPorAlocacao = contexto.movimentacoesCedidasPorId.get(id) || 0;
            const valorDistribuidoParaFilhos = contexto.valorFilhosPorPai.get(id) || 0;
            const valorOriginal = Number(item.valorPrevisto ?? item.valorTotal) || 0;
            const valorEmpenhado = Number(item.valorEmpenhado) || 0;
            const valorExecutado = Number(item.valorExecutado) || 0;
            const envelopeVisualAjustado = valorOriginal + valorRecebidoPorAlocacao - valorCedidoPorAlocacao - valorDistribuidoParaFilhos;
            const saldoTransferivelEstimado = envelopeVisualAjustado - valorEmpenhado - valorExecutado;
            const resumo = {
                valorOriginal, valorRecebidoPorAlocacao, valorCedidoPorAlocacao,
                valorDistribuidoParaFilhos, envelopeVisualAjustado, valorEmpenhado, valorExecutado,
                saldoTransferivelEstimado,
                temMovimentacao: valorRecebidoPorAlocacao > 0 || valorCedidoPorAlocacao > 0,
                temFilhos: valorDistribuidoParaFilhos > 0,
                temAlerta: envelopeVisualAjustado < 0 || saldoTransferivelEstimado < 0
            };

            contexto.resumoSaldoPorId.set(id, resumo);
            return resumo;
        }

        // O cálculo visual antecipa o saldo para UX; o backend continua sendo a fonte de verdade.
        function calcularSaldoTransferivelVisualOrcamento(item, budgetData, movimentacoes) {
            return Math.max(0, calcularResumoSaldoVisualOrcamento(item, budgetData, movimentacoes).saldoTransferivelEstimado);
        }

        async function carregarMovimentacoesOrcamento2026() {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                orcamentoMovimentacoes = [];
                return;
            }
            try {
                const inicioMovimentacoes = DEBUG_PERF_ONASP ? performance.now() : 0;
                const { payload } = await fetchJsonApiOnasp('/api/orcamento-2026/movimentacoes');
                // A alocação é registrada como movimentação, sem alterar o valor original dos processos.
                orcamentoMovimentacoes = Array.isArray(payload?.movimentacoes) ? payload.movimentacoes : [];
                registrarPerfOrcamento('carregarMovimentacoesOrcamento2026', inicioMovimentacoes, {
                    totalMovimentacoes: orcamentoMovimentacoes.length
                });
            } catch {
                orcamentoMovimentacoes = [];
            }
        }

        function renderizarDetalheEnvelopeOrcamento(resumo) {
            if (!resumo || (!resumo.temMovimentacao && !resumo.temFilhos && !resumo.temAlerta)) return '';
            const partes = [];
            if (resumo.valorOriginal !== resumo.envelopeVisualAjustado) {
                partes.push(`<span class="budget-balance-detail-item">Orig. ${formatMoney(resumo.valorOriginal)}</span>`);
            }
            if (resumo.valorRecebidoPorAlocacao > 0) {
                partes.push(`<span class="budget-balance-detail-item budget-balance-detail-positive">Rec. ${formatMoney(resumo.valorRecebidoPorAlocacao)}</span>`);
            }
            if (resumo.valorCedidoPorAlocacao > 0) {
                partes.push(`<span class="budget-balance-detail-item budget-balance-detail-negative">Ced. ${formatMoney(resumo.valorCedidoPorAlocacao)}</span>`);
            }
            if (resumo.valorDistribuidoParaFilhos > 0) {
                partes.push(`<span class="budget-balance-detail-item">Vinc. ${formatMoney(resumo.valorDistribuidoParaFilhos)}</span>`);
            }
            if (!partes.length && !resumo.temAlerta) return '';
            return `<div class="budget-balance-detail${resumo.temAlerta ? ' budget-balance-alert' : ''}">${partes.join('')}</div>`;
        }

        function renderizarBadgeProcessoVinculadoOrcamento(item) {
            if (!itemEhProcessoVinculadoOrcamento(item)) return '';

            return `
                <div class="budget-linked-process-info">
                    <span class="budget-linked-process-badge">
                        <i class="fas fa-code-branch" aria-hidden="true"></i>
                        <span>Processo vinculado</span>
                    </span>
                    <div class="budget-linked-process-origin">Origem: ${escapeHtml(item.processoPaiId || '-')}</div>
                </div>
            `;
        }

        // Filhos vinculados são renderizados junto ao pai para evitar dupla contagem visual no orçamento.
        function obterFilhosVinculadosOrcamento(paiId, budgetData, contextoRenderizacao = null) {
            const contexto = contextoRenderizacao?.itens ? contextoRenderizacao : prepararContextoRenderizacaoOrcamento(budgetData);
            return contexto.filhosPorPai.get(normalizarBusca(paiId)) || [];
        }

        // O valor do pai permanece como envelope original; o saldo exibido desconta apenas a distribuição para filhos.
        function calcularResumoVinculosOrcamento(pai, filhos) {
            const valorDistribuido = filhos.reduce((t, f) => t + (Number(f.valorPrevisto) || 0), 0);
            const saldoBasicoRestante = (Number(pai.valorPrevisto ?? pai.valorTotal) || 0)
                - (Number(pai.valorEmpenhado) || 0)
                - (Number(pai.valorExecutado) || 0)
                - valorDistribuido;
            return { valorDistribuido, saldoBasicoRestante };
        }

        function renderizarResumoVinculosNoPaiOrcamento(pai, filhos) {
            if (!filhos.length) return '';
            const { valorDistribuido, saldoBasicoRestante } = calcularResumoVinculosOrcamento(pai, filhos);
            const alertaClasse = saldoBasicoRestante < 0 ? ' budget-linked-summary-alert' : '';
            return `
                <div class="budget-linked-summary${alertaClasse}">
                    <span class="budget-linked-summary-item">Vinculado: <strong>${filhos.length}</strong></span>
                    <span class="budget-linked-summary-item">Distribuído: <strong class="font-monospace">${formatMoney(valorDistribuido)}</strong></span>
                    <span class="budget-linked-summary-item">Saldo básico: <strong class="font-monospace${saldoBasicoRestante < 0 ? ' text-danger' : ''}">${formatMoney(saldoBasicoRestante)}</strong></span>
                </div>
            `;
        }

        function renderizarFilhosVinculadosOrcamento(filhos, budgetData, contextoRenderizacao = null) {
            if (!filhos.length) return '';
            const dadosBudget = budgetData || obterDadosOrcamento();
            const contexto = contextoRenderizacao?.itens ? contextoRenderizacao : prepararContextoRenderizacaoOrcamento(dadosBudget, orcamentoMovimentacoes);
            return filhos.map((filho) => {
                const filhoId = String(filho.id);
                const podeExibirRastreio = itemPodeExibirRastreioOrcamento(filho);
                const rastreioAberto = podeExibirRastreio && orcamentoItensRastreioAbertos.has(filhoId);
                const idRastreio = obterIdRastreioOrcamento(filho);
                const quantidadeUnidade = [filho.quantidade, filho.unidade].filter(Boolean).join(' ');
                const processoAutuado = calcularProcessoAutuadoVisualOrcamento(filho);
                const valorEstimado = obterValorPendenteOrcamento(filho, 'valor_estimado_pesquisa_preco');
                const valorEmpenhado = obterValorPendenteOrcamento(filho, 'valor_empenhado');
                const valorExecutado = obterValorPendenteOrcamento(filho, 'valor_executado');
                const classificacaoGerencial = normalizarClassificacaoGerencialOrcamento(obterValorPendenteOrcamento(filho, 'classificacao_gerencial'));
                const saldoAparelhamento = classificacaoGerencial === 'APARELHAMENTO'
                    ? Math.max(0, (Number(filho.valorPrevisto ?? filho.valorTotal) || 0) - (Number(valorEstimado) || 0))
                    : 0;
                const processoSei = obterValorPendenteOrcamento(filho, 'processo_sei') || filho.processoSei;
                const status = obterValorPendenteOrcamento(filho, 'status');
                const observacao = obterValorPendenteOrcamento(filho, 'observacao');
                const resumoSaldoFilho = calcularResumoSaldoVisualOrcamento(filho, dadosBudget, orcamentoMovimentacoes, contexto);

                return `
                    <tr class="budget-item-row budget-linked-child-row ${rastreioAberto ? 'budget-item-row-open' : ''}">
                        <td data-label="Item" class="align-middle budget-item-cell budget-linked-child-item">
                            <div class="budget-linked-child-prefix">
                                <span class="budget-linked-badge">
                                    <i class="fas fa-code-branch" aria-hidden="true"></i>
                                    Processo vinculado
                                </span>
                            </div>
                            ${podeExibirRastreio ? `
                                <button type="button" class="budget-item-title budget-tracking-toggle" data-budget-item-id="${escapeHtml(filhoId)}" aria-expanded="${rastreioAberto}" aria-controls="${escapeHtml(idRastreio)}">
                                    <span>${escapeHtml(filho.descricao)}</span>
                                    <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                </button>
                            ` : `<div class="budget-item-title budget-item-title-static">${escapeHtml(filho.descricao)}</div>`}
                            ${processoSei ? `<div class="budget-item-meta">SEI ${escapeHtml(processoSei)}</div>` : ''}
                        </td>
                        <td data-label="Modalidade/Natureza" class="align-middle">
                            <strong class="d-block">${escapeHtml(filho.modalidade || '-')}</strong>
                            <span class="text-muted small">${escapeHtml(filho.natureza || '-')}</span>
                        </td>
                        <td data-label="Abrangência/Qtd." class="text-center align-middle">
                            <strong class="d-block">${escapeHtml(filho.abrangencia || '-')}</strong>
                            <span class="text-muted small">${escapeHtml(quantidadeUnidade || '-')}</span>
                        </td>
                        <td data-label="Valor previsto" class="text-end font-monospace align-middle fw-bold text-primary">
                            ${formatMoney(resumoSaldoFilho.envelopeVisualAjustado)}
                            ${renderizarDetalheEnvelopeOrcamento(resumoSaldoFilho)}
                        </td>
                        <td data-label="Em execução" class="align-middle">
                            <div class="budget-execution-cell">
                                <span class="font-monospace fw-bold text-money">${formatMoney(Number(valorEstimado) || 0)}</span>
                                <span class="profor-alert-badge profor-alert-${processoAutuado ? 'success' : 'warning'} budget-execution-badge">${processoAutuado ? 'Autuado' : 'Não autuado'}</span>
                            </div>
                        </td>
                        <td data-label="Classificação" class="text-center align-middle">
                            ${renderizarClassificacaoGerencialOrcamento(classificacaoGerencial, saldoAparelhamento)}
                        </td>
                        <td data-label="Empenhado" class="text-end font-monospace align-middle">${formatMoney(Number(valorEmpenhado) || 0)}</td>
                        <td data-label="Executado" class="text-end font-monospace align-middle">${formatMoney(Number(valorExecutado) || 0)}</td>
                        <td data-label="Status" class="text-center align-middle">
                            ${renderizarStatusOrcamento(status)}
                        </td>
                        <td data-label="Observação" class="align-middle" title="${escapeHtml(observacao)}">
                            <div class="budget-row-note">${escapeHtml(observacao) || '-'}</div>
                        </td>
                        <td data-label="Ações" class="text-center align-middle">
                            <div class="budget-row-actions justify-content-center">
                                ${renderizarLinksOrcamento(filho)}
                                ${renderizarBotaoAlocarSaldoOrcamento(filho, resumoSaldoFilho)}
                                ${renderizarBotaoEdicaoOrcamento(filho.id)}
                            </div>
                        </td>
                    </tr>
                    ${renderizarPainelEdicaoOrcamento(filho, 11)}
                    ${rastreioAberto ? renderizarRastreioOrcamento(filho) : ''}
                `;
            }).join('');
        }

        function renderizarBotaoDividirRecursoOrcamento(item) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) return '';
            if (!itemPodeDividirRecursoOrcamento(item)) return '';

            return renderActionButton({
                type: 'split',
                label: 'Dividir recurso',
                variant: 'outline-primary',
                backend: true,
                title: 'Dividir recurso',
                iconOnly: true,
                extraClass: 'budget-split-button budget-row-action',
                attributes: `data-orcamento-dividir-recurso="${escapeHtml(item.id)}"`
            });
        }

        function itemPodeAlocarSaldoOrcamento(item, saldoTransferivelEstimado) {
            if (!Boolean(item) || item.ativo === false || dadosPaginaEmModoEstatico('orcamento2026')) return false;
            if (saldoTransferivelEstimado !== undefined && saldoTransferivelEstimado <= 0) return false;
            return true;
        }

        function renderizarBotaoAlocarSaldoOrcamento(item, resumoSaldo) {
            if (!itemPodeAlocarSaldoOrcamento(item, resumoSaldo?.saldoTransferivelEstimado)) return '';

            return renderActionButton({
                type: 'allocate',
                label: 'Alocar saldo',
                variant: 'outline-primary',
                backend: true,
                title: 'Alocar saldo',
                iconOnly: true,
                extraClass: 'budget-allocate-button budget-row-action',
                attributes: `data-orcamento-alocar-saldo="${escapeHtml(item.id)}"`
            });
        }

        function renderizarModalAlocarSaldoOrcamento(item, todosItens, movimentacoes, saldoTransferivel, contextoRenderizacao = null) {
            const categoriaOrigem = normalizarTexto(item.categoria || item.frente || '');
            const contexto = contextoRenderizacao?.itens ? contextoRenderizacao : prepararContextoRenderizacaoOrcamento({ itens: todosItens, outrosProcessos: [] }, movimentacoes);

            const destinos = todosItens.filter((dest) => (
                String(dest.id) !== String(item.id)
                && dest.ativo !== false
                && normalizarTexto(dest.categoria || dest.frente || '') === categoriaOrigem
            ));

            const resumoSaldo = calcularResumoSaldoVisualOrcamento(item, { itens: todosItens, outrosProcessos: [] }, movimentacoes, contexto);
            const { valorOriginal, valorRecebidoPorAlocacao: valorRecebido, valorCedidoPorAlocacao: valorCedido,
                    valorDistribuidoParaFilhos: valorDistribuidoFilhos, envelopeVisualAjustado,
                    valorEmpenhado, valorExecutado } = resumoSaldo;

            const historicoItem = movimentacoes
                .filter((m) => String(m.origemId || '') === String(item.id) || String(m.destinoId || '') === String(item.id))
                .slice(0, 5);

            const saldoFinalModal = resumoSaldo.saldoTransferivelEstimado;
            const saldoClasse = saldoFinalModal > 0 ? 'text-success' : saldoFinalModal < 0 ? 'text-danger' : 'text-muted';

            return `
                <div class="modal fade budget-allocation-modal" id="modalAlocarSaldoOrcamento" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <div>
                                    <p class="section-eyebrow mb-1">Orçamento 2026</p>
                                    <h5 class="modal-title">Alocar saldo</h5>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <div class="budget-allocation-summary">
                                    <div class="budget-split-summary-item">
                                        <span>Processo de origem</span>
                                        <strong>${escapeHtml(item.id || '-')}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Frente / categoria</span>
                                        <strong>${escapeHtml(item.frente || item.categoria || '-')}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor original</span>
                                        <strong>${formatMoney(valorOriginal)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Recebido por alocações</span>
                                        <strong class="text-success">${formatMoney(valorRecebido)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Cedido por alocações</span>
                                        <strong class="text-warning">${formatMoney(valorCedido)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Distribuído para vinculados</span>
                                        <strong>${formatMoney(valorDistribuidoFilhos)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Envelope ajustado</span>
                                        <strong class="${envelopeVisualAjustado < 0 ? 'text-danger' : ''}">${formatMoney(envelopeVisualAjustado)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor empenhado</span>
                                        <strong>${formatMoney(valorEmpenhado)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor executado</span>
                                        <strong>${formatMoney(valorExecutado)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item budget-split-summary-item-wide">
                                        <span>Saldo transferível estimado</span>
                                        <strong class="${saldoClasse}">${formatMoney(saldoFinalModal)}</strong>
                                    </div>
                                </div>

                                ${historicoItem.length ? `
                                    <div class="budget-allocation-history mt-3">
                                        <div class="budget-allocation-history-title">Últimas movimentações deste processo</div>
                                        ${historicoItem.map((m) => `
                                            <div class="budget-allocation-history-item">
                                                <span class="budget-allocation-badge">${m.origemId === item.id ? 'Cedido' : 'Recebido'}</span>
                                                ${m.origemId === item.id
                                                    ? `→ <strong>${escapeHtml(m.destinoId || '-')}</strong>`
                                                    : `← <strong>${escapeHtml(m.origemId || '-')}</strong>`}
                                                <strong class="font-monospace">${formatMoney(Number(m.valor) || 0)}</strong>
                                                <span class="text-muted">${escapeHtml(m.justificativa || '')}</span>
                                                <span class="text-muted">${m.criadoEm ? new Date(m.criadoEm).toLocaleString('pt-BR') : ''}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                <form class="budget-allocation-form-fields mt-3" id="formAlocarSaldoOrcamento" novalidate>
                                    <div class="row g-3">
                                        <div class="col-12">
                                            <label class="form-label" for="budgetAllocDestino">Processo de destino <span class="text-danger">*</span></label>
                                            <select class="form-select" id="budgetAllocDestino" required>
                                                <option value="">Selecione o processo de destino...</option>
                                                ${destinos.map((dest) => {
                                                    const envDest = calcularResumoSaldoVisualOrcamento(dest, { itens: todosItens, outrosProcessos: [] }, movimentacoes, contexto).envelopeVisualAjustado;
                                                    return `<option value="${escapeHtml(dest.id)}">${escapeHtml(dest.id)} — ${escapeHtml(dest.descricao || '-')} (ajust.: ${formatMoney(envDest)})</option>`;
                                                }).join('')}
                                            </select>
                                            ${destinos.length === 0 ? '<div class="form-text text-warning">Nenhum processo elegível na mesma categoria.</div>' : ''}
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="budgetAllocValor">Valor a alocar <span class="text-danger">*</span></label>
                                            <input type="text" class="form-control" id="budgetAllocValor" inputmode="decimal" placeholder="0,00" required>
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label" for="budgetAllocJustificativa">Justificativa <span class="text-danger">*</span></label>
                                            <textarea class="form-control" id="budgetAllocJustificativa" rows="3" maxlength="500" placeholder="Descreva o motivo da realocação de saldo" required></textarea>
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label" for="budgetAllocPassword">Senha de confirmação <span class="text-danger">*</span></label>
                                            <input type="password" class="form-control" id="budgetAllocPassword" autocomplete="current-password" required>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'btnConfirmarAlocacaoSaldoOrcamento',
                                    type: 'save',
                                    label: 'Confirmar alocação',
                                    variant: 'primary',
                                    backend: true,
                                    disabled: orcamentoAlocacaoEmAndamento
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        async function abrirModalAlocarSaldoOrcamento(itemId) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const budgetData = obterDadosOrcamento();
            const todosItens = obterTodosItensOrcamentoParaDivisao(budgetData);
            const item = todosItens.find((registro) => String(registro.id) === String(itemId));

            if (!item || !itemPodeAlocarSaldoOrcamento(item)) {
                alert('Não foi possível localizar um processo elegível para alocação de saldo.');
                return;
            }

            // O backend valida o saldo real; o front-end calcula apenas uma estimativa para orientar o usuário.
            const saldoTransferivel = calcularSaldoTransferivelVisualOrcamento(item, budgetData, orcamentoMovimentacoes);

            removerModalOnasp('modalAlocarSaldoOrcamento');
            const contextoRenderizacao = prepararContextoRenderizacaoOrcamento(budgetData, orcamentoMovimentacoes);
            document.body.insertAdjacentHTML('beforeend', renderizarModalAlocarSaldoOrcamento(
                item, todosItens, orcamentoMovimentacoes, saldoTransferivel, contextoRenderizacao
            ));

            const modalElement = document.getElementById('modalAlocarSaldoOrcamento');
            const modal = new window.bootstrap.Modal(modalElement);
            const form = document.getElementById('formAlocarSaldoOrcamento');
            const campoDestino = document.getElementById('budgetAllocDestino');
            const campoValor = document.getElementById('budgetAllocValor');
            const campoJustificativa = document.getElementById('budgetAllocJustificativa');
            const campoPassword = document.getElementById('budgetAllocPassword');
            const botaoConfirmar = document.getElementById('btnConfirmarAlocacaoSaldoOrcamento');

            modal.show();
            campoDestino?.focus();

            const limparValidacao = (campo) => { if (campo) campo.setCustomValidity(''); };
            campoDestino?.addEventListener('change', () => limparValidacao(campoDestino));
            campoValor?.addEventListener('input', () => limparValidacao(campoValor));
            campoJustificativa?.addEventListener('input', () => limparValidacao(campoJustificativa));
            campoPassword?.addEventListener('input', () => limparValidacao(campoPassword));

            botaoConfirmar?.addEventListener('click', async () => {
                if (orcamentoAlocacaoEmAndamento) return;

                const destinoId = String(campoDestino?.value || '').trim();
                const valor = parseNumeroMonetarioFrontend(campoValor?.value || '');
                const justificativa = String(campoJustificativa?.value || '').trim();
                const password = String(campoPassword?.value || '').trim();

                if (!destinoId) {
                    campoDestino?.setCustomValidity('Selecione o processo de destino.');
                    campoDestino?.reportValidity();
                    return;
                }

                if (!Number.isFinite(valor) || valor <= 0) {
                    campoValor?.setCustomValidity('Informe um valor maior que zero.');
                    campoValor?.reportValidity();
                    return;
                }

                if (Number.isFinite(saldoTransferivel) && valor > saldoTransferivel) {
                    campoValor?.setCustomValidity('O valor excede o saldo transferível estimado.');
                    campoValor?.reportValidity();
                    return;
                }

                if (!justificativa) {
                    campoJustificativa?.setCustomValidity('Informe a justificativa da alocação.');
                    campoJustificativa?.reportValidity();
                    return;
                }

                if (!password) {
                    campoPassword?.setCustomValidity('Informe a senha de confirmação.');
                    campoPassword?.reportValidity();
                    return;
                }

                orcamentoAlocacaoEmAndamento = true;
                botaoConfirmar.disabled = true;
                botaoConfirmar.setAttribute('aria-disabled', 'true');

                try {
                    const { resposta, payload } = await fetchJsonApiOnasp('/api/orcamento-2026/saldos/alocar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password, origemId: String(item.id), destinoId, valor, justificativa })
                    });

                    if (!resposta.ok || !payload.success) {
                        alert(payload.message || 'Não foi possível alocar o saldo.');
                        return;
                    }

                    modal.hide();
                    await carregarDadosOrcamento(true);
                    await carregarMovimentacoesOrcamento2026();
                    renderOrcamentoView();
                    alert(payload.message || 'Saldo alocado com sucesso.');
                } catch (error) {
                    alert(`Não foi possível alocar o saldo: ${error.message}`);
                } finally {
                    orcamentoAlocacaoEmAndamento = false;
                    if (botaoConfirmar) {
                        botaoConfirmar.disabled = false;
                        botaoConfirmar.removeAttribute('aria-disabled');
                    }
                }
            });
        }

        function renderizarModalDividirRecursoOrcamento(item, saldoBasicoDisponivel) {
            const saldoTexto = formatMoney(saldoBasicoDisponivel);
            const statusPadrao = 'PLANEJADO';

            return `
                <div class="modal fade budget-split-modal" id="modalDividirRecursoOrcamento" tabindex="-1" aria-hidden="true" data-orcamento-pai-id="${escapeHtml(item.id)}">
                    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div class="modal-content budget-split-modal-content">
                            <div class="modal-header">
                                <div>
                                    <p class="section-eyebrow mb-1">Orçamento 2026</p>
                                    <h5 class="modal-title">Dividir recurso</h5>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body budget-split-form">
                                <div class="budget-split-summary">
                                    <div class="budget-split-summary-item">
                                        <span>Processo pai</span>
                                        <strong>${escapeHtml(item.id || '-')}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Descrição do processo pai</span>
                                        <strong>${escapeHtml(item.descricao || '-')}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Frente / categoria</span>
                                        <strong>${escapeHtml(item.frente || item.categoria || '-')}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor previsto do pai</span>
                                        <strong>${formatMoney(Number(item.valorPrevisto ?? item.valorTotal) || 0)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor empenhado</span>
                                        <strong>${formatMoney(Number(item.valorEmpenhado) || 0)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item">
                                        <span>Valor executado</span>
                                        <strong>${formatMoney(Number(item.valorExecutado) || 0)}</strong>
                                    </div>
                                    <div class="budget-split-summary-item budget-split-summary-item-wide">
                                        <span>Saldo básico disponível</span>
                                        <strong class="${saldoBasicoDisponivel < 0 ? 'text-danger' : 'text-success'}">${saldoTexto}</strong>
                                    </div>
                                </div>

                                <div class="budget-linked-process-preview mt-3">
                                    ${renderizarBadgeProcessoVinculadoOrcamento(item)}
                                </div>

                                <form class="budget-split-form-fields mt-3" id="formDividirRecursoOrcamento" novalidate>
                                    <div class="row g-3">
                                        <div class="col-12">
                                            <label class="form-label" for="budgetSplitDescricao">Descrição do novo processo vinculado</label>
                                            <input type="text" class="form-control" id="budgetSplitDescricao" maxlength="255" required placeholder="Ex.: Contratação de serviços gráficos - etapa 2">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="budgetSplitValorAlocado">Valor alocado</label>
                                            <input type="text" class="form-control" id="budgetSplitValorAlocado" inputmode="decimal" placeholder="0,00" required>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="budgetSplitStatus">Status</label>
                                            <select class="form-select" id="budgetSplitStatus">
                                                ${STATUS_ORCAMENTO_EDICAO.map((status) => `<option value="${escapeHtml(status)}" ${status === statusPadrao ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="budgetSplitProcessoSei">Processo SEI</label>
                                            <input type="text" class="form-control" id="budgetSplitProcessoSei" maxlength="120" placeholder="Opcional">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label" for="budgetSplitDataProcessoSei">Data do Processo SEI</label>
                                            <input type="text" class="form-control" id="budgetSplitDataProcessoSei" maxlength="20" placeholder="DD/MM/AAAA">
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label" for="budgetSplitLinkProcessoSei">Link do Processo SEI</label>
                                            <input type="url" class="form-control" id="budgetSplitLinkProcessoSei" maxlength="500" placeholder="https://...">
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label" for="budgetSplitObservacao">Observação</label>
                                            <textarea class="form-control" id="budgetSplitObservacao" rows="3" maxlength="1000" placeholder="Observação opcional"></textarea>
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label" for="budgetSplitPassword">Senha de confirmação</label>
                                            <input type="password" class="form-control" id="budgetSplitPassword" autocomplete="current-password" required>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'btnSalvarDivisaoRecursoOrcamento',
                                    type: 'save',
                                    label: 'Salvar divisão',
                                    variant: 'primary',
                                    backend: true,
                                    disabled: orcamentoDivisaoRecursoEmAndamento,
                                    attributes: 'data-orcamento-salvar-divisao="1"'
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function abrirModalDividirRecursoOrcamento(itemId) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const budgetData = obterDadosOrcamento();
            const todosItens = obterTodosItensOrcamentoParaDivisao(budgetData);
            const item = todosItens.find((registro) => String(registro.id) === String(itemId));

            if (!item || !itemPodeDividirRecursoOrcamento(item)) {
                alert('Não foi possível localizar um processo principal elegível para divisão.');
                return;
            }

            const saldoBasicoDisponivel = calcularSaldoBasicoDisponivelOrcamento(item, budgetData);
            removerModalOnasp('modalDividirRecursoOrcamento');
            document.body.insertAdjacentHTML('beforeend', renderizarModalDividirRecursoOrcamento(item, saldoBasicoDisponivel));

            const modalElement = document.getElementById('modalDividirRecursoOrcamento');
            const modal = new window.bootstrap.Modal(modalElement);
            const form = document.getElementById('formDividirRecursoOrcamento');
            const campoDescricao = document.getElementById('budgetSplitDescricao');
            const campoValor = document.getElementById('budgetSplitValorAlocado');
            const campoStatus = document.getElementById('budgetSplitStatus');
            const campoPassword = document.getElementById('budgetSplitPassword');
            const campoProcessoSei = document.getElementById('budgetSplitProcessoSei');
            const campoLinkProcessoSei = document.getElementById('budgetSplitLinkProcessoSei');
            const campoDataProcessoSei = document.getElementById('budgetSplitDataProcessoSei');
            const campoObservacao = document.getElementById('budgetSplitObservacao');
            const botaoSalvar = document.getElementById('btnSalvarDivisaoRecursoOrcamento');

            modal.show();
            campoDescricao?.focus();

            const limparValidacao = (campo) => {
                if (campo) campo.setCustomValidity('');
            };

            campoValor?.addEventListener('input', () => limparValidacao(campoValor));
            campoDescricao?.addEventListener('input', () => limparValidacao(campoDescricao));
            campoPassword?.addEventListener('input', () => limparValidacao(campoPassword));

            botaoSalvar?.addEventListener('click', async () => {
                if (orcamentoDivisaoRecursoEmAndamento) return;

                if (!form?.reportValidity()) return;

                const descricao = String(campoDescricao?.value || '').trim();
                const valorAlocado = parseNumeroMonetarioFrontend(campoValor?.value || '');
                const saldoBasico = Number.isFinite(saldoBasicoDisponivel) ? saldoBasicoDisponivel : null;

                if (!descricao) {
                    campoDescricao?.setCustomValidity('Informe a descrição do novo processo vinculado.');
                    campoDescricao?.reportValidity();
                    return;
                }

                if (!Number.isFinite(valorAlocado) || valorAlocado <= 0) {
                    campoValor?.setCustomValidity('Informe um valor maior que zero.');
                    campoValor?.reportValidity();
                    return;
                }

                if (saldoBasico !== null && valorAlocado > saldoBasico) {
                    campoValor?.setCustomValidity('O valor alocado excede o saldo básico disponível.');
                    campoValor?.reportValidity();
                    return;
                }

                orcamentoDivisaoRecursoEmAndamento = true;
                botaoSalvar.disabled = true;
                botaoSalvar.setAttribute('aria-disabled', 'true');

                try {
                    // A divisão cria processo vinculado sem compor novamente o total global do orçamento.
                    // O backend valida saldo e impede duplicidade orçamentária; o front-end apenas antecipa erros de preenchimento.
                    const { resposta, payload } = await fetchJsonApiOnasp('/api/orcamento-2026/processos-vinculados/criar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            password: String(campoPassword?.value || '').trim(),
                            processoPaiId: String(item.id),
                            descricao,
                            valorAlocado,
                            processoSei: String(campoProcessoSei?.value || '').trim(),
                            linkProcessoSei: String(campoLinkProcessoSei?.value || '').trim(),
                            dataProcessoSei: String(campoDataProcessoSei?.value || '').trim(),
                            status: String(campoStatus?.value || 'PLANEJADO').trim(),
                            observacao: String(campoObservacao?.value || '').trim()
                        })
                    });

                    if (!resposta.ok || !payload.success) {
                        alert(payload.message || 'Não foi possível dividir o recurso.');
                        return;
                    }

                    modal.hide();
                    await carregarDadosOrcamento(true);
                    await carregarMovimentacoesOrcamento2026();
                    renderOrcamentoView();
                    alert(payload.message || 'Processo vinculado criado com sucesso.');
                } catch (error) {
                    alert(`Não foi possível dividir o recurso: ${error.message}`);
                } finally {
                    orcamentoDivisaoRecursoEmAndamento = false;
                    botaoSalvar.disabled = false;
                    botaoSalvar.removeAttribute('aria-disabled');
                }
            });
        }

        function renderizarCabecalhoColunasOrcamento() {
            return `
                <tr class="budget-column-row">
                    <th scope="col"><div class="budget-header-cell"><i class="fas fa-box" aria-hidden="true"></i> <span>Item</span></div></th>
                    <th scope="col" title="Modalidade / Natureza"><div class="budget-header-cell"><i class="fas fa-tags" aria-hidden="true"></i> <span>Mod./Nat.</span></div></th>
                    <th scope="col" title="Abrangência / Quantidade"><div class="budget-header-cell header-abrangencia"><i class="fas fa-layer-group" aria-hidden="true"></i> <span>Abr./Qtd.</span></div></th>
                    <th scope="col" title="Valor previsto"><div class="budget-header-cell"><i class="fas fa-coins" aria-hidden="true"></i> <span>Previsto</span></div></th>
                    <th scope="col" title="Valor em execução"><div class="budget-header-cell"><i class="fas fa-hourglass-half" aria-hidden="true"></i> <span>Execução</span></div></th>
                    <th scope="col" title="Classificação gerencial"><div class="budget-header-cell"><i class="fas fa-boxes-stacked" aria-hidden="true"></i> <span>Classif.</span></div></th>
                    <th scope="col" title="Valor empenhado"><div class="budget-header-cell"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> <span>Emp.</span></div></th>
                    <th scope="col" title="Valor executado"><div class="budget-header-cell"><i class="fas fa-check-double" aria-hidden="true"></i> <span>Exec.</span></div></th>
                    <th scope="col"><div class="budget-header-cell"><i class="fas fa-info-circle" aria-hidden="true"></i> <span>Status</span></div></th>
                    <th scope="col" title="Observação"><div class="budget-header-cell"><i class="fas fa-comment-dots" aria-hidden="true"></i> <span>Obs.</span></div></th>
                    <th scope="col"><div class="budget-header-cell"><i class="fas fa-cogs" aria-hidden="true"></i> <span>Ações</span></div></th>
                </tr>
            `;
        }

        function renderizarPainelEdicaoOrcamento(item, colspan = 8) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) return '';

            const itemId = String(item.id);
            if (!orcamentoItemEmEdicao(itemId)) return '';
            const usaRastreioProfor = itemUsaRastreioProfor(item);
            const camposRastreio = usaRastreioProfor ? CAMPOS_EDICAO_RASTREIO_PROFOR : CAMPOS_EDICAO_RASTREIO_PROCESSO;
            const tituloRastreio = usaRastreioProfor ? 'Andamentos PROFOR' : 'Andamentos processuais';

            return `
                <tr class="budget-edit-row pdf-hidden">
                    <td colspan="${colspan}">
                        <div class="budget-edit-panel">
                            <div class="budget-edit-panel-header">
                                <strong>Editar acompanhamento</strong>
                                <span>As alterações ficam pendentes até clicar em Salvar alterações.</span>
                            </div>
                            <div class="budget-edit-grid">
                                <label>
                                    <span>Valor em execução (pesquisa de preço)</span>
                                    ${renderizarCampoOrcamento(item, 'valor_estimado_pesquisa_preco', 'money')}
                                </label>
                                <label>
                                    <span>Valor empenhado (notas de empenho)</span>
                                    ${renderizarCampoOrcamento(item, 'valor_empenhado', 'money')}
                                </label>
                                <label>
                                    <span>Valor executado (ordens bancárias)</span>
                                    ${renderizarCampoOrcamento(item, 'valor_executado', 'money')}
                                </label>
                                <label>
                                    <span>Processo autuado</span>
                                    ${renderizarCampoOrcamento(item, 'processo_autuado')}
                                </label>
                                <label>
                                    <span>Processo SEI</span>
                                    ${renderizarCampoOrcamento(item, 'processo_sei')}
                                </label>
                                <label>
                                    <span>Status</span>
                                    ${renderizarCampoOrcamento(item, 'status')}
                                </label>
                                <label>
                                    <span>Classificação gerencial</span>
                                    ${renderizarCampoOrcamento(item, 'classificacao_gerencial')}
                                </label>
                                <label class="budget-edit-grid-wide">
                                    <span>Observação</span>
                                    ${renderizarCampoOrcamento(item, 'observacao')}
                                </label>
                            </div>
                            ${itemPodeExibirRastreioOrcamento(item) ? renderizarSecaoEdicaoRastreioOrcamento(item, tituloRastreio, camposRastreio) : ''}
                            <div class="budget-edit-panel-actions">
                                ${renderActionButton({
                                    type: 'save',
                                    label: 'Salvar',
                                    variant: 'primary',
                                    backend: true,
                                    disabled: !obterQuantidadeAlteracoesLinhaOrcamento(itemId),
                                    attributes: `data-orcamento-salvar-linha="${escapeHtml(itemId)}"`
                                })}
                                ${renderActionButton({
                                    type: 'cancel',
                                    label: 'Cancelar',
                                    variant: 'outline-secondary',
                                    backend: true,
                                    attributes: `data-orcamento-cancelar-linha="${escapeHtml(itemId)}"`
                                })}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }

        // Recria o corpo da tabela a cada filtro ou expansão. Como o volume é
        // pequeno, isso reduz estado manual e evita inconsistência visual.
        function atualizarTabelaOrcamento(budgetData) {
            const inicioAtualizacao = DEBUG_PERF_ONASP ? performance.now() : 0;
            const tbody = document.getElementById('budget-table-body');
            if (!tbody) return;
            const contextoRenderizacao = prepararContextoRenderizacaoOrcamento(budgetData, orcamentoMovimentacoes);

            const itensFiltrados = filtrarItensOrcamento(budgetData);
            const resumoSelecao = calcularResumoItensOrcamento(itensFiltrados);

            const idsFilhosVinculados = Array.from(contextoRenderizacao.filhosPorPai.values())
                .flat()
                .map((item) => String(item.id));
            const idsFiltrados = new Set([
                ...itensFiltrados.map((item) => String(item.id)),
                ...idsFilhosVinculados
            ]);
            orcamentoItensRastreioAbertos = new Set(
                Array.from(orcamentoItensRastreioAbertos).filter((itemId) => idsFiltrados.has(itemId))
            );

            document.getElementById('budget-selected-total').textContent = formatMoney(resumoSelecao.total);
            document.getElementById('budget-selected-running').textContent = formatMoney(resumoSelecao.emExecucao);
            document.getElementById('budget-selected-committed').textContent = formatMoney(resumoSelecao.empenhado);
            document.getElementById('budget-selected-executed').textContent = formatMoney(resumoSelecao.executado);

            const grupos = agruparItensOrcamentoPorFrente(itensFiltrados);
            if (!grupos.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" class="py-4">
                            ${renderEmptyState({
                                titulo: 'Nenhum item orçamentário encontrado.',
                                descricao: 'Ajuste os filtros aplicados ou verifique se os dados foram carregados corretamente.',
                                icon: 'fa-wallet'
                            })}
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = grupos.map((grupo) => {
                const linhas = grupo.itens.map((item) => {
                    const itemId = String(item.id);
                    const podeExibirRastreio = itemPodeExibirRastreioOrcamento(item);
                    const rastreioAberto = podeExibirRastreio && orcamentoItensRastreioAbertos.has(itemId);
                    const idRastreio = obterIdRastreioOrcamento(item);
                    const quantidadeUnidade = [item.quantidade, item.unidade].filter(Boolean).join(' ');
                    const processoAutuado = calcularProcessoAutuadoVisualOrcamento(item);
                    const valorEstimado = obterValorPendenteOrcamento(item, 'valor_estimado_pesquisa_preco');
                    const valorEmpenhado = obterValorPendenteOrcamento(item, 'valor_empenhado');
                    const valorExecutado = obterValorPendenteOrcamento(item, 'valor_executado');
                    const classificacaoGerencial = normalizarClassificacaoGerencialOrcamento(obterValorPendenteOrcamento(item, 'classificacao_gerencial'));
                    const saldoAparelhamento = classificacaoGerencial === 'APARELHAMENTO'
                        ? Math.max(0, (Number(item.valorPrevisto ?? item.valorTotal) || 0) - (Number(valorEstimado) || 0))
                        : 0;
                    const processoSei = obterValorPendenteOrcamento(item, 'processo_sei') || item.processoSei;
                    const status = obterValorPendenteOrcamento(item, 'status');
                    const observacao = obterValorPendenteOrcamento(item, 'observacao');
                    const filhosVinculados = obterFilhosVinculadosOrcamento(item.id, budgetData, contextoRenderizacao);
                    const resumoVinculosItem = filhosVinculados.length
                        ? calcularResumoVinculosOrcamento(item, filhosVinculados)
                        : null;
                    const resumoSaldoItem = calcularResumoSaldoVisualOrcamento(item, budgetData, orcamentoMovimentacoes, contextoRenderizacao);

                    return `
                    <tr class="budget-item-row ${rastreioAberto ? 'budget-item-row-open' : ''}">
                        <td data-label="Item" class="align-middle budget-item-cell">
                            ${podeExibirRastreio ? `
                                <button type="button" class="budget-item-title budget-tracking-toggle" data-budget-item-id="${escapeHtml(itemId)}" aria-expanded="${rastreioAberto}" aria-controls="${escapeHtml(idRastreio)}">
                                    <span>${escapeHtml(item.descricao)}</span>
                                    <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                </button>
                            ` : `<div class="budget-item-title budget-item-title-static">${escapeHtml(item.descricao)}</div>`}
                            ${item.processoSei ? `<div class="budget-item-meta">SEI ${escapeHtml(item.processoSei)}</div>` : ''}
                            ${renderizarResumoVinculosNoPaiOrcamento(item, filhosVinculados)}
                        </td>
                        <td data-label="Modalidade/Natureza" class="align-middle">
                            <strong class="d-block">${escapeHtml(item.modalidade || '-')}</strong>
                            <span class="text-muted small">${escapeHtml(item.natureza || '-')}</span>
                        </td>
                        <td data-label="Abrangência/Qtd." class="text-center align-middle">
                            <strong class="d-block">${escapeHtml(item.abrangencia || '-')}</strong>
                            <span class="text-muted small">${escapeHtml(quantidadeUnidade || '-')}</span>
                        </td>
                        <td data-label="Valor previsto" class="text-end font-monospace align-middle fw-bold text-primary">
                            ${formatMoney(resumoSaldoItem.envelopeVisualAjustado)}
                            ${renderizarDetalheEnvelopeOrcamento(resumoSaldoItem)}
                        </td>
                        <td data-label="Em execução" class="align-middle">
                            <div class="budget-execution-cell">
                                <span class="font-monospace fw-bold text-money">${formatMoney(Number(valorEstimado) || 0)}</span>
                                <span class="profor-alert-badge profor-alert-${processoAutuado ? 'success' : 'warning'} budget-execution-badge">${processoAutuado ? 'Autuado' : 'Não autuado'}</span>
                            </div>
                        </td>
                        <td data-label="Classificação" class="text-center align-middle">
                            ${renderizarClassificacaoGerencialOrcamento(classificacaoGerencial, saldoAparelhamento)}
                        </td>
                        <td data-label="Empenhado" class="text-end font-monospace align-middle">${formatMoney(Number(valorEmpenhado) || 0)}</td>
                        <td data-label="Executado" class="text-end font-monospace align-middle">${formatMoney(Number(valorExecutado) || 0)}</td>
                        <td data-label="Status" class="text-center align-middle">
                            ${renderizarStatusOrcamento(status)}
                        </td>
                        <td data-label="Observação" class="align-middle" title="${escapeHtml(observacao)}">
                            <div class="budget-row-note">${escapeHtml(observacao) || '-'}</div>
                        </td>
                        <td data-label="Ações" class="text-center align-middle">
                            <div class="budget-row-actions justify-content-center">
                                ${renderizarLinksOrcamento(item)}
                                ${renderizarBotaoDividirRecursoOrcamento(item)}
                                ${renderizarBotaoAlocarSaldoOrcamento(item, resumoSaldoItem)}
                                ${renderizarBotaoEdicaoOrcamento(item.id)}
                            </div>
                        </td>                    </tr>                    ${renderizarPainelEdicaoOrcamento(item, 11)}
                    ${rastreioAberto ? renderizarRastreioOrcamento(item) : ''}
                    ${renderizarFilhosVinculadosOrcamento(filhosVinculados, budgetData, contextoRenderizacao)}
                `;
                }).join('');

                return `
                    <tr class="budget-group-row">
                        <td colspan="11">
                            <div class="budget-group-heading">
                                <div>
                                    <span class="budget-group-label">Frente</span>
                                    <strong>${escapeHtml(grupo.frente).toLocaleUpperCase('pt-BR')}</strong>
                                </div>
                                <div class="budget-group-metrics">
                                    <span>${grupo.itens.length} item(ns)</span>
                                    <span>${formatMoney(grupo.resumo.total)}</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                    ${renderizarCabecalhoColunasOrcamento()}
                    ${linhas}
                `;
            }).join('');

            registrarEventosRastreioOrcamento(tbody, budgetData);
            registrarEventosCamposOrcamento(budgetData);
            atualizarTabelaOutrosOrcamento(budgetData);
            registrarPerfOrcamento('atualizarTabelaOrcamento', inicioAtualizacao, {
                linhasFiltradas: itensFiltrados.length,
                grupos: grupos.length,
                linhasRenderizadas: grupos.reduce((total, grupo) => total + grupo.itens.length, 0)
            });
        }

        function configurarDelegacaoEventosOrcamento() {
            if (orcamentoEventosDelegadosConfigurados) return;
            orcamentoEventosDelegadosConfigurados = true;

            const resolverEscopoOrcamento = (alvo) => alvo?.closest('#view-orcamento');

            document.addEventListener('click', (event) => {
                const alvo = event.target.closest([
                    '[data-orcamento-toggle-editor]',
                    '[data-orcamento-salvar-linha]',
                    '[data-orcamento-cancelar-linha]',
                    '[data-orcamento-dividir-recurso]',
                    '[data-orcamento-alocar-saldo]',
                    '[data-orcamento-inativar]',
                    '[data-orcamento-remover-novo]',
                    '[data-orcamento-salvar-novo]'
                ].join(','));

                if (!alvo || !resolverEscopoOrcamento(alvo)) return;

                if (alvo.matches('[data-orcamento-toggle-editor]')) {
                    const itemId = String(alvo.dataset.orcamentoToggleEditor);
                    if (orcamentoEditoresAbertos.has(itemId)) {
                        orcamentoEditoresAbertos.delete(itemId);
                    } else {
                        orcamentoEditoresAbertos.add(itemId);
                    }
                    renderOrcamentoView();
                    return;
                }

                if (alvo.matches('[data-orcamento-salvar-linha]')) {
                    abrirModalSenhaOrcamento(alvo.dataset.orcamentoSalvarLinha);
                    return;
                }

                if (alvo.matches('[data-orcamento-cancelar-linha]')) {
                    cancelarEdicaoLinhaOrcamento(alvo.dataset.orcamentoCancelarLinha);
                    return;
                }

                if (alvo.matches('[data-orcamento-dividir-recurso]')) {
                    abrirModalDividirRecursoOrcamento(alvo.dataset.orcamentoDividirRecurso);
                    return;
                }

                if (alvo.matches('[data-orcamento-alocar-saldo]')) {
                    abrirModalAlocarSaldoOrcamento(alvo.dataset.orcamentoAlocarSaldo);
                    return;
                }

                if (alvo.matches('[data-orcamento-inativar]')) {
                    if (!window.confirm('Inativar este processo de interesse? A alteração só será aplicada ao salvar.')) return;
                    orcamentoProcessosInativos.add(alvo.dataset.orcamentoInativar);
                    renderOrcamentoView();
                    return;
                }

                if (alvo.matches('[data-orcamento-remover-novo]')) {
                    orcamentoNovosProcessos = orcamentoNovosProcessos.filter((item) => item.tempId !== alvo.dataset.orcamentoRemoverNovo);
                    renderOrcamentoView();
                    return;
                }

                if (alvo.matches('[data-orcamento-salvar-novo]')) {
                    abrirModalSenhaOrcamento(alvo.dataset.orcamentoSalvarNovo);
                }
            });

            document.addEventListener('change', (event) => {
                const campo = event.target.closest('.budget-edit-control, .budget-other-edit-control, .budget-new-control');
                if (!campo || !resolverEscopoOrcamento(campo)) return;

                if (campo.matches('.budget-new-control')) {
                    atualizarNovoProcessoOrcamento(
                        campo.dataset.orcamentoNovoId,
                        campo.dataset.orcamentoNovoCampo,
                        campo.dataset.orcamentoNovoCampo === 'processo_autuado' ? normalizarBooleanOrcamento(campo.value) : campo.value
                    );
                    renderOrcamentoView();
                    return;
                }

                registrarAlteracaoOrcamento(
                    campo.dataset.orcamentoId,
                    campo.dataset.orcamentoCampo,
                    campo.dataset.orcamentoOriginal,
                    campo.dataset.orcamentoCampo === 'processo_autuado' ? normalizarBooleanOrcamento(campo.value) : campo.value
                );
                renderOrcamentoView();
            });
        }

        function registrarEventosCamposOrcamento() {
            configurarDelegacaoEventosOrcamento();
        }

        function registrarEventosOutrosProcessosOrcamento(budgetData) {
            configurarDelegacaoEventosOrcamento();
            const detalhes = document.getElementById('budget-other-details');
            if (!detalhes) return;

            detalhes.addEventListener('toggle', () => {
                orcamentoOutrosProcessosExpandido = detalhes.open;
                if (detalhes.open) {
                    atualizarTabelaOutrosOrcamento(budgetData);
                }
            });
        }

        function renderizarPainelOutrosProcessosOrcamento(budgetData) {
            const outrosProcessos = (budgetData.outrosProcessos || [])
                .filter((item) => !orcamentoProcessosInativos.has(String(item.id)))
                .filter((item) => !itemEhProcessoVinculadoOrcamento(item));
            const quantidade = outrosProcessos.length;

            return `
                <details class="budget-other-details" id="budget-other-details"${orcamentoOutrosProcessosExpandido ? ' open' : ''}>
                    <summary class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Carregamento sob demanda</p>
                            <h2>Mostrar ou ocultar a tabela de outros processos</h2>
                        </div>
                        <small class="text-muted">${quantidade} processo(s) disponível(is).</small>
                    </summary>
                    <div id="budget-other-content" class="budget-other-content mt-3">
                        ${orcamentoOutrosProcessosExpandido
                            ? '<div class="budget-other-loading text-muted small">Carregando outros processos...</div>'
                            : '<div class="budget-other-placeholder text-muted small">A tabela de outros processos é carregada apenas quando esta seção é aberta.</div>'}
                    </div>
                </details>
            `;
        }

        function atualizarTabelaOutrosOrcamento(budgetData) {
            const inicioAtualizacaoOutros = DEBUG_PERF_ONASP ? performance.now() : 0;
            const details = document.getElementById('budget-other-details');
            const content = document.getElementById('budget-other-content');
            if (!details || !content || !details.open) return;

            const outrosProcessos = (budgetData.outrosProcessos || [])
                .filter((item) => !orcamentoProcessosInativos.has(String(item.id)))
                .filter((item) => !itemEhProcessoVinculadoOrcamento(item)); // Filhos vinculados aparecem junto ao pai na tabela principal
            if (!document.getElementById('budget-other-table-body')) {
                content.innerHTML = `
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table budget-data-table">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-align-left" aria-hidden="true"></i> Descrição</th>
                                    <th><i class="fas fa-folder-open" aria-hidden="true"></i> Processo SEI</th>
                                    <th class="text-end"><i class="fas fa-coins" aria-hidden="true"></i> Valor estimado</th>
                                    <th class="text-center"><i class="fas fa-file-signature" aria-hidden="true"></i> Processo autuado</th>
                                    <th><i class="fas fa-info-circle" aria-hidden="true"></i> Status</th>
                                    <th><i class="fas fa-comment-dots" aria-hidden="true"></i> Observação</th>
                                    <th class="text-end"><i class="fas fa-cogs" aria-hidden="true"></i> Ações</th>
                                </tr>
                            </thead>
                            <tbody id="budget-other-table-body"></tbody>
                        </table>
                    </div>
                `;
            }

            const tbody = document.getElementById('budget-other-table-body');
            if (!tbody) return;

            const linhasExistentes = outrosProcessos.map((item) => {
                const editando = orcamentoItemEmEdicao(item.id);
                const linkedBadge = renderizarBadgeProcessoVinculadoOrcamento(item);
                return `
                <tr>
                    <td data-label="Descrição">
                        <div class="budget-other-description">
                            ${renderizarCampoOutrosOrcamento(item, 'descricao')}
                            ${linkedBadge}
                        </div>
                    </td>
                    <td data-label="Processo SEI">${renderizarCampoOutrosOrcamento(item, 'processo_sei')}</td>
                    <td data-label="Valor estimado" class="text-end font-monospace">${renderizarCampoOutrosOrcamento(item, 'valor_estimado_pesquisa_preco', 'number')}</td>
                    <td data-label="Processo autuado" class="text-center">${renderizarCampoOutrosOrcamento(item, 'processo_autuado')}</td>
                    <td data-label="Status">${renderizarCampoOutrosOrcamento(item, 'status')}</td>
                    <td data-label="Observação">${renderizarCampoOutrosOrcamento(item, 'observacao')}</td>
                    <td data-label="Ações" class="text-center">
                        <div class="budget-row-actions justify-content-center">
                            ${renderizarBotaoEdicaoOrcamento(item.id)}
                            ${editando ? `
                            ${renderActionButton({
                                type: 'save',
                                label: 'Salvar alterações',
                                variant: 'primary',
                                backend: true,
                                disabled: !obterQuantidadeAlteracoesLinhaOrcamento(item.id),
                                title: 'Salvar alterações',
                                iconOnly: true,
                                extraClass: 'budget-row-action',
                                attributes: `data-orcamento-salvar-linha="${escapeHtml(item.id)}"`
                            })}
                            ${renderActionButton({
                                type: 'cancel',
                                label: 'Cancelar edição',
                                variant: 'outline-secondary',
                                backend: true,
                                title: 'Cancelar edição',
                                iconOnly: true,
                                extraClass: 'budget-row-action',
                                attributes: `data-orcamento-cancelar-linha="${escapeHtml(item.id)}"`
                            })}
                            ${renderActionButton({
                                type: 'cancel',
                                label: 'Inativar',
                                variant: 'outline-danger',
                                backend: true,
                                title: 'Inativar',
                                iconOnly: true,
                                extraClass: 'budget-row-action',
                                attributes: `data-orcamento-inativar="${escapeHtml(item.id)}"`
                            })}
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            });
            const linhasNovas = orcamentoNovosProcessos.map(renderizarLinhaNovoProcessoOrcamento);

            tbody.innerHTML = [...linhasExistentes, ...linhasNovas].join('') || `
                <tr><td colspan="7" class="text-center text-muted py-4">Nenhum processo adicional cadastrado.</td></tr>
            `;

            registrarEventosOutrosProcessosOrcamento(budgetData);
            registrarPerfOrcamento('atualizarTabelaOutrosOrcamento', inicioAtualizacaoOutros, {
                linhasOutros: outrosProcessos.length
            });
        }

        function renderizarCampoOutrosOrcamento(item, campo, tipo = 'text') {
            const html = renderizarCampoOrcamento(item, campo, tipo);
            return html.replaceAll('budget-edit-control', 'budget-other-edit-control');
        }

        function cancelarEdicaoLinhaOrcamento(itemId) {
            const id = String(itemId);
            delete orcamentoAlteracoesPendentes[id];
            orcamentoEditoresAbertos.delete(id);
            renderOrcamentoView();
        }

        function adicionarNovoProcessoOrcamento() {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            orcamentoNovosProcessos.push({
                tempId: `novo-${Date.now()}-${orcamentoNovosProcessos.length + 1}`,
                descricao: '',
                processo_sei: '',
                valor_estimado_pesquisa_preco: 0,
                processo_autuado: false,
                status: 'PLANEJADO',
                observacao: ''
            });
            renderOrcamentoView();
        }

        function obterQuantidadeAlteracoesEscopoOrcamento(escopoId = null) {
            if (!escopoId) return obterQuantidadeAlteracoesOrcamento();
            const id = String(escopoId);
            if (id.startsWith('novo-')) {
                return orcamentoNovosProcessos.some((item) => item.tempId === id) ? 1 : 0;
            }
            return obterQuantidadeAlteracoesLinhaOrcamento(id) + (orcamentoProcessosInativos.has(id) ? 1 : 0);
        }

        function abrirModalSenhaOrcamento(escopoId = null) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const totalAlteracoes = obterQuantidadeAlteracoesEscopoOrcamento(escopoId);
            if (!totalAlteracoes) {
                alert('Não há alterações para salvar.');
                return;
            }

            removerModalOnasp('modalSenhaOrcamento');
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="modalSenhaOrcamento" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Confirmar alterações</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <p>Você está prestes a salvar ${totalAlteracoes} alteração(ões) no Orçamento 2026.</p>
                                <label class="form-label" for="senhaOrcamento">Senha de confirmação</label>
                                <input type="password" class="form-control" id="senhaOrcamento" autocomplete="current-password">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'confirmarSalvarOrcamento',
                                    type: 'save',
                                    label: 'Confirmar e salvar',
                                    variant: 'primary',
                                    backend: true
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `);

            const modalElement = document.getElementById('modalSenhaOrcamento');
            const modal = new window.bootstrap.Modal(modalElement);
            modal.show();
            document.getElementById('confirmarSalvarOrcamento')?.addEventListener('click', async () => {
                await salvarOrcamentoComSenha(document.getElementById('senhaOrcamento')?.value || '', modal, escopoId);
            });
        }

        async function salvarOrcamentoComSenha(password, modal, escopoId = null) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            try {
                const idEscopo = escopoId ? String(escopoId) : null;
                const processosNovosParaSalvar = idEscopo?.startsWith('novo-')
                    ? orcamentoNovosProcessos.filter((item) => item.tempId === idEscopo)
                    : orcamentoNovosProcessos;
                const novos = processosNovosParaSalvar.map((item) => ({
                    descricao: item.descricao,
                    processo_sei: item.processo_sei,
                    valor_estimado_pesquisa_preco: item.valor_estimado_pesquisa_preco,
                    processo_autuado: item.processo_autuado,
                    status: item.status,
                    observacao: item.observacao
                }));
                const changes = idEscopo && !idEscopo.startsWith('novo-')
                    ? (orcamentoAlteracoesPendentes[idEscopo] ? { [idEscopo]: orcamentoAlteracoesPendentes[idEscopo] } : {})
                    : orcamentoAlteracoesPendentes;
                const inativos = idEscopo && !idEscopo.startsWith('novo-')
                    ? (orcamentoProcessosInativos.has(idEscopo) ? [idEscopo] : [])
                    : Array.from(orcamentoProcessosInativos);
                const { resposta, payload } = await fetchJsonApiOnasp('/api/orcamento-2026/salvar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password,
                        changes,
                        novos,
                        inativos
                    })
                });

                if (!resposta.ok || !payload.success) {
                    alert(payload.message || 'Não foi possível salvar.');
                    return;
                }

                if (idEscopo) {
                    delete orcamentoAlteracoesPendentes[idEscopo];
                    orcamentoEditoresAbertos.delete(idEscopo);
                    orcamentoNovosProcessos = orcamentoNovosProcessos.filter((item) => item.tempId !== idEscopo);
                    orcamentoProcessosInativos.delete(idEscopo);
                } else {
                    orcamentoAlteracoesPendentes = {};
                    orcamentoEditoresAbertos = new Set();
                    orcamentoNovosProcessos = [];
                    orcamentoProcessosInativos = new Set();
                }
                modal.hide();
                await carregarDadosOrcamento(true);
                await carregarMovimentacoesOrcamento2026();
                renderOrcamentoView();
                alert(obterMensagemSalvamento(payload));
            } catch (error) {
                alert(`Não foi possível salvar: ${error.message}`);
            }
        }

        function renderizarCamposEdicaoRastreioOrcamento(item, campos) {
            return campos.map(({ campo, rotulo, tipo = 'text' }) => `
                <label>
                    <span>${escapeHtml(rotulo)}</span>
                    ${renderizarCampoOrcamento(item, campo, tipo)}
                </label>
            `).join('');
        }

        function renderizarSecaoEdicaoRastreioOrcamento(item, titulo, campos) {
            if (!campos.length) return '';

            return `
                <section class="budget-edit-section">
                    <div class="budget-edit-section-header">
                        <strong>${escapeHtml(titulo)}</strong>
                    </div>
                    <div class="budget-edit-grid budget-edit-grid-tracking">
                        ${renderizarCamposEdicaoRastreioOrcamento(item, campos)}
                    </div>
                </section>
            `;
        }

        async function abrirHistoricoOrcamento() {
            try {
                const { payload } = await fetchJsonApiOnasp('/api/orcamento-2026/historico');
                const historico = payload.historico || [];
                removerModalOnasp('modalHistoricoOrcamento');
                document.body.insertAdjacentHTML('beforeend', `
                    <div class="modal fade" id="modalHistoricoOrcamento" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-lg modal-dialog-scrollable">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Histórico do Orçamento 2026</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                                </div>
                                <div class="modal-body">
                                    ${historico.length ? `
                                        <div class="table-responsive">
                                            <table class="table table-sm app-data-table">
                                                <thead><tr><th>Data</th><th>Registro</th><th>Campo</th><th>Anterior</th><th>Novo</th></tr></thead>
                                                <tbody>
                                                    ${historico.map((item) => `
                                                        <tr>
                                                            <td>${escapeHtml(item.alteradoEm ? new Date(item.alteradoEm).toLocaleString('pt-BR') : '')}</td>
                                                            <td>${escapeHtml(item.registro || '')}</td>
                                                            <td>${escapeHtml(item.campo || '')}</td>
                                                            <td>${escapeHtml(item.valorAnterior || '')}</td>
                                                            <td>${escapeHtml(item.valorNovo || '')}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    ` : '<div class="diagnostico-empty-state">Nenhuma alteração registrada.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                new window.bootstrap.Modal(document.getElementById('modalHistoricoOrcamento')).show();
            } catch (error) {
                alert(`Não foi possível carregar o histórico: ${error.message}`);
            }
        }

        function renderOrcamentoView() {
            const container = document.getElementById('view-orcamento');
            if (!container) return;
            const inicioRenderOrcamento = DEBUG_PERF_ONASP ? performance.now() : 0;

            container.style.display = 'block';
            container.innerHTML = '';
            orcamentoItensRastreioAbertos = new Set();
            if (dadosPaginaEmModoEstatico('orcamento2026')) {
                orcamentoAlteracoesPendentes = {};
                orcamentoEditoresAbertos = new Set();
                orcamentoNovosProcessos = [];
                orcamentoProcessosInativos = new Set();
            }

            const budgetData = obterDadosOrcamento();
            if (!budgetData) {
                container.innerHTML = renderErrorState({
                    titulo: VIEW_ERROR_MESSAGES.orcamento.titulo,
                    detalhe: VIEW_ERROR_MESSAGES.orcamento.detalhe,
                    error: erroCarregamentoOrcamento
                });
                container.style.display = 'block';
                aplicarModoSomenteLeitura();
                return;
            }

            const itensOrcamento = Array.isArray(budgetData?.itens) ? budgetData.itens : [];
            if (itensOrcamento.length === 0) {
                container.innerHTML = renderEmptyState({
                    titulo: 'Nenhum item orçamentário disponível.',
                    descricao: 'Verifique se os dados foram carregados ou publicados corretamente.',
                    icon: 'fa-wallet'
                });
                container.style.display = 'block';
                aplicarModoSomenteLeitura();
                return;
            }

            const sequenciaRenderizacao = ++orcamentoRenderizacaoSequencia;

            const resumo = budgetData.resumo || {};
            const filtros = budgetData.filtros || { status: [], naturezas: [], modalidades: [] };
            const valorEmExecucao = resumo.valorEmExecucao ?? resumo.totalEmExecucao ?? 0;
            const valorEmpenhado = resumo.valorEmpenhado ?? resumo.totalEmpenhado ?? 0;
            const valorExecutado = resumo.valorExecutado ?? resumo.totalExecutado ?? 0;
            const saldoPlanejado = resumo.saldoPlanejado ?? ((resumo.totalOrcamento || resumo.totalGeral || 0) - valorEmExecucao);
            const processosAutuados = resumo.processosAutuados || 0;
            const inicioResumoAparelhamento = DEBUG_PERF_ONASP ? performance.now() : 0;
            const resumoAparelhamento = budgetData.resumoAparelhamento || calcularResumoAparelhamentoFrontend(itensOrcamento);
            const totalOrcamento = resumo.totalOrcamento ?? resumo.totalGeral ?? 0;
            const percentualEmExecucao = totalOrcamento > 0 ? valorEmExecucao / totalOrcamento : 0;
            const saldoAparelhamento = Number(resumoAparelhamento.saldoAparelhamento || 0);
            const notaSaldoAparelhamento = saldoAparelhamento > 0
                ? `
                    <div class="budget-management-note budget-management-note-info">
                        <strong>Saldo gerencial de aparelhamento disponível:</strong> ${formatMoney(saldoAparelhamento)}.
                        <span>Saldo gerencial calculado pela diferença entre previsto e valor em execução.</span>
                    </div>
                `
                : '';

            container.innerHTML = `
                <section class="dashboard-intro budget-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Planejamento anual</p>
                        <h2>Planejamento Orçamentário 2026</h2>
                    </div>
                    <div class="intro-badges" aria-label="Resumo da base de orçamento">
                        <span><i class="fas fa-layer-group" aria-hidden="true"></i> ${resumo.porFrente?.length || 0} frentes</span>
                        <span><i class="fas fa-list-ol" aria-hidden="true"></i> ${resumo.totalItens || 0} itens</span>
                        <span><i class="fas fa-table" aria-hidden="true"></i> Orçamento 2026</span>
                    </div>
                </section>

                ${renderizarAcoesOrcamento()}

                <section class="budget-summary-section mb-4" aria-label="Seção Orçamento 2026">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Seção 1</p>
                            <h2>Orçamento 2026</h2>
                        </div>
                    </div>
                </section>
                <section class="row mb-2 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3" aria-label="Indicadores orçamentários">
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Total do orçamento',
                            valor: `<span class="text-money text-success">${formatMoney(totalOrcamento)}</span>`,
                            descricao: 'Orçamento oficial ONASP',
                            icon: 'fa-wallet',
                            variant: 'success'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Valor em execução',
                            valor: `<span class="text-money text-warning">${formatMoney(valorEmExecucao)}</span>`,
                            descricao: 'Base gerencial das pesquisas de preço',
                            icon: 'fa-hourglass-half',
                            variant: 'warning'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Saldo planejado',
                            valor: `<span class="text-money">${formatMoney(saldoPlanejado)}</span>`,
                            descricao: `${processosAutuados} processo(s) autuado(s)`,
                            icon: 'fa-vault'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Processos autuados',
                            valor: `<span>${processosAutuados}</span>`,
                            descricao: 'Itens com autuação registrada',
                            icon: 'fa-folder-open',
                            variant: 'info'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Percentual em execução',
                            valor: `<span>${formatPercent(percentualEmExecucao)}</span>`,
                            descricao: 'Valor em execução / orçamento total',
                            icon: 'fa-chart-line',
                            variant: 'info'
                        })}
                    </div>
                </section>
                <div class="budget-management-note mb-4">
                    Considera processos autuados com valor de pesquisa de preço informado, excluídos itens cancelados ou suspensos.
                </div>

                <section class="budget-equipment-section mb-4" aria-label="Indicadores de aparelhamento">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Seção 2</p>
                            <h2>Aparelhamento</h2>
                        </div>
                    </div>
                    <div class="row row-cols-1 row-cols-md-2 row-cols-xl-5 g-3">
                        <div class="col">
                            ${renderKpiCard({
                                titulo: 'Previsto em aparelhamento',
                                valor: `<span class="text-money text-success">${formatMoney(resumoAparelhamento.previstoAparelhamento || 0)}</span>`,
                                icon: 'fa-boxes-stacked',
                                variant: 'success'
                            })}
                        </div>
                        <div class="col">
                            ${renderKpiCard({
                                titulo: 'Em execução em aparelhamento',
                                valor: `<span class="text-money text-warning">${formatMoney(resumoAparelhamento.emExecucaoAparelhamento || 0)}</span>`,
                                icon: 'fa-hourglass-half',
                                variant: 'warning'
                            })}
                        </div>
                        <div class="col">
                            ${renderKpiCard({
                                titulo: 'Saldo de aparelhamento',
                                valor: `<span class="text-money">${formatMoney(resumoAparelhamento.saldoAparelhamento || 0)}</span>`,
                                descricao: 'Leitura gerencial do bloco classificado',
                                icon: 'fa-vault'
                            })}
                        </div>
                        <div class="col">
                            ${renderKpiCard({
                                titulo: 'Itens de aparelhamento',
                                valor: `<span class="text-info">${resumoAparelhamento.quantidadeItensAparelhamento || 0}</span>`,
                                icon: 'fa-list-check',
                                variant: 'info'
                            })}
                        </div>
                        <div class="col">
                            ${renderKpiCard({
                                titulo: 'Pendentes de pesquisa',
                                valor: `<span class="text-warning">${resumoAparelhamento.quantidadePendentesPesquisaPreco || 0}</span>`,
                                icon: 'fa-tags',
                                variant: 'warning'
                            })}
                        </div>
                    </div>
                    ${notaSaldoAparelhamento}
                </section>

                <section class="filter-section mb-4" aria-label="Filtros da tabela de orçamento">
                    <div class="filter-toolbar">
                        <div class="filter-title">
                            <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                            <strong>Filtros</strong>
                        </div>
                        <div class="filter-search-actions">
                            <input type="text" id="filtroOrcamentoBusca" class="form-control" placeholder="Buscar por item, modalidade, status ou SEI..." aria-label="Buscar orçamento">
                            <button id="btnLimparFiltroOrcamento" type="button" class="btn btn-outline-secondary btn-icon-text">
                                <i class="fas fa-undo" aria-hidden="true"></i>
                                <span>Limpar</span>
                            </button>
                        </div>
                    </div>

                    <div class="budget-filter-grid">
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroOrcamentoStatus">Status</label>
                            <select id="filtroOrcamentoStatus" class="form-select budget-filter-control">
                                <option value="">Todos</option>
                                ${renderizarOpcoesFiltroOrcamento(filtros.status)}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroOrcamentoNatureza">Natureza</label>
                            <select id="filtroOrcamentoNatureza" class="form-select budget-filter-control">
                                <option value="">Todas</option>
                                ${renderizarOpcoesFiltroOrcamento(filtros.naturezas)}
                            </select>
                        </div>
                        <div class="visible-filter-group">
                            <label class="visible-filter-title" for="filtroOrcamentoModalidade">Modalidade</label>
                            <select id="filtroOrcamentoModalidade" class="form-select budget-filter-control">
                                <option value="">Todas</option>
                                ${renderizarOpcoesFiltroOrcamento(filtros.modalidades)}
                            </select>
                        </div>
                    </div>
                </section>

                <section class="budget-insight-grid budget-insight-grid-four mb-4" aria-label="Resumo da seleção orçamentária">
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Filtrado</div>
                            <div class="kpi-value text-money" id="budget-selected-total">R$ 0,00</div>
                        </div>
                        <i class="fas fa-calculator card-watermark" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Atualmente em execução</div>
                            <div class="kpi-value text-money text-warning" id="budget-selected-running">R$ 0,00</div>
                        </div>
                        <i class="fas fa-file-invoice-dollar card-watermark text-warning" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Empenhado</div>
                            <div class="kpi-value text-money text-info" id="budget-selected-committed">R$ 0,00</div>
                        </div>
                        <i class="fas fa-building-columns card-watermark text-info" aria-hidden="true"></i>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Executado</div>
                            <div class="kpi-value text-money text-success" id="budget-selected-executed">R$ 0,00</div>
                        </div>
                        <i class="fas fa-check-circle card-watermark text-success" aria-hidden="true"></i>
                    </div>
                </section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <h2>Itens do Orçamento 2026</h2>
                            <p class="section-eyebrow mb-0">Itens orçamentários</p>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table budget-data-table budget-main-table">
                            <colgroup>
                                <col class="budget-col-item">
                                <col class="budget-col-modalidade">
                                <col class="budget-col-abrangencia">
                                <col class="budget-col-previsto">
                                <col class="budget-col-execucao">
                                <col class="budget-col-classificacao">
                                <col class="budget-col-empenhado">
                                <col class="budget-col-executado">
                                <col class="budget-col-status">
                            <col class="budget-col-observacao">
                            <col class="budget-col-acoes">
                        </colgroup>
                        <tbody id="budget-table-body">
                            <tr>
                                <td colspan="11" class="py-4 text-center text-muted">
                                    Carregando itens do orçamento...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Processos relacionados</p>
                            <h2>Outros processos de interesse da Ouvidoria</h2>
                        </div>
                        ${renderActionButton({
                            id: 'btnAdicionarOutroProcesso',
                            type: 'add',
                            label: 'Adicionar processo',
                            variant: 'outline-primary',
                            backend: true,
                            disabled: dadosPaginaEmModoEstatico('orcamento2026'),
                            extraClass: 'pdf-hidden'
                        })}
                    </div>
                    ${renderizarPainelOutrosProcessosOrcamento(budgetData)}
                </section>
            `;
            registrarPerfOrcamento('renderOrcamentoView:resumoAparelhamento', inicioResumoAparelhamento, {
                itens: itensOrcamento.length,
                calculadoLocalmente: !budgetData.resumoAparelhamento
            });
            registrarPerfOrcamento('renderOrcamentoView:container.innerHTML', inicioRenderOrcamento, {
                itens: itensOrcamento.length,
                outrosProcessos: Array.isArray(budgetData.outrosProcessos) ? budgetData.outrosProcessos.length : 0
            });

            const atualizar = () => {
                atualizarTabelaOrcamento(budgetData);
                if (orcamentoOutrosProcessosExpandido) {
                    atualizarTabelaOutrosOrcamento(budgetData);
                }
            };
            const atualizarDebounced = debounceOnasp(atualizar, 180);
            if (!dadosPaginaEmModoEstatico('orcamento2026')) {
                document.getElementById('btnExportarOrcamentoExcel')?.addEventListener('click', () => {
                    if (obterQuantidadeAlteracoesOrcamento()) {
                        alert('Existem alterações não salvas. Salve antes de exportar para que o Excel reflita os dados atualizados.');
                        return;
                    }
                    window.location.href = obterUrlApiOnasp('/api/orcamento-2026/exportar');
                });
                document.getElementById('btnHistoricoOrcamento')?.addEventListener('click', abrirHistoricoOrcamento);
                document.getElementById('btnAdicionarOutroProcesso')?.addEventListener('click', adicionarNovoProcessoOrcamento);
            }
            document.getElementById('budget-other-details')?.addEventListener('toggle', () => {
                const detalhes = document.getElementById('budget-other-details');
                orcamentoOutrosProcessosExpandido = Boolean(detalhes?.open);
                if (orcamentoOutrosProcessosExpandido) {
                    atualizarTabelaOutrosOrcamento(budgetData);
                }
            });
            document.getElementById('filtroOrcamentoBusca')?.addEventListener('input', atualizarDebounced);
            document.querySelectorAll('.budget-filter-control').forEach((controle) => {
                controle.addEventListener('change', atualizar);
            });
            document.getElementById('btnLimparFiltroOrcamento')?.addEventListener('click', () => {
                document.getElementById('filtroOrcamentoBusca').value = '';
                document.querySelectorAll('.budget-filter-control').forEach((controle) => {
                    controle.value = '';
                });
                atualizar();
            });

            container.style.display = 'block';
            aplicarModoSomenteLeitura();

            requestAnimationFrame(() => {
                if (sequenciaRenderizacao !== orcamentoRenderizacaoSequencia) return;
                const inicioTabela = DEBUG_PERF_ONASP ? performance.now() : 0;
                atualizarTabelaOrcamento(budgetData);
                registrarPerfOrcamento('renderOrcamentoView:atualizarTabelaOrcamento', inicioTabela, {
                    linhasPrincipais: Array.isArray(budgetData?.itens) ? budgetData.itens.length : 0
                });
                if (orcamentoOutrosProcessosExpandido) {
                    requestAnimationFrame(() => {
                        if (sequenciaRenderizacao !== orcamentoRenderizacaoSequencia) return;
                        const inicioOutros = DEBUG_PERF_ONASP ? performance.now() : 0;
                        atualizarTabelaOutrosOrcamento(budgetData);
                        registrarPerfOrcamento('renderOrcamentoView:atualizarTabelaOutros', inicioOutros, {
                            linhasOutros: Array.isArray(budgetData?.outrosProcessos) ? budgetData.outrosProcessos.length : 0
                        });
                    });
                }
            });
        }

        function renderOrcamentoViewSkeleton() {
            const container = document.getElementById('view-orcamento');
            if (!container) return;

            configurarDelegacaoEventosOrcamento();
            container.style.display = 'block';
            container.innerHTML = `
                <section class="dashboard-intro budget-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Planejamento anual</p>
                        <h2>Planejamento Orçamentário 2026</h2>
                    </div>
                    <div class="intro-badges" aria-label="Resumo da base de orçamento">
                        <span><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Carregando orçamento...</span>
                    </div>
                </section>

                <div class="budget-management-note mb-4">
                    Carregando dados do orçamento. A tabela principal será exibida assim que a base estiver pronta.
                </div>

                <section class="budget-insight-grid budget-insight-grid-four mb-4" aria-label="Resumo da seleção orçamentária">
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Filtrado</div>
                            <div class="kpi-value text-money">...</div>
                        </div>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Atualmente em execução</div>
                            <div class="kpi-value text-money text-warning">...</div>
                        </div>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Empenhado</div>
                            <div class="kpi-value text-money text-info">...</div>
                        </div>
                    </div>
                    <div class="card kpi-card dynamic-card budget-insight-card py-2">
                        <div>
                            <div class="kpi-title mb-0">Valor Executado</div>
                            <div class="kpi-value text-money text-success">...</div>
                        </div>
                    </div>
                </section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <h2>Itens do Orçamento 2026</h2>
                            <p class="section-eyebrow mb-0">Carregando itens...</p>
                        </div>
                    </div>
                    <div class="budget-loading-state py-4 text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>
                        Preparando a tabela principal...
                    </div>
                </section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Processos relacionados</p>
                            <h2>Outros processos de interesse da Ouvidoria</h2>
                        </div>
                        ${renderActionButton({
                            id: 'btnAdicionarOutroProcesso',
                            type: 'add',
                            label: 'Adicionar processo',
                            variant: 'outline-primary',
                            backend: true,
                            disabled: true,
                            extraClass: 'pdf-hidden'
                        })}
                    </div>
                    <div class="budget-loading-state py-4 text-center text-muted">
                        <i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>
                        A tabela de outros processos será carregada sob demanda.
                    </div>
                </section>
            `;

            aplicarModoSomenteLeitura();
        }

        // Exporta o relatório a partir do HTML renderizado. Elementos marcados
        // como pdf-hidden são ocultados por CSS durante a captura.
        // ========================================================================
        // EXPORTACOES
        // ========================================================================

        async function exportarOrcamentoPDF() {
            let budgetData = obterDadosOrcamento();
            if (!budgetData) {
                showLoading('Carregando Orçamento 2026...');
                try {
                    budgetData = await carregarDadosOrcamento();
                } finally {
                    hideLoading();
                }
            }

            if (!budgetData) {
                mostrarAlertaCarregamentoPlanilha(
                    'Dados orçamentários indisponíveis: não foi possível carregar a planilha de orçamento.',
                    false,
                    'warning'
                );
                return;
            }

            const btnPdf = document.getElementById('btn-export-budget-pdf');
            const originalHtml = btnPdf?.innerHTML || '';
            const originalDisabled = btnPdf?.disabled || false;

            if (btnPdf) {
                btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Gerando PDF...';
                btnPdf.disabled = true;
            }

            fecharMenuLateral();
            showLoading('Gerando PDF do orçamento 2026...');

            const viewOriginal = document.body.dataset.currentView || 'dashboard';
            if (viewOriginal !== 'orcamento') {
                await toggleView('orcamento');
                await new Promise(resolve => setTimeout(resolve, 120));
            }

            const elementoParaCapturar = document.getElementById('main-wrapper');
            const viewOrcamento = document.getElementById('view-orcamento');
            const headerActions = document.getElementById('header-actions');
            const originalHeaderActionsDisplay = headerActions?.style.display || '';
            const originalWidth = elementoParaCapturar.style.width;
            const originalMargin = elementoParaCapturar.style.margin;
            const originalOrcamentoWidth = viewOrcamento?.style.width || '';

            document.body.classList.add('is-exporting');
            document.body.classList.add('is-exporting-budget');
            if (headerActions) headerActions.style.display = 'none';
            elementoParaCapturar.style.width = '1200px';
            elementoParaCapturar.style.margin = '0';
            if (viewOrcamento) viewOrcamento.style.width = '1200px';

            try {
                const canvas = await html2canvas(elementoParaCapturar, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f3f6fa',
                    windowWidth: 1200
                });

                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgHeightOnPdf = (canvas.height * pdfWidth) / canvas.width;

                let heightLeft = imgHeightOnPdf;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightOnPdf);
                heightLeft -= pageHeight;

                while (heightLeft > 0) {
                    position -= pageHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightOnPdf);
                    heightLeft -= pageHeight;
                }

                pdf.save('Relatorio_Orcamento_2026_ONASP.pdf');
            } catch (erro) {
                console.error('Erro na exportação do orçamento para PDF:', erro);
                mostrarAlertaCarregamentoPlanilha(
                    'Não foi possível gerar o PDF do orçamento. Tente novamente.',
                    false,
                    'danger'
                );
            } finally {
                document.body.classList.remove('is-exporting');
                document.body.classList.remove('is-exporting-budget');
                if (headerActions) headerActions.style.display = originalHeaderActionsDisplay;
                elementoParaCapturar.style.width = originalWidth;
                elementoParaCapturar.style.margin = originalMargin;
                if (viewOrcamento) viewOrcamento.style.width = originalOrcamentoWidth;
                if (btnPdf) {
                    btnPdf.innerHTML = originalHtml;
                    btnPdf.disabled = originalDisabled;
                }
                if (viewOriginal !== 'orcamento') {
                    await toggleView(viewOriginal);
                }
                hideLoading();
            }
        }

        async function exportarDashboardPDF() {
            if (!dadosFinanceirosValidados) {
                mostrarAlertaCarregamentoPlanilha(
                    'Nao e possivel exportar: a planilha ainda nao foi carregada ou validada.',
                    true,
                    'danger'
                );
                return;
            }

            const btnPdf = document.getElementById('btn-export-dashboard');
            const originalHtml = btnPdf.innerHTML;
            const originalDisabled = btnPdf.disabled;
            
            // Estado de carregamento visual no botão
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Gerando PDF...';
            btnPdf.disabled = true;

            fecharMenuLateral();
            showLoading('Gerando PDF do Painel... (Isso pode levar alguns segundos)');

            const viewOriginal = document.body.dataset.currentView || 'dashboard';
            if (viewOriginal !== 'dashboard') {
                toggleView('dashboard');
                await new Promise(resolve => setTimeout(resolve, 80));
            }

            // Em vez de capturar apenas a div do dashboard, capturamos o wrapper principal inteiro
            const elementoParaCapturar = document.getElementById('main-wrapper');
            const headerActions = document.getElementById('header-actions');
            const filterRow = document.getElementById('filter-row-section');
            const originalHeaderActionsDisplay = headerActions?.style.display || '';
            const originalFilterRowDisplay = filterRow?.style.display || '';

            // 1. Esconde a linha de botões de filtro e do cabeçalho temporariamente para um PDF mais limpo
            document.body.classList.add('is-exporting');
            if (headerActions) {
                headerActions.style.display = 'none';
            }
            if (filterRow) filterRow.style.display = 'none';

            // 2. O DataTables usa scrollY, o que esconde as linhas num container pequeno.
            // Para o PDF capturar tudo, removemos o limite de altura temporariamente.
            const dtScrollBody = document.querySelector('.dataTables_scrollBody');
            let originalMaxHeight = '';
            let originalHeight = '';
            let originalOverflow = '';
            if (dtScrollBody) {
                originalMaxHeight = dtScrollBody.style.maxHeight;
                originalHeight = dtScrollBody.style.height;
                originalOverflow = dtScrollBody.style.overflow;
                dtScrollBody.style.maxHeight = 'none';
                dtScrollBody.style.height = 'auto';
                dtScrollBody.style.overflow = 'visible';
            }

            // 3. FIX DE MARGENS LATERAIS: Força a largura do wrapper para 1200px durante a captura. 
            // Isso evita que o html2canvas tire print de telas muito largas, o que causava as margens enormes.
            const originalWidth = elementoParaCapturar.style.width;
            const originalMargin = elementoParaCapturar.style.margin;
            elementoParaCapturar.style.width = '1200px';
            elementoParaCapturar.style.margin = '0';

            try {
                // Renderiza a Div exata como uma Imagem usando html2canvas
                const canvas = await html2canvas(elementoParaCapturar, {
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: '#f8f9fa',
                    windowWidth: 1200 // Instrui o canvas a renderizar com largura fixa
                });

                // Restaura imediatamente a largura do layout original após a captura
                elementoParaCapturar.style.width = originalWidth;
                elementoParaCapturar.style.margin = originalMargin;

                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;
                
                // Criação do PDF em orientação Retrato (p), milímetros (mm), tamanho A4
                const pdf = new jsPDF('p', 'mm', 'a4');
                
                const margin = 0; // Margens laterais zeradas - o PDF vai ocupar toda a largura da folha
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                
                const usableWidth = pdfWidth - (margin * 2); // Subtrai margens laterais
                const usablePageHeight = pageHeight - (margin * 2); // Subtrai margens superior/inferior
                
                const imgHeightOnPdf = (canvas.height * usableWidth) / canvas.width;
                
                let heightLeft = imgHeightOnPdf;
                let position = margin; // Inicia na margem superior

                pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeightOnPdf);
                heightLeft -= usablePageHeight;

                while (heightLeft > 0) {
                    position -= usablePageHeight; // Desloca a imagem para cima na nova página
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeightOnPdf);
                    heightLeft -= usablePageHeight;
                }

                pdf.save(`Painel_Geral_Ouvidoria.pdf`);

            } catch (erro) {
                console.error('Erro na exportação do Dashboard para PDF:', erro);
                // Em caso de erro, garante que o layout é restaurado
                elementoParaCapturar.style.width = originalWidth;
                elementoParaCapturar.style.margin = originalMargin;
            } finally {
                // 4. Restaura o layout original (filtros e scroll da tabela)
                document.body.classList.remove('is-exporting');
                if (headerActions) {
                    headerActions.style.display = originalHeaderActionsDisplay;
                }
                if (filterRow) filterRow.style.display = originalFilterRowDisplay;
                if (dtScrollBody) {
                    dtScrollBody.style.maxHeight = originalMaxHeight;
                    dtScrollBody.style.height = originalHeight;
                    dtScrollBody.style.overflow = originalOverflow;
                }
                
                btnPdf.innerHTML = originalHtml;
                btnPdf.disabled = originalDisabled;
                if (viewOriginal !== 'dashboard') {
                    toggleView(viewOriginal);
                }
            hideLoading();
            }
        }

        async function exportarRelatorioPDF() {
            if (!dadosFinanceirosValidados) {
                mostrarAlertaCarregamentoPlanilha(
                    'Nao e possivel exportar: a planilha ainda nao foi carregada ou validada.',
                    true,
                    'danger'
                );
                return;
            }

            if ((document.body.dataset.currentView || '') !== 'estado-detalhe' || !estadoAtualPDF) {
                mostrarAlertaCarregamentoPlanilha(
                    'Abra um relatório estadual antes de exportar o PDF do estado.',
                    false,
                    'info'
                );
                return;
            }

            const btnPdf = document.getElementById('btn-export-pdf');
            const originalHtml = btnPdf.innerHTML;
            const originalDisabled = btnPdf.disabled;
            
            // Estado de carregamento visual no botão
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Gerando PDF...';
            btnPdf.disabled = true;

            fecharMenuLateral();
            showLoading(`Gerando PDF de ${estadoAtualPDF}...`);

            // Agora capturamos o wrapper inteiro (incluindo o header global do app)
            const elementoParaCapturar = document.getElementById('main-wrapper');
            const botoesAcaoRelatorio = document.getElementById('botoes-acao-relatorio');
            const originalBotoesAcaoDisplay = botoesAcaoRelatorio?.style.display || '';

            document.body.classList.add('is-exporting');
            if (botoesAcaoRelatorio) botoesAcaoRelatorio.style.display = 'none';

            // FIX DE MARGENS LATERAIS PARA RELATÓRIO
            const originalWidth = elementoParaCapturar.style.width;
            const originalMargin = elementoParaCapturar.style.margin;
            elementoParaCapturar.style.width = '1200px';
            elementoParaCapturar.style.margin = '0';

            try {
                // Renderiza a Div exata como uma Imagem usando html2canvas
                const canvas = await html2canvas(elementoParaCapturar, {
                    scale: 2, // Escala 2 garante alta definição no PDF
                    useCORS: true, // Permite que a bandeira (SVG externo) seja carregada na imagem
                    backgroundColor: '#f8f9fa', // Garante que a cor de fundo seja preservada
                    windowWidth: 1200
                });

                elementoParaCapturar.style.width = originalWidth;
                elementoParaCapturar.style.margin = originalMargin;

                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;
                
                // Criação do PDF em orientação Retrato (p), milímetros (mm), tamanho A4
                const pdf = new jsPDF('p', 'mm', 'a4');
                
                const margin = 0; // MARGENS ZERADAS
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                
                const usableWidth = pdfWidth - (margin * 2); 
                const usablePageHeight = pageHeight - (margin * 2); 
                
                const imgHeightOnPdf = (canvas.height * usableWidth) / canvas.width;
                
                let heightLeft = imgHeightOnPdf;
                let position = margin; // Inicia na margem superior

                pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeightOnPdf);
                heightLeft -= usablePageHeight;

                while (heightLeft > 0) {
                    position -= usablePageHeight; // Desloca a imagem para cima na nova página
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeightOnPdf);
                    heightLeft -= usablePageHeight;
                }

                // Baixa o arquivo já com o nome do Estado específico
                pdf.save(`Relatorio_Ouvidoria_${estadoAtualPDF}.pdf`);

            } catch (erro) {
                console.error('Erro na exportação para PDF:', erro);
                elementoParaCapturar.style.width = originalWidth;
                elementoParaCapturar.style.margin = originalMargin;
            } finally {
                // Restaura o botão à sua forma original
                document.body.classList.remove('is-exporting');
                if (botoesAcaoRelatorio) botoesAcaoRelatorio.style.display = originalBotoesAcaoDisplay;
                btnPdf.innerHTML = originalHtml;
                btnPdf.disabled = originalDisabled;
            hideLoading();
            }
        }

        // ========================================================================
        // PARAMETROS MINIMOS
        // ========================================================================
        function obterFiltrosDiagnosticoOuvidorias() {
            return {
                uf: diagnosticoUfAtual || '',
                unidade: '',
                statusGeral: '',
                eixo: '',
                statusParametro: '',
                validacao: '',
                deficit: ''
            };
        }

        function aplicarFiltrosDiagnosticoOuvidorias(respostas, filtros = obterFiltrosDiagnosticoOuvidorias()) {
            return respostas.filter((resposta) => {
                const parametros = resposta.parametrosMinimos || [];
                const possuiDeficit = parametros.some((item) => Number(item.deficit) > 0);
                const passaUf = !filtros.uf || resposta.uf === filtros.uf;
                const passaUnidade = !filtros.unidade || resposta.idResposta === filtros.unidade;
                const passaStatusGeral = !filtros.statusGeral || resposta.statusGeralParametrosMinimos === filtros.statusGeral;
                const passaEixo = !filtros.eixo || parametros.some((item) => item.trilha === filtros.eixo || item.eixo === filtros.eixo);
                const passaStatusParametro = !filtros.statusParametro
                    || parametros.some((item) => item.statusNormalizado === filtros.statusParametro || normalizarBusca(item.statusNormalizado).includes(normalizarBusca(filtros.statusParametro)));
                const passaValidacao = !filtros.validacao || parametros.some((item) => item.validacaoOnasp === filtros.validacao);
                const passaDeficit = !filtros.deficit
                    || (filtros.deficit === 'com-deficit' && possuiDeficit)
                    || (filtros.deficit === 'sem-deficit' && !possuiDeficit);

                return passaUf
                    && passaUnidade
                    && passaStatusGeral
                    && passaEixo
                    && passaStatusParametro
                    && passaValidacao
                    && passaDeficit;
            });
        }

        function obterClasseStatusDiagnostico(status) {
            const texto = normalizarBusca(status);
            if (texto === 'completo') return 'success';
            if (texto === 'pendente') return 'danger';
            if (texto.includes('tem') && !texto.includes('nao')) return 'success';
            if (texto.includes('deficit') || texto.includes('falta') || texto.includes('nao tem') || texto.includes('nao conforme')) return 'danger';
            if (texto.includes('validar') || texto.includes('pendente')) return 'info';
            if ((texto.includes('conforme') || texto.includes('conformidade')) && !texto.includes('parcial') && !texto.includes('nao')) return 'success';
            if (texto.includes('parcial')) return 'warning';
            return 'muted';
        }

        function renderizarBadgeDiagnostico(status) {
            const texto = status || 'Não informado';
            const textoTela = statusParametroMinimoParaTela(texto);
            const icone = textoTela === 'Em conformidade'
                ? 'fa-check'
                : textoTela === 'Pendente'
                    ? 'fa-xmark'
                    : textoTela === 'Parcial'
                        ? 'fa-triangle-exclamation'
                        : textoTela === 'Validar'
                            ? 'fa-hourglass-half'
                            : textoTela.startsWith('Falta +')
                                ? 'fa-box'
                                : textoTela === 'Déficit'
                                    ? 'fa-box'
                                    : 'fa-minus';
            return `<span class="diagnostico-status-badge diagnostico-status-${obterClasseStatusDiagnostico(textoTela)}"><i class="fas ${icone}" aria-hidden="true"></i>${escapeHtml(textoTela)}</span>`;
        }

        function formatarNumeroDiagnostico(valor) {
            if (valor === null || valor === undefined || valor === '') return 'Não informado';
            return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(valor) || 0);
        }

        function obterChecklistVisivelDiagnostico(resposta, filtros = obterFiltrosDiagnosticoOuvidorias()) {
            return (resposta.parametrosMinimos || []).filter((item) => (
                (!filtros.eixo || item.trilha === filtros.eixo || item.eixo === filtros.eixo)
                && (!filtros.statusParametro || item.statusNormalizado === filtros.statusParametro || normalizarBusca(item.statusNormalizado).includes(normalizarBusca(filtros.statusParametro)))
                && (!filtros.validacao || item.validacaoOnasp === filtros.validacao)
            ));
        }

        const ORDEM_TRILHAS_DIAGNOSTICO = [
            'Institucionalização',
            'Pessoas',
            'Estrutura',
            'Canais',
            'Fluxo',
        ];
        const STATUS_PARAMETROS_MINIMOS_EDICAO = [
            { valor: 'TEM', rotulo: 'Em conformidade' },
            { valor: 'NÃO TEM', rotulo: 'Pendente' }
        ];

        function normalizarStatusParametroMinimoFrontend(status) {
            const valor = normalizarBusca(status).replace(/\s+/g, ' ').trim();
            const falta = valor.match(/^falta\s*\+\s*(\d+)$/i);
            if (falta) return `FALTA +${Number(falta[1])}`;

            const mapa = {
                tem: 'TEM',
                'nao tem': 'NÃO TEM',
                parcial: 'PARCIAL',
                validar: 'VALIDAR',
                'nao informado': 'NÃO INFORMADO',
                deficit: 'DÉFICIT'
            };

            return mapa[valor] || String(status || '').trim().toUpperCase();
        }

        function statusParametroMinimoParaTela(status) {
            const valor = normalizarStatusParametroMinimoFrontend(status);
            const mapa = {
                TEM: 'Em conformidade',
                'NÃO TEM': 'Pendente',
                PARCIAL: 'Parcial',
                VALIDAR: 'Validar',
                'NÃO INFORMADO': 'Não informado',
                'DÉFICIT': 'Déficit'
            };

            if (valor.startsWith('FALTA +')) return valor.replace('FALTA', 'Falta');
            return mapa[valor] || 'Não informado';
        }

        function formatarValorHistoricoParametroMinimo(valor) {
            const texto = String(valor || '').trim();
            if (!texto) return '';

            const partes = texto.split('|').map((parte) => parte.trim()).filter(Boolean);
            const status = statusParametroMinimoParaTela(partes[0] || texto);
            const detalhes = partes.slice(1).map((parte) => {
                const detalhe = parte
                    .replace(/^atual\s+/i, 'atual: ')
                    .replace(/^ideal\s+/i, 'ideal: ');
                return detalhe;
            });

            return [status, ...detalhes].join(' | ');
        }

        async function reverterHistoricoParametrosMinimos(historicoId) {
            const senha = window.prompt('Digite a senha para reverter esta alteração:');
            if (!senha) return;

            try {
                const { resposta, payload } = await fetchJsonApiOnasp('/api/parametros-minimos/historico/reverter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password: senha,
                        historicoId
                    })
                });

                if (!resposta.ok || !payload.success) {
                    alert(payload.message || 'Não foi possível reverter a alteração.');
                    return;
                }

                parametrosMinimosAlteracoesPendentes = {};
                parametrosMinimosModoEdicao = false;
                parametrosMinimosEditorAtivo = null;
                removerModalParametrosMinimos('modalHistoricoParametrosMinimos');
                await carregarDadosDiagnosticoOuvidorias(true);
                renderDiagnosticoOuvidoriasView();
                alert('Alteração revertida com sucesso.');
            } catch (error) {
                alert(`Não foi possível reverter: ${error.message}`);
            }
        }

        function calcularStatusQuantitativoParametroMinimo(quantidadeAtual, idealMinimo) {
            const atual = Math.max(0, Number(quantidadeAtual) || 0);
            const ideal = Math.max(0, Number(idealMinimo) || 0);
            const deficit = Math.max(0, ideal - atual);

            return deficit > 0 ? `FALTA +${deficit}` : 'TEM';
        }

        function obterQuantidadeAtualParametroMinimo(item, statusAtual) {
            if (item.tipo !== 'quantitativo') return '';

            const ideal = Number(item.idealDeclarado ?? item.idealMinimo) || 0;
            if (Number.isFinite(Number(item.atualDeclarado))) return Number(item.atualDeclarado);

            const status = normalizarStatusParametroMinimoFrontend(statusAtual);
            const falta = status.match(/^FALTA \+(\d+)$/);

            if (falta) return Math.max(0, ideal - Number(falta[1]));
            if (status === 'TEM') return ideal;
            return 0;
        }

        function obterQuantidadeAlteracoesParametrosMinimos() {
            return Object.values(parametrosMinimosAlteracoesPendentes)
                .reduce((total, campos) => total + Object.keys(campos || {}).length, 0);
        }

        function obterValorPendenteParametroMinimo(idResposta, idParametro, valorAtual) {
            const pendente = parametrosMinimosAlteracoesPendentes[idResposta]?.[idParametro];
            if (pendente && typeof pendente === 'object') {
                return normalizarStatusParametroMinimoFrontend(pendente.status);
            }

            return pendente
                || normalizarStatusParametroMinimoFrontend(valorAtual);
        }

        function registrarAlteracaoParametroMinimo(idResposta, idParametro, valorOriginal, novoValor, detalhes = {}) {
            const original = normalizarStatusParametroMinimoFrontend(valorOriginal);
            const novo = normalizarStatusParametroMinimoFrontend(
                novoValor && typeof novoValor === 'object' ? novoValor.status : novoValor
            );

            if (!parametrosMinimosAlteracoesPendentes[idResposta]) {
                parametrosMinimosAlteracoesPendentes[idResposta] = {};
            }

            const quantidadeAtualOriginal = detalhes.quantidadeAtualOriginal === null || detalhes.quantidadeAtualOriginal === undefined
                ? null
                : Number(detalhes.quantidadeAtualOriginal);
            const quantidadeAtualNova = detalhes.quantidadeAtual === null || detalhes.quantidadeAtual === undefined
                ? null
                : Number(detalhes.quantidadeAtual);
            const quantidadeMudou = quantidadeAtualNova !== null
                && Number.isFinite(quantidadeAtualNova)
                && quantidadeAtualNova !== quantidadeAtualOriginal;

            if (novo === original && !quantidadeMudou) {
                delete parametrosMinimosAlteracoesPendentes[idResposta][idParametro];
                if (!Object.keys(parametrosMinimosAlteracoesPendentes[idResposta]).length) {
                    delete parametrosMinimosAlteracoesPendentes[idResposta];
                }
            } else {
                parametrosMinimosAlteracoesPendentes[idResposta][idParametro] = detalhes.tipo === 'quantitativo'
                    ? {
                        status: novo,
                        quantidadeAtual: quantidadeAtualNova,
                        quantidadeIdeal: Number(detalhes.quantidadeIdeal)
                    }
                    : novo;
            }

            renderDiagnosticoOuvidoriasView();
        }

        function renderizarEditorParametroMinimo(resposta, item, statusAtual) {
            const editorId = `${resposta.idResposta}::${item.idParametro}`;
            if (parametrosMinimosEditorAtivo !== editorId) return '';

            if (item.tipo === 'quantitativo') {
                const ideal = Number(item.idealDeclarado ?? item.idealMinimo) || 0;
                const pendente = parametrosMinimosAlteracoesPendentes[resposta.idResposta]?.[item.idParametro];
                const atual = pendente && typeof pendente === 'object'
                    ? Number(pendente.quantidadeAtual)
                    : obterQuantidadeAtualParametroMinimo(item, statusAtual);
                const limite = Math.max(10, ideal + 5, Number(atual) + 5);

                // Itens quantitativos sao editados por quantidade existente; o deficit e calculado pela interface.
                return `
                    <div class="diagnostico-inline-editor" data-parametros-editor="${escapeHtml(editorId)}">
                        <label>
                            <span>Quantidade existente</span>
                            <select
                                class="form-select form-select-sm"
                                data-parametros-quantidade-registro="${escapeHtml(resposta.idResposta)}"
                                data-parametros-quantidade-campo="${escapeHtml(item.idParametro)}"
                                data-parametros-quantidade-original="${escapeHtml(item.status)}"
                                data-parametros-quantidade-atual-original="${escapeHtml(String(item.atualDeclarado ?? ''))}"
                                data-parametros-quantidade-ideal="${escapeHtml(String(ideal))}"
                            >
                                ${Array.from({ length: limite + 1 }, (_, quantidade) => `
                                    <option value="${quantidade}" ${Number(atual) === quantidade ? 'selected' : ''}>${quantidade}</option>
                                `).join('')}
                            </select>
                        </label>
                        <small>Mínimo: ${ideal}. A situação é recalculada automaticamente.</small>
                    </div>
                `;
            }

            // Itens qualitativos usam apenas opcoes fechadas para evitar digitacao livre.
            return `
                <div class="diagnostico-inline-editor" data-parametros-editor="${escapeHtml(editorId)}">
                    <div class="diagnostico-status-choice-group" role="group" aria-label="Opções de status">
                        ${STATUS_PARAMETROS_MINIMOS_EDICAO.map((opcao) => `
                            <button
                                type="button"
                                class="diagnostico-status-choice ${normalizarStatusParametroMinimoFrontend(statusAtual) === opcao.valor ? 'active' : ''}"
                                data-parametros-opcao-registro="${escapeHtml(resposta.idResposta)}"
                                data-parametros-opcao-campo="${escapeHtml(item.idParametro)}"
                                data-parametros-opcao-original="${escapeHtml(item.status)}"
                                data-parametros-opcao-valor="${escapeHtml(opcao.valor)}"
                            >
                                ${escapeHtml(opcao.rotulo)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function obterEixoOperacionalDiagnostico(eixo = '', parametro = '') {
            const texto = normalizarBusca(`${eixo} ${parametro}`);
            if (texto.includes('formalizacao')) return 'Institucionalização';
            if (texto.includes('ouvidor') || texto.includes('equipe')) return 'Pessoas';
            if (texto.includes('estrutura') || texto.includes('computador') || texto.includes('impressora') || texto.includes('mobiliario') || texto.includes('armario') || texto.includes('licenca')) return 'Estrutura';
            if (texto.includes('canais')) return 'Canais';
            if (texto.includes('relatorio') || texto.includes('melhoria')) return 'Relatórios';
            if (texto.includes('fluxo')) return 'Fluxo';
            return eixo || 'Parâmetros';
        }

        function obterItensOperacionaisDiagnostico(resposta) {
            const filtros = obterFiltrosDiagnosticoOuvidorias();
            return obterChecklistVisivelDiagnostico(resposta, filtros).map((item) => ({
                idParametro: item.idParametro,
                tipo: item.tipo,
                eixo: item.trilha || item.eixo,
                parametro: item.parametroCurto || item.parametro,
                status: item.statusNormalizado || item.statusOperacional,
                falta: item.faltaObjetiva,
                providencia: item.providenciaObjetiva,
                fundamentoIn: item.fundamentoIn,
                perguntasDiagnostico: item.perguntasDiagnostico || [],
                respostaUf: item.statusNormalizado || item.statusOperacional,
                respostaOriginal: item.respostaOriginal || item.respostaUf,
                prioridade: item.prioridade,
                validacaoOnasp: item.validacaoOnasp,
                atualDeclarado: item.atualDeclarado,
                idealDeclarado: item.idealDeclarado,
                deficit: item.deficit
            })).sort((a, b) => (
                ORDEM_TRILHAS_DIAGNOSTICO.indexOf(a.eixo) - ORDEM_TRILHAS_DIAGNOSTICO.indexOf(b.eixo)
            ));
        }

        function renderizarTrilhaParametrosDiagnostico(resposta) {
            // A trilha segue o padrão visual vertical por grupo, mantendo a leitura operacional de cada parâmetro.
            const itens = obterItensOperacionaisDiagnostico(resposta);
            const icones = {
                'Em conformidade': 'fa-check',
                'Pendente': 'fa-xmark',
                'Parcial': 'fa-triangle-exclamation',
                'Validar': 'fa-file-circle-question',
                'Não informado': 'fa-minus'
            };

            return `
                <section class="diagnostico-block" aria-label="Trilha de parâmetros mínimos">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Trilha de acompanhamento</p>
                            <h2>Parâmetros mínimos</h2>
                        </div>
                    </div>
                    <div class="diagnostico-trail-groups">
                        ${ORDEM_TRILHAS_DIAGNOSTICO.map((trilha) => {
                            const itensTrilha = itens.filter((item) => item.eixo === trilha);
                            if (!itensTrilha.length) return '';

                            return `
                                <div class="diagnostico-trail-group">
                                    <h3>${escapeHtml(trilha)}</h3>
                                    <div class="diagnostico-trail-items">
                                        ${itensTrilha.map((item) => {
                                            const statusAtualBanco = obterValorPendenteParametroMinimo(resposta.idResposta, item.idParametro, item.status);
                                            const statusAtualTela = statusParametroMinimoParaTela(statusAtualBanco);
                                            const editorId = `${resposta.idResposta}::${item.idParametro}`;
                                            const textoResumo = statusAtualTela;

                                            return `
                                                <div class="diagnostico-trail-row diagnostico-trail-row-${obterClasseStatusDiagnostico(statusAtualTela)}">
                                                    <span class="diagnostico-trail-marker" aria-hidden="true">
                                                        <i class="fas ${statusAtualTela.startsWith('Falta +') || statusAtualTela === 'Déficit' ? 'fa-box' : (icones[statusAtualTela] || 'fa-circle')}"></i>
                                                    </span>
                                                    <div class="diagnostico-trail-content">
                                                        <span class="diagnostico-trail-title-line">
                                                            <strong>${escapeHtml(item.parametro)}</strong>
                                                            ${renderActionButton({
                                                                type: 'edit',
                                                                label: `Editar ${item.parametro}`,
                                                                variant: 'outline-primary',
                                                                size: 'sm',
                                                                backend: true,
                                                                iconOnly: true,
                                                                title: 'Editar',
                                                                extraClass: `diagnostico-item-edit-button ${parametrosMinimosEditorAtivo === editorId ? 'active' : ''}`,
                                                                attributes: `data-parametros-toggle-editor="${escapeHtml(editorId)}" aria-label="Editar ${escapeHtml(item.parametro)}"`
                                                            })}
                                                        </span>
                                                        ${renderizarBadgeDiagnostico(textoResumo)}
                                                        ${renderizarEditorParametroMinimo(resposta, item, statusAtualBanco)}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }

        function renderizarAcoesParametrosMinimos() {
            const modoEstatico = dadosPaginaEmModoEstatico('parametrosMinimos');
            const totalAlteracoes = obterQuantidadeAlteracoesParametrosMinimos();
            if (modoEstatico) {
                parametrosMinimosAlteracoesPendentes = {};
                parametrosMinimosEditorAtivo = null;
            }

            return `
                <section class="diagnostico-action-bar diagnostico-block" aria-label="Ações dos parâmetros mínimos">
                    <div>
                        <p class="section-eyebrow mb-1">Atualização</p>
                        <h2>Parâmetros mínimos</h2>
                        ${modoEstatico ? renderizarAvisoModoPublicacao() : ''}
                    </div>
                    <div class="diagnostico-action-buttons">
                        ${renderActionButton({
                            id: 'btnSalvarParametrosMinimos',
                            type: 'save',
                            label: 'Salvar alterações',
                            variant: 'primary',
                            backend: true,
                            disabled: modoEstatico || !totalAlteracoes
                        })}
                        ${renderActionButton({
                            id: 'btnCancelarParametrosMinimos',
                            type: 'cancel',
                            label: 'Cancelar alterações',
                            variant: 'outline-secondary',
                            backend: true,
                            disabled: modoEstatico || !totalAlteracoes
                        })}
                        ${renderActionButton({
                            id: 'btnExportarParametrosMinimos',
                            type: 'exportExcel',
                            label: 'Exportar Excel',
                            variant: 'outline-success',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btnHistoricoParametrosMinimos',
                            type: 'history',
                            label: 'Histórico',
                            variant: 'outline-dark',
                            backend: true,
                            disabled: modoEstatico
                        })}
                    </div>
                    <small class="text-muted">${totalAlteracoes} alteração(ões) pendente(s)</small>
                </section>
            `;
        }

        function renderizarFaltasParametrosMinimos(resposta) {
            const faltas = resposta.faltasParametrosMinimos || [];

            return `
                <section class="diagnostico-block" aria-label="O que está faltando">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">O que falta</p>
                            <h2>Pendências</h2>
                        </div>
                        <small class="text-muted">${faltas.length} item(ns)</small>
                    </div>
                    ${faltas.length ? `
                        <div class="diagnostico-missing-list">
                            ${faltas.map((item) => `
                                <div class="diagnostico-missing-item diagnostico-operational-${obterClasseStatusDiagnostico(item.status)}">
                                    ${renderizarBadgeDiagnostico(item.status)}
                                    <strong>${escapeHtml(item.item)}</strong>
                                    <span>${escapeHtml(item.providencia || item.falta || '-')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="diagnostico-empty-state">Nenhuma falta calculada para esta ouvidoria.</div>'}
                </section>
            `;
        }

        function renderizarProvidenciasParametrosMinimos(resposta) {
            const providencias = resposta.providenciasParametrosMinimos || [];

            return `
                <section class="diagnostico-block" aria-label="Providências necessárias">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Providências necessárias</p>
                            <h2>Providências</h2>
                        </div>
                    </div>
                    ${providencias.length ? `
                        <div class="table-responsive">
                            <table class="table table-sm table-hover w-100 app-data-table diagnostico-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Situação</th>
                                        <th>Providência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${providencias.map((item) => `
                                        <tr>
                                            <td data-label="Item"><strong>${escapeHtml(item.item)}</strong></td>
                                            <td data-label="Situação">${renderizarBadgeDiagnostico(item.situacao)}</td>
                                            <td data-label="Providência">${escapeHtml(item.providencia || '-')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<div class="diagnostico-empty-state">Nenhuma providência necessária calculada para esta ouvidoria.</div>'}
                </section>
            `;
        }

        function renderizarDetalheTecnicoParametrosMinimos(resposta) {
            const itens = obterItensOperacionaisDiagnostico(resposta);

            return `
                <section class="diagnostico-block" aria-label="Detalhe técnico dos parâmetros mínimos">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Detalhe técnico</p>
                            <h2>Rastreabilidade</h2>
                        </div>
                        <small class="text-muted">${itens.length} item(ns)</small>
                    </div>
                    <div class="diagnostico-operational-list">
                        ${itens.map((item) => {
                            const ehQuantitativo = item.tipo === 'quantitativo';
                            const valorAtual = ehQuantitativo ? formatarNumeroDiagnostico(item.atualDeclarado) : 'Não se aplica';
                            const valorIdeal = ehQuantitativo ? formatarNumeroDiagnostico(item.idealDeclarado) : 'Não se aplica';

                            return `
                            <details class="diagnostico-operational-item diagnostico-operational-${obterClasseStatusDiagnostico(item.status)}">
                                <summary>
                                    <span class="diagnostico-operational-main">
                                        <strong>${escapeHtml(item.parametro)}</strong>
                                        <small>${escapeHtml(item.eixo)}</small>
                                    </span>
                                    <span class="diagnostico-operational-status">${renderizarBadgeDiagnostico(item.status)}</span>
                                    <span class="diagnostico-operational-gap">${escapeHtml(item.falta || '-')}</span>
                                    <span class="diagnostico-operational-action">${escapeHtml(item.providencia || 'Não se aplica')}</span>
                                </summary>
                                <div class="diagnostico-audit-grid">
                                    <div><span>Item</span><strong>${escapeHtml(item.parametro)}</strong></div>
                                    <div><span>Fundamento normativo</span><strong>${escapeHtml(item.fundamentoIn || 'Não informado')}</strong></div>
                                    <div><span>Coluna de origem</span><strong>${escapeHtml((item.perguntasDiagnostico || []).join(', ') || 'Não informado')}</strong></div>
                                    <div><span>Resultado normalizado</span><strong>${escapeHtml(item.status || 'Não informado')}</strong></div>
                                    <div><span>Providência sugerida</span><strong>${escapeHtml(item.providencia || 'Não se aplica')}</strong></div>
                                    <div><span>Validação ONASP</span><strong>${escapeHtml(item.validacaoOnasp || 'Não se aplica')}</strong></div>
                                    <div><span>Atual</span><strong>${escapeHtml(valorAtual)}</strong></div>
                                    <div><span>Ideal</span><strong>${escapeHtml(valorIdeal)}</strong></div>
                                </div>
                                <p class="diagnostico-original-response">${escapeHtml(item.respostaOriginal || item.respostaUf || 'Resposta original não informada')}</p>
                            </details>
                        `;
                        }).join('')}
                    </div>
                </section>
            `;
        }

        function renderizarCabecalhoUfDiagnostico(resposta) {
            const flagUrl = catalogoAplicacao.imagensBandeiras?.[resposta.uf] || '';
            const imgElement = flagUrl
                ? `<img src="${escapeHtml(flagUrl)}" alt="Bandeira ${escapeHtml(resposta.uf)}" class="state-flag report-state-flag diagnostico-header-flag">`
                : '<i class="fas fa-flag text-secondary report-state-icon diagnostico-header-flag-icon"></i>';
            const unidade = resposta.unidadeDiagnosticada && resposta.unidadeDiagnosticada !== resposta.uf
                ? resposta.unidadeDiagnosticada
                : '';
            const titulo = unidade ? `${resposta.uf} - ${unidade}` : resposta.uf;

            return `
                <section class="diagnostico-block diagnostico-header-block" aria-label="Cabeçalho da UF">
                    <div class="diagnostico-header-title">
                        ${imgElement}
                        <div>
                            <p class="section-eyebrow mb-1">Cabeçalho da UF</p>
                            <h2>${escapeHtml(titulo)}</h2>
                        </div>
                    </div>
                    <div class="diagnostico-header-grid">
                        <div><span>UF</span><strong>${escapeHtml(resposta.uf)}</strong></div>
                        <div><span>Unidade diagnosticada</span><strong>${escapeHtml(resposta.unidadeDiagnosticada || 'Não informado')}</strong></div>
                        <div><span>Status geral</span>${renderizarBadgeDiagnostico(resposta.statusGeralParametrosMinimos)}</div>
                        <div><span>Itens avaliados</span><strong>${escapeHtml(String(resposta.resumoParametrosMinimos?.total || 0))}</strong></div>
                    </div>
                </section>
            `;
        }

        function montarResumoGeralParametrosDiagnostico(respostas = []) {
            const total = respostas.length;
            const totalAvaliavel = respostas.reduce((soma, resposta) => soma + (resposta.resumoParametrosMinimos?.total || 0), 0);
            const conformes = respostas.reduce((soma, resposta) => soma + (resposta.resumoParametrosMinimos?.parametrosAtendidos || 0), 0);
            const deficitAparelhamento = respostas.reduce((soma, resposta) => soma + (resposta.resumoParametrosMinimos?.deficitMaterial || 0), 0);

            return {
                totalRespostas: total,
                ufsDiagnosticadas: new Set(respostas.map((resposta) => resposta.uf).filter(Boolean)).size,
                conformes: respostas.filter((resposta) => resposta.statusGeralParametrosMinimos === 'Tem').length,
                parcialmenteConformes: respostas.filter((resposta) => resposta.statusGeralParametrosMinimos === 'Parcial').length,
                naoConformes: respostas.filter((resposta) => resposta.parametrosMinimos?.some((item) => (
                    item.statusNormalizado === 'Não tem'
                    || item.statusNormalizado === 'Déficit'
                    || item.statusNormalizado?.startsWith('Falta +')
                ))).length,
                naoInformadas: respostas.filter((resposta) => resposta.parametrosMinimos?.some((item) => item.statusNormalizado === 'Não informado')).length,
                conformidadePercentual: totalAvaliavel ? Math.round((conformes / totalAvaliavel) * 100) : 0,
                deficitAparelhamento
            };
        }

        function obterParametroMaisAusenteDiagnostico(respostas = []) {
            const contagem = new Map();

            respostas.forEach((resposta) => {
                (resposta.parametrosMinimos || []).forEach((item) => {
                    const status = statusParametroMinimoParaTela(item.statusNormalizado || item.statusOperacional || item.respostaUf || '');
                    if (!['Pendente', 'Déficit'].includes(status) && !status.startsWith('Falta +')) return;
                    const chave = item.parametroCurto || item.parametro || '';
                    if (!chave) return;
                    contagem.set(chave, (contagem.get(chave) || 0) + 1);
                });
            });

            const [parametro, quantidade] = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])[0] || [];
            return parametro ? `${parametro} (${quantidade})` : 'Sem predominância';
        }

        function renderizarVisaoGeralParametrosDiagnostico(dados, respostasFiltradas) {
            const resumo = montarResumoGeralParametrosDiagnostico(respostasFiltradas);
            const cards = [
                ['UFs completas', respostasFiltradas.filter((resposta) => (resposta.resumoParametrosMinimos?.pendencias || 0) === 0 && (resposta.resumoParametrosMinimos?.itensParaValidar || 0) === 0).length],
                ['UFs com pendência', respostasFiltradas.filter((resposta) => (resposta.resumoParametrosMinimos?.pendencias || 0) > 0).length],
                ['UFs com validação pendente', respostasFiltradas.filter((resposta) => (resposta.resumoParametrosMinimos?.itensParaValidar || 0) > 0).length],
                ['Parâmetro mais ausente', obterParametroMaisAusenteDiagnostico(respostasFiltradas)]
            ];

            return `
                <section class="diagnostico-block diagnostico-general-block" aria-label="Informações gerais dos parâmetros mínimos">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Visão geral</p>
                            <h2>Panorama do checklist nacional</h2>
                        </div>
                        <small class="text-muted">${escapeHtml(String(dados.resumo.totalRespostas || 0))} registro(s) na base</small>
                    </div>
                    <div class="diagnostico-summary-grid">
                        ${cards.map(([rotulo, valor]) => `
                            <div class="diagnostico-summary-card">
                                <span>${escapeHtml(rotulo)}</span>
                                <strong>${escapeHtml(String(valor))}</strong>
                            </div>
                        `).join('')}
                    </div>
                    <div class="table-responsive mt-3">
                        <table class="table table-sm table-hover w-100 app-data-table diagnostico-table">
                            <thead>
                                <tr>
                                    <th>UF</th>
                                    <th>Checklist</th>
                                    <th class="text-center">Pendências</th>
                                    <th class="text-center">Validar</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${respostasFiltradas.map((resposta) => {
                                    const resumoUf = resposta.resumoParametrosMinimos || {};
                                    return `
                                        <tr>
                                            <td data-label="UF"><strong>${escapeHtml(resposta.uf || '-')}</strong></td>
                                            <td data-label="Checklist">${escapeHtml(`${resumoUf.parametrosAtendidos || 0}/${resumoUf.total || 0} parâmetros atendidos`)}</td>
                                            <td data-label="Pendências" class="text-center">${escapeHtml(String(resumoUf.pendencias || 0))}</td>
                                            <td data-label="Validar" class="text-center">${escapeHtml(String(resumoUf.itensParaValidar || 0))}</td>
                                            <td data-label="Status">${renderizarBadgeDiagnostico(resposta.statusGeralParametrosMinimos)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="diagnostico-general-callout">
                        <i class="fas fa-filter" aria-hidden="true"></i>
                            <span>Selecione uma UF nos botões acima para abrir os parâmetros mínimos validados daquela ouvidoria.</span>
                    </div>
                </section>
            `;
        }

        function renderizarResumoConformidadeDiagnostico(resposta) {
            const resumo = resposta.resumoParametrosMinimos || {};
            const total = resumo.total || 0;
            const atendidos = resumo.parametrosAtendidos || 0;
            const pendencias = resumo.pendencias || 0;
            const validar = resumo.itensParaValidar || 0;
            const resumoObjetivo = `${atendidos}/${total} parâmetros atendidos`;

            return `
                <section class="diagnostico-block" aria-label="Resumo de conformidade">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Resumo da UF</p>
                            <h2>Checklist objetivo</h2>
                        </div>
                    </div>
                    <div class="diagnostico-summary-grid">
                        <div class="diagnostico-summary-card diagnostico-summary-card-highlight">
                            <span>Resumo</span>
                            <strong>${escapeHtml(resumoObjetivo)}</strong>
                        </div>
                        <div class="diagnostico-summary-card">
                            <span>Pendências</span>
                            <strong>${escapeHtml(String(pendencias))}</strong>
                        </div>
                        <div class="diagnostico-summary-card">
                            <span>Validar</span>
                            <strong>${escapeHtml(String(validar))}</strong>
                        </div>
                        <div class="diagnostico-summary-card">
                            <span>Status geral</span>
                            <strong>${escapeHtml(String(resumo.statusGeral || 'Não informado'))}</strong>
                        </div>
                    </div>
                </section>
            `;
        }

        function renderizarAtalhosUfDiagnostico(dados, filtros = obterFiltrosDiagnosticoOuvidorias()) {
            const ufs = dados?.resumo?.filtros?.ufs || [];
            const ufAtual = filtros.uf || '';

            return `
                <section class="diagnostico-shortcut-panel mb-4" aria-label="Acesso rápido por UF">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Acesso rápido</p>
                            <h2>Selecionar UF</h2>
                        </div>
                        <small class="text-muted">Abra a visão geral ou vá direto para a unidade desejada</small>
                    </div>
                    <div class="contact-uf-chip-list diagnostico-uf-chip-list">
                        <button
                            type="button"
                            class="contact-uf-filter-chip diagnostico-uf-filter-chip ${!ufAtual ? 'active' : ''}"
                            data-diagnostico-uf=""
                            aria-pressed="${!ufAtual ? 'true' : 'false'}"
                        >
                            Visão geral
                        </button>
                        ${ufs.map((uf) => `
                            <button
                                type="button"
                                class="contact-uf-filter-chip diagnostico-uf-filter-chip ${ufAtual === uf ? 'active' : ''}"
                                data-diagnostico-uf="${escapeHtml(uf)}"
                                aria-pressed="${ufAtual === uf ? 'true' : 'false'}"
                                title="Abrir parâmetros mínimos de ${escapeHtml(uf)}"
                            >
                                ${escapeHtml(uf)}
                            </button>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        function obterResumoAlteracoesParametrosMinimos(dados) {
            const respostas = dados?.respostas || [];
            return Object.entries(parametrosMinimosAlteracoesPendentes).flatMap(([registro, campos]) => {
                const resposta = respostas.find((item) => item.idResposta === registro || item.uf === registro);

                return Object.entries(campos).map(([campo, novoValor]) => {
                    const parametro = resposta?.parametrosMinimos?.find((item) => item.idParametro === campo);
                    const statusNovo = novoValor && typeof novoValor === 'object'
                        ? novoValor.status
                        : novoValor;
                    const complementoQuantidade = novoValor && typeof novoValor === 'object'
                        ? ` | atual: ${novoValor.quantidadeAtual} | ideal: ${novoValor.quantidadeIdeal}`
                        : '';
                    return {
                        registro,
                        campo,
                        label: parametro?.parametro || campo,
                        anterior: normalizarStatusParametroMinimoFrontend(parametro?.respostaUf || parametro?.statusNormalizado || ''),
                        novo: `${statusNovo}${complementoQuantidade}`
                    };
                });
            });
        }

        // ========================================================================
        // ORCAMENTO 2026
        // ========================================================================

        const STATUS_ORCAMENTO_EDICAO = ['PLANEJADO', 'PROCESSO AUTUADO', 'EM PESQUISA DE PREÇOS', 'EM EXECUÇÃO', 'EXECUTADO', 'SUSPENSO', 'CANCELADO', 'VALIDAR'];
        const STATUS_ORCAMENTO_AUTUACAO_VISUAL = new Set([
            'processo autuado',
            'em pesquisa de precos',
            'em execucao',
            'executado',
            'suspenso',
            'cancelado'
        ]);

        function statusIndicaProcessoAutuadoOrcamento(status) {
            return STATUS_ORCAMENTO_AUTUACAO_VISUAL.has(normalizarBusca(status));
        }

        function calcularProcessoAutuadoVisualOrcamento(item, pendencias = orcamentoAlteracoesPendentes[String(item?.id ?? '')] || {}) {
            if (statusIndicaProcessoAutuadoOrcamento(pendencias.status)) return true;
            if (pendencias.processo_autuado !== undefined) return normalizarBooleanOrcamento(pendencias.processo_autuado);
            if (statusIndicaProcessoAutuadoOrcamento(item?.status)) return true;
            const processoAutuadoItem = item?.processoAutuado ?? item?.processo_autuado;
            if (processoAutuadoItem !== undefined) return normalizarBooleanOrcamento(processoAutuadoItem);
            return false;
        }

        function parseNumeroMonetarioFrontend(valor) {
            if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
            const texto = String(valor ?? '').trim();
            if (!texto) return 0;
            const normalizado = texto.replace(/\s+/g, '').replace(/^R\$/i, '');
            if (normalizado.includes(',') && normalizado.includes('.')) {
                return Number.parseFloat(normalizado.replace(/\./g, '').replace(',', '.')) || 0;
            }
            if (normalizado.includes(',')) return Number.parseFloat(normalizado.replace(',', '.')) || 0;
            return Number.parseFloat(normalizado) || 0;
        }

        function formatarValorMonetarioInput(valor) {
            const numero = Number(valor) || 0;
            return numero.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        function obterQuantidadeAlteracoesOrcamento() {
            const alteracoes = Object.values(orcamentoAlteracoesPendentes)
                .reduce((total, campos) => total + Object.keys(campos || {}).length, 0);
            return alteracoes + orcamentoNovosProcessos.length + orcamentoProcessosInativos.size;
        }

        function obterQuantidadeAlteracoesLinhaOrcamento(itemId) {
            return Object.keys(orcamentoAlteracoesPendentes[String(itemId)] || {}).length;
        }

        function obterValorPendenteOrcamento(item, campo, fallback = '') {
            const pendente = orcamentoAlteracoesPendentes[item.id]?.[campo];
            if (pendente !== undefined) return pendente;
            return obterValorOriginalOrcamento(item, campo, fallback);
        }

        function obterValorOriginalOrcamento(item, campo, fallback = '') {
            const mapa = {
                valor_estimado_pesquisa_preco: item.valorEstimadoPesquisaPreco,
                valor_empenhado: item.valorEmpenhado,
                processo_autuado: item.processoAutuado,
                processo_sei: item.processoSei,
                status: item.status,
                observacao: item.observacao,
                classificacao_gerencial: item.classificacaoGerencial || (item.ehAparelhamento ? 'APARELHAMENTO' : 'NAO_APARELHAMENTO'),
                descricao: item.descricao,
                categoria: item.categoria || item.frente,
                natureza: item.natureza,
                valor_executado: item.valorExecutado
            };
            if (Object.prototype.hasOwnProperty.call(mapa, campo)) {
                return mapa[campo] ?? fallback;
            }

            const campoCamel = String(campo || '').replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());
            return item[campoCamel] ?? fallback;
        }

        function registrarAlteracaoOrcamento(id, campo, valorOriginal, novoValor) {
            const originalNormalizado = campo.startsWith('valor_')
                ? parseNumeroMonetarioFrontend(valorOriginal)
                : campo === 'processo_autuado'
                    ? normalizarBooleanOrcamento(valorOriginal)
                    : campo === 'classificacao_gerencial'
                        ? normalizarClassificacaoGerencialOrcamento(valorOriginal)
                    : String(valorOriginal ?? '');
            const novoNormalizado = campo.startsWith('valor_')
                ? parseNumeroMonetarioFrontend(novoValor)
                : campo === 'processo_autuado'
                    ? normalizarBooleanOrcamento(novoValor)
                    : campo === 'classificacao_gerencial'
                        ? normalizarClassificacaoGerencialOrcamento(novoValor)
                    : String(novoValor ?? '').trim();

            if (!orcamentoAlteracoesPendentes[id]) {
                orcamentoAlteracoesPendentes[id] = {};
            }

            if (String(originalNormalizado) === String(novoNormalizado)) {
                delete orcamentoAlteracoesPendentes[id][campo];
                if (!Object.keys(orcamentoAlteracoesPendentes[id]).length) {
                    delete orcamentoAlteracoesPendentes[id];
                }
            } else {
                orcamentoAlteracoesPendentes[id][campo] = novoNormalizado;
            }
        }

        function renderizarAcoesOrcamento() {
            const modoEstatico = dadosPaginaEmModoEstatico('orcamento2026');
            const totalAlteracoes = obterQuantidadeAlteracoesOrcamento();

            return `
                <section class="diagnostico-action-bar diagnostico-block budget-action-bar-compact mb-4" aria-label="Ações do orçamento 2026">
                    <div>
                        <p class="section-eyebrow mb-1">Relatórios</p>
                        <h2>Orçamento 2026</h2>
                        ${modoEstatico ? renderizarAvisoModoPublicacao() : ''}
                        ${modoEstatico
                            ? '<small class="text-muted">Dados carregados dos JSONs publicados.</small>'
                            : totalAlteracoes
                                ? `<small class="text-muted">${totalAlteracoes} alteração(ões) pendente(s) nas linhas.</small>`
                                : '<small class="text-muted">Edite cada item pelo botão no fim da linha.</small>'}
                    </div>
                    <div class="diagnostico-action-buttons">
                        ${renderActionButton({
                            id: 'btnExportarOrcamentoExcel',
                            type: 'exportExcel',
                            label: 'Exportar Excel',
                            variant: 'outline-success',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btnHistoricoOrcamento',
                            type: 'history',
                            label: 'Histórico',
                            variant: 'outline-dark',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btn-export-budget-pdf',
                            type: 'exportPdf',
                            label: 'PDF',
                            variant: 'outline-danger',
                            onClick: 'exportarOrcamentoPDF()'
                        })}
                    </div>
                </section>
            `;
        }

        function renderizarCampoOrcamento(item, campo, tipo = 'text') {
            const valor = campo === 'processo_autuado'
                ? calcularProcessoAutuadoVisualOrcamento(item)
                : obterValorPendenteOrcamento(item, campo);
            const valorOriginal = obterValorOriginalOrcamento(item, campo);
            if (!orcamentoItemEmEdicao(item.id)) {
                if (campo === 'processo_autuado') {
                    const autuado = calcularProcessoAutuadoVisualOrcamento(item);
                    return `<span class="profor-alert-badge profor-alert-${autuado ? 'success' : 'warning'}">${autuado ? 'Sim' : 'Não'}</span>`;
                }
                if (campo.startsWith('valor_')) return formatMoney(Number(valor) || 0);
                if (campo === 'status') return renderizarStatusOrcamento(valor);
                if (campo === 'classificacao_gerencial') return renderizarClassificacaoGerencialOrcamento(valor, item.saldoAparelhamento || 0);
                return escapeHtml(valor || '-');
            }

            if (campo === 'processo_autuado') {
                const autuado = calcularProcessoAutuadoVisualOrcamento(item);
                const autuadoOriginal = normalizarBooleanOrcamento(valorOriginal);
                return `
                    <select class="form-select form-select-sm budget-edit-control" data-orcamento-id="${escapeHtml(item.id)}" data-orcamento-campo="${campo}" data-orcamento-original="${autuadoOriginal ? '1' : ''}">
                        <option value="">Não</option>
                        <option value="1" ${autuado ? 'selected' : ''}>Sim</option>
                    </select>
                `;
            }

            if (campo === 'status') {
                return `
                    <select class="form-select form-select-sm budget-edit-control" data-orcamento-id="${escapeHtml(item.id)}" data-orcamento-campo="${campo}" data-orcamento-original="${escapeHtml(valorOriginal)}">
                        ${STATUS_ORCAMENTO_EDICAO.map((status) => `<option value="${escapeHtml(status)}" ${valor === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
                    </select>
                `;
            }

            if (campo === 'classificacao_gerencial') {
                const classificacao = normalizarClassificacaoGerencialOrcamento(valor);
                const classificacaoOriginal = normalizarClassificacaoGerencialOrcamento(valorOriginal);
                return `
                    <select class="form-select form-select-sm budget-edit-control" data-orcamento-id="${escapeHtml(item.id)}" data-orcamento-campo="${campo}" data-orcamento-original="${escapeHtml(classificacaoOriginal)}">
                        <option value="APARELHAMENTO" ${classificacao === 'APARELHAMENTO' ? 'selected' : ''}>Aparelhamento</option>
                        <option value="NAO_APARELHAMENTO" ${classificacao !== 'APARELHAMENTO' ? 'selected' : ''}>Não aparelhamento</option>
                    </select>
                `;
            }

            return `
                <div class="${tipo === 'money' ? 'input-group input-group-sm' : ''}">
                    ${tipo === 'money' ? '<span class="input-group-text">R$</span>' : ''}
                <input
                    type="${tipo === 'money' ? 'text' : tipo}"
                    class="form-control form-control-sm budget-edit-control"
                    value="${escapeHtml(tipo === 'money' ? formatarValorMonetarioInput(valor) : (valor ?? ''))}"
                    data-orcamento-id="${escapeHtml(item.id)}"
                    data-orcamento-campo="${campo}"
                    data-orcamento-original="${escapeHtml(valorOriginal ?? '')}"
                    ${tipo === 'number' ? 'min="0" step="0.01"' : ''}
                    ${tipo === 'money' ? 'inputmode="decimal" placeholder="0,00"' : ''}
                >
                </div>
            `;
        }

        function atualizarNovoProcessoOrcamento(tempId, campo, valor) {
            const item = orcamentoNovosProcessos.find((processo) => processo.tempId === tempId);
            if (!item) return;
            item[campo] = campo === 'processo_autuado'
                ? normalizarBooleanOrcamento(valor)
                : campo === 'valor_estimado_pesquisa_preco'
                    ? parseNumeroMonetarioFrontend(valor)
                    : String(valor ?? '').trim();
        }

        function renderizarLinhaNovoProcessoOrcamento(item) {
            if (dadosPaginaEmModoEstatico('orcamento2026')) return '';
            const processoAutuado = calcularProcessoAutuadoVisualOrcamento(item);

            return `
                <tr>
                    <td><input type="text" class="form-control form-control-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="descricao" value="${escapeHtml(item.descricao || '')}" placeholder="Descrição"></td>
                    <td><input type="text" class="form-control form-control-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="processo_sei" value="${escapeHtml(item.processo_sei || '')}" placeholder="Processo SEI"></td>
                    <td class="text-end"><input type="number" min="0" step="0.01" class="form-control form-control-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="valor_estimado_pesquisa_preco" value="${escapeHtml(item.valor_estimado_pesquisa_preco ?? '')}"></td>
                    <td>
                        <select class="form-select form-select-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="processo_autuado">
                            <option value="">Não</option>
                            <option value="1" ${processoAutuado ? 'selected' : ''}>Sim</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-select form-select-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="status">
                            ${STATUS_ORCAMENTO_EDICAO.map((status) => `<option value="${escapeHtml(status)}" ${(item.status || 'PLANEJADO') === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
                        </select>
                    </td>
                    <td><input type="text" class="form-control form-control-sm budget-new-control" data-orcamento-novo-id="${escapeHtml(item.tempId)}" data-orcamento-novo-campo="observacao" value="${escapeHtml(item.observacao || '')}" placeholder="Observação"></td>
                    <td class="text-end">
                        <div class="budget-row-actions justify-content-end">
                            ${renderActionButton({
                                type: 'save',
                                label: 'Salvar novo processo',
                                variant: 'primary',
                                backend: true,
                                title: 'Salvar novo processo',
                                iconOnly: true,
                                extraClass: 'budget-row-action',
                                attributes: `data-orcamento-salvar-novo="${escapeHtml(item.tempId)}"`
                            })}
                            ${renderActionButton({
                                type: 'cancel',
                                label: 'Remover',
                                variant: 'outline-danger',
                                backend: true,
                                title: 'Remover',
                                iconOnly: true,
                                extraClass: 'budget-row-action',
                                attributes: `data-orcamento-remover-novo="${escapeHtml(item.tempId)}"`
                            })}
                        </div>
                    </td>
                </tr>
            `;
        }

        function removerModalParametrosMinimos(id) {
            const modalExistente = document.getElementById(id);
            if (modalExistente) {
                window.bootstrap?.Modal?.getInstance(modalExistente)?.dispose();
                modalExistente.remove();
            }
        }

        function abrirModalSenhaParametrosMinimos(dados) {
            if (dadosPaginaEmModoEstatico('parametrosMinimos')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const alteracoes = obterResumoAlteracoesParametrosMinimos(dados);
            if (!alteracoes.length) {
                alert('Não há alterações para salvar.');
                return;
            }

            removerModalParametrosMinimos('modalSenhaParametrosMinimos');
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="modalSenhaParametrosMinimos" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Confirmar alterações</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <p>Você está prestes a salvar ${alteracoes.length} alteração(ões):</p>
                                <ul class="diagnostico-change-list">
                                    ${alteracoes.map((item) => `
                                        <li><strong>${escapeHtml(item.registro)}</strong> — ${escapeHtml(item.label)}: ${escapeHtml(item.anterior)} → ${escapeHtml(item.novo)}</li>
                                    `).join('')}
                                </ul>
                                <label class="form-label" for="senhaParametrosMinimos">Senha de confirmação</label>
                                <input type="password" class="form-control" id="senhaParametrosMinimos" autocomplete="current-password">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                ${renderActionButton({
                                    id: 'confirmarSalvarParametrosMinimos',
                                    type: 'save',
                                    label: 'Confirmar e salvar',
                                    variant: 'primary',
                                    backend: true
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            `);

            const modalElement = document.getElementById('modalSenhaParametrosMinimos');
            const modal = new window.bootstrap.Modal(modalElement);
            modal.show();

            document.getElementById('confirmarSalvarParametrosMinimos')?.addEventListener('click', async () => {
                const senha = document.getElementById('senhaParametrosMinimos')?.value || '';
                await salvarParametrosMinimosComSenha(senha, modal);
            });
        }

        async function salvarParametrosMinimosComSenha(password, modal) {
            if (dadosPaginaEmModoEstatico('parametrosMinimos')) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            try {
                const { resposta: response, payload: result } = await fetchJsonApiOnasp('/api/parametros-minimos/salvar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password,
                        changes: parametrosMinimosAlteracoesPendentes
                    })
                });

                if (!response.ok || !result.success) {
                    alert(result.message || 'Não foi possível salvar.');
                    return;
                }

                parametrosMinimosAlteracoesPendentes = {};
                parametrosMinimosModoEdicao = false;
                parametrosMinimosEditorAtivo = null;
                modal.hide();
                await carregarDadosDiagnosticoOuvidorias(true);
                renderDiagnosticoOuvidoriasView();
                alert(obterMensagemSalvamento(result));
            } catch (error) {
                alert(`Não foi possível salvar: ${error.message}`);
            }
        }

        async function abrirHistoricoParametrosMinimos() {
            try {
                const { payload: result } = await fetchJsonApiOnasp('/api/parametros-minimos/historico');
                const historico = result.historico || [];

                removerModalParametrosMinimos('modalHistoricoParametrosMinimos');
                document.body.insertAdjacentHTML('beforeend', `
                    <div class="modal fade" id="modalHistoricoParametrosMinimos" tabindex="-1" aria-hidden="true">
                        <div class="modal-dialog modal-lg modal-dialog-scrollable">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Histórico de alterações</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                                </div>
                                <div class="modal-body">
                                    ${historico.length ? `
                                        <div class="table-responsive">
                                            <table class="table table-sm app-data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Data</th>
                                                        <th>Registro</th>
                                                        <th>Campo</th>
                                                        <th>Anterior</th>
                                                        <th>Novo</th>
                                                        <th class="text-end">Desfazer</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${historico.map((item) => `
                                                        <tr>
                                                            <td>${escapeHtml(item.alteradoEm ? new Date(item.alteradoEm).toLocaleString('pt-BR') : '')}</td>
                                                            <td>${escapeHtml(item.registro || '')}</td>
                                                            <td>${escapeHtml(item.campo || '')}</td>
                                                            <td>${escapeHtml(formatarValorHistoricoParametroMinimo(item.valorAnterior))}</td>
                                                            <td>${escapeHtml(formatarValorHistoricoParametroMinimo(item.valorNovo))}</td>
                                                            <td class="text-end">
                                                                ${renderActionButton({
                                                                    type: 'cancel',
                                                                    label: `Reverter alteração ${String(item.id)}`,
                                                                    variant: 'outline-danger',
                                                                    backend: true,
                                                                    iconOnly: true,
                                                                    title: 'Reverter alteração',
                                                                    attributes: `data-parametros-reverter-historico="${escapeHtml(String(item.id))}" aria-label="Reverter alteração ${escapeHtml(String(item.id))}"`
                                                                })}
                                                            </td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    ` : '<div class="diagnostico-empty-state">Nenhuma alteração registrada.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                new window.bootstrap.Modal(document.getElementById('modalHistoricoParametrosMinimos')).show();
                document.querySelectorAll('[data-parametros-reverter-historico]').forEach((botao) => {
                    botao.addEventListener('click', () => {
                        reverterHistoricoParametrosMinimos(botao.dataset.parametrosReverterHistorico);
                    });
                });
            } catch (error) {
                alert(`Não foi possível carregar o histórico: ${error.message}`);
            }
        }

        function registrarEventosDiagnosticoOuvidorias(dados) {
            document.querySelectorAll('[data-diagnostico-uf]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const uf = botao.dataset.diagnosticoUf || '';

                    diagnosticoUfAtual = uf;
                    diagnosticoOuvidoriaAtual = null;
                    renderDiagnosticoOuvidoriasView();
                });
            });

            document.getElementById('diagnosticoRespostaAtual')?.addEventListener('change', (evento) => {
                diagnosticoOuvidoriaAtual = evento.target.value;
                renderDiagnosticoOuvidoriasView();
            });

            if (dadosPaginaEmModoEstatico('parametrosMinimos')) {
                aplicarModoSomenteLeitura();
                return;
            }

            document.getElementById('btnCancelarParametrosMinimos')?.addEventListener('click', () => {
                parametrosMinimosModoEdicao = false;
                parametrosMinimosAlteracoesPendentes = {};
                parametrosMinimosEditorAtivo = null;
                renderDiagnosticoOuvidoriasView();
            });

            document.getElementById('btnSalvarParametrosMinimos')?.addEventListener('click', () => {
                abrirModalSenhaParametrosMinimos(dados);
            });

            document.getElementById('btnExportarParametrosMinimos')?.addEventListener('click', () => {
                if (obterQuantidadeAlteracoesParametrosMinimos()) {
                    alert('Existem alterações não salvas. Salve antes de exportar para que o Excel reflita os dados atualizados.');
                    return;
                }

                window.location.href = obterUrlApiOnasp('/api/parametros-minimos/exportar');
            });

            document.getElementById('btnHistoricoParametrosMinimos')?.addEventListener('click', () => {
                abrirHistoricoParametrosMinimos();
            });

            document.querySelectorAll('[data-parametros-toggle-editor]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const editorId = botao.dataset.parametrosToggleEditor;
                    parametrosMinimosEditorAtivo = parametrosMinimosEditorAtivo === editorId ? null : editorId;
                    renderDiagnosticoOuvidoriasView();
                });
            });

            document.querySelectorAll('[data-parametros-opcao-registro]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    registrarAlteracaoParametroMinimo(
                        botao.dataset.parametrosOpcaoRegistro,
                        botao.dataset.parametrosOpcaoCampo,
                        botao.dataset.parametrosOpcaoOriginal,
                        botao.dataset.parametrosOpcaoValor
                    );
                });
            });

            document.querySelectorAll('[data-parametros-quantidade-registro]').forEach((campo) => {
                campo.addEventListener('change', () => {
                    const statusCalculado = calcularStatusQuantitativoParametroMinimo(
                        campo.value,
                        campo.dataset.parametrosQuantidadeIdeal
                    );

                    registrarAlteracaoParametroMinimo(
                        campo.dataset.parametrosQuantidadeRegistro,
                        campo.dataset.parametrosQuantidadeCampo,
                        campo.dataset.parametrosQuantidadeOriginal,
                        statusCalculado,
                        {
                            tipo: 'quantitativo',
                            quantidadeAtual: campo.value,
                            quantidadeAtualOriginal: campo.dataset.parametrosQuantidadeAtualOriginal,
                            quantidadeIdeal: campo.dataset.parametrosQuantidadeIdeal
                        }
                    );
                });
            });
        }

        function renderDiagnosticoOuvidoriasView(limparFiltros = false) {
            const container = document.getElementById('view-diagnostico-ouvidorias');
            const dados = obterDadosDiagnosticoOuvidorias();
            if (!container) return;

            container.style.display = 'block';

            const respostas = Array.isArray(dados?.respostas) ? dados.respostas : [];
            if (!dados || !dados.disponivel || respostas.length === 0) {
                container.innerHTML = `
                    <section class="view-heading">
                        <button type="button" class="btn btn-outline-secondary btn-icon-text pdf-hidden" onclick="toggleView('dashboard')">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span>Voltar ao Painel Geral</span>
                        </button>
                        <div>
                            <p class="section-eyebrow mb-1">Diagnóstico e conformidade</p>
                            <h2>Parâmetros Mínimos</h2>
                        </div>
                    </section>
                    ${renderEmptyState({
                        titulo: 'Nenhum dado de parâmetros mínimos disponível.',
                        descricao: 'Verifique a base local ou o arquivo parametros-minimos.json.',
                        icon: 'fa-clipboard-check'
                    })}
                `;
                aplicarModoSomenteLeitura();
                return;
            }

            const filtrosAtuais = limparFiltros ? {
                uf: '',
                unidade: '',
                statusGeral: '',
                eixo: '',
                statusParametro: '',
                validacao: '',
                deficit: ''
            } : obterFiltrosDiagnosticoOuvidorias();
            if (limparFiltros) diagnosticoUfAtual = '';
            const respostasFiltradas = aplicarFiltrosDiagnosticoOuvidorias(respostas, filtrosAtuais);
            const deveExibirDetalheUf = Boolean(filtrosAtuais.uf);

            if (!deveExibirDetalheUf) {
                diagnosticoOuvidoriaAtual = null;
            } else if (!diagnosticoOuvidoriaAtual || !respostasFiltradas.some((resposta) => resposta.idResposta === diagnosticoOuvidoriaAtual)) {
                diagnosticoOuvidoriaAtual = respostasFiltradas[0]?.idResposta || null;
            }

            const respostaAtual = deveExibirDetalheUf
                ? respostasFiltradas.find((resposta) => resposta.idResposta === diagnosticoOuvidoriaAtual)
                : null;
            const seletorRespostas = deveExibirDetalheUf && respostasFiltradas.length > 1 ? `
                <div class="diagnostico-current-selector">
                    <label class="visible-filter-title" for="diagnosticoRespostaAtual">Resposta analisada</label>
                    <select id="diagnosticoRespostaAtual" class="form-select">
                        ${respostasFiltradas.map((resposta) => `
                            <option value="${escapeHtml(resposta.idResposta)}" ${resposta.idResposta === diagnosticoOuvidoriaAtual ? 'selected' : ''}>
                                ${escapeHtml(`${resposta.uf} - ${resposta.unidadeDiagnosticada}`)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            ` : '';
            const avisoBase = dados.diagnostico.aviso
                ? `<div class="alert alert-info"><i class="fas fa-circle-info me-2" aria-hidden="true"></i>${escapeHtml(dados.diagnostico.aviso)}</div>`
                : '';

            container.innerHTML = `
                <section class="dashboard-intro diagnostico-intro">
                    <div>
                        <p class="section-eyebrow mb-1">Diagnóstico e conformidade</p>
                        <h2>Parâmetros Mínimos</h2>
                    </div>
                    <div class="intro-badges" aria-label="Resumo do diagnóstico">
                        <span><i class="fas fa-file-excel" aria-hidden="true"></i> Parametros_Minimos.xlsx</span>
                        <span><i class="fas fa-clipboard-check" aria-hidden="true"></i> ${dados.resumo.totalRespostas} registro(s)</span>
                        <span><i class="fas fa-scale-balanced" aria-hidden="true"></i> Validação ONASP</span>
                    </div>
                </section>

                ${renderizarAcoesParametrosMinimos()}
                ${renderizarAtalhosUfDiagnostico(dados, filtrosAtuais)}
                ${avisoBase}
                ${seletorRespostas}
                ${deveExibirDetalheUf && respostaAtual ? `
                    ${renderizarCabecalhoUfDiagnostico(respostaAtual)}
                    ${renderizarResumoConformidadeDiagnostico(respostaAtual)}
                    ${renderizarTrilhaParametrosDiagnostico(respostaAtual)}
                    ${renderizarFaltasParametrosMinimos(respostaAtual)}
                    ${renderizarProvidenciasParametrosMinimos(respostaAtual)}
                    ${renderizarDetalheTecnicoParametrosMinimos(respostaAtual)}
                ` : !deveExibirDetalheUf ? `
                    ${renderizarVisaoGeralParametrosDiagnostico(dados, respostasFiltradas)}
                ` : `
                    ${renderEmptyState({
                        titulo: 'Nenhuma resposta válida encontrada.',
                        descricao: 'Ajuste os filtros aplicados ou verifique se a planilha contém dados para a UF selecionada.',
                        icon: 'fa-magnifying-glass'
                    })}
                `}
            `;

            registrarEventosDiagnosticoOuvidorias(dados);
            aplicarModoSomenteLeitura();
        }

        // ========================================================================
        // CONTATOS
        // ========================================================================
        function exportarContatos() {
            const dadosContatos = obterDadosContatos();
            if (!dadosContatos || (!dadosContatos.cadastroPorUf.size && !dadosContatos.pessoasPorUf.size)) {
                return;
            }

            const ufsSet = new Set([...dadosContatos.cadastroPorUf.keys(), ...dadosContatos.pessoasPorUf.keys()]);
            const ufs = Array.from(ufsSet).sort();

            let csvContent = "UF;Estado;Órgão;Sigla;Endereço;Titular;Cargo Titular;E-mail Institucional;Telefone Institucional;Papel Contato;Nome Contato;Cargo Contato;Telefone Contato;E-mail Contato\n";

            ufs.forEach(uf => {
                const cadastro = dadosContatos.cadastroPorUf.get(uf) || {};
                const pessoas = dadosContatos.pessoasPorUf.get(uf) || [];

                const baseRow = [
                    uf,
                    cadastro.estado || '',
                    cadastro.orgao || '',
                    cadastro.sigla || '',
                    cadastro.endereco || '',
                    cadastro.nomeTitular || '',
                    cadastro.cargoTitular || '',
                    cadastro.emailInstitucional || '',
                    cadastro.telefoneInstitucional || ''
                ].map(val => `"${String(val).replace(/"/g, '""')}"`);

                if (pessoas.length === 0) {
                    csvContent += [...baseRow, '""', '""', '""', '""', '""'].join(';') + '\n';
                } else {
                    pessoas.forEach(p => {
                        const pessoaRow = [
                            p.papel || '',
                            p.nome || '',
                            p.cargo || '',
                            p.telefone || '',
                            p.email || ''
                        ].map(val => `"${String(val).replace(/"/g, '""')}"`);

                        csvContent += [...baseRow, ...pessoaRow].join(';') + '\n';
                    });
                }
            });

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.setAttribute('download', 'Contatos_UFs.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }

        function renderContatosView() {
            const container = document.getElementById('view-contatos');
            const dadosContatos = obterDadosContatos();

            if (!container) return;

            container.style.display = 'block';

            if (!dadosContatos || !dadosContatos.disponivel || (!dadosContatos.cadastroPorUf.size && !dadosContatos.pessoasPorUf.size)) {
                container.innerHTML = `
                    <section class="view-heading">
                        <button type="button" class="btn btn-outline-secondary btn-icon-text pdf-hidden" onclick="toggleView('dashboard')">
                            <i class="fas fa-arrow-left" aria-hidden="true"></i>
                            <span>Voltar ao Painel Geral</span>
                        </button>
                        <div>
                            <p class="section-eyebrow mb-1">Contatos institucionais</p>
                            <h2>Contatos das Unidades Federativas</h2>
                        </div>
                    </section>
                    ${renderEmptyState({
                        titulo: 'Dados de contatos indisponíveis.',
                        descricao: 'Verifique a planilha Planilhas/Contatos.xlsx e as abas Contatos_UF e Contatos_Pessoas.',
                        icon: 'fa-address-book'
                    })}
                `;
                aplicarModoSomenteLeitura();
                return;
            }

            const contatosUf = dadosContatos.cadastroPorUf ? Array.from(dadosContatos.cadastroPorUf.values()) : [];
            const contatosPessoas = dadosContatos.pessoasPorUf ? Array.from(dadosContatos.pessoasPorUf.values()).flat() : [];

            const grupos = montarGruposContatosPorUf(contatosUf, contatosPessoas);
            contatosMapaIndiceUf = obterIndiceContatosPorUf();

            container.innerHTML = `
                <section class="view-heading">
                    <button type="button" class="btn btn-outline-secondary btn-icon-text pdf-hidden" onclick="toggleView('dashboard')">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <span>Voltar ao Painel Geral</span>
                    </button>
                    <div>
                        <p class="section-eyebrow mb-1">Contatos institucionais</p>
                        <h2>Contatos das Unidades Federativas</h2>
                    </div>
                    <button type="button" class="btn btn-success btn-icon-text pdf-hidden" onclick="exportarContatos()">
                        <i class="fas fa-file-csv" aria-hidden="true"></i>
                        <span>Exportar CSV</span>
                    </button>
                </section>

                <section class="contatos-map-section" aria-labelledby="contatos-mapa-title">
                    <div class="contatos-section-head">
                        <p class="subpage-kicker">Rede de Ouvidorias</p>
                        <h2 id="contatos-mapa-title">Mapa interativo de contatos por UF</h2>
                        <p>Selecione uma unidade da federação no mapa ou na lista para visualizar os contatos cadastrados na base oficial da aplicação.</p>
                    </div>

                    <div class="contatos-map-toolbar">
                        <div class="contatos-map-picker">
                            <label for="contatos-uf-select">Ir direto para uma unidade da federação</label>
                            <select id="contatos-uf-select" name="contatos-uf-select">
                                <option value="">Selecione uma UF</option>
                            </select>
                        </div>
                        <p class="contatos-map-source">Fonte: base de contatos consolidada na aplicação ONASP.</p>
                    </div>

                    <div class="contatos-map-layout">
                        <div class="contatos-map-shell">
                            <div class="contatos-map-legend" aria-hidden="true">
                                <span class="legend-norte">Norte</span>
                                <span class="legend-nordeste">Nordeste</span>
                                <span class="legend-centro-oeste">Centro-Oeste</span>
                                <span class="legend-sudeste">Sudeste</span>
                                <span class="legend-sul">Sul</span>
                            </div>
                            <div id="contatos-map-grid" class="contatos-map-grid" role="group" aria-label="Mapa interativo do Brasil por unidade da federação"></div>
                        </div>

                        <article id="contatos-uf-panel" class="contatos-uf-panel" aria-live="polite">
                            <div class="contatos-state-head">
                                <h3>Selecione uma UF</h3>
                            </div>
                            <p>O painel lateral exibe o órgão gestor, o responsável informado, os canais de contato e as observações da UF selecionada.</p>
                        </article>
                    </div>
                </section>

                <section class="contacts-toolbar panel-section mb-3">
                    <div>
                        <p class="section-eyebrow mb-1">Consulta rápida</p>
                        <h3>Localize contatos por UF, órgão, nome, cargo, e-mail ou telefone</h3>
                    </div>
                    <div class="contacts-toolbar-actions">
                        <input
                            type="text"
                            id="filtro-contatos"
                            class="form-control"
                            placeholder="Buscar contatos..."
                            aria-label="Buscar contatos"
                        >
                    </div>
                </section>

                <section class="contact-uf-filter panel-section mb-3" aria-label="Filtro de contatos por UF">
                    <div class="contact-uf-filter-header">
                        <div>
                            <p class="section-eyebrow mb-1">Filtro por estado</p>
                            <h3>Selecione uma ou mais UFs</h3>
                        </div>
                        <button type="button" class="btn btn-outline-secondary btn-icon-text" id="btn-limpar-filtro-contatos-uf">
                            <i class="fas fa-undo" aria-hidden="true"></i>
                            <span>Limpar filtro</span>
                        </button>
                    </div>
                    <div class="contact-uf-chip-list" id="filtro-contatos-ufs">
                        ${renderFiltroUfsContatos(grupos)}
                    </div>
                </section>

                <section class="contacts-accordion" id="contacts-accordion">
                    ${grupos.length
                        ? grupos.map((grupo, index) => renderGrupoContatoUf(grupo, index)).join('')
                        : renderEmptyState({
                            titulo: 'Nenhum contato encontrado.',
                            descricao: 'Verifique se a planilha de contatos contém registros válidos.',
                            icon: 'fa-address-book'
                        })
                    }
                </section>
                <div class="d-none" id="contacts-filter-empty">
                    ${renderEmptyState({
                        titulo: 'Nenhum contato localizado.',
                        descricao: 'Ajuste o texto da busca ou os filtros de UF para ampliar os resultados.',
                        icon: 'fa-search'
                    })}
                </div>
            `;

            configurarEventosMapaContatos();
            configurarFiltroContatos();
            configurarCopiasHtmlOficioSei();
        }

        // Monta o índice por UF a partir da base oficial de contatos para evitar duplicidade de dados no frontend.
        function obterIndiceContatosPorUf() {
            const dadosContatos = obterDadosContatos();
            const indice = {};

            TODAS_UFS_BRASIL.forEach((uf) => {
                indice[uf] = {
                    uf,
                    nomeEstado: CONTATOS_MAPA_UFS[uf]?.nome || catalogoAplicacao.nomesEstados?.[uf] || uf,
                    regiao: CONTATOS_MAPA_UFS[uf]?.regiao || '',
                    dadosUf: {},
                    pessoas: []
                };
            });

            const cadastroPorUf = dadosContatos?.cadastroPorUf instanceof Map ? dadosContatos.cadastroPorUf : new Map();
            const pessoasPorUf = dadosContatos?.pessoasPorUf instanceof Map ? dadosContatos.pessoasPorUf : new Map();

            TODAS_UFS_BRASIL.forEach((uf) => {
                if (cadastroPorUf.has(uf)) {
                    indice[uf].dadosUf = { ...(cadastroPorUf.get(uf) || {}), uf };
                }

                if (pessoasPorUf.has(uf)) {
                    indice[uf].pessoas = Array.isArray(pessoasPorUf.get(uf)) ? [...pessoasPorUf.get(uf)] : [];
                }
            });

            return indice;
        }

        function obterValorContato(contato, chaves) {
            for (const chave of chaves) {
                const valor = contato?.[chave];
                if (valor !== undefined && valor !== null && String(valor).trim()) {
                    return String(valor).trim();
                }
            }

            return 'Não informado';
        }

        // Usa o primeiro e-mail válido para evitar links mailto quebrados quando a célula traz mais de um endereço.
        function obterPrimeiroEmailContato(valor) {
            const texto = String(valor || '').trim();
            const encontrado = texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
            return encontrado?.[0] || texto;
        }

        function renderizarCampoContatoMapa(rotulo, valor, tipo = 'texto') {
            const texto = valor && String(valor).trim() ? String(valor).trim() : 'Não informado';
            const conteudo = tipo === 'email' && texto !== 'Não informado'
                ? `<a href="mailto:${escapeHtml(obterPrimeiroEmailContato(texto))}">${escapeHtml(texto)}</a>`
                : escapeHtml(texto);

            return `
                <div class="contatos-state-field">
                    <dt>${escapeHtml(rotulo)}</dt>
                    <dd>${conteudo}</dd>
                </div>
            `;
        }

        function renderizarPainelContatoUf(uf) {
            const painel = document.getElementById('contatos-uf-panel');
            if (!painel) return;

            if (!uf || !CONTATOS_MAPA_UFS[uf]) {
                painel.innerHTML = `
                    <div class="contatos-state-head">
                        <h3>Selecione uma UF</h3>
                    </div>
                    <p>O painel lateral exibe o órgão gestor, o responsável informado, os canais de contato e as observações da UF selecionada.</p>
                `;
                return;
            }

            const dados = contatosMapaIndiceUf[uf] || {};
            const cadastro = dados.dadosUf || {};
            const pessoas = Array.isArray(dados.pessoas) ? dados.pessoas : [];
            const pessoaPrincipal = pessoas.find((pessoa) => (
                String(pessoa?.nome || '').trim()
                || String(pessoa?.email || '').trim()
                || String(pessoa?.telefone || '').trim()
            )) || pessoas[0] || {};

            const regiao = dados.regiao || CONTATOS_MAPA_UFS[uf]?.regiao || '';
            const orgao = obterValorContato(cadastro, ['orgao', 'Órgão_Entidade', 'Órgão Entidade', 'Orgao Entidade']);
            const responsavel = obterValorContato(cadastro, ['nomeTitular', 'nomeDestinatario', 'chefeGabinete']) !== 'Não informado'
                ? obterValorContato(cadastro, ['nomeTitular', 'nomeDestinatario', 'chefeGabinete'])
                : obterValorContato(pessoaPrincipal, ['nome', 'Nome', 'contato', 'Contato']);
            const email = obterValorContato(cadastro, ['emailInstitucional', 'emailTitular', 'emailGabinete', 'emailDestinatario']) !== 'Não informado'
                ? obterValorContato(cadastro, ['emailInstitucional', 'emailTitular', 'emailGabinete', 'emailDestinatario'])
                : obterValorContato(pessoaPrincipal, ['email', 'Email']);
            const telefone = obterValorContato(cadastro, ['telefoneInstitucional', 'telefoneTitular', 'contatoChefe', 'contatoSecretaria', 'ramaisGabinete']) !== 'Não informado'
                ? obterValorContato(cadastro, ['telefoneInstitucional', 'telefoneTitular', 'contatoChefe', 'contatoSecretaria', 'ramaisGabinete'])
                : obterValorContato(pessoaPrincipal, ['telefone', 'Telefone', 'celular', 'Celular']);
            const whatsapp = obterValorContato(cadastro, ['whatsapp', 'celularTitular', 'telefoneCelularDestinatario']) !== 'Não informado'
                ? obterValorContato(cadastro, ['whatsapp', 'celularTitular', 'telefoneCelularDestinatario'])
                : obterValorContato(pessoaPrincipal, ['whatsapp', 'telefone', 'celular']);
            const endereco = obterValorContato(cadastro, ['endereco', 'enderecoDestinatario', 'Endereço', 'Endereco']);
            const falaBr = obterValorContato(cadastro, ['falaBr', 'usoFalaBr', 'uso_do_fala_br']);
            const observacoes = obterValorContato(cadastro, ['observacoes', 'Observações', 'Observacao']);

            painel.innerHTML = `
                <div class="contatos-state-head">
                    <h3>${escapeHtml(cadastro.estado || CONTATOS_MAPA_UFS[uf]?.nome || uf)}</h3>
                    <span class="contatos-region-chip ${escapeHtml(CONTATOS_MAPA_REGION_CLASSES[regiao] || '')}">${escapeHtml(regiao || 'Não informado')}</span>
                </div>
                <p class="contatos-state-orgao">${escapeHtml(orgao)}</p>
                <p class="contatos-state-meta">${escapeHtml(String(pessoas.length))} contato${pessoas.length === 1 ? '' : 's'} cadastrado${pessoas.length === 1 ? '' : 's'} nesta UF.</p>
                <dl class="contatos-state-details">
                    ${renderizarCampoContatoMapa('UF', uf)}
                    ${renderizarCampoContatoMapa('Estado', cadastro.estado || CONTATOS_MAPA_UFS[uf]?.nome || uf)}
                    ${renderizarCampoContatoMapa('Região', regiao || 'Não informado')}
                    ${renderizarCampoContatoMapa('Órgão gestor', orgao)}
                    ${renderizarCampoContatoMapa('Responsável / Ouvidor', responsavel)}
                    ${renderizarCampoContatoMapa('E-mail', email, 'email')}
                    ${renderizarCampoContatoMapa('Telefone', telefone)}
                    ${renderizarCampoContatoMapa('WhatsApp', whatsapp)}
                    ${renderizarCampoContatoMapa('Endereço', endereco)}
                    ${renderizarCampoContatoMapa('Fala.BR', falaBr)}
                    ${renderizarCampoContatoMapa('Observações', observacoes)}
                </dl>
                ${pessoas.length ? `
                    <div class="contatos-state-contacts">
                        ${renderPessoasContato(pessoas)}
                    </div>
                ` : `
                    <p class="contatos-state-note">Nenhum contato nominal foi encontrado para esta UF.</p>
                `}
            `;
        }

        // Replica o painel interativo do protótipo com marcadores posicionados no fundo SVG local.
        function renderizarMarcadoresMapaContatos() {
            const grid = document.getElementById('contatos-map-grid');
            if (!grid) return;

            grid.innerHTML = TODAS_UFS_BRASIL.map((uf) => {
                const dadosVisuais = CONTATOS_MAPA_UFS[uf];
                if (!dadosVisuais) return '';

                const destaque = CONTATOS_MAPA_DESTAQUES[uf] || {};
                const classes = [
                    'contatos-map-button',
                    CONTATOS_MAPA_REGION_CLASSES[dadosVisuais.regiao] || ''
                ].filter(Boolean).join(' ');
                const ativo = contatosMapaUfAtual === uf;
                const isCallout = destaque.variante === 'callout';
                const atributosExtras = isCallout
                    ? `style="--x: ${dadosVisuais.x}%; --y: ${dadosVisuais.y}%; --label-x: ${destaque.labelX}px; --label-y: ${destaque.labelY}px; --marker-z: ${destaque.z}; --line-length: ${Math.max(Math.hypot(destaque.labelX, destaque.labelY) - 16, 8).toFixed(1)}px; --line-angle: ${Math.atan2(destaque.labelY, destaque.labelX) * 180 / Math.PI}deg;"`
                    : `style="--x: ${dadosVisuais.x}%; --y: ${dadosVisuais.y}%;"`

                return `
                    <button
                        type="button"
                        class="${classes} ${isCallout ? 'is-callout' : ''}"
                        data-uf="${escapeHtml(uf)}"
                        aria-label="Selecionar ${escapeHtml(dadosVisuais.nome)}"
                        aria-pressed="${ativo ? 'true' : 'false'}"
                        ${atributosExtras}
                    >
                        ${isCallout ? '<span class="contatos-map-marker-line" aria-hidden="true"></span>' : ''}
                        <span class="contatos-map-marker-pin" aria-hidden="true"></span>
                        <span class="contatos-map-marker-code" aria-hidden="true">${escapeHtml(uf)}</span>
                    </button>
                `;
            }).join('');
        }

        function selecionarUfContatoMapa(uf) {
            const ufNormalizada = String(uf || '').trim().toUpperCase();
            contatosMapaUfAtual = CONTATOS_MAPA_UFS[ufNormalizada] ? ufNormalizada : '';

            if (!contatosMapaUfAtual) {
                renderizarPainelContatoUf('');
            } else {
                renderizarPainelContatoUf(contatosMapaUfAtual);
            }

            const select = document.getElementById('contatos-uf-select');
            if (select && select.value !== contatosMapaUfAtual) {
                select.value = contatosMapaUfAtual;
            }

            document.querySelectorAll('.contatos-map-button').forEach((button) => {
                const isActive = button.dataset.uf === contatosMapaUfAtual;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        function configurarEventosMapaContatos() {
            const select = document.getElementById('contatos-uf-select');
            const grid = document.getElementById('contatos-map-grid');

            if (!select || !grid) return;

            renderizarMarcadoresMapaContatos();

            const opcoesUf = TODAS_UFS_BRASIL.map((uf) => {
                const meta = CONTATOS_MAPA_UFS[uf];
                return `<option value="${escapeHtml(uf)}">${escapeHtml(uf)} - ${escapeHtml(meta?.nome || uf)}</option>`;
            }).join('');
            select.innerHTML = `<option value="">Selecione uma UF</option>${opcoesUf}`;

            const ufsComDados = TODAS_UFS_BRASIL.filter((uf) => {
                const entrada = contatosMapaIndiceUf[uf];
                return Boolean(entrada && ((entrada.dadosUf && Object.keys(entrada.dadosUf).length) || (entrada.pessoas && entrada.pessoas.length)));
            });
            const ufInicial = contatosMapaUfAtual && CONTATOS_MAPA_UFS[contatosMapaUfAtual]
                ? contatosMapaUfAtual
                : (ufsComDados[0] || TODAS_UFS_BRASIL[0] || '');

            select.addEventListener('change', (event) => {
                selecionarUfContatoMapa(event.target.value);
            });

            grid.addEventListener('click', (event) => {
                const botao = event.target.closest('.contatos-map-button');
                if (!botao) return;
                selecionarUfContatoMapa(botao.dataset.uf);
            });

            selecionarUfContatoMapa(ufInicial);
        }

        function montarGruposContatosPorUf(contatosUf, contatosPessoas) {
            const mapa = new Map();

            contatosUf.forEach((item) => {
                const uf = normalizarUfContato(item.uf || item.UF || item.estado || item.Estado);
                if (!uf) return;

                const nomeEstado = item.nomeEstado || item.estado || item.Estado || catalogoAplicacao.nomesEstados?.[uf] || uf;

                if (!mapa.has(uf)) {
                    mapa.set(uf, {
                        uf,
                        nomeEstado,
                        dadosUf: item,
                        pessoas: []
                    });
                } else {
                    mapa.get(uf).dadosUf = {
                        ...mapa.get(uf).dadosUf,
                        ...item
                    };
                }
            });

            contatosPessoas.forEach((pessoa) => {
                const uf = normalizarUfContato(pessoa.uf || pessoa.UF || pessoa.estado || pessoa.Estado);
                if (!uf) return;

                if (!mapa.has(uf)) {
                    mapa.set(uf, {
                        uf,
                        nomeEstado: catalogoAplicacao.nomesEstados?.[uf] || uf,
                        dadosUf: {},
                        pessoas: []
                    });
                }

                mapa.get(uf).pessoas.push(pessoa);
            });

            return Array.from(mapa.values()).map((grupo) => ({
                ...grupo,
                destinatarioOficio: grupo.dadosUf?.destinatarioOficio || normalizarDestinatarioOficioGrupoContato(grupo)
            })).sort((a, b) => {
                const ordemA = TODAS_UFS_BRASIL.indexOf(a.uf);
                const ordemB = TODAS_UFS_BRASIL.indexOf(b.uf);

                if (ordemA !== -1 && ordemB !== -1) return ordemA - ordemB;
                return a.uf.localeCompare(b.uf, 'pt-BR');
            });
        }

        function normalizarUfContato(valor) {
            const texto = String(valor || '').trim().toUpperCase();
            const uf = texto.match(/\b[A-Z]{2}\b/)?.[0] || texto;
            return TODAS_UFS_BRASIL.includes(uf) ? uf : '';
        }

        function renderBandeiraContatoUf(uf) {
            const flagUrl = catalogoAplicacao.imagensBandeiras?.[uf] || '';
            const safeUf = escapeHtml(uf);
            const safeFlagUrl = escapeHtml(flagUrl);

            if (!flagUrl) {
                return `
                    <span class="contact-uf-flag-placeholder" aria-hidden="true">
                        <i class="fas fa-flag"></i>
                    </span>
                `;
            }

            return `
                <img
                    src="${safeFlagUrl}"
                    alt="Bandeira ${safeUf}"
                    class="contact-uf-flag"
                    onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.classList.remove('d-none');"
                >
                <span class="contact-uf-flag-placeholder d-none" aria-hidden="true">
                    <i class="fas fa-flag"></i>
                </span>
            `;
        }

        function renderGrupoContatoUf(grupo, index) {
            const collapseId = `contatos-uf-${grupo.uf}`;
            const pessoas = grupo.pessoas || [];
            const textoBusca = montarTextoBuscaGrupoContato(grupo);

            return `
                <article class="contact-uf-card" data-contact-search="${escapeHtml(textoBusca)}" data-contact-uf="${escapeHtml(grupo.uf)}">
                    <button
                        class="contact-uf-bar"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#${collapseId}"
                        aria-expanded="false"
                        aria-controls="${collapseId}"
                    >
                        <span class="contact-uf-main">
                            <span class="contact-uf-identity">
                                ${renderBandeiraContatoUf(grupo.uf)}
                                <span class="contact-uf-sigla">${escapeHtml(grupo.uf)}</span>
                            </span>
                            <span class="contact-uf-name">${escapeHtml(grupo.nomeEstado || grupo.uf)}</span>
                        </span>

                        <span class="contact-uf-meta">
                            <span>${pessoas.length} contato${pessoas.length === 1 ? '' : 's'}</span>
                            <i class="fas fa-chevron-down" aria-hidden="true"></i>
                        </span>
                    </button>

                    <div id="${collapseId}" class="collapse" data-bs-parent="#contacts-accordion">
                        <div class="contact-uf-body">
                            ${renderDadosInstitucionaisUf(grupo.dadosUf)}
                            ${renderPessoasContato(grupo.pessoas)}
                            ${renderGeradorHtmlOficioSei(grupo)}
                        </div>
                    </div>
                </article>
            `;
        }

        function renderDadosInstitucionaisUf(dadosUf = {}) {
            // Esconde chaves técnicas que sustentam a lógica da tela, mas não devem virar cards visíveis.
            const camposOcultos = new Set(['uf', 'UF', 'estado', 'Estado', 'nomeEstado', 'destinatarioOficio']);
            const entradas = Object.entries(dadosUf)
                .filter(([chave, valor]) => (
                    !camposOcultos.has(chave)
                    && valor !== null
                    && valor !== undefined
                    && typeof valor !== 'object'
                    && String(valor).trim() !== ''
                ));

            if (!entradas.length) {
                return renderEmptyState({
                    titulo: 'Sem dados institucionais específicos.',
                    descricao: 'Esta UF não possui dados institucionais complementares registrados.',
                    icon: 'fa-building'
                });
            }

            return `
                <div class="contact-section">
                    <h4>Dados institucionais</h4>
                    <div class="contact-info-grid">
                        ${entradas.map(([chave, valor]) => `
                            <div class="contact-info-item">
                                <span>${escapeHtml(formatarRotuloContato(chave))}</span>
                                <strong>${formatarValorContato(valor)}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderPessoasContato(pessoas = []) {
            if (!Array.isArray(pessoas) || pessoas.length === 0) {
                return `
                    <div class="contact-section">
                        <h4>Contatos nominais</h4>
                        ${renderEmptyState({
                            titulo: 'Nenhum contato nominal informado.',
                            descricao: 'Esta UF ainda não possui nomes de referência cadastrados.',
                            icon: 'fa-user-group'
                        })}
                    </div>
                `;
            }

            return `
                <div class="contact-section">
                    <h4>Contatos nominais</h4>
                    <div class="contact-person-grid">
                        ${pessoas.map((pessoa) => renderCardPessoaContato(pessoa)).join('')}
                    </div>
                </div>
            `;
        }

        function renderCardPessoaContato(pessoa = {}) {
            const nome = pessoa.nome || pessoa.Nome || pessoa.contato || pessoa.Contato || 'Contato não identificado';
            const cargo = pessoa.cargo || pessoa.Cargo || pessoa.funcao || pessoa.Função || pessoa.funcaoContato || '';
            const orgao = pessoa.orgao || pessoa.órgão || pessoa.Orgao || pessoa['Órgão'] || '';
            const email = pessoa.email || pessoa.Email || pessoa.eMail || '';
            const telefone = pessoa.telefone || pessoa.Telefone || pessoa.celular || pessoa.Celular || '';

            return `
                <div class="contact-person-card">
                    <div class="contact-person-name">${escapeHtml(nome)}</div>
                    ${cargo ? `<div class="contact-person-role">${escapeHtml(cargo)}</div>` : ''}
                    ${orgao ? `<div class="contact-person-org">${escapeHtml(orgao)}</div>` : ''}

                    <div class="contact-person-links">
                        ${email ? `
                            <a href="mailto:${escapeHtml(email)}">
                                <i class="fas fa-envelope" aria-hidden="true"></i>
                                ${escapeHtml(email)}
                            </a>
                        ` : ''}
                        ${telefone ? `
                            <a href="tel:${escapeHtml(String(telefone).replace(/\D/g, ''))}">
                                <i class="fas fa-phone" aria-hidden="true"></i>
                                ${escapeHtml(telefone)}
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        function montarTextoBuscaGrupoContato(grupo) {
            return [
                grupo.uf,
                grupo.nomeEstado,
                ...Object.values(grupo.dadosUf || {}),
                ...(grupo.pessoas || []).flatMap((pessoa) => Object.values(pessoa || {}))
            ]
                .join(' ')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        }

        function renderFiltroUfsContatos(grupos = []) {
            return grupos.length
                ? grupos.map((grupo) => `
                    <button
                        type="button"
                        class="contact-uf-filter-chip"
                        data-contact-filter-uf="${escapeHtml(grupo.uf)}"
                        title="${escapeHtml(grupo.nomeEstado || grupo.uf)}"
                        aria-pressed="false"
                    >
                        ${escapeHtml(grupo.uf)}
                    </button>
                `).join('')
                : '<span class="filter-count-empty">Nenhuma UF disponível</span>';
        }

        function contatoMarcadoComoDestinatarioOficio(contato = {}) {
            const tipo = normalizarBusca(contato.tipoContato || '').replace(/[^a-z0-9]+/g, '');
            return valorContatoEhSim(contato.destinatarioOficioFlag)
                || tipo === 'secretariotitular'
                || tipo === 'destinatariooficio';
        }

        function valorContatoEhSim(valor) {
            return ['sim', 's', 'true', '1', 'destinatario', 'destinatário'].includes(normalizarBusca(valor || ''));
        }

        function textoContatoPossuiValor(valor) {
            const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
            return Boolean(texto && texto !== '-' && normalizarBusca(texto) !== 'nao informado' && normalizarBusca(texto) !== 'n a');
        }

        function primeiroCampoContato(valores = []) {
            return valores.find(textoContatoPossuiValor) || '';
        }

        function valoresUnicosContato(valores = []) {
            return Array.from(new Set(
                valores
                    .flatMap((valor) => String(valor ?? '').split(/[;|]+/))
                    .map((valor) => valor.replace(/\s+/g, ' ').trim())
                    .filter(textoContatoPossuiValor)
            ));
        }

        function emailsValidosContato(valores = []) {
            return Array.from(new Set(
                valores
                    .flatMap((valor) => String(valor ?? '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
                    .map((email) => email.trim())
            ));
        }

        function telefoneContatoValido(valor) {
            return String(valor ?? '').replace(/\D/g, '').length >= 8;
        }

        function cadastroTemDestinatarioExplicitoContato(cadastro = {}) {
            return [
                cadastro.tratamentoDestinatario,
                cadastro.nomeDestinatario,
                cadastro.cargoDestinatario,
                cadastro.enderecoDestinatario,
                cadastro.emailDestinatario,
                cadastro.telefoneFixoDestinatario,
                cadastro.telefoneCelularDestinatario
            ].some(textoContatoPossuiValor) || contatoMarcadoComoDestinatarioOficio(cadastro);
        }

        // Fallback local para grupos montados no frontend; deve espelhar a regra
        // do data-service para manter o HTML SEI determinístico mesmo em dados legados.
        function normalizarDestinatarioOficioGrupoContato(grupo = {}) {
            const cadastro = grupo.dadosUf || {};
            const pessoas = Array.isArray(grupo.pessoas) ? grupo.pessoas : [];
            const pessoasDestinatarias = pessoas.filter(contatoMarcadoComoDestinatarioOficio);
            const fonteOficial = cadastroTemDestinatarioExplicitoContato(cadastro)
                ? cadastro
                : pessoasDestinatarias[0];
            const fonteLegada = textoContatoPossuiValor(cadastro.nomeTitular) || textoContatoPossuiValor(cadastro.cargoTitular)
                ? cadastro
                : null;
            const fonte = fonteOficial || fonteLegada || {};
            const origem = fonteOficial
                ? (fonteOficial === cadastro ? 'cadastro_destinatario' : 'pessoa_destinataria')
                : fonteLegada
                    ? 'cadastro_legado'
                    : '';
            const candidatosOficiais = [
                ...(cadastroTemDestinatarioExplicitoContato(cadastro) ? [cadastro] : []),
                ...pessoasDestinatarias
            ];
            const destinatario = {
                origem,
                inferido: origem === 'cadastro_legado',
                duplicado: candidatosOficiais.length > 1,
                tratamento: primeiroCampoContato([fonte.tratamentoDestinatario, cadastro.tratamentoDestinatario]),
                nome: primeiroCampoContato([fonte.nomeDestinatario, fonte.nome, cadastro.nomeDestinatario, cadastro.nomeTitular]),
                cargo: primeiroCampoContato([fonte.cargoDestinatario, fonte.cargo, cadastro.cargoDestinatario, cadastro.cargoTitular]),
                endereco: primeiroCampoContato([fonte.enderecoDestinatario, cadastro.enderecoDestinatario, cadastro.endereco]),
                complemento: primeiroCampoContato([fonte.complementoEnderecoDestinatario, cadastro.complementoEnderecoDestinatario]),
                bairro: primeiroCampoContato([fonte.bairroDestinatario, cadastro.bairroDestinatario]),
                cep: primeiroCampoContato([fonte.cepDestinatario, cadastro.cepDestinatario, cadastro.cep]),
                cidade: primeiroCampoContato([fonte.cidadeDestinatario, cadastro.cidadeDestinatario, cadastro.estado]),
                uf: primeiroCampoContato([fonte.siglaUfDestinatario, fonte.uf, cadastro.siglaUfDestinatario, cadastro.uf, grupo.uf]),
                telefones: valoresUnicosContato([
                    cadastro.contatoSecretaria,
                    fonte.telefoneFixoDestinatario,
                    fonte.telefoneCelularDestinatario,
                    fonte.telefone,
                    cadastro.telefoneFixoDestinatario,
                    cadastro.telefoneCelularDestinatario,
                    cadastro.telefoneTitular,
                    cadastro.celularTitular,
                    cadastro.ramaisGabinete
                ]),
                emails: emailsValidosContato([
                    fonte.emailDestinatario,
                    cadastro.emailDestinatario,
                    cadastro.emailGabinete,
                    cadastro.emailTitular,
                    fonte.email
                ])
            };
            const camposFaltantes = [];
            if (!textoContatoPossuiValor(destinatario.nome)) camposFaltantes.push('nome');
            if (!textoContatoPossuiValor(destinatario.cargo)) camposFaltantes.push('cargo');
            if (!textoContatoPossuiValor(destinatario.endereco)) camposFaltantes.push('endereço');
            if (!destinatario.telefones.some(telefoneContatoValido)) camposFaltantes.push('telefone');
            if (!destinatario.emails.length) camposFaltantes.push('e-mail');
            destinatario.camposFaltantes = camposFaltantes;
            destinatario.completo = camposFaltantes.length === 0;
            destinatario.temDados = [
                destinatario.tratamento,
                destinatario.nome,
                destinatario.cargo,
                destinatario.endereco,
                destinatario.cep,
                destinatario.cidade,
                destinatario.uf,
                ...destinatario.telefones,
                ...destinatario.emails
            ].some(textoContatoPossuiValor);
            return destinatario;
        }

        // Renderiza somente o bloco de endereçamento aceito pelo SEI; o botão é
        // bloqueado quando não existe nenhuma linha real para copiar.
        function renderGeradorHtmlOficioSei(grupo) {
            const textareaId = `html-oficio-sei-${grupo.uf}`;
            const htmlOficio = gerarHtmlOficioSei(grupo);
            const destinatario = obterDestinatarioSecretario(grupo);
            const podeCopiar = htmlOficio.trim().length > 0;
            const classeValidacao = destinatario.completo ? 'success' : 'warning';

            return `
                <section class="sei-html-generator">
                    <div class="sei-html-generator-header">
                        <div>
                            <p class="section-eyebrow mb-1">Modelo SEI</p>
                            <h4>Endereçamento HTML</h4>
                            <p>
                                Trecho de endereçamento do(a) Secretário(a) pronto para colar no SEI.
                            </p>
                        </div>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary btn-icon-text btn-copy-sei-html"
                            data-target="${textareaId}"
                            ${podeCopiar ? '' : 'disabled aria-disabled="true"'}
                        >
                            <i class="fas fa-copy" aria-hidden="true"></i>
                            <span>Copiar HTML</span>
                        </button>
                    </div>

                    <div class="sei-address-validation sei-address-${classeValidacao}">
                        <strong>Endereçamento completo: ${destinatario.completo ? 'Sim' : 'Não'}</strong>
                        ${destinatario.camposFaltantes?.length ? `<span>Campos faltantes: ${escapeHtml(destinatario.camposFaltantes.join(', '))}</span>` : ''}
                        ${destinatario.inferido ? '<span>Destinatário inferido pelo cadastro legado da UF.</span>' : ''}
                        ${destinatario.duplicado ? '<span>Há mais de um destinatário oficial marcado para esta UF.</span>' : ''}
                    </div>

                    <textarea
                        id="${textareaId}"
                        class="sei-html-textarea"
                        readonly
                        spellcheck="false"
                        aria-label="HTML do endereçamento SEI para ${escapeHtml(grupo.uf)}"
                    >${escapeHtml(htmlOficio)}</textarea>
                </section>
            `;
        }

        function gerarHtmlOficioSei(grupo) {
            const destinatario = obterDestinatarioSecretario(grupo);
            const linhas = [
                obterVocativoSeiDestinatario(destinatario),
                destinatario.nome ? `<strong>${escapeHtml(destinatario.nome)}</strong>` : '',
                destinatario.cargo ? escapeHtml(destinatario.cargo) : '',
                montarLinhaEnderecoDestinatario(destinatario),
                montarLinhaLocalidadeDestinatario(destinatario),
                destinatario.telefones?.length ? destinatario.telefones.map(escapeHtml).join(' / ') : '',
                destinatario.emails?.length ? destinatario.emails.map(escapeHtml).join(' / ') : ''
            ].filter(Boolean);

            if (!linhas.length) return '';

            return `<p class="Texto_Alinhado_Esquerda_Espaçamento_Simples" data-c="3">
${linhas.map((linha, index) => `    ${linha}${index < linhas.length - 1 ? '<br>' : ''}`).join('\n')}
</p>

<p class="Texto_Alinhado_Esquerda_Espaçamento_Simples" data-c="4">
    &nbsp;
</p>`;
        }

        function montarLinhaEnderecoDestinatario(destinatario) {
            const enderecoBase = [destinatario.endereco, destinatario.complemento]
                .filter(Boolean)
                .join(' ');
            const linha = [enderecoBase, destinatario.bairro]
                .filter(Boolean)
                .join(', ');

            return linha ? escapeHtml(linha) : '';
        }

        function montarLinhaLocalidadeDestinatario(destinatario) {
            const cidadeUf = destinatario.cidade && destinatario.uf
                ? `${destinatario.cidade}/${destinatario.uf}`
                : destinatario.cidade || destinatario.uf;
            const linha = destinatario.cep && cidadeUf
                ? `${destinatario.cep} – ${cidadeUf}`
                : destinatario.cep || cidadeUf;

            return linha ? escapeHtml(linha) : '';
        }

        // Padroniza o vocativo do HTML SEI para as formas pedidas na tela de contatos.
        function obterVocativoSeiDestinatario(destinatario = {}) {
            const genero = inferirGeneroDestinatario(destinatario);
            if (genero === 'feminino') return 'À senhora';
            if (genero === 'masculino') return 'Ao senhor';

            const tratamento = String(destinatario.tratamento || '').trim();
            return tratamento ? escapeHtml(tratamento) : 'Ao senhor';
        }

        function inferirGeneroDestinatario(destinatario = {}) {
            const pistas = [
                destinatario.tratamento,
                destinatario.cargo,
                destinatario.nome
            ]
                .filter(Boolean)
                .join(' ');
            const texto = normalizarBusca(pistas);

            if (!texto) return '';

            if (/(^|\b)(senhora|sra|secretaria|governadora|ministra|presidenta|diretora|ouvidora|defensora|procuradora|coordenadora)(\b|$)/.test(texto)) {
                return 'feminino';
            }

            if (/(^|\b)(senhor|sr|secretario|governador|ministro|presidente|diretor|ouvidor|defensor|procurador|coordenador)(\b|$)/.test(texto)) {
                return 'masculino';
            }

            return '';
        }

        function obterDestinatarioSecretario(grupo) {
            return grupo.destinatarioOficio || normalizarDestinatarioOficioGrupoContato(grupo);
        }

        function configurarCopiasHtmlOficioSei() {
            document.querySelectorAll('.btn-copy-sei-html').forEach((botao) => {
                botao.addEventListener('click', async () => {
                    const targetId = botao.dataset.target;
                    const textarea = document.getElementById(targetId);

                    if (!textarea) return;

                    try {
                        await navigator.clipboard.writeText(textarea.value);
                        sinalizarCopiaHtmlSei(botao, true);
                    } catch (error) {
                        textarea.focus();
                        textarea.select();
                        const sucesso = document.execCommand('copy');
                        sinalizarCopiaHtmlSei(botao, sucesso);
                    }
                });
            });
        }

        function sinalizarCopiaHtmlSei(botao, sucesso) {
            const conteudoOriginal = botao.innerHTML;

            botao.innerHTML = sucesso
                ? '<i class="fas fa-check" aria-hidden="true"></i><span>Copiado</span>'
                : '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>Erro ao copiar</span>';

            botao.classList.toggle('btn-outline-primary', !sucesso);
            botao.classList.toggle('btn-success', sucesso);
            botao.classList.toggle('btn-outline-danger', !sucesso);

            setTimeout(() => {
                botao.innerHTML = conteudoOriginal;
                botao.classList.add('btn-outline-primary');
                botao.classList.remove('btn-success', 'btn-outline-danger');
            }, 1800);
        }

        function configurarFiltroContatos() {
            const input = document.getElementById('filtro-contatos');
            const cards = Array.from(document.querySelectorAll('.contact-uf-card'));
            const chips = Array.from(document.querySelectorAll('[data-contact-filter-uf]'));
            const btnLimparUf = document.getElementById('btn-limpar-filtro-contatos-uf');
            const ufsSelecionadas = new Set();

            if (!input || cards.length === 0) return;

            const aplicarFiltros = () => {
                const termo = input.value
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim();
                let visiveis = 0;

                cards.forEach((card) => {
                    const textoBusca = card.dataset.contactSearch || '';
                    const ufCard = card.dataset.contactUf || '';
                    const matchTexto = !termo || textoBusca.includes(termo);
                    const matchUf = ufsSelecionadas.size === 0 || ufsSelecionadas.has(ufCard);
                    const visivel = matchTexto && matchUf;
                    card.classList.toggle('d-none', !visivel);
                    if (visivel) visiveis += 1;
                });

                document.getElementById('contacts-filter-empty')?.classList.toggle('d-none', visiveis > 0);
            };

            input.addEventListener('input', aplicarFiltros);

            chips.forEach((chip) => {
                chip.addEventListener('click', () => {
                    const uf = chip.dataset.contactFilterUf || '';
                    if (!uf) return;

                    if (ufsSelecionadas.has(uf)) {
                        ufsSelecionadas.delete(uf);
                    } else {
                        ufsSelecionadas.add(uf);
                    }

                    chip.classList.toggle('active', ufsSelecionadas.has(uf));
                    chip.setAttribute('aria-pressed', String(ufsSelecionadas.has(uf)));
                    aplicarFiltros();
                });
            });

            btnLimparUf?.addEventListener('click', () => {
                ufsSelecionadas.clear();
                chips.forEach((chip) => {
                    chip.classList.remove('active');
                    chip.setAttribute('aria-pressed', 'false');
                });
                aplicarFiltros();
            });
        }

        function formatarRotuloContato(chave) {
            return String(chave || '')
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^./, (letra) => letra.toUpperCase());
        }

        function formatarValorContato(valor) {
            const texto = escapeHtml(String(valor || '-'));

            if (texto.includes('@')) {
                return `<a href="mailto:${texto}">${texto}</a>`;
            }

            return texto;
        }

        // --- FUNÇÕES UTILITÁRIAS (COMPARTILHADAS) ---

        const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);

        const normalizarBusca = (valor) => String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

        const debounceOnasp = (fn, delay = 180) => {
            let timeoutId = null;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = window.setTimeout(() => fn(...args), delay);
            };
        };

        const formatMoney = (val) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
        const formatPercent = (val) => val ? val.toFixed(1).replace('.', ',') + '%' : '0,0%';
        const getProgressWidth = (p) => Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
        
        const getProgressColor = (p) => {
            if (p <= 0.1) return '#bdc3c7'; // Cinza para 0%
            if (p < 50) return '#f39c12'; // Laranja/Amarelo para < 50%
            if (p < 100) return '#3498db'; // Azul para < 100%
            return '#1abc9c'; // Verde para 100%
        };

        function gerarCoresVariadas(count) {
            // Base de cores convertidas para RGB para podermos usar transparência nas barras
            const bases = [
                '52, 152, 219', '231, 76, 60', '46, 204, 113', '155, 89, 182', '241, 196, 15', 
                '230, 126, 34', '26, 188, 156', '52, 73, 94', '211, 84, 0', '192, 57, 43',
                '142, 68, 173', '41, 128, 185', '39, 174, 96', '243, 156, 18', '127, 140, 141'
            ];
            return Array.from({ length: count }, (_, i) => bases[i % bases.length]);
        }

        function getInstrumentoBadge(inst) {
            if (!inst) return '<span class="badge badge-inst-default">N/A</span>';
            
            const normalized = normalizarBusca(inst).toUpperCase();
            const safeInst = escapeHtml(inst);
            if (normalized.includes("FAF")) return `<span class="badge badge-inst-faf" title="${safeInst}">FAF</span>`;
            if (normalized.includes("CONV")) return `<span class="badge badge-inst-convenio" title="${safeInst}">CVN</span>`;
            if (normalized.includes("DOA")) return `<span class="badge badge-inst-doacao" title="${safeInst}">DOA</span>`;
            
            return `<span class="badge badge-inst-default">${escapeHtml(String(inst).substring(0,3))}</span>`;
        }

        function renderUfChips(containerId, ufs) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = ufs.length
                ? ufs.map((uf) => `<span class="uf-chip" onclick="abrirDetalheEstado('${escapeHtml(uf)}')">${escapeHtml(uf)}</span>`).join('')
                : '<span class="kpi-desc">Nenhuma UF</span>';
            container.setAttribute('title', ufs.length ? ufs.join(', ') : 'Nenhuma UF');
        }

        function atualizarMiniPizzaInstrumento(pieId, labelId, percentual) {
            const pie = document.getElementById(pieId);
            const label = document.getElementById(labelId);
            const valor = Number.isFinite(Number(percentual)) ? Math.max(0, Math.min(100, Number(percentual))) : 0;
            const texto = formatPercent(valor);

            if (pie) {
                pie.style.setProperty('--pie-angle', `${valor * 3.6}deg`);
                pie.setAttribute('title', `${texto} executado`);
            }

            if (label) label.textContent = texto;
        }

        function renderKPIs(global, ufsList, resumoInstrumentos) {
            // Calcular Total de Fomento = Total Repassado + Total em Doações
            const totalRepassado = Number(global.totalContratado) || 0;
            const totalDoado = Number(global.totalDoado) || 0;
            const totalFomentoOuvidoria = totalRepassado + totalDoado;
            
            $('#kpi-total-fomento-ouvidoria').text(formatMoney(totalFomentoOuvidoria)).attr('title', formatMoney(totalFomentoOuvidoria));
            $('#kpi-total-contratado').text(formatMoney(global.totalContratado)).attr('title', formatMoney(global.totalContratado));
            $('#kpi-total-executado').text(formatMoney(global.totalExecutado)).attr('title', formatMoney(global.totalExecutado));
            $('#kpi-percentual-global').text(formatPercent(global.percentual));
            $('#kpi-total-doado').text(formatMoney(global.totalDoado)).attr('title', formatMoney(global.totalDoado));

            const convenios = resumoInstrumentos.convenios;
            const faf = resumoInstrumentos.faf;
            const doacao = resumoInstrumentos.doacao;

            $('#kpi-total-convenios').text(formatMoney(convenios.total)).attr('title', formatMoney(convenios.total));
            $('#kpi-percentual-convenios').text(formatPercent(convenios.percentual));
            $('#kpi-desc-convenios').text(`Executado: ${formatMoney(convenios.executado)}`);
            atualizarMiniPizzaInstrumento('mini-pie-convenios', 'mini-pie-convenios-label', convenios.percentual);
            $('#kpi-ufs-convenios-qtd').text(convenios.quantidadeUfs);
            renderUfChips('kpi-ufs-convenios-lista', convenios.ufs);

            $('#kpi-total-faf').text(formatMoney(faf.total)).attr('title', formatMoney(faf.total));
            $('#kpi-percentual-faf').text(formatPercent(faf.percentual));
            $('#kpi-desc-faf').text(`Executado: ${formatMoney(faf.executado)}`);
            atualizarMiniPizzaInstrumento('mini-pie-faf', 'mini-pie-faf-label', faf.percentual);
            $('#kpi-ufs-faf-qtd').text(faf.quantidadeUfs);
            renderUfChips('kpi-ufs-faf-lista', faf.ufs);

            $('#kpi-ufs-doacao-qtd').text(doacao.quantidadeUfs);
            renderUfChips('kpi-ufs-doacao-lista', doacao.ufs);
        }

        function renderChart(dadosPorUF) {
            const ctx = document.getElementById('chartExecucaoUF').getContext('2d');
            const labels = dadosPorUF.map(d => d.uf);
            const dataValues = dadosPorUF.map(d => d.percentual);
            const baseColors = gerarCoresVariadas(dadosPorUF.length);
            const bgColors = baseColors.map(rgb => `rgba(${rgb}, 0.5)`);
            const borderColors = baseColors.map(rgb => `rgba(${rgb}, 1)`);
            const maxPercentual = Math.max(100, ...dataValues);
            const maxEscala = Math.ceil(maxPercentual / 10) * 10;

            if (chartInstancia) {
                chartInstancia.$dadosPorUF = dadosPorUF;
                chartInstancia.data.labels = labels;
                chartInstancia.data.datasets[0].data = dataValues;
                chartInstancia.data.datasets[0].backgroundColor = bgColors;
                chartInstancia.data.datasets[0].borderColor = borderColors;
                chartInstancia.options.scales.x.max = maxEscala;
                chartInstancia.update();
                return;
            }

            chartInstancia = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '% Execução',
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const item = ctx.chart.$dadosPorUF?.[ctx.dataIndex];
                                    if (!item) return '';
                                    return `Exec: ${formatPercent(item.percentual)} (${formatMoney(item.exec)})`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, max: maxEscala, ticks: { callback: v => v + '%' } },
                        y: { grid: { display: false } }
                    },
                    onClick: (_e, els, chart) => {
                        const uf = chart.data.labels?.[els[0]?.index];
                        if (uf) aplicarFiltroUF(uf);
                    },
                    onHover: (e, els) => {
                        e.native.target.style.cursor = els[0] ? 'pointer' : 'default';
                    }
                }
            });
            chartInstancia.$dadosPorUF = dadosPorUF;
        }

        function initTable(data) {
            const tbody = document.querySelector('#tabelaItens tbody');
            tbody.innerHTML = '';

            data.forEach((row, index) => {
                const vTotal = parseFloat(row.valorTotal) || 0;
                const vExec = parseFloat(row.valorExecutado) || 0;
                const percent = vTotal > 0 ? (vExec / vTotal) * 100 : 0;
                const execucaoAcimaPrevisto = vExec - vTotal > 0.01;
                const safeInstrumento = escapeHtml(row.instrumento);
                const safeUf = escapeHtml(row.uf);
                const safeObjeto = escapeHtml(row.objeto);
                const safeQuantidade = escapeHtml(row.quantidade);

                const tr = document.createElement('tr');
                tr.dataset.itemIndex = String(index);
                if (execucaoAcimaPrevisto) tr.classList.add('table-warning');
                tr.innerHTML = `
                    <td data-label="Instrumento" class="text-center align-middle"><span class="d-none">${safeInstrumento}</span>${getInstrumentoBadge(row.instrumento)}</td>
                    <td data-label="UF" class="align-middle"><span class="badge bg-secondary badge-uf">${safeUf}</span></td>
                    <td data-label="Objeto" title="${safeObjeto}" class="align-middle"><span class="truncate-text">${safeObjeto}</span></td>
                    <td data-label="Qtd." class="text-center align-middle">${safeQuantidade}</td>
                    <td data-label="Valor Unit. (R$)" class="text-end font-monospace small align-middle">${formatMoney(row.valorUnitario)}</td>
                    <td data-label="Valor Total (R$)" class="text-end font-monospace align-middle">${formatMoney(vTotal)}</td>
                    <td data-label="Executado (R$)" class="text-end align-middle ${vExec > 0 ? 'text-success fw-bold' : 'text-muted'} font-monospace">
                        ${formatMoney(vExec)}
                    </td>
                    <td data-label="%" class="text-center align-middle" title="${execucaoAcimaPrevisto ? 'Execucao acima do valor previsto' : ''}">
                        <div class="custom-progress-pill">
                            <div class="pill-fill" style="width: ${getProgressWidth(percent)}%; background-color: ${getProgressColor(percent)}"></div>
                            <div class="pill-text">${formatPercent(percent)}</div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            tabelaInstancia = $('#tabelaItens').DataTable({
                language: DATATABLES_LANGUAGE_PT_BR,
                destroy: true, 
            autoWidth: false,
            paging: true, 
            pageLength: 15,
            lengthMenu: [15, 50, 100, 500],
            info: true, 
            dom: '<"row align-items-center mb-3"<"col-md-6"l><"col-md-6 text-end"B>>rt<"row align-items-center mt-3"<"col-md-6"i><"col-md-6"p>>',
            buttons: [
                {
                    extend: 'excelHtml5',
                    text: '<i class="fas fa-file-excel me-1"></i> Exportar Excel',
                    className: 'btn btn-success btn-sm shadow-sm',
                    title: 'Relatorio_Fomento_Ouvidoria'
                }
            ],
                order: [[1, 'asc'], [7, 'desc']], 
                columnDefs: [
                    { width: '5%', targets: 0 }, 
                    { width: '5%', targets: 1 }, 
                    { width: '30%', targets: 2 } 
                ]
            });
        }

        // --- LÓGICA MULTI-SELECT ---

        function obterRegiaoPorUf(uf) {
            return ORDEM_REGIOES.find((regiao) => (catalogoAplicacao.regioes[regiao] || []).includes(uf)) || '';
        }

        function obterConfigFiltro(key, filtroAtual) {
            const config = {
                regiao: {
                    checkAll: filtroAtual.checkAllRegiao,
                    checkedValues: filtroAtual.checkedRegioes,
                    itemClass: 'check-item-regiao'
                },
                instrumento: {
                    checkAll: filtroAtual.checkAllInst,
                    checkedValues: filtroAtual.checkedInsts,
                    itemClass: 'check-item-instrumento'
                },
                uf: {
                    checkAll: filtroAtual.checkAllUF,
                    checkedValues: filtroAtual.checkedUFs,
                    itemClass: 'check-item-uf'
                }
            };

            return config[key];
        }

        function ordenarValoresFiltro(key, values) {
            const valores = Array.from(new Set(values.filter(Boolean)));

            if (key === 'uf') {
                const ufsOrdenadas = TODAS_UFS_BRASIL.filter((uf) => valores.includes(uf));
                const ufsExtras = valores.filter((uf) => !TODAS_UFS_BRASIL.includes(uf)).sort();
                return [...ufsOrdenadas, ...ufsExtras];
            }

            if (key === 'regiao') {
                return ORDEM_REGIOES.filter((regiao) => valores.includes(regiao));
            }

            return valores.sort();
        }

        function populateMultiSelect(containerId, key, values, filtroAtual) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            const sortedValues = ordenarValoresFiltro(key, values);
            const config = obterConfigFiltro(key, filtroAtual);
            const checkAll = config.checkAll;
            const checkedValues = config.checkedValues;
            const valoresSelecionadosValidos = sortedValues.filter((val) => checkAll || checkedValues.has(val));
            const selecaoAnteriorFicouIndisponivel = checkedValues.size > 0 && valoresSelecionadosValidos.length === 0;
            const deveMarcarTodos = checkAll || selecaoAnteriorFicouIndisponivel;

            const allOption = document.createElement('div');
            allOption.className = 'visible-check-option check-all-option';
            allOption.innerHTML = `
                <input class="form-check-input check-all" type="checkbox" value="all" id="checkAll-${key}" ${deveMarcarTodos ? 'checked' : ''} ${sortedValues.length === 0 ? 'disabled' : ''}>
                <label class="visible-check-label fw-bold" for="checkAll-${key}">
                    Todos
                </label>
            `;
            container.appendChild(allOption);

            if (sortedValues.length === 0) {
                const emptyOption = document.createElement('div');
                emptyOption.className = 'visible-check-empty';
                emptyOption.textContent = 'Nenhuma opcao disponivel';
                container.appendChild(emptyOption);
                return;
            }

            const criarOpcaoFiltro = (val, idx, extraClass = '') => {
                const option = document.createElement('div');
                option.className = `visible-check-option ${extraClass}`.trim();
                const safeVal = escapeHtml(val);
                const safeId = escapeHtml(`chk-${key}-${idx}`);
                const checked = deveMarcarTodos || checkedValues.has(val);
                option.innerHTML = `
                    <input class="form-check-input ${config.itemClass}" type="checkbox" value="${safeVal}" id="${safeId}" ${checked ? 'checked' : ''}>
                    <label class="visible-check-label" for="${safeId}">
                        ${safeVal}
                    </label>
                `;
                return option;
            };

            const ufsSemOuvidoriaDisponiveis = key === 'uf'
                ? sortedValues.filter((uf) => UFS_SEM_OUVIDORIA_ESPECIFICA.includes(uf))
                : [];
            const valoresPrincipais = key === 'uf'
                ? sortedValues.filter((uf) => !UFS_SEM_OUVIDORIA_ESPECIFICA.includes(uf))
                : sortedValues;

            valoresPrincipais.forEach((val, idx) => {
                const option = criarOpcaoFiltro(val, idx);
                container.appendChild(option);
            });

            if (ufsSemOuvidoriaDisponiveis.length > 0) {
                const grupoEspecial = document.createElement('div');
                grupoEspecial.className = 'uf-special-group';
                grupoEspecial.innerHTML = '<div class="uf-special-title">UFs sem Ouvidoria Específica</div>';

                const opcoesGrupo = document.createElement('div');
                opcoesGrupo.className = 'uf-special-options';

                ufsSemOuvidoriaDisponiveis.forEach((val, idx) => {
                    opcoesGrupo.appendChild(criarOpcaoFiltro(val, `sem-ouvidoria-${idx}`, 'uf-special-option'));
                });

                grupoEspecial.appendChild(opcoesGrupo);
                container.appendChild(grupoEspecial);
            }
        }

        function itemPassaFiltrosParciais(item, filtro, ignorarKey) {
            const regiaoItem = obterRegiaoPorUf(item.uf);
            const matchRegiao = ignorarKey === 'regiao' || filtro.checkAllRegiao || filtro.checkedRegioes.has(regiaoItem);
            const matchUF = ignorarKey === 'uf' || filtro.checkAllUF || filtro.checkedUFs.has(item.uf);
            const matchInst = ignorarKey === 'instrumento' || filtro.checkAllInst || filtro.checkedInsts.has(item.instrumento);
            const matchTexto = filtro.textoNormalizado
                ? normalizarBusca(item.objeto).includes(filtro.textoNormalizado)
                : true;

            return matchRegiao && matchUF && matchInst && matchTexto;
        }

        function obterValoresDisponiveisFiltro(key, filtro) {
            return dadosFaf
                .filter((item) => itemPassaFiltrosParciais(item, filtro, key))
                .map((item) => key === 'regiao' ? obterRegiaoPorUf(item.uf) : item[key])
                .filter(Boolean);
        }

        function filtrosIguais(a, b) {
            const setsIguais = (setA, setB) => setA.size === setB.size && Array.from(setA).every((valor) => setB.has(valor));

            return a.textoNormalizado === b.textoNormalizado
                && a.checkAllRegiao === b.checkAllRegiao
                && a.checkAllInst === b.checkAllInst
                && a.checkAllUF === b.checkAllUF
                && setsIguais(a.checkedRegioes, b.checkedRegioes)
                && setsIguais(a.checkedInsts, b.checkedInsts)
                && setsIguais(a.checkedUFs, b.checkedUFs);
        }

        function atualizarOpcoesFiltrosVisiveis(filtroBase = obterEstadoFiltroAtual()) {
            let filtroAtual = filtroBase;

            for (let i = 0; i < 4; i++) {
                const regioesDisponiveis = obterValoresDisponiveisFiltro('regiao', filtroAtual);
                populateMultiSelect('filtroRegiaoOpcoes', 'regiao', regioesDisponiveis, filtroAtual);

                const filtroAposRegioes = obterEstadoFiltroAtual();
                const instrumentosDisponiveis = obterValoresDisponiveisFiltro('instrumento', filtroAposRegioes);
                populateMultiSelect('filtroInstrumentoOpcoes', 'instrumento', instrumentosDisponiveis, filtroAposRegioes);

                const filtroAposInstrumentos = obterEstadoFiltroAtual();
                const ufsDisponiveis = obterValoresDisponiveisFiltro('uf', filtroAposInstrumentos);
                populateMultiSelect('filtroUFOpcoes', 'uf', ufsDisponiveis, filtroAposInstrumentos);

                const filtroAtualizado = obterEstadoFiltroAtual();
                if (filtrosIguais(filtroAtualizado, filtroAtual)) {
                    return filtroAtualizado;
                }

                filtroAtual = filtroAtualizado;
            }

            return obterEstadoFiltroAtual();
        }

        function obterEstadoFiltroAtual() {
            const checkAllRegiao = document.getElementById('checkAll-regiao')?.checked ?? true;
            const checkAllInst = document.getElementById('checkAll-instrumento')?.checked ?? true;
            const checkAllUF = document.getElementById('checkAll-uf')?.checked ?? true;

            return {
                texto: $('#filtroObjeto').val() || '',
                textoNormalizado: normalizarBusca($('#filtroObjeto').val()),
                checkAllRegiao,
                checkedRegioes: new Set(Array.from(document.querySelectorAll('.check-item-regiao:checked')).map(cb => cb.value)),
                checkAllInst,
                checkedInsts: new Set(Array.from(document.querySelectorAll('.check-item-instrumento:checked')).map(cb => cb.value)),
                checkAllUF,
                checkedUFs: new Set(Array.from(document.querySelectorAll('.check-item-uf:checked')).map(cb => cb.value))
            };
        }

        function itemPassaFiltros(item, filtro) {
            const regiaoItem = obterRegiaoPorUf(item.uf);
            const matchRegiao = filtro.checkAllRegiao || filtro.checkedRegioes.has(regiaoItem);
            const matchUF = filtro.checkAllUF || filtro.checkedUFs.has(item.uf);
            const matchInst = filtro.checkAllInst || filtro.checkedInsts.has(item.instrumento);
            const matchTexto = filtro.textoNormalizado
                ? normalizarBusca(item.objeto).includes(filtro.textoNormalizado)
                : true;

            return matchRegiao && matchUF && matchInst && matchTexto;
        }

        function obterDadosFiltrados(filtro = obterEstadoFiltroAtual()) {
            return dadosFaf.filter((item) => itemPassaFiltros(item, filtro));
        }

        function registrarFiltroDataTable() {
            if (filtroDataTableRegistrado || !$.fn.dataTable?.ext?.search) return;

            $.fn.dataTable.ext.search.push((settings, _searchData, dataIndex) => {
                if (settings.nTable?.id !== 'tabelaItens' || !filtroTabelaAtual) {
                    return true;
                }

                const rowNode = settings.aoData[dataIndex]?.nTr;
                const itemIndex = Number(rowNode?.dataset?.itemIndex);
                const item = dadosFaf[itemIndex];
                return item ? itemPassaFiltros(item, filtroTabelaAtual) : false;
            });

            filtroDataTableRegistrado = true;
        }

        function setupEventListeners() {
            $(document).off('change.filtrosAplicacao');

            ['regiao', 'instrumento', 'uf'].forEach(key => {
                $(document).on('change.filtrosAplicacao', `#checkAll-${key}`, function() {
                    const isChecked = $(this).is(':checked');
                    $(`.check-item-${key}`).prop('checked', isChecked);
                    aplicarFiltrosCombinados();
                });

                $(document).on('change.filtrosAplicacao', `.check-item-${key}`, function() {
                    const allChecked = $(`.check-item-${key}`).length === $(`.check-item-${key}:checked`).length;
                    $(`#checkAll-${key}`).prop('checked', allChecked);
                    aplicarFiltrosCombinados();
                });
            });

            $('#filtroObjeto').off('input.filtrosAplicacao').on('input.filtrosAplicacao', function() {
                aplicarFiltrosCombinados();
            });
            
            const reset = () => {
                $('.check-all').prop('checked', true);
                $('.form-check-input').prop('checked', true); 
                $('#filtroObjeto').val('');
                aplicarFiltrosCombinados();
            };

            $('#btnLimparFiltros, #filtroAtivoBadge').off('click.filtrosAplicacao').on('click.filtrosAplicacao', reset);
        }

        function aplicarFiltrosCombinados() {
            const filtro = atualizarOpcoesFiltrosVisiveis(obterEstadoFiltroAtual());
            filtroTabelaAtual = filtro;
            
            if (tabelaInstancia) {
                tabelaInstancia.search('').columns().search('').draw();
            }

            const anyFilterActive = !filtro.checkAllRegiao || !filtro.checkAllInst || !filtro.checkAllUF || filtro.textoNormalizado.length > 0;
            
            if (anyFilterActive) {
                $('#textoFiltroAtivo').text("Filtros Ativos");
                $('#filtroAtivoBadge').css('display', 'inline-block');
            } else {
                $('#filtroAtivoBadge').hide();
            }

            atualizarCardsDinamicos(filtro);
            renderChart(processarDadosAgregados(obterDadosFiltrados(filtro)).dadosPorUF);
    }
        
        function aplicarFiltroUF(uf) {
            $(`#checkAll-regiao`).prop('checked', true);
            $(`.check-item-regiao`).prop('checked', true);
            $(`#checkAll-uf`).prop('checked', false);
            $(`.check-item-uf`).prop('checked', false);
            $(`.check-item-uf[value="${uf}"]`).prop('checked', true);
            
            aplicarFiltrosCombinados();
        }

        function renderUfChipsFiltro(containerId, ufs) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = ufs.length
                ? ufs.map((uf) => `<button type="button" class="uf-chip" onclick="aplicarFiltroUF('${escapeHtml(uf)}')" title="${escapeHtml(catalogoAplicacao.nomesEstados?.[uf] || uf)}">${escapeHtml(uf)}</button>`).join('')
                : '<span class="filter-count-empty">Nenhuma UF</span>';
            container.setAttribute('title', ufs.length ? ufs.join(', ') : 'Nenhuma UF');
        }

        function atualizarContadoresUfsPorInstrumento(dadosFiltrados) {
            const resumoInstrumentos = calcularResumoInstrumentos(dadosFiltrados);
            const ufsComAlgumInstrumento = Array.from(new Set([
                ...resumoInstrumentos.convenios.ufs,
                ...resumoInstrumentos.faf.ufs,
                ...resumoInstrumentos.doacao.ufs
            ])).sort();

            $('#count-convenios').text(resumoInstrumentos.convenios.quantidadeUfs);
            $('#count-faf').text(resumoInstrumentos.faf.quantidadeUfs);
            $('#count-doacoes').text(resumoInstrumentos.doacao.quantidadeUfs);
            $('#count-ufs-instrumentos').text(ufsComAlgumInstrumento.length);

            renderUfChipsFiltro('count-convenios-ufs', resumoInstrumentos.convenios.ufs);
            renderUfChipsFiltro('count-faf-ufs', resumoInstrumentos.faf.ufs);
            renderUfChipsFiltro('count-doacoes-ufs', resumoInstrumentos.doacao.ufs);
            renderUfChipsFiltro('count-ufs-instrumentos-lista', ufsComAlgumInstrumento);
        }

        function atualizarCardsDinamicos(filtro = obterEstadoFiltroAtual()) {
            const dadosFiltrados = obterDadosFiltrados(filtro);
            atualizarContadoresUfsPorInstrumento(dadosFiltrados);

            const qtdItens = dadosFiltrados.length;
            const resumoFinanceiro = calcularResumoFinanceiro(dadosFiltrados);

            const elRep = $('#dyn-total-repassado');
            const txtRep = formatMoney(resumoFinanceiro.totalRepassado);
            elRep.text(txtRep).attr('title', txtRep);

            const elExec = $('#dyn-total-executado');
            const txtExec = formatMoney(resumoFinanceiro.totalExecutado);
            elExec.text(txtExec).attr('title', txtExec);

            $('#dyn-total-doado').text(formatMoney(resumoFinanceiro.totalDoado)).attr('title', formatMoney(resumoFinanceiro.totalDoado));
            $('#dyn-percentual').text(formatPercent(resumoFinanceiro.percentual));
            $('#dyn-qtd-itens').text(qtdItens);
        }

window.toggleView = toggleView;
window.abrirDetalheEstado = abrirDetalheEstado;
window.abrirDetalheConvenioProfor = abrirDetalheConvenioProfor;
window.abrirDetalheFormalizacaoProfor = abrirDetalheFormalizacaoProfor;
window.abrirDetalheFaf2021 = abrirDetalheFaf2021;
window.abrirDetalheDoacoes2023 = abrirDetalheDoacoes2023;
window.abrirSelecaoUfExportacao = abrirSelecaoUfExportacao;
window.exportarRelatorioEstadoSelecionado = exportarRelatorioEstadoSelecionado;
window.exportarDashboardPDF = exportarDashboardPDF;
window.exportarRelatorioPDF = exportarRelatorioPDF;
window.exportarOrcamentoPDF = exportarOrcamentoPDF;
window.exportarContatos = exportarContatos;
window.abrirSeletorManualPlanilha = abrirSeletorManualPlanilha;
window.abrirOrcamento = () => toggleView('orcamento');
window.abrirFormalizacaoProfor = () => toggleView('formalizacao');
window.abrirDiagnosticoOuvidorias = () => toggleView('diagnostico-ouvidorias');
window.abrirStatusSistema = () => toggleView('status-sistema');
window.abrirEditorExecucaoFaf2021 = abrirEditorExecucaoFaf2021;
window.fecharEditorExecucaoFaf2021 = fecharEditorExecucaoFaf2021;
window.salvarExecucaoFaf2021 = salvarExecucaoFaf2021;
window.abrirEditorFormalizacao = abrirEditorFormalizacao;
window.cancelarEdicaoFormalizacao = cancelarEdicaoFormalizacao;
window.salvarAlteracoesFormalizacao = salvarAlteracoesFormalizacao;
window.aplicarFiltroUF = aplicarFiltroUF;

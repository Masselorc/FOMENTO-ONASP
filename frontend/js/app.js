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
    resolverOrigemDadosProfor2022Local,
    carregarConsolidadoProfor2022BancoCacheLocal,
    obterDadosOrcamento,
    obterDadosContatos,
    carregarDadosContatos,
    fetchJsonApiOnasp,
    obterUrlApiOnasp,
    obterModoDadosOnasp,
    estaEmModoPublicacaoEstatica
} from '../../backend/services/data-service.js?v=20260525-02-data-service-pad';
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
} from './core/static-mode.js?v=20260518-01';

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
let avisoFallbackProfor2022 = null;
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
let carteiraMonitoradaProfor2022Cache = [];
let revisaoDivergenciasEstado = {
    auditoria: null,
    divergencias: [],
    total: 0,
    detalheAtualId: null
};
let revisoesPlanoPadEstado = {
    dados: null,
    ufSelecionada: '',
    expandidos: new Set(),
    filtros: {
        area: '',
        natureza: '',
        situacao: '',
        tipo: '',
        texto: '',
        somentePendencias: false,
        mostrarSuprimidos: true
    },
    editorParentId: null
};
const APP_CACHE_VERSION = '20260507-05';
const ANALYTICS_CACHE_VERSION = '20260428-2';
const TEMPO_MAXIMO_CARREGAMENTO_ORCAMENTO_MS = 15000;

function orcamentoEmModoPublicacaoEstatico() {
    return obterModoDadosOnasp('orcamento2026') === 'estatico';
}

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

function executarComTimeoutOnasp(promise, ms, mensagem) {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error(mensagem));
        }, ms);

        Promise.resolve(promise).then(
            (resultado) => {
                window.clearTimeout(timeoutId);
                resolve(resultado);
            },
            (error) => {
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
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
    allocate: 'fa-right-left',
    share: 'fa-share-nodes'
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
    },
    'revisao-divergencias': {
        titulo: 'Não foi possível carregar Revisão de divergências.',
        detalhe: 'Verifique se o servidor local está ativo e se a fila de revisão PAD x memória foi gerada.'
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

    let finalVariant = variant;
    if (type === 'cancel' && (variant === 'outline-secondary' || variant === 'secondary' || variant === 'outline-primary')) {
        finalVariant = 'danger';
    }

    return `
        <button type="button"
            class="btn btn-${size} btn-${finalVariant} ${iconOnly ? 'btn-icon-only' : 'btn-icon-text'} ${extraClass}"
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

        function formatarResumoUltimaAtualizacaoDetruProfor2022(ultimaAtualizacao) {
            if (!ultimaAtualizacao) {
                return 'Última atualização DETRU: nenhuma atualização registrada.';
            }

            const concluidoEm = ultimaAtualizacao.concluidoEm || ultimaAtualizacao.concluido_em || ultimaAtualizacao.iniciadoEm || ultimaAtualizacao.iniciado_em;
            const sucesso = ultimaAtualizacao.sucesso === true || ultimaAtualizacao.sucesso === 1;
            const totalEncontrados = Number(ultimaAtualizacao.totalEncontrados ?? ultimaAtualizacao.total_encontrados ?? 0);
            const statusLabel = sucesso ? 'Concluído' : (concluidoEm ? 'Crítico' : 'Em andamento');
            const partes = [
                formatarDataStatusSistema(concluidoEm),
                sucesso ? 'sucesso' : (concluidoEm ? 'falha' : 'em andamento')
            ];

            if (Number.isFinite(totalEncontrados)) {
                partes.push(`${totalEncontrados.toLocaleString('pt-BR')} convênio(s) encontrados`);
            }

            if (ultimaAtualizacao.erro) {
                partes.push(ultimaAtualizacao.erro);
            }

            return {
                statusLabel,
                resumo: `Última atualização DETRU: ${partes.filter(Boolean).join(' • ')}`
            };
        }

        function renderStatusUltimaAtualizacaoDetruProfor2022(ultimaAtualizacao) {
            if (!ultimaAtualizacao) {
                return `
                    <div class="small text-muted" id="profor-detru-status" aria-live="polite">
                        Última atualização DETRU: nenhuma atualização registrada.
                    </div>
                `;
            }

            const { statusLabel, resumo } = formatarResumoUltimaAtualizacaoDetruProfor2022(ultimaAtualizacao);
            return `
                <div class="d-flex flex-wrap align-items-center gap-2 small text-muted" id="profor-detru-status" aria-live="polite">
                    ${renderStatusBadge(statusLabel)}
                    <span>${escapeHtml(resumo)}</span>
                </div>
            `;
        }

        function renderMensagemDetruProfor2022(tipo, mensagem) {
            const variante = tipo === 'success'
                ? 'success'
                : tipo === 'warning'
                    ? 'warning'
                    : 'danger';

            return `
                <div class="alert alert-${variante} py-2 px-3 small mb-0" role="${variante === 'danger' ? 'alert' : 'status'}">
                    ${escapeHtml(mensagem)}
                </div>
            `;
        }

        function mostrarMensagemDetruProfor2022(tipo, mensagem) {
            const feedbackEl = document.getElementById('profor-detru-feedback');
            if (!feedbackEl) return;
            feedbackEl.innerHTML = renderMensagemDetruProfor2022(tipo, mensagem);
        }

        async function carregarStatusUltimaAtualizacaoDetruProfor2022() {
            const statusEl = document.getElementById('profor-detru-status');
            if (!statusEl || estaEmModoPublicacaoEstatica()) return;

            statusEl.innerHTML = '<div class="small text-muted"><i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>Carregando status da última atualização DETRU...</div>';

            try {
                const { payload } = await fetchJsonApiOnasp('/api/profor-2022/detru/ultima-atualizacao');
                if (!payload.success) throw new Error(payload.message || 'Não foi possível carregar o status DETRU.');
                statusEl.outerHTML = renderStatusUltimaAtualizacaoDetruProfor2022(payload.ultimaAtualizacao);
            } catch (err) {
                statusEl.outerHTML = `
                    <div class="small text-warning" id="profor-detru-status" aria-live="polite">
                        Última atualização DETRU indisponível. ${escapeHtml(err.message || 'Tente novamente mais tarde.')}
                    </div>
                `;
            }
        }

        async function atualizarCacheDetruProfor2022UI() {
            if (estaEmModoPublicacaoEstatica()) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return { sucesso: false, cancelado: true };
            }

            const botao = document.getElementById('btnAtualizarDetruProfor');
            if (!confirm('Atualizar o cache DETRU agora?')) return { sucesso: false, cancelado: true };

            if (botao) botao.disabled = true;
            mostrarMensagemDetruProfor2022('warning', 'Atualizando cache DETRU...');

            try {
                const { payload } = await fetchJsonApiOnasp('/api/profor-2022/detru/atualizar', {
                    method: 'POST'
                });

                if (!payload.success) {
                    throw new Error(payload.message || 'Não foi possível atualizar o DETRU.');
                }

                mostrarMensagemDetruProfor2022('success', payload.message || 'Cache DETRU atualizado com sucesso.');
                await carregarStatusUltimaAtualizacaoDetruProfor2022();
                const incluirInativos = document.getElementById('carteiraIncluirInativos')?.checked ?? false;
                await carregarCarteiraMonitoradaProfor2022(incluirInativos);
                // Falha em recarregar diagnostico NAO deve marcar a atualizacao como erro.
                try { await carregarDiagnosticoAtualizacoesProfor2022(); }
                catch (e) { console.warn('Falha ao recarregar diagnostico apos DETRU:', e); }
                return { sucesso: true, mensagem: payload.message || 'Cache DETRU atualizado com sucesso.' };
            } catch (err) {
                mostrarMensagemDetruProfor2022('danger', err.message || 'Erro ao atualizar o DETRU.');
                return { sucesso: false, mensagem: err.message || 'Erro ao atualizar o DETRU.' };
            } finally {
                if (botao) botao.disabled = false;
            }
        }

        function renderMensagemConsolidadoProfor2022(tipo, mensagem) {
            const variante = tipo === 'success'
                ? 'success'
                : tipo === 'warning'
                    ? 'warning'
                    : 'danger';

            return `
                <div class="alert alert-${variante} py-2 px-3 small mb-0" role="${variante === 'danger' ? 'alert' : 'status'}">
                    ${escapeHtml(mensagem)}
                </div>
            `;
        }

        function mostrarMensagemConsolidadoProfor2022(tipo, mensagem) {
            const feedbackEl = document.getElementById('profor-consolidado-feedback');
            if (!feedbackEl) return;
            feedbackEl.innerHTML = renderMensagemConsolidadoProfor2022(tipo, mensagem);
        }

        const progressoAtualizacaoSistema = {
            timerId: null,
            percentual: 0
        };

        function obterElementosProgressoAtualizacaoSistema() {
            return {
                container: document.getElementById('profor-atualizacao-progresso-container'),
                barra: document.getElementById('profor-atualizacao-progresso-barra'),
                texto: document.getElementById('profor-atualizacao-progresso-texto'),
                percentual: document.getElementById('profor-atualizacao-progresso-percentual')
            };
        }

        function limparTimerProgressoAtualizacaoSistema() {
            if (!progressoAtualizacaoSistema.timerId) return;
            window.clearInterval(progressoAtualizacaoSistema.timerId);
            progressoAtualizacaoSistema.timerId = null;
        }

        function atualizarProgressoAtualizacaoSistema(tipo, percentual, texto, estado = 'andamento') {
            const { container, barra, texto: textoEl, percentual: percentualEl } = obterElementosProgressoAtualizacaoSistema();
            if (!container || !barra || !textoEl || !percentualEl) return;

            const valorSeguro = Math.max(0, Math.min(100, Number(percentual) || 0));
            progressoAtualizacaoSistema.percentual = valorSeguro;

            container.classList.remove('d-none');
            barra.style.width = `${valorSeguro}%`;
            barra.setAttribute('aria-valuenow', String(valorSeguro));
            percentualEl.textContent = `${Math.round(valorSeguro)}%`;
            textoEl.textContent = texto || 'Atualização em andamento';
            barra.classList.remove('bg-info', 'bg-success', 'bg-danger', 'progress-bar-animated');

            if (estado === 'sucesso') {
                barra.classList.add('bg-success');
            } else if (estado === 'erro') {
                barra.classList.add('bg-danger');
            } else {
                barra.classList.add('bg-info', 'progress-bar-animated');
            }
        }

        function iniciarProgressoAtualizacaoSistema(tipo) {
            limparTimerProgressoAtualizacaoSistema();
            atualizarProgressoAtualizacaoSistema(tipo, 0, 'Atualização em andamento', 'andamento');
            progressoAtualizacaoSistema.timerId = window.setInterval(() => {
                const atual = progressoAtualizacaoSistema.percentual;
                const incremento = atual < 70 ? (4 / 3) : (atual < 85 ? (2 / 3) : (1 / 3));
                const proximo = Math.min(92, atual + incremento);
                atualizarProgressoAtualizacaoSistema(tipo, proximo, 'Atualização em andamento', 'andamento');
            }, 500);
        }

        function finalizarProgressoAtualizacaoSistema(tipo, sucesso, mensagem) {
            limparTimerProgressoAtualizacaoSistema();
            if (sucesso) {
                atualizarProgressoAtualizacaoSistema(tipo, 100, mensagem || 'Atualização concluída.', 'sucesso');
                return;
            }
            atualizarProgressoAtualizacaoSistema(
                tipo,
                Math.max(1, progressoAtualizacaoSistema.percentual),
                mensagem || 'Falha na atualização.',
                'erro'
            );
        }

        function definirEstadoBotoesAtualizacaoSistema(disabled) {
            document.getElementById('btnAtualizarDetruProfor')?.toggleAttribute('disabled', disabled);
            document.getElementById('btnAtualizarRendimentosProfor')?.toggleAttribute('disabled', disabled);
        }

        async function executarAtualizacaoAdministrativaProfor(tipo, executor) {
            if (estaEmModoPublicacaoEstatica()) return;

            definirEstadoBotoesAtualizacaoSistema(true);
            iniciarProgressoAtualizacaoSistema(tipo);

            try {
                const resultado = await executor();
                if (resultado?.cancelado) {
                    finalizarProgressoAtualizacaoSistema(tipo, false, 'Atualização cancelada pelo usuário.');
                    return;
                }
                if (resultado?.sucesso === false) {
                    finalizarProgressoAtualizacaoSistema(tipo, false, resultado.mensagem || 'Falha na atualização.');
                    return;
                }
                finalizarProgressoAtualizacaoSistema(tipo, true, 'Atualização concluída.');
            } catch (error) {
                finalizarProgressoAtualizacaoSistema(tipo, false, error?.message || 'Falha na atualização.');
            } finally {
                definirEstadoBotoesAtualizacaoSistema(false);
                await carregarStatusAtualizacaoConsolidadaProfor2022();
                await carregarStatusUltimaAtualizacaoDetruProfor2022();
            }
        }

        function renderStatusAtualizacaoConsolidadaProfor2022(status) {
            const diagnostico = status?.diagnosticoConsolidado || null;
            if (!status) {
                return `
                    <div class="small text-muted" id="profor-consolidado-status" aria-live="polite">
                        Status PROFOR 2022 indisponível.
                    </div>
                `;
            }

            const partes = [];
            partes.push(`origem: ${escapeHtml(status.origemDados || 'planilha')}`);

            if (diagnostico) {
                partes.push(`carteira: ${Number(diagnostico.totalCarteira ?? 0)}`);
                partes.push(`DETRU: ${Number(diagnostico.totalComDetru ?? 0)}`);
                partes.push(`plano: ${Number(diagnostico.totalComPlano ?? 0)}`);
                partes.push(`rendimentos: ${Number(diagnostico.totalComRendimentos ?? 0)}`);
            } else {
                partes.push('diagnóstico indisponível');
            }

            const ultimaDetru = status.ultimaAtualizacaoDetru;
            if (ultimaDetru) {
                const quando = ultimaDetru.concluidoEm || ultimaDetru.iniciadoEm || null;
                if (quando) partes.push(`DETRU em ${formatarDataStatusSistema(quando)}`);
            }

            const ultimaRendimentos = status.ultimaConsultaRendimentos;
            if (ultimaRendimentos) {
                const quando = ultimaRendimentos.concluidoEm || ultimaRendimentos.iniciadoEm || null;
                if (quando) partes.push(`rendimentos em ${formatarDataStatusSistema(quando)}`);
            }

            return `
                <div class="small text-muted" id="profor-consolidado-status" aria-live="polite">
                    Última atualização consolidada: ${partes.filter(Boolean).join(' • ')}
                </div>
            `;
        }

        function obterStatusConsolidadoProforParaStatusSistema() {
            const dados = obterDadosProfor2022() || {};
            const diagnostico = dados.diagnosticoConsolidado || dados.diagnostico || null;
            if (!diagnostico && !dados.ultimaAtualizacaoDados && !dados.ultimaAtualizacaoDetru && !dados.ultimaConsultaRendimentos) {
                return null;
            }
            return {
                origemDados: dados.origemDados || dados.metadadosPublicacao?.fonteDadosBase || 'banco-cache',
                diagnosticoConsolidado: diagnostico,
                ultimaAtualizacaoDetru: dados.ultimaAtualizacaoDetru || null,
                ultimaConsultaRendimentos: dados.ultimaConsultaRendimentos || null
            };
        }

        function renderBlocoAtualizacoesProforStatusSistema() {
            const modoEstatico = estaEmModoPublicacaoEstatica();
            const statusConsolidadoInicial = modoEstatico ? obterStatusConsolidadoProforParaStatusSistema() : null;
            const statusDetruInicial = modoEstatico ? statusConsolidadoInicial?.ultimaAtualizacaoDetru || null : null;

            return `
                <section class="system-status-panel mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Operações PROFOR 2022</p>
                            <h2>Atualizações PROFOR 2022</h2>
                        </div>
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                        ${renderActionButton({
                            id: 'btnAtualizarDetruProfor',
                            type: 'refresh',
                            label: 'Atualizar DETRU',
                            variant: 'outline-secondary',
                            backend: true,
                            disabled: modoEstatico,
                            title: modoEstatico ? MENSAGEM_MODO_PUBLICACAO : ''
                        })}
                        ${renderActionButton({
                            id: 'btnAtualizarRendimentosProfor',
                            type: 'refresh',
                            label: 'Atualizar Transferegov',
                            variant: 'outline-secondary',
                            backend: true,
                            disabled: modoEstatico,
                            title: modoEstatico ? MENSAGEM_MODO_PUBLICACAO : ''
                        })}
                    </div>
                    ${modoEstatico ? `<div class="mb-3">${renderPublicationNotice()}</div>` : ''}
                    ${modoEstatico ? '' : `
                    <div class="profor-diagnostico-atualizacoes mb-3" id="profor-diagnostico-atualizacoes-card">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong class="small text-uppercase" style="letter-spacing:.04em; color: var(--color-muted, #94a3b8);">Diagnóstico das atualizações</strong>
                            <button type="button" id="btnRecarregarDiagnosticoAtualizacoes" class="btn btn-sm btn-link p-0" title="Recarregar diagnóstico">
                                <i class="fas fa-sync"></i>
                            </button>
                        </div>
                        <div id="profor-diagnostico-atualizacoes-corpo">Carregando diagnóstico...</div>
                    </div>`}
                    <div class="d-none mb-3" id="profor-atualizacao-progresso-container">
                        <div class="d-flex justify-content-between align-items-center small text-muted mb-1">
                            <span id="profor-atualizacao-progresso-texto">Atualização em andamento</span>
                            <span id="profor-atualizacao-progresso-percentual">0%</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div
                                class="progress-bar progress-bar-striped bg-info"
                                id="profor-atualizacao-progresso-barra"
                                role="progressbar"
                                style="width: 0%;"
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-valuenow="0"></div>
                        </div>
                    </div>
                    <div class="mb-2" id="profor-consolidado-feedback"></div>
                    <div class="mb-2">
                        ${renderStatusAtualizacaoConsolidadaProfor2022(statusConsolidadoInicial)}
                    </div>
                    <div class="mb-2" id="profor-detru-feedback"></div>
                    <div class="mb-0">
                        ${renderStatusUltimaAtualizacaoDetruProfor2022(statusDetruInicial)}
                    </div>
                </section>
            `;
        }

        function renderBlocoRecargaOperacionalPadStatusSistema() {
            return `
                <section class="system-status-panel mb-4" id="secao-recarga-pad-operacional">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">PROFOR 2022</p>
                            <h2>Recarga Operacional dos PADs</h2>
                            <p class="text-muted mb-0">Fluxo operacional limpo para reconstruir a base local a partir dos 15 PADs Excel atuais.</p>
                        </div>
                    </div>
                    <div class="row g-3 align-items-start">
                        <div class="col-lg-8">
                            <ul class="mb-3 text-muted small ps-3">
                                <li>Substitua os 15 arquivos Excel em <code>Planilhas/profor-2022/instrumentos</code>.</li>
                                <li>Clique em <strong>Recarregar PADs</strong> para ler os arquivos e reconstruir a visão operacional.</li>
                                <li>Esta ação não publica dados e não consulta DETRU/Transferegov.</li>
                                <li>Aplica a memória de rateios e classificações por área já existente.</li>
                                <li>Item novo sem rateio memorizado vira pendência operacional.</li>
                                <li>Item suprimido no PAD atual é tratado como histórico, sem erro indevido.</li>
                            </ul>
                            <button type="button" class="btn btn-outline-primary btn-sm" id="btn-recarregar-pads">
                                <i class="fas fa-sync-alt me-1"></i> Recarregar PADs
                            </button>
                        </div>
                        <div class="col-lg-4">
                            <div class="alert alert-info small mb-0">
                                A recarga atualiza apenas relatórios operacionais locais e pendências para saneamento. O plano oficial e os dados publicados permanecem inalterados.
                            </div>
                        </div>
                    </div>
                    <div id="recarga-pad-progresso" class="d-none mt-3 text-primary">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                        <span>Processando recarga dos PADs, por favor aguarde...</span>
                    </div>
                    <div id="recarga-pad-resultado" class="mt-3 mb-0"></div>
                </section>
            `;
        }

        function registrarEventosStatusSistema() {
            document.getElementById('btn-recarregar-pads')?.addEventListener('click', async () => {
                await executarRecargaPadsOperacionalUI();
            });
            document.getElementById('btnAtualizarDetruProfor')?.addEventListener('click', async () => {
                await executarAtualizacaoAdministrativaProfor('detru', atualizarCacheDetruProfor2022UI);
            });
            document.getElementById('btnAtualizarRendimentosProfor')?.addEventListener('click', async () => {
                await executarAtualizacaoAdministrativaProfor('rendimentos', atualizarRendimentosTransferegovProfor2022UI);
            });
            document.getElementById('btnRecarregarDiagnosticoAtualizacoes')?.addEventListener('click', () => {
                carregarDiagnosticoAtualizacoesProfor2022();
            });
            // Carrega o diagnostico no momento em que a tela monta.
            carregarDiagnosticoAtualizacoesProfor2022();
        }

        function formatarTimestampDiagnostico(linha) {
            if (!linha) return '(nunca executado)';
            const ini = linha.iniciadoEm || linha.iniciado_em || null;
            const fim = linha.concluidoEm || linha.concluido_em || null;
            const partes = [];
            if (ini) partes.push(`iniciado ${ini}`);
            if (fim) partes.push(`concluído ${fim}`);
            if (linha.sucesso === 0 || linha.sucesso === false) partes.push('sucesso=não');
            else if (linha.sucesso === 1 || linha.sucesso === true) partes.push('sucesso=sim');
            return partes.length ? partes.join(' · ') : JSON.stringify(linha);
        }

        async function carregarDiagnosticoAtualizacoesProfor2022() {
            const corpo = document.getElementById('profor-diagnostico-atualizacoes-corpo');
            if (!corpo) return;
            if (estaEmModoPublicacaoEstatica()) {
                corpo.innerHTML = '<span class="small text-muted">Indisponível em modo estático.</span>';
                return;
            }
            corpo.innerHTML = '<span class="small text-muted">Carregando diagnóstico...</span>';
            try {
                const resposta = await fetchJsonApiOnasp('/api/profor-2022/atualizacoes/status');
                // fetchJsonApiOnasp retorna { resposta, payload, base }; usamos payload.
                const payload = resposta?.payload ?? resposta;
                if (!payload?.success) throw new Error(payload?.message || 'Falha ao obter diagnóstico.');
                const detru = payload.detru || {};
                const transferegov = payload.transferegov || {};
                const carteira = payload.carteira || {};
                const erros = [carteira.erroLeitura, detru.erroLeitura, transferegov.erroLeitura].filter(Boolean);
                corpo.innerHTML = `
                    <div class="profor-diagnostico-grid">
                        <div class="profor-diagnostico-item">
                            <span class="profor-diagnostico-label">Carteira ativa</span>
                            <strong class="profor-diagnostico-valor">${escapeHtml(String(carteira.totalAtivos ?? 0))} convênio(s)</strong>
                            ${carteira.erroLeitura ? `<span class="profor-diagnostico-erro">${escapeHtml(carteira.erroLeitura)}</span>` : ''}
                        </div>
                        <div class="profor-diagnostico-item">
                            <span class="profor-diagnostico-label">DETRU</span>
                            <strong class="profor-diagnostico-valor">${escapeHtml(String(detru.totalRegistrosCache ?? 0))} registro(s) em cache</strong>
                            <span class="profor-diagnostico-sub">Última atualização: ${escapeHtml(formatarTimestampDiagnostico(detru.ultimaAtualizacao))}</span>
                            ${detru.erroLeitura ? `<span class="profor-diagnostico-erro">${escapeHtml(detru.erroLeitura)}</span>` : ''}
                        </div>
                        <div class="profor-diagnostico-item">
                            <span class="profor-diagnostico-label">Transferegov</span>
                            <strong class="profor-diagnostico-valor">${escapeHtml(String(transferegov.totalRegistrosCache ?? 0))} registro(s) em cache</strong>
                            <span class="profor-diagnostico-sub">Última consulta: ${escapeHtml(formatarTimestampDiagnostico(transferegov.ultimaConsulta))}</span>
                            ${transferegov.erroLeitura ? `<span class="profor-diagnostico-erro">${escapeHtml(transferegov.erroLeitura)}</span>` : ''}
                        </div>
                    </div>
                    ${erros.length ? `<div class="small text-warning mt-1">Avisos de leitura: ${erros.length}</div>` : ''}
                `;
            } catch (err) {
                corpo.innerHTML = `<span class="small text-danger">${escapeHtml(err?.message || 'Erro ao carregar diagnóstico.')}</span>`;
            }
        }

        async function carregarStatusAtualizacaoConsolidadaProfor2022() {
            const statusEl = document.getElementById('profor-consolidado-status');
            if (!statusEl || estaEmModoPublicacaoEstatica()) return;

            statusEl.innerHTML = '<div class="small text-muted"><i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>Carregando status consolidado PROFOR 2022...</div>';

            try {
                const { payload } = await fetchJsonApiOnasp('/api/profor-2022/atualizacao/status');
                if (!payload.success) throw new Error(payload.message || 'Não foi possível carregar o status consolidado.');
                statusEl.outerHTML = renderStatusAtualizacaoConsolidadaProfor2022(payload);
            } catch (err) {
                statusEl.outerHTML = `
                    <div class="small text-warning" id="profor-consolidado-status" aria-live="polite">
                        Status PROFOR 2022 indisponível. ${escapeHtml(err.message || 'Tente novamente mais tarde.')}
                    </div>
                `;
            }
        }

        function formatarDataHoraAtualizacaoBr(isoString) {
            if (!isoString) return null;
            const data = new Date(isoString);
            if (Number.isNaN(data.getTime())) return null;
            const dd = String(data.getDate()).padStart(2, '0');
            const mm = String(data.getMonth() + 1).padStart(2, '0');
            const aaaa = String(data.getFullYear());
            const hh = String(data.getHours()).padStart(2, '0');
            const min = String(data.getMinutes()).padStart(2, '0');
            return `${dd}/${mm}/${aaaa} às ${hh}:${min}`;
        }

        function aplicarRotuloUltimaAtualizacaoOperacional(textoCompletoDashboard, textoCurtoFooter) {
            const dashboardEl = document.getElementById('dashboard-ultima-atualizacao');
            if (dashboardEl) dashboardEl.textContent = textoCompletoDashboard;
            const footerEl = document.getElementById('footer-ultima-atualizacao');
            if (footerEl) footerEl.textContent = textoCurtoFooter;
        }

        function existeRotuloUltimaAtualizacaoValido() {
            const dashboardEl = document.getElementById('dashboard-ultima-atualizacao');
            const footerEl = document.getElementById('footer-ultima-atualizacao');
            return [dashboardEl?.textContent, footerEl?.textContent].some((texto) => (
                String(texto || '').trim().startsWith('Atualizado em ')
            ));
        }

        function exibirRotuloUltimaAtualizacaoOperacional(info) {
            const FALLBACK = 'Atualização não registrada';
            const formatado = formatarDataHoraAtualizacaoBr(info?.dataHora);
            if (!formatado) {
                if (existeRotuloUltimaAtualizacaoValido()) return;
                aplicarRotuloUltimaAtualizacaoOperacional(FALLBACK, FALLBACK);
                return;
            }
            const textoDashboard = `Atualizado em ${formatado}`;
            const textoFooter = info?.fonte
                ? `${textoDashboard} (${info.fonte})`
                : textoDashboard;
            aplicarRotuloUltimaAtualizacaoOperacional(textoDashboard, textoFooter);
        }

        function obterUltimaAtualizacaoDadosProforCarregado() {
            return obterDadosProfor2022()?.ultimaAtualizacaoDados || null;
        }

        async function carregarRotuloUltimaAtualizacaoOperacional() {
            if (estaEmModoPublicacaoEstatica()) {
                // Modo estático/GitHub Pages: nao chama API local.
                // Le ultimaAtualizacaoDados ja carregado no objeto dadosProfor2022 publicado.
                exibirRotuloUltimaAtualizacaoOperacional(obterUltimaAtualizacaoDadosProforCarregado());
                return;
            }

            try {
                const { payload } = await fetchJsonApiOnasp('/api/profor-2022/atualizacao/status');
                if (!payload?.success) throw new Error(payload?.message || 'Status indisponível.');
                const infoApi = payload.ultimaAtualizacaoDados || payload.data?.ultimaAtualizacaoDados || null;
                const infoFallback = obterUltimaAtualizacaoDadosProforCarregado();
                exibirRotuloUltimaAtualizacaoOperacional(infoApi?.dataHora ? infoApi : infoFallback);
            } catch (err) {
                console.warn('Falha ao carregar rotulo de ultima atualizacao operacional:', err?.message || err);
                exibirRotuloUltimaAtualizacaoOperacional(obterUltimaAtualizacaoDadosProforCarregado());
            }
        }

        async function atualizarRendimentosTransferegovProfor2022UI() {
            if (estaEmModoPublicacaoEstatica()) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return { sucesso: false, cancelado: true };
            }

            const botao = document.getElementById('btnAtualizarRendimentosProfor');
            if (!confirm('Atualizar rendimentos do Transferegov agora?')) {
                return { sucesso: false, cancelado: true };
            }

            if (botao) botao.disabled = true;
            mostrarMensagemConsolidadoProfor2022('warning', 'Atualizando rendimentos Transferegov...');

            try {
                const { payload } = await fetchJsonApiOnasp('/api/profor-2022/rendimentos/atualizar', {
                    method: 'POST',
                    body: JSON.stringify({})
                });

                if (!payload.success) {
                    throw new Error(payload.message || 'Não foi possível atualizar rendimentos Transferegov.');
                }

                mostrarMensagemConsolidadoProfor2022('success', payload.message || 'Atualização de rendimentos Transferegov concluída.');
                await carregarStatusAtualizacaoConsolidadaProfor2022();
                await carregarStatusUltimaAtualizacaoDetruProfor2022();
                if (typeof carregarRotuloUltimaAtualizacaoOperacional === 'function') {
                    await carregarRotuloUltimaAtualizacaoOperacional();
                }
                // Falha em recarregar diagnostico NAO deve marcar a atualizacao como erro.
                try { await carregarDiagnosticoAtualizacoesProfor2022(); }
                catch (e) { console.warn('Falha ao recarregar diagnostico apos Transferegov:', e); }

                return {
                    sucesso: Boolean(payload.resultado?.sucesso ?? payload.success),
                    mensagem: payload.message || 'Atualização de rendimentos Transferegov concluída.'
                };
            } catch (err) {
                mostrarMensagemConsolidadoProfor2022('danger', err.message || 'Erro ao atualizar rendimentos Transferegov.');
                return {
                    sucesso: false,
                    mensagem: err.message || 'Erro ao atualizar rendimentos Transferegov.'
                };
            } finally {
                if (botao) botao.disabled = false;
            }
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

function atualizarVisibilidadeBotaoStatusSistema() {
    // Em modo estatico/GitHub Pages, ocultar os links de Sistema e Revisoes PAD.
    // Essas telas dependem da API local; sem ela nao deve haver acesso pela barra.
    const ocultar = estaEmModoPublicacaoEstatica();
    document.querySelectorAll('.app-menu-link[data-view="status-sistema"], .app-menu-link[data-view="revisao-divergencias"]').forEach((botao) => {
        botao.classList.toggle('d-none', ocultar);
        botao.setAttribute('aria-hidden', ocultar ? 'true' : 'false');
    });
}

function aplicarModoSomenteLeituraControlada() {
    aplicarModoSomenteLeitura();
    atualizarVisibilidadeBotaoStatusSistema();
}

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

    atualizarVisibilidadeBotaoStatusSistema();
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
            mostrarAlertaCarregamentoPlanilha(
                'Selecao manual da planilha antiga removida. Use os dados PAD/reconstrucao.',
                false,
                'info'
            );
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
                `Dados financeiros indisponiveis: ${error.message}`,
                false,
                'danger'
            );
        }

        async function processarSelecaoManualPlanilha(event) {
            const arquivoSelecionado = event.target.files?.[0];
            if (!arquivoSelecionado) return;

            try {
        showLoading('Lendo e validando planilha...');
                throw new Error('Selecao manual da planilha antiga removida. Use PAD/reconstrucao.');
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

            requestAnimationFrame(() => {
                const viewInicial = document.body.dataset.currentView || 'dashboard';
                if (viewInicial === 'dashboard') {
                    garantirDadosBaseAplicacao()
                        .catch((error) => {
                            console.error('Falha ao carregar a base inicial da dashboard:', error);
                        })
                        .finally(() => {
                            carregarRotuloUltimaAtualizacaoOperacional();
                        });
                } else {
                    carregarRotuloUltimaAtualizacaoOperacional();
                }
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
                await executarComTimeoutOnasp(
                    carregarDadosOrcamento(),
                    TEMPO_MAXIMO_CARREGAMENTO_ORCAMENTO_MS,
                    'O carregamento do Orçamento 2026 excedeu o tempo limite.'
                );
                registrarPerfOrcamento('garantirDadosDaView:carregarDadosOrcamento', inicioOrcamento, {
                    viewName,
                    cacheExiste: Boolean(obterDadosOrcamento())
                });
                erroCarregamentoOrcamento = null;
            }

            if (viewName === 'orcamento') {
                const inicioMovimentacoes = DEBUG_PERF_ONASP ? performance.now() : 0;
                await executarComTimeoutOnasp(
                    carregarMovimentacoesOrcamento2026(),
                    TEMPO_MAXIMO_CARREGAMENTO_ORCAMENTO_MS,
                    'O carregamento das movimentações do Orçamento 2026 excedeu o tempo limite.'
                );
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

        function normalizarInstrumentoDashboardProfor(instrumento) {
            return String(instrumento || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();
        }

        function itemDashboardEhConvenio(item) {
            return normalizarInstrumentoDashboardProfor(item?.instrumento).includes('CONV');
        }

        function montarItensDashboardProforBancoCache(dadosProfor) {
            if (!dadosProfor || !Array.isArray(dadosProfor.convenios) || dadosProfor.convenios.length === 0) {
                return null;
            }

            return (dadosProfor.convenios || []).map((convenio) => {
                const valorTotal = Number(
                    convenio.previstoOuvidoria ?? convenio.valorGlobal ?? convenio.valorTotal
                ) || 0;
                const valorExecutado = Number(
                    convenio.valorExecutadoOuvidoria ?? convenio.valorExecutadoGeral ?? convenio.valorExecutado
                ) || 0;
                return {
                    uf: convenio.uf,
                    regiao: '',
                    instrumento: 'Convênio PROFOR 2022',
                    objeto: `PROFOR 2022 - Convênio ${convenio.numero || convenio.numeroConvenio || ''}/${convenio.ano || ''}`.trim(),
                    quantidade: Number(convenio.totalItensOuvidoria ?? convenio.totalItens) || 1,
                    valorUnitario: valorTotal,
                    valorTotal,
                    valorExecutado,
                    saldo: valorTotal - valorExecutado,
                    percentualExecucao: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0,
                    origemDados: 'reconstrucao-pad'
                };
            });
        }

        function substituirConveniosDashboardPorProforBancoCache(dadosBase, dadosProfor) {
            const itensProfor = montarItensDashboardProforBancoCache(dadosProfor);
            if (!itensProfor) return dadosBase;

            const itensNaoConvenio = (dadosBase || []).filter((item) => !itemDashboardEhConvenio(item));
            return [...itensNaoConvenio, ...itensProfor];
        }

        async function sincronizarDadosProfor2022Local() {
            avisoFallbackProfor2022 = null;

            if (estaEmModoPublicacaoEstatica()) {
                return obterDadosProfor2022();
            }

            let origem;
            try {
                origem = await resolverOrigemDadosProfor2022Local();
            } catch (error) {
                avisoFallbackProfor2022 = 'Não foi possível consultar a origem local/API do PROFOR 2022. Mantidos os dados estáticos publicados.';
                console.warn(avisoFallbackProfor2022, error);
                return obterDadosProfor2022();
            }

            if (origem.origemDados !== 'reconstrucao-pad') {
                return obterDadosProfor2022();
            }

            try {
                const consolidado = await carregarConsolidadoProfor2022BancoCacheLocal();
                consolidado.origemDados = 'reconstrucao-pad';
                consolidado.origemDadosEfetiva = 'reconstrucao-pad';
                return consolidado;
            } catch (error) {
                avisoFallbackProfor2022 = 'Falha ao carregar o consolidado PAD/reconstrucao. Mantidos os dados estáticos publicados.';
                console.warn(avisoFallbackProfor2022, error);
                const dadosPublicados = obterDadosProfor2022();
                if (dadosPublicados) {
                    dadosPublicados.fallbackUsado = true;
                    dadosPublicados.origemDadosEfetiva = dadosPublicados.origemDadosEfetiva || 'publicado';
                    dadosPublicados.avisos = [
                        ...(dadosPublicados.avisos || []),
                        avisoFallbackProfor2022
                    ];
                }
                return dadosPublicados;
            }
        }

        async function garantirDadosBaseAplicacao() {
            if (baseAplicacaoCarregamentoPromise) {
                return baseAplicacaoCarregamentoPromise;
            }

            const catalogoAplicacaoCarregado = Boolean(catalogoAplicacao?.dadosBase?.length);
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
                    const dadosProforAtualizados = await sincronizarDadosProfor2022Local();
                    dadosFaf = substituirConveniosDashboardPorProforBancoCache(dadosFaf, dadosProforAtualizados);
                    configurarEstadoDadosValidados(true);
                    ocultarAlertaCarregamentoPlanilha();
                    initDashboard(dadosFaf);
                    renderDetailsView();
                    await carregarRotuloUltimaAtualizacaoOperacional();
                }

                if (document.body.dataset.currentView === 'profor2022') {
                    renderProfor2022View();
                } else if (document.body.dataset.currentView === 'profor-convenio-detalhe' && proforConvenioAtual) {
                    abrirDetalheConvenioProfor(proforConvenioAtual, proforFiltroAreaAtual);
                }

                aplicarModoSomenteLeituraControlada();
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
                'status-sistema': 'view-status-sistema',
                'revisao-divergencias': 'view-revisao-divergencias'
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
            aplicarModoSomenteLeituraControlada();
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

            // Em modo estatico/GitHub Pages, esta tela depende da API local e nao
            // deve aparecer. Mostra um aviso sem botoes e nao tenta carregar nada.
            if (estaEmModoPublicacaoEstatica()) {
                container.style.display = 'block';
                container.innerHTML = renderEmptyState({
                    titulo: 'Sistema disponível apenas no servidor local.',
                    descricao: 'A tela Status do Sistema depende de APIs e do banco SQLite local. Ela não é exibida na publicação estática.',
                    icon: 'fa-lock'
                });
                return;
            }

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

                ${renderBlocoRecargaOperacionalPadStatusSistema()}

                ${renderBlocoAtualizacoesProforStatusSistema()}

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

                ${modoAplicacao === 'api' ? renderPainelLogsOperacionaisHtml() : ''}
            `;

            if (modoAplicacao === 'api') {
                inicializarPainelLogsOperacionais();
            }

            registrarEventosStatusSistema();
            await carregarUltimaRecargaPadUI();
            if (modoAplicacao === 'api') {
                await carregarStatusAtualizacaoConsolidadaProfor2022();
                await carregarStatusUltimaAtualizacaoDetruProfor2022();
            }

            aplicarModoSomenteLeituraControlada();
        }

        function formatarBooleanoRevisao(valor) {
            return valor ? 'Sim' : 'Não';
        }

        function formatarDataHoraRevisao(valor) {
            return formatarDataStatusSistema(valor);
        }

        function normalizarNumeroRevisao(valor) {
            if (typeof valor === 'number') {
                return Number.isFinite(valor) ? valor : null;
            }

            const textoOriginal = String(valor ?? '').trim();
            if (!textoOriginal) return null;

            const texto = textoOriginal
                .replace(/\s+/g, '')
                .replace(/^R\$/i, '');
            const apenasNumero = texto.replace(/[^\d,.-]/g, '');
            if (apenasNumero !== texto || !/^-?\d+(?:[.,]\d+)*(?:[.,]\d+)?$/.test(apenasNumero)) {
                return null;
            }

            const ultimoPonto = apenasNumero.lastIndexOf('.');
            const ultimaVirgula = apenasNumero.lastIndexOf(',');
            let normalizado = apenasNumero;

            if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
                const separadorDecimal = ultimoPonto > ultimaVirgula ? '.' : ',';
                const separadorMilhar = separadorDecimal === '.' ? ',' : '.';
                normalizado = apenasNumero
                    .replace(new RegExp(`\\${separadorMilhar}`, 'g'), '')
                    .replace(separadorDecimal, '.');
            } else if (ultimaVirgula >= 0) {
                const partes = apenasNumero.split(',');
                const ehMilhar = partes.length > 1
                    && partes.slice(1).every((parte) => /^\d{3}$/.test(parte));
                normalizado = ehMilhar ? partes.join('') : apenasNumero.replace(',', '.');
            } else if (ultimoPonto >= 0) {
                const partes = apenasNumero.split('.');
                const ehMilhar = partes.length > 2
                    || (partes.length === 2 && /^-?\d{1,3}$/.test(partes[0]) && /^\d{3}$/.test(partes[1]));
                normalizado = ehMilhar ? partes.join('') : apenasNumero;
            }

            const numero = Number(normalizado);
            return Number.isFinite(numero) ? numero : null;
        }

        function formatarValorRevisao(valor, rotulo = '') {
            if (valor === null || valor === undefined || valor === '') return '-';
            const campoMonetario = /valor|saldo|diferença|diferenca/i.test(String(rotulo || ''));
            if (typeof valor === 'number') {
                if (!Number.isFinite(valor)) return '-';
                return campoMonetario
                    ? formatMoney(valor)
                    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
            }
            const texto = String(valor).trim();
            if (!texto) return '-';
            const numero = normalizarNumeroRevisao(texto);
            if (numero !== null) {
                return campoMonetario
                    ? formatMoney(numero)
                    : numero.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
            }
            return texto;
        }

        function classeNivelRevisao(nivel) {
            const texto = String(nivel || '').toLowerCase();
            if (texto === 'impeditivo') return 'danger';
            if (texto === 'aviso') return 'warning';
            return 'info';
        }

        function classeStatusRevisao(status) {
            const texto = String(status || '').toUpperCase();
            if (['ACEITO', 'CORRIGIDO'].includes(texto)) return 'success';
            if (['REJEITADO', 'REVERTIDO'].includes(texto)) return 'danger';
            if (texto === 'EM_REVISAO') return 'info';
            return 'warning';
        }

        function renderBadgeRevisao(valor, classe = 'secondary', titulo = '') {
            const titleAttr = titulo ? ` title="${escapeHtml(titulo)}"` : '';
            return `<span class="badge text-bg-${classe} revisao-badge"${titleAttr}>${escapeHtml(valor || '-')}</span>`;
        }

        function calcularBloqueioEfetivoRevisao(item) {
            const status = String(item.status || '').toUpperCase();
            if (item?.falsoPositivoSaneavel === true || item?.categoriaOperacional === 'falso_positivo_saneavel') return false;
            return item.bloqueiaPublicacao === true && ['PENDENTE', 'EM_REVISAO'].includes(status);
        }

        function obterValorAninhadoRevisao(objeto, caminhos = []) {
            for (const caminho of caminhos) {
                const partes = String(caminho).split('.');
                let atual = objeto;
                for (const parte of partes) {
                    if (atual === null || atual === undefined) break;
                    atual = atual[parte];
                }
                if (atual !== null && atual !== undefined && atual !== '') return atual;
            }
            return '';
        }

        function renderCampoComparacaoRevisao(rotulo, antes, depois, isExistencia = false) {
            let valorAntes = formatarValorRevisao(antes, rotulo);
            let valorDepois = formatarValorRevisao(depois, rotulo);
            if (valorAntes === '-' && valorDepois === '-') return '';
            if (isExistencia) {
                if (valorAntes === '-') valorAntes = 'não informado';
                if (valorDepois === '-') valorDepois = 'não informado';
            }
            if (rotulo === 'Estado anterior / novo' || (isExistencia && rotulo === 'Valor anterior / novo')) {
                if (antes === 'presente_na_memoria' || valorAntes === 'presente_na_memoria') valorAntes = 'presente na memória';
                if (depois === 'ausente_no_pad' || valorDepois === 'ausente_no_pad') valorDepois = 'ausente no PAD';
            }
            const isDifferent = valorAntes !== valorDepois;
            const diffClass = isDifferent ? 'is-different' : '';
            return `
                <div class="revisao-comparacao-row ${diffClass}">
                    <span>${escapeHtml(rotulo)}</span>
                    <strong>${escapeHtml(valorAntes)}</strong>
                    <strong>${escapeHtml(valorDepois)}</strong>
                </div>
            `;
        }

        function renderObjetoResumoRevisao(objeto) {
            if (!objeto || typeof objeto !== 'object') return '<span class="text-muted">Não informado.</span>';
            const entradas = Object.entries(objeto).filter(([, valor]) => valor !== null && valor !== undefined && valor !== '');
            if (!entradas.length) return '<span class="text-muted">Não informado.</span>';
            return `
                <dl class="revisao-keyvalue-list">
                    ${entradas.slice(0, 12).map(([chave, valor]) => `
                        <div>
                            <dt>${escapeHtml(chave)}</dt>
                            <dd>${escapeHtml(typeof valor === 'object' ? JSON.stringify(valor) : String(valor))}</dd>
                        </div>
                    `).join('')}
                </dl>
            `;
        }

        function obterTipoAlertaRevisao(divergencia) {
            return String(divergencia?.tipoAlerta || '').trim();
        }

        function obterCampoAfetadoRevisao(divergencia) {
            return String(divergencia?.campoAfetado || divergencia?.payload?.campoAfetado || '').trim();
        }

        function obterCategoriaSaneamentoRevisao(divergencia) {
            const tipo = obterTipoAlertaRevisao(divergencia);
            if (tipo === 'equivalencia_por_descricao_normalizada') return 'equivalencia';
            if (['item_pad_sem_rateio', 'item_novo_sem_rateio', 'rateio_novo', 'correcao_de_rateio'].includes(tipo)) return 'rateio';
            if (['item_ausente_no_pad', 'item_substituido'].includes(tipo)) return 'ausencia';
            if (['item_nao_apto', 'item_conhecido_nao_apto', 'item_conhecido_nao_apto_usado'].includes(tipo)) return 'nao_apto';
            if (tipo === 'quantidade_valor_unitario_inconsistente') return 'consistencia';
            if ([
                'valor_diferente',
                'quantidade_diferente',
                'saldo_inconsistente',
                'descricao_divergente',
                'natureza_divergente',
                'valor_unitario_diferente'
            ].includes(tipo)) return 'campo';
            return 'generico';
        }

        function obterTipoSaneamentoPayloadRevisao(divergencia) {
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const mapa = {
                equivalencia: 'equivalencia_por_descricao_normalizada',
                rateio: 'rateio_manual',
                ausencia: 'ausencia_confirmada',
                nao_apto: 'liberacao_item_nao_apto',
                consistencia: 'consistencia_quantidade_valor_unitario',
                campo: 'campo_pad_aceito',
                generico: obterTipoAlertaRevisao(divergencia) || 'generico'
            };
            return mapa[categoria] || 'generico';
        }

        function obterDecisoesPermitidasRevisao(divergencia) {
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            if (categoria === 'rateio') return ['ACEITO', 'CORRIGIDO', 'REJEITADO', 'EM_REVISAO', 'COMENTAR'];
            if (categoria === 'campo') return ['ACEITO', 'CORRIGIDO', 'REJEITADO', 'EM_REVISAO', 'COMENTAR'];
            if (['equivalencia', 'ausencia', 'nao_apto', 'consistencia'].includes(categoria)) {
                return ['ACEITO', 'REJEITADO', 'EM_REVISAO', 'COMENTAR'];
            }
            return ['ACEITO', 'REJEITADO', 'EM_REVISAO', 'CORRIGIDO', 'REVERTIDO', 'COMENTAR'];
        }

        function exigePayloadEstruturadoRevisao(divergencia) {
            return obterCategoriaSaneamentoRevisao(divergencia) !== 'generico';
        }

        /* ============================================================
         * Decisão assistida — presets por tipo de divergência.
         * Reduz digitação: cada preset já traz decisão + motivo padrão.
         * O payloadDecisao continua sendo montado por montarPayloadDecisaoRevisao();
         * presets apenas pré-preenchem decisão e justificativa, sem alterar
         * a compatibilidade com o backend ou com o rateio manual.
         * ============================================================ */
        const REVISAO_USUARIO_STORAGE_KEY = 'profor2022:revisao:usuarioResponsavel';
        const REVISAO_USUARIO_PADRAO = 'usuario-local';

        function obterUsuarioResponsavelRevisao() {
            try {
                const salvo = window.localStorage?.getItem(REVISAO_USUARIO_STORAGE_KEY);
                if (salvo && salvo.trim()) return salvo.trim();
            } catch (_) { /* localStorage indisponível: usa padrão */ }
            return REVISAO_USUARIO_PADRAO;
        }

        function salvarUsuarioResponsavelRevisao(valor) {
            const limpo = String(valor || '').trim();
            if (!limpo) return;
            try {
                window.localStorage?.setItem(REVISAO_USUARIO_STORAGE_KEY, limpo);
            } catch (_) { /* localStorage indisponível: ignora persistência */ }
        }

        // Para item_ausente_no_pad: campos financeiros que podem vir nulos da
        // memória. Quando ausentes, exibe "não informado" em vez de descrição.
        function valorOuNaoInformadoRevisao(valor) {
            if (valor === null || valor === undefined || valor === '') return 'não informado';
            return valor;
        }

        // Indica se a divergência tem evidência de saneamento por diacrítico
        // (item reaparece no PAD apenas com diferença de acentuação).
        function divergenciaSaneadaPorDiacriticoRevisao(divergencia) {
            return divergencia?.payload?.saneadoPorDiacritico === true;
        }

        // Para item_ausente_no_pad: detecta vínculo com item substituto no PAD.
        // O vínculo é registrado por decisão (payloadDecisao.tipoSaneamento =
        // 'vinculo_item_substituto'); o payload da divergência também pode
        // trazê-lo. Retorna { divergenciaSubstitutaId, descricaoPadSubstituta,
        // saneado } ou null.
        function obterVinculoSubstitutoRevisao(divergencia) {
            const payloadDiv = divergencia?.payload || {};
            // 1) Decisão de vínculo já registrada nesta divergência.
            const decisoes = Array.isArray(divergencia?.decisoes) ? divergencia.decisoes : [];
            for (const dec of decisoes) {
                const pd = dec?.payloadDecisao || {};
                if (pd.tipoSaneamento === 'vinculo_item_substituto' && pd.divergenciaSubstitutaId) {
                    return {
                        divergenciaSubstitutaId: pd.divergenciaSubstitutaId,
                        descricaoPadSubstituta: pd.descricaoPadSubstituta || null,
                        saneado: true
                    };
                }
            }
            // 2) Vínculo sugerido no próprio payload da divergência (auditoria).
            if (payloadDiv.substituto && payloadDiv.substituto.divergenciaSubstitutaId) {
                return {
                    divergenciaSubstitutaId: payloadDiv.substituto.divergenciaSubstitutaId,
                    descricaoPadSubstituta: payloadDiv.substituto.descricaoPadSubstituta || null,
                    saneado: false
                };
            }
            return null;
        }

        function obterPresetsDecisaoRevisao(divergencia) {
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const revisarDepois = {
                id: 'revisar_depois',
                label: 'Revisar depois',
                variante: 'secondary',
                decisao: 'EM_REVISAO',
                justificativa: 'Caso mantido para revisão posterior.'
            };

            if (categoria === 'equivalencia') {
                return [
                    {
                        id: 'aceitar_equivalencia',
                        label: 'Aceitar equivalência',
                        variante: 'success',
                        decisao: 'ACEITO',
                        justificativa: 'Descrição coincide após normalização textual, com mesma natureza e mesmo valor unitário dentro da tolerância definida.'
                    },
                    {
                        id: 'rejeitar_equivalencia',
                        label: 'Rejeitar',
                        variante: 'danger',
                        decisao: 'REJEITADO',
                        justificativa: 'A descrição normalizada não representa o mesmo item.'
                    },
                    revisarDepois
                ];
            }
            if (categoria === 'nao_apto') {
                return [
                    {
                        id: 'liberar_item',
                        label: 'Liberar item para dry-run',
                        variante: 'success',
                        decisao: 'ACEITO',
                        justificativa: 'Item presente no PAD com dados materiais compatíveis com a memória; liberado para uso em dry-run.'
                    },
                    {
                        id: 'manter_bloqueado',
                        label: 'Manter bloqueado',
                        variante: 'danger',
                        decisao: 'REJEITADO',
                        justificativa: 'Mantida a não aptidão do item até revisão técnica posterior.'
                    },
                    revisarDepois
                ];
            }
            if (categoria === 'rateio') {
                const temRateioSugerido = (() => {
                    const p = divergencia?.payload || {};
                    return Array.isArray(p.rateioSugerido) && p.rateioSugerido.length > 0;
                })();
                const presets = [];
                if (temRateioSugerido) {
                    presets.push({
                        id: 'aplicar_rateio_sugerido',
                        label: 'Aplicar rateio sugerido',
                        variante: 'success',
                        decisao: 'ACEITO',
                        aplicarRateioSugerido: true,
                        justificativa: 'Rateio sugerido no payload aplicado após conferência humana.'
                    });
                }
                presets.push({
                    id: 'informar_rateio_manual',
                    label: 'Informar rateio manual',
                    variante: 'primary',
                    decisao: 'ACEITO',
                    exigeRateioManual: true,
                    justificativa: 'Rateio informado manualmente para o item, com percentuais conferidos.'
                });
                presets.push(revisarDepois);
                return presets;
            }
            if (categoria === 'ausencia') {
                const confirmarAusencia = {
                    id: 'confirmar_ausencia',
                    label: 'Confirmar ausência',
                    variante: 'success',
                    decisao: 'ACEITO',
                    justificativa: 'Ausência do item no PAD atual confirmada por decisão humana.'
                };
                const naoConfirmar = {
                    id: 'vincular_substituto',
                    label: 'Não confirmar (revisar)',
                    variante: 'danger',
                    decisao: 'REJEITADO',
                    justificativa: 'Ausência não confirmada; item pode ter substituto a vincular em revisão posterior.'
                };
                // Quando há item substituto compatível no PAD, "Confirmar ausência"
                // NÃO é a ação principal — não há ausência real. A ação primária
                // é confirmar o vínculo com o substituto.
                const vinculoSubstituto = obterVinculoSubstitutoRevisao(divergencia);
                if (vinculoSubstituto) {
                    const refSub = `#${vinculoSubstituto.divergenciaSubstitutaId}`;
                    return [
                        {
                            id: 'confirmar_vinculo_substituto',
                            label: 'Confirmar vínculo com substituto',
                            variante: 'primary',
                            decisao: 'CORRIGIDO',
                            justificativa: `Item não está ausente: foi reapresentado no PAD como item substituto (divergência ${refSub}), com convênio, natureza, quantidade e valores compatíveis.`
                        },
                        revisarDepois,
                        confirmarAusencia
                    ];
                }
                // Quando há evidência de saneamento por diacrítico, "Confirmar ausência"
                // NÃO é a ação principal — o item existe no PAD apenas com outra
                // acentuação. A ação primária passa a ser não confirmar.
                if (divergenciaSaneadaPorDiacriticoRevisao(divergencia)) {
                    return [
                        {
                            ...naoConfirmar,
                            label: 'Não é ausência (diferença de acento)',
                            justificativa: 'Não há ausência real: o item correspondente existe no PAD com diferença apenas de acentuação/diacrítico.'
                        },
                        revisarDepois
                    ];
                }
                return [confirmarAusencia, naoConfirmar, revisarDepois];
            }
            if (categoria === 'consistencia') {
                return [
                    {
                        id: 'aceitar_total_pad',
                        label: 'Aceitar total do PAD',
                        variante: 'success',
                        decisao: 'ACEITO',
                        justificativa: 'Total do PAD mantido como fonte de verdade; valor unitário tratado apenas como referência.'
                    },
                    {
                        id: 'manter_alerta',
                        label: 'Manter alerta',
                        variante: 'danger',
                        decisao: 'REJEITADO',
                        justificativa: 'Inconsistência entre quantidade e valor unitário mantida para revisão.'
                    },
                    revisarDepois
                ];
            }
            if (categoria === 'campo') {
                return [
                    {
                        id: 'aceitar_pad',
                        label: 'Aceitar valor do PAD',
                        variante: 'success',
                        decisao: 'ACEITO',
                        justificativa: 'Valor do PAD aceito como correto para o campo divergente.'
                    },
                    {
                        id: 'corrigir_manual',
                        label: 'Corrigir manualmente',
                        variante: 'primary',
                        decisao: 'CORRIGIDO',
                        exigeValorCorrigido: true,
                        justificativa: 'Campo corrigido manualmente após análise da divergência.'
                    },
                    {
                        id: 'manter_memoria',
                        label: 'Manter memória (rejeitar)',
                        variante: 'danger',
                        decisao: 'REJEITADO',
                        justificativa: 'Valor da memória mantido; divergência do PAD não aceita.'
                    },
                    revisarDepois
                ];
            }
            // genérico
            return [
                {
                    id: 'aceitar_pad',
                    label: 'Aceitar',
                    variante: 'success',
                    decisao: 'ACEITO',
                    justificativa: 'Divergência aceita por decisão humana.'
                },
                {
                    id: 'manter_memoria',
                    label: 'Rejeitar',
                    variante: 'danger',
                    decisao: 'REJEITADO',
                    justificativa: 'Divergência não aceita por decisão humana.'
                },
                revisarDepois
            ];
        }

        function obterPresetDecisaoRevisaoPorId(divergencia, presetId) {
            return obterPresetsDecisaoRevisao(divergencia).find((preset) => preset.id === presetId) || null;
        }

        function obterValorPayloadRevisao(divergencia, caminhos = []) {
            const payload = divergencia?.payload || {};
            return obterValorAninhadoRevisao(payload, caminhos);
        }

        function renderCampoSaneamentoRevisao(rotulo, valor) {
            return `
                <div>
                    <dt>${escapeHtml(rotulo)}</dt>
                    <dd>${escapeHtml(formatarValorRevisao(valor, rotulo))}</dd>
                </div>
            `;
        }

        function renderListaSaneamentoRevisao(campos) {
            const linhas = campos
                .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
                .map(([rotulo, valor]) => renderCampoSaneamentoRevisao(rotulo, valor))
                .join('');
            return linhas
                ? `<dl class="revisao-keyvalue-list revisao-structured-list">${linhas}</dl>`
                : '<p class="text-muted mb-0">Payload sem detalhes estruturados suficientes.</p>';
        }

        function renderSaneamentoEstruturadoRevisao(divergencia) {
            const payload = divergencia?.payload || {};
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const alerta = divergencia.bloqueiaPublicacao
                ? 'Esta divergência bloqueia publicação enquanto permanecer pendente ou em revisão.'
                : 'Esta divergência não bloqueia publicação, mas a decisão fica registrada em auditoria.';
            let titulo = 'Decisão estruturada';
            let conteudo = '';

            if (categoria === 'equivalencia') {
                titulo = 'Equivalência por descrição normalizada';
                conteudo = renderListaSaneamentoRevisao([
                    ['Item PAD', payload.descricaoPad || divergencia.valorNovo],
                    ['Item/memória provável', payload.descricaoMemoria || divergencia.valorAnterior],
                    ['Chave do item equivalente', payload.chaveItem || divergencia.chaveItem],
                    ['Valor unitário PAD', payload.valorUnitarioPad],
                    ['Valor unitário memória', payload.valorUnitarioMemoria],
                    ['Diferença', payload.evidencias?.diferencaValorUnitario ?? divergencia.diferenca],
                    ['Natureza PAD', payload.naturezaPad],
                    ['Naturezas da memória', payload.naturezaMemoria],
                    ['Motivo provável', divergencia.motivoProvavel]
                ]);
            } else if (categoria === 'rateio') {
                titulo = 'Rateio manual do item';
                conteudo = renderListaSaneamentoRevisao([
                    ['Item PAD', payload.descricaoPad || divergencia.valorNovo],
                    ['Convênio', divergencia.numeroConvenio || payload.numeroConvenio],
                    ['UF', divergencia.uf || payload.uf],
                    ['Natureza PAD', payload.naturezaPad],
                    ['Quantidade PAD', payload.quantidadePad],
                    ['Valor unitário PAD', payload.valorUnitarioPad],
                    ['Valor previsto PAD', payload.valorPrevistoPad],
                    ['Saldo PAD', payload.saldoPad],
                    ['Motivo provável', divergencia.motivoProvavel]
                ]);
            } else if (categoria === 'ausencia') {
                titulo = 'Item ausente no PAD';
                // campoAfetado = 'existencia': não exibir "Valor anterior/novo" como
                // descrição. Mostrar Estado anterior/novo e valores financeiros reais.
                const saneadoDiacritico = payload.saneadoPorDiacritico === true;
                const vinculoSubstituto = obterVinculoSubstitutoRevisao(divergencia);
                const linhas = [
                    ['Item da memória', payload.descricaoMemoria],
                    ['Convênio', divergencia.numeroConvenio || payload.numeroConvenio],
                    ['UF', divergencia.uf || payload.uf],
                    ['Estado anterior', 'Presente na memória'],
                    ['Estado novo', vinculoSubstituto ? 'Reapresentado no PAD (substituto)' : 'Ausente no PAD'],
                    ['Natureza', payload.naturezaMemoria || payload.natureza],
                    ['Quantidade (memória)', valorOuNaoInformadoRevisao(payload.quantidadeMemoria)],
                    ['Valor unitário (memória)', valorOuNaoInformadoRevisao(payload.valorUnitarioMemoria)],
                    ['Valor previsto (memória)', valorOuNaoInformadoRevisao(payload.valorPrevistoMemoria)],
                    ['Valor executado (memória)', valorOuNaoInformadoRevisao(payload.valorExecutadoMemoria)],
                    ['Saldo (memória)', valorOuNaoInformadoRevisao(payload.saldoMemoria)],
                    ['Rateios ativos na memória', valorOuNaoInformadoRevisao(payload.totalRateiosAtivosMemoria)]
                ];
                if (!vinculoSubstituto) {
                    linhas.push(['Alerta', saneadoDiacritico
                        ? 'Há item correspondente no PAD com diferença apenas de acentuação/diacrítico. Não confirme ausência: trata-se de saneamento textual.'
                        : 'O item não apareceu no PAD atual. Avalie exclusão, substituição ou observação.']);
                }
                let blocoSubstituto = '';
                if (vinculoSubstituto) {
                    // Bloco "Item substituído no PAD": evita confirmação de ausência falsa.
                    const subDesc = vinculoSubstituto.descricaoPadSubstituta
                        ? escapeHtml(vinculoSubstituto.descricaoPadSubstituta)
                        : '(item novo correspondente no PAD)';
                    const subId = escapeHtml(String(vinculoSubstituto.divergenciaSubstitutaId));
                    blocoSubstituto = `
                        <div class="revisao-substituto-box ${vinculoSubstituto.saneado ? 'is-saneado' : ''}">
                            <strong>${vinculoSubstituto.saneado ? 'Vínculo com substituto saneado' : 'Item possivelmente substituído no PAD'}</strong>
                            <p class="mb-1">Substituto: ${subDesc}.</p>
                            <p class="mb-1">Divergência vinculada: <strong>#${subId}</strong>.</p>
                            <p class="mb-0 text-muted small">Os valores materiais fecham com o item novo. ${vinculoSubstituto.saneado
                                ? 'O vínculo já foi saneado automaticamente — não há ausência real.'
                                : 'Não confirme ausência: trata-se de substituição/atualização de especificação.'}</p>
                        </div>
                    `;
                }
                conteudo = blocoSubstituto + renderListaSaneamentoRevisao(linhas);
            } else if (categoria === 'nao_apto') {
                titulo = 'Item conhecido não apto';
                conteudo = renderListaSaneamentoRevisao([
                    ['Item', payload.descricaoPad || payload.descricaoMemoria || divergencia.valorNovo],
                    ['Motivo original de não aptidão', divergencia.motivoProvavel],
                    ['Alertas vinculados', Array.isArray(payload.alertasOriginais) ? `${payload.alertasOriginais.length} alerta(s)` : 'não informado'],
                    ['Impacto na reconstrução', divergencia.impactoReconstrucao],
                    ['Rateios ativos', Array.isArray(payload.rateiosAtivos) ? `${payload.rateiosAtivos.length} rateio(s)` : 'não informado']
                ]);
            } else if (categoria === 'consistencia') {
                titulo = 'Inconsistência quantidade x valor unitário';
                const alertaOriginal = Array.isArray(payload.alertasOriginais) ? payload.alertasOriginais[0] || {} : {};
                conteudo = renderListaSaneamentoRevisao([
                    ['Quantidade', payload.quantidadePad || alertaOriginal.quantidade],
                    ['Valor unitário', payload.valorUnitarioPad || alertaOriginal.valorUnitario],
                    ['Valor total previsto', payload.valorPrevistoPad || alertaOriginal.valorTotalPrevisto],
                    ['Quantidade x valor unitário', payload.evidencias?.calculo || payload.evidencias?.detalhe || divergencia.diferenca],
                    ['Diferença', payload.diferenca || divergencia.diferenca],
                    ['Diagnóstico provável', divergencia.motivoProvavel || 'Possível truncamento/arredondamento do valor unitário exibido.']
                ]);
            } else {
                titulo = 'Divergência de campo';
                conteudo = renderListaSaneamentoRevisao([
                    ['Campo afetado', obterCampoAfetadoRevisao(divergencia)],
                    ['Valor anterior', divergencia.valorAnterior],
                    ['Valor PAD/novo', divergencia.valorNovo],
                    ['Diferença', divergencia.diferenca],
                    ['Motivo provável', divergencia.motivoProvavel]
                ]);
            }

            return `
                <section class="revisao-detail-section revisao-structured-panel">
                    <div class="revisao-structured-header">
                        <div>
                            <p class="section-eyebrow mb-1">Saneamento assistido</p>
                            <h3>${escapeHtml(titulo)}</h3>
                        </div>
                        ${exigePayloadEstruturadoRevisao(divergencia) ? renderBadgeRevisao('Exige payload estruturado', 'warning') : ''}
                    </div>
                    <div class="revisao-structured-alert ${divergencia.bloqueiaPublicacao ? 'is-blocking' : ''}">
                        ${escapeHtml(alerta)}
                    </div>
                    ${conteudo}
                </section>
            `;
        }

        // Setores fixos para o rateio por quantidade (PROFOR 2022).
        const REVISAO_SETORES_RATEIO = ['OUVIDORIA', 'CORREGEDORIA', 'ESCOLA PENAL'];

        // Uma linha de rateio: apenas Setor (select fixo) + Quantidade (inteiro).
        // A natureza vem do PAD e não é digitada; percentuais não são digitados.
        function renderLinhaRateioRevisao(rateio = {}) {
            const opcoes = REVISAO_SETORES_RATEIO.map((setor) => {
                const selecionado = String(rateio.area || '').toUpperCase() === setor ? ' selected' : '';
                return `<option value="${setor}"${selecionado}>${setor}</option>`;
            }).join('');
            return `
                <div class="revisao-rateio-row" data-revisao-rateio-row>
                    <label>
                        <span>Setor</span>
                        <select class="form-select form-select-sm" data-revisao-rateio-campo="area">
                            <option value="">Selecione…</option>
                            ${opcoes}
                        </select>
                    </label>
                    <label>
                        <span>Quantidade</span>
                        <input class="form-control form-control-sm" data-revisao-rateio-campo="quantidade" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(rateio.quantidade ?? '')}" placeholder="0">
                    </label>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-revisao-rateio-remover>Remover</button>
                </div>
            `;
        }

        // Quantidade total do item PAD para o rateio. Quando o PAD não traz a
        // quantidade, o usuário a informa em campo próprio.
        function obterQuantidadeTotalRateioRevisao(divergencia) {
            const payload = divergencia?.payload || {};
            const candidatos = [payload.quantidadePad, payload.quantidade, divergencia?.quantidade];
            for (const valor of candidatos) {
                const numero = Number(valor);
                if (Number.isFinite(numero) && numero > 0) return numero;
            }
            return null;
        }

        function renderEditorPayloadDecisaoRevisao(divergencia) {
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            if (categoria === 'rateio') {
                const payload = divergencia?.payload || {};
                const natureza = payload.naturezaPad || payload.natureza || divergencia?.campoAfetado || '—';
                const quantidadeTotal = obterQuantidadeTotalRateioRevisao(divergencia);
                const totalConhecido = quantidadeTotal !== null;
                const blocoTotalManual = totalConhecido
                    ? `<input type="hidden" id="revisao-rateio-total" value="${escapeHtml(quantidadeTotal)}">`
                    : `<label class="form-label mt-2" for="revisao-rateio-total">Quantidade total do item</label>
                       <input class="form-control form-control-sm" id="revisao-rateio-total" type="number" min="1" step="1" inputmode="numeric" placeholder="Informe a quantidade total do item">`;
                return `
                    <div class="revisao-payload-editor" data-revisao-rateio-editor>
                        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                            <div>
                                <strong>Rateio por quantidade</strong>
                                <p class="text-muted small mb-0">Selecione o setor e a quantidade. A natureza (<strong>${escapeHtml(natureza)}</strong>) vem do PAD. Some uma linha por setor; a soma das quantidades deve fechar o total do item.</p>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-primary" data-revisao-rateio-adicionar>Adicionar linha</button>
                        </div>
                        ${blocoTotalManual}
                        <div class="revisao-rateio-list mt-2" id="revisao-rateio-list">
                            ${renderLinhaRateioRevisao()}
                        </div>
                        <p class="text-muted small mb-0 mt-2" id="revisao-rateio-saldo" aria-live="polite"></p>
                    </div>
                `;
            }
            if (categoria === 'campo') {
                return `
                    <div class="revisao-payload-editor" id="revisao-campo-corrigido-wrapper" hidden>
                        <label class="form-label" for="revisao-valor-corrigido">Valor/campo corrigido</label>
                        <input class="form-control" id="revisao-valor-corrigido" maxlength="500" placeholder="Informe o valor corrigido para decisão CORRIGIDO">
                    </div>
                `;
            }
            return '';
        }

        function lerNumeroFormularioRevisao(valor) {
            const texto = String(valor ?? '').trim();
            if (!texto) return null;
            const numero = normalizarNumeroRevisao(texto);
            return numero === null ? Number.NaN : numero;
        }

        // Coleta as linhas de rateio: setor + quantidade absoluta.
        function coletarRateiosFormularioRevisao() {
            return Array.from(document.querySelectorAll('[data-revisao-rateio-row]')).map((linha) => {
                const ler = (campo) => linha.querySelector(`[data-revisao-rateio-campo="${campo}"]`)?.value?.trim?.() || '';
                const quantidadeTexto = ler('quantidade');
                return {
                    area: ler('area'),
                    quantidade: quantidadeTexto ? lerNumeroFormularioRevisao(quantidadeTexto) : null
                };
            }).filter((rateio) => rateio.area || rateio.quantidade !== null);
        }

        // Quantidade total do item informada na tela (campo ou hidden do PAD).
        function obterTotalRateioFormularioRevisao() {
            const texto = document.getElementById('revisao-rateio-total')?.value?.trim?.() || '';
            const numero = texto ? lerNumeroFormularioRevisao(texto) : null;
            return Number.isFinite(numero) && numero > 0 ? numero : null;
        }

        function montarPayloadDecisaoRevisao(divergencia, decisao) {
            const payload = divergencia?.payload || {};
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const base = {
                origem: 'interface-revisao-divergencias',
                tipoSaneamento: obterTipoSaneamentoPayloadRevisao(divergencia)
            };

            if (categoria === 'equivalencia') {
                if (!['ACEITO', 'REJEITADO'].includes(decisao)) {
                    return {
                        ...base,
                        tipoSaneamento: 'equivalencia_por_descricao_normalizada',
                        decisao
                    };
                }
                return {
                    ...base,
                    tipoSaneamento: 'equivalencia_por_descricao_normalizada',
                    equivalenciaAceita: decisao === 'ACEITO',
                    chaveItemEquivalente: payload.chaveItem || divergencia.chaveItem || null,
                    descricaoPad: payload.descricaoPad || divergencia.valorNovo || null,
                    descricaoMemoria: payload.descricaoMemoria || divergencia.valorAnterior || null,
                    motivo: decisao === 'ACEITO'
                        ? 'equivalência validada por decisão humana'
                        : 'equivalência não validada por decisão humana'
                };
            }

            if (categoria === 'rateio') {
                if (!['ACEITO', 'CORRIGIDO'].includes(decisao)) {
                    return {
                        ...base,
                        tipoSaneamento: 'rateio_manual',
                        decisao
                    };
                }
                // A natureza vem do PAD (não é digitada).
                const naturezaPad = payload.naturezaPad || payload.natureza || '';
                const linhas = coletarRateiosFormularioRevisao();
                // Soma das quantidades informadas; base para converter em percentual.
                const somaQuantidades = linhas.reduce((total, item) => (
                    total + (Number.isFinite(item.quantidade) ? Number(item.quantidade) : 0)
                ), 0);
                // O backend (validarRateioManual) espera percentualQuantidade somando
                // 100; convertemos a quantidade de cada setor em percentual aqui.
                // A quantidade absoluta segue no payload para rastreabilidade.
                const rateio = linhas.map((item) => ({
                    area: item.area,
                    natureza: naturezaPad,
                    quantidade: item.quantidade,
                    percentualQuantidade: somaQuantidades > 0 && Number.isFinite(item.quantidade)
                        ? Number(((Number(item.quantidade) / somaQuantidades) * 100).toFixed(6))
                        : null
                }));
                const totalInformado = obterTotalRateioFormularioRevisao();
                return {
                    ...base,
                    tipoSaneamento: 'rateio_manual',
                    quantidadeTotalItem: totalInformado !== null ? totalInformado : (somaQuantidades || null),
                    rateio
                };
            }

            if (categoria === 'ausencia') {
                if (!['ACEITO', 'REJEITADO'].includes(decisao)) {
                    return {
                        ...base,
                        tipoSaneamento: 'ausencia_confirmada',
                        decisao
                    };
                }
                return {
                    ...base,
                    tipoSaneamento: 'ausencia_confirmada',
                    ausenciaConfirmada: decisao === 'ACEITO',
                    motivo: decisao === 'ACEITO'
                        ? 'item não reapresentado no PAD atual e ausência confirmada pelo usuário'
                        : 'ausência não confirmada por decisão humana'
                };
            }

            if (categoria === 'nao_apto') {
                if (!['ACEITO', 'REJEITADO'].includes(decisao)) {
                    return {
                        ...base,
                        tipoSaneamento: 'liberacao_item_nao_apto',
                        decisao
                    };
                }
                return {
                    ...base,
                    tipoSaneamento: 'liberacao_item_nao_apto',
                    liberarUsoDryRun: decisao === 'ACEITO',
                    motivo: decisao === 'ACEITO'
                        ? 'liberação validada por decisão humana'
                        : 'impedimento mantido por decisão humana'
                };
            }

            if (categoria === 'consistencia') {
                if (!['ACEITO', 'REJEITADO'].includes(decisao)) {
                    return {
                        ...base,
                        tipoSaneamento: 'consistencia_quantidade_valor_unitario',
                        decisao
                    };
                }
                return {
                    ...base,
                    tipoSaneamento: 'consistencia_quantidade_valor_unitario',
                    manterTotaisPad: decisao === 'ACEITO',
                    valorUnitarioApenasReferencia: decisao === 'ACEITO',
                    motivo: decisao === 'ACEITO'
                        ? 'total PAD mantido como fonte de verdade'
                        : 'inconsistência mantida para revisão'
                };
            }

            if (categoria === 'campo') {
                const campoAfetado = obterCampoAfetadoRevisao(divergencia);
                if (decisao === 'CORRIGIDO') {
                    return {
                        ...base,
                        tipoSaneamento: 'campo_corrigido',
                        campoAfetado,
                        valorCorrigido: document.getElementById('revisao-valor-corrigido')?.value?.trim?.() || ''
                    };
                }
                if (decisao !== 'ACEITO') {
                    return {
                        ...base,
                        tipoSaneamento: 'campo_sem_alteracao',
                        campoAfetado,
                        decisao
                    };
                }
                return {
                    ...base,
                    tipoSaneamento: 'campo_pad_aceito',
                    campoAfetado,
                    valorAceito: divergencia.valorNovo ?? obterValorPayloadRevisao(divergencia, ['valorNovo', 'valorPrevistoPad', 'valorUnitarioPad', 'quantidadePad', 'naturezaPad', 'descricaoPad']) ?? null,
                    fonteAceita: 'PAD'
                };
            }

            return {
                ...base,
                decisao
            };
        }

        function validarPayloadDecisaoRevisao(divergencia, decisao, payloadDecisao) {
            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const erros = [];

            if (categoria === 'rateio' && ['ACEITO', 'CORRIGIDO'].includes(decisao)) {
                const rateios = Array.isArray(payloadDecisao.rateio) ? payloadDecisao.rateio : [];
                if (!rateios.length) {
                    erros.push('Adicione ao menos uma linha de rateio (setor e quantidade).');
                }
                let somaQuantidade = 0;
                const setoresVistos = new Set();
                rateios.forEach((rateio, indice) => {
                    const linha = indice + 1;
                    if (!rateio.area) {
                        erros.push(`Linha ${linha}: selecione o setor.`);
                    } else if (setoresVistos.has(rateio.area)) {
                        erros.push(`Setor "${rateio.area}" repetido: use uma linha por setor.`);
                    } else {
                        setoresVistos.add(rateio.area);
                    }
                    const quantidade = Number(rateio.quantidade);
                    if (!Number.isFinite(quantidade) || quantidade <= 0) {
                        erros.push(`Linha ${linha}: informe uma quantidade maior que zero.`);
                    } else {
                        somaQuantidade += quantidade;
                    }
                });
                // A soma das quantidades deve fechar o total do item, quando conhecido.
                const totalItem = Number(payloadDecisao.quantidadeTotalItem);
                if (rateios.length && Number.isFinite(totalItem) && totalItem > 0) {
                    if (Math.abs(somaQuantidade - totalItem) > 0.001) {
                        erros.push(`A soma das quantidades (${somaQuantidade}) deve fechar o total do item (${totalItem}).`);
                    }
                } else if (rateios.length && somaQuantidade <= 0) {
                    erros.push('Informe quantidades válidas para o rateio.');
                }
            }

            if (categoria === 'campo' && decisao === 'CORRIGIDO' && !payloadDecisao.valorCorrigido) {
                erros.push('Informe o valor corrigido para decisão CORRIGIDO.');
            }

            return erros;
        }

        function renderResumoPayloadDecisaoRevisao(payloadDecisao) {
            if (!payloadDecisao || typeof payloadDecisao !== 'object') return 'Payload vazio.';
            const partes = [
                `Tipo: ${payloadDecisao.tipoSaneamento || '-'}`,
                Array.isArray(payloadDecisao.rateio) ? `Rateios: ${payloadDecisao.rateio.length}` : '',
                payloadDecisao.campoAfetado ? `Campo: ${payloadDecisao.campoAfetado}` : '',
                payloadDecisao.valorCorrigido ? `Valor corrigido: ${payloadDecisao.valorCorrigido}` : '',
                payloadDecisao.equivalenciaAceita === true ? 'Equivalência aceita: sim' : '',
                payloadDecisao.ausenciaConfirmada === true ? 'Ausência confirmada: sim' : '',
                payloadDecisao.liberarUsoDryRun === true ? 'Liberação dry-run: sim' : ''
            ].filter(Boolean);
            return partes.join(' | ') || 'Payload técnico será registrado para auditoria.';
        }

        function definirErrosFormularioDecisaoRevisao(erros = []) {
            const container = document.getElementById('revisao-form-erros');
            if (!container) return;
            container.innerHTML = erros.length
                ? `<ul class="mb-0">${erros.map((erro) => `<li>${escapeHtml(erro)}</li>`).join('')}</ul>`
                : '';
            container.hidden = !erros.length;
        }

        function comporJustificativaDecisaoRevisao() {
            const motivoTexto = document.getElementById('revisao-motivo-decisao')?.dataset?.justificativa || '';
            const observacao = document.getElementById('revisao-justificativa')?.value?.trim?.() || '';
            return [motivoTexto, observacao].filter(Boolean).join(' ').trim();
        }

        function atualizarPreviaPayloadDecisaoRevisao(divergencia) {
            const decisao = document.getElementById('revisao-decisao')?.value || '';
            const payloadDecisao = montarPayloadDecisaoRevisao(divergencia, decisao);
            const resumo = document.getElementById('revisao-payload-resumo');
            const tecnico = document.getElementById('revisao-payload-tecnico');
            if (resumo) resumo.textContent = renderResumoPayloadDecisaoRevisao(payloadDecisao);
            if (tecnico) tecnico.textContent = JSON.stringify(payloadDecisao, null, 2);

            const categoria = obterCategoriaSaneamentoRevisao(divergencia);
            const campoCorrigido = document.getElementById('revisao-campo-corrigido-wrapper');
            if (campoCorrigido) campoCorrigido.hidden = !(categoria === 'campo' && decisao === 'CORRIGIDO');

            // "Valor aplicado" só é relevante para CORRIGIDO; oculto por padrão.
            const valorAplicadoWrapper = document.getElementById('revisao-valor-aplicado-wrapper');
            if (valorAplicadoWrapper) valorAplicadoWrapper.hidden = decisao !== 'CORRIGIDO';

            // Saldo do rateio: total do item vs. soma das quantidades por setor.
            const saldoEl = document.getElementById('revisao-rateio-saldo');
            if (saldoEl && categoria === 'rateio') {
                const linhas = coletarRateiosFormularioRevisao();
                const somaQtd = linhas.reduce((t, l) => t + (Number.isFinite(l.quantidade) ? Number(l.quantidade) : 0), 0);
                const total = obterTotalRateioFormularioRevisao();
                if (total !== null) {
                    const resta = total - somaQtd;
                    saldoEl.textContent = `Atribuído: ${somaQtd} de ${total} · ${resta === 0 ? 'rateio completo' : (resta > 0 ? `faltam ${resta}` : `excedeu em ${Math.abs(resta)}`)}`;
                    saldoEl.classList.toggle('text-danger', resta !== 0);
                    saldoEl.classList.toggle('text-success', resta === 0);
                } else {
                    saldoEl.textContent = `Atribuído: ${somaQtd}. Informe a quantidade total do item.`;
                    saldoEl.classList.remove('text-success');
                    saldoEl.classList.remove('text-danger');
                }
            }
        }

        // Aplica um preset (clique na ação sugerida): preenche a decisão técnica
        // e a justificativa padrão, sem registrar. Não há mais dropdown de motivo;
        // a justificativa vem inteiramente do preset escolhido.
        function aplicarPresetDecisaoRevisao(divergencia, presetId) {
            const preset = obterPresetDecisaoRevisaoPorId(divergencia, presetId);
            if (!preset) return;
            const selectDecisao = document.getElementById('revisao-decisao');
            const motivoTexto = document.getElementById('revisao-motivo-decisao');
            if (selectDecisao) selectDecisao.value = preset.decisao;
            if (motivoTexto) {
                motivoTexto.dataset.justificativa = preset.justificativa || '';
                motivoTexto.dataset.presetId = preset.id;
                motivoTexto.textContent = preset.justificativa
                    ? `Decisão ${preset.decisao}: ${preset.justificativa}`
                    : '';
                motivoTexto.hidden = !preset.justificativa;
            }
            // Destaca o chip ativo correspondente ao preset escolhido.
            document.querySelectorAll('#revisao-acoes-rapidas [data-revisao-preset]').forEach((chip) => {
                chip.classList.toggle('is-active', chip.dataset.revisaoPreset === preset.id);
            });
            atualizarPreviaPayloadDecisaoRevisao(divergencia);
        }

        function obterAntesDepoisRevisao(divergencia) {
            const payload = divergencia?.payload || {};
            if (divergencia?.padConsolidado) {
                return {
                    antes: divergencia.memoriaConsolidada || payload.antes || payload.memoria || {},
                    depois: divergencia.padConsolidado
                };
            }
            const antesPlano = {
                descricao: payload.descricaoMemoria ?? payload.descricaoAnterior ?? payload.descricaoOriginalReferencia,
                natureza: payload.naturezaMemoria ?? payload.naturezaAnterior,
                quantidade: payload.quantidadeMemoria ?? payload.quantidadeAnterior,
                valorUnitario: payload.valorUnitarioMemoria ?? payload.valorUnitarioAnterior,
                valorPrevisto: payload.valorPrevistoMemoria ?? payload.valorPrevistoAnterior,
                valorExecutado: payload.valorExecutadoMemoria ?? payload.valorExecutadoAnterior,
                saldo: payload.saldoMemoria ?? payload.saldoAnterior
            };
            const depoisPlano = {
                descricao: payload.descricaoPad ?? payload.descricaoNova,
                natureza: payload.naturezaPad ?? payload.naturezaNova,
                quantidade: payload.quantidadePad ?? payload.quantidadeNova,
                valorUnitario: payload.valorUnitarioPad ?? payload.valorUnitarioNovo,
                valorPrevisto: payload.valorPrevistoPad ?? payload.valorPrevistoNovo,
                valorExecutado: payload.valorExecutadoPad ?? payload.valorExecutadoNovo,
                saldo: payload.saldoPad ?? payload.saldoNovo
            };
            return {
                antes: payload.antes || payload.memoria || payload.itemConhecido || payload.anterior || antesPlano,
                depois: payload.depois || payload.pad || payload.itemPad || payload.novo || depoisPlano
            };
        }

        function renderPadConsolidadoRevisao(divergencia) {
            const padConsolidado = divergencia?.padConsolidado;
            const linhas = Array.isArray(padConsolidado?.linhas) ? padConsolidado.linhas : [];
            if (!padConsolidado || !linhas.length) return '';
            return `
                <div class="revisao-consolidado-pad mt-3">
                    <h4>Linhas PAD equivalentes consolidadas</h4>
                    <div class="table-responsive">
                        <table class="table table-sm align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Linha</th>
                                    <th>Descrição</th>
                                    <th>Qtd.</th>
                                    <th>Valor unit.</th>
                                    <th>Previsto</th>
                                    <th>Executado</th>
                                    <th>Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${linhas.map((linha) => `
                                    <tr>
                                        <td>${escapeHtml(String(linha.linha || '-'))}</td>
                                        <td>${escapeHtml(linha.descricao || '-')}</td>
                                        <td>${escapeHtml(formatarValorRevisao(linha.quantidade, 'Quantidade'))}</td>
                                        <td>${escapeHtml(formatarValorRevisao(linha.valorUnitario, 'Valor unitário'))}</td>
                                        <td>${escapeHtml(formatarValorRevisao(linha.valorPrevisto, 'Valor previsto'))}</td>
                                        <td>${escapeHtml(formatarValorRevisao(linha.valorExecutado, 'Valor executado'))}</td>
                                        <td>${escapeHtml(formatarValorRevisao(linha.saldo, 'Saldo'))}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        function renderSaldoResidualPorNaturezaRevisao(divergencia) {
            const comparacao = divergencia?.comparacaoSaldoResidualPorNatureza;
            const porNatureza = Array.isArray(comparacao?.porNatureza) ? comparacao.porNatureza : [];
            if (!comparacao || porNatureza.length < 2) return '';
            const blocos = porNatureza.map((item) => {
                const memoria = item.memoria || {};
                const pad = item.pad || {};
                const badge = item.fecha
                    ? '<span class="badge bg-success">fecha</span>'
                    : '<span class="badge bg-warning text-dark">divergente</span>';
                return `
                    <div class="revisao-saldo-natureza-bloco">
                        <h5>${escapeHtml(item.natureza || '-')} ${badge}</h5>
                        <table class="table table-sm align-middle mb-1">
                            <thead><tr><th>Campo</th><th>Memória</th><th>PAD</th></tr></thead>
                            <tbody>
                                <tr><td>Valor previsto</td><td>${escapeHtml(formatarValorRevisao(memoria.valorPrevisto, 'Valor previsto'))}</td><td>${escapeHtml(formatarValorRevisao(pad.valorPrevisto, 'Valor previsto'))}</td></tr>
                                <tr><td>Valor executado</td><td>${escapeHtml(formatarValorRevisao(memoria.valorExecutado, 'Valor executado'))}</td><td>${escapeHtml(formatarValorRevisao(pad.valorExecutado, 'Valor executado'))}</td></tr>
                                <tr><td>Saldo</td><td>${escapeHtml(formatarValorRevisao(memoria.saldo, 'Saldo'))}</td><td>${escapeHtml(formatarValorRevisao(pad.saldo, 'Saldo'))}</td></tr>
                            </tbody>
                        </table>
                        <p class="text-muted small mb-0">${escapeHtml(item.motivo || '')}</p>
                    </div>
                `;
            }).join('');
            return `
                <div class="revisao-saldo-residual-natureza mt-3">
                    <h4>Saldo remanescente segregado por natureza</h4>
                    <p class="text-muted small">${escapeHtml(comparacao.diagnostico || 'CAPITAL e CUSTEIO são naturezas distintas e não equivalentes.')}</p>
                    <div class="revisao-saldo-natureza-grid">${blocos}</div>
                    <p class="revisao-saldo-natureza-total small mb-0">
                        Total (apenas conferência, não é chave de equivalência):
                        memória ${escapeHtml(formatarValorRevisao(comparacao.totalMemoriaPrevisto, 'Valor previsto'))}
                        x PAD ${escapeHtml(formatarValorRevisao(comparacao.totalPadPrevisto, 'Valor previsto'))}.
                    </p>
                </div>
            `;
        }

        // Apresentação para alertas cuja fonte é apenas o PAD (inconsistência
        // quantidade x valor unitário): não há "memória" para comparar, então
        // exibe Dados do PAD, Cálculo exibido, Cálculo efetivo e Conclusão.
        function renderConsistenciaQuantidadeRevisao(divergencia) {
            const c = divergencia?.consistenciaQuantidadeValorUnitario;
            const a = c?.avaliacao;
            if (!c || !a) return '';
            const fp = a.falsoPositivoPorArredondamento;
            const badge = fp
                ? '<span class="badge bg-success">Falso positivo saneável</span>'
                : '<span class="badge bg-warning text-dark">Pendência real</span>';
            return `
                <section class="revisao-detail-section">
                    <h3>Auditoria de quantidade × valor unitário</h3>
                    <div class="revisao-pad-auditoria">
                        <div class="revisao-pad-bloco">
                            <h4>Dados do PAD</h4>
                            <dl class="revisao-diagnostic-list">
                                <div><dt>Descrição</dt><dd>${escapeHtml(c.descricao || '-')}</dd></div>
                                <div><dt>Linha PAD</dt><dd>${escapeHtml(String(c.linhaPad ?? '-'))}</dd></div>
                                <div><dt>Convênio</dt><dd>${escapeHtml(c.numeroConvenio || '-')}</dd></div>
                                <div><dt>UF</dt><dd>${escapeHtml(c.uf || '-')}</dd></div>
                                <div><dt>Código de natureza</dt><dd>${escapeHtml(c.codigoNaturezaDespesa || '-')}</dd></div>
                                <div><dt>Natureza</dt><dd>${escapeHtml(c.natureza || '-')}</dd></div>
                                <div><dt>Quantidade</dt><dd>${escapeHtml(formatarValorRevisao(a.quantidade, 'Quantidade'))}</dd></div>
                            </dl>
                        </div>
                        <div class="revisao-pad-bloco">
                            <h4>Cálculo exibido</h4>
                            <dl class="revisao-diagnostic-list">
                                <div><dt>Valor unitário exibido</dt><dd>${escapeHtml(formatarValorRevisao(a.valorUnitarioExibido, 'Valor unitário'))}</dd></div>
                                <div><dt>Quantidade × unitário exibido</dt><dd>${escapeHtml(formatarValorRevisao(a.valorCalculadoComUnitarioExibido, 'Valor previsto'))}</dd></div>
                                <div><dt>Valor previsto informado</dt><dd>${escapeHtml(formatarValorRevisao(a.valorPrevistoInformado, 'Valor previsto'))}</dd></div>
                                <div><dt>Diferença</dt><dd>${escapeHtml(formatarValorRevisao(a.diferencaAbsoluta, 'Valor previsto'))}</dd></div>
                            </dl>
                        </div>
                        <div class="revisao-pad-bloco">
                            <h4>Cálculo efetivo</h4>
                            <dl class="revisao-diagnostic-list">
                                <div><dt>Valor unitário efetivo</dt><dd>${escapeHtml(formatarValorRevisao(a.valorUnitarioEfetivo, 'Valor unitário'))}</dd></div>
                                <div><dt>Unitário efetivo (2 casas)</dt><dd>${escapeHtml(formatarValorRevisao(a.valorUnitarioEfetivoArredondado, 'Valor unitário'))}</dd></div>
                                <div><dt>Tolerância aplicada</dt><dd>${escapeHtml(formatarValorRevisao(a.toleranciaMaxima, 'Valor previsto'))}</dd></div>
                            </dl>
                        </div>
                        <div class="revisao-pad-bloco revisao-pad-conclusao">
                            <h4>Conclusão da auditoria ${badge}</h4>
                            <p class="mb-1">${escapeHtml(a.motivo || '')}</p>
                            <p class="mb-0"><strong>Ação sugerida:</strong> ${escapeHtml(c.acaoSugeridaTela || '-')}</p>
                        </div>
                    </div>
                </section>
            `;
        }

        function renderComparacaoRevisao(divergencia) {
            // Alertas de inconsistência quantidade x valor unitário têm fonte
            // apenas no PAD: usam apresentação própria, não Antes/Depois.
            if (divergencia?.consistenciaQuantidadeValorUnitario?.avaliacao) {
                return renderConsistenciaQuantidadeRevisao(divergencia);
            }
            const { antes, depois } = obterAntesDepoisRevisao(divergencia);
            const isExistencia = obterCampoAfetadoRevisao(divergencia) === 'existencia';
            const linhas = [
                renderCampoComparacaoRevisao('Descrição',
                    obterValorAninhadoRevisao(antes, ['descricao', 'descricaoOriginal', 'descricaoOriginalReferencia']),
                    obterValorAninhadoRevisao(depois, ['descricao', 'descricaoOriginal']), isExistencia),
                renderCampoComparacaoRevisao('Área',
                    obterValorAninhadoRevisao(antes, ['area']),
                    obterValorAninhadoRevisao(depois, ['area']), isExistencia),
                renderCampoComparacaoRevisao('Natureza',
                    obterValorAninhadoRevisao(antes, ['natureza']),
                    obterValorAninhadoRevisao(depois, ['natureza']), isExistencia),
                renderCampoComparacaoRevisao('Quantidade',
                    obterValorAninhadoRevisao(antes, ['quantidade', 'quantidadeReferencia']),
                    obterValorAninhadoRevisao(depois, ['quantidade']), isExistencia),
                renderCampoComparacaoRevisao('Valor unitário',
                    obterValorAninhadoRevisao(antes, ['valorUnitario', 'valorUnitarioReferencia']),
                    obterValorAninhadoRevisao(depois, ['valorUnitario']), isExistencia),
                renderCampoComparacaoRevisao('Valor previsto',
                    obterValorAninhadoRevisao(antes, ['valorPrevisto', 'valorPrevistoReferencia']),
                    obterValorAninhadoRevisao(depois, ['valorPrevisto', 'valorTotalPrevisto']), isExistencia),
                renderCampoComparacaoRevisao('Valor executado',
                    obterValorAninhadoRevisao(antes, ['valorExecutado', 'valorExecutadoReferencia']),
                    obterValorAninhadoRevisao(depois, ['valorExecutado', 'valorTotalExecutado']), isExistencia),
                renderCampoComparacaoRevisao('Saldo',
                    obterValorAninhadoRevisao(antes, ['saldo']),
                    obterValorAninhadoRevisao(depois, ['saldo']), isExistencia),
                renderCampoComparacaoRevisao('Campo afetado', divergencia.campoAfetado, divergencia.campoAfetado, isExistencia),
                // Para campoAfetado = 'existencia', valorAnterior/valorNovo são
                // marcadores de estado ('presente_na_memoria'/'ausente_no_pad'),
                // não descrição. Exibe como "Estado anterior/novo" legível.
                (isExistencia
                    ? renderCampoComparacaoRevisao('Estado anterior / novo', divergencia.valorAnterior, divergencia.valorNovo, isExistencia)
                    : renderCampoComparacaoRevisao('Valor anterior / novo', divergencia.valorAnterior, divergencia.valorNovo, isExistencia)),
                renderCampoComparacaoRevisao('Diferença', divergencia.diferenca, divergencia.diferenca, isExistencia),
                renderCampoComparacaoRevisao('Fonte', divergencia.fonteAnterior, divergencia.fonteNova, isExistencia)
            ].filter(Boolean).join('');

            return `
                <section class="revisao-detail-section">
                    <h3>Antes x Depois</h3>
                    <div class="revisao-comparacao-grid" aria-label="Comparação entre memória atual e PAD novo">
                        <div class="revisao-comparacao-header"><span>Campo</span><strong>ANTES — memória atual</strong><strong>DEPOIS — PAD novo</strong></div>
                        ${linhas || '<div class="revisao-comparacao-empty">Payload sem campos comparáveis estruturados.</div>'}
                    </div>
                    ${renderSaldoResidualPorNaturezaRevisao(divergencia)}
                    ${renderPadConsolidadoRevisao(divergencia)}
                </section>
            `;
        }

        function renderDiagnosticoAutomaticoRevisao(divergencia) {
            const payload = divergencia?.payload || {};
            // Para falso positivo saneável por arredondamento, a ação sugerida
            // não deve ser "Aceitar total do PAD": o total já é preservado.
            const consistencia = divergencia?.consistenciaQuantidadeValorUnitario;
            const acaoSugerida = consistencia?.avaliacao?.falsoPositivoPorArredondamento
                ? 'Saneado tecnicamente — total do PAD preservado.'
                : (divergencia.acaoSugerida || '-');
            return `
                <section class="revisao-detail-section">
                    <h3>Diagnóstico automático</h3>
                    <dl class="revisao-diagnostic-list">
                        <div><dt>Motivo provável</dt><dd>${escapeHtml(divergencia.motivoProvavel || '-')}</dd></div>
                        <div><dt>Categoria operacional</dt><dd>${escapeHtml(divergencia.categoriaOperacional || '-')}</dd></div>
                        <div><dt>Ação operacional recomendada</dt><dd>${escapeHtml(divergencia.acaoOperacionalRecomendada || '-')}</dd></div>
                        <div><dt>Motivos de saneamento</dt><dd>${Array.isArray(divergencia.motivosSaneamento) && divergencia.motivosSaneamento.length ? `<ul class="mb-0">${divergencia.motivosSaneamento.map((motivo) => `<li>${escapeHtml(motivo)}</li>`).join('')}</ul>` : '-'}</dd></div>
                        <div><dt>Saldo residual/remanescente</dt><dd>${divergencia.saldoResidualTecnico ? `<strong>Saldo residual técnico</strong><p class="mb-0 mt-1">${escapeHtml(divergencia.alertaSaldoResidual || 'Item técnico não setorializado por área e segregado por natureza.')}</p>` : '-'}</dd></div>
                        <div><dt>Evidências</dt><dd>${renderObjetoResumoRevisao(payload.evidencias || payload.evidencia || {})}</dd></div>
                        <div><dt>Risco de falso positivo</dt><dd>${escapeHtml(payload.riscoFalsoPositivo || payload.risco_falso_positivo || '-')}</dd></div>
                        <div><dt>Ação sugerida</dt><dd>${escapeHtml(acaoSugerida)}</dd></div>
                        <div><dt>Impacto na reconstrução</dt><dd>${escapeHtml(divergencia.impactoReconstrucao || '-')}</dd></div>
                    </dl>
                </section>
            `;
        }

        function renderLogsDecisoesRevisao(divergencia) {
            const decisoes = Array.isArray(divergencia.decisoes) ? divergencia.decisoes : [];
            const logs = Array.isArray(divergencia.logs) ? divergencia.logs : [];
            return `
                <section class="revisao-detail-section">
                    <h3>Logs e decisões</h3>
                    <div class="revisao-history-grid">
                        <div>
                            <h4>Decisões</h4>
                            ${decisoes.length ? decisoes.map((decisao) => `
                                <article class="revisao-history-item">
                                    <div><strong>${escapeHtml(decisao.decisao || '-')}</strong> por ${escapeHtml(decisao.usuario || '-')}</div>
                                    <small>${escapeHtml(formatarDataHoraRevisao(decisao.decididoEm || decisao.criadoEm))}</small>
                                    ${decisao.justificativa ? `<p class="mb-0 mt-1">${escapeHtml(decisao.justificativa)}</p>` : ''}
                                </article>
                            `).join('') : '<p class="text-muted mb-0">Nenhuma decisão registrada.</p>'}
                        </div>
                        <div>
                            <h4>Logs</h4>
                            ${logs.length ? logs.map((log) => `
                                <article class="revisao-history-item">
                                    <div><strong>${escapeHtml(log.evento || '-')}</strong> por ${escapeHtml(log.usuario || '-')}</div>
                                    <small>${escapeHtml(formatarDataHoraRevisao(log.criadoEm))}</small>
                                    ${log.detalhe ? `<p class="mb-1 mt-1">${escapeHtml(log.detalhe)}</p>` : ''}
                                    <details class="mt-1">
                                        <summary class="text-muted small" style="cursor: pointer; font-size: 0.68rem;">Ver detalhes do estado</summary>
                                        <pre class="mb-0 mt-1 scrollable-json" style="font-size: 0.68rem; max-height: 80px; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 0.25rem; border-radius: 4px;">${escapeHtml(JSON.stringify({ anterior: log.estadoAnterior, novo: log.estadoNovo }, null, 2))}</pre>
                                    </details>
                                </article>
                            `).join('') : '<p class="text-muted mb-0">Nenhum log registrado.</p>'}
                        </div>
                    </div>
                </section>
            `;
        }

        function renderFormularioDecisaoRevisao(divergencia) {
            const decisoes = obterDecisoesPermitidasRevisao(divergencia);
            const presets = obterPresetsDecisaoRevisao(divergencia);
            const chips = presets.map((preset) => `
                <button type="button"
                    class="revisao-acao-chip revisao-acao-chip--${escapeHtml(preset.variante || 'secondary')}"
                    data-revisao-preset="${escapeHtml(preset.id)}"
                    title="${escapeHtml(preset.justificativa || '')}">
                    ${escapeHtml(preset.label)}
                </button>
            `).join('');
            return `
                <section class="revisao-detail-section revisao-decision-panel">
                    <h3>Registrar decisão</h3>
                    <p class="text-muted small">A decisão será registrada e auditada, mas não será aplicada ao planoAplicacao oficial nesta etapa.</p>
                    <form id="form-revisao-decisao" data-divergencia-id="${escapeHtml(String(divergencia.id))}">
                        <p class="revisao-acao-rapida-titulo">Ação sugerida</p>
                        <div class="revisao-acao-rapida" id="revisao-acoes-rapidas" role="group" aria-label="Ações rápidas de decisão">
                            ${chips}
                        </div>
                        <p class="revisao-motivo-decisao text-muted small mb-0 mt-1" id="revisao-motivo-decisao" hidden></p>
                        <div class="row g-2 mt-1">
                            <div class="col-12" id="revisao-editor-wrapper">
                                ${renderEditorPayloadDecisaoRevisao(divergencia)}
                            </div>
                            <div class="col-12" id="revisao-valor-aplicado-wrapper" hidden>
                                <label class="form-label" for="revisao-valor-aplicado">Valor aplicado (opcional)</label>
                                <input class="form-control form-control-sm" id="revisao-valor-aplicado" maxlength="255" placeholder="Uso futuro/auditoria">
                            </div>
                        </div>
                        <details class="revisao-observacao-extra mt-2">
                            <summary>Observação adicional (opcional)</summary>
                            <textarea class="form-control mt-2" id="revisao-justificativa" rows="2" maxlength="2000" placeholder="Texto livre opcional — somado ao motivo padrão selecionado."></textarea>
                        </details>
                        <details class="revisao-avancado mt-2">
                            <summary>Opções avançadas (decisão manual)</summary>
                            <div class="row g-2 mt-1">
                                <div class="col-12">
                                    <label class="form-label" for="revisao-decisao">Decisão (campo técnico)</label>
                                    <select class="form-select form-select-sm" id="revisao-decisao" required>
                                        ${decisoes.map((decisao) => `<option value="${decisao}">${decisao}</option>`).join('')}
                                    </select>
                                    <p class="text-muted small mb-0" style="font-size:0.68rem;">Definido automaticamente pela ação/motivo. Ajuste apenas para decisões fora dos presets.</p>
                                </div>
                            </div>
                        </details>
                        <div id="revisao-form-erros" class="revisao-form-erros mt-2" hidden></div>
                        <div class="revisao-payload-box mt-2">
                            <strong>Resumo do payload</strong>
                            <p id="revisao-payload-resumo" class="mb-1 text-muted small" style="font-size: 0.72rem;">Payload técnico será montado conforme a decisão.</p>
                            <details>
                                <summary style="font-size: 0.72rem; color: var(--color-primary-strong); cursor: pointer;">Ver payload técnico</summary>
                                <pre id="revisao-payload-tecnico" style="font-size: 0.72rem; max-height: 80px; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 0.25rem; border-radius: 4px; margin-top: 0.25rem;">{}</pre>
                            </details>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                            <button type="submit" class="btn btn-primary btn-sm btn-icon-text" data-requer-backend="true">
                                <i class="fas fa-check" aria-hidden="true"></i>
                                <span>Registrar decisão</span>
                            </button>
                            <span class="text-muted" style="font-size: 0.7rem;">Esta tela é de revisão e saneamento; não publica dados.</span>
                        </div>
                    </form>
                </section>
            `;
        }

        function renderDetalheDivergenciaRevisao(divergencia) {
            // O detalhe é renderizado inline, na linha expandida da tabela
            // (host com [data-revisao-detalhe-host]). Fallback: painel do rodapé.
            const container = document.querySelector('[data-revisao-detalhe-host]')
                || document.getElementById('revisao-divergencia-detalhe');
            if (!container) return;
            container.innerHTML = `
                <article class="revisao-detail-panel">
                    <div class="revisao-detail-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <p class="section-eyebrow mb-1">Divergência #${escapeHtml(String(divergencia.id))}</p>
                            <h2>${escapeHtml(divergencia.tipoAlerta || 'Divergência')}</h2>
                            <div class="revisao-detail-meta">
                                ${renderBadgeRevisao(divergencia.status, classeStatusRevisao(divergencia.status))}
                                ${renderBadgeRevisao(`Nível original: ${divergencia.nivel}`, classeNivelRevisao(divergencia.nivel))}
                                ${divergencia.falsoPositivoSaneavel ? renderBadgeRevisao('Saneado tecnicamente', 'success') : ''}
                                ${divergencia.saldoResidualTecnico ? renderBadgeRevisao('Saldo residual técnico', 'warning') : ''}
                                ${divergencia.categoriaOperacional ? renderBadgeRevisao(divergencia.categoriaOperacional, 'secondary') : ''}
                                ${renderBadgeRevisao(`Convênio ${divergencia.numeroConvenio || '-'}`, 'secondary')}
                                ${renderBadgeRevisao(`UF ${divergencia.uf || '-'}`, 'secondary')}
                                ${(() => {
                                    if (calcularBloqueioEfetivoRevisao(divergencia)) {
                                        return renderBadgeRevisao('Bloqueio ativo', 'danger');
                                    } else if (divergencia.bloqueiaPublicacao === true) {
                                        return renderBadgeRevisao('Bloqueio original saneado', 'secondary');
                                    } else {
                                        return renderBadgeRevisao('Não bloqueante', 'success');
                                    }
                                })()}
                            </div>
                        </div>
                    </div>
                    <div class="revisao-detail-body-grid">
                        <div class="revisao-detail-left">
                            <ul class="nav nav-tabs revisao-nav-tabs" id="revisaoDetailTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="diagnostico-tab" data-bs-toggle="tab" data-bs-target="#diagnostico-pane" type="button" role="tab" aria-controls="diagnostico-pane" aria-selected="true">
                                        <i class="fas fa-stethoscope me-2"></i>Diagnóstico & Saneamento
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="comparacao-tab" data-bs-toggle="tab" data-bs-target="#comparacao-pane" type="button" role="tab" aria-controls="comparacao-pane" aria-selected="false">
                                        <i class="fas fa-columns me-2"></i>Comparação antes x depois
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="historico-tab" data-bs-toggle="tab" data-bs-target="#historico-pane" type="button" role="tab" aria-controls="historico-pane" aria-selected="false">
                                        <i class="fas fa-history me-2"></i>Histórico & Logs (${(divergencia.decisoes?.length || 0) + (divergencia.logs?.length || 0)})
                                    </button>
                                </li>
                            </ul>
                            <div class="tab-content revisao-tab-content mt-3" id="revisaoDetailTabsContent">
                                <div class="tab-pane fade show active" id="diagnostico-pane" role="tabpanel" aria-labelledby="diagnostico-tab" tabindex="0">
                                    ${renderSaneamentoEstruturadoRevisao(divergencia)}
                                    ${renderDiagnosticoAutomaticoRevisao(divergencia)}
                                </div>
                                <div class="tab-pane fade" id="comparacao-pane" role="tabpanel" aria-labelledby="comparacao-tab" tabindex="0">
                                    ${renderComparacaoRevisao(divergencia)}
                                </div>
                                <div class="tab-pane fade" id="historico-pane" role="tabpanel" aria-labelledby="historico-tab" tabindex="0">
                                    ${renderLogsDecisoesRevisao(divergencia)}
                                </div>
                            </div>
                        </div>
                        <div class="revisao-detail-right">
                            ${renderFormularioDecisaoRevisao(divergencia)}
                        </div>
                    </div>
                </article>
            `;
            registrarEventoFormularioDecisaoRevisao(divergencia);
            aplicarModoSomenteLeituraControlada();
        }

        function renderAuditoriaRevisao(auditoria) {
            const container = document.getElementById('revisao-auditoria-resumo');
            if (!container) return;
            const liberada = auditoria?.publicacaoLiberada === true;
            const itens = [
                ['Total', auditoria?.totalDivergencias],
                ['Pendentes', auditoria?.totalPendentes],
                ['Em revisão', auditoria?.totalEmRevisao],
                ['Impeditivas', auditoria?.totalImpeditivas],
                ['Bloqueiam publicação', auditoria?.totalBloqueiamPublicacao],
                ['Pendentes bloqueantes', auditoria?.totalPendentesQueBloqueiamPublicacao],
                ['Em revisão bloqueantes', auditoria?.totalEmRevisaoQueBloqueiamPublicacao],
                ['Com decisão resolutiva', auditoria?.totalComDecisaoResolutiva],
                ['Com comentário', auditoria?.totalComComentario],
                ['Sem decisão resolutiva', auditoria?.totalSemDecisaoResolutiva]
            ];
            container.innerHTML = `
                <div class="revisao-publicacao-status ${liberada ? 'is-free' : 'is-blocked'}">
                    <i class="fas ${liberada ? 'fa-circle-check' : 'fa-lock'}" aria-hidden="true"></i>
                    <div>
                        <strong>${liberada ? 'Publicação informativamente liberada' : 'Publicação bloqueada'}</strong>
                        <span>A reconstrução e a publicação continuam bloqueadas enquanto houver divergências pendentes ou em revisão que bloqueiem publicação.</span>
                    </div>
                </div>
                <div class="revisao-audit-grid">
                    ${itens.map(([rotulo, valor]) => `
                        <div class="revisao-audit-card">
                            <span>${escapeHtml(rotulo)}</span>
                            <strong>${escapeHtml(String(valor ?? 0))}</strong>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function obterFiltrosRevisao() {
            const valor = (id) => document.getElementById(id)?.value?.trim?.() || '';
            const filtros = {
                status: valor('revisao-filtro-status'),
                nivel: valor('revisao-filtro-nivel'),
                tipo: valor('revisao-filtro-tipo'),
                convenio: valor('revisao-filtro-convenio'),
                uf: valor('revisao-filtro-uf').toUpperCase(),
                bloqueiaPublicacao: valor('revisao-filtro-bloqueia'),
                saldoResidual: valor('revisao-filtro-saldo-residual'),
                categoriaOperacional: valor('revisao-filtro-categoria-operacional'),
                limite: '500'
            };
            const mostrarSaneados = document.getElementById('revisao-filtro-mostrar-saneados')?.checked === true;
            if (!mostrarSaneados && !filtros.categoriaOperacional) filtros.operacionalEfetiva = 'true';
            if (document.getElementById('revisao-filtro-sem-decisao')?.checked) filtros.semDecisaoResolutiva = 'true';
            if (document.getElementById('revisao-filtro-com-decisao')?.checked) filtros.comDecisaoResolutiva = 'true';
            return filtros;
        }

        function montarQueryRevisao(filtros = {}) {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([chave, valor]) => {
                if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
            });
            const texto = params.toString();
            return texto ? `?${texto}` : '';
        }

        async function buscarJsonRevisao(caminho, opcoes) {
            const { resposta, payload } = await fetchJsonApiOnasp(caminho, opcoes);
            if (!resposta.ok || !payload?.success) {
                throw new Error(payload?.message || `Falha na API de revisão (status ${resposta.status}).`);
            }
            return payload;
        }

        async function carregarAuditoriaRevisao() {
            const payload = await buscarJsonRevisao('/api/profor-2022/revisao/auditoria');
            revisaoDivergenciasEstado.auditoria = payload.auditoria || {};
            renderAuditoriaRevisao(revisaoDivergenciasEstado.auditoria);
        }

        // Decide se a divergência é uma pendência operacional real, ou seja,
        // deve aparecer na lista padrão. Histórico não reapresentado, item já
        // saneado por diacrítico e divergência com decisão resolutiva não são
        // pendências operacionais — ficam ocultos salvo modo auditoria.
        function ehPendenciaOperacionalRevisao(item) {
            if (item?.categoriaOperacional) return item.categoriaOperacional === 'pendencia_operacional_real';
            const statusResolutivo = ['ACEITO', 'REJEITADO', 'CORRIGIDO', 'REVERTIDO'].includes(item?.status);
            if (statusResolutivo) return false;
            if (item?.reapresentada === false) return false;
            if (item?.falsoPositivoSaneavel === true) return false;
            if (divergenciaSaneadaPorDiacriticoRevisao(item)) return false;
            return true;
        }

        // Atualiza o contador de pendências bem visível no topo da tela.
        function atualizarContadorPendenciasRevisao(pendentes, ocultadas = 0, mostrarSaneados = false) {
            const numeroEl = document.getElementById('revisao-contador-numero');
            const tituloEl = document.getElementById('revisao-contador-titulo');
            const detalheEl = document.getElementById('revisao-contador-detalhe');
            const containerEl = document.getElementById('revisao-contador-pendencias');
            if (!numeroEl || !tituloEl || !detalheEl) return;
            const total = Number(pendentes) || 0;
            numeroEl.textContent = String(total);
            if (mostrarSaneados) {
                tituloEl.textContent = total === 1 ? 'divergência listada' : 'divergências listadas';
                detalheEl.textContent = 'Modo auditoria: exibindo também históricos e itens já saneados.';
            } else {
                tituloEl.textContent = total === 1 ? 'pendência operacional' : 'pendências operacionais';
                detalheEl.textContent = total === 0
                    ? (ocultadas > 0
                        ? `Nenhuma pendência operacional. ${ocultadas} histórico(s)/saneado(s) oculto(s).`
                        : 'Nenhuma pendência operacional a revisar.')
                    : `${total} divergência(s) aguardando decisão${ocultadas > 0 ? ` · ${ocultadas} histórico(s)/saneado(s) oculto(s)` : ''}.`;
            }
            if (containerEl) {
                containerEl.classList.toggle('is-zerado', total === 0 && !mostrarSaneados);
            }
        }

        async function carregarListaRevisao() {
            const tbody = document.querySelector('#tabela-revisao-divergencias tbody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Carregando divergências…</td></tr>';
            try {
                const payload = await buscarJsonRevisao(`/api/profor-2022/revisao/divergencias${montarQueryRevisao(obterFiltrosRevisao())}`);
                const recebidas = Array.isArray(payload.divergencias) ? payload.divergencias : [];
                const mostrarSaneados = document.getElementById('revisao-filtro-mostrar-saneados')?.checked === true;
                const categoriaOperacionalSelecionada = document.getElementById('revisao-filtro-categoria-operacional')?.value?.trim?.() || '';
                // Lista operacional padrão: oculta históricos/saneados; modo
                // auditoria ("Mostrar históricos/saneados") exibe tudo.
                const visiveis = (mostrarSaneados || categoriaOperacionalSelecionada)
                    ? recebidas
                    : recebidas.filter(ehPendenciaOperacionalRevisao);
                const ocultadas = recebidas.length - visiveis.length;
                revisaoDivergenciasEstado.divergencias = visiveis;
                revisaoDivergenciasEstado.total = Number(payload.total || 0);
                const totalLabel = ocultadas > 0 && !mostrarSaneados
                    ? `${visiveis.length} pendência(s) operacional(is) · ${ocultadas} histórico(s)/saneado(s) oculto(s)`
                    : `${visiveis.length} divergência(s)`;
                document.getElementById('revisao-lista-total').textContent = totalLabel;
                atualizarContadorPendenciasRevisao(visiveis.length, ocultadas, mostrarSaneados);
                if (!visiveis.length) {
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Nenhuma pendência operacional para os filtros. Marque "Mostrar históricos/saneados" para auditoria.</td></tr>';
                    return;
                }
                tbody.innerHTML = visiveis.map((item) => `
                    <tr>
                        <td>${renderBadgeRevisao(item.status, classeStatusRevisao(item.status))}${item.falsoPositivoSaneavel ? ` ${renderBadgeRevisao('Saneado tecnicamente', 'success')}` : ''}</td>
                        <td>${renderBadgeRevisao(item.nivel, classeNivelRevisao(item.nivel))}</td>
                        <td>${escapeHtml(item.numeroConvenio || '-')}</td>
                        <td>${escapeHtml(item.uf || '-')}</td>
                        <td>${escapeHtml(item.tipoAlerta || '-')}${(() => {
                            const c = item.consistenciaQuantidadeValorUnitario;
                            if (c && c.descricao) {
                                return `<div class="small text-body">${escapeHtml(c.descricao)}</div>`
                                    + `<div class="text-muted small">Linha PAD ${escapeHtml(String(c.linhaPad ?? '-'))}</div>`;
                            }
                            return '';
                        })()}${item.saldoResidualTecnico ? '<div class="small text-warning">Saldo residual técnico</div>' : ''}${item.categoriaOperacional ? `<div class="text-muted small">${escapeHtml(item.categoriaOperacional)}</div>` : ''}</td>
                        <td>${escapeHtml(item.campoAfetado || '-')}</td>
                        <td>${escapeHtml(item.motivoProvavel || item.acaoSugerida || '-')}</td>
                        <td>${(() => {
                            if (calcularBloqueioEfetivoRevisao(item)) {
                                return renderBadgeRevisao('Sim', 'danger');
                            } else if (item.bloqueiaPublicacao === true) {
                                return renderBadgeRevisao('Não — resolvido', 'secondary', 'Bloqueio original saneado por decisão.');
                            } else {
                                return renderBadgeRevisao('Não', 'success');
                            }
                        })()}</td>

                        <td class="text-end">
                            <button type="button" class="btn btn-sm btn-outline-primary" data-revisao-abrir="${escapeHtml(String(item.id))}">
                                Revisar
                            </button>
                        </td>
                    </tr>
                `).join('');
            } catch (error) {
                console.error('Falha ao carregar divergências PAD x memória:', error);
                tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">${escapeHtml(error.message || 'Falha ao carregar divergências.')}</td></tr>`;
            }
        }

        // Remove qualquer linha de detalhe expandida da tabela.
        function fecharDetalheInlineRevisao() {
            document.querySelectorAll('tr.revisao-linha-detalhe').forEach((tr) => tr.remove());
            document.querySelectorAll('#tabela-revisao-divergencias tbody tr.table-active')
                .forEach((tr) => tr.classList.remove('table-active'));
        }

        async function abrirDetalheRevisao(id) {
            const botao = document.querySelector(`[data-revisao-abrir="${id}"]`);
            const trItem = botao ? botao.closest('tr') : null;
            const colunas = document.querySelectorAll('#tabela-revisao-divergencias thead th').length || 9;

            // Acordeão com toggle: se a divergência clicada já está expandida,
            // recolhe e encerra (segundo clique fecha).
            if (trItem
                && trItem.classList.contains('table-active')
                && trItem.nextElementSibling
                && trItem.nextElementSibling.classList.contains('revisao-linha-detalhe')) {
                fecharDetalheInlineRevisao();
                revisaoDivergenciasEstado.detalheAtualId = null;
                return;
            }

            // Caso contrário: fecha qualquer detalhe aberto e expande a clicada.
            fecharDetalheInlineRevisao();

            let originalTexto = '';
            let linhaDetalhe = null;
            if (botao) {
                originalTexto = botao.innerHTML;
                botao.disabled = true;
                botao.textContent = 'Carregando...';
            }
            if (trItem) {
                trItem.classList.add('table-active');
                // Insere a linha de detalhe logo abaixo da linha clicada.
                // O wrapper interno (.revisao-detalhe-anim) anima a expansão
                // via grid-template-rows: 0fr -> 1fr.
                linhaDetalhe = document.createElement('tr');
                linhaDetalhe.className = 'revisao-linha-detalhe';
                linhaDetalhe.innerHTML = `<td colspan="${colunas}" class="revisao-linha-detalhe-cel">`
                    + '<div class="revisao-detalhe-anim">'
                    + '<div class="revisao-detalhe-anim-inner" data-revisao-detalhe-host>'
                    + '<div class="revisao-detail-panel text-muted">Carregando detalhe da divergência…</div>'
                    + '</div></div></td>';
                trItem.insertAdjacentElement('afterend', linhaDetalhe);
                // Força um reflow e ativa a classe que dispara a transição.
                void linhaDetalhe.offsetHeight;
                linhaDetalhe.classList.add('is-aberta');
            }
            // Fallback (sem linha na tabela): usa o painel do rodapé.
            const containerRodape = document.getElementById('revisao-divergencia-detalhe');
            if (!trItem && containerRodape) {
                containerRodape.innerHTML = '<div class="revisao-detail-panel text-muted">Carregando detalhe da divergência…</div>';
            }

            try {
                const payload = await buscarJsonRevisao(`/api/profor-2022/revisao/divergencias/${encodeURIComponent(id)}`);
                revisaoDivergenciasEstado.detalheAtualId = Number(id);
                renderDetalheDivergenciaRevisao(payload.divergencia);
                // Mantém a linha clicada visível, sem pulo para o rodapé.
                if (trItem && typeof trItem.scrollIntoView === 'function') {
                    trItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } catch (error) {
                const host = document.querySelector('[data-revisao-detalhe-host]') || containerRodape;
                if (host) {
                    host.innerHTML = `<div class="revisao-detail-panel text-danger">${escapeHtml(error.message || 'Falha ao carregar detalhe.')}</div>`;
                }
            } finally {
                if (botao) {
                    botao.disabled = false;
                    botao.innerHTML = originalTexto;
                }
            }
        }

        // Após registrar uma decisão, abre automaticamente a próxima pendência
        // da lista — o usuário não precisa rolar de volta e clicar em "Revisar".
        // `indiceDecidida` é a posição que a divergência decidida ocupava na
        // lista anterior; como ela sai da lista, a próxima pendência costuma
        // assumir esse mesmo índice.
        function avancarParaProximaPendenciaRevisao(indiceDecidida, idDecidida) {
            const lista = Array.isArray(revisaoDivergenciasEstado.divergencias)
                ? revisaoDivergenciasEstado.divergencias
                : [];
            const detalheRodape = document.getElementById('revisao-divergencia-detalhe');
            if (!lista.length) {
                // Fila zerada: fecha a linha expandida e mostra conclusão.
                fecharDetalheInlineRevisao();
                if (detalheRodape) {
                    detalheRodape.innerHTML = '<div class="revisao-detail-panel revisao-detail-concluido">'
                        + '<strong>Fila de pendências concluída.</strong>'
                        + '<p class="mb-0 text-muted">Não há mais pendências operacionais para os filtros atuais.</p></div>';
                }
                const contador = document.getElementById('revisao-contador-pendencias');
                if (contador && typeof contador.scrollIntoView === 'function') {
                    contador.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return;
            }
            // A próxima pendência é a que assumiu o índice da decidida; se a
            // decidida era a última, volta para a nova última da lista.
            let alvo = null;
            if (Number.isInteger(indiceDecidida) && indiceDecidida >= 0) {
                alvo = lista[indiceDecidida] || lista[lista.length - 1];
            } else {
                alvo = lista[0];
            }
            // Salvaguarda: nunca reabrir a divergência recém-decidida.
            if (alvo && String(alvo.id) === String(idDecidida)) {
                alvo = lista.find((d) => String(d.id) !== String(idDecidida)) || null;
            }
            if (alvo) {
                abrirDetalheRevisao(alvo.id);
            } else {
                fecharDetalheInlineRevisao();
                if (detalheRodape) {
                    detalheRodape.innerHTML = '<div class="revisao-detail-panel text-muted">Selecione uma divergência para revisar.</div>';
                }
            }
        }

        function renderFiltrosRevisao() {
            const auditoria = revisaoDivergenciasEstado.auditoria || {};
            const tipos = Array.isArray(auditoria.porTipo) ? auditoria.porTipo.map((item) => item.chave).filter(Boolean) : [];
            return `
                <section class="revisao-panel mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Consulta operacional</p>
                            <h2>Filtros</h2>
                        </div>
                        <span id="revisao-lista-total" class="text-muted small">0 divergência(s)</span>
                    </div>
                    <form id="form-revisao-filtros" class="revisao-filter-grid">
                        <label><span>Status</span><select id="revisao-filtro-status" class="form-select"><option value="">Todos</option><option>PENDENTE</option><option>EM_REVISAO</option><option>ACEITO</option><option>REJEITADO</option><option>CORRIGIDO</option><option>REVERTIDO</option></select></label>
                        <label><span>Nível</span><select id="revisao-filtro-nivel" class="form-select"><option value="">Todos</option><option value="impeditivo">impeditivo</option><option value="aviso">aviso</option><option value="info">info</option></select></label>
                        <label><span>Tipo</span><select id="revisao-filtro-tipo" class="form-select"><option value="">Todos</option>${tipos.map((tipo) => `<option value="${escapeHtml(tipo)}">${escapeHtml(tipo)}</option>`).join('')}</select></label>
                        <label><span>Convênio</span><input id="revisao-filtro-convenio" class="form-control" placeholder="937782"></label>
                        <label><span>UF</span><input id="revisao-filtro-uf" class="form-control" maxlength="2" placeholder="AC"></label>
                        <label><span>Bloqueia publicação</span><select id="revisao-filtro-bloqueia" class="form-select"><option value="">Todos</option><option value="true">Sim</option><option value="false">Não</option></select></label>
                        <label><span>Saldo residual</span><select id="revisao-filtro-saldo-residual" class="form-select"><option value="">Todos</option><option value="true">Apenas saldos residuais</option><option value="false">Ocultar saldos residuais</option></select></label>
                        <label><span>Categoria operacional</span><select id="revisao-filtro-categoria-operacional" class="form-select"><option value="">Fila operacional</option><option value="pendencia_operacional_real">Pendência operacional real</option><option value="falso_positivo_saneavel">Falso positivo/saneado</option><option value="bloqueio_tecnico_seguranca">Bloqueio técnico</option><option value="historico_saneado">Histórico/saneado</option><option value="revalidacao_necessaria">Revalidação necessária</option></select></label>
                        <label class="revisao-checkbox"><input type="checkbox" id="revisao-filtro-sem-decisao" checked><span>Sem decisão resolutiva</span></label>

                        <label class="revisao-checkbox"><input type="checkbox" id="revisao-filtro-com-decisao"><span>Com decisão resolutiva</span></label>
                        <label class="revisao-checkbox" title="Inclui divergências históricas não reapresentadas e itens já saneados automaticamente por diacrítico."><input type="checkbox" id="revisao-filtro-mostrar-saneados"><span>Mostrar históricos/saneados automaticamente</span></label>
                        <div class="revisao-filter-actions">
                            <button type="submit" class="btn btn-primary btn-sm">Aplicar</button>
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="btn-revisao-limpar-filtros">Limpar</button>
                        </div>
                    </form>
                </section>
            `;
        }

        async function renderRevisaoDivergenciasView() {
            const container = document.getElementById('view-revisao-divergencias');
            if (!container) return;
            container.style.display = 'block';

            if (estaEmModoPublicacaoEstatica()) {
                container.innerHTML = renderEmptyState({
                    titulo: 'Revisão disponível apenas no servidor local.',
                    descricao: 'A tela consulta APIs e banco SQLite local. Ela não é exibida na publicação estática.',
                    icon: 'fa-lock'
                });
                return;
            }

            container.innerHTML = `
                <section class="view-heading">
                    ${renderActionButton({
                        type: 'back',
                        label: 'Voltar ao Status do Sistema',
                        onClick: "toggleView('status-sistema')",
                        variant: 'outline-secondary',
                        extraClass: 'pdf-hidden'
                    })}
                    <div>
                        <p class="section-eyebrow mb-1">SISTEMA</p>
                        <h2>Revisão de divergências PAD x memória</h2>
                        <p class="text-muted mb-0">Consulta, saneamento e decisão humana auditável. Nenhuma decisão é aplicada ao planoAplicacao nesta etapa.</p>
                    </div>
                </section>
                <section class="revisao-contador" id="revisao-contador-pendencias" aria-live="polite">
                    <div class="revisao-contador-numero" id="revisao-contador-numero">—</div>
                    <div class="revisao-contador-texto">
                        <strong id="revisao-contador-titulo">pendências operacionais</strong>
                        <span id="revisao-contador-detalhe" class="text-muted small">Carregando fila de revisão…</span>
                    </div>
                </section>
                <section class="revisao-warning-stack mb-4">
                    <div>ACEITO registra decisão humana, mas ainda não aplica a alteração ao planoAplicacao.</div>
                    <div>A reconstrução e a publicação continuam bloqueadas enquanto houver divergências pendentes ou em revisão que bloqueiem publicação.</div>
                    <div>Esta tela é de revisão e saneamento; não publica dados.</div>
                </section>
                <section class="revisao-panel mb-4">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Auditoria operacional</p>
                            <h2>Resumo da fila</h2>
                        </div>
                    </div>
                    <div id="revisao-auditoria-resumo" class="text-muted">Carregando auditoria…</div>
                </section>
                <div id="revisao-filtros-container"></div>
                <section class="revisao-panel mb-4">
                    <div class="table-responsive">
                        <table class="table table-sm app-data-table revisao-table" id="tabela-revisao-divergencias">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Nível</th>
                                    <th>Convênio</th>
                                    <th>UF</th>
                                    <th>Tipo</th>
                                    <th>Campo</th>
                                    <th>Motivo provável</th>
                                    <th>Bloqueia</th>
                                    <th class="text-end">Ação</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </section>
                <section id="revisao-divergencia-detalhe" class="mb-5"></section>
            `;

            await carregarAuditoriaRevisao();
            document.getElementById('revisao-filtros-container').innerHTML = renderFiltrosRevisao();
            registrarEventosRevisaoDivergenciasLegadoInativo();
            await carregarListaRevisao();
            aplicarModoSomenteLeituraControlada();
        }

        function registrarEventosRevisaoDivergenciasLegadoInativo() {
            const form = document.getElementById('form-revisao-filtros');
            const semDecisao = document.getElementById('revisao-filtro-sem-decisao');
            const comDecisao = document.getElementById('revisao-filtro-com-decisao');
            const statusSelect = document.getElementById('revisao-filtro-status');
            semDecisao?.addEventListener('change', () => {
                if (semDecisao.checked && comDecisao) comDecisao.checked = false;
            });
            comDecisao?.addEventListener('change', () => {
                if (comDecisao.checked && semDecisao) semDecisao.checked = false;
            });
            statusSelect?.addEventListener('change', () => {
                const valor = statusSelect.value;
                if (['ACEITO', 'CORRIGIDO', 'REJEITADO', 'REVERTIDO'].includes(valor)) {
                    if (comDecisao) comDecisao.checked = true;
                    if (semDecisao) semDecisao.checked = false;
                } else if (['PENDENTE', 'EM_REVISAO'].includes(valor)) {
                    if (semDecisao) semDecisao.checked = true;
                    if (comDecisao) comDecisao.checked = false;
                }
            });
            // "Mostrar históricos/saneados" é filtro client-side: recarrega a lista.
            document.getElementById('revisao-filtro-mostrar-saneados')?.addEventListener('change', async () => {
                await carregarListaRevisao();
            });
            form?.addEventListener('submit', async (event) => {
                event.preventDefault();
                await carregarListaRevisao();
            });
            document.getElementById('btn-revisao-limpar-filtros')?.addEventListener('click', async () => {
                form?.reset();
                await carregarListaRevisao();
            });
            document.getElementById('tabela-revisao-divergencias')?.addEventListener('click', async (event) => {
                const botao = event.target.closest('[data-revisao-abrir]');
                if (!botao) return;
                try {
                    await abrirDetalheRevisao(botao.dataset.revisaoAbrir);
                } catch (error) {
                    const detalhe = document.getElementById('revisao-divergencia-detalhe');
                    if (detalhe) detalhe.innerHTML = `<div class="revisao-detail-panel text-danger">${escapeHtml(error.message || 'Falha ao carregar detalhe.')}</div>`;
                }
            });

        }

        const AREAS_REVISAO_PAD = [
            ['OUVIDORIA', 'Ouvidoria'],
            ['CORREGEDORIA', 'Corregedoria'],
            ['ESCOLA_PENAL', 'Escola Penal'],
            ['N/A', 'N/A'],
            ['NAO_CLASSIFICADO', 'Não classificado']
        ];

        function rotuloAreaRevisaoPad(area) {
            return AREAS_REVISAO_PAD.find(([valor]) => valor === area)?.[1] || area || '-';
        }

        function rotuloTipoRevisaoPad(tipo) {
            return ({
                ITEM_PAD: 'Item PAD',
                ITEM_RATEADO: 'Rateio',
                SALDO_RESIDUAL: 'Saldo residual',
                REMANESCENTE: 'Remanescente',
                ITEM_SUPRIMIDO: 'Item suprimido',
                ITEM_NOVO: 'Item novo'
            })[tipo] || tipo || '-';
        }

        function rotuloSituacaoRevisaoPad(situacao) {
            switch (String(situacao || '').toUpperCase()) {
                case 'RATEIO_MEMORIZADO_APLICADO': return 'Rateio aplicado';
                case 'AREA_ALTERADA': return 'Área classificada';
                case 'AREA_NAO_CLASSIFICADA': return 'Área não classificada';
                case 'ITEM_NOVO_SEM_RATEIO': return 'Item novo';
                case 'ITEM_SUPRIMIDO_HISTORICO': return 'Item suprimido';
                case 'SALDO_RESIDUAL_NAO_SETORIALIZADO': return 'Saldo residual';
                case 'PENDENTE_REVISAO': return 'Aguardando revisão';
                case 'RATEIO_ATUALIZADO': return 'Rateio atualizado';
                case 'OK': return 'Confirmado';
                default: return situacao || '-';
            }
        }

        function classeSituacaoRevisaoPad(situacao) {
            const texto = String(situacao || '').toUpperCase();
            if (texto.includes('NOVO') || texto.includes('PENDENTE') || texto.includes('NAO_CLASSIFICADA')) return 'warning';
            if (texto.includes('INCONSISTENTE')) return 'danger';
            if (texto.includes('SUPRIMIDO')) return 'secondary';
            if (texto.includes('MEMORIZADO') || texto === 'OK') return 'success';
            return 'info';
        }

        function classeAreaRevisaoPad(area) {
            switch (String(area || '').toUpperCase()) {
                case 'OUVIDORIA': return 'area-ouvidoria';
                case 'CORREGEDORIA': return 'area-corregedoria';
                case 'ESCOLA_PENAL': return 'area-escola-penal';
                case 'N/A': return 'area-na';
                case 'NAO_CLASSIFICADO': return 'area-nao-classificado';
                default: return '';
            }
        }

        function obterFilhasRevisaoPad(parentId) {
            const dados = revisoesPlanoPadEstado.dados;
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            return (dados?.linhasFilhas?.[uf] || []).filter((linha) => linha.parentId === parentId);
        }

        function ehPendenteRevisaoPad(linha) {
            const status = String(linha?.status || '').toUpperCase();
            return linha?.tipo === 'ITEM_NOVO'
                || status.includes('PENDENTE')
                || status.includes('NAO_CLASSIFICAD')
                || status.includes('INCONSISTENTE')
                || linha?.area === 'NAO_CLASSIFICADO';
        }

        function linhaMaeDeveIniciarExpandidaRevisaoPad(linha) {
            const filhas = obterFilhasRevisaoPad(linha.id);
            return ehPendenteRevisaoPad(linha)
                || filhas.some((filha) => filha.status === 'AREA_NAO_CLASSIFICADA' || filha.area === 'NAO_CLASSIFICADO');
        }

        function linhaMaePassaFiltrosRevisaoPad(linha) {
            const filtros = revisoesPlanoPadEstado.filtros;
            const filhas = obterFilhasRevisaoPad(linha.id);
            if (!filtros.mostrarSuprimidos && linha.tipo === 'ITEM_SUPRIMIDO') return false;
            if (filtros.somentePendencias && !ehPendenteRevisaoPad(linha) && !filhas.some(ehPendenteRevisaoPad)) return false;
            if (filtros.tipo && linha.tipo !== filtros.tipo) return false;
            if (filtros.situacao && linha.status !== filtros.situacao && !filhas.some((filha) => filha.status === filtros.situacao)) return false;
            if (filtros.natureza && linha.natureza !== filtros.natureza) return false;
            if (filtros.area && !filhas.some((filha) => filha.area === filtros.area)) return false;
            if (filtros.texto) {
                const partes = [
                    linha.descricao,
                    linha.numeroConvenio,
                    linha.codigoNatureza,
                    linha.natureza,
                    linha.status,
                    ...filhas.flatMap((filha) => [filha.descricao, filha.area, filha.codigoNatureza, filha.status])
                ].filter(Boolean).join(' ');
                if (!normalizarTexto(partes).includes(normalizarTexto(filtros.texto))) return false;
            }
            return true;
        }

        function inicializarExpandidosRevisaoPad(uf) {
            const linhas = revisoesPlanoPadEstado.dados?.linhasMae?.[uf] || [];
            revisoesPlanoPadEstado.expandidos = new Set(
                linhas.filter(linhaMaeDeveIniciarExpandidaRevisaoPad).map((linha) => linha.id)
            );
        }

        function renderChipsUfRevisaoPad() {
            const ufs = revisoesPlanoPadEstado.dados?.ufs || [];
            if (!ufs.length) return '<div class="text-muted small">Nenhuma UF disponível. Execute a recarga operacional dos PADs no Status do Sistema.</div>';
            return ufs.map((uf) => `
                <button type="button" class="revisao-pad-uf-chip ${uf === revisoesPlanoPadEstado.ufSelecionada ? 'is-active' : ''}" data-revisao-pad-uf="${escapeHtml(uf)}">
                    ${escapeHtml(uf)}
                </button>
            `).join('');
        }

        function renderResumoUfRevisaoPad() {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            const resumo = revisoesPlanoPadEstado.dados?.resumoPorUf?.[uf];
            if (!resumo) return '<div class="revisao-detail-panel text-muted">Selecione uma UF para visualizar o plano detalhado.</div>';
            const totalArea = resumo.totalPorArea || {};
            const totalPrevisto = Number(resumo.totalPrevisto || 0);
            const totalExecutado = Number(resumo.totalExecutado || 0);
            const percentual = Number(resumo.percentualExecucao || 0);
            const classePerc = percentual >= 90 ? 'is-alto' : percentual >= 50 ? 'is-medio' : percentual > 0 ? 'is-baixo' : 'is-zero';
            return `
                <section class="revisao-pad-execucao-cards">
                    <div class="revisao-pad-execucao-card">
                        <span>Valor previsto</span>
                        <strong>${escapeHtml(formatarValorRevisao(totalPrevisto, 'Valor previsto'))}</strong>
                    </div>
                    <div class="revisao-pad-execucao-card">
                        <span>Valor executado</span>
                        <strong>${escapeHtml(formatarValorRevisao(totalExecutado, 'Valor executado'))}</strong>
                    </div>
                    <div class="revisao-pad-execucao-card revisao-pad-execucao-percentual ${classePerc}">
                        <span>% Execução</span>
                        <strong>${escapeHtml(percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}%</strong>
                        <div class="revisao-pad-execucao-barra"><div class="revisao-pad-execucao-barra-fill" style="width:${Math.min(100, Math.max(0, percentual)).toFixed(2)}%"></div></div>
                    </div>
                </section>
                <section class="revisao-pad-summary">
                    <div><span>UF / Convênio</span><strong>${escapeHtml(uf)}${resumo.numeroConvenio ? ` — Convênio ${escapeHtml(resumo.numeroConvenio)}/2022` : ''}</strong></div>
                    <div><span>Itens PAD</span><strong>${escapeHtml(String(resumo.totalItensPad || 0))}</strong></div>
                    <div><span>Linhas rateadas</span><strong>${escapeHtml(String(resumo.totalLinhasRateadas || 0))}</strong></div>
                    <div><span>Pendências</span><strong>${escapeHtml(String(resumo.pendenciasReais || 0))}</strong></div>
                    <div><span>Itens novos</span><strong>${escapeHtml(String(resumo.itensNovos || 0))}</strong></div>
                    <div><span>Itens suprimidos</span><strong>${escapeHtml(String(resumo.itensSuprimidos || 0))}</strong></div>
                    <div><span>Ouvidoria</span><strong>${escapeHtml(formatarValorRevisao(totalArea.OUVIDORIA || 0, 'Valor total'))}</strong></div>
                    <div><span>Corregedoria</span><strong>${escapeHtml(formatarValorRevisao(totalArea.CORREGEDORIA || 0, 'Valor total'))}</strong></div>
                    <div><span>Escola Penal</span><strong>${escapeHtml(formatarValorRevisao(totalArea.ESCOLA_PENAL || 0, 'Valor total'))}</strong></div>
                    <div><span>N/A</span><strong>${escapeHtml(formatarValorRevisao(totalArea['N/A'] || 0, 'Valor total'))}</strong></div>
                </section>
            `;
        }

        function renderFiltrosRevisaoPad() {
            const filtros = revisoesPlanoPadEstado.filtros;
            return `
                <form id="form-revisoes-pad-filtros" class="revisao-filter-grid revisao-pad-filter-grid">
                    <label><span>Área</span><select id="revisao-pad-filtro-area" class="form-select"><option value="">Todas</option>${AREAS_REVISAO_PAD.map(([valor, rotulo]) => `<option value="${escapeHtml(valor)}" ${filtros.area === valor ? 'selected' : ''}>${escapeHtml(rotulo)}</option>`).join('')}</select></label>
                    <label><span>Natureza</span><select id="revisao-pad-filtro-natureza" class="form-select"><option value="">Todas</option><option ${filtros.natureza === 'CUSTEIO' ? 'selected' : ''}>CUSTEIO</option><option ${filtros.natureza === 'CAPITAL' ? 'selected' : ''}>CAPITAL</option><option ${filtros.natureza === 'NAO_INFORMADO' ? 'selected' : ''}>NAO_INFORMADO</option></select></label>
                    <label><span>Situação</span><select id="revisao-pad-filtro-situacao" class="form-select"><option value="">Todas</option><option>OK</option><option>RATEIO_MEMORIZADO_APLICADO</option><option>ITEM_NOVO_SEM_RATEIO</option><option>ITEM_SUPRIMIDO_HISTORICO</option><option>AREA_NAO_CLASSIFICADA</option><option>SALDO_RESIDUAL_NAO_SETORIALIZADO</option><option>PENDENTE_REVISAO</option></select></label>
                    <label><span>Tipo</span><select id="revisao-pad-filtro-tipo" class="form-select"><option value="">Todos</option><option>ITEM_PAD</option><option>ITEM_NOVO</option><option>ITEM_SUPRIMIDO</option><option>SALDO_RESIDUAL</option></select></label>
                    <label><span>Descrição</span><input id="revisao-pad-filtro-texto" class="form-control" value="${escapeHtml(filtros.texto)}" placeholder="Buscar item, convênio ou código"></label>
                    <label class="revisao-checkbox"><input type="checkbox" id="revisao-pad-filtro-pendencias" ${filtros.somentePendencias ? 'checked' : ''}><span>Somente pendências</span></label>
                    <label class="revisao-checkbox"><input type="checkbox" id="revisao-pad-filtro-suprimidos" ${filtros.mostrarSuprimidos ? 'checked' : ''}><span>Mostrar históricos/suprimidos</span></label>
                    <div class="revisao-filter-actions"><button type="button" class="btn btn-outline-secondary btn-sm" id="btn-revisao-pad-limpar-filtros">Limpar</button></div>
                </form>
            `;
        }

        function renderSelectAreaLinhaFilhaRevisaoPad(filha) {
            const ehNaoClassificado = String(filha.area || '').toUpperCase() === 'NAO_CLASSIFICADO';
            const classeDestaque = ehNaoClassificado ? ' is-nao-classificado' : '';
            return `
                <select class="form-select form-select-sm revisao-pad-area-select${classeDestaque}" data-revisao-pad-area="${escapeHtml(filha.id)}" data-parent-id="${escapeHtml(filha.parentId)}" data-area-original="${escapeHtml(filha.area || '')}">
                    ${AREAS_REVISAO_PAD.map(([valor, rotulo]) => `<option value="${escapeHtml(valor)}" ${filha.area === valor ? 'selected' : ''}>${escapeHtml(rotulo)}</option>`).join('')}
                </select>
            `;
        }

        function renderLinhaMaeRevisaoPad(linha) {
            const filhas = obterFilhasRevisaoPad(linha.id);
            const filhaUnica = filhas.length === 1 ? filhas[0] : null;
            const mesclada = !!filhaUnica && linha.tipo !== 'ITEM_SUPRIMIDO';
            const expandido = revisoesPlanoPadEstado.expandidos.has(linha.id);
            const podeExpandir = filhas.length > 1;
            const classeBase = linha.tipo === 'ITEM_SUPRIMIDO'
                ? 'is-suppressed'
                : (mesclada ? ehPendenteRevisaoPad(filhaUnica) : ehPendenteRevisaoPad(linha)) ? 'is-pending' : '';
            const classeMesclada = mesclada ? 'revisao-pad-row-mesclada' : '';
            const classeArea = mesclada ? classeAreaRevisaoPad(filhaUnica.area) : (podeExpandir ? 'area-rateado' : '');

            const colTipo = `<td>${podeExpandir ? `<i class="fas ${expandido ? 'fa-chevron-down' : 'fa-chevron-right'} me-1"></i>` : ''}${escapeHtml(rotuloTipoRevisaoPad(linha.tipo))}</td>`;
            const colArea = mesclada
                ? `<td>${renderSelectAreaLinhaFilhaRevisaoPad(filhaUnica)}</td>`
                : (podeExpandir
                    ? '<td><span class="badge text-bg-info revisao-badge">RATEADO</span></td>'
                    : '<td class="text-muted">—</td>');
            const observacaoRedundante = linha.tipo === 'ITEM_NOVO' || linha.tipo === 'ITEM_SUPRIMIDO';
            const colDesc = `<td><strong>${escapeHtml(linha.descricao || '-')}</strong>${linha.observacao && !observacaoRedundante ? `<div class="small text-muted">${escapeHtml(linha.observacao)}</div>` : ''}</td>`;
            const colNat = `<td>${escapeHtml(linha.natureza || '-')}</td>`;
            const colCod = `<td>${escapeHtml(linha.codigoNatureza || 'N/A')}</td>`;
            const colQtd = `<td>${escapeHtml(formatarValorRevisao(linha.quantidadeOriginal, 'Quantidade'))}</td>`;
            const colVu = `<td>${escapeHtml(formatarValorRevisao(linha.valorUnitario, 'Valor unitário'))}</td>`;
            const colVt = `<td>${escapeHtml(formatarValorRevisao(linha.valorTotalOriginal, 'Valor total'))}</td>`;
            const colVe = `<td>${escapeHtml(formatarValorRevisao(linha.valorExecutadoTotal || 0, 'Valor executado'))}</td>`;
            const statusExibido = mesclada ? (filhaUnica.status || linha.status) : linha.status;
            const colStatus = `<td><span class="badge text-bg-${classeSituacaoRevisaoPad(statusExibido)} revisao-badge" title="${escapeHtml(statusExibido || '')}">${escapeHtml(rotuloSituacaoRevisaoPad(statusExibido))}</span></td>`;
            const colAcao = `<td><button type="button" class="btn btn-sm btn-outline-primary" data-revisao-pad-rateio="${escapeHtml(linha.id)}">Ratear quantidade</button></td>`;

            return `
                <tr class="revisao-pad-row-mae ${classeBase} ${classeMesclada} ${classeArea}" data-revisao-pad-mae="${escapeHtml(linha.id)}" data-pode-expandir="${podeExpandir ? '1' : '0'}" aria-expanded="${expandido ? 'true' : 'false'}">
                    ${colTipo}${colArea}${colDesc}${colNat}${colCod}${colQtd}${colVu}${colVt}${colVe}${colStatus}${colAcao}
                </tr>
            `;
        }

        function renderLinhaFilhaRevisaoPad(filha) {
            return `
                <tr class="revisao-pad-row-filha ${classeAreaRevisaoPad(filha.area)}" data-revisao-pad-filha="${escapeHtml(filha.id)}" data-parent-id="${escapeHtml(filha.parentId)}">
                    <td>${escapeHtml(rotuloTipoRevisaoPad(filha.tipo))}</td>
                    <td>${renderSelectAreaLinhaFilhaRevisaoPad(filha)}</td>
                    <td>${escapeHtml(filha.descricao || '-')}</td>
                    <td>${escapeHtml(filha.natureza || '-')}</td>
                    <td>${escapeHtml(filha.codigoNatureza || 'N/A')}</td>
                    <td><button type="button" class="btn btn-sm btn-link p-0" data-revisao-pad-rateio="${escapeHtml(filha.parentId)}">${escapeHtml(formatarValorRevisao(filha.quantidade, 'Quantidade'))}</button></td>
                    <td>${escapeHtml(formatarValorRevisao(filha.valorUnitario, 'Valor unitário'))}</td>
                    <td>${escapeHtml(formatarValorRevisao(filha.valorTotal, 'Valor total'))}</td>
                    <td>${escapeHtml(formatarValorRevisao(filha.valorExecutado || 0, 'Valor executado'))}</td>
                    <td><span class="badge text-bg-${classeSituacaoRevisaoPad(filha.status)} revisao-badge" title="${escapeHtml(filha.status || '')}">${escapeHtml(rotuloSituacaoRevisaoPad(filha.status))}</span></td>
                    <td><span class="text-muted small">Salva ao alterar</span></td>
                </tr>
            `;
        }

        function renderCorpoLinhasRevisaoPadParaUf(uf, linhas) {
            const ufAnterior = revisoesPlanoPadEstado.ufSelecionada;
            revisoesPlanoPadEstado.ufSelecionada = uf;
            try {
                return linhas.flatMap((linha) => {
                    const partes = [renderLinhaMaeRevisaoPad(linha)];
                    const filhas = obterFilhasRevisaoPad(linha.id);
                    const mesclada = filhas.length === 1 && linha.tipo !== 'ITEM_SUPRIMIDO';
                    if (!mesclada && revisoesPlanoPadEstado.expandidos.has(linha.id)) {
                        partes.push(...filhas.map(renderLinhaFilhaRevisaoPad));
                    }
                    return partes;
                }).join('');
            } finally {
                revisoesPlanoPadEstado.ufSelecionada = ufAnterior;
            }
        }

        function renderTabelaRevisoesPadHtml(corpo) {
            return `
                <section class="revisao-panel mb-4">
                    <div class="table-responsive">
                        <table class="table table-sm app-data-table revisao-table revisao-pad-plano-table" id="tabela-revisoes-pad-plano">
                            <thead>
                                <tr>
                                    <th>Tipo</th><th>Área</th><th>Descrição</th><th>Natureza</th><th>Código Natureza</th>
                                    <th>Quantidade</th><th>Valor Unitário</th><th>Valor Previsto</th><th>Valor Executado</th><th>Situação</th><th>Ações/Observações</th>
                                </tr>
                            </thead>
                            <tbody>${corpo || '<tr><td colspan="11" class="text-center text-muted py-3">Nenhum item encontrado para os filtros atuais.</td></tr>'}</tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        function renderTabelaRevisoesPad() {
            const texto = String(revisoesPlanoPadEstado.filtros?.texto || '').trim();
            // Busca textual age sobre todos os convenios/UFs.
            if (texto) {
                const ufs = revisoesPlanoPadEstado.dados?.ufs || [];
                const blocos = ufs.map((uf) => {
                    const ufAnterior = revisoesPlanoPadEstado.ufSelecionada;
                    revisoesPlanoPadEstado.ufSelecionada = uf;
                    try {
                        const linhas = (revisoesPlanoPadEstado.dados?.linhasMae?.[uf] || []).filter(linhaMaePassaFiltrosRevisaoPad);
                        if (!linhas.length) return '';
                        const corpo = renderCorpoLinhasRevisaoPadParaUf(uf, linhas);
                        return `
                            <div class="revisao-pad-bloco-uf">
                                <h5 class="revisao-pad-bloco-uf-titulo">${escapeHtml(uf)} <span class="badge text-bg-secondary">${linhas.length}</span></h5>
                                ${renderTabelaRevisoesPadHtml(corpo)}
                            </div>
                        `;
                    } finally {
                        revisoesPlanoPadEstado.ufSelecionada = ufAnterior;
                    }
                }).filter(Boolean);
                if (!blocos.length) return renderTabelaRevisoesPadHtml('');
                return blocos.join('');
            }

            const uf = revisoesPlanoPadEstado.ufSelecionada;
            if (!uf) return '<div class="revisao-detail-panel text-muted">Selecione uma UF.</div>';
            const linhas = (revisoesPlanoPadEstado.dados?.linhasMae?.[uf] || []).filter(linhaMaePassaFiltrosRevisaoPad);
            const corpo = renderCorpoLinhasRevisaoPadParaUf(uf, linhas);
            return renderTabelaRevisoesPadHtml(corpo);
        }

        function atualizarRevisoesPlanoPadUI() {
            document.getElementById('revisoes-pad-ufs').innerHTML = renderChipsUfRevisaoPad();
            document.getElementById('revisoes-pad-resumo').innerHTML = renderResumoUfRevisaoPad();
            document.getElementById('revisoes-pad-filtros').innerHTML = renderFiltrosRevisaoPad();
            document.getElementById('revisoes-pad-tabela').innerHTML = renderTabelaRevisoesPad();
            renderEditorRateioRevisaoPad();
        }

        function selecionarUfRevisaoPad(uf) {
            revisoesPlanoPadEstado.ufSelecionada = uf;
            revisoesPlanoPadEstado.editorParentId = null;
            inicializarExpandidosRevisaoPad(uf);
            atualizarRevisoesPlanoPadUI();
        }

        function obterMaeRevisaoPad(parentId) {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            return (revisoesPlanoPadEstado.dados?.linhasMae?.[uf] || []).find((linha) => linha.id === parentId) || null;
        }

        function obterFilhaRevisaoPad(linhaFilhaId) {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            return (revisoesPlanoPadEstado.dados?.linhasFilhas?.[uf] || []).find((linha) => linha.id === linhaFilhaId) || null;
        }

        function atualizarMaeRevisaoPad(parentId, atualizacoes = {}) {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            const linhas = revisoesPlanoPadEstado.dados?.linhasMae?.[uf] || [];
            const indice = linhas.findIndex((linha) => linha.id === parentId);
            if (indice >= 0) linhas[indice] = { ...linhas[indice], ...atualizacoes };
        }

        function substituirFilhaRevisaoPad(linhaFilha) {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            const linhas = revisoesPlanoPadEstado.dados?.linhasFilhas?.[uf] || [];
            const indice = linhas.findIndex((linha) => linha.id === linhaFilha.id);
            if (indice >= 0) linhas[indice] = { ...linhas[indice], ...linhaFilha };
        }

        function substituirFilhasGrupoRevisaoPad(parentId, linhasFilhas) {
            const uf = revisoesPlanoPadEstado.ufSelecionada;
            const linhasAtuais = revisoesPlanoPadEstado.dados?.linhasFilhas?.[uf] || [];
            revisoesPlanoPadEstado.dados.linhasFilhas[uf] = [
                ...linhasAtuais.filter((linha) => linha.parentId !== parentId),
                ...linhasFilhas
            ];
            atualizarMaeRevisaoPad(parentId, { filhos: linhasFilhas.map((linha) => linha.id) });
        }

        function mostrarFeedbackRevisaoPad(tipo, mensagem) {
            const feedback = document.getElementById('revisoes-pad-feedback');
            if (!feedback) return;
            const classe = tipo === 'erro' ? 'danger' : tipo === 'aviso' ? 'warning' : 'success';
            feedback.innerHTML = `<div class="alert alert-${classe} small mb-0">${escapeHtml(mensagem)}</div>`;
        }

        function renderLinhaEditorRateioRevisaoPad(linha = {}) {
            return `
                <div class="revisao-rateio-row" data-revisao-pad-editor-row>
                    <label><span>Área</span><select class="form-select form-select-sm" data-revisao-pad-editor-area>${AREAS_REVISAO_PAD.map(([valor, rotulo]) => `<option value="${escapeHtml(valor)}" ${(linha.area || 'NAO_CLASSIFICADO') === valor ? 'selected' : ''}>${escapeHtml(rotulo)}</option>`).join('')}</select></label>
                    <label><span>Quantidade</span><input class="form-control form-control-sm" type="number" min="0" step="0.000001" value="${escapeHtml(linha.quantidade ?? 0)}" data-revisao-pad-editor-quantidade></label>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-revisao-pad-editor-remover>Remover</button>
                </div>
            `;
        }

        function renderEditorRateioRevisaoPad() {
            const container = document.getElementById('revisoes-pad-editor');
            if (!container) return;
            const mae = obterMaeRevisaoPad(revisoesPlanoPadEstado.editorParentId);
            if (!mae) {
                container.innerHTML = '<div class="revisao-detail-panel text-muted">Clique em uma quantidade para abrir o editor de rateio.</div>';
                return;
            }
            const filhas = obterFilhasRevisaoPad(mae.id);
            const linhasEditor = filhas.length >= 2 ? filhas : [filhas[0] || { area: 'NAO_CLASSIFICADO', quantidade: mae.quantidadeOriginal }, { area: 'NAO_CLASSIFICADO', quantidade: 0 }];
            container.innerHTML = `
                <section class="revisao-detail-panel revisao-pad-rateio-editor" data-mae-id="${escapeHtml(mae.id)}">
                    <div class="revisao-detail-header"><div><p class="section-eyebrow mb-1">Editor de rateio</p><h2>${escapeHtml(mae.descricao || '-')}</h2><p class="text-muted small mb-0">Quantidade original: ${escapeHtml(formatarValorRevisao(mae.quantidadeOriginal, 'Quantidade'))}. A soma das linhas deve fechar exatamente a quantidade da linha-mãe.</p></div></div>
                    <div id="revisao-pad-editor-lista" class="revisao-rateio-list mt-3">${linhasEditor.map(renderLinhaEditorRateioRevisaoPad).join('')}</div>
                    <div class="d-flex flex-wrap gap-2 mt-3">
                        <button type="button" class="btn btn-sm btn-outline-primary" data-revisao-pad-editor-adicionar>Adicionar linha</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-revisao-pad-editor-fechar>Fechar</button>
                        <button type="button" class="btn btn-sm btn-primary" data-revisao-pad-editor-salvar disabled>Salvar rateio</button>
                    </div>
                    <div id="revisao-pad-editor-validacao" class="small mt-2" aria-live="polite"></div>
                </section>
            `;
            validarEditorRateioRevisaoPad();
        }

        function validarEditorRateioRevisaoPad() {
            const mae = obterMaeRevisaoPad(revisoesPlanoPadEstado.editorParentId);
            const aviso = document.getElementById('revisao-pad-editor-validacao');
            const botaoSalvar = document.querySelector('[data-revisao-pad-editor-salvar]');
            if (!mae || !aviso) return { valido: false, linhas: [], erros: ['Editor indisponível.'] };
            const linhas = Array.from(document.querySelectorAll('[data-revisao-pad-editor-row]'));
            let soma = 0;
            const erros = [];
            const linhasPayload = [];
            for (const linha of linhas) {
                const area = linha.querySelector('[data-revisao-pad-editor-area]')?.value || '';
                const quantidade = Number(linha.querySelector('[data-revisao-pad-editor-quantidade]')?.value || 0);
                if (!AREAS_REVISAO_PAD.some(([valor]) => valor === area)) erros.push('Área inválida.');
                if (!Number.isFinite(quantidade) || quantidade < 0) erros.push('Quantidade negativa ou inválida.');
                soma += Number.isFinite(quantidade) ? quantidade : 0;
                linhasPayload.push({ area, quantidade });
            }
            if (linhas.length < 2) erros.push('O rateio deve ter duas ou mais linhas.');
            if (Math.abs(soma - Number(mae.quantidadeOriginal || 0)) > 0.000001) {
                erros.push(`Soma ${formatarValorRevisao(soma, 'Quantidade')} diferente da quantidade original ${formatarValorRevisao(mae.quantidadeOriginal, 'Quantidade')}.`);
            }
            if (botaoSalvar) botaoSalvar.disabled = erros.length > 0;
            aviso.className = `small mt-2 ${erros.length ? 'text-warning' : 'text-success'}`;
            aviso.innerHTML = erros.length
                ? `<strong>Validação:</strong><ul class="mb-0">${erros.map((erro) => `<li>${escapeHtml(erro)}</li>`).join('')}</ul>`
                : 'Validação local OK. O rateio pode ser salvo.';
            return { valido: erros.length === 0, linhas: linhasPayload, erros };
        }

        async function renderRevisoesPadPlanoView() {
            const container = document.getElementById('view-revisao-divergencias');
            if (!container) return;
            container.style.display = 'block';

            if (estaEmModoPublicacaoEstatica()) {
                container.innerHTML = renderEmptyState({
                    titulo: 'Revisão disponível apenas no servidor local.',
                    descricao: 'A tela consulta APIs locais e não é exibida na publicação estática.',
                    icon: 'fa-lock'
                });
                return;
            }

            container.innerHTML = `
                <section class="view-heading">
                    ${renderActionButton({ type: 'back', label: 'Voltar ao Status do Sistema', onClick: "toggleView('status-sistema')", variant: 'outline-secondary', extraClass: 'pdf-hidden' })}
                    <div><p class="section-eyebrow mb-1">SISTEMA</p><h2>Revisões PAD — Plano de Aplicação Detalhado</h2><p class="text-muted mb-0">Grade hierárquica do plano reconstruído pela recarga operacional dos PADs. Esta tela não publica dados.</p></div>
                </section>
                <section class="revisao-panel mb-4"><div class="section-header compact"><div><p class="section-eyebrow mb-1">Seleção por UF</p><h2>Plano de aplicação reconstruído</h2></div></div><div class="revisao-pad-uf-list" id="revisoes-pad-ufs"></div></section>
                <div id="revisoes-pad-resumo"></div>
                <section class="revisao-panel mb-4" id="revisoes-pad-filtros"></section>
                <div id="revisoes-pad-feedback" class="mb-3"></div>
                <div id="revisoes-pad-tabela"></div>
                <div id="revisoes-pad-editor" class="mb-5"></div>
            `;

            try {
                const { resposta, payload: responseBody } = await fetchJsonApiOnasp('/api/profor-2022/pad/revisoes-plano');
                if (!resposta.ok || !responseBody?.success) {
                    throw new Error(responseBody?.message || 'Não foi possível carregar revisões PAD.');
                }
                revisoesPlanoPadEstado.dados = responseBody.payload;
                const ufInicial = revisoesPlanoPadEstado.ufSelecionada
                    && responseBody.payload?.ufs?.includes(revisoesPlanoPadEstado.ufSelecionada)
                    ? revisoesPlanoPadEstado.ufSelecionada
                    : responseBody.payload?.ufs?.[0] || '';
                revisoesPlanoPadEstado.ufSelecionada = ufInicial;
                inicializarExpandidosRevisaoPad(ufInicial);
                atualizarRevisoesPlanoPadUI();
                registrarEventosRevisaoDivergencias();
            } catch (error) {
                container.insertAdjacentHTML('beforeend', `<div class="revisao-detail-panel text-danger">${escapeHtml(error.message || 'Falha ao carregar tela de revisões PAD.')}</div>`);
            }
            aplicarModoSomenteLeituraControlada();
        }

        async function salvarAreaLinhaFilhaRevisaoPad(select) {
            const linhaFilhaId = select.dataset.revisaoPadArea;
            const parentId = select.dataset.parentId;
            const areaNova = select.value;
            if (!linhaFilhaId || !parentId) return;

            const mae = obterMaeRevisaoPad(parentId);
            const filha = obterFilhaRevisaoPad(linhaFilhaId);
            if (!mae || !filha) {
                mostrarFeedbackRevisaoPad('erro', 'Linha da revisão PAD não encontrada para salvar a área.');
                return;
            }
            // Fonte da verdade e o estado em memoria da filha, nao o dataset (que fica
            // stale depois de re-renderizar a tabela). Sem isso, alterar a area uma
            // segunda vez podia ser bloqueado por comparacao com valor desatualizado.
            const areaAnterior = String(filha.area || '').toUpperCase();
            if (areaNova === areaAnterior) return;

            select.disabled = true;
            mostrarFeedbackRevisaoPad('aviso', 'Salvando área...');
            try {
                const { resposta, payload: responseBody } = await fetchJsonApiOnasp('/api/profor-2022/pad/revisoes-plano/area', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uf: revisoesPlanoPadEstado.ufSelecionada,
                        numeroConvenio: mae.numeroConvenio,
                        parentId,
                        linhaFilhaId,
                        chaveItem: mae.chaveItem || filha.chaveItem,
                        areaAnterior,
                        areaNova,
                        descricao: mae.descricao || filha.descricao,
                        natureza: mae.natureza || filha.natureza,
                        codigoNatureza: mae.codigoNatureza || filha.codigoNatureza,
                        quantidade: filha.quantidade,
                        quantidadeOriginal: mae.quantidadeOriginal,
                        valorUnitario: mae.valorUnitario
                    })
                });
                if (!resposta.ok || !responseBody?.success) {
                    throw new Error(responseBody?.message || 'Falha ao salvar área.');
                }
                const linhaAtualizada = responseBody.payload?.linhaFilhaAtualizada;
                if (linhaAtualizada) substituirFilhaRevisaoPad({ ...filha, ...linhaAtualizada });
                atualizarMaeRevisaoPad(parentId, { status: responseBody.payload?.statusGrupo || mae.status });
                atualizarRevisoesPlanoPadUI();
                mostrarFeedbackRevisaoPad('sucesso', 'Área salva.');
            } catch (error) {
                select.value = areaAnterior;
                mostrarFeedbackRevisaoPad('erro', error.message || 'Erro ao salvar área.');
                console.warn('Falha ao salvar área da revisão PAD:', error);
            } finally {
                const novoSelect = Array.from(document.querySelectorAll('[data-revisao-pad-area]'))
                    .find((item) => item.dataset.revisaoPadArea === linhaFilhaId);
                if (novoSelect) novoSelect.disabled = false;
            }
        }

        async function salvarRateioRevisaoPad() {
            const mae = obterMaeRevisaoPad(revisoesPlanoPadEstado.editorParentId);
            if (!mae) return;
            const validacao = validarEditorRateioRevisaoPad();
            if (!validacao.valido) return;
            const botaoSalvar = document.querySelector('[data-revisao-pad-editor-salvar]');
            if (botaoSalvar) botaoSalvar.disabled = true;
            mostrarFeedbackRevisaoPad('aviso', 'Salvando rateio...');

            try {
                const { resposta, payload: responseBody } = await fetchJsonApiOnasp('/api/profor-2022/pad/revisoes-plano/rateio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uf: revisoesPlanoPadEstado.ufSelecionada,
                        numeroConvenio: mae.numeroConvenio,
                        parentId: mae.id,
                        chaveItem: mae.chaveItem,
                        descricao: mae.descricao,
                        natureza: mae.natureza,
                        codigoNatureza: mae.codigoNatureza,
                        quantidadeOriginal: mae.quantidadeOriginal,
                        valorUnitario: mae.valorUnitario,
                        linhas: validacao.linhas
                    })
                });
                if (!resposta.ok || !responseBody?.success) {
                    throw new Error(responseBody?.message || 'Falha ao salvar rateio.');
                }
                const linhasFilhas = responseBody.payload?.linhasFilhasAtualizadas || [];
                substituirFilhasGrupoRevisaoPad(mae.id, linhasFilhas);
                atualizarMaeRevisaoPad(mae.id, { status: responseBody.payload?.statusGrupo || mae.status });
                revisoesPlanoPadEstado.expandidos.add(mae.id);
                atualizarRevisoesPlanoPadUI();
                mostrarFeedbackRevisaoPad('sucesso', 'Rateio salvo.');
            } catch (error) {
                mostrarFeedbackRevisaoPad('erro', error.message || 'Erro ao salvar rateio.');
                console.warn('Falha ao salvar rateio da revisão PAD:', error);
                if (botaoSalvar) botaoSalvar.disabled = false;
            }
        }

        function registrarEventosRevisaoDivergencias() {
            document.getElementById('revisoes-pad-ufs')?.addEventListener('click', (event) => {
                const botao = event.target.closest('[data-revisao-pad-uf]');
                if (botao) selecionarUfRevisaoPad(botao.dataset.revisaoPadUf);
            });
            document.getElementById('revisoes-pad-filtros')?.addEventListener('change', (event) => {
                const alvo = event.target;
                revisoesPlanoPadEstado.filtros.area = document.getElementById('revisao-pad-filtro-area')?.value || '';
                revisoesPlanoPadEstado.filtros.natureza = document.getElementById('revisao-pad-filtro-natureza')?.value || '';
                revisoesPlanoPadEstado.filtros.situacao = document.getElementById('revisao-pad-filtro-situacao')?.value || '';
                revisoesPlanoPadEstado.filtros.tipo = document.getElementById('revisao-pad-filtro-tipo')?.value || '';
                revisoesPlanoPadEstado.filtros.somentePendencias = document.getElementById('revisao-pad-filtro-pendencias')?.checked === true;
                revisoesPlanoPadEstado.filtros.mostrarSuprimidos = document.getElementById('revisao-pad-filtro-suprimidos')?.checked === true;
                if (alvo?.id !== 'revisao-pad-filtro-texto') atualizarRevisoesPlanoPadUI();
            });
            document.getElementById('revisoes-pad-filtros')?.addEventListener('input', (event) => {
                if (event.target?.id !== 'revisao-pad-filtro-texto') return;
                revisoesPlanoPadEstado.filtros.texto = event.target.value || '';
                document.getElementById('revisoes-pad-tabela').innerHTML = renderTabelaRevisoesPad();
            });
            document.getElementById('revisoes-pad-filtros')?.addEventListener('click', (event) => {
                if (!event.target.closest('#btn-revisao-pad-limpar-filtros')) return;
                revisoesPlanoPadEstado.filtros = { area: '', natureza: '', situacao: '', tipo: '', texto: '', somentePendencias: false, mostrarSuprimidos: true };
                atualizarRevisoesPlanoPadUI();
            });
            document.getElementById('revisoes-pad-tabela')?.addEventListener('click', (event) => {
                const botaoRateio = event.target.closest('[data-revisao-pad-rateio]');
                if (botaoRateio) {
                    event.preventDefault();
                    revisoesPlanoPadEstado.editorParentId = botaoRateio.dataset.revisaoPadRateio;
                    renderEditorRateioRevisaoPad();
                    document.getElementById('revisoes-pad-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    return;
                }
                const linhaMae = event.target.closest('[data-revisao-pad-mae]');
                if (!linhaMae || event.target.closest('button, select, input, a')) return;
                if (linhaMae.dataset.podeExpandir === '0') return;
                const id = linhaMae.dataset.revisaoPadMae;
                if (revisoesPlanoPadEstado.expandidos.has(id)) revisoesPlanoPadEstado.expandidos.delete(id);
                else revisoesPlanoPadEstado.expandidos.add(id);
                document.getElementById('revisoes-pad-tabela').innerHTML = renderTabelaRevisoesPad();
            });
            document.getElementById('revisoes-pad-tabela')?.addEventListener('change', (event) => {
                const select = event.target.closest('[data-revisao-pad-area]');
                if (!select) return;
                salvarAreaLinhaFilhaRevisaoPad(select);
            });
            document.getElementById('revisoes-pad-editor')?.addEventListener('input', validarEditorRateioRevisaoPad);
            document.getElementById('revisoes-pad-editor')?.addEventListener('change', validarEditorRateioRevisaoPad);
            document.getElementById('revisoes-pad-editor')?.addEventListener('click', (event) => {
                if (event.target.closest('[data-revisao-pad-editor-adicionar]')) {
                    document.getElementById('revisao-pad-editor-lista')?.insertAdjacentHTML('beforeend', renderLinhaEditorRateioRevisaoPad({ area: 'NAO_CLASSIFICADO', quantidade: 0 }));
                    validarEditorRateioRevisaoPad();
                }
                if (event.target.closest('[data-revisao-pad-editor-remover]')) {
                    event.target.closest('[data-revisao-pad-editor-row]')?.remove();
                    validarEditorRateioRevisaoPad();
                }
                if (event.target.closest('[data-revisao-pad-editor-fechar]')) {
                    revisoesPlanoPadEstado.editorParentId = null;
                    renderEditorRateioRevisaoPad();
                }
                if (event.target.closest('[data-revisao-pad-editor-salvar]')) {
                    salvarRateioRevisaoPad();
                }
            });
        }

        function registrarEventoFormularioDecisaoRevisao(divergencia) {
            const form = document.getElementById('form-revisao-decisao');
            if (!form) return;
            const atualizarPrevia = () => atualizarPreviaPayloadDecisaoRevisao(divergencia);
            form.addEventListener('input', atualizarPrevia);
            form.addEventListener('change', atualizarPrevia);
            form.addEventListener('click', (event) => {
                // Chips de ação rápida — apenas preparam a decisão, não registram.
                const chip = event.target.closest('[data-revisao-preset]');
                if (chip) {
                    event.preventDefault();
                    aplicarPresetDecisaoRevisao(divergencia, chip.dataset.revisaoPreset);
                    return;
                }

                const botaoAdicionar = event.target.closest('[data-revisao-rateio-adicionar]');
                if (botaoAdicionar) {
                    event.preventDefault();
                    document.getElementById('revisao-rateio-list')?.insertAdjacentHTML('beforeend', renderLinhaRateioRevisao());
                    atualizarPrevia();
                    return;
                }

                const botaoRemover = event.target.closest('[data-revisao-rateio-remover]');
                if (botaoRemover) {
                    event.preventDefault();
                    const linha = botaoRemover.closest('[data-revisao-rateio-row]');
                    linha?.remove();
                    const lista = document.getElementById('revisao-rateio-list');
                    if (lista && !lista.querySelector('[data-revisao-rateio-row]')) {
                        lista.insertAdjacentHTML('beforeend', renderLinhaRateioRevisao());
                    }
                    atualizarPrevia();
                }
            });
            atualizarPrevia();
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const id = form.dataset.divergenciaId;
                const decisao = document.getElementById('revisao-decisao')?.value || '';
                // Usuário responsável é sempre o mesmo: vem do padrão/localStorage,
                // não é exibido nem digitado na tela.
                const usuario = obterUsuarioResponsavelRevisao();
                const presetId = document.getElementById('revisao-motivo-decisao')?.dataset?.presetId || '';
                // Justificativa enviada = texto padrão do preset + observação adicional opcional.
                const justificativa = comporJustificativaDecisaoRevisao();
                const valorAplicado = document.getElementById('revisao-valor-aplicado')?.value?.trim?.() || undefined;
                const exigeJustificativa = ['ACEITO', 'REJEITADO', 'CORRIGIDO', 'REVERTIDO'].includes(decisao);
                const payloadDecisao = montarPayloadDecisaoRevisao(divergencia, decisao);
                const erros = [];
                if (exigeJustificativa && !presetId && !justificativa) {
                    erros.push('Clique em uma ação sugerida para preparar a decisão.');
                }
                erros.push(...validarPayloadDecisaoRevisao(divergencia, decisao, payloadDecisao));
                if (erros.length) {
                    definirErrosFormularioDecisaoRevisao(erros);
                    return;
                }
                definirErrosFormularioDecisaoRevisao([]);
                // Usuário responsável fica salvo para evitar redigitação na próxima decisão.
                salvarUsuarioResponsavelRevisao(usuario);
                const botao = form.querySelector('button[type="submit"]');
                if (botao) botao.disabled = true;
                try {
                    const payload = await buscarJsonRevisao(`/api/profor-2022/revisao/divergencias/${encodeURIComponent(id)}/decisoes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            decisao,
                            usuario,
                            justificativa,
                            valorAplicado,
                            payloadDecisao
                        })
                    });
                    alert(`Decisão registrada. aplicadaAoPlano=${payload.decisao?.aplicadaAoPlano === true ? 'true' : 'false'}. Reconstrução/publicação não alteradas.`);
                    // Guarda a posição da divergência decidida ANTES de recarregar
                    // a lista, para abrir a próxima pendência automaticamente.
                    const listaAnterior = Array.isArray(revisaoDivergenciasEstado.divergencias)
                        ? revisaoDivergenciasEstado.divergencias
                        : [];
                    const indiceDecidida = listaAnterior.findIndex((d) => String(d.id) === String(id));
                    await carregarAuditoriaRevisao();
                    await carregarListaRevisao();
                    avancarParaProximaPendenciaRevisao(indiceDecidida, id);
                } catch (error) {
                    definirErrosFormularioDecisaoRevisao([error.message || 'Falha ao registrar decisão.']);
                    alert(error.message || 'Falha ao registrar decisão.');
                } finally {
                    if (botao) botao.disabled = false;
                }
            });
        }

        async function carregarUltimaRecargaPadUI() {
            const container = document.getElementById('recarga-pad-resultado');
            if (!container) return;
            try {
                const { resposta, payload: responseBody } = await fetchJsonApiOnasp('/api/profor-2022/pad/ultima-recarga-operacional');
                const recarga = responseBody?.payload;
                if (resposta.ok && recarga && recarga.sucesso !== false && recarga.dataHora) {
                    renderResultadoRecargaPad(recarga);
                } else {
                    container.innerHTML = `<div class="text-muted small">Nenhuma recarga de PADs realizada recentemente.</div>`;
                }
            } catch (error) {
                console.error('Erro ao buscar última recarga de PADs:', error);
                container.innerHTML = `<div class="text-muted small">Nenhuma recarga de PADs realizada recentemente.</div>`;
            }
        }

        async function executarRecargaPadsOperacionalUI() {
            const confirmado = confirm('Deseja realmente recarregar os 15 PADs de Planilhas/profor-2022/instrumentos? Esta ação reanalisará os dados e atualizará a reconstrução local.');
            if (!confirmado) return;

            const btnRecarregar = document.getElementById('btn-recarregar-pads');
            const progresso = document.getElementById('recarga-pad-progresso');
            const resultadoContainer = document.getElementById('recarga-pad-resultado');

            if (btnRecarregar) btnRecarregar.disabled = true;
            if (progresso) progresso.classList.remove('d-none');
            if (resultadoContainer) resultadoContainer.innerHTML = '';

            try {
                const { resposta, payload: responseBody } = await fetchJsonApiOnasp('/api/profor-2022/pad/recarregar-operacional', {
                    method: 'POST'
                });

                const recarga = responseBody?.payload;
                const detalheErroRecarga = recarga?.impedimentos?.[0]?.detalhe
                    || responseBody?.message
                    || recarga?.mensagem
                    || `Falha na API de recarga de PADs (status ${resposta.status}).`;
                if (!resposta.ok || !responseBody || !recarga) {
                    throw new Error(detalheErroRecarga);
                }

                renderResultadoRecargaPad(recarga);

                let etapaAtualizacaoUi = 'carregar_lista_revisao';
                try {
                    await carregarListaRevisao();
                } catch (errorAtualizacaoUi) {
                    console.warn('Falha ao atualizar interface apos recarga PADs:', {
                        etapa: etapaAtualizacaoUi,
                        erro: errorAtualizacaoUi,
                        stack: errorAtualizacaoUi?.stack || null
                    });
                    if (resultadoContainer) {
                        resultadoContainer.insertAdjacentHTML('beforeend', `
                            <div class="alert alert-warning mt-3 mb-0">
                                Recarga PAD concluída, mas houve falha ao atualizar a interface na etapa ${escapeHtml(etapaAtualizacaoUi)}: ${escapeHtml(errorAtualizacaoUi?.message || 'Erro desconhecido')}
                            </div>
                        `);
                    }
                }
            } catch (error) {
                console.error('Falha ao recarregar PADs:', error);
                if (resultadoContainer) {
                    resultadoContainer.innerHTML = `
                        <div class="alert alert-danger mb-0">
                            <strong>Erro ao recarregar PADs:</strong> ${escapeHtml(error.message || 'Erro desconhecido')}
                        </div>
                    `;
                }
            } finally {
                if (btnRecarregar) btnRecarregar.disabled = false;
                if (progresso) progresso.classList.add('d-none');
            }
        }

        function agruparOcorrenciasRecargaPad(lista = []) {
            const grupos = new Map();
            for (const item of lista || []) {
                const tipo = item?.tipo || 'ocorrencia';
                if (!grupos.has(tipo)) {
                    grupos.set(tipo, { tipo, total: 0, porConvenio: {}, exemplos: [] });
                }
                const grupo = grupos.get(tipo);
                grupo.total += 1;
                const convenio = item?.numeroConvenio || item?.instrumento || 'sem_convenio';
                grupo.porConvenio[convenio] = (grupo.porConvenio[convenio] || 0) + 1;
                if (grupo.exemplos.length < 10) grupo.exemplos.push(item);
            }
            return Array.from(grupos.values()).sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo));
        }

        function renderResumoOcorrenciasRecargaPad(lista, opcoes = {}) {
            const grupos = opcoes.grupos || agruparOcorrenciasRecargaPad(lista);
            if (!grupos.length) return '';
            const detalheId = opcoes.id || `recarga-pad-detalhes-${Math.random().toString(36).slice(2)}`;
            const classeTexto = opcoes.classeTexto || 'text-danger';
            const resumoHtml = grupos.slice(0, 8).map((grupo) => {
                const totalConvenios = Object.keys(grupo.porConvenio || {}).length;
                return `
                    <li>
                        <strong>${escapeHtml(grupo.tipo)}</strong>: ${escapeHtml(String(grupo.total))}
                        ${totalConvenios ? `<span class="text-muted">(${escapeHtml(String(totalConvenios))} convênio(s))</span>` : ''}
                    </li>
                `;
            }).join('');
            const detalhesHtml = grupos.map((grupo) => `
                <div class="mb-2">
                    <strong>${escapeHtml(grupo.tipo)}</strong>
                    <ul class="mb-0 ps-3">
                        ${grupo.exemplos.map((item) => `
                            <li>
                                ${item.numeroConvenio || item.instrumento ? `(Convênio ${escapeHtml(String(item.numeroConvenio || item.instrumento))}) ` : ''}
                                ${escapeHtml(item.detalhe || '')}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('');
            return `
                <ul class="mb-2 mt-2 ps-3 ${classeTexto} small">${resumoHtml}</ul>
                <details class="small">
                    <summary>Ver lista detalhada</summary>
                    <div id="${escapeHtml(detalheId)}" class="mt-2">${detalhesHtml}</div>
                </details>
            `;
        }

        function renderResultadoRecargaPad(resultado) {
            const container = document.getElementById('recarga-pad-resultado');
            if (!container) return;

            let dataHoraFmt = '';
            if (resultado.dataHora) {
                try {
                    dataHoraFmt = new Date(resultado.dataHora).toLocaleString('pt-BR');
                } catch {
                    dataHoraFmt = resultado.dataHora;
                }
            }

            let alertaStatusHtml = '';
            if (resultado.totalImpedimentos > 0) {
                const listaImpedimentos = renderResumoOcorrenciasRecargaPad(resultado.impedimentos || [], {
                    id: 'recarga-pad-impedimentos-detalhes',
                    classeTexto: 'text-danger'
                });
                alertaStatusHtml = `
                    <div class="alert alert-danger mb-3">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Recarga concluída com ${resultado.totalImpedimentos} impedimento(s).</strong>
                        <span>O plano local não está pronto para publicação.</span>
                        ${listaImpedimentos}
                    </div>
                `;
            } else if (resultado.aptoParaUsoLocal) {
                let msgPublicacao = '';
                if (resultado.aptoParaPublicacao) {
                    msgPublicacao = ' O plano também está <strong>apto para publicação</strong>.';
                } else {
                    msgPublicacao = ' A publicação para produção continua <strong>bloqueada por divergências</strong> pendentes ou em revisão.';
                }
                alertaStatusHtml = `
                    <div class="alert alert-success mb-3">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Sucesso!</strong> A reconstrução local foi atualizada e está pronta para uso.${msgPublicacao}
                    </div>
                `;
            } else {
                alertaStatusHtml = `
                    <div class="alert alert-warning mb-3">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        <strong>Aviso:</strong> A recarga foi concluída, mas o plano local não está marcado como apto para uso local.
                    </div>
                `;
            }

            let alertaAvisosHtml = '';
            if ((Array.isArray(resultado.alertasAgrupados) && resultado.alertasAgrupados.length > 0)
                || (Array.isArray(resultado.alertas) && resultado.alertas.length > 0)) {
                const listaAlertas = renderResumoOcorrenciasRecargaPad(resultado.alertas || [], {
                    id: 'recarga-pad-alertas-detalhes',
                    classeTexto: 'text-warning-emphasis',
                    grupos: Array.isArray(resultado.alertasAgrupados) ? resultado.alertasAgrupados : null
                });
                alertaAvisosHtml = `
                    <div class="alert alert-warning mb-3">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        <strong>Alertas de Processamento (${resultado.totalAlertas ?? resultado.alertas?.length ?? 0}):</strong>
                        ${listaAlertas}
                    </div>
                `;
            }

            const stats = [
                { rotulo: 'Arquivos lidos', valor: `${resultado.arquivosLidos ?? resultado.totalRelatoriosLidos ?? 0}/${resultado.arquivosEncontrados ?? resultado.totalArquivosPad ?? 0}` },
                { rotulo: 'Itens processados', valor: resultado.itensProcessados ?? resultado.totalItensPad ?? 0 },
                { rotulo: 'Linhas reconstruídas', valor: resultado.linhasReconstruidas ?? resultado.totalLinhasReconstruidas ?? 0 },
                { rotulo: 'Convênios reconstruídos', valor: resultado.conveniosReconstruidos ?? resultado.totalConveniosReconstruidos ?? 0 },
                { rotulo: 'Rateios aplicados', valor: resultado.rateiosAplicados ?? resultado.totalItensComRateioAplicado ?? 0 },
                { rotulo: 'Itens novos', valor: resultado.itensNovosSemRateio ?? resultado.totalItensNovos ?? 0 },
                { rotulo: 'Itens suprimidos', valor: resultado.itensSuprimidos ?? resultado.totalItensSuprimidos ?? 0 },
                { rotulo: 'Itens sem rateio', valor: resultado.totalItensSemRateio ?? resultado.itensNovosSemRateio ?? 0 }
            ];

            const gridHtml = `
                <div class="row g-2 mb-3">
                    ${stats.map(st => `
                        <div class="col-6 col-md-3">
                            <div class="p-2 border rounded bg-light text-center">
                                <span class="d-block text-muted small text-uppercase" style="font-size: 0.65rem;">${escapeHtml(st.rotulo)}</span>
                                <strong class="fs-5 text-dark">${escapeHtml(String(st.valor))}</strong>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            container.innerHTML = `
                <div class="mt-3">
                    <p class="text-muted small mb-2">Última execução: <strong>${escapeHtml(dataHoraFmt)}</strong></p>
                    ${alertaStatusHtml}
                    ${alertaAvisosHtml}
                    ${gridHtml}
                </div>
            `;
        }

        function renderPainelLogsOperacionaisHtml() {
            const tiposEvento = [
                { valor: '', rotulo: 'Todos os tipos' },
                { valor: 'profor_atualizacao_consolidada', rotulo: 'Atualização consolidada PROFOR 2022' },
                { valor: 'profor_publicacao_estatica', rotulo: 'Publicação estática PROFOR 2022' },
                { valor: 'profor_detru', rotulo: 'Atualização DETRU' },
                { valor: 'profor_rendimentos_transferegov', rotulo: 'Rendimentos Transferegov' }
            ];
            const statusOpcoes = [
                { valor: '', rotulo: 'Todos os status' },
                { valor: 'sucesso', rotulo: 'Sucesso' },
                { valor: 'falha', rotulo: 'Falha' },
                { valor: 'bloqueado', rotulo: 'Bloqueado' },
                { valor: 'parcial', rotulo: 'Parcial' }
            ];

            return `
                <section class="system-status-panel mb-5" id="painel-logs-operacionais" aria-label="Logs operacionais">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Sistema (local/API)</p>
                            <h2>Logs operacionais</h2>
                            <p class="text-muted small mb-0">Disponível apenas no servidor local/API. Logs não são exibidos no GitHub Pages.</p>
                        </div>
                    </div>
                    <form class="row g-2 align-items-end mb-3" id="form-filtros-logs-operacionais" onsubmit="return false;">
                        <div class="col-12 col-md-4">
                            <label class="form-label small" for="filtro-logs-tipo">Tipo de evento</label>
                            <select id="filtro-logs-tipo" class="form-select form-select-sm">
                                ${tiposEvento.map((opt) => `<option value="${escapeHtml(opt.valor)}">${escapeHtml(opt.rotulo)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-12 col-md-3">
                            <label class="form-label small" for="filtro-logs-status">Status</label>
                            <select id="filtro-logs-status" class="form-select form-select-sm">
                                ${statusOpcoes.map((opt) => `<option value="${escapeHtml(opt.valor)}">${escapeHtml(opt.rotulo)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-6 col-md-2">
                            <label class="form-label small" for="filtro-logs-limite">Limite</label>
                            <input type="number" id="filtro-logs-limite" class="form-control form-control-sm" value="50" min="1" max="200">
                        </div>
                        <div class="col-12 col-md-3 d-flex gap-2 flex-wrap">
                            <button type="button" id="btn-carregar-logs" class="btn btn-sm btn-primary">
                                <i class="fas fa-rotate" aria-hidden="true"></i> Carregar logs
                            </button>
                            <button type="button" id="btn-exportar-logs-json" class="btn btn-sm btn-outline-secondary">
                                <i class="fas fa-file-code" aria-hidden="true"></i> JSON
                            </button>
                            <button type="button" id="btn-exportar-logs-csv" class="btn btn-sm btn-outline-secondary">
                                <i class="fas fa-file-csv" aria-hidden="true"></i> CSV
                            </button>
                        </div>
                    </form>
                    <div id="mensagem-logs-operacionais" class="alert alert-info d-none" role="status"></div>
                    <div class="table-responsive">
                        <table class="table table-sm app-data-table" id="tabela-logs-operacionais">
                            <thead>
                                <tr>
                                    <th>Data/hora</th>
                                    <th>Módulo</th>
                                    <th>Tipo</th>
                                    <th>Status</th>
                                    <th>Duração</th>
                                    <th>Resumo</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td colspan="6" class="text-center text-muted py-3">Clique em "Carregar logs" para listar os últimos registros.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        function obterFiltrosLogsOperacionais() {
            const tipo = document.getElementById('filtro-logs-tipo')?.value || '';
            const status = document.getElementById('filtro-logs-status')?.value || '';
            const limite = document.getElementById('filtro-logs-limite')?.value || '';
            const filtros = {};
            if (tipo) filtros.tipo_evento = tipo;
            if (status) filtros.status = status;
            if (limite) filtros.limite = limite;
            return filtros;
        }

        function montarQueryStringLogs(filtros, extras = {}) {
            const params = new URLSearchParams();
            if (filtros.tipo_evento) params.set('tipo_evento', filtros.tipo_evento);
            if (filtros.status) params.set('status', filtros.status);
            if (filtros.limite) params.set('limite', filtros.limite);
            Object.entries(extras).forEach(([chave, valor]) => {
                if (valor !== undefined && valor !== null && valor !== '') params.set(chave, valor);
            });
            const q = params.toString();
            return q ? `?${q}` : '';
        }

        function definirMensagemLogsOperacionais(texto, tipo = 'info') {
            const el = document.getElementById('mensagem-logs-operacionais');
            if (!el) return;
            if (!texto) {
                el.classList.add('d-none');
                el.textContent = '';
                return;
            }
            el.className = `alert alert-${tipo}`;
            el.textContent = texto;
        }

        function formatarDuracaoLog(ms) {
            const numero = Number(ms);
            if (!Number.isFinite(numero) || numero < 0) return '';
            if (numero < 1000) return `${numero} ms`;
            return `${(numero / 1000).toFixed(1)} s`;
        }

        function formatarDataHoraLog(iso) {
            if (!iso) return '';
            try {
                const data = new Date(iso);
                if (Number.isNaN(data.getTime())) return iso;
                return data.toLocaleString('pt-BR');
            } catch {
                return iso;
            }
        }

        async function carregarLogsOperacionais() {
            const tbody = document.querySelector('#tabela-logs-operacionais tbody');
            if (!tbody) return;
            const filtros = obterFiltrosLogsOperacionais();
            definirMensagemLogsOperacionais('Carregando logs operacionais…', 'info');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Carregando…</td></tr>';
            try {
                const caminho = `/api/sistema/logs-operacionais${montarQueryStringLogs(filtros)}`;
                const { resposta, payload } = await fetchJsonApiOnasp(caminho);
                if (!resposta.ok || !payload?.success) {
                    throw new Error(payload?.message || `Falha ao carregar logs (status ${resposta.status}).`);
                }
                const logs = Array.isArray(payload.logs) ? payload.logs : [];
                if (!logs.length) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum log operacional encontrado para os filtros aplicados.</td></tr>';
                    definirMensagemLogsOperacionais('Nenhum log operacional encontrado.', 'warning');
                    return;
                }
                tbody.innerHTML = logs.map((log) => `
                    <tr>
                        <td>${escapeHtml(formatarDataHoraLog(log.criadoEm || log.concluidoEm || ''))}</td>
                        <td>${escapeHtml(log.modulo || '')}</td>
                        <td>${escapeHtml(log.tipoEvento || '')}</td>
                        <td>${escapeHtml(log.status || '')}</td>
                        <td>${escapeHtml(formatarDuracaoLog(log.duracaoMs))}</td>
                        <td>${escapeHtml(log.resumo || '')}</td>
                    </tr>
                `).join('');
                definirMensagemLogsOperacionais(`Total de ${logs.length} registro(s) carregado(s).`, 'success');
            } catch (error) {
                console.error('Falha ao carregar logs operacionais:', error);
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Não foi possível carregar os logs operacionais.</td></tr>';
                definirMensagemLogsOperacionais(`Não foi possível carregar os logs operacionais: ${error?.message || error}`, 'danger');
            }
        }

        function exportarLogsOperacionais(formato) {
            const filtros = obterFiltrosLogsOperacionais();
            const caminho = `/api/sistema/logs-operacionais/export${montarQueryStringLogs(filtros, { formato })}`;
            const url = obterUrlApiOnasp(caminho);
            if (typeof window !== 'undefined') {
                window.open(url, '_blank', 'noopener');
            }
        }

        function inicializarPainelLogsOperacionais() {
            const btnCarregar = document.getElementById('btn-carregar-logs');
            const btnJson = document.getElementById('btn-exportar-logs-json');
            const btnCsv = document.getElementById('btn-exportar-logs-csv');
            if (btnCarregar) btnCarregar.addEventListener('click', () => carregarLogsOperacionais());
            if (btnJson) btnJson.addEventListener('click', () => exportarLogsOperacionais('json'));
            if (btnCsv) btnCsv.addEventListener('click', () => exportarLogsOperacionais('csv'));
        }

        async function toggleView(viewName) {
            if (viewName === 'orcamento') {
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
                const viewRevisaoDivergencias = document.getElementById('view-revisao-divergencias');
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
                if (viewRevisaoDivergencias) viewRevisaoDivergencias.style.display = 'none';

                renderOrcamentoViewSkeleton();
                atualizarNavegacao(viewName);
                fecharMenuLateral();
                window.scrollTo(0, 0);
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
                } finally {
                    aplicarModoSomenteLeituraControlada();
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
            const podeAbrirRevisaoDivergencias = viewName === 'revisao-divergencias';
            const podeAbrirComDadosEstaticos = ['faf2021', 'faf2021-detalhe', 'doacoes2023', 'doacoes2023-detalhe'].includes(viewName);

            if (!dadosFinanceirosValidados && viewName !== 'dashboard' && !podeAbrirOrcamento && !podeAbrirContatos && !podeAbrirDiagnosticoOuvidorias && !podeAbrirFormalizacao && !podeAbrirStatusSistema && !podeAbrirRevisaoDivergencias && !podeAbrirComDadosEstaticos) {
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
            const viewRevisaoDivergencias = document.getElementById('view-revisao-divergencias');
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
            if (viewRevisaoDivergencias) viewRevisaoDivergencias.style.display = 'none';

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
            } else if (viewName === 'revisao-divergencias') {
                await renderRevisoesPadPlanoView();
            } else {
                document.getElementById('view-dashboard').style.display = 'block';
            }

            atualizarNavegacao(viewName);
            fecharMenuLateral();
            aplicarModoSomenteLeituraControlada();
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
                                        <div class="pill-fill" style="width: ${getProgressWidth(pct)}%; background: ${getProgressGradient(pct)}"></div>
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
                acc.valorPrevistoGeral += Number(convenio.valorPrevistoGeral) || 0;
                acc.saldoDisponivelOuvidoria += Number(convenio.saldoDisponivelOuvidoria) || 0;
                acc.saldoPotencialDestinavelOuvidoria += Number(convenio.saldoPotencialDestinavelOuvidoria) || 0;
                return acc;
            }, {
                totalConvenios: convenios.length,
                valorGlobal: 0,
                valorRepasse: 0,
                valorContrapartida: 0,
                valorExecutadoGeral: 0,
                previstoOuvidoria: 0,
                valorExecutadoOuvidoria: 0,
                valorPrevistoGeral: 0,
                saldoDisponivelOuvidoria: 0,
                saldoPotencialDestinavelOuvidoria: 0
            });

            const baseExecucaoGeral = resumo.valorPrevistoGeral > 0 ? resumo.valorPrevistoGeral : resumo.valorGlobal;
            resumo.execucaoGeralPercentual = baseExecucaoGeral > 0
                ? (resumo.valorExecutadoGeral / baseExecucaoGeral) * 100
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

        function obterAlertasProfor(convenio) {
            const alertas = [];
            const execucaoOuvidoria = Number(convenio.execucaoOuvidoriaPercentual) || 0;
            const diasVencimento = obterDiasAteDataPtBr(convenio.vencimento);

            if (execucaoOuvidoria <= 0) {
                alertas.push({ tipo: 'danger', texto: 'Sem execução da Ouvidoria' });
            } else if (execucaoOuvidoria < 50) {
                alertas.push({ tipo: 'warning', texto: 'Execução baixa' });
            } else if (execucaoOuvidoria >= 100) {
                alertas.push({ tipo: 'success', texto: 'Ouvidoria executada' });
            }

            if (diasVencimento !== null && diasVencimento < 0) {
                alertas.push({ tipo: 'danger', texto: 'Vencimento expirado' });
            } else if (diasVencimento !== null && diasVencimento <= 365) {
                alertas.push({ tipo: 'warning', texto: `Vence em ${diasVencimento} dias` });
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
            const diasVencimento = obterDiasAteDataPtBr(convenio.vencimento);

            if (!situacao) return true;
            if (situacao === 'sem-execucao') return execucao <= 0;
            if (situacao === 'baixa-execucao') return execucao > 0 && execucao < 50;
            if (situacao === 'execucao-integral') return execucao >= 100;
            if (situacao === 'vencimento-proximo') return diasVencimento !== null && diasVencimento >= 0 && diasVencimento <= 365;
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
                        <td colspan="7" class="text-center text-muted py-4">Nenhum convênio encontrado para os filtros selecionados.</td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = conveniosOrdenados.map((convenio) => {
                const execucao = Number(convenio.execucaoOuvidoriaPercentual) || 0;
                const safeUf = escapeHtml(convenio.uf);
                const safeNumero = escapeHtml(convenio.numero);
                const safeAno = escapeHtml(convenio.ano);

                return `
                    <tr class="profor-row" data-profor-uf="${safeUf}" role="button" tabindex="0">
                        <td data-label="Convênio" class="align-middle">
                            <div class="profor-convenio-cell">
                                <span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao({uf: convenio.uf})}<span class="badge bg-secondary badge-uf">${safeUf}</span></span>
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
                                <div class="pill-fill" style="width: ${getProgressWidth(execucao)}%; background: ${getProgressGradient(execucao)}"></div>
                                <div class="pill-text">${formatPercent(execucao)}</div>
                            </div>
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

            document.getElementById('btnToggleCarteiraMonitorada')?.addEventListener('click', () => {
                const painel = document.getElementById('profor-carteira-painel');
                const btn = document.getElementById('btnToggleCarteiraMonitorada');
                if (!painel || !btn) return;
                const abrindo = painel.hidden;
                painel.hidden = !abrindo;
                btn.setAttribute('aria-expanded', String(abrindo));
                const icon = btn.querySelector('i');
                if (icon) icon.className = abrindo ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
                if (abrindo && !painel.dataset.carregada) {
                    painel.dataset.carregada = '1';
                    const incluirInativos = document.getElementById('carteiraIncluirInativos')?.checked ?? false;
                    carregarCarteiraMonitoradaProfor2022(incluirInativos);
                }
                if (abrindo) {
                    carregarStatusUltimaAtualizacaoDetruProfor2022();
                    carregarStatusAtualizacaoConsolidadaProfor2022();
                }
            });
            document.getElementById('carteiraIncluirInativos')?.addEventListener('change', (e) => {
                carregarCarteiraMonitoradaProfor2022(e.target.checked);
            });
            document.getElementById('btnNovoConvenioMonitorado')?.addEventListener('click', () => {
                abrirModalConvenioMonitorado(null);
            });
            document.getElementById('profor-carteira-monitorada-container')?.addEventListener('click', async (event) => {
                const btnEditar = event.target.closest('[data-acao="editar-convenio"]');
                const btnInativar = event.target.closest('[data-acao="inativar-convenio"]');
                if (btnEditar) {
                    const id = Number(btnEditar.dataset.id);
                    abrirModalConvenioMonitorado(carteiraMonitoradaProfor2022Cache.find((c) => c.id === id) || null);
                }
                if (btnInativar) {
                    const id = Number(btnInativar.dataset.id);
                    const numero = btnInativar.dataset.numero || String(id);
                    if (!confirm(`Inativar o convênio ${numero}? O registro não será excluído.`)) return;
                    await inativarConvenioMonitoradoUI(id);
                }
            });
        }

        async function carregarCarteiraMonitoradaProfor2022(incluirInativos = false) {
            const statusEl = document.getElementById('profor-carteira-status');
            if (!statusEl) return;

            if (estaEmModoPublicacaoEstatica()) {
                statusEl.innerHTML = renderPublicationNotice();
                return;
            }

            statusEl.innerHTML = '<div class="text-center text-muted py-3 small"><i class="fas fa-spinner fa-spin me-2" aria-hidden="true"></i>Carregando carteira...</div>';

            try {
                const qs = incluirInativos ? '?incluirInativos=true' : '';
                const { payload } = await fetchJsonApiOnasp(`/api/profor-2022/convenios-monitorados${qs}`);
                if (!payload.success) throw new Error(payload.message || 'Erro ao carregar carteira.');
                carteiraMonitoradaProfor2022Cache = payload.convenios || [];
                statusEl.innerHTML = renderizarListaConveniosMonitorados(carteiraMonitoradaProfor2022Cache);
            } catch (err) {
                statusEl.innerHTML = `<div class="alert alert-warning m-3"><i class="fas fa-exclamation-triangle me-2" aria-hidden="true"></i>${escapeHtml(err.message || 'Não foi possível carregar a carteira monitorada.')}</div>`;
            }
        }

        function renderizarListaConveniosMonitorados(lista) {
            if (!lista.length) {
                return renderEmptyState({
                    titulo: 'Nenhum convênio na carteira.',
                    descricao: 'Use o botão "Novo" ou execute npm run import:profor-convenios.',
                    icon: 'fa-file-contract'
                });
            }

            const normalizarInstrumento = (v) => (v || '').replace(/Conv�nio/gi, 'Conv\xEAnio');

            const linhas = lista.map((c) => `
                <tr class="${c.ativo === 0 ? 'text-muted' : ''}">
                    <td class="fw-medium">${escapeHtml(c.numeroConvenio)}</td>
                    <td class="text-center">${escapeHtml(c.ano || '—')}</td>
                    <td class="text-center"><span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao({uf: c.uf})}<span>${escapeHtml(c.uf || '—')}</span></span></td>
                    <td>${escapeHtml(normalizarInstrumento(c.instrumento) || '—')}</td>
                    <td class="text-center">${c.ativo !== 0
                        ? '<span class="badge bg-success-subtle text-success-emphasis">Ativo</span>'
                        : '<span class="badge bg-secondary-subtle text-secondary-emphasis">Inativo</span>'}</td>
                    <td class="text-muted small">${escapeHtml(c.observacao || '')}</td>
                    <td class="text-end text-nowrap">${c.ativo !== 0 ? `
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-icon-only me-1"
                            data-acao="editar-convenio" data-id="${c.id}" title="Editar convênio">
                            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
                            <span class="visually-hidden">Editar</span>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger btn-icon-only"
                            data-acao="inativar-convenio" data-id="${c.id}" data-numero="${escapeHtml(c.numeroConvenio)}" title="Inativar convênio">
                            <i class="fas fa-ban" aria-hidden="true"></i>
                            <span class="visually-hidden">Inativar</span>
                        </button>` : ''}</td>
                </tr>
            `).join('');

            return `
                <div class="table-responsive">
                    <table class="table table-sm table-hover w-100 app-data-table" id="profor-carteira-tabela">
                        <thead>
                            <tr>
                                <th>Convênio</th>
                                <th class="text-center">Ano</th>
                                <th class="text-center">UF</th>
                                <th>Instrumento</th>
                                <th class="text-center">Situação</th>
                                <th>Observação</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            `;
        }

        function abrirModalConvenioMonitorado(convenio = null) {
            if (estaEmModoPublicacaoEstatica()) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }

            const idEdicao = convenio?.id ?? null;
            const titulo = idEdicao ? 'Editar convênio' : 'Novo convênio';

            removerModalOnasp('modalConvenioMonitorado');
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal fade" id="modalConvenioMonitorado" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${escapeHtml(titulo)}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label" for="convmNumero">Número do convênio <span class="text-danger" aria-hidden="true">*</span></label>
                                    <input type="text" class="form-control" id="convmNumero" placeholder="Somente dígitos"
                                        value="${escapeHtml(convenio?.numeroConvenio || '')}"
                                        ${idEdicao ? 'readonly' : ''}>
                                </div>
                                <div class="row g-2 mb-3">
                                    <div class="col">
                                        <label class="form-label" for="convmAno">Ano</label>
                                        <input type="text" class="form-control" id="convmAno" placeholder="AAAA" maxlength="4"
                                            value="${escapeHtml(convenio?.ano || '')}">
                                    </div>
                                    <div class="col">
                                        <label class="form-label" for="convmUf">UF</label>
                                        <input type="text" class="form-control" id="convmUf" placeholder="Ex: SP" maxlength="2"
                                            value="${escapeHtml(convenio?.uf || '')}">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="convmInstrumento">Instrumento</label>
                                    <input type="text" class="form-control" id="convmInstrumento"
                                        value="${escapeHtml(convenio?.instrumento || 'Convênio')}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="convmObservacao">Observação</label>
                                    <textarea class="form-control" id="convmObservacao" rows="2">${escapeHtml(convenio?.observacao || '')}</textarea>
                                </div>
                                <div id="convmMensagemErro" class="d-none"></div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-primary" id="confirmarSalvarConvMonitorado">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            const modalElement = document.getElementById('modalConvenioMonitorado');
            const modal = new window.bootstrap.Modal(modalElement);
            modal.show();

            document.getElementById('confirmarSalvarConvMonitorado')?.addEventListener('click', async () => {
                await salvarConvenioMonitoradoProfor(modal, idEdicao);
            });
        }

        async function salvarConvenioMonitoradoProfor(modal, idEdicao = null) {
            const numero = document.getElementById('convmNumero')?.value.trim() || '';
            const ano = document.getElementById('convmAno')?.value.trim() || '';
            const uf = document.getElementById('convmUf')?.value.trim().toUpperCase() || '';
            const instrumento = document.getElementById('convmInstrumento')?.value.trim() || '';
            const observacao = document.getElementById('convmObservacao')?.value.trim() || '';
            const erroEl = document.getElementById('convmMensagemErro');

            const mostrarErro = (msg) => {
                if (!erroEl) return;
                erroEl.className = 'alert alert-danger mt-2';
                erroEl.textContent = msg;
            };

            if (!numero) { mostrarErro('O número do convênio é obrigatório.'); return; }
            if (!/^\d+$/.test(numero)) { mostrarErro('O número deve conter apenas dígitos.'); return; }
            if (ano && !/^\d{4}$/.test(ano)) { mostrarErro('O ano deve ter exatamente 4 dígitos.'); return; }
            if (uf && uf.length !== 2) { mostrarErro('A UF deve ter exatamente 2 caracteres.'); return; }

            if (erroEl) erroEl.className = 'd-none';

            const bodyPayload = {
                numeroConvenio: numero,
                ano: ano || null,
                uf: uf || null,
                instrumento: instrumento || 'Convênio',
                observacao: observacao || null
            };

            const btnSalvar = document.getElementById('confirmarSalvarConvMonitorado');
            if (btnSalvar) btnSalvar.disabled = true;

            try {
                const caminho = idEdicao
                    ? `/api/profor-2022/convenios-monitorados/${idEdicao}/salvar`
                    : '/api/profor-2022/convenios-monitorados';

                const { payload } = await fetchJsonApiOnasp(caminho, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                });

                if (!payload.success) throw new Error(payload.message || 'Não foi possível salvar.');

                modal.hide();
                const incluirInativos = document.getElementById('carteiraIncluirInativos')?.checked || false;
                await carregarCarteiraMonitoradaProfor2022(incluirInativos);
            } catch (err) {
                mostrarErro(err.message || 'Erro ao salvar convênio.');
            } finally {
                if (btnSalvar) btnSalvar.disabled = false;
            }
        }

        async function inativarConvenioMonitoradoUI(id) {
            if (estaEmModoPublicacaoEstatica()) {
                alert(MENSAGEM_MODO_PUBLICACAO);
                return;
            }
            try {
                const { payload } = await fetchJsonApiOnasp(`/api/profor-2022/convenios-monitorados/${id}/inativar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!payload.success) throw new Error(payload.message || 'Não foi possível inativar.');
                const incluirInativos = document.getElementById('carteiraIncluirInativos')?.checked || false;
                await carregarCarteiraMonitoradaProfor2022(incluirInativos);
            } catch (err) {
                alert(err.message || 'Erro ao inativar convênio.');
            }
        }

        function formatarDataHoraProfor(valor) {
            if (!valor) return '';
            const data = new Date(valor);
            if (Number.isNaN(data.getTime())) return String(valor);
            return data.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function obterDiagnosticoOrigemProfor(dadosProfor) {
            const diagnostico = dadosProfor?.diagnostico || {};
            const partes = [];
            if (diagnostico.totalComDetru !== undefined) partes.push(`DETRU ${diagnostico.totalComDetru}`);
            if (diagnostico.totalComPlano !== undefined) partes.push(`Plano ${diagnostico.totalComPlano}`);
            if (diagnostico.totalComRendimentos !== undefined) partes.push(`Rendimentos ${diagnostico.totalComRendimentos}`);
            return partes.join(' | ');
        }

        function obterDataReferenciaRendimentosProfor(dadosProfor, convenio = null) {
            return convenio?.rendimentosConsultadoEm
                || convenio?.consultadoEm
                || dadosProfor?.ultimaAtualizacaoRendimentos?.concluidoEm
                || dadosProfor?.ultimaAtualizacaoRendimentos?.consultadoEm
                || dadosProfor?.geradoEm
                || '';
        }

        function renderizarFonteRendimentosProfor(dadosProfor, convenio = null) {
            return '';
        }

        function renderizarAvisoOrigemProfor(dadosProfor) {
            return '';
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
            const resumoConvenios = calcularResumoConveniosProfor(dadosProfor.convenios || []);
            const origemBancoCache = dadosProfor.origemDadosEfetiva === 'banco-cache';
            const saldoDisponivelOuvidoria = Number.isFinite(Number(resumo?.saldoDisponivelOuvidoria))
                ? Number(resumo.saldoDisponivelOuvidoria)
                : resumoConvenios.saldoDisponivelOuvidoria;
            const saldoPotencialDestinavelOuvidoria = Number.isFinite(Number(resumo?.saldoPotencialDestinavelOuvidoria))
                ? Number(resumo.saldoPotencialDestinavelOuvidoria)
                : resumoConvenios.saldoPotencialDestinavelOuvidoria;
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

                ${renderizarAvisoOrigemProfor(dadosProfor)}

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3 profor-kpi-grid" aria-label="Indicadores PROFOR 2022">
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-file-contract" aria-hidden="true"></i>Convênios vigentes</div>
                            <div class="kpi-value">${resumo.totalConvenios}</div>
                            <div class="kpi-desc">${origemBancoCache ? 'Carteira monitorada' : 'Instrumentos da aba Geral'}</div>
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
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-info" title="Saldo ainda não executado dos itens já destinados à Ouvidoria no plano de aplicação.">
                            <div class="kpi-title"><i class="fas fa-wallet" aria-hidden="true"></i>Saldo disponível da Ouvidoria</div>
                            <div class="kpi-value text-money">${formatMoney(saldoDisponivelOuvidoria)}</div>
                            <div class="kpi-desc">Saldo dos itens da área OUVIDORIA</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-warning" title="Composição: saldo de rendimentos atualizado + economicidade de capital + economicidade de custeio. Valor gerencial sujeito à análise e eventual reprogramação.">
                            <div class="kpi-title"><i class="fas fa-layer-group" aria-hidden="true"></i>Potencial destinável à Ouvidoria</div>
                            <div class="kpi-value text-money">${formatMoney(saldoPotencialDestinavelOuvidoria)}</div>
                            <div class="kpi-desc">Indicador gerencial para decisão administrativa</div>
                        </div>
                    </div>
                </section>

                <section class="filter-section filter-bar mb-3" aria-label="Filtros PROFOR 2022">
                    <div class="filter-bar-main">
                        <div class="filter-title">
                            <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                            <strong>Filtros</strong>
                        </div>
                        <input type="text" id="filtroProforBusca" class="form-control filter-bar-search" placeholder="Buscar por UF, convênio ou vencimento..." aria-label="Buscar convênios PROFOR 2022">
                        <button id="btnLimparFiltroProfor" type="button" class="btn btn-outline-secondary btn-icon-text">
                            <i class="fas fa-undo" aria-hidden="true"></i>
                            <span>Limpar</span>
                        </button>
                    </div>
                    <details class="filter-bar-advanced">
                        <summary class="filter-bar-advanced-toggle">
                            <i class="fas fa-sliders-h" aria-hidden="true"></i>
                            <span>Mais filtros</span>
                            <small class="text-muted">UF · Sinal de gestão · Ordenação</small>
                        </summary>
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
                                    <option value="vencimento-proximo">Vencimento em até 12 meses</option>
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
                    </details>
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

                                </tr>
                            </thead>
                            <tbody id="profor-table-body"></tbody>
                        </table>
                    </div>
                </section>

                <section class="table-container mb-4" id="profor-carteira-monitorada-container" aria-label="Carteira de convênios monitorados">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Gestão local</p>
                            <h2>Carteira Monitorada</h2>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary btn-icon-text" id="btnToggleCarteiraMonitorada"
                                aria-expanded="false" aria-controls="profor-carteira-painel">
                                <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                <span>Gerenciar carteira</span>
                            </button>
                        </div>
                    </div>
                    <div id="profor-carteira-painel" hidden>
                        <div class="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-top">
                            <label class="form-check form-check-inline mb-0">
                                <input class="form-check-input" type="checkbox" id="carteiraIncluirInativos">
                                <span class="form-check-label small">Ver inativos</span>
                            </label>
                            ${!estaEmModoPublicacaoEstatica() ? `
                            <div class="ms-auto d-flex flex-wrap align-items-center gap-2">
                                <button type="button" class="btn btn-sm btn-primary btn-icon-text" id="btnNovoConvenioMonitorado">
                                    <i class="fas fa-circle-plus" aria-hidden="true"></i>
                                    <span>Novo</span>
                                </button>
                            </div>` : ''}
                        </div>
                        <div id="profor-carteira-status"></div>
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
            const calcularSaldoItemProfor = (item) => (Number(item.valorPrevisto) || 0) - (Number(item.valorExecutado) || 0);
            const totalSaldo = itens.reduce((total, item) => total + calcularSaldoItemProfor(item), 0);
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
                const saldo = calcularSaldoItemProfor(item);

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
                                <div class="pill-fill" style="width: ${getProgressWidth(percentualItem)}%; background: ${getProgressGradient(percentualItem)}"></div>
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
                    </section>

                    <section class="row my-4 row-cols-1 row-cols-md-2 row-cols-xl-4 g-3" aria-label="Detalhes financeiros do convênio">
                        ${renderizarKpiDetalheProfor('Valor Global', formatMoney(convenio.valorGlobal), 'Total pactuado', '', 'fa-scale-balanced')}
                        ${renderizarKpiDetalheProfor('Valor de Repasse', formatMoney(convenio.valorRepasse), 'União', '', 'fa-building-columns')}
                        ${renderizarKpiDetalheProfor('Contrapartida', formatMoney(convenio.valorContrapartida), 'Pactuada', '', 'fa-handshake')}
                        ${renderizarKpiDetalheProfor('Repasse Desembolsado', formatMoney(convenio.repasseDesembolsado), 'Liberado ao convenente', 'kpi-card-info', 'fa-money-bill-transfer')}
                        ${renderizarKpiDetalheProfor('Countdown da Vigência', renderizarCountdownVigenciaProfor(convenio), `Vencimento em ${convenio.vencimento || '-'}`, 'kpi-card-warning', 'fa-hourglass-half')}
                        ${renderizarKpiDetalheProfor('Execução Geral', formatPercent(convenio.execucaoGeralPercentual), formatMoney(convenio.valorExecutadoGeral), 'kpi-card-success', 'fa-chart-line')}
                        ${renderizarKpiDetalheProfor('Previsto Ouvidoria', formatMoney(convenio.previstoOuvidoria), `${convenio.totalItensOuvidoria} item(ns)`, '', 'fa-headset')}
                        ${renderizarKpiDetalheProfor('Execução Ouvidoria', formatPercent(convenio.execucaoOuvidoriaPercentual), formatMoney(convenio.valorExecutadoOuvidoria), 'kpi-card-success', 'fa-check-circle')}
                        ${renderizarKpiDetalheProfor('Saldo disponível da Ouvidoria', formatMoney(convenio.saldoDisponivelOuvidoria), 'Saldo dos itens já destinados à OUVIDORIA', 'kpi-card-info', 'fa-wallet')}
                        ${renderizarKpiDetalheProfor('Potencial destinável à Ouvidoria', formatMoney(convenio.saldoPotencialDestinavelOuvidoria), 'Rendimentos + economicidade capital + economicidade custeio', 'kpi-card-warning', 'fa-layer-group')}
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

                    <section class="profor-finance-grid mb-4" aria-label="Composição do potencial destinável à Ouvidoria">
                        <div class="profor-finance-item">
                            <span>Saldo de rendimentos</span>
                            <strong>${formatMoney(convenio.saldoRendimentosAtual)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Economicidade capital</span>
                            <strong>${formatMoney(convenio.saldoEconomicidadeCapital)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Economicidade custeio</span>
                            <strong>${formatMoney(convenio.saldoEconomicidadeCusteio)}</strong>
                        </div>
                        <div class="profor-finance-item">
                            <span>Total potencial destinável</span>
                            <strong>${formatMoney(convenio.saldoPotencialDestinavelOuvidoria)}</strong>
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
                        <td data-label="UF" class="align-middle"><span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao({uf: item.uf})}<span class="badge badge-uf">${escapeHtml(item.uf)}</span></span></td>
                        <td data-label="Objeto" class="align-middle"><span class="truncate-text">${escapeHtml(item.objeto)}</span></td>
                        <td data-label="Qtd." class="text-center align-middle">${formatarQuantidadeProfor(item.quantidade)}</td>
                        <td data-label="Valor unit." class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                        <td data-label="Previsto" class="text-end font-monospace align-middle">${formatMoney(item.valorTotal)}</td>
                        <td data-label="Executado" class="text-end font-monospace align-middle ${item.valorExecutado > 0 ? 'text-success fw-bold' : 'text-muted'}">${formatMoney(item.valorExecutado)}</td>
                        <td data-label="Saldo" class="text-end font-monospace align-middle ${saldo < 0 ? 'text-danger fw-bold' : ''}">${formatMoney(saldo)}</td>
                        <td data-label="%" class="text-center align-middle progress-cell">
                            <div class="custom-progress-pill">
                                <div class="pill-fill" style="width: ${getProgressWidth(percentual)}%; background: ${getProgressGradient(percentual)}"></div>
                                <div class="pill-text">${formatPercent(percentual)}</div>
                            </div>
                        </td>

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

                <section class="filter-section filter-bar mb-3" aria-label="Filtros FAF 2021">
                    <div class="filter-bar-main">
                        <div class="filter-title"><i class="fas fa-filter text-secondary" aria-hidden="true"></i><strong>Filtros</strong></div>
                        <input type="text" id="filtroFafBusca" class="form-control filter-bar-search" placeholder="Buscar por UF ou objeto..." aria-label="Buscar itens FAF 2021">
                        <button id="btnLimparFiltroFaf" type="button" class="btn btn-outline-secondary btn-icon-text">
                            <i class="fas fa-undo" aria-hidden="true"></i><span>Limpar</span>
                        </button>
                    </div>
                    <details class="filter-bar-advanced">
                        <summary class="filter-bar-advanced-toggle">
                            <i class="fas fa-sliders-h" aria-hidden="true"></i>
                            <span>Mais filtros</span>
                            <small class="text-muted">UF · Sinal de gestão · Ordenação</small>
                        </summary>
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
                    </details>
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
                                    <th class="text-center">%</th><th class="text-center">Ações</th>
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
                                                        <div class="pill-fill" style="width: ${getProgressWidth(percentual)}%; background: ${getProgressGradient(percentual)}"></div>
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
                    <td data-label="UF" class="align-middle"><span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao({uf: item.uf})}<span class="badge badge-uf">${escapeHtml(item.uf)}</span></span></td>
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

                <section class="filter-section filter-bar mb-3" aria-label="Filtros Doações 2023">
                    <div class="filter-bar-main">
                        <div class="filter-title"><i class="fas fa-filter text-secondary" aria-hidden="true"></i><strong>Filtros</strong></div>
                        <input type="text" id="filtroDoacoesBusca" class="form-control filter-bar-search" placeholder="Buscar por UF ou objeto..." aria-label="Buscar doações 2023">
                        <button id="btnLimparFiltroDoacoes" type="button" class="btn btn-outline-secondary btn-icon-text">
                            <i class="fas fa-undo" aria-hidden="true"></i><span>Limpar</span>
                        </button>
                    </div>
                    <details class="filter-bar-advanced">
                        <summary class="filter-bar-advanced-toggle">
                            <i class="fas fa-sliders-h" aria-hidden="true"></i>
                            <span>Mais filtros</span>
                            <small class="text-muted">UF · Ordenação</small>
                        </summary>
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
                    </details>
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
                    <div class="pill-fill" style="width: ${valor}%; background: ${getProgressGradient(valor)}"></div>
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
            const ufOriginal = proposta.uf || '';
            const ufLimpa = ufOriginal.split('_')[0];
            const flagUrl = catalogoAplicacao.imagensBandeiras?.[ufLimpa] || '';
            const safeUf = escapeHtml(ufOriginal);

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
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'UFs na seleção',
                            valor: propostas.length,
                            descricao: `de ${dados.resumo.totalPropostas} propostas`,
                            icon: 'fa-filter'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Valor Global',
                            valor: `<span class="text-money">${formatMoney(resumoSelecao.valorGlobal)}</span>`,
                            descricao: 'repasse + contrapartida',
                            icon: 'fa-scale-balanced'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Alertas críticos',
                            valor: resumoSelecao.alertasCriticos,
                            descricao: `${resumoSelecao.aptas} apta(s) à celebração`,
                            icon: 'fa-triangle-exclamation',
                            variant: resumoSelecao.alertasCriticos ? 'warning' : 'success'
                        })}
                    </div>
                    <div class="col">
                        ${renderKpiCard({
                            titulo: 'Progresso médio',
                            valor: formatPercent(progressoMedio),
                            descricao: `${resumoSelecao.planosOk} plano(s) compatíveis`,
                            icon: 'fa-chart-line',
                            variant: 'info'
                        })}
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
                                <span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao(proposta)}<span class="badge badge-uf">${escapeHtml(proposta.uf)}</span></span>
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
                aplicarModoSomenteLeituraControlada();
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
                            ? '<small class="text-muted">Modo publicação: somente leitura.</small>'
                            : totalAlteracoes
                                ? `<small class="text-muted">${totalAlteracoes} alteração(ões) pendente(s) nas UFs.</small>`
                                : '<small class="text-muted">Use Ações para editar UFs.</small>'}
                    </div>
                    <div class="diagnostico-action-buttons">
                        ${renderActionButton({
                            id: 'btnExportarFormalizacao',
                            type: 'exportExcel',
                            label: 'Exportar Excel',
                            variant: 'export',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btnHistoricoFormalizacao',
                            type: 'history',
                            label: 'Histórico',
                            variant: 'admin',
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
                aplicarModoSomenteLeituraControlada();
                return;
            }

            const propostas = Array.isArray(dados.propostas) ? dados.propostas : [];
            if (propostas.length === 0) {
                container.innerHTML = renderEmptyState({
                    titulo: 'Nenhuma proposta de formalização disponível.',
                    descricao: 'Verifique se os dados da base PROFOR foram carregados ou publicados corretamente.',
                    icon: 'fa-file-signature'
                });
                aplicarModoSomenteLeituraControlada();
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

                <section class="filter-section filter-bar mb-3" aria-label="Filtros da formalização">
                    <div class="filter-bar-main">
                        <div class="filter-title">
                            <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                            <strong>Filtros</strong>
                        </div>
                        <input type="text" id="filtroFormalizacaoBusca" class="form-control filter-bar-search" placeholder="Buscar por UF, proposta, contato, órgão ou status..." aria-label="Buscar formalização">
                        <button id="btnLimparFiltroFormalizacao" type="button" class="btn btn-outline-secondary btn-icon-text">
                            <i class="fas fa-undo" aria-hidden="true"></i>
                            <span>Limpar</span>
                        </button>
                    </div>
                    <details class="filter-bar-advanced">
                        <summary class="filter-bar-advanced-toggle">
                            <i class="fas fa-sliders-h" aria-hidden="true"></i>
                            <span>Mais filtros</span>
                            <small class="text-muted">UF · Região · Status · Ouvidoria · Pendência</small>
                        </summary>
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
                    </details>
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
            aplicarModoSomenteLeituraControlada();
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
                aplicarModoSomenteLeituraControlada();
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
            aplicarModoSomenteLeituraControlada();
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
                    item.setorAtual,
                    item.responsavelAtual,
                    item.dataEntradaSetor,
                    item.pendenciaAtual,
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

        function renderizarAcompanhamentoGerencialRastreioOrcamento(item) {
            const setorAtual = String(obterValorPendenteOrcamento(item, 'setor_atual') || '').trim();
            const responsavelAtual = String(obterValorPendenteOrcamento(item, 'responsavel_atual') || '').trim();
            const dataEntradaSetor = obterValorPendenteOrcamento(item, 'data_entrada_setor');
            const pendenciaAtual = String(obterValorPendenteOrcamento(item, 'pendencia_atual') || '').trim();
            const observacao = String(obterValorPendenteOrcamento(item, 'observacao') || '').trim();

            return `
                <div class="budget-tracking-management mt-3">
                    <div class="budget-tracking-eyebrow">Acompanhamento gerencial</div>
                    <div class="row g-2 small">
                        <div class="col-md-6"><span class="text-muted">Setor atual:</span> <strong>${escapeHtml(setorAtual || 'não informado')}</strong></div>
                        <div class="col-md-6"><span class="text-muted">Responsável atual:</span> <strong>${escapeHtml(responsavelAtual || 'não informado')}</strong></div>
                        <div class="col-md-6"><span class="text-muted">No setor atual:</span> <strong>${escapeHtml(formatarDiasNoSetorAtualOrcamento(dataEntradaSetor))}</strong></div>
                        <div class="col-md-6"><span class="text-muted">Providência:</span> <strong>${escapeHtml(pendenciaAtual || 'não informada')}</strong></div>
                        <div class="col-12"><span class="text-muted">Observação livre:</span> <strong>${escapeHtml(observacao || 'sem observação registrada')}</strong></div>
                    </div>
                </div>
            `;
        }

        // Renderiza uma linha extra abaixo do item da tabela. Essa linha só entra
        // no DOM quando o item está expandido, permitindo múltiplas trilhas.
        function renderizarRastreioOrcamento(item, colspan = 11) {
            const etapas = obterEtapasRastreioOrcamento(item);
            const etapaAtual = etapas.find((etapa) => etapa.estado === 'atual') || etapas[0];
            const idRastreio = obterIdRastreioOrcamento(item);

            return `
                <tr class="budget-tracking-row pdf-hidden" id="${escapeHtml(idRastreio)}">
                    <td colspan="${colspan}" class="budget-tracking-cell">
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
                            ${renderizarAcompanhamentoGerencialRastreioOrcamento(item)}
                        </div>
                    </td>
                </tr>
            `;
        }

        function registrarEventosRastreioOrcamento(container, budgetData, aoAlternar = null) {
            container.querySelectorAll('.budget-tracking-toggle').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const itemId = botao.dataset.budgetItemId;
                    if (orcamentoItensRastreioAbertos.has(itemId)) {
                        orcamentoItensRastreioAbertos.delete(itemId);
                    } else {
                        orcamentoItensRastreioAbertos.add(itemId);
                    }
                    if (typeof aoAlternar === 'function') {
                        aoAlternar();
                        return;
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
            if (orcamentoEmModoPublicacaoEstatico()) return '';

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
            const inicioMovimentacoes = DEBUG_PERF_ONASP ? performance.now() : 0;
            if (orcamentoEmModoPublicacaoEstatico()) {
                orcamentoMovimentacoes = [];
                registrarPerfOrcamento('carregarMovimentacoesOrcamento2026', inicioMovimentacoes, {
                    modo: 'estatico',
                    totalMovimentacoes: 0
                });
                return;
            }
            try {
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
            const montarMarcador = (rotulo, valor, classe = '') => `
                <span class="budget-balance-detail-item${classe ? ` ${classe}` : ''}">
                    <span class="budget-balance-detail-label">${rotulo}</span>
                    <span class="budget-balance-detail-value">${formatMoney(valor)}</span>
                </span>
            `;
            if (resumo.valorOriginal !== resumo.envelopeVisualAjustado) {
                partes.push(montarMarcador('Original', resumo.valorOriginal));
            }
            if (resumo.valorRecebidoPorAlocacao > 0) {
                partes.push(montarMarcador('Recebido', resumo.valorRecebidoPorAlocacao, 'budget-balance-detail-positive'));
            }
            if (resumo.valorCedidoPorAlocacao > 0) {
                partes.push(montarMarcador('Cedido', resumo.valorCedidoPorAlocacao, 'budget-balance-detail-negative'));
            }
            if (resumo.valorDistribuidoParaFilhos > 0) {
                partes.push(montarMarcador('Vinculado', resumo.valorDistribuidoParaFilhos));
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
                        <td data-label="Acompanhamento" class="align-middle" title="${escapeHtml(observacao)}">
                            ${renderizarResumoAcompanhamentoGerencialOrcamento(filho)}
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
            if (orcamentoEmModoPublicacaoEstatico()) return '';
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
            if (!Boolean(item) || item.ativo === false || orcamentoEmModoPublicacaoEstatico()) return false;
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
                    <th scope="col" title="Acompanhamento gerencial"><div class="budget-header-cell"><i class="fas fa-comment-dots" aria-hidden="true"></i> <span>Acomp.</span></div></th>
                    <th scope="col"><div class="budget-header-cell"><i class="fas fa-cogs" aria-hidden="true"></i> <span>Ações</span></div></th>
                </tr>
            `;
        }

        function renderizarPainelEdicaoOrcamento(item, colspan = 8) {
            if (orcamentoEmModoPublicacaoEstatico()) return '';

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
                            </div>
                            <div class="budget-edit-section mt-3">
                                <div class="budget-edit-section-header">
                                    <strong>Acompanhamento gerencial</strong>
                                    <span>Dias no setor atual: ${escapeHtml(formatarDiasNoSetorAtualOrcamento(obterValorPendenteOrcamento(item, 'data_entrada_setor')))}</span>
                                </div>
                                <div class="budget-edit-grid">
                                    <label>
                                        <span>Setor atual</span>
                                        ${renderizarCampoOrcamento(item, 'setor_atual')}
                                    </label>
                                    <label>
                                        <span>Responsável atual</span>
                                        ${renderizarCampoOrcamento(item, 'responsavel_atual')}
                                    </label>
                                    <label>
                                        <span>Data de entrada no setor atual</span>
                                        ${renderizarCampoOrcamento(item, 'data_entrada_setor')}
                                    </label>
                                    <label>
                                        <span>Providência</span>
                                        ${renderizarCampoOrcamento(item, 'pendencia_atual')}
                                    </label>
                                    <label class="budget-edit-grid-wide">
                                        <span>Observação livre</span>
                                        ${renderizarCampoOrcamento(item, 'observacao')}
                                    </label>
                                </div>
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
                        <td data-label="Acompanhamento" class="align-middle" title="${escapeHtml(observacao)}">
                            ${renderizarResumoAcompanhamentoGerencialOrcamento(item)}
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
        }

        function renderizarPainelOutrosProcessosOrcamento(budgetData) {
            const outrosProcessos = (budgetData.outrosProcessos || [])
                .filter((item) => !orcamentoProcessosInativos.has(String(item.id)))
                .filter((item) => !itemEhProcessoVinculadoOrcamento(item));
            const quantidade = outrosProcessos.length;

            return `
                <div class="budget-other-meta text-muted small mb-2">${quantidade} processo(s) disponível(is).</div>
                <div id="budget-other-content" class="budget-other-content mt-3">
                    <div class="budget-other-loading text-muted small">Carregando processos relacionados...</div>
                </div>
            `;
        }

        function atualizarTabelaOutrosOrcamento(budgetData) {
            const inicioAtualizacaoOutros = DEBUG_PERF_ONASP ? performance.now() : 0;
            const content = document.getElementById('budget-other-content');
            if (!content) return;

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
                                    <th><i class="fas fa-comment-dots" aria-hidden="true"></i> Acompanhamento</th>
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
                const itemId = String(item.id);
                const editando = orcamentoItemEmEdicao(item.id);
                const linkedBadge = renderizarBadgeProcessoVinculadoOrcamento(item);
                const podeExibirRastreio = itemPodeExibirRastreioOrcamento(item);
                const rastreioAberto = podeExibirRastreio && orcamentoItensRastreioAbertos.has(itemId);
                const idRastreio = obterIdRastreioOrcamento(item);
                const descricao = escapeHtml(obterValorPendenteOrcamento(item, 'descricao') || item.descricao || '-');
                return `
                <tr class="${rastreioAberto ? 'budget-item-row-open' : ''}">
                    <td data-label="Descrição">
                        <div class="budget-other-description">
                            ${podeExibirRastreio ? `
                                <button type="button" class="budget-item-title budget-tracking-toggle" data-budget-item-id="${escapeHtml(itemId)}" aria-expanded="${rastreioAberto}" aria-controls="${escapeHtml(idRastreio)}">
                                    <span>${descricao}</span>
                                    <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                </button>
                            ` : `<div class="budget-item-title budget-item-title-static">${descricao}</div>`}
                            ${linkedBadge}
                        </div>
                    </td>
                    <td data-label="Processo SEI">${renderizarCampoOutrosOrcamento(item, 'processo_sei')}</td>
                    <td data-label="Valor estimado" class="text-end font-monospace">${renderizarCampoOutrosOrcamento(item, 'valor_estimado_pesquisa_preco', 'number')}</td>
                    <td data-label="Processo autuado" class="text-center">${renderizarCampoOutrosOrcamento(item, 'processo_autuado')}</td>
                    <td data-label="Status">${renderizarCampoOutrosOrcamento(item, 'status')}</td>
                    <td data-label="Acompanhamento">${editando ? renderizarCampoOutrosOrcamento(item, 'observacao') : renderizarResumoAcompanhamentoGerencialOrcamento(item)}</td>
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
                ${renderizarPainelEdicaoOrcamento(item, 7)}
                ${rastreioAberto ? renderizarRastreioOrcamento(item, 7) : ''}
            `;
            });
            const linhasNovas = orcamentoNovosProcessos.map(renderizarLinhaNovoProcessoOrcamento);

            tbody.innerHTML = [...linhasExistentes, ...linhasNovas].join('') || `
                <tr><td colspan="7" class="text-center text-muted py-4">Nenhum processo adicional cadastrado.</td></tr>
            `;

            registrarEventosRastreioOrcamento(tbody, budgetData, () => {
                atualizarTabelaOutrosOrcamento(budgetData);
            });
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
                setor_atual: '',
                responsavel_atual: '',
                data_entrada_setor: '',
                pendencia_atual: '',
                observacao: ''
            });
            orcamentoOutrosProcessosExpandido = true;
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
                    setor_atual: item.setor_atual,
                    responsavel_atual: item.responsavel_atual,
                    data_entrada_setor: item.data_entrada_setor,
                    pendencia_atual: item.pendencia_atual,
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
            if (orcamentoEmModoPublicacaoEstatico()) {
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
                aplicarModoSomenteLeituraControlada();
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
                aplicarModoSomenteLeituraControlada();
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
            const percentualEmExecucao = totalOrcamento > 0 ? (valorEmExecucao / totalOrcamento) * 100 : 0;
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
                <div class="mt-2"></div>

                <section class="filter-section budget-filter-bar mb-3" aria-label="Filtros da tabela de orçamento">
                    <div class="budget-filter-bar-title">
                        <i class="fas fa-filter text-secondary" aria-hidden="true"></i>
                        <strong>Filtros</strong>
                    </div>
                    <input type="text" id="filtroOrcamentoBusca" class="form-control budget-filter-bar-search" placeholder="Buscar por item, modalidade, status ou SEI..." aria-label="Buscar orçamento">
                    <select id="filtroOrcamentoStatus" class="form-select budget-filter-control budget-filter-bar-select" aria-label="Filtrar por status">
                        <option value="">Status: todos</option>
                        ${renderizarOpcoesFiltroOrcamento(filtros.status)}
                    </select>
                    <select id="filtroOrcamentoNatureza" class="form-select budget-filter-control budget-filter-bar-select" aria-label="Filtrar por natureza">
                        <option value="">Natureza: todas</option>
                        ${renderizarOpcoesFiltroOrcamento(filtros.naturezas)}
                    </select>
                    <select id="filtroOrcamentoModalidade" class="form-select budget-filter-control budget-filter-bar-select" aria-label="Filtrar por modalidade">
                        <option value="">Modalidade: todas</option>
                        ${renderizarOpcoesFiltroOrcamento(filtros.modalidades)}
                    </select>
                    <button id="btnLimparFiltroOrcamento" type="button" class="btn btn-outline-secondary btn-icon-text budget-filter-bar-clear">
                        <i class="fas fa-undo" aria-hidden="true"></i>
                        <span>Limpar</span>
                    </button>
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
                            disabled: orcamentoEmModoPublicacaoEstatico(),
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
                atualizarTabelaOutrosOrcamento(budgetData);
            };
            const atualizarDebounced = debounceOnasp(atualizar, 180);
            if (!orcamentoEmModoPublicacaoEstatico()) {
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
            document.getElementById('btnExportarResumoOrcamentoTexto')?.addEventListener('click', () => {
                abrirModalExportarResumoOrcamentoTexto(budgetData);
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
            aplicarModoSomenteLeituraControlada();

            requestAnimationFrame(() => {
                if (sequenciaRenderizacao !== orcamentoRenderizacaoSequencia) return;
                const inicioTabela = DEBUG_PERF_ONASP ? performance.now() : 0;
                atualizarTabelaOrcamento(budgetData);
                registrarPerfOrcamento('renderOrcamentoView:atualizarTabelaOrcamento', inicioTabela, {
                    linhasPrincipais: Array.isArray(budgetData?.itens) ? budgetData.itens.length : 0
                });
                requestAnimationFrame(() => {
                    if (sequenciaRenderizacao !== orcamentoRenderizacaoSequencia) return;
                    const inicioOutros = DEBUG_PERF_ONASP ? performance.now() : 0;
                    atualizarTabelaOutrosOrcamento(budgetData);
                    registrarPerfOrcamento('renderOrcamentoView:atualizarTabelaOutros', inicioOutros, {
                        linhasOutros: Array.isArray(budgetData?.outrosProcessos) ? budgetData.outrosProcessos.length : 0
                    });
                });
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

            aplicarModoSomenteLeituraControlada();
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

            if (!parametrosMinimosEditorAtivo && !totalAlteracoes) {
                return '';
            }

            return `
                <section class="diagnostico-action-bar diagnostico-block mb-3" aria-label="Ações dos parâmetros mínimos">
                    <div>
                        <p class="section-eyebrow mb-1">Alterações Pendentes</p>
                        <h2>Modo Edição Ativo</h2>
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
                            label: 'Cancelar',
                            variant: 'danger',
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
                                    <th class="text-center" style="width: 100px;">UF</th>
                                    <th>Checklist</th>
                                    <th class="text-center">Pendências</th>
                                    <th class="text-center">Validar</th>
                                    <th class="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${respostasFiltradas.map((resposta) => {
                                    const resumoUf = resposta.resumoParametrosMinimos || {};
                                    return `
                                        <tr class="cursor-pointer" data-diagnostico-uf="${escapeHtml(resposta.uf || '')}" title="Clique para ver os detalhes da UF">
                                            <td data-label="UF" class="text-center"><span class="uf-flag-inline justify-content-center">${renderizarBandeiraCardFormalizacao({uf: resposta.uf})}<strong>${escapeHtml(resposta.uf || '-')}</strong></span></td>
                                            <td data-label="Checklist">${escapeHtml(`${resumoUf.parametrosAtendidos || 0}/${resumoUf.total || 0} parâmetros atendidos`)}</td>
                                            <td data-label="Pendências" class="text-center">${escapeHtml(String(resumoUf.pendencias || 0))}</td>
                                            <td data-label="Validar" class="text-center">${escapeHtml(String(resumoUf.itensParaValidar || 0))}</td>
                                            <td data-label="Status" class="text-center">${renderizarBadgeDiagnostico(resposta.statusGeralParametrosMinimos)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
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
                setor_atual: item.setorAtual,
                responsavel_atual: item.responsavelAtual,
                data_entrada_setor: item.dataEntradaSetor,
                pendencia_atual: item.pendenciaAtual,
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

        function obterPartesDataOrcamento(valor) {
            const texto = String(valor ?? '').trim();
            if (!texto) return null;
            const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            const brComHifen = texto.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            const partes = iso
                ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
                : br
                    ? [Number(br[3]), Number(br[2]), Number(br[1])]
                    : brComHifen
                        ? [Number(brComHifen[3]), Number(brComHifen[2]), Number(brComHifen[1])]
                        : null;
            if (!partes) return null;
            const [ano, mes, dia] = partes;
            const data = new Date(ano, mes - 1, dia);
            if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
            return { ano, mes, dia };
        }

        function obterDataLocalOrcamento(valor) {
            const partes = obterPartesDataOrcamento(valor);
            if (!partes) return null;
            const { ano, mes, dia } = partes;
            return new Date(ano, mes - 1, dia);
        }

        function normalizarDataInputOrcamento(valor) {
            const partes = obterPartesDataOrcamento(valor);
            if (!partes) return String(valor ?? '').trim();
            const dia = String(partes.dia).padStart(2, '0');
            const mes = String(partes.mes).padStart(2, '0');
            return `${dia}/${mes}/${partes.ano}`;
        }

        function normalizarDataBancoOrcamento(valor) {
            const partes = obterPartesDataOrcamento(valor);
            if (!partes) return String(valor ?? '').trim();
            const mes = String(partes.mes).padStart(2, '0');
            const dia = String(partes.dia).padStart(2, '0');
            return `${partes.ano}-${mes}-${dia}`;
        }

        function calcularDiasNoSetorAtualOrcamento(dataEntradaSetor) {
            const dataEntrada = obterPartesDataOrcamento(dataEntradaSetor);
            if (!dataEntrada) return null;
            const hoje = new Date();
            const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            const entradaUtc = Date.UTC(dataEntrada.ano, dataEntrada.mes - 1, dataEntrada.dia);
            const diferencaMs = hojeUtc - entradaUtc;
            const dias = Math.floor(diferencaMs / 86400000);
            return Number.isFinite(dias) ? Math.max(0, dias) : null;
        }

        function formatarDiasNoSetorAtualOrcamento(dataEntradaSetor) {
            const dias = calcularDiasNoSetorAtualOrcamento(dataEntradaSetor);
            if (dias === null) return 'não informado';
            return `${dias.toLocaleString('pt-BR')} dia${dias === 1 ? '' : 's'}`;
        }

        function renderizarResumoAcompanhamentoGerencialOrcamento(item) {
            const setorAtual = obterValorPendenteOrcamento(item, 'setor_atual') || item.setorAtual || '';
            const dataEntradaSetor = obterValorPendenteOrcamento(item, 'data_entrada_setor') || item.dataEntradaSetor || '';
            const diasNoSetor = formatarDiasNoSetorAtualOrcamento(dataEntradaSetor);

            if (!setorAtual && diasNoSetor === 'não informado') {
                return '<div class="budget-row-note">Acompanhamento não informado</div>';
            }

            return `
                <div class="budget-row-note">
                    ${escapeHtml(setorAtual || 'Setor não informado')}
                    <span class="d-block text-muted small">${escapeHtml(diasNoSetor)} no setor atual</span>
                </div>
            `;
        }

        function registrarAlteracaoOrcamento(id, campo, valorOriginal, novoValor) {
            const originalNormalizado = campo.startsWith('valor_')
                ? parseNumeroMonetarioFrontend(valorOriginal)
                : campo === 'processo_autuado'
                    ? normalizarBooleanOrcamento(valorOriginal)
                    : campo === 'classificacao_gerencial'
                        ? normalizarClassificacaoGerencialOrcamento(valorOriginal)
                    : campo === 'data_entrada_setor'
                        ? normalizarDataBancoOrcamento(valorOriginal)
                    : String(valorOriginal ?? '');
            const novoNormalizado = campo.startsWith('valor_')
                ? parseNumeroMonetarioFrontend(novoValor)
                : campo === 'processo_autuado'
                    ? normalizarBooleanOrcamento(novoValor)
                    : campo === 'classificacao_gerencial'
                        ? normalizarClassificacaoGerencialOrcamento(novoValor)
                    : campo === 'data_entrada_setor'
                        ? normalizarDataBancoOrcamento(novoValor)
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
            const modoEstatico = orcamentoEmModoPublicacaoEstatico();
            const totalAlteracoes = obterQuantidadeAlteracoesOrcamento();
            const statusInline = modoEstatico
                ? '<small class="action-buttons-status text-muted">Modo publicação: somente leitura.</small>'
                : totalAlteracoes
                    ? `<small class="action-buttons-status text-muted">${totalAlteracoes} alteração(ões) pendente(s) nas linhas.</small>`
                    : '';

            return `
                ${modoEstatico ? renderizarAvisoModoPublicacao() : ''}
                <div class="action-buttons-floating" aria-label="Ações do orçamento 2026">
                    ${statusInline}
                    ${renderActionButton({
                        id: 'btnExportarOrcamentoExcel',
                        type: 'exportExcel',
                        label: 'Exportar Excel',
                        variant: 'export',
                        backend: true,
                        disabled: modoEstatico
                    })}
                    ${renderActionButton({
                        id: 'btnHistoricoOrcamento',
                        type: 'history',
                        label: 'Histórico',
                        variant: 'admin',
                        backend: true,
                        disabled: modoEstatico
                    })}
                    ${renderActionButton({
                        id: 'btn-export-budget-pdf',
                        type: 'exportPdf',
                        label: 'PDF',
                        variant: 'export',
                        onClick: 'exportarOrcamentoPDF()'
                    })}
                    ${renderActionButton({
                        id: 'btnExportarResumoOrcamentoTexto',
                        type: 'share',
                        label: 'Exportar resumo',
                        variant: 'outline-primary'
                    })}
                </div>
            `;
        }

        function obterEtapaAtualResumoOrcamento(item) {
            if (!itemPodeExibirRastreioOrcamento(item)) return null;
            const etapas = obterEtapasRastreioOrcamento(item);
            if (!Array.isArray(etapas) || !etapas.length) return null;
            return etapas.find((etapa) => etapa.estado === 'atual') || etapas[0] || null;
        }

        function classificarItemResumoOrcamento(item, etapaAtual) {
            const statusNormalizado = normalizarBusca(item.status);
            const pendenciaAtual = String(item.pendenciaAtual || item.pendencia_atual || '').trim();
            const chaveEtapa = etapaAtual?.chave || '';
            const etapasAvancadas = new Set([
                'empenhado',
                'contratado',
                'ordem-servico',
                'entregue',
                'ordem-bancaria',
                'abertura-programa',
                'parecer-conjur',
                'publicacao-gabsec'
            ]);

            if (pendenciaAtual) {
                return 'cobranca';
            }

            if (etapasAvancadas.has(chaveEtapa) || statusNormalizado.includes('executado')) {
                return 'avancado';
            }

            return 'acompanhamento';
        }

        function normalizarItemResumoOrcamento(item) {
            const etapaAtual = obterEtapaAtualResumoOrcamento(item);
            if (!etapaAtual) return null;

            return {
                item,
                etapaAtual,
                grupo: classificarItemResumoOrcamento(item, etapaAtual)
            };
        }

        function normalizarProcessoSeiResumoOrcamento(valor) {
            return String(valor ?? '').replace(/\D/g, '');
        }

        function obterProcessoSeiResumoOrcamento(item) {
            return String(item?.processoSei || item?.processo_sei || '').trim();
        }

        function obterDescricaoItemResumoOrcamento(item) {
            return String(item?.descricao || item?.nome || item?.id || 'Item sem descrição').trim();
        }

        function obterProvidenciaResumoOrcamento(item) {
            return String(
                item?.pendenciaAtual
                || item?.pendencia_atual
                || item?.providenciaAtual
                || item?.providencia_atual
                || item?.providencia
                || ''
            ).trim();
        }

        function escolherRegistroRepresentativoResumoOrcamento(registros) {
            if (!Array.isArray(registros) || !registros.length) return null;

            const registroComPendencia = registros.find((registro) => obterProvidenciaResumoOrcamento(registro?.item));
            if (registroComPendencia) return registroComPendencia;

            const registroComContexto = registros.find((registro) => {
                const item = registro?.item || {};
                const responsavelAtual = String(item.responsavelAtual || item.responsavel_atual || '').trim();
                const setorAtual = String(item.setorAtual || item.setor_atual || '').trim();
                const dataEntradaSetor = item.dataEntradaSetor || item.data_entrada_setor;
                return Boolean(responsavelAtual || setorAtual || dataEntradaSetor);
            });

            return registroComContexto || registros[0];
        }

        function classificarGrupoResumoOrcamento(registros) {
            if (!Array.isArray(registros) || !registros.length) return 'acompanhamento';

            const possuiPendencia = registros.some((registro) => obterProvidenciaResumoOrcamento(registro?.item));
            if (possuiPendencia) return 'cobranca';

            const possuiAvancado = registros.some((registro) => registro?.grupo === 'avancado');
            if (possuiAvancado) return 'avancado';

            return 'acompanhamento';
        }

        function agruparRegistrosResumoPorProcessoSei(registros) {
            if (!Array.isArray(registros) || !registros.length) return [];

            const gruposPorSei = new Map();
            const ordemConsolidada = [];

            registros.forEach((registro) => {
                const processoSei = obterProcessoSeiResumoOrcamento(registro?.item);
                const processoSeiNormalizado = normalizarProcessoSeiResumoOrcamento(processoSei);

                if (!processoSeiNormalizado) {
                    ordemConsolidada.push(registro);
                    return;
                }

                let grupo = gruposPorSei.get(processoSeiNormalizado);
                if (!grupo) {
                    grupo = {
                        tipo: 'grupo-sei',
                        processoSeiNormalizado,
                        processoSei,
                        registros: []
                    };
                    gruposPorSei.set(processoSeiNormalizado, grupo);
                    ordemConsolidada.push(grupo);
                } else if (!grupo.processoSei && processoSei) {
                    grupo.processoSei = processoSei;
                }

                grupo.registros.push(registro);
            });

            return ordemConsolidada.map((entrada) => {
                if (!entrada || entrada.tipo !== 'grupo-sei') {
                    return entrada;
                }

                const registrosDoGrupo = Array.isArray(entrada.registros) ? entrada.registros : [];
                if (!registrosDoGrupo.length) return null;

                const registroRepresentativo = escolherRegistroRepresentativoResumoOrcamento(registrosDoGrupo) || registrosDoGrupo[0];
                const itemRepresentativo = registroRepresentativo?.item || {};
                const descricoesItens = [];
                const descricoesVistas = new Set();

                registrosDoGrupo.forEach((registro) => {
                    const descricao = obterDescricaoItemResumoOrcamento(registro?.item);
                    const chaveDescricao = normalizarBusca(descricao);
                    if (chaveDescricao && descricoesVistas.has(chaveDescricao)) return;
                    descricoesVistas.add(chaveDescricao);
                    descricoesItens.push(descricao);
                });

                return {
                    item: itemRepresentativo,
                    etapaAtual: registroRepresentativo?.etapaAtual || null,
                    grupo: classificarGrupoResumoOrcamento(registrosDoGrupo),
                    itens: registrosDoGrupo.map((registro) => registro?.item).filter(Boolean),
                    descricoesItens,
                    processoSei: entrada.processoSei || obterProcessoSeiResumoOrcamento(itemRepresentativo)
                };
            }).filter(Boolean);
        }

        function montarLinhasItemResumoOrcamento(registro, indice) {
            const { item, etapaAtual } = registro;
            const descricao = obterDescricaoItemResumoOrcamento(item);
            const processoSei = String(registro?.processoSei || obterProcessoSeiResumoOrcamento(item)).trim();
            const itensAgrupados = Array.isArray(registro?.itens) ? registro.itens.filter(Boolean) : [item].filter(Boolean);
            const descricoesItens = Array.isArray(registro?.descricoesItens) && registro.descricoesItens.length
                ? registro.descricoesItens
                : itensAgrupados.map((itemAgrupado) => obterDescricaoItemResumoOrcamento(itemAgrupado));
            const registroAgrupadoPorSei = Boolean(processoSei && itensAgrupados.length > 1);
            const setorAtual = String(item.setorAtual || item.setor_atual || '').trim();
            const responsavelAtual = String(item.responsavelAtual || item.responsavel_atual || '').trim();
            const dataEntradaSetor = item.dataEntradaSetor || item.data_entrada_setor;
            const diasNoSetor = calcularDiasNoSetorAtualOrcamento(dataEntradaSetor);
            const pendenciaAtual = obterProvidenciaResumoOrcamento(item);
            const observacao = String(item.observacao || '').trim();
            const linhas = registroAgrupadoPorSei
                ? [
                    `*${indice}. Processo ${processoSei}*`,
                    'Itens:',
                    ...descricoesItens.map((descricaoItem) => `- ${descricaoItem}`),
                    '',
                    `Andamento: ${etapaAtual?.rotulo || 'não informado'}`
                ]
                : [
                    `*${indice}. ${descricao}*`,
                    `SEI: ${processoSei || 'não informado'}`,
                    `Andamento: ${etapaAtual?.rotulo || 'não informado'}`
                ];

            if (setorAtual) linhas.push(`Local atual: ${setorAtual}`);
            if (responsavelAtual) linhas.push(`Responsável: ${responsavelAtual}`);
            if (diasNoSetor !== null) linhas.push(`No setor atual: ${diasNoSetor.toLocaleString('pt-BR')} dia${diasNoSetor === 1 ? '' : 's'}`);
            if (pendenciaAtual) linhas.push(`Providência: ${pendenciaAtual}`);
            if (observacao) linhas.push(`Obs.: ${observacao}`);

            return linhas.join('\n');
        }

        function obterItensExibidosResumoOrcamentoTexto(budgetData) {
            const itensFiltrados = filtrarItensOrcamento(budgetData);
            const contextoRenderizacao = prepararContextoRenderizacaoOrcamento(budgetData, orcamentoMovimentacoes);
            const idsIncluidos = new Set();
            const registros = [];
            const adicionarItem = (item) => {
                const itemId = String(item?.id || '');
                if (!item || (itemId && idsIncluidos.has(itemId))) return;
                const registro = normalizarItemResumoOrcamento(item);
                if (!registro) return;
                if (itemId) idsIncluidos.add(itemId);
                registros.push(registro);
            };

            itensFiltrados.forEach((item) => {
                adicionarItem(item);
                const filhosVinculados = obterFilhosVinculadosOrcamento(item.id, budgetData, contextoRenderizacao);
                filhosVinculados.forEach(adicionarItem);
            });

            const outrosProcessos = (budgetData?.outrosProcessos || [])
                .filter((item) => !orcamentoProcessosInativos.has(String(item.id)))
                .filter((item) => !itemEhProcessoVinculadoOrcamento(item));

            outrosProcessos.forEach(adicionarItem);

            return agruparRegistrosResumoPorProcessoSei(registros);
        }

        function montarGrupoResumoOrcamento(titulo, itens) {
            if (!itens.length) return '';
            const linhasItens = itens.map((registro, indice) => montarLinhasItemResumoOrcamento(registro, indice + 1));
            return `${titulo}\n\n${linhasItens.join('\n\n')}`;
        }

        function gerarTextoResumoOrcamentoWhatsapp(budgetData) {
            const registros = obterItensExibidosResumoOrcamentoTexto(budgetData);
            const grupos = {
                cobranca: registros.filter((registro) => registro.grupo === 'cobranca'),
                acompanhamento: registros.filter((registro) => registro.grupo === 'acompanhamento'),
                avancado: registros.filter((registro) => registro.grupo === 'avancado')
            };
            const dataHora = new Date().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '');
            const blocos = [
                '📌 *Resumo Orçamento ONASP 2026*',
                `Atualizado em: ${dataHora}`,
                '',
                `🔴 *Cobrança imediata:* ${grupos.cobranca.length}`,
                `🟡 *Em acompanhamento:* ${grupos.acompanhamento.length}`,
                `🟢 *Avançados/concluídos:* ${grupos.avancado.length}`
            ];

            const gruposTexto = [
                montarGrupoResumoOrcamento('🔴 Cobrança imediata', grupos.cobranca),
                montarGrupoResumoOrcamento('🟡 Em acompanhamento', grupos.acompanhamento),
                montarGrupoResumoOrcamento('🟢 Avançados/concluídos', grupos.avancado)
            ].filter(Boolean);

            if (!gruposTexto.length) {
                blocos.push('', 'Nenhum item com trilha individual nos filtros atuais.');
                return blocos.join('\n');
            }

            return `${blocos.join('\n')}\n\n${gruposTexto.join('\n\n')}`;
        }

        async function copiarTextoComFallback(texto, campoTexto) {
            const textoCopiavel = String(texto ?? '');
            if (!textoCopiavel.trim()) {
                throw new Error('Não há texto para copiar.');
            }

            if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(textoCopiavel);
                    return;
                } catch {
                    // Continua para o fallback por seleção de textarea.
                }
            }

            let textarea = campoTexto;
            let textareaTemporario = false;
            if (!textarea) {
                textarea = document.createElement('textarea');
                textareaTemporario = true;
                textarea.setAttribute('aria-hidden', 'true');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.top = '0';
                document.body.appendChild(textarea);
            }

            try {
                textarea.value = textoCopiavel;
                textarea.focus();
                textarea.select();
                if (typeof textarea.setSelectionRange === 'function') {
                    textarea.setSelectionRange(0, textoCopiavel.length);
                }
                const sucesso = document.execCommand('copy');
                if (!sucesso) {
                    throw new Error('Não foi possível copiar o texto.');
                }
            } catch (erro) {
                if (!textareaTemporario && textarea) {
                    textarea.focus();
                    textarea.select();
                }
                throw new Error(erro?.message || 'Não foi possível copiar o texto.');
            } finally {
                if (textareaTemporario) {
                    textarea.remove();
                }
            }
        }

        function abrirModalExportarResumoOrcamentoTexto(budgetData) {
            const textoResumo = gerarTextoResumoOrcamentoWhatsapp(budgetData);
            const modalId = 'modalExportarResumoOrcamentoTexto';

            let modalEl = document.getElementById(modalId);
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.className = 'modal fade';
                modalEl.id = modalId;
                modalEl.tabIndex = -1;
                modalEl.setAttribute('aria-hidden', 'true');
                modalEl.innerHTML = `
                    <div class="modal-dialog modal-lg modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Exportar resumo do Orçamento 2026</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <p class="text-muted small mb-2">Texto pronto para envio por WhatsApp com os itens atualmente exibidos na tela.</p>
                                <textarea id="campoResumoOrcamentoTexto" class="form-control font-monospace" rows="14" readonly></textarea>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>
                                <button type="button" class="btn btn-primary" id="btnCopiarResumoOrcamentoTexto">Copiar texto</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalEl);
            }

            const campoTexto = modalEl.querySelector('#campoResumoOrcamentoTexto');
            const botaoCopiar = modalEl.querySelector('#btnCopiarResumoOrcamentoTexto');
            if (!campoTexto || !botaoCopiar) return;

            campoTexto.value = textoResumo;
            botaoCopiar.onclick = async () => {
                const htmlOriginal = botaoCopiar.innerHTML;
                try {
                    await copiarTextoComFallback(campoTexto.value, campoTexto);
                    botaoCopiar.innerHTML = '<i class="fas fa-check me-1" aria-hidden="true"></i>Copiado';
                    botaoCopiar.classList.remove('btn-primary');
                    botaoCopiar.classList.add('btn-success');
                } catch (erro) {
                    botaoCopiar.innerHTML = '<i class="fas fa-triangle-exclamation me-1" aria-hidden="true"></i>Falha ao copiar';
                    botaoCopiar.classList.remove('btn-primary');
                    botaoCopiar.classList.add('btn-danger');
                }
                setTimeout(() => {
                    botaoCopiar.innerHTML = htmlOriginal;
                    botaoCopiar.classList.remove('btn-success', 'btn-danger');
                    botaoCopiar.classList.add('btn-primary');
                }, 1600);
            };

            const instanciaModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            instanciaModal.show();
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

            if (campo === 'data_entrada_setor') {
                const valorTexto = normalizarDataInputOrcamento(valor);
                return `
                    <input
                        type="text"
                        class="form-control form-control-sm budget-edit-control"
                        value="${escapeHtml(valorTexto)}"
                        data-orcamento-id="${escapeHtml(item.id)}"
                        data-orcamento-campo="${campo}"
                        data-orcamento-original="${escapeHtml(valorOriginal ?? '')}"
                        inputmode="numeric"
                        placeholder="DD/MM/AAAA"
                    >
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
            if (orcamentoEmModoPublicacaoEstatico()) return '';
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
                    window.scrollTo({ top: 0, behavior: 'instant' });
                });
            });

            document.getElementById('diagnosticoRespostaAtual')?.addEventListener('change', (evento) => {
                diagnosticoOuvidoriaAtual = evento.target.value;
                renderDiagnosticoOuvidoriasView();
            });

            if (dadosPaginaEmModoEstatico('parametrosMinimos')) {
                aplicarModoSomenteLeituraControlada();
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
                aplicarModoSomenteLeituraControlada();
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

            const modoEstatico = dadosPaginaEmModoEstatico('parametrosMinimos');

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
                    <div class="intro-actions" aria-label="Ações">
                        ${renderActionButton({
                            id: 'btnExportarParametrosMinimos',
                            type: 'exportExcel',
                            label: 'Exportar Excel',
                            variant: 'export',
                            backend: true,
                            disabled: modoEstatico
                        })}
                        ${renderActionButton({
                            id: 'btnHistoricoParametrosMinimos',
                            type: 'history',
                            label: 'Histórico',
                            variant: 'admin',
                            backend: true,
                            disabled: modoEstatico
                        })}
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
            aplicarModoSomenteLeituraControlada();
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
                aplicarModoSomenteLeituraControlada();
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
            if (p <= 0.1) return '#94a3b8'; // Slate 400
            if (p < 50) return '#fbbf24'; // Amber 400
            if (p < 100) return '#60a5fa'; // Blue 400
            return '#34d399'; // Emerald 400
        };

        const getProgressGradient = (p) => {
            if (p <= 0.1) return 'linear-gradient(90deg, #64748b 0%, #475569 100%)'; // Cinza metálico
            if (p < 50) return 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)'; // Amarelo/Laranja metálico
            if (p < 100) return 'linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)'; // Azul neon/metálico
            return 'linear-gradient(90deg, #34d399 0%, #059669 100%)'; // Verde neon/metálico
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
            const convenios = resumoInstrumentos.convenios;
            const faf = resumoInstrumentos.faf;
            const doacao = resumoInstrumentos.doacao;
            const totalFomentoOuvidoria = Number(convenios.total || 0) + Number(faf.total || 0) + Number(doacao.total || 0);

            $('#kpi-total-fomento-ouvidoria').text(formatMoney(totalFomentoOuvidoria)).attr('title', formatMoney(totalFomentoOuvidoria));
            $('#kpi-total-contratado').text(formatMoney(global.totalContratado)).attr('title', formatMoney(global.totalContratado));
            $('#kpi-total-executado').text(formatMoney(global.totalExecutado)).attr('title', formatMoney(global.totalExecutado));
            $('#kpi-percentual-global').text(formatPercent(global.percentual));
            $('#kpi-total-doado').text(formatMoney(global.totalDoado)).attr('title', formatMoney(global.totalDoado));

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
                    <td data-label="UF" class="align-middle"><span class="uf-flag-inline">${renderizarBandeiraCardFormalizacao({uf: row.uf})}<span class="badge badge-uf">${safeUf}</span></span></td>
                    <td data-label="Objeto" title="${safeObjeto}" class="align-middle"><span class="truncate-text">${safeObjeto}</span></td>
                    <td data-label="Qtd." class="text-center align-middle">${safeQuantidade}</td>
                    <td data-label="Valor Unit. (R$)" class="text-end font-monospace small align-middle">${formatMoney(row.valorUnitario)}</td>
                    <td data-label="Valor Total (R$)" class="text-end font-monospace align-middle">${formatMoney(vTotal)}</td>
                    <td data-label="Executado (R$)" class="text-end align-middle ${vExec > 0 ? 'text-success fw-bold' : 'text-muted'} font-monospace">
                        ${formatMoney(vExec)}
                    </td>
                    <td data-label="%" class="text-center align-middle" title="${execucaoAcimaPrevisto ? 'Execucao acima do valor previsto' : ''}">
                        <div class="custom-progress-pill">
                            <div class="pill-fill" style="width: ${getProgressWidth(percent)}%; background: ${getProgressGradient(percent)}"></div>
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
            $('#kpi-total-ufs-fomento').text(ufsComAlgumInstrumento.length);

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
window.abrirRevisaoDivergencias = () => toggleView('revisao-divergencias');
window.abrirEditorExecucaoFaf2021 = abrirEditorExecucaoFaf2021;
window.fecharEditorExecucaoFaf2021 = fecharEditorExecucaoFaf2021;
window.salvarExecucaoFaf2021 = salvarExecucaoFaf2021;
window.abrirEditorFormalizacao = abrirEditorFormalizacao;
window.cancelarEdicaoFormalizacao = cancelarEdicaoFormalizacao;
window.salvarAlteracoesFormalizacao = salvarAlteracoesFormalizacao;
window.aplicarFiltroUF = aplicarFiltroUF;


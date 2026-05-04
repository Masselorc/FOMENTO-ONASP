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
    carregarDadosOrcamento,
    obterDadosDoacoes2023,
    obterDadosFaf2021,
    obterDadosFormalizacaoProfor,
    obterDadosProfor2022,
    processarArquivoPlanilhaSelecionado,
    obterDadosOrcamento,
    obterDadosContatos,
    carregarDadosContatos
} from '../../backend/services/data-service.js?v=20260504-1';
import {
    calcularResumoFinanceiro,
    calcularResumoInstrumentos,
    calculateStateMetrics,
    processarDadosAgregados
} from '../../backend/services/analytics.js?v=20260428-2';

// ========================================================================
// 1. CONFIGURACOES E ESTADO
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

// Ordem fixa usada em filtros, exportações e seleção de UFs.
const ORDEM_REGIOES = ["NORTE", "NORDESTE", "CENTRO-OESTE", "SUDESTE", "SUL"];
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
    'formalizacao-detalhe'
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
                : viewName === 'contatos'
                    ? 'contatos'
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
            const logoImg = document.getElementById('img-logo-senappen');
            const urlOficial = 'https://www.gov.br/senappen/pt-br/centrais-de-conteudo/download-logos/senappen-marca-final_prancheta-1-copia-4-1.png/@@images/image';
            
            // Sistema de Cascata: 3 serviços diferentes para garantir o bypass do bloqueio CORS do gerador de PDF
            const proxies = [
                'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(urlOficial),
                'https://corsproxy.io/?' + encodeURIComponent(urlOficial),
                'https://api.allorigins.win/raw?url=' + encodeURIComponent(urlOficial)
            ];

            let sucesso = false;

            for (const proxyUrl of proxies) {
                try {
                    const response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    
                    const blob = await response.blob();
                    
                    // Converte para Base64
                    const base64data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    // Aplica a imagem segura no HTML
                    logoImg.src = base64data;
                    sucesso = true;
                    console.log("Logo convertida para PDF com sucesso via: " + proxyUrl.split('/')[2]);
                    break; // Se funcionou, sai do loop imediatamente
                } catch (error) {
                    console.warn("Serviço de conversão falhou, tentando o próximo...");
                }
            }

            // Fallback de último recurso
            if (!sucesso) {
                console.error("Todos os conversores falharam devido a bloqueios de rede. A logo pode não aparecer no PDF.");
                logoImg.src = urlOficial; 
            }
        }

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

            try {
                catalogoAplicacao = await carregarCatalogoAplicacao();
            } catch (error) {
                console.error('Falha ao carregar a configuracao estatica da aplicacao:', error);
                mostrarAlertaCarregamentoPlanilha(
                    `Os dados estaticos nao puderam ser carregados. ${error.message}`
                );
                return;
            }

            let dadosAplicacaoCarregados = false;

            await carregarDadosOrcamento();

            try {
                dadosFaf = await carregarDadosAplicacao(catalogoAplicacao);
                configurarEstadoDadosValidados(true);
                ocultarAlertaCarregamentoPlanilha();
                dadosAplicacaoCarregados = true;
            } catch (error) {
                console.error('Falha ao carregar convenios da planilha:', error);
                bloquearDadosFinanceiros(error);
            }

            if (dadosAplicacaoCarregados) {
                initDashboard(dadosFaf);
                renderDetailsView();
            }
        });

        // --- CONTROLE DE VISUALIZACAO (SPA) ---
        // Alterna entre as views principais sem recarregar a página. A view de
        // orçamento é carregada sob demanda porque depende de uma planilha extra.
        async function toggleView(viewName) {
            if (viewName === 'orcamento' && !obterDadosOrcamento()) {
                showLoading('Carregando orçamento 2026...');
                try {
                    await carregarDadosOrcamento();
                } finally {
                    hideLoading();
                }
            }

            if (['formalizacao', 'formalizacao-detalhe'].includes(viewName) && !obterDadosFormalizacaoProfor()) {
                showLoading('Carregando formalização PROFOR/ONASP...');
                try {
                    await carregarDadosFormalizacaoProfor();
                } finally {
                    hideLoading();
                }
            }

            if (viewName === 'contatos' && (!obterDadosContatos() || !obterDadosContatos().disponivel)) {
                showLoading('Carregando contatos...');
                try {
                    await carregarDadosContatos();
                } finally {
                    hideLoading();
                }
            }

            const podeAbrirOrcamento = viewName === 'orcamento' && obterDadosOrcamento();
            const podeAbrirContatos = viewName === 'contatos' && obterDadosContatos();
            const podeAbrirFormalizacao = ['formalizacao', 'formalizacao-detalhe'].includes(viewName);
            const podeAbrirComDadosEstaticos = ['faf2021', 'faf2021-detalhe', 'doacoes2023', 'doacoes2023-detalhe'].includes(viewName);

            if (!dadosFinanceirosValidados && viewName !== 'dashboard' && !podeAbrirOrcamento && !podeAbrirContatos && !podeAbrirFormalizacao && !podeAbrirComDadosEstaticos) {
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
            const viewFormalizacaoDetalhe = document.getElementById('view-formalizacao-profor-detalhe');
            if (viewProfor) viewProfor.style.display = 'none';
            if (viewProforDetalhe) viewProforDetalhe.style.display = 'none';
            if (viewFaf) viewFaf.style.display = 'none';
            if (viewFafDetalhe) viewFafDetalhe.style.display = 'none';
            if (viewDoacoes) viewDoacoes.style.display = 'none';
            if (viewDoacoesDetalhe) viewDoacoesDetalhe.style.display = 'none';
            if (viewOrcamento) viewOrcamento.style.display = 'none';
            if (viewFormalizacao) viewFormalizacao.style.display = 'none';
            if (viewContatos) viewContatos.style.display = 'none';
            if (viewFormalizacaoDetalhe) viewFormalizacaoDetalhe.style.display = 'none';

            if (viewName === 'detalhamento') {
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
                renderOrcamentoView();
            } else if (viewName === 'contatos') {
                renderContatosView();
            } else if (viewName === 'formalizacao') {
                renderFormalizacaoProforView();
            } else if (viewName === 'formalizacao-detalhe') {
                renderFormalizacaoProforDetalheView();
            } else {
                document.getElementById('view-dashboard').style.display = 'block';
            }

            atualizarNavegacao(viewName);
            fecharMenuLateral();
            window.scrollTo(0, 0);
        }

        // --- DASHBOARD PRINCIPAL ---
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

        // --- DETALHAMENTO POR ESTADO ---
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

        function atualizarTabelaFaf2021(dados) {
            const tbody = document.getElementById('faf-table-body');
            if (!tbody) return;
            const itensFiltrados = obterItensFiltradosFunpen(dados.itens, 'faf');
            const itensOrdenados = ordenarItensFunpen(itensFiltrados, document.getElementById('filtroFafOrdenacao')?.value || 'alfabetica', 'faf');
            const resumo = calcularResumoItensFunpen(itensFiltrados);
            renderizarResumoFiltroFunpen('faf-selected-summary', resumo, 'faf');

            if (itensOrdenados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Nenhum item FAF 2021 localizado para os filtros selecionados.</td></tr>';
                return;
            }

            tbody.innerHTML = itensOrdenados.map((item) => {
                const saldo = Number(item.saldo) || 0;
                const percentual = Number(item.percentualExecucao) || 0;
                return `
                    <tr class="profor-row" tabindex="0" data-faf-uf="${escapeHtml(item.uf)}">
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
                const row = event.target.closest('[data-faf-uf]');
                if (row) abrirDetalheFaf2021(row.dataset.fafUf);
            });
            tbody?.addEventListener('keydown', (event) => {
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
                                    <th class="text-center">%</th><th>Sinais de gestão</th>
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
                toggleView('faf2021');
                return;
            }
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
                                        <th class="text-center">%</th><th>Sinais</th>
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
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            `;
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

        // --- MÓDULO DE FORMALIZAÇÃO PROFOR/ONASP 2026 ---
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

            return `
                <article class="formalizacao-card ${alertasCriticos ? 'formalizacao-card-risk' : ''}">
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
                    <div class="formalizacao-card-tags">
                        <span class="profor-alert-badge profor-alert-${planoClasse}">${escapeHtml(proposta.situacaoPlano)}</span>
                        ${proposta.condicaoSuspensiva.exige ? `<span class="profor-alert-badge profor-alert-${proposta.condicaoSuspensiva.resolvida ? 'success' : 'danger'}">${escapeHtml(condicao)}</span>` : ''}
                        ${proposta.falaBr.previsto ? '<span class="profor-alert-badge profor-alert-success">Fala.BR previsto</span>' : '<span class="profor-alert-badge profor-alert-danger">Fala.BR pendente</span>'}
                        ${renderizarBadgeOuvidoriaFormalizacao(proposta)}
                    </div>
                    <div class="formalizacao-card-checklists">
                        ${renderizarChecklistCardFormalizacao(proposta, 'projeto', 'Docs do projeto', proposta.documentosProjeto, proposta.progressoDocumentosProjeto)}
                        ${renderizarChecklistCardFormalizacao(proposta, 'formalizacao', 'Docs da formalização', proposta.documentosFormalizacao, proposta.progressoDocumentosFormalizacao)}
                    </div>
                    <button type="button" class="btn btn-outline-primary btn-icon-text formalizacao-open-button" data-formalizacao-uf="${escapeHtml(proposta.uf)}">
                        <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        <span>Abrir UF</span>
                    </button>
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
                    : '<div class="formalizacao-empty-state"><i class="fas fa-search" aria-hidden="true"></i><span>Nenhuma proposta encontrada para os filtros selecionados.</span></div>';
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
                    </tr>
                `;
            }).join('') : `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">Nenhuma proposta encontrada para os filtros selecionados.</td>
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
        }

        function registrarEventosFormalizacao(dados) {
            ['filtroFormalizacaoBusca', 'filtroFormalizacaoUf', 'filtroFormalizacaoRegiao', 'filtroFormalizacaoStatus', 'filtroFormalizacaoOuvidoria', 'filtroFormalizacaoPendencia']
                .forEach((id) => {
                    const elemento = document.getElementById(id);
                    if (!elemento) return;
                    const evento = elemento.tagName === 'INPUT' ? 'input' : 'change';
                    elemento.addEventListener(evento, () => atualizarListaFormalizacao(dados));
                });

            document.getElementById('btnLimparFiltroFormalizacao')?.addEventListener('click', () => {
                ['filtroFormalizacaoBusca', 'filtroFormalizacaoUf', 'filtroFormalizacaoRegiao', 'filtroFormalizacaoStatus', 'filtroFormalizacaoOuvidoria', 'filtroFormalizacaoPendencia']
                    .forEach((id) => {
                        const elemento = document.getElementById(id);
                        if (elemento) elemento.value = '';
                    });
                atualizarListaFormalizacao(dados);
            });
        }

        function renderFormalizacaoProforView() {
            const container = document.getElementById('view-formalizacao-profor');
            if (!container) return;

            container.style.display = 'block';
            const dados = obterDadosFormalizacaoProfor();
            if (!dados) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Dados de formalização indisponíveis. Verifique se o arquivo <strong>Planilhas/Planilha_Formalizacao_PROFOR_2026.xlsx</strong> está disponível e abra a aplicação por servidor local.</div>';
                return;
            }

            const resumo = dados.resumo;
            const opcoesUf = resumo.filtros.ufs.map((uf) => `<option value="${escapeHtml(uf)}">${escapeHtml(uf)}</option>`).join('');
            const opcoesRegiao = ORDEM_REGIOES
                .filter((regiao) => (catalogoAplicacao.regioes?.[regiao] || []).some((uf) => resumo.filtros.ufs.includes(uf)))
                .map((regiao) => `<option value="${escapeHtml(regiao)}">${escapeHtml(regiao)}</option>`)
                .join('');
            const opcoesStatus = resumo.filtros.status.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('');
            const atalhosUf = renderizarAtalhosUfFormalizacao(dados.ufsAutorizadas || resumo.filtros.ufs);

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

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3" aria-label="Indicadores de formalização">
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-file-signature" aria-hidden="true"></i>Propostas</div>
                            <div class="kpi-value">${resumo.totalPropostas}</div>
                            <div class="kpi-desc">UFs contempladas</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-scale-balanced" aria-hidden="true"></i>Valor Global</div>
                            <div class="kpi-value text-money">${formatMoney(resumo.totalValorGlobal)}</div>
                            <div class="kpi-desc">Repasse + contrapartida</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-chart-line" aria-hidden="true"></i>Progresso Médio</div>
                            <div class="kpi-value">${formatPercent(resumo.mediaProgressoGeral)}</div>
                            <div class="kpi-desc">Cálculo ponderado</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card ${resumo.alertasCriticos ? 'kpi-card-warning' : 'kpi-card-success'}">
                            <div class="kpi-title"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>Alertas críticos</div>
                            <div class="kpi-value">${resumo.alertasCriticos}</div>
                            <div class="kpi-desc">${resumo.propostasComAlertaCritico} UF(s) com alerta crítico</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-info">
                            <div class="kpi-title"><i class="fas fa-circle-check" aria-hidden="true"></i>Aptas à celebração</div>
                            <div class="kpi-value">${resumo.aptasCelebracao}</div>
                            <div class="kpi-desc">${resumo.planosCompativeis} plano(s) compatíveis</div>
                        </div>
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
                                </tr>
                            </thead>
                            <tbody id="formalizacao-table-body"></tbody>
                        </table>
                    </div>
                </section>
            `;

            registrarEventosFormalizacao(dados);
            atualizarListaFormalizacao(dados);
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
                        <span class="profor-alert-badge profor-alert-${condicao.resolvida ? 'success' : 'danger'}">${escapeHtml(condicao.situacao)}</span>
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

            const proposta = dados?.propostas.find((item) => item.uf === formalizacaoUfAtual || item.idProposta === formalizacaoUfAtual);
            if (!dados || !proposta) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Proposta de formalização não localizada.</div>';
                container.style.display = 'block';
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
                    <button type="button" class="btn btn-outline-secondary btn-icon-text" onclick="toggleView('formalizacao')">
                        <i class="fas fa-arrow-left" aria-hidden="true"></i>
                        <span>Voltar para Formalização</span>
                    </button>
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
                        <div class="profor-alert-list">${proposta.alertas.length ? proposta.alertas.slice(0, 8).map(renderizarBadgeAlertaFormalizacao).join('') : '<span class="profor-alert-badge profor-alert-success">Sem alerta</span>'}</div>
                    </section>

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
                        ${proposta.observacoes ? `<p class="formalizacao-observation">${escapeHtml(proposta.observacoes)}</p>` : ''}
                    </section>

                    ${renderizarCadastroInstitucionalFormalizacao(proposta)}
                    ${renderizarContatosInstitucionaisFormalizacao(proposta)}
                </div>
            `;
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
                const valorTotal = Number(item.valorTotal) || 0;
                const statusNormalizado = normalizarBusca(item.status);
                resumo.total += valorTotal;
                resumo.quantidade += 1;
                resumo.frentes.add(item.frente);
                resumo.modalidades.add(item.modalidade);
                resumo.status[item.status] = (resumo.status[item.status] || 0) + valorTotal;
                if (statusNormalizado.includes('execucao')) {
                    resumo.empenhado += valorTotal;
                }
                resumo.executado += Number(item.valorExecutado) || 0;
                return resumo;
            }, {
                total: 0,
                quantidade: 0,
                empenhado: 0,
                executado: 0,
                frentes: new Set(),
                modalidades: new Set(),
                status: {}
            });
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
                return '<span class="text-muted">-</span>';
            }

            return `
                <div class="budget-link-list">
                    ${links.map((link) => `
                        <a class="budget-link-button"
                           href="${escapeHtml(link.url)}"
                           target="_blank"
                           rel="noopener noreferrer"
                           title="${escapeHtml(link.titulo)}">
                            <i class="fas ${link.icone}" aria-hidden="true"></i>
                            <span>${escapeHtml(link.rotulo)}</span>
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
                    <td colspan="10" class="budget-tracking-cell">
                        <div class="budget-tracking-panel" aria-label="Rastreio processual de ${escapeHtml(item.descricao)}">
                            <div class="budget-tracking-header">
                                <div>
                                    <span class="budget-tracking-eyebrow">Andamento processual</span>
                                    <strong>${escapeHtml(etapaAtual.rotulo)}</strong>
                                </div>
                                <div class="budget-tracking-status">
                                    <span>Status informado</span>
                                    <strong>${escapeHtml(item.status || 'Não informado')}</strong>
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

        // Recria o corpo da tabela a cada filtro ou expansão. Como o volume é
        // pequeno, isso reduz estado manual e evita inconsistência visual.
        function atualizarTabelaOrcamento(budgetData) {
            const tbody = document.getElementById('budget-table-body');
            if (!tbody) return;

            const itensFiltrados = filtrarItensOrcamento(budgetData);
            const resumoSelecao = calcularResumoItensOrcamento(itensFiltrados);

            const idsFiltrados = new Set(itensFiltrados.map((item) => String(item.id)));
            orcamentoItensRastreioAbertos = new Set(
                Array.from(orcamentoItensRastreioAbertos).filter((itemId) => idsFiltrados.has(itemId))
            );

            document.getElementById('budget-selected-total').textContent = formatMoney(resumoSelecao.total);
            document.getElementById('budget-selected-running').textContent = formatMoney(resumoSelecao.empenhado);
            document.getElementById('budget-selected-executed').textContent = formatMoney(resumoSelecao.executado);

            const grupos = agruparItensOrcamentoPorFrente(itensFiltrados);
            if (!grupos.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="text-center text-muted py-4">
                            Nenhum item orçamentário foi encontrado para os filtros selecionados.
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

                    return `
                    <tr class="budget-item-row ${rastreioAberto ? 'budget-item-row-open' : ''}">
                        <td data-label="Item" class="align-middle">
                            ${podeExibirRastreio ? `
                                <button type="button" class="budget-item-title budget-tracking-toggle" data-budget-item-id="${escapeHtml(itemId)}" aria-expanded="${rastreioAberto}" aria-controls="${escapeHtml(idRastreio)}">
                                    <span>${escapeHtml(item.descricao)}</span>
                                    <i class="fas fa-chevron-down" aria-hidden="true"></i>
                                </button>
                            ` : `<div class="budget-item-title budget-item-title-static">${escapeHtml(item.descricao)}</div>`}
                            ${item.processoSei ? `<div class="budget-item-meta">SEI ${escapeHtml(item.processoSei)}</div>` : ''}
                        </td>
                        <td data-label="Modalidade" class="align-middle">${escapeHtml(item.modalidade)}</td>
                        <td data-label="Natureza" class="align-middle">${escapeHtml(item.natureza)}</td>
                        <td data-label="Abrangência" class="align-middle">${escapeHtml(item.abrangencia)}</td>
                        <td data-label="Qtd." class="text-center align-middle">${escapeHtml(item.quantidade || '-')}</td>
                        <td data-label="Unid." class="text-center align-middle">${escapeHtml(item.unidade || '-')}</td>
                        <td data-label="Valor Unit." class="text-end font-monospace align-middle">${formatMoney(item.valorUnitario)}</td>
                        <td data-label="Valor Total" class="text-end font-monospace align-middle fw-bold text-primary">${formatMoney(item.valorTotal)}</td>
                        <td data-label="Status" class="text-center align-middle">${renderizarStatusOrcamento(item.status)}</td>
                        <td data-label="Links" class="text-center align-middle">${renderizarLinksOrcamento(item)}</td>
                    </tr>
                    ${rastreioAberto ? renderizarRastreioOrcamento(item) : ''}
                `;
                }).join('');

                return `
                    <tr class="budget-group-row">
                        <td colspan="10">
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
                    ${linhas}
                `;
            }).join('');

            registrarEventosRastreioOrcamento(tbody, budgetData);
        }

        function renderOrcamentoView() {
            const container = document.getElementById('view-orcamento');
            if (!container) return;

            container.style.display = 'block';
            container.innerHTML = '';
            orcamentoItensRastreioAbertos = new Set();

            const budgetData = obterDadosOrcamento();
            if (!budgetData) {
                container.innerHTML = '<div class="alert alert-warning m-4"><i class="fas fa-exclamation-triangle me-2"></i> Dados orçamentários não estão disponíveis. Por favor, certifique-se de que o arquivo <strong>Planilhas/orcamento_onasp.xlsx</strong> encontra-se armazenado na aplicação.</div>';
                container.style.display = 'block';
                return;
            }

            const resumo = budgetData.resumo || {};
            const filtros = budgetData.filtros || { status: [], naturezas: [], modalidades: [] };
            const totalEmpenhado = resumo.totalEmpenhado || 0;
            const totalExecutado = resumo.totalExecutado || 0;
            const totalEmExecucao = obterTotalResumoOrcamento(resumo.porStatus, 'Em execução');
            const totalCapital = obterTotalResumoOrcamento(resumo.porNatureza, 'Capital');
            const totalCusteio = obterTotalResumoOrcamento(resumo.porNatureza, 'Custeio');

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

                <div class="budget-report-actions pdf-hidden">
                    <button id="btn-export-budget-pdf" type="button" class="btn btn-danger btn-icon-text" onclick="exportarOrcamentoPDF()">
                        <i class="fas fa-file-pdf" aria-hidden="true"></i>
                        <span>Exportar Relatório PDF</span>
                    </button>
                </div>

                <section class="row mb-4 row-cols-1 row-cols-md-2 row-cols-xl-5 g-3" aria-label="Indicadores orçamentários">
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-wallet" aria-hidden="true"></i>Orçamento Total</div>
                            <div class="kpi-value text-money text-success">${formatMoney(resumo.totalGeral)}</div>
                            <div class="kpi-desc">${resumo.totalItens || 0} item(ns) planejado(s)</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-warning">
                            <div class="kpi-title"><i class="fas fa-hourglass-half" aria-hidden="true"></i>Valor em Execução</div>
                            <div class="kpi-value text-money text-warning">${formatMoney(totalEmExecucao)}</div>
                            <div class="kpi-desc">Em processamento</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-info">
                            <div class="kpi-title"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i>Valor Empenhado</div>
                            <div class="kpi-value text-money text-info">${formatMoney(totalEmpenhado)}</div>
                            <div class="kpi-desc">Itens com empenho registrado</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card kpi-card-success">
                            <div class="kpi-title"><i class="fas fa-check-circle" aria-hidden="true"></i>Valor Executado</div>
                            <div class="kpi-value text-money text-success">${formatMoney(totalExecutado)}</div>
                            <div class="kpi-desc">Já liquidado/pago</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-boxes-stacked" aria-hidden="true"></i>Capital</div>
                            <div class="kpi-value text-money">${formatMoney(totalCapital)}</div>
                            <div class="kpi-desc">Natureza do gasto</div>
                        </div>
                    </div>
                    <div class="col">
                        <div class="card kpi-card">
                            <div class="kpi-title"><i class="fas fa-file-invoice" aria-hidden="true"></i>Custeio</div>
                            <div class="kpi-value text-money">${formatMoney(totalCusteio)}</div>
                            <div class="kpi-desc">Natureza do gasto</div>
                        </div>
                    </div>
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

                <section class="budget-insight-grid mb-4" aria-label="Resumo da seleção orçamentária">
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
                            <div class="kpi-title mb-0">Valor Executado</div>
                            <div class="kpi-value text-money text-success" id="budget-selected-executed">R$ 0,00</div>
                        </div>
                        <i class="fas fa-check-circle card-watermark text-success" aria-hidden="true"></i>
                    </div>
                </section>

                <section class="table-container mb-5">
                    <div class="section-header compact">
                        <div>
                            <p class="section-eyebrow mb-1">Itens orçamentários</p>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover w-100 app-data-table budget-data-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Modalidade</th>
                                    <th>Natureza</th>
                                    <th>Abrangência</th>
                                    <th class="text-center">Qtd.</th>
                                    <th class="text-center">Unid.</th>
                                    <th class="text-end">Valor Unit.</th>
                                    <th class="text-end">Valor Total</th>
                                    <th class="text-center">Status</th>
                                    <th class="text-center">Links</th>
                                </tr>
                            </thead>
                            <tbody id="budget-table-body"></tbody>
                        </table>
                    </div>
                </section>
            `;

            const atualizar = () => atualizarTabelaOrcamento(budgetData);
            document.getElementById('filtroOrcamentoBusca')?.addEventListener('input', atualizar);
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

            atualizar();
            container.style.display = 'block';
        }

        // Exporta o relatório a partir do HTML renderizado. Elementos marcados
        // como pdf-hidden são ocultados por CSS durante a captura.
        async function exportarOrcamentoPDF() {
            let budgetData = obterDadosOrcamento();
            if (!budgetData) {
                showLoading('Carregando orçamento 2026...');
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
                language: { url: "//cdn.datatables.net/plug-ins/1.13.4/i18n/pt-BR.json" },
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
window.abrirSeletorManualPlanilha = abrirSeletorManualPlanilha;
window.abrirOrcamento = () => toggleView('orcamento');
window.abrirFormalizacaoProfor = () => toggleView('formalizacao');
window.aplicarFiltroUF = aplicarFiltroUF;

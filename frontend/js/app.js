import {
    carregarCatalogoAplicacao,
    carregarDadosAplicacao,
    processarArquivoPlanilhaSelecionado
} from '../../backend/services/data-service.js?v=20260428-2';
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
const ORDEM_REGIOES = ["NORTE", "NORDESTE", "CENTRO-OESTE", "SUDESTE", "SUL"];
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

function obterUfsOrdenadasParaExportacao() {
    const ufsPorRegiao = ORDEM_REGIOES.flatMap((regiao) => catalogoAplicacao.regioes?.[regiao] || []);
    const ufsComDados = Array.from(new Set(dadosFaf.map((item) => item.uf).filter(Boolean))).sort();
    const ufsOrdenadas = ufsPorRegiao.length ? ufsPorRegiao : ufsComDados;

    return Array.from(new Set(ufsOrdenadas)).filter((uf) => (
        catalogoAplicacao.nomesEstados?.[uf] || ufsComDados.includes(uf)
    ));
}

function renderizarOpcoesExportacaoUf() {
    const lista = document.getElementById('sidebar-uf-export-list');
    if (!lista) return;

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
}

function abrirSelecaoUfExportacao() {
    const painel = document.getElementById('sidebar-uf-export-panel');
    const botao = document.getElementById('btn-menu-export-state-pdf');
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
    const viewAtiva = viewName === 'estado-detalhe' ? 'detalhamento' : viewName;
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

    const btnExportarRelatorioMenu = document.getElementById('btn-menu-export-state-pdf');
    if (btnExportarRelatorioMenu) {
        const podeExportarRelatorio = dadosFinanceirosValidados;
        btnExportarRelatorioMenu.disabled = !podeExportarRelatorio;
        btnExportarRelatorioMenu.setAttribute('aria-disabled', String(!podeExportarRelatorio));
    }

    const btnExportDashboard = document.getElementById('btn-export-dashboard');
    if (btnExportDashboard) {
        btnExportDashboard.classList.toggle('d-none', viewName !== 'dashboard');
    }

    const btnDetalhamentoHeader = document.querySelector('#header-actions button[onclick="toggleView(\'detalhamento\')"]');
    if (btnDetalhamentoHeader) {
        btnDetalhamentoHeader.classList.toggle('d-none', viewName !== 'dashboard');
    }
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
            const botoesDetalhamento = document.querySelectorAll('button[onclick="toggleView(\'detalhamento\')"], .app-menu-link[data-view="detalhamento"]');

            [btnExportDashboard, ...botoesDetalhamento].forEach((botao) => {
                if (!botao) return;
                botao.disabled = !validado;
                botao.classList.toggle('disabled', !validado);
                botao.setAttribute('aria-disabled', String(!validado));
            });

            atualizarNavegacao(document.body.dataset.currentView || 'dashboard');
            renderizarOpcoesExportacaoUf();

            if (!validado) {
                const painelExportacaoUf = document.getElementById('sidebar-uf-export-panel');
                const btnExportarRelatorioMenu = document.getElementById('btn-menu-export-state-pdf');
                painelExportacaoUf?.classList.add('d-none');
                btnExportarRelatorioMenu?.setAttribute('aria-expanded', 'false');
            }
        }

        function bloquearDadosFinanceiros(error) {
            dadosFaf = [];
            configurarEstadoDadosValidados(false);
            initDashboard(dadosFaf);
            renderDetailsView();
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

            try {
                dadosFaf = await carregarDadosAplicacao(catalogoAplicacao);
                configurarEstadoDadosValidados(true);
                ocultarAlertaCarregamentoPlanilha();
            } catch (error) {
                console.error('Falha ao carregar convenios da planilha:', error);
                bloquearDadosFinanceiros(error);
                return;
            }

            initDashboard(dadosFaf);
            renderDetailsView();
        });

        // --- CONTROLE DE VISUALIZACAO (SPA) ---
        function toggleView(viewName) {
            if (!dadosFinanceirosValidados && viewName !== 'dashboard') {
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

            if (viewName === 'detalhamento') {
                document.getElementById('view-detalhamento').style.display = 'block';
            } else if (viewName === 'estado-detalhe') {
                document.getElementById('view-estado-detalhe').style.display = 'block';
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
            const deveMarcarTodos = checkAll || selecaoAnteriorFicouIndisponivel || valoresSelecionadosValidos.length === sortedValues.length;

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

            sortedValues.forEach((val, idx) => {
                const option = document.createElement('div');
                option.className = 'visible-check-option';
                const safeVal = escapeHtml(val);
                const safeId = escapeHtml(`chk-${key}-${idx}`);
                const checked = deveMarcarTodos || checkedValues.has(val);
                option.innerHTML = `
                    <input class="form-check-input ${config.itemClass}" type="checkbox" value="${safeVal}" id="${safeId}" ${checked ? 'checked' : ''}>
                    <label class="visible-check-label" for="${safeId}">
                        ${safeVal}
                    </label>
                `;
                container.appendChild(option);
            });
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

        function atualizarCardsDinamicos(filtro = obterEstadoFiltroAtual()) {
            const dadosFiltrados = obterDadosFiltrados(filtro);

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
window.abrirSelecaoUfExportacao = abrirSelecaoUfExportacao;
window.exportarRelatorioEstadoSelecionado = exportarRelatorioEstadoSelecionado;
window.exportarDashboardPDF = exportarDashboardPDF;
window.exportarRelatorioPDF = exportarRelatorioPDF;
window.abrirSeletorManualPlanilha = abrirSeletorManualPlanilha;

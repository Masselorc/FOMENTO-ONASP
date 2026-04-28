import {
    carregarCatalogoAplicacao,
    carregarDadosAplicacao,
    processarArquivoPlanilhaSelecionado
} from '../../backend/services/data-service.js';
import {
    calcularResumoFinanceiro,
    calcularResumoInstrumentos,
    calculateStateMetrics,
    processarDadosAgregados
} from '../../backend/services/analytics.js';

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
let catalogoAplicacao = {
    configuracao: {},
    regioes: {},
    nomesEstados: {},
    imagensBandeiras: {},
    infoConvenios: {},
    dadosBase: []
};

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

            logoImg.src = LOGO_SENAPPEN_LOCAL;

            try {
                const response = await fetch(LOGO_SENAPPEN_LOCAL, { cache: 'force-cache' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const blob = await response.blob();
                const base64data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                logoImg.src = base64data;
            } catch (error) {
                console.warn('Nao foi possivel converter o logo local para Base64. Usando arquivo local diretamente.', error);
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
                botao.className = 'btn btn-sm btn-outline-dark';
                botao.textContent = 'Selecionar planilha manualmente';
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
            const btnDetalhamento = document.querySelector('button[onclick="toggleView(\'detalhamento\')"]');

            [btnExportDashboard, btnDetalhamento].forEach((botao) => {
                if (!botao) return;
                botao.disabled = !validado;
                botao.classList.toggle('disabled', !validado);
                botao.setAttribute('aria-disabled', String(!validado));
            });
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
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            carregarLogoLocalParaPDF();

            const inputPlanilha = document.getElementById('input-planilha-convenios');
            if (inputPlanilha) {
                inputPlanilha.addEventListener('change', processarSelecaoManualPlanilha);
            }

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
            
            const headerActions = document.getElementById('header-actions');
            
            if (viewName === 'detalhamento') {
                document.getElementById('view-detalhamento').style.display = 'block';
                if(headerActions) {
                    headerActions.classList.remove('d-flex');
                    headerActions.style.display = 'none';
                }
                window.scrollTo(0,0);
            } else if (viewName === 'estado-detalhe') {
                document.getElementById('view-estado-detalhe').style.display = 'block';
                if(headerActions) {
                    headerActions.classList.remove('d-flex');
                    headerActions.style.display = 'none';
                }
                window.scrollTo(0,0);
            } else {
                document.getElementById('view-dashboard').style.display = 'block';
                if(headerActions) {
                    headerActions.classList.add('d-flex');
                    headerActions.style.display = '';
                }
                window.scrollTo(0,0);
            }
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
            
            populateMultiSelect('filtroInstrumentoOpcoes', 'instrumento', data);
            populateMultiSelect('filtroUFOpcoes', 'uf', data);
            
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

            const ordemRegioes = ["NORTE", "NORDESTE", "CENTRO-OESTE", "SUDESTE", "SUL"];
            const corRegiao = {
                "NORTE": "bg-norte",
                "NORDESTE": "bg-nordeste",
                "CENTRO-OESTE": "bg-centro-oeste",
                "SUDESTE": "bg-sudeste",
                "SUL": "bg-sul"
            };

            ordemRegioes.forEach(regiao => {
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
                        ? `<img src="${safeFlagUrl}" alt="Bandeira ${safeUf}" class="state-flag" onerror="this.onerror=null;this.src='';this.style.display='none';this.nextElementSibling.style.display='inline-block';"> <i class="fas fa-flag text-secondary" style="font-size: 24px; display: none;"></i>`
                        : `<i class="fas fa-flag text-secondary" style="font-size: 24px;"></i>`;

                    const col = document.createElement('div');
                    col.className = 'col-lg-6';

                    col.innerHTML = `
                        <div class="state-detail-card ${bgClass}" style="cursor: pointer;" onclick="abrirDetalheEstado('${safeUf}')">
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
                                <div class="mini-card" style="grid-column: span 2;">
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
                ? `<img src="${safeFlagUrl}" alt="Bandeira ${safeUf}" class="state-flag me-3" style="width: 80px; height: 55px;">`
                : `<i class="fas fa-flag text-secondary me-3" style="font-size: 40px;"></i>`;
            
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
            const itensConv = itensUF.filter(i => normalizarBusca(i.instrumento).includes("convenio"));
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
                                <td>${safeObjeto}</td>
                                <td class="text-center align-middle">${escapeHtml(item.quantidade)}</td>
                                <td class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                                <td class="text-end font-monospace align-middle text-warning fw-bold">${formatMoney(valTotal)}</td>
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
                            <th class="text-center" style="width: 100px;">%</th>
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
                                <td>${safeObjeto}</td>
                                <td class="text-center align-middle">${escapeHtml(item.quantidade)}</td>
                                <td class="text-end font-monospace small align-middle">${formatMoney(item.valorUnitario)}</td>
                                <td class="text-end font-monospace align-middle">${formatMoney(valTotal)}</td>
                                <td class="text-end font-monospace align-middle ${valExec > 0 ? 'text-success fw-bold' : ''}">${formatMoney(valExec)}</td>
                                <td class="text-center align-middle" style="min-width: 90px;" title="${execucaoAcimaPrevisto ? 'Execucao acima do valor previsto' : ''}">
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
                    <div class="text-muted small mb-4 px-2" style="font-style: italic;">
                        <i class="fas fa-asterisk me-1"></i> Os dados foram atualizados até dezembro de 2025 e podem não refletir a execução real, uma vez que ainda se está na janela de submissão dos relatórios de execução atualizados.
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
                            <h6 class="mb-1 fw-bold text-dark" style="font-size: 1.1rem; letter-spacing: -0.5px;">Convênio Nº ${escapeHtml(info.numero)}/${escapeHtml(info.ano)}</h6>
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
            
            // Estado de carregamento visual no botão
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Gerando PDF...';
            btnPdf.disabled = true;

            // Em vez de capturar apenas a div do dashboard, capturamos o wrapper principal inteiro
            const elementoParaCapturar = document.getElementById('main-wrapper');
            const headerActions = document.getElementById('header-actions');
            const filterRow = document.getElementById('filter-row-section');

            // 1. Esconde a linha de botões de filtro e do cabeçalho temporariamente para um PDF mais limpo
            if (headerActions) {
                headerActions.classList.remove('d-flex');
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
                if (headerActions) {
                    headerActions.classList.add('d-flex');
                    headerActions.style.display = '';
                }
                if (filterRow) filterRow.style.display = '';
                if (dtScrollBody) {
                    dtScrollBody.style.maxHeight = originalMaxHeight;
                    dtScrollBody.style.height = originalHeight;
                    dtScrollBody.style.overflow = originalOverflow;
                }
                
                btnPdf.innerHTML = originalHtml;
                btnPdf.disabled = false;
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

            const btnPdf = document.getElementById('btn-export-pdf');
            const originalHtml = btnPdf.innerHTML;
            
            // Estado de carregamento visual no botão
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Gerando PDF...';
            btnPdf.disabled = true;

            // Agora capturamos o wrapper inteiro (incluindo o header global do app)
            const elementoParaCapturar = document.getElementById('main-wrapper');
            const botoesAcaoRelatorio = document.getElementById('botoes-acao-relatorio');

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
                if (botoesAcaoRelatorio) botoesAcaoRelatorio.style.display = '';
                btnPdf.innerHTML = originalHtml;
                btnPdf.disabled = false;
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
            const cores = [
                '#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f1c40f', 
                '#e67e22', '#1abc9c', '#34495e', '#d35400', '#c0392b',
                '#8e44ad', '#2980b9', '#27ae60', '#f39c12', '#7f8c8d'
            ];
            return Array.from({ length: count }, (_, i) => cores[i % cores.length]);
        }

        function getInstrumentoBadge(inst) {
            if (!inst) return '<span class="badge badge-inst-default">N/A</span>';
            
            const normalized = normalizarBusca(inst).toUpperCase();
            const safeInst = escapeHtml(inst);
            if (normalized.includes("FAF")) return `<span class="badge badge-inst-faf" title="${safeInst}">FAF</span>`;
            if (normalized.includes("CONVENIO")) return `<span class="badge badge-inst-convenio" title="${safeInst}">CVN</span>`;
            if (normalized.includes("DOA")) return `<span class="badge badge-inst-doacao" title="${safeInst}">DOA</span>`;
            
            return `<span class="badge badge-inst-default">${escapeHtml(String(inst).substring(0,3))}</span>`;
        }

        function renderUfChips(containerId, ufs) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = ufs.length
                ? ufs.map((uf) => `<span class="uf-chip">${escapeHtml(uf)}</span>`).join('')
                : '<span class="kpi-desc">Nenhuma UF</span>';
            container.setAttribute('title', ufs.length ? ufs.join(', ') : 'Nenhuma UF');
        }

        function renderKPIs(global, ufsList, resumoInstrumentos) {
            $('#kpi-total-contratado').text(formatMoney(global.totalContratado)).attr('title', formatMoney(global.totalContratado));
            $('#kpi-total-executado').text(formatMoney(global.totalExecutado)).attr('title', formatMoney(global.totalExecutado));
            $('#kpi-percentual-global').text(formatPercent(global.percentual));
            $('#kpi-total-doado').text(formatMoney(global.totalDoado)).attr('title', formatMoney(global.totalDoado));
            $('#kpi-ufs-ativas').text(global.ufsComExecucao);
            $('#kpi-ufs-total-desc').text(`de ${ufsList.length} UFs listadas`);

            const convenios = resumoInstrumentos.convenios;
            const faf = resumoInstrumentos.faf;

            $('#kpi-total-convenios').text(formatMoney(convenios.total)).attr('title', formatMoney(convenios.total));
            $('#kpi-percentual-convenios').text(formatPercent(convenios.percentual));
            $('#kpi-desc-convenios').text(`Executado: ${formatMoney(convenios.executado)}`);
            $('#kpi-ufs-convenios-qtd').text(convenios.quantidadeUfs);
            renderUfChips('kpi-ufs-convenios-lista', convenios.ufs);

            $('#kpi-total-faf').text(formatMoney(faf.total)).attr('title', formatMoney(faf.total));
            $('#kpi-percentual-faf').text(formatPercent(faf.percentual));
            $('#kpi-desc-faf').text(`Executado: ${formatMoney(faf.executado)}`);
            $('#kpi-ufs-faf-qtd').text(faf.quantidadeUfs);
            renderUfChips('kpi-ufs-faf-lista', faf.ufs);
        }

        function renderChart(dadosPorUF) {
            const ctx = document.getElementById('chartExecucaoUF').getContext('2d');
            const labels = dadosPorUF.map(d => d.uf);
            const dataValues = dadosPorUF.map(d => d.percentual);
            const bgColors = gerarCoresVariadas(dadosPorUF.length);
            const maxPercentual = Math.max(100, ...dataValues);
            const maxEscala = Math.ceil(maxPercentual / 10) * 10;

            chartInstancia = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '% Execução',
                        data: dataValues,
                        backgroundColor: bgColors,
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
                                    const item = dadosPorUF[ctx.dataIndex];
                                    return `Exec: ${formatPercent(item.percentual)} (${formatMoney(item.exec)})`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, max: maxEscala, ticks: { callback: v => v + '%' } },
                        y: { grid: { display: false } }
                    },
                    onClick: (e, els) => {
                        if (els.length > 0) aplicarFiltroUF(labels[els[0].index]);
                    },
                    onHover: (e, els) => {
                        e.native.target.style.cursor = els[0] ? 'pointer' : 'default';
                    }
                }
            });
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
                    <td class="text-center align-middle"><span class="d-none">${safeInstrumento}</span>${getInstrumentoBadge(row.instrumento)}</td>
                    <td class="align-middle"><span class="badge bg-secondary badge-uf">${safeUf}</span></td>
                    <td title="${safeObjeto}" class="align-middle"><span class="truncate-text">${safeObjeto}</span></td>
                    <td class="text-center align-middle">${safeQuantidade}</td>
                    <td class="text-end font-monospace small align-middle">${formatMoney(row.valorUnitario)}</td>
                    <td class="text-end font-monospace align-middle">${formatMoney(vTotal)}</td>
                    <td class="text-end align-middle ${vExec > 0 ? 'text-success fw-bold' : 'text-muted'} font-monospace">
                        ${formatMoney(vExec)}
                    </td>
                    <td class="text-center align-middle" title="${execucaoAcimaPrevisto ? 'Execucao acima do valor previsto' : ''}">
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
                paging: false, 
                scrollY: '500px', 
                scrollCollapse: true,
                info: false, 
                order: [[1, 'asc'], [7, 'desc']], 
                columnDefs: [
                    { width: '5%', targets: 0 }, 
                    { width: '5%', targets: 1 }, 
                    { width: '30%', targets: 2 } 
                ]
            });
        }

        // --- LÓGICA MULTI-SELECT ---

        function populateMultiSelect(containerId, key, data) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            const uniqueValues = new Set();
            data.forEach(item => { if(item[key]) uniqueValues.add(item[key]); });
            const sortedValues = Array.from(uniqueValues).sort();

            const allOption = document.createElement('div');
            allOption.className = 'visible-check-option check-all-option';
            allOption.innerHTML = `
                <input class="form-check-input check-all" type="checkbox" value="all" id="checkAll-${key}" checked>
                <label class="visible-check-label fw-bold" for="checkAll-${key}">
                    Todos
                </label>
            `;
            container.appendChild(allOption);

            sortedValues.forEach((val, idx) => {
                const option = document.createElement('div');
                option.className = 'visible-check-option';
                const safeVal = escapeHtml(val);
                const safeId = escapeHtml(`chk-${key}-${idx}`);
                option.innerHTML = `
                    <input class="form-check-input check-item-${key}" type="checkbox" value="${safeVal}" id="${safeId}" checked>
                    <label class="visible-check-label" for="${safeId}">
                        ${safeVal}
                    </label>
                `;
                container.appendChild(option);
            });
        }

        function obterEstadoFiltroAtual() {
            const checkAllInst = document.getElementById('checkAll-instrumento')?.checked ?? true;
            const checkAllUF = document.getElementById('checkAll-uf')?.checked ?? true;

            return {
                texto: $('#filtroObjeto').val() || '',
                textoNormalizado: normalizarBusca($('#filtroObjeto').val()),
                checkAllInst,
                checkedInsts: new Set(Array.from(document.querySelectorAll('.check-item-instrumento:checked')).map(cb => cb.value)),
                checkAllUF,
                checkedUFs: new Set(Array.from(document.querySelectorAll('.check-item-uf:checked')).map(cb => cb.value))
            };
        }

        function itemPassaFiltros(item, filtro) {
            const matchUF = filtro.checkAllUF || filtro.checkedUFs.has(item.uf);
            const matchInst = filtro.checkAllInst || filtro.checkedInsts.has(item.instrumento);
            const matchTexto = filtro.textoNormalizado
                ? normalizarBusca(item.objeto).includes(filtro.textoNormalizado)
                : true;

            return matchUF && matchInst && matchTexto;
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

            ['instrumento', 'uf'].forEach(key => {
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
            const filtro = obterEstadoFiltroAtual();
            filtroTabelaAtual = filtro;
            
            if (tabelaInstancia) {
                tabelaInstancia.search('').columns().search('').draw();
            }

            const anyFilterActive = !filtro.checkAllInst || !filtro.checkAllUF || filtro.textoNormalizado.length > 0;
            
            if (anyFilterActive) {
                $('#textoFiltroAtivo').text("Filtros Ativos");
                $('#filtroAtivoBadge').css('display', 'inline-block');
            } else {
                $('#filtroAtivoBadge').hide();
            }

            atualizarCardsDinamicos(filtro);
        }
        
        function aplicarFiltroUF(uf) {
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
window.exportarDashboardPDF = exportarDashboardPDF;
window.exportarRelatorioPDF = exportarRelatorioPDF;

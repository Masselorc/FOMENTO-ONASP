const JSON_APLICACAO_URL = new URL('../data/aplicacao.json', import.meta.url);
const ABA_RESUMO_CONVENIOS = 'Geral';
const ARQUIVO_PLANILHA_ORCAMENTO = 'banco_dados_orcamentario_onasp.xlsx';
const ABA_ORCAMENTO_DADOS = 'Base_Dados';
const ABAS_ORCAMENTO_IGNORADAS = new Set(['DICIONARIO_CAMPOS', 'RESUMO']);
const COLUNA_VALOR_OUVIDORIA_GERAL = 18; // Coluna S
const TOLERANCIA_VALIDACAO_CENTAVOS = 1;
const COLUNAS_CONVENIO = {
    uf: 0,
    classificacao: 4,
    objeto: 6,
    quantidade: 7,
    valorUnitario: 8,
    valorTotal: 9,
    valorExecutado: 10
};

let catalogoAplicacaoCache = null;
let dadosOrcamentoCache = null;

export function obterDadosOrcamento() {
    return dadosOrcamentoCache;
}

function obterXlsxGlobal() {
    if (typeof window.XLSX === 'undefined') {
        throw new Error('A biblioteca de leitura da planilha nao foi carregada.');
    }

    return window.XLSX;
}

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function limparTexto(valor) {
    return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function converterNumeroPlanilha(valor) {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    if (typeof valor !== 'string') {
        return 0;
    }

    const texto = valor.trim();
    if (!texto) {
        return 0;
    }

    const numeroNormalizado = texto
        .replace(/\s+/g, '')
        .replace(/^R\$/i, '')
        .replace(/%$/, '');

    if (numeroNormalizado.includes(',') && numeroNormalizado.includes('.')) {
        return Number.parseFloat(numeroNormalizado.replace(/\./g, '').replace(',', '.')) || 0;
    }

    if (numeroNormalizado.includes(',')) {
        return Number.parseFloat(numeroNormalizado.replace(',', '.')) || 0;
    }

    return Number.parseFloat(numeroNormalizado) || 0;
}

function arredondarMoeda(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function moedaParaCentavos(valor) {
    return Math.round((Number(valor) || 0) * 100);
}

function centavosParaMoeda(centavos) {
    return centavos / 100;
}

function formatarMoedaMensagem(centavos) {
    return centavosParaMoeda(centavos).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function obterLinhasPlanilha(sheet) {
    const xlsx = obterXlsxGlobal();
    return xlsx.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false
    });
}

function obterIndiceColuna(headers, regras) {
    return headers.findIndex((header) => (
        regras.some((regra) => (
            regra.tipo === 'igual'
                ? header === regra.valor
                : header.includes(regra.valor)
        ))
    ));
}

function obterIndiceColunaComTodos(headers, conjuntosTermos, termosIgnorados = []) {
    const conjuntos = Array.isArray(conjuntosTermos[0]) ? conjuntosTermos : [conjuntosTermos];
    return headers.findIndex((header) => (
        !termosIgnorados.some((termo) => header.includes(termo))
            && conjuntos.some((termos) => termos.every((termo) => header.includes(termo)))
    ));
}

function obterTextoCelula(linha, indice, fallback = '-') {
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return fallback;
    }

    const texto = limparTexto(linha[indice]);
    return texto || fallback;
}

function formatarDataPtBr(data, usarUtc = false) {
    const dia = usarUtc ? data.getUTCDate() : data.getDate();
    const mes = usarUtc ? data.getUTCMonth() + 1 : data.getMonth() + 1;
    const ano = usarUtc ? data.getUTCFullYear() : data.getFullYear();
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarDataPlanilha(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return '';
    }

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return formatarDataPtBr(valor);
    }

    if (typeof valor === 'number' && Number.isFinite(valor)) {
        if (valor <= 0) return '';
        const xlsx = typeof window !== 'undefined' ? window.XLSX : null;
        const dataFormatada = xlsx?.SSF?.format?.('dd/mm/yyyy', valor);
        if (dataFormatada) return limparTexto(dataFormatada);

        const data = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000));
        return formatarDataPtBr(data, true);
    }

    const texto = limparTexto(valor);
    const textoNumerico = texto.replace(',', '.');
    if (/^\d+([.,]\d+)?$/.test(texto) && Number(textoNumerico) > 20000 && Number(textoNumerico) < 80000) {
        return formatarDataPlanilha(Number(textoNumerico));
    }

    return texto;
}

function obterDataCelula(linha, indice) {
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return '';
    }

    return formatarDataPlanilha(linha[indice]);
}

function incrementarResumoOrcamento(resumo, chave, item) {
    const nome = item[chave] && item[chave] !== '-' ? item[chave] : 'Não informado';
    const resumoItem = resumo[nome] || { nome, itens: 0, total: 0 };
    resumoItem.itens += 1;
    resumoItem.total = arredondarMoeda(resumoItem.total + item.valorTotal);
    resumo[nome] = resumoItem;
}

function ordenarResumoOrcamento(resumo) {
    return Object.values(resumo).sort((a, b) => (
        b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')
    ));
}

function montarResumoOrcamento(itens) {
    const porStatus = {};
    const porNatureza = {};
    const porModalidade = {};
    const porFrente = {};
    
    let totalEmpenhado = 0;
    let totalExecutado = 0;

    itens.forEach((item) => {
        incrementarResumoOrcamento(porStatus, 'status', item);
        incrementarResumoOrcamento(porNatureza, 'natureza', item);
        incrementarResumoOrcamento(porModalidade, 'modalidade', item);
        incrementarResumoOrcamento(porFrente, 'frente', item);
        
        // Soma itens que possuem empenho
        if (item.empenho) {
            totalEmpenhado += item.valorTotal;
        }
        
        // Soma valores já executados
        totalExecutado += item.valorExecutado || 0;
    });

    return {
        totalGeral: arredondarMoeda(itens.reduce((total, item) => total + item.valorTotal, 0)),
        totalItens: itens.length,
        totalEmpenhado: arredondarMoeda(totalEmpenhado),
        totalExecutado: arredondarMoeda(totalExecutado),
        porStatus: ordenarResumoOrcamento(porStatus),
        porNatureza: ordenarResumoOrcamento(porNatureza),
        porModalidade: ordenarResumoOrcamento(porModalidade),
        porFrente: ordenarResumoOrcamento(porFrente)
    };
}

function obterValoresUnicosOrcamento(itens, chave) {
    return Array.from(new Set(
        itens
            .map((item) => item[chave])
            .filter((valor) => valor && valor !== '-')
    )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function extrairItensConvenioDaAba(sheet, uf, configuracao) {
    const linhas = obterLinhasPlanilha(sheet);
    const ufEsperada = normalizarTexto(uf);
    const classificacaoEsperada = normalizarTexto(configuracao.classificacaoPlanilhaConvenios);

    return linhas
        .map((linha) => {
            const ufLinha = normalizarTexto(linha[COLUNAS_CONVENIO.uf]);
            const classificacao = normalizarTexto(linha[COLUNAS_CONVENIO.classificacao]);
            const objeto = limparTexto(linha[COLUNAS_CONVENIO.objeto]);

            if (ufLinha !== ufEsperada || classificacao !== classificacaoEsperada || !objeto) {
                return null;
            }

            return {
                uf: ufEsperada,
                objeto,
                quantidade: converterNumeroPlanilha(linha[COLUNAS_CONVENIO.quantidade]),
                valorUnitario: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorUnitario])),
                valorTotal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorTotal])),
                valorExecutado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_CONVENIO.valorExecutado])),
                instrumento: 'Convênio'
            };
        })
        .filter(Boolean);
}

function somarConveniosExtraidosPorUf(dadosConvenio) {
    return dadosConvenio.reduce((totais, item) => {
        const uf = normalizarTexto(item.uf);
        const acumulado = totais.get(uf) || 0;
        totais.set(uf, acumulado + moedaParaCentavos(item.valorTotal));
        return totais;
    }, new Map());
}

function extrairTotaisOuvidoriaDaAbaGeral(workbook, catalogoAplicacao) {
    const sheet = workbook.Sheets[ABA_RESUMO_CONVENIOS];
    if (!sheet) {
        throw new Error(`A aba ${ABA_RESUMO_CONVENIOS} nao foi encontrada na planilha.`);
    }

    const linhas = obterLinhasPlanilha(sheet);
    const totais = new Map();

    linhas.slice(1).forEach((linha) => {
        const uf = normalizarTexto(linha[0]);
        const instrumento = normalizarTexto(linha[1]);

        if (!uf || !catalogoAplicacao.nomesEstados[uf] || !instrumento.includes('CONV')) {
            return;
        }

        const valorOuvidoria = arredondarMoeda(
            converterNumeroPlanilha(linha[COLUNA_VALOR_OUVIDORIA_GERAL])
        );
        totais.set(uf, (totais.get(uf) || 0) + moedaParaCentavos(valorOuvidoria));
    });

    return totais;
}

function validarConveniosContraAbaGeral(workbook, dadosConvenio, catalogoAplicacao) {
    const totaisExtraidos = somarConveniosExtraidosPorUf(dadosConvenio);
    const totaisGeral = extrairTotaisOuvidoriaDaAbaGeral(workbook, catalogoAplicacao);
    const ufs = new Set([...totaisGeral.keys(), ...totaisExtraidos.keys()]);
    const divergencias = [];

    ufs.forEach((uf) => {
        const totalExtraido = totaisExtraidos.get(uf) || 0;
        const totalGeral = totaisGeral.get(uf) || 0;
        const diferenca = totalExtraido - totalGeral;

        if (Math.abs(diferenca) > TOLERANCIA_VALIDACAO_CENTAVOS) {
            divergencias.push(
                `${uf}: extraido ${formatarMoedaMensagem(totalExtraido)}, Geral ${formatarMoedaMensagem(totalGeral)}`
            );
        }
    });

    if (divergencias.length > 0) {
        throw new Error(
            `A soma dos convenios extraidos diverge da coluna S da aba Geral. ${divergencias.join('; ')}.`
        );
    }
}

function extrairConveniosDoWorkbook(workbook, catalogoAplicacao) {
    const { configuracao, nomesEstados } = catalogoAplicacao;
    const abasDeEstado = workbook.SheetNames.filter((sheetName) => (
        nomesEstados[sheetName] && !configuracao.abasPlanilhaIgnoradas.includes(sheetName)
    ));

    const dadosConvenio = abasDeEstado.flatMap((sheetName) => (
        extrairItensConvenioDaAba(workbook.Sheets[sheetName], sheetName, configuracao)
    ));

    if (dadosConvenio.length === 0) {
        throw new Error('Nenhum item classificado como OUVIDORIA foi encontrado na planilha.');
    }

    validarConveniosContraAbaGeral(workbook, dadosConvenio, catalogoAplicacao);

    return dadosConvenio;
}

function montarDadosComConvenios(catalogoAplicacao, dadosConvenio) {
    return [...catalogoAplicacao.dadosBase, ...dadosConvenio];
}

async function lerWorkbookDeArrayBuffer(arrayBuffer) {
    const xlsx = obterXlsxGlobal();
    return xlsx.read(arrayBuffer, { type: 'array', raw: true });
}

async function carregarConveniosDaPlanilha(catalogoAplicacao) {
    if (window.location.protocol === 'file:') {
        throw new Error('Abra a aplicacao por um servidor local ou selecione a planilha manualmente.');
    }

    const planilhaUrl = new URL(`../../${catalogoAplicacao.configuracao.arquivoPlanilhaConvenios}`, import.meta.url);
    const resposta = await fetch(planilhaUrl, { cache: 'no-store' });

    if (!resposta.ok) {
        throw new Error(`Nao foi possivel carregar a planilha de convenios (${resposta.status}).`);
    }

    const workbook = await lerWorkbookDeArrayBuffer(await resposta.arrayBuffer());
    return extrairConveniosDoWorkbook(workbook, catalogoAplicacao);
}

async function carregarPlanilhaOrcamento() {
    try {
        if (dadosOrcamentoCache) {
            return dadosOrcamentoCache;
        }

        const planilhaUrl = new URL(`../../${ARQUIVO_PLANILHA_ORCAMENTO}`, import.meta.url);
        console.log('[Orçamento] URL da planilha:', planilhaUrl.href);
        
        const resposta = await fetch(planilhaUrl, { cache: 'no-store' });
        
        if (!resposta.ok) {
            throw new Error(
                `Planilha orçamentária não encontrada. URL tentada: ${planilhaUrl.href}. Status HTTP: ${resposta.status}.`
            );
        }
        
        const arrayBuffer = await resposta.arrayBuffer();
        const workbook = await lerWorkbookDeArrayBuffer(arrayBuffer);

        const nomeAbaOrcamento = workbook.SheetNames.find((sheetName) => (
            normalizarTexto(sheetName) === normalizarTexto(ABA_ORCAMENTO_DADOS)
        )) || workbook.SheetNames.find((sheetName) => (
            !ABAS_ORCAMENTO_IGNORADAS.has(normalizarTexto(sheetName))
        ));

        if (!nomeAbaOrcamento) {
            throw new Error(`A aba ${ABA_ORCAMENTO_DADOS} nao foi encontrada na planilha de orcamento.`);
        }

        const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAbaOrcamento]);
        if (linhas.length < 2) {
            throw new Error(`A aba ${nomeAbaOrcamento} nao contem linhas de dados.`);
        }

        const headerRowIndex = linhas.findIndex((linha) => {
            const rowText = (linha || []).map((celula) => normalizarTexto(celula)).join(' ');
            return rowText.includes('FRENTE') && rowText.includes('VALOR TOTAL');
        });

        if (headerRowIndex === -1) {
            throw new Error(`Nao foi possivel identificar o cabecalho da aba ${nomeAbaOrcamento}.`);
        }

        const headers = (linhas[headerRowIndex] || []).map((header) => normalizarTexto(header));
        const colId = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ID' }]);
        const colFrente = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'FRENTE' }]);
        const colDescricao = obterIndiceColuna(headers, [
            { tipo: 'igual', valor: 'ITENS' },
            { tipo: 'igual', valor: 'ITEM' },
            { tipo: 'inclui', valor: 'DESCRI' },
            { tipo: 'inclui', valor: 'OBJETO' }
        ]);
        const colNatureza = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'NATUREZA' }]);
        const colModalidade = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'MODALIDADE' }]);
        const colAbrangencia = obterIndiceColuna(headers, [
            { tipo: 'inclui', valor: 'ABRANGENCIA' },
            { tipo: 'igual', valor: 'UF' }
        ]);
        const colQuantidade = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'QUANTIDADE' }]);
        const colUnidade = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'UNIDADE' }]);
        const colValorTotal = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'VALOR TOTAL' }]);
        const colValorUnitario = obterIndiceColuna(headers, [{ tipo: 'inclui', valor: 'VALOR UNITARIO' }]);
        const colValorExecutado = obterIndiceColuna(headers, [
            { tipo: 'inclui', valor: 'VALOR EXECUTADO' },
            { tipo: 'inclui', valor: 'EXECUTADO' },
            { tipo: 'inclui', valor: 'PAGO' }
        ]);
        const colStatus = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'STATUS' }]);
        const colProcessoSei = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'PROCESSO SEI' }]);
        const colLinkProcessoSei = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK DO PROCESSO SEI' }]);
        const colDataProcessoSei = obterIndiceColunaComTodos(headers, ['DATA', 'PROCESSO', 'SEI']);
        const colProforAutuacao = obterIndiceColunaComTodos(headers, ['AUTUACAO'], ['DATA', 'LINK']);
        const colLinkProforAutuacao = obterIndiceColunaComTodos(headers, ['LINK', 'AUTUACAO']);
        const colDataProforAutuacao = obterIndiceColunaComTodos(headers, ['DATA', 'AUTUACAO']);
        const colProforParecerTecnico = obterIndiceColunaComTodos(headers, ['PARECER', 'TECNICO'], ['DATA', 'LINK']);
        const colLinkProforParecerTecnico = obterIndiceColunaComTodos(headers, ['LINK', 'PARECER', 'TECNICO']);
        const colDataProforParecerTecnico = obterIndiceColunaComTodos(headers, ['DATA', 'PARECER', 'TECNICO']);
        const colProforMinutaEdital = obterIndiceColunaComTodos(headers, ['MINUTA', 'EDITAL'], ['DATA', 'LINK']);
        const colLinkProforMinutaEdital = obterIndiceColunaComTodos(headers, ['LINK', 'MINUTA', 'EDITAL']);
        const colDataProforMinutaEdital = obterIndiceColunaComTodos(headers, ['DATA', 'MINUTA', 'EDITAL']);
        const colProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['DDO'],
            ['CGOF']
        ], ['DATA', 'LINK']);
        const colLinkProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['LINK', 'DDO'],
            ['LINK', 'CGOF']
        ]);
        const colDataProforDdoCgof = obterIndiceColunaComTodos(headers, [
            ['DATA', 'DDO'],
            ['DATA', 'CGOF']
        ]);
        const colProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['ABERTURA', 'PROGRAMA'],
            ['CGGIR']
        ], ['DATA', 'LINK']);
        const colLinkProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['LINK', 'ABERTURA', 'PROGRAMA'],
            ['LINK', 'CGGIR']
        ]);
        const colDataProforAberturaPrograma = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ABERTURA', 'PROGRAMA'],
            ['DATA', 'CGGIR']
        ]);
        const colProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['PARECER', 'CONJUR'],
            ['CONJUR']
        ], ['DATA', 'LINK']);
        const colLinkProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PARECER', 'CONJUR'],
            ['LINK', 'CONJUR']
        ]);
        const colDataProforParecerConjur = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PARECER', 'CONJUR'],
            ['DATA', 'CONJUR']
        ]);
        const colProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['PUBLICACAO'],
            ['GABSEC']
        ], ['DATA', 'LINK']);
        const colLinkProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PUBLICACAO'],
            ['LINK', 'GABSEC']
        ]);
        const colDataProforPublicacaoGabsec = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PUBLICACAO'],
            ['DATA', 'GABSEC']
        ]);
        const colDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['DEMANDA'],
            ['DFD'],
            ['FORMALIZACAO', 'DEMANDA']
        ], ['DATA', 'LINK']);
        const colLinkDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['LINK', 'DEMANDA'],
            ['LINK', 'DFD']
        ]);
        const colDataDemandaFormalizada = obterIndiceColunaComTodos(headers, [
            ['DATA', 'DEMANDA'],
            ['DATA', 'DFD']
        ]);
        const colEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['ETP'],
            ['ESTUDO', 'TECNICO'],
            ['ESPECIFICACAO']
        ], ['DATA', 'LINK']);
        const colLinkEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['LINK', 'ETP'],
            ['LINK', 'ESTUDO', 'TECNICO'],
            ['LINK', 'ESPECIFICACAO']
        ]);
        const colDataEstudoTecnico = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ETP'],
            ['DATA', 'ESTUDO', 'TECNICO'],
            ['DATA', 'ESPECIFICACAO']
        ]);
        const colTermoReferencia = obterIndiceColunaComTodos(headers, ['TERMO', 'REFERENCIA'], ['DATA', 'LINK']);
        const colLinkTermoReferencia = obterIndiceColunaComTodos(headers, ['LINK', 'TERMO', 'REFERENCIA']);
        const colDataTermoReferencia = obterIndiceColunaComTodos(headers, ['DATA', 'TERMO', 'REFERENCIA']);
        const colPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['PESQUISA', 'PRECO'],
            ['MAPA', 'PRECO'],
            ['ORCAMENTO', 'ESTIMADO']
        ], ['DATA', 'LINK']);
        const colLinkPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['LINK', 'PESQUISA', 'PRECO'],
            ['LINK', 'MAPA', 'PRECO'],
            ['LINK', 'ORCAMENTO', 'ESTIMADO']
        ]);
        const colDataPesquisaPrecos = obterIndiceColunaComTodos(headers, [
            ['DATA', 'PESQUISA', 'PRECO'],
            ['DATA', 'MAPA', 'PRECO'],
            ['DATA', 'ORCAMENTO', 'ESTIMADO']
        ]);
        const colAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['AUTORIZ'],
            ['APROVACAO'],
            ['APROVADO']
        ], ['DATA', 'LINK']);
        const colLinkAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['LINK', 'AUTORIZ'],
            ['LINK', 'APROVACAO'],
            ['LINK', 'APROVADO']
        ]);
        const colDataAutorizacaoAutoridade = obterIndiceColunaComTodos(headers, [
            ['DATA', 'AUTORIZ'],
            ['DATA', 'APROVACAO'],
            ['DATA', 'APROVADO']
        ]);
        const colParecerJuridico = obterIndiceColunaComTodos(headers, [
            ['PARECER', 'JURIDICO'],
            ['PARECER', 'CONJUR'],
            ['PARECER']
        ], ['DATA', 'LINK', 'TECNICO']);
        const colLinkParecerJuridico = obterIndiceColunaComTodos(headers, ['LINK', 'PARECER']);
        const colDataParecerJuridico = obterIndiceColunaComTodos(headers, ['DATA', 'PARECER']);
        const colEmpenho = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'EMPENHO' }]);
        const colLinkEmpenho = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK DO EMPENHO' }]);
        const colDataEmpenho = obterIndiceColunaComTodos(headers, ['DATA', 'EMPENHO']);
        const colContrato = obterIndiceColunaComTodos(headers, ['CONTRAT'], ['DATA', 'LINK']);
        const colLinkContrato = obterIndiceColunaComTodos(headers, ['LINK', 'CONTRAT']);
        const colDataContratacao = obterIndiceColunaComTodos(headers, ['DATA', 'CONTRAT']);
        const colOrdemServico = obterIndiceColunaComTodos(headers, ['ORDEM', 'SERVICO'], ['DATA', 'LINK']);
        const colLinkOrdemServico = obterIndiceColunaComTodos(headers, ['LINK', 'ORDEM', 'SERVICO']);
        const colDataOrdemServico = obterIndiceColunaComTodos(headers, ['DATA', 'ORDEM', 'SERVICO']);
        const colDataEntrega = obterIndiceColunaComTodos(headers, ['DATA', 'ENTREG']);
        const colOrdemBancaria = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ORDEM BANCARIA' }]);
        const colLinkOrdemBancaria = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'LINK ORDEM BANCARIA' }]);
        const colDataOrdemBancaria = obterIndiceColunaComTodos(headers, [
            ['DATA', 'ORDEM', 'BANCARIA'],
            ['DATA', 'OB']
        ]);

        if (colFrente < 0 || colDescricao < 0 || colValorTotal < 0) {
            throw new Error('A planilha de orcamento precisa conter as colunas Frente, Itens e Valor Total (R$).');
        }

        const itens = linhas.slice(headerRowIndex + 1).map((linha, index) => {
            const descricao = obterTextoCelula(linha, colDescricao, '');
            const valorTotal = arredondarMoeda(converterNumeroPlanilha(linha[colValorTotal]));

            if (!descricao || normalizarTexto(descricao).includes('TOTAL') || valorTotal <= 0) {
                return null;
            }

            const quantidade = obterTextoCelula(linha, colQuantidade, '');
            const valorUnitarioInformado = converterNumeroPlanilha(linha[colValorUnitario]);

            return {
                id: obterTextoCelula(linha, colId, `${nomeAbaOrcamento}-${index + 1}`),
                frente: obterTextoCelula(linha, colFrente, 'Não informado'),
                descricao,
                natureza: obterTextoCelula(linha, colNatureza),
                modalidade: obterTextoCelula(linha, colModalidade),
                abrangencia: obterTextoCelula(linha, colAbrangencia),
                quantidade,
                unidade: obterTextoCelula(linha, colUnidade),
                valorTotal,
                valorUnitario: arredondarMoeda(valorUnitarioInformado),
                valorExecutado: arredondarMoeda(converterNumeroPlanilha(linha[colValorExecutado])),
                status: obterTextoCelula(linha, colStatus, 'Não informado'),
                processoSei: obterTextoCelula(linha, colProcessoSei, ''),
                linkProcessoSei: obterTextoCelula(linha, colLinkProcessoSei, ''),
                dataProcessoSei: obterDataCelula(linha, colDataProcessoSei),
                proforAutuacao: obterTextoCelula(linha, colProforAutuacao, ''),
                linkProforAutuacao: obterTextoCelula(linha, colLinkProforAutuacao, ''),
                dataProforAutuacao: obterDataCelula(linha, colDataProforAutuacao),
                proforParecerTecnico: obterTextoCelula(linha, colProforParecerTecnico, ''),
                linkProforParecerTecnico: obterTextoCelula(linha, colLinkProforParecerTecnico, ''),
                dataProforParecerTecnico: obterDataCelula(linha, colDataProforParecerTecnico),
                proforMinutaEdital: obterTextoCelula(linha, colProforMinutaEdital, ''),
                linkProforMinutaEdital: obterTextoCelula(linha, colLinkProforMinutaEdital, ''),
                dataProforMinutaEdital: obterDataCelula(linha, colDataProforMinutaEdital),
                proforDdoCgof: obterTextoCelula(linha, colProforDdoCgof, ''),
                linkProforDdoCgof: obterTextoCelula(linha, colLinkProforDdoCgof, ''),
                dataProforDdoCgof: obterDataCelula(linha, colDataProforDdoCgof),
                proforAberturaPrograma: obterTextoCelula(linha, colProforAberturaPrograma, ''),
                linkProforAberturaPrograma: obterTextoCelula(linha, colLinkProforAberturaPrograma, ''),
                dataProforAberturaPrograma: obterDataCelula(linha, colDataProforAberturaPrograma),
                proforParecerConjur: obterTextoCelula(linha, colProforParecerConjur, ''),
                linkProforParecerConjur: obterTextoCelula(linha, colLinkProforParecerConjur, ''),
                dataProforParecerConjur: obterDataCelula(linha, colDataProforParecerConjur),
                proforPublicacaoGabsec: obterTextoCelula(linha, colProforPublicacaoGabsec, ''),
                linkProforPublicacaoGabsec: obterTextoCelula(linha, colLinkProforPublicacaoGabsec, ''),
                dataProforPublicacaoGabsec: obterDataCelula(linha, colDataProforPublicacaoGabsec),
                demandaFormalizada: obterTextoCelula(linha, colDemandaFormalizada, ''),
                linkDemandaFormalizada: obterTextoCelula(linha, colLinkDemandaFormalizada, ''),
                dataDemandaFormalizada: obterDataCelula(linha, colDataDemandaFormalizada),
                estudoTecnico: obterTextoCelula(linha, colEstudoTecnico, ''),
                linkEstudoTecnico: obterTextoCelula(linha, colLinkEstudoTecnico, ''),
                dataEstudoTecnico: obterDataCelula(linha, colDataEstudoTecnico),
                termoReferencia: obterTextoCelula(linha, colTermoReferencia, ''),
                linkTermoReferencia: obterTextoCelula(linha, colLinkTermoReferencia, ''),
                dataTermoReferencia: obterDataCelula(linha, colDataTermoReferencia),
                pesquisaPrecos: obterTextoCelula(linha, colPesquisaPrecos, ''),
                linkPesquisaPrecos: obterTextoCelula(linha, colLinkPesquisaPrecos, ''),
                dataPesquisaPrecos: obterDataCelula(linha, colDataPesquisaPrecos),
                autorizacaoAutoridade: obterTextoCelula(linha, colAutorizacaoAutoridade, ''),
                linkAutorizacaoAutoridade: obterTextoCelula(linha, colLinkAutorizacaoAutoridade, ''),
                dataAutorizacaoAutoridade: obterDataCelula(linha, colDataAutorizacaoAutoridade),
                parecerJuridico: obterTextoCelula(linha, colParecerJuridico, ''),
                linkParecerJuridico: obterTextoCelula(linha, colLinkParecerJuridico, ''),
                dataParecerJuridico: obterDataCelula(linha, colDataParecerJuridico),
                empenho: obterTextoCelula(linha, colEmpenho, ''),
                linkEmpenho: obterTextoCelula(linha, colLinkEmpenho, ''),
                dataEmpenho: obterDataCelula(linha, colDataEmpenho),
                contrato: obterTextoCelula(linha, colContrato, ''),
                linkContrato: obterTextoCelula(linha, colLinkContrato, ''),
                dataContratacao: obterDataCelula(linha, colDataContratacao),
                ordemServico: obterTextoCelula(linha, colOrdemServico, ''),
                linkOrdemServico: obterTextoCelula(linha, colLinkOrdemServico, ''),
                dataOrdemServico: obterDataCelula(linha, colDataOrdemServico),
                dataEntrega: obterDataCelula(linha, colDataEntrega),
                ordemBancaria: obterTextoCelula(linha, colOrdemBancaria, ''),
                linkOrdemBancaria: obterTextoCelula(linha, colLinkOrdemBancaria, ''),
                dataOrdemBancaria: obterDataCelula(linha, colDataOrdemBancaria)
            };
        }).filter(Boolean);

        dadosOrcamentoCache = {
            arquivo: ARQUIVO_PLANILHA_ORCAMENTO,
            aba: nomeAbaOrcamento,
            itens,
            resumo: montarResumoOrcamento(itens),
            filtros: {
                frentes: obterValoresUnicosOrcamento(itens, 'frente'),
                status: obterValoresUnicosOrcamento(itens, 'status'),
                naturezas: obterValoresUnicosOrcamento(itens, 'natureza'),
                modalidades: obterValoresUnicosOrcamento(itens, 'modalidade')
            }
        };

        return dadosOrcamentoCache;
    } catch (error) {
        dadosOrcamentoCache = null;
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_ORCAMENTO}:`, error);
        return null;
    }
}

export async function carregarDadosOrcamento() {
    return carregarPlanilhaOrcamento();
}

export async function carregarCatalogoAplicacao() {
    if (catalogoAplicacaoCache) {
        return catalogoAplicacaoCache;
    }

    const resposta = await fetch(JSON_APLICACAO_URL, { cache: 'no-store' });
    if (!resposta.ok) {
        throw new Error(`Nao foi possivel carregar os dados estaticos da aplicacao (${resposta.status}).`);
    }

    catalogoAplicacaoCache = await resposta.json();
    return catalogoAplicacaoCache;
}

export async function carregarDadosAplicacao(catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const dadosConvenio = await carregarConveniosDaPlanilha(catalogo);
    console.log(`Convenios carregados da planilha: ${dadosConvenio.length} itens.`);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}

export async function processarArquivoPlanilhaSelecionado(arquivoSelecionado, catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const workbook = await lerWorkbookDeArrayBuffer(await arquivoSelecionado.arrayBuffer());
    const dadosConvenio = extrairConveniosDoWorkbook(workbook, catalogo);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}

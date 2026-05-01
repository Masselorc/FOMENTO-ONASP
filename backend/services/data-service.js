// ============================================================================
// Serviço de dados
// ----------------------------------------------------------------------------
// Este módulo é a fronteira entre os arquivos de dados (JSON e planilhas XLSX)
// e o restante da aplicação. A UI não deve conhecer detalhes como nomes de abas,
// posições de colunas ou regras de validação; ela consome os objetos já
// normalizados exportados daqui.
// ============================================================================

const JSON_APLICACAO_URL = new URL('../data/aplicacao.json', import.meta.url);
const ABA_RESUMO_CONVENIOS = 'Geral';
const ARQUIVO_PLANILHA_ORCAMENTO = 'Planilhas/orcamento_onasp.xlsx';
const ABA_ORCAMENTO_DADOS = 'Base_Dados';
const ABA_ORCAMENTO_PROCESSOS_NORMAIS = 'Processos_Normais';
const ABA_ORCAMENTO_PROFOR = 'Andamento_CONV_PROFOR';
const ABAS_ORCAMENTO_IGNORADAS = new Set(['DICIONARIO_CAMPOS', 'RESUMO']);
const COLUNA_VALOR_OUVIDORIA_GERAL = 18; // Coluna S
const TOLERANCIA_VALIDACAO_CENTAVOS = 1;
const COLUNAS_GERAL_PROFOR = {
    uf: 0,
    instrumento: 1,
    numero: 2,
    ano: 3,
    processoSei: 4,
    vencimento: 5,
    quantidadeTa: 6,
    solicitouProrrogacao: 7,
    valorGlobal: 8,
    valorRepasse: 9,
    valorContrapartida: 10,
    repasseDesembolsado: 11,
    rendimentoAprovado: 12,
    saldoRendimentosAtual: 13,
    saldoResidualCapital: 14,
    saldoResidualCusteio: 15,
    contrapartidaIntegralizada: 16,
    valorExecutadoGeral: 17,
    previstoOuvidoria: 18,
    previstoCorregedoria: 19,
    previstoEscolaPenal: 20,
    valorRelativoOuvidoria: 21,
    execucaoOuvidoriaPercentual: 22,
    execucaoCorregedoriaPercentual: 23,
    execucaoEscolaPenalPercentual: 24,
    saldoDisponivelOuvidoria: 25
};
const COLUNAS_PLANO_PROFOR = {
    uf: 0,
    instrumento: 1,
    numero: 2,
    ano: 3,
    area: 4,
    natureza: 5,
    descricao: 6,
    quantidade: 7,
    valorUnitario: 8,
    valorPrevisto: 9,
    valorExecutado: 10,
    saldo: 11,
    saldoEconomicidade: 12
};
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
let dadosProfor2022Cache = null;
let dadosFaf2021Cache = null;
let dadosDoacoes2023Cache = null;

export function obterDadosOrcamento() {
    return dadosOrcamentoCache;
}

export function obterDadosProfor2022() {
    return dadosProfor2022Cache;
}

export function obterDadosFaf2021() {
    return dadosFaf2021Cache;
}

export function obterDadosDoacoes2023() {
    return dadosDoacoes2023Cache;
}

// A biblioteca XLSX é carregada pelo index.html. Mantemos esta guarda para
// falhar cedo caso alguém remova o script CDN ou tente abrir a página sem ele.
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

function obterNomeEstadoCatalogo(catalogoAplicacao, uf) {
    return catalogoAplicacao?.nomesEstados?.[uf] || uf || '';
}

function normalizarItemBaseFomento(item, catalogoAplicacao) {
    const valorTotal = arredondarMoeda(converterNumeroPlanilha(item.valorTotal));
    const valorExecutado = arredondarMoeda(converterNumeroPlanilha(item.valorExecutado));
    const uf = normalizarTexto(item.uf);

    return {
        uf,
        nomeEstado: obterNomeEstadoCatalogo(catalogoAplicacao, uf),
        instrumento: limparTexto(item.instrumento),
        objeto: limparTexto(item.objeto),
        quantidade: converterNumeroPlanilha(item.quantidade),
        valorUnitario: arredondarMoeda(converterNumeroPlanilha(item.valorUnitario)),
        valorTotal,
        valorExecutado,
        saldo: arredondarMoeda(valorTotal - valorExecutado),
        percentualExecucao: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0
    };
}

function montarResumoItensFomento(itens) {
    const totalCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorTotal), 0);
    const executadoCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorExecutado), 0);
    const ufs = Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
        totalItens: itens.length,
        totalUfs: ufs.length,
        ufs,
        valorTotal: centavosParaMoeda(totalCentavos),
        valorExecutado: centavosParaMoeda(executadoCentavos),
        saldo: centavosParaMoeda(totalCentavos - executadoCentavos),
        percentualExecucao: totalCentavos > 0 ? (executadoCentavos / totalCentavos) * 100 : 0
    };
}

function montarDadosFaf2021(catalogoAplicacao) {
    const itens = (catalogoAplicacao?.dadosBase || [])
        .filter((item) => normalizarTexto(item.instrumento) === 'FAF 2021')
        .map((item) => normalizarItemBaseFomento(item, catalogoAplicacao));

    return {
        resumo: montarResumoItensFomento(itens),
        itens,
        filtros: {
            ufs: Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
}

function montarDadosDoacoes2023(catalogoAplicacao) {
    const itens = (catalogoAplicacao?.dadosBase || [])
        .filter((item) => normalizarTexto(item.instrumento).includes('DOA'))
        .map((item) => normalizarItemBaseFomento(item, catalogoAplicacao));
    const resumoBase = montarResumoItensFomento(itens);
    const valorMedioPorUf = resumoBase.totalUfs > 0 ? resumoBase.valorTotal / resumoBase.totalUfs : 0;
    const totaisPorUf = itens.reduce((acc, item) => {
        acc[item.uf] = (acc[item.uf] || 0) + (Number(item.valorTotal) || 0);
        return acc;
    }, {});
    const [ufMaiorConcentracao = '', valorMaiorConcentracao = 0] = Object.entries(totaisPorUf)
        .sort((a, b) => b[1] - a[1])[0] || [];

    return {
        resumo: {
            ...resumoBase,
            valorMedioPorUf: arredondarMoeda(valorMedioPorUf),
            ufMaiorConcentracao,
            nomeUfMaiorConcentracao: obterNomeEstadoCatalogo(catalogoAplicacao, ufMaiorConcentracao),
            valorMaiorConcentracao: arredondarMoeda(valorMaiorConcentracao)
        },
        itens,
        filtros: {
            ufs: Array.from(new Set(itens.map((item) => item.uf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
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

// Localiza colunas por termos normalizados, aceitando pequenas variações de
// cabeçalho. Ex.: "Link DDO (CGOF)" e "Link CGOF" podem alimentar o mesmo campo.
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

        // Datas do Excel podem chegar como número serial quando a planilha é
        // lida com raw:true. A origem 1899-12-30 é o padrão de compatibilidade.
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

function obterNomeAbaWorkbook(workbook, nomes) {
    const nomesNormalizados = nomes.map((nome) => normalizarTexto(nome));
    return workbook.SheetNames.find((sheetName) => nomesNormalizados.includes(normalizarTexto(sheetName)));
}

// Monta um mapa { ID -> campos normalizados } a partir de uma aba de andamento.
// A Base_Dados guarda valores financeiros; as abas auxiliares guardam etapas,
// datas e links. O ID é o vínculo entre esses dois mundos.
function montarMapaCamposPorId(workbook, nomesAba, campos) {
    const nomeAba = obterNomeAbaWorkbook(workbook, nomesAba);
    const mapa = new Map();

    if (!nomeAba) {
        return mapa;
    }

    const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAba]);
    const headerRowIndex = linhas.findIndex((linha) => (
        (linha || []).some((celula) => normalizarTexto(celula) === 'ID')
    ));

    if (headerRowIndex === -1) {
        console.warn(`A aba ${nomeAba} nao possui coluna ID e foi ignorada no rastreio orcamentario.`);
        return mapa;
    }

    const headers = (linhas[headerRowIndex] || []).map((header) => normalizarTexto(header));
    const colId = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'ID' }]);
    const indices = Object.entries(campos).map(([propriedade, config]) => ({
        propriedade,
        data: Boolean(config.data),
        indice: obterIndiceColunaComTodos(headers, config.regras, config.ignorar || [])
    }));

    linhas.slice(headerRowIndex + 1).forEach((linha) => {
        const id = obterTextoCelula(linha, colId, '');
        if (!id) return;

        const dados = {};
        indices.forEach(({ propriedade, data, indice }) => {
            const valor = data ? obterDataCelula(linha, indice) : obterTextoCelula(linha, indice, '');
            if (valor && valor !== '-') {
                dados[propriedade] = valor;
            }
        });

        mapa.set(id, {
            ...(mapa.get(id) || {}),
            ...dados
        });
    });

    return mapa;
}

// Fluxo padrão de contratação/aquisição. Cada propriedade retornada aqui é
// consumida pelo rastreio visual em frontend/js/app.js.
function montarMapaRastreioProcessosNormais(workbook) {
    return montarMapaCamposPorId(workbook, [ABA_ORCAMENTO_PROCESSOS_NORMAIS], {
        status: { regras: ['STATUS'] },
        processoSei: { regras: ['PROCESSO', 'SEI'], ignorar: ['DATA', 'LINK'] },
        linkProcessoSei: { regras: ['LINK', 'PROCESSO', 'SEI'] },
        dataProcessoSei: { regras: ['DATA', 'PROCESSO', 'SEI'], data: true },
        demandaFormalizada: { regras: [['DEMANDA'], ['DFD'], ['FORMALIZACAO', 'DEMANDA']], ignorar: ['DATA', 'LINK'] },
        linkDemandaFormalizada: { regras: [['LINK', 'DEMANDA'], ['LINK', 'DFD']] },
        dataDemandaFormalizada: { regras: [['DATA', 'DEMANDA'], ['DATA', 'DFD']], data: true },
        estudoTecnico: { regras: [['ETP'], ['ESTUDO', 'TECNICO'], ['ESPECIFICACAO']], ignorar: ['DATA', 'LINK'] },
        linkEstudoTecnico: { regras: [['LINK', 'ETP'], ['LINK', 'ESTUDO', 'TECNICO'], ['LINK', 'ESPECIFICACAO']] },
        dataEstudoTecnico: { regras: [['DATA', 'ETP'], ['DATA', 'ESTUDO', 'TECNICO'], ['DATA', 'ESPECIFICACAO']], data: true },
        termoReferencia: { regras: ['TERMO', 'REFERENCIA'], ignorar: ['DATA', 'LINK'] },
        linkTermoReferencia: { regras: ['LINK', 'TERMO', 'REFERENCIA'] },
        dataTermoReferencia: { regras: ['DATA', 'TERMO', 'REFERENCIA'], data: true },
        pesquisaPrecos: { regras: [['PESQUISA', 'PRECO'], ['MAPA', 'PRECO'], ['ORCAMENTO', 'ESTIMADO']], ignorar: ['DATA', 'LINK'] },
        linkPesquisaPrecos: { regras: [['LINK', 'PESQUISA', 'PRECO'], ['LINK', 'MAPA', 'PRECO'], ['LINK', 'ORCAMENTO', 'ESTIMADO']] },
        dataPesquisaPrecos: { regras: [['DATA', 'PESQUISA', 'PRECO'], ['DATA', 'MAPA', 'PRECO'], ['DATA', 'ORCAMENTO', 'ESTIMADO']], data: true },
        autorizacaoAutoridade: { regras: [['AUTORIZ'], ['APROVACAO'], ['APROVADO']], ignorar: ['DATA', 'LINK'] },
        linkAutorizacaoAutoridade: { regras: [['LINK', 'AUTORIZ'], ['LINK', 'APROVACAO'], ['LINK', 'APROVADO']] },
        dataAutorizacaoAutoridade: { regras: [['DATA', 'AUTORIZ'], ['DATA', 'APROVACAO'], ['DATA', 'APROVADO']], data: true },
        parecerJuridico: { regras: [['PARECER', 'JURIDICO'], ['PARECER']], ignorar: ['DATA', 'LINK', 'TECNICO'] },
        linkParecerJuridico: { regras: ['LINK', 'PARECER'] },
        dataParecerJuridico: { regras: ['DATA', 'PARECER'], data: true },
        empenho: { regras: ['EMPENHO'], ignorar: ['DATA', 'LINK'] },
        linkEmpenho: { regras: ['LINK', 'EMPENHO'] },
        dataEmpenho: { regras: ['DATA', 'EMPENHO'], data: true },
        contrato: { regras: ['CONTRAT'], ignorar: ['DATA', 'LINK'] },
        linkContrato: { regras: ['LINK', 'CONTRAT'] },
        dataContratacao: { regras: ['DATA', 'CONTRAT'], data: true },
        ordemServico: { regras: ['ORDEM', 'SERVICO'], ignorar: ['DATA', 'LINK'] },
        linkOrdemServico: { regras: ['LINK', 'ORDEM', 'SERVICO'] },
        dataOrdemServico: { regras: ['DATA', 'ORDEM', 'SERVICO'], data: true },
        dataEntrega: { regras: ['DATA', 'ENTREG'], data: true },
        ordemBancaria: { regras: ['ORDEM', 'BANCARIA'], ignorar: ['DATA', 'LINK'] },
        linkOrdemBancaria: { regras: ['LINK', 'ORDEM', 'BANCARIA'] },
        dataOrdemBancaria: { regras: [['DATA', 'ORDEM', 'BANCARIA'], ['DATA', 'OB']], data: true }
    });
}

// Fluxo exclusivo do item CONV-001 / PROFOR. Ele não segue o fluxo normal de
// contratação, por isso fica isolado em uma aba e em campos próprios.
function montarMapaRastreioProfor(workbook) {
    return montarMapaCamposPorId(workbook, [ABA_ORCAMENTO_PROFOR], {
        status: { regras: ['STATUS'] },
        processoSei: { regras: ['PROCESSO', 'SEI'], ignorar: ['DATA', 'LINK'] },
        linkProcessoSei: { regras: ['LINK', 'PROCESSO', 'SEI'] },
        dataProcessoSei: { regras: ['DATA', 'PROCESSO', 'SEI'], data: true },
        proforAutuacao: { regras: ['AUTUACAO'], ignorar: ['DATA', 'LINK'] },
        linkProforAutuacao: { regras: ['LINK', 'AUTUACAO'] },
        dataProforAutuacao: { regras: ['DATA', 'AUTUACAO'], data: true },
        proforParecerTecnico: { regras: ['PARECER', 'TECNICO'], ignorar: ['DATA', 'LINK'] },
        linkProforParecerTecnico: { regras: ['LINK', 'PARECER', 'TECNICO'] },
        dataProforParecerTecnico: { regras: ['DATA', 'PARECER', 'TECNICO'], data: true },
        proforMinutaEdital: { regras: ['MINUTA', 'EDITAL'], ignorar: ['DATA', 'LINK'] },
        linkProforMinutaEdital: { regras: ['LINK', 'MINUTA', 'EDITAL'] },
        dataProforMinutaEdital: { regras: ['DATA', 'MINUTA', 'EDITAL'], data: true },
        proforDdoCgof: { regras: [['DDO'], ['CGOF']], ignorar: ['DATA', 'LINK'] },
        linkProforDdoCgof: { regras: [['LINK', 'DDO'], ['LINK', 'CGOF']] },
        dataProforDdoCgof: { regras: [['DATA', 'DDO'], ['DATA', 'CGOF']], data: true },
        proforAberturaPrograma: { regras: [['ABERTURA', 'PROGRAMA'], ['CGGIR']], ignorar: ['DATA', 'LINK'] },
        linkProforAberturaPrograma: { regras: [['LINK', 'ABERTURA', 'PROGRAMA'], ['LINK', 'CGGIR']] },
        dataProforAberturaPrograma: { regras: [['DATA', 'ABERTURA', 'PROGRAMA'], ['DATA', 'CGGIR']], data: true },
        proforParecerConjur: { regras: [['PARECER', 'CONJUR'], ['CONJUR']], ignorar: ['DATA', 'LINK'] },
        linkProforParecerConjur: { regras: [['LINK', 'PARECER', 'CONJUR'], ['LINK', 'CONJUR']] },
        dataProforParecerConjur: { regras: [['DATA', 'PARECER', 'CONJUR'], ['DATA', 'CONJUR']], data: true },
        proforPublicacaoGabsec: { regras: [['PUBLICACAO'], ['GABSEC']], ignorar: ['DATA', 'LINK'] },
        linkProforPublicacaoGabsec: { regras: [['LINK', 'PUBLICACAO'], ['LINK', 'GABSEC']] },
        dataProforPublicacaoGabsec: { regras: [['DATA', 'PUBLICACAO'], ['DATA', 'GABSEC']], data: true }
    });
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

function converterPercentualPlanilha(valor) {
    const numero = converterNumeroPlanilha(valor);
    return Math.abs(numero) <= 1.5 ? numero * 100 : numero;
}

function somarCampoMoeda(itens, campo) {
    const totalCentavos = itens.reduce((total, item) => (
        total + moedaParaCentavos(item[campo])
    ), 0);

    return centavosParaMoeda(totalCentavos);
}

function extrairPlanoAplicacaoProforDaAba(sheet, uf) {
    if (!sheet) {
        return [];
    }

    const linhas = obterLinhasPlanilha(sheet);
    const ufEsperada = normalizarTexto(uf);

    return linhas.slice(1).map((linha) => {
        const ufLinha = normalizarTexto(linha[COLUNAS_PLANO_PROFOR.uf]);
        const descricao = limparTexto(linha[COLUNAS_PLANO_PROFOR.descricao]);

        if (ufLinha !== ufEsperada || !descricao) {
            return null;
        }

        const valorPrevisto = arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorPrevisto]));
        const valorExecutado = arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorExecutado]));

        return {
            uf: ufEsperada,
            instrumento: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.instrumento, ''),
            numero: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.numero, ''),
            ano: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.ano, ''),
            area: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.area, 'Não informado'),
            natureza: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.natureza, 'Não informado'),
            descricao,
            quantidade: converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.quantidade]),
            valorUnitario: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.valorUnitario])),
            valorPrevisto,
            valorExecutado,
            saldo: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.saldo])),
            saldoEconomicidade: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_PLANO_PROFOR.saldoEconomicidade])),
            percentualExecucao: valorPrevisto > 0 ? (valorExecutado / valorPrevisto) * 100 : 0
        };
    }).filter(Boolean);
}

function resumirPlanoAplicacaoProfor(planoAplicacao) {
    const itensOuvidoria = planoAplicacao.filter((item) => (
        normalizarTexto(item.area) === 'OUVIDORIA'
    ));

    return {
        totalItens: planoAplicacao.length,
        totalItensOuvidoria: itensOuvidoria.length,
        valorPrevistoOuvidoriaPlano: somarCampoMoeda(itensOuvidoria, 'valorPrevisto'),
        valorExecutadoOuvidoria: somarCampoMoeda(itensOuvidoria, 'valorExecutado'),
        previstoCapitalOuvidoria: somarCampoMoeda(
            itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === 'CAPITAL'),
            'valorPrevisto'
        ),
        previstoCusteioOuvidoria: somarCampoMoeda(
            itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === 'CUSTEIO'),
            'valorPrevisto'
        )
    };
}

function montarResumoProfor2022(convenios) {
    const totalPrevistoOuvidoriaCentavos = convenios.reduce((total, convenio) => (
        total + moedaParaCentavos(convenio.previstoOuvidoria)
    ), 0);
    const totalExecutadoOuvidoriaCentavos = convenios.reduce((total, convenio) => (
        total + moedaParaCentavos(convenio.valorExecutadoOuvidoria)
    ), 0);

    return {
        totalConvenios: convenios.length,
        valorGlobal: somarCampoMoeda(convenios, 'valorGlobal'),
        valorRepasse: somarCampoMoeda(convenios, 'valorRepasse'),
        valorContrapartida: somarCampoMoeda(convenios, 'valorContrapartida'),
        repasseDesembolsado: somarCampoMoeda(convenios, 'repasseDesembolsado'),
        rendimentoAprovado: somarCampoMoeda(convenios, 'rendimentoAprovado'),
        saldoRendimentosAtual: somarCampoMoeda(convenios, 'saldoRendimentosAtual'),
        saldoResidualCapital: somarCampoMoeda(convenios, 'saldoResidualCapital'),
        saldoResidualCusteio: somarCampoMoeda(convenios, 'saldoResidualCusteio'),
        contrapartidaIntegralizada: somarCampoMoeda(convenios, 'contrapartidaIntegralizada'),
        valorExecutadoGeral: somarCampoMoeda(convenios, 'valorExecutadoGeral'),
        previstoOuvidoria: centavosParaMoeda(totalPrevistoOuvidoriaCentavos),
        previstoCorregedoria: somarCampoMoeda(convenios, 'previstoCorregedoria'),
        previstoEscolaPenal: somarCampoMoeda(convenios, 'previstoEscolaPenal'),
        valorExecutadoOuvidoria: centavosParaMoeda(totalExecutadoOuvidoriaCentavos),
        execucaoGeralPercentual: somarCampoMoeda(convenios, 'valorGlobal') > 0
            ? (somarCampoMoeda(convenios, 'valorExecutadoGeral') / somarCampoMoeda(convenios, 'valorGlobal')) * 100
            : 0,
        execucaoOuvidoriaPercentual: totalPrevistoOuvidoriaCentavos > 0
            ? (totalExecutadoOuvidoriaCentavos / totalPrevistoOuvidoriaCentavos) * 100
            : 0,
        saldoDisponivelOuvidoria: somarCampoMoeda(convenios, 'saldoDisponivelOuvidoria')
    };
}

function extrairProfor2022DoWorkbook(workbook, catalogoAplicacao) {
    const sheetGeral = workbook.Sheets[ABA_RESUMO_CONVENIOS];
    if (!sheetGeral) {
        throw new Error(`A aba ${ABA_RESUMO_CONVENIOS} nao foi encontrada na planilha.`);
    }

    const linhas = obterLinhasPlanilha(sheetGeral);
    const convenios = linhas.slice(1).map((linha) => {
        const uf = normalizarTexto(linha[COLUNAS_GERAL_PROFOR.uf]);
        const instrumento = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.instrumento, '');
        const ano = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.ano, '');

        if (!uf || !catalogoAplicacao.nomesEstados[uf] || !normalizarTexto(instrumento).includes('CONV') || ano !== '2022') {
            return null;
        }

        const planoAplicacao = extrairPlanoAplicacaoProforDaAba(workbook.Sheets[uf], uf);
        const resumoPlano = resumirPlanoAplicacaoProfor(planoAplicacao);

        return {
            uf,
            instrumento,
            numero: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.numero, ''),
            ano,
            processoSei: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.processoSei, ''),
            vencimento: obterDataCelula(linha, COLUNAS_GERAL_PROFOR.vencimento),
            quantidadeTa: converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.quantidadeTa]),
            solicitouProrrogacao: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.solicitouProrrogacao, ''),
            valorGlobal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorGlobal])),
            valorRepasse: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorRepasse])),
            valorContrapartida: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorContrapartida])),
            repasseDesembolsado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.repasseDesembolsado])),
            rendimentoAprovado: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.rendimentoAprovado])),
            saldoRendimentosAtual: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoRendimentosAtual])),
            saldoResidualCapital: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoResidualCapital])),
            saldoResidualCusteio: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoResidualCusteio])),
            contrapartidaIntegralizada: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.contrapartidaIntegralizada])),
            valorExecutadoGeral: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.valorExecutadoGeral])),
            previstoOuvidoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoOuvidoria])),
            previstoCorregedoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoCorregedoria])),
            previstoEscolaPenal: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.previstoEscolaPenal])),
            valorRelativoOuvidoria: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.valorRelativoOuvidoria]),
            execucaoOuvidoriaPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoOuvidoriaPercentual]),
            execucaoCorregedoriaPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoCorregedoriaPercentual]),
            execucaoEscolaPenalPercentual: converterPercentualPlanilha(linha[COLUNAS_GERAL_PROFOR.execucaoEscolaPenalPercentual]),
            saldoDisponivelOuvidoria: arredondarMoeda(converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.saldoDisponivelOuvidoria])),
            valorExecutadoOuvidoria: resumoPlano.valorExecutadoOuvidoria,
            valorPrevistoOuvidoriaPlano: resumoPlano.valorPrevistoOuvidoriaPlano,
            previstoCapitalOuvidoria: resumoPlano.previstoCapitalOuvidoria,
            previstoCusteioOuvidoria: resumoPlano.previstoCusteioOuvidoria,
            totalItensPlano: resumoPlano.totalItens,
            totalItensOuvidoria: resumoPlano.totalItensOuvidoria,
            planoAplicacao
        };
    }).filter(Boolean);

    if (convenios.length === 0) {
        throw new Error('Nenhum convenio PROFOR 2022 foi encontrado na aba Geral.');
    }

    return {
        resumo: montarResumoProfor2022(convenios),
        convenios,
        filtros: {
            ufs: convenios.map((convenio) => convenio.uf).sort(),
            areas: Array.from(new Set(
                convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.area))
            )).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
            naturezas: Array.from(new Set(
                convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.natureza))
            )).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
    };
}

// Extrai somente itens de convênio classificados como OUVIDORIA nas abas de UF.
// A planilha de gestão financeira é ampla; esta aplicação mostra o recorte da
// Ouvidoria, por isso a classificação é uma regra de negócio importante.
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

// Lê todas as abas estaduais válidas e valida os totais contra a aba "Geral".
// Isso evita exibir um painel aparentemente correto com dados parciais.
function extrairConveniosDoWorkbook(workbook, catalogoAplicacao) {
    const { configuracao, nomesEstados } = catalogoAplicacao;
    const abasIgnoradas = new Set([
        ABA_RESUMO_CONVENIOS,
        'IND_PRORROG',
        ...(configuracao.abasPlanilhaIgnoradas || [])
    ].map((nomeAba) => normalizarTexto(nomeAba)));
    const abasDeEstado = workbook.SheetNames.filter((sheetName) => (
        nomesEstados[normalizarTexto(sheetName)] && !abasIgnoradas.has(normalizarTexto(sheetName))
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

function extrairDadosFinanceirosDoWorkbook(workbook, catalogoAplicacao) {
    dadosProfor2022Cache = null;
    const dadosConvenio = extrairConveniosDoWorkbook(workbook, catalogoAplicacao);
    dadosProfor2022Cache = extrairProfor2022DoWorkbook(workbook, catalogoAplicacao);
    return dadosConvenio;
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
    return extrairDadosFinanceirosDoWorkbook(workbook, catalogoAplicacao);
}

// Carrega o banco orçamentário 2026. A estrutura esperada é:
// - Base_Dados: cadastro financeiro dos itens;
// - Processos_Normais: andamento dos itens comuns;
// - Andamento_CONV_PROFOR: andamento especial do PROFOR.
// As abas de andamento são mescladas à base pelo campo ID.
async function carregarPlanilhaOrcamento() {
    try {
        if (dadosOrcamentoCache) {
            return dadosOrcamentoCache;
        }

        const planilhaUrl = new URL(`../../${ARQUIVO_PLANILHA_ORCAMENTO}`, import.meta.url);
        const resposta = await fetch(planilhaUrl, { cache: 'no-store' });
        
        if (!resposta.ok) {
            throw new Error(
                `Planilha orçamentária não encontrada. URL tentada: ${planilhaUrl.href}. Status HTTP: ${resposta.status}.`
            );
        }
        
        const arrayBuffer = await resposta.arrayBuffer();
        const workbook = await lerWorkbookDeArrayBuffer(arrayBuffer);
        const rastreiosProcessosNormais = montarMapaRastreioProcessosNormais(workbook);
        const rastreiosProfor = montarMapaRastreioProfor(workbook);

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
        const colTipoRastreio = obterIndiceColuna(headers, [{ tipo: 'igual', valor: 'TIPO DE RASTREIO' }]);
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
            const id = obterTextoCelula(linha, colId, `${nomeAbaOrcamento}-${index + 1}`);
            const tipoRastreio = obterTextoCelula(linha, colTipoRastreio, '');
            // A coluna "Tipo de Rastreio" é a forma preferencial de decidir o
            // fluxo. Os testes por descrição ficam como compatibilidade.
            const ehProfor = normalizarTexto(tipoRastreio).includes('PROFOR')
                || normalizarTexto(tipoRastreio).includes('CONVENIO')
                || normalizarTexto(descricao).includes('PROFOR');
            const dadosRastreio = ehProfor
                ? rastreiosProfor.get(id)
                : rastreiosProcessosNormais.get(id);

            const itemBase = {
                id,
                tipoRastreio,
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

            return {
                ...itemBase,
                ...(dadosRastreio || {}),
                // A aba de andamento pode ter status mais atualizado que a base.
                status: dadosRastreio?.status || itemBase.status
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
    dadosFaf2021Cache = montarDadosFaf2021(catalogoAplicacaoCache);
    dadosDoacoes2023Cache = montarDadosDoacoes2023(catalogoAplicacaoCache);
    return catalogoAplicacaoCache;
}

export async function carregarDadosAplicacao(catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const dadosConvenio = await carregarConveniosDaPlanilha(catalogo);
    console.log(`Convenios carregados da planilha: ${dadosConvenio.length} itens.`);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}

// Usado quando o usuário escolhe manualmente a planilha de convênios no browser.
// O arquivo selecionado não é persistido; ele só substitui os dados em memória.
export async function processarArquivoPlanilhaSelecionado(arquivoSelecionado, catalogoAplicacao = null) {
    const catalogo = catalogoAplicacao || await carregarCatalogoAplicacao();
    await carregarPlanilhaOrcamento();
    const workbook = await lerWorkbookDeArrayBuffer(await arquivoSelecionado.arrayBuffer());
    const dadosConvenio = extrairDadosFinanceirosDoWorkbook(workbook, catalogo);
    return montarDadosComConvenios(catalogo, dadosConvenio);
}

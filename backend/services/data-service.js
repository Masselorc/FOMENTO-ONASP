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
const ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR = 'Planilhas/Planilha_Formalizacao_PROFOR_2026.xlsx';
const ABA_ORCAMENTO_DADOS = 'Base_Dados';
const ABA_ORCAMENTO_PROCESSOS_NORMAIS = 'Processos_Normais';
const ABA_ORCAMENTO_PROFOR = 'Andamento_CONV_PROFOR';
const ABA_FORMALIZACAO_PAINEL = 'Painel_Propostas';
const ABA_FORMALIZACAO_CHECKLIST = 'Checklist_Documentos';
const ABA_FORMALIZACAO_DICIONARIO = 'Dicionario_Documentos';
const ABA_FORMALIZACAO_GESTORES = 'Gestores_Responsaveis';
const ABAS_ORCAMENTO_IGNORADAS = new Set(['DICIONARIO_CAMPOS', 'RESUMO']);
const COLUNA_VALOR_OUVIDORIA_GERAL = 18; // Coluna S
const TOLERANCIA_VALIDACAO_CENTAVOS = 1;
const UFS_FORMALIZACAO_PROFOR = ['AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MG', 'PA', 'PE', 'RN', 'RR', 'RS', 'SE'];
const UFS_CONDICAO_SUSPENSIVA_PROFOR = new Set(['PA', 'RR', 'RS', 'SE']);
const VALOR_REPASSE_PROFOR = 200000;
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
let dadosFormalizacaoProforCache = null;

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

export function obterDadosFormalizacaoProfor() {
    return dadosFormalizacaoProforCache;
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

function normalizarCabecalhoPlanilha(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[ºª]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toUpperCase();
}

function obterTabelaFormalizacao(workbook, nomesAba, termosCabecalho = []) {
    const nomeAba = obterNomeAbaWorkbook(workbook, Array.isArray(nomesAba) ? nomesAba : [nomesAba]);
    if (!nomeAba) return null;

    const linhas = obterLinhasPlanilha(workbook.Sheets[nomeAba]);
    const termosNormalizados = termosCabecalho.map((termo) => normalizarCabecalhoPlanilha(termo));
    const headerRowIndex = linhas.findIndex((linha) => {
        const linhaNormalizada = (linha || []).map((celula) => normalizarCabecalhoPlanilha(celula));
        return termosNormalizados.every((termo) => linhaNormalizada.includes(termo));
    });

    if (headerRowIndex === -1) {
        return null;
    }

    const headers = (linhas[headerRowIndex] || []).map((header) => normalizarCabecalhoPlanilha(header));
    const cacheIndices = new Map();
    const indice = (aliases) => {
        const listaAliases = Array.isArray(aliases) ? aliases : [aliases];
        const chave = listaAliases.join('|');
        if (cacheIndices.has(chave)) return cacheIndices.get(chave);

        const aliasesNormalizados = listaAliases.map((alias) => normalizarCabecalhoPlanilha(alias));
        let encontrado = headers.findIndex((header) => aliasesNormalizados.includes(header));
        if (encontrado < 0) {
            encontrado = headers.findIndex((header) => aliasesNormalizados.some((alias) => header.includes(alias)));
        }
        cacheIndices.set(chave, encontrado);
        return encontrado;
    };

    return {
        nomeAba,
        headers,
        linhas: linhas.slice(headerRowIndex + 1),
        indice
    };
}

function obterCelulaFormalizacao(linha, tabela, aliases, fallback = '') {
    const indice = tabela?.indice?.(aliases) ?? -1;
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return fallback;
    }
    const valor = linha[indice];
    if (valor instanceof Date) {
        return formatarDataPlanilha(valor);
    }
    const texto = limparTexto(valor);
    return texto || fallback;
}

function obterNumeroFormalizacao(linha, tabela, aliases) {
    const indice = tabela?.indice?.(aliases) ?? -1;
    return indice >= 0 ? arredondarMoeda(converterNumeroPlanilha(linha[indice])) : 0;
}

function obterDataFormalizacao(linha, tabela, aliases) {
    const indice = tabela?.indice?.(aliases) ?? -1;
    return indice >= 0 ? obterDataCelula(linha, indice) : '';
}

function valorEhSim(valor) {
    const texto = normalizarTexto(valor);
    return ['SIM', 'S', 'TRUE', 'VERDADEIRO', '1', 'VALIDADO', 'PUBLICADO', 'RESOLVIDO'].includes(texto);
}

function valorEhNao(valor) {
    const texto = normalizarTexto(valor);
    return ['NAO', 'N', 'FALSE', 'FALSO', '0'].includes(texto);
}

function valorNaoSeAplica(valor) {
    const texto = normalizarTexto(valor);
    return texto.includes('NAO SE APLICA') || texto === 'N/A';
}

function textoPossuiValor(valor) {
    const texto = normalizarTexto(valor);
    return Boolean(texto && texto !== '-' && texto !== 'NAO INFORMADO' && texto !== 'N/A');
}

function documentoAplicavelAUf(documento, uf) {
    const aplicavel = normalizarTexto(documento?.aplicavelUfs || '');
    if (!aplicavel || aplicavel === 'TODAS' || aplicavel === 'TODOS') {
        return true;
    }
    return aplicavel.split(/[^A-Z]+/).includes(uf);
}

function extrairDicionarioDocumentosFormalizacao(workbook) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_DICIONARIO, ['Código']);
    const documentos = new Map();

    if (!tabela) {
        return documentos;
    }

    tabela.linhas.forEach((linha) => {
        const codigo = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['Código do Documento', 'Código']));
        if (!codigo) return;

        documentos.set(codigo, {
            codigo,
            etapa: obterCelulaFormalizacao(linha, tabela, ['Etapa']),
            nome: obterCelulaFormalizacao(linha, tabela, ['Nome do Documento', 'Nome Documento']),
            descricao: obterCelulaFormalizacao(linha, tabela, ['Descrição', 'Observação']),
            obrigatorio: !valorEhNao(obterCelulaFormalizacao(linha, tabela, ['Obrigatório?'])),
            aplicavelUfs: obterCelulaFormalizacao(linha, tabela, ['Aplicável a quais UFs', 'Aplicável']),
            ordem: converterNumeroPlanilha(obterCelulaFormalizacao(linha, tabela, ['Ordem de Exibição', 'Ordem']))
        });
    });

    return documentos;
}

function extrairChecklistFormalizacao(workbook) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_CHECKLIST, ['ID_Checklist']);
    const porProposta = new Map();

    if (!tabela) {
        return porProposta;
    }

    tabela.linhas.forEach((linha) => {
        const idProposta = obterCelulaFormalizacao(linha, tabela, ['ID_Proposta', 'ID Proposta']);
        const codigo = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['Código Documento', 'Código do Documento', 'Código']));
        if (!idProposta || !codigo) return;

        const enviadoRaw = obterCelulaFormalizacao(linha, tabela, ['Enviado?']);
        const item = {
            idChecklist: obterCelulaFormalizacao(linha, tabela, ['ID_Checklist', 'ID Checklist']),
            idProposta,
            uf: normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF'])),
            etapa: obterCelulaFormalizacao(linha, tabela, ['Etapa']),
            codigo,
            nome: obterCelulaFormalizacao(linha, tabela, ['Nome Documento', 'Nome do Documento']),
            obrigatorio: !valorEhNao(obterCelulaFormalizacao(linha, tabela, ['Obrigatório?'])),
            enviado: valorEhSim(enviadoRaw),
            enviadoRaw,
            dataEnvio: obterDataFormalizacao(linha, tabela, ['Data de Envio', 'Data Envio']),
            statusAnalise: obterCelulaFormalizacao(linha, tabela, ['Status de Análise', 'Status Análise'], 'Não enviado'),
            unidadeResponsavel: obterCelulaFormalizacao(linha, tabela, ['Unidade Responsável pela Análise', 'Unidade Responsável']),
            link: obterCelulaFormalizacao(linha, tabela, ['Link SEI/Transferegov', 'Link SEI', 'Link']),
            pendencia: obterCelulaFormalizacao(linha, tabela, ['Pendência']),
            dataValidacao: obterDataFormalizacao(linha, tabela, ['Data de Validação', 'Data Validação']),
            observacao: obterCelulaFormalizacao(linha, tabela, ['Observação'])
        };

        if (!porProposta.has(idProposta)) {
            porProposta.set(idProposta, new Map());
        }
        porProposta.get(idProposta).set(codigo, item);
    });

    return porProposta;
}

function extrairGestoresFormalizacao(workbook) {
    const tabela = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_GESTORES, ['UF', 'Nome']);
    const porPropostaOuUf = new Map();

    if (!tabela) {
        return porPropostaOuUf;
    }

    tabela.linhas.forEach((linha) => {
        const uf = normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF']));
        const nome = obterCelulaFormalizacao(linha, tabela, ['Nome']);
        if (!uf || !nome) return;

        const idProposta = obterCelulaFormalizacao(linha, tabela, ['ID_Proposta', 'ID Proposta']);
        const ativoRaw = obterCelulaFormalizacao(linha, tabela, ['Ativo?'], 'Sim');
        const gestor = {
            uf,
            idProposta,
            tipo: obterCelulaFormalizacao(linha, tabela, ['Tipo de Responsável', 'Tipo responsável', 'Tipo']),
            nome,
            cargo: obterCelulaFormalizacao(linha, tabela, ['Cargo']),
            orgao: obterCelulaFormalizacao(linha, tabela, ['Órgão', 'Órgão estadual', 'Órgão/Secretaria']),
            email: obterCelulaFormalizacao(linha, tabela, ['E-mail', 'Email']),
            telefone: obterCelulaFormalizacao(linha, tabela, ['Telefone']),
            ativo: valorEhSim(ativoRaw) || (!valorEhNao(ativoRaw) && !valorNaoSeAplica(ativoRaw)),
            dataInicio: obterDataFormalizacao(linha, tabela, ['Data de Início', 'Início vigência']),
            dataFim: obterDataFormalizacao(linha, tabela, ['Data de Fim', 'Fim vigência']),
            observacao: obterCelulaFormalizacao(linha, tabela, ['Observação'])
        };

        [idProposta, uf].filter(Boolean).forEach((chave) => {
            if (!porPropostaOuUf.has(chave)) {
                porPropostaOuUf.set(chave, []);
            }
            porPropostaOuUf.get(chave).push(gestor);
        });
    });

    return porPropostaOuUf;
}

function extrairPlanoAplicacaoFormalizacao(workbook, uf) {
    const tabela = obterTabelaFormalizacao(workbook, `Plano_${uf}`, ['ID_Item']);
    if (!tabela) {
        return [];
    }

    return tabela.linhas.map((linha, index) => {
        const item = obterCelulaFormalizacao(linha, tabela, ['Item']);
        const descricao = obterCelulaFormalizacao(linha, tabela, ['Descrição detalhada', 'Descrição']);
        const idProposta = obterCelulaFormalizacao(linha, tabela, ['ID_Proposta', 'ID Proposta']);
        const quantidade = converterNumeroPlanilha(obterCelulaFormalizacao(linha, tabela, ['Quantidade']));
        const valorUnitario = obterNumeroFormalizacao(linha, tabela, ['Valor Unitário', 'Valor Unitario']);
        const valorTotalInformado = obterNumeroFormalizacao(linha, tabela, ['Valor Total']);
        const valorTotalCalculado = arredondarMoeda(quantidade * valorUnitario);
        const valorTotal = valorTotalCalculado > 0 ? valorTotalCalculado : valorTotalInformado;

        if (!item && !descricao && !valorTotal && !idProposta) {
            return null;
        }

        return {
            idItem: obterCelulaFormalizacao(linha, tabela, ['ID_Item', 'ID Item'], `${uf}-${index + 1}`),
            idProposta,
            uf: normalizarTexto(obterCelulaFormalizacao(linha, tabela, ['UF'], uf)),
            categoria: obterCelulaFormalizacao(linha, tabela, ['Categoria']),
            item,
            descricao,
            unidade: obterCelulaFormalizacao(linha, tabela, ['Unidade de Medida', 'Unidade']),
            quantidade,
            valorUnitario,
            valorTotal,
            valorTotalInformado,
            valorTotalCalculado,
            divergenciaItem: arredondarMoeda(valorTotalCalculado - valorTotalInformado),
            fonteRecurso: obterCelulaFormalizacao(linha, tabela, ['Fonte do Recurso', 'Fonte']),
            naturezaDespesa: obterCelulaFormalizacao(linha, tabela, ['Natureza da Despesa', 'Natureza']),
            elegivel: obterCelulaFormalizacao(linha, tabela, ['Elegível ao PROFOR?', 'Elegível?'], 'Sim'),
            observacao: obterCelulaFormalizacao(linha, tabela, ['Observação'])
        };
    }).filter(Boolean);
}

function somarValoresPorCampo(itens, campo) {
    const mapa = itens.reduce((acc, item) => {
        const chave = item[campo] || 'Não informado';
        acc[chave] = acc[chave] || { nome: chave, total: 0, itens: 0 };
        acc[chave].total = arredondarMoeda(acc[chave].total + (Number(item.valorTotal) || 0));
        acc[chave].itens += 1;
        return acc;
    }, {});

    return Object.values(mapa).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function planoContemItemIncompativel(item) {
    const texto = normalizarTexto(`${item.categoria} ${item.item} ${item.descricao} ${item.observacao}`);
    return valorEhNao(item.elegivel) || /\bOBRAS?\b|\bREFORMAS?\b/.test(texto);
}

function montarResumoPlanoFormalizacao(itens, valorGlobal) {
    const totalCentavos = itens.reduce((total, item) => total + moedaParaCentavos(item.valorTotal), 0);
    const valorGlobalCentavos = moedaParaCentavos(valorGlobal);
    const diferencaCentavos = totalCentavos - valorGlobalCentavos;
    const itensInelegiveis = itens.filter(planoContemItemIncompativel);

    return {
        itens,
        total: centavosParaMoeda(totalCentavos),
        valorGlobal,
        diferenca: centavosParaMoeda(diferencaCentavos),
        fechaComValorGlobal: Math.abs(diferencaCentavos) <= TOLERANCIA_VALIDACAO_CENTAVOS,
        quantidadeItens: itens.length,
        porCategoria: somarValoresPorCampo(itens, 'categoria'),
        porNatureza: somarValoresPorCampo(itens, 'naturezaDespesa'),
        porFonte: somarValoresPorCampo(itens, 'fonteRecurso'),
        itensInelegiveis
    };
}

function obterCodigosDocumentosPorEtapa(dicionario, etapa, uf) {
    const etapaNormalizada = normalizarTexto(etapa);
    return Array.from(dicionario.values())
        .filter((documento) => normalizarTexto(documento.etapa).includes(etapaNormalizada))
        .filter((documento) => documento.obrigatorio && documentoAplicavelAUf(documento, uf))
        .sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || a.codigo.localeCompare(b.codigo))
        .map((documento) => documento.codigo);
}

function montarDocumentoFormalizacao(codigo, etapa, propostaBase, dicionario, checklistPorCodigo) {
    const detalhes = checklistPorCodigo?.get(codigo);
    const catalogo = dicionario.get(codigo);
    const valorPainel = propostaBase.documentosPainel[codigo];
    const enviadoPainel = valorEhSim(valorPainel);
    const naoSeAplica = valorNaoSeAplica(valorPainel) || valorNaoSeAplica(detalhes?.statusAnalise);
    const enviado = !naoSeAplica && (detalhes?.enviado || enviadoPainel);
    const statusAnalise = naoSeAplica
        ? 'Não se aplica'
        : detalhes?.statusAnalise || (enviado ? 'Enviado' : 'Não enviado');

    return {
        codigo,
        etapa,
        nome: detalhes?.nome || catalogo?.nome || codigo,
        descricao: catalogo?.descricao || detalhes?.observacao || '',
        obrigatorio: detalhes?.obrigatorio ?? catalogo?.obrigatorio ?? true,
        enviado,
        enviadoPainel,
        valorPainel,
        statusAnalise,
        dataEnvio: detalhes?.dataEnvio || '',
        unidadeResponsavel: detalhes?.unidadeResponsavel || '',
        link: detalhes?.link || '',
        pendencia: detalhes?.pendencia || '',
        dataValidacao: detalhes?.dataValidacao || '',
        observacao: detalhes?.observacao || ''
    };
}

function calcularProgressoDocumentos(documentos) {
    const exigidos = documentos.filter((documento) => documento.obrigatorio && !valorNaoSeAplica(documento.statusAnalise));
    const enviados = exigidos.filter((documento) => documento.enviado);
    const validados = exigidos.filter((documento) => normalizarTexto(documento.statusAnalise) === 'VALIDADO');

    return {
        total: exigidos.length,
        enviados: enviados.length,
        validados: validados.length,
        percentual: exigidos.length ? (enviados.length / exigidos.length) * 100 : 0,
        percentualValidado: exigidos.length ? (validados.length / exigidos.length) * 100 : 0,
        completo: exigidos.length > 0 && enviados.length === exigidos.length,
        validado: exigidos.length > 0 && validados.length === exigidos.length
    };
}

function gerarAlertasFormalizacao(proposta) {
    const alertas = [];
    const adicionar = (severidade, tipo, mensagem) => {
        alertas.push({ severidade, tipo, mensagem });
    };

    if (!UFS_FORMALIZACAO_PROFOR.includes(proposta.uf)) {
        adicionar('critico', 'UF não elegível', 'UF fora da lista das 14 Unidades Federativas autorizadas para esta rodada.');
    }

    if (!proposta.validacoes.valorRepasseOk) {
        adicionar('critico', 'Valor de repasse', 'Valor de repasse diferente de R$ 200.000,00.');
    }

    if (!proposta.validacoes.valorGlobalOk) {
        adicionar('critico', 'Valor global', 'Valor global diferente da soma entre repasse e contrapartida.');
    }

    if (!proposta.plano.fechaComValorGlobal) {
        adicionar('critico', 'Divergência financeira', 'Plano de aplicação não fecha com o valor global da proposta.');
    }

    if (proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida) {
        adicionar('critico', 'Condição suspensiva pendente', 'Ato normativo publicado ainda não foi comprovado para a UF.');
    }

    if (!proposta.falaBr.previsto) {
        adicionar('critico', 'Fala.BR não previsto', 'A proposta não registra previsão de adesão, integração ou indicação da Plataforma Fala.BR.');
    }

    if (!proposta.progressoDocumentosProjeto.completo) {
        adicionar('critico', 'Documento pendente', 'Há documento essencial da etapa de projeto ainda não enviado.');
    }

    if (proposta.plano.itensInelegiveis.length > 0) {
        adicionar('critico', 'Item incompatível', `${proposta.plano.itensInelegiveis.length} item(ns) do plano podem estar fora do objeto do PROFOR/ONASP.`);
    }

    if (!proposta.progressoDocumentosFormalizacao.completo) {
        adicionar('moderado', 'Formalização pendente', 'Documentos de formalização ainda não foram enviados integralmente.');
    }

    const documentosNaoValidados = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => documento.enviado && normalizarTexto(documento.statusAnalise) !== 'VALIDADO' && normalizarTexto(documento.statusAnalise) !== 'NAO SE APLICA');
    if (documentosNaoValidados.length > 0) {
        adicionar('moderado', 'Documento em análise', `${documentosNaoValidados.length} documento(s) enviado(s) ainda não estão validados.`);
    }

    const documentosComPendencia = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => textoPossuiValor(documento.pendencia) || ['REPROVADO', 'PENDENTE DE CORRECAO'].includes(normalizarTexto(documento.statusAnalise)));
    if (documentosComPendencia.length > 0) {
        adicionar('moderado', 'Pendência documental', `${documentosComPendencia.length} documento(s) possuem pendência ou necessidade de correção.`);
    }

    if (!textoPossuiValor(proposta.gestor.email) || !textoPossuiValor(proposta.responsavelTecnico.email) || !textoPossuiValor(proposta.responsavelTecnico.telefone)) {
        adicionar('moderado', 'Contato incompleto', 'Há e-mail ou telefone de responsável ausente no cadastro.');
    }

    const documentosSemLink = [...proposta.documentosProjeto, ...proposta.documentosFormalizacao]
        .filter((documento) => documento.enviado && !textoPossuiValor(documento.link));
    if (documentosSemLink.length > 0) {
        adicionar('moderado', 'Link ausente', `${documentosSemLink.length} documento(s) enviado(s) não possuem link SEI/Transferegov informado.`);
    }

    const status = normalizarTexto(proposta.situacaoGeral);
    if (status.includes('ELABORACAO') || status.includes('ANALISE')) {
        adicionar('informativo', 'Proposta em tramitação', `Status informado: ${proposta.situacaoGeral}.`);
    }

    if (proposta.progressoGeral > 0 && proposta.progressoGeral < 100) {
        adicionar('informativo', 'Avanço parcial', `Progresso geral calculado em ${proposta.progressoGeral.toFixed(1).replace('.', ',')}%.`);
    }

    return alertas;
}

function calcularTrilhaFormalizacao(proposta) {
    const status = normalizarTexto(proposta.situacaoGeral);
    const semAlertasCriticos = !proposta.alertas.some((alerta) => alerta.severidade === 'critico');
    const aptaPelasRegras = proposta.progressoDocumentosProjeto.completo
        && proposta.progressoDocumentosFormalizacao.completo
        && proposta.plano.fechaComValorGlobal
        && proposta.falaBr.previsto
        && proposta.condicaoSuspensiva.resolvida
        && proposta.validacoes.valorRepasseOk
        && proposta.validacoes.valorGlobalOk
        && semAlertasCriticos;

    const etapas = [
        {
            chave: 'proposta-cadastrada',
            rotulo: 'Proposta cadastrada',
            concluida: textoPossuiValor(proposta.numeroProposta)
        },
        {
            chave: 'docs-projeto',
            rotulo: 'Documentos do projeto enviados',
            concluida: proposta.progressoDocumentosProjeto.completo
        },
        {
            chave: 'projeto-aprovado',
            rotulo: 'Projeto aprovado',
            concluida: proposta.progressoDocumentosProjeto.validado || status.includes('PROJETO APROVADO') || status.includes('APTA')
        },
        {
            chave: 'docs-formalizacao',
            rotulo: 'Documentos de formalização enviados',
            concluida: proposta.progressoDocumentosFormalizacao.completo
        },
        {
            chave: 'condicao-suspensiva',
            rotulo: 'Condição suspensiva resolvida',
            concluida: proposta.condicaoSuspensiva.resolvida,
            naoSeAplica: !proposta.condicaoSuspensiva.exige
        },
        {
            chave: 'plano-validado',
            rotulo: 'Plano de aplicação validado',
            concluida: proposta.plano.fechaComValorGlobal
        },
        {
            chave: 'apta-celebracao',
            rotulo: 'Apta à celebração',
            concluida: aptaPelasRegras || status.includes('APTA A CELEBRACAO')
        },
        {
            chave: 'convenio-celebrado',
            rotulo: 'Convênio celebrado',
            concluida: status.includes('CELEBRADO') || status.includes('PUBLICADO') || status.includes('EXECUCAO')
        },
        {
            chave: 'instrumento-publicado',
            rotulo: 'Instrumento publicado',
            concluida: status.includes('PUBLICADO') || status.includes('EXECUCAO')
        }
    ];

    let etapaAtualMarcada = false;
    return etapas.map((etapa) => {
        if (etapa.naoSeAplica) {
            return { ...etapa, estado: 'nao-aplica' };
        }
        if (etapa.concluida) {
            return { ...etapa, estado: 'concluida' };
        }
        if (!etapaAtualMarcada) {
            etapaAtualMarcada = true;
            return { ...etapa, estado: 'atual' };
        }
        return { ...etapa, estado: 'pendente' };
    });
}

function calcularProgressoGeralFormalizacao(proposta) {
    const projeto = proposta.progressoDocumentosProjeto.percentual / 100;
    const formalizacao = proposta.progressoDocumentosFormalizacao.percentual / 100;
    const plano = proposta.plano.fechaComValorGlobal ? 1 : 0;
    const falaBr = proposta.falaBr.previsto ? 1 : 0;
    const condicao = proposta.condicaoSuspensiva.resolvida ? 1 : 0;

    return Math.max(0, Math.min(100, (projeto * 30) + (formalizacao * 40) + (plano * 15) + (falaBr * 5) + (condicao * 10)));
}

function obterResponsavelFormalizacao(responsaveis, termos) {
    return responsaveis.find((responsavel) => {
        const tipo = normalizarTexto(responsavel.tipo);
        return termos.some((termo) => tipo.includes(normalizarTexto(termo)));
    });
}

function montarPropostasFormalizacao(workbook) {
    const painel = obterTabelaFormalizacao(workbook, ABA_FORMALIZACAO_PAINEL, ['ID_Proposta', 'UF']);
    if (!painel) {
        throw new Error(`A aba ${ABA_FORMALIZACAO_PAINEL} nao foi encontrada ou nao possui os cabecalhos esperados.`);
    }

    const dicionario = extrairDicionarioDocumentosFormalizacao(workbook);
    const checklist = extrairChecklistFormalizacao(workbook);
    const gestores = extrairGestoresFormalizacao(workbook);

    return painel.linhas.map((linha) => {
        const idProposta = obterCelulaFormalizacao(linha, painel, ['ID_Proposta', 'ID Proposta']);
        const uf = normalizarTexto(obterCelulaFormalizacao(linha, painel, ['UF']));
        if (!idProposta || !uf) return null;

        const valorRepasse = obterNumeroFormalizacao(linha, painel, ['Valor de Repasse', 'Valor Repasse']);
        const valorContrapartida = obterNumeroFormalizacao(linha, painel, ['Valor de Contrapartida', 'Valor Contrapartida']);
        const valorGlobal = obterNumeroFormalizacao(linha, painel, ['Valor Global']);
        const documentosPainel = {};
        painel.headers.forEach((header, index) => {
            if (/^DOC (PROJ|FORM) \d+$/i.test(header)) {
                documentosPainel[header.replace(/ /g, '_')] = obterCelulaFormalizacao(linha, { indice: () => index }, header);
            }
        });

        const planoItens = extrairPlanoAplicacaoFormalizacao(workbook, uf).filter((item) => (
            !item.idProposta || item.idProposta === idProposta
        ));
        const plano = montarResumoPlanoFormalizacao(planoItens, valorGlobal);
        const checklistProposta = checklist.get(idProposta) || new Map();
        const codigosProjeto = obterCodigosDocumentosPorEtapa(dicionario, 'Projeto', uf);
        const codigosFormalizacao = obterCodigosDocumentosPorEtapa(dicionario, 'Formalização', uf);
        const codigosProjetoBase = codigosProjeto.length ? codigosProjeto : Object.keys(documentosPainel).filter((codigo) => codigo.startsWith('DOC_PROJ'));
        const codigosFormalizacaoBase = codigosFormalizacao.length ? codigosFormalizacao : Object.keys(documentosPainel).filter((codigo) => codigo.startsWith('DOC_FORM'));

        const propostaBase = { documentosPainel };
        const documentosProjeto = codigosProjetoBase.map((codigo) => montarDocumentoFormalizacao(codigo, 'Projeto', propostaBase, dicionario, checklistProposta));
        const documentosFormalizacao = codigosFormalizacaoBase.map((codigo) => montarDocumentoFormalizacao(codigo, 'Formalização', propostaBase, dicionario, checklistProposta));
        const progressoDocumentosProjeto = calcularProgressoDocumentos(documentosProjeto);
        const progressoDocumentosFormalizacao = calcularProgressoDocumentos(documentosFormalizacao);
        const responsaveisAtivos = [
            ...(gestores.get(idProposta) || []),
            ...(gestores.get(uf) || [])
        ].filter((responsavel, index, array) => (
            responsavel.ativo
            && array.findIndex((item) => item.nome === responsavel.nome && item.tipo === responsavel.tipo) === index
        ));
        const responsavelPolitico = obterResponsavelFormalizacao(responsaveisAtivos, ['secretario', 'gestor politico', 'secretário']) || {};
        const responsavelTecnico = obterResponsavelFormalizacao(responsaveisAtivos, ['responsavel tecnico', 'técnico', 'gestor da proposta']) || {};
        const condicaoPendenteRaw = obterCelulaFormalizacao(linha, painel, ['Condição Suspensiva Pendente?']);
        const exigeCondicao = UFS_CONDICAO_SUSPENSIVA_PROFOR.has(uf)
            || valorEhSim(obterCelulaFormalizacao(linha, painel, ['Exige Ato Normativo?', 'Ato normativo exigido?']));
        const atoEnviado = valorEhSim(obterCelulaFormalizacao(linha, painel, ['Ato Normativo Enviado?', 'Ato normativo enviado?']));
        const atoPublicadoRaw = obterCelulaFormalizacao(linha, painel, ['Ato Normativo Publicado?', 'Ato normativo publicado?']);
        const condicaoPendente = exigeCondicao
            ? (textoPossuiValor(condicaoPendenteRaw) ? valorEhSim(condicaoPendenteRaw) : !valorEhSim(atoPublicadoRaw))
            : false;
        const atoPublicado = valorEhSim(atoPublicadoRaw) || (exigeCondicao && atoEnviado && !condicaoPendente);
        const condicaoResolvida = !exigeCondicao || (!condicaoPendente && (atoPublicado || atoEnviado));

        const proposta = {
            idProposta,
            uf,
            estado: obterCelulaFormalizacao(linha, painel, ['Estado'], uf),
            grupo: obterCelulaFormalizacao(linha, painel, ['Grupo']),
            numeroProposta: obterCelulaFormalizacao(linha, painel, ['Número da Proposta', 'Nº Proposta', 'N Proposta']),
            ano: obterCelulaFormalizacao(linha, painel, ['Ano']),
            processoSei: obterCelulaFormalizacao(linha, painel, ['Processo SEI']),
            situacaoGeral: obterCelulaFormalizacao(linha, painel, ['Situação Geral', 'Status Geral'], 'Não informado'),
            ultimaAtualizacao: obterDataFormalizacao(linha, painel, ['Última Atualização', 'Data da Última Atualização']),
            observacoes: obterCelulaFormalizacao(linha, painel, ['Observações', 'Observação']),
            fonteOrigem: obterCelulaFormalizacao(linha, painel, ['Fonte/Origem', 'Fonte']),
            gestor: {
                nome: obterCelulaFormalizacao(linha, painel, ['Nome do Secretário', 'Nome do Secretario']) || responsavelPolitico.nome || '',
                cargo: obterCelulaFormalizacao(linha, painel, ['Cargo']) || responsavelPolitico.cargo || '',
                orgao: obterCelulaFormalizacao(linha, painel, ['Órgão/Secretaria', 'Órgão Secretaria']) || responsavelPolitico.orgao || '',
                email: obterCelulaFormalizacao(linha, painel, ['E-mail institucional', 'E-mail Gestor', 'Email Gestor']) || responsavelPolitico.email || '',
                telefone: obterCelulaFormalizacao(linha, painel, ['Telefone']) || responsavelPolitico.telefone || ''
            },
            responsavelTecnico: {
                nome: obterCelulaFormalizacao(linha, painel, ['Nome do responsável técnico', 'Responsável Técnico', 'Responsavel Tecnico']) || responsavelTecnico.nome || '',
                cargo: obterCelulaFormalizacao(linha, painel, ['Cargo do responsável técnico', 'Cargo Resp. Técnico']) || responsavelTecnico.cargo || '',
                email: obterCelulaFormalizacao(linha, painel, ['E-mail do responsável técnico', 'E-mail Resp. Técnico', 'Email Resp. Tecnico']) || responsavelTecnico.email || '',
                telefone: obterCelulaFormalizacao(linha, painel, ['Telefone do responsável técnico', 'Telefone Resp. Técnico']) || responsavelTecnico.telefone || ''
            },
            responsaveisAtivos,
            valorRepasse,
            valorContrapartida,
            valorGlobal,
            valorGlobalCalculado: arredondarMoeda(valorRepasse + valorContrapartida),
            percentualContrapartida: valorGlobal > 0 ? (valorContrapartida / valorGlobal) * 100 : 0,
            documentosPainel,
            documentosProjeto,
            documentosFormalizacao,
            progressoDocumentosProjeto,
            progressoDocumentosFormalizacao,
            plano,
            condicaoSuspensiva: {
                exige: exigeCondicao,
                atoEnviado,
                atoPublicado,
                dataPublicacao: obterDataFormalizacao(linha, painel, ['Data de Publicação', 'Data Publicação']),
                linkReferencia: obterCelulaFormalizacao(linha, painel, ['Link/Referência do Ato', 'Link Referência do Ato', 'Link do Ato']),
                pendente: condicaoPendente,
                resolvida: condicaoResolvida,
                situacao: !exigeCondicao
                    ? 'Não se aplica'
                    : condicaoResolvida
                        ? 'Resolvido'
                        : atoEnviado
                            ? 'Enviado, aguardando análise'
                            : 'Pendente'
            },
            falaBr: {
                previsto: valorEhSim(obterCelulaFormalizacao(linha, painel, ['FalaBR_Previsto', 'Fala.BR previsto no cronograma?', 'FalaBR Previsto'])),
                forma: obterCelulaFormalizacao(linha, painel, ['FalaBR_Forma', 'FalaBR Forma', 'Fala.BR Forma']),
                observacao: obterCelulaFormalizacao(linha, painel, ['FalaBR_Observacao', 'FalaBR Observacao', 'Fala.BR Observação'])
            },
            validacoes: {
                ufElegivel: UFS_FORMALIZACAO_PROFOR.includes(uf),
                valorRepasseOk: Math.abs(moedaParaCentavos(valorRepasse) - moedaParaCentavos(VALOR_REPASSE_PROFOR)) <= TOLERANCIA_VALIDACAO_CENTAVOS,
                valorGlobalOk: Math.abs(moedaParaCentavos(valorGlobal) - moedaParaCentavos(valorRepasse + valorContrapartida)) <= TOLERANCIA_VALIDACAO_CENTAVOS
            }
        };

        proposta.progressoGeral = calcularProgressoGeralFormalizacao(proposta);
        proposta.alertas = gerarAlertasFormalizacao(proposta);
        proposta.trilha = calcularTrilhaFormalizacao(proposta);
        proposta.situacaoPlano = proposta.plano.fechaComValorGlobal ? 'Plano de aplicação compatível' : 'Divergência no plano de aplicação';
        proposta.aptaCelebracao = proposta.trilha.find((etapa) => etapa.chave === 'apta-celebracao')?.concluida || false;

        return proposta;
    }).filter((proposta) => proposta && UFS_FORMALIZACAO_PROFOR.includes(proposta.uf))
        .sort((a, b) => a.uf.localeCompare(b.uf, 'pt-BR'));
}

function montarResumoFormalizacao(propostas) {
    const totalValorGlobalCentavos = propostas.reduce((total, proposta) => total + moedaParaCentavos(proposta.valorGlobal), 0);
    const alertas = propostas.flatMap((proposta) => (
        proposta.alertas.map((alerta) => ({
            ...alerta,
            uf: proposta.uf,
            estado: proposta.estado,
            idProposta: proposta.idProposta
        }))
    ));

    return {
        totalPropostas: propostas.length,
        totalValorGlobal: centavosParaMoeda(totalValorGlobalCentavos),
        totalRepasse: propostas.reduce((total, proposta) => total + proposta.valorRepasse, 0),
        totalContrapartida: propostas.reduce((total, proposta) => total + proposta.valorContrapartida, 0),
        aptasCelebracao: propostas.filter((proposta) => proposta.aptaCelebracao).length,
        planosCompativeis: propostas.filter((proposta) => proposta.plano.fechaComValorGlobal).length,
        condicoesPendentes: propostas.filter((proposta) => proposta.condicaoSuspensiva.exige && !proposta.condicaoSuspensiva.resolvida).length,
        falaBrPendentes: propostas.filter((proposta) => !proposta.falaBr.previsto).length,
        alertasCriticos: alertas.filter((alerta) => alerta.severidade === 'critico').length,
        propostasComAlertaCritico: propostas.filter((proposta) => proposta.alertas.some((alerta) => alerta.severidade === 'critico')).length,
        mediaProgressoGeral: propostas.length
            ? propostas.reduce((total, proposta) => total + proposta.progressoGeral, 0) / propostas.length
            : 0,
        documentosProjetoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosProjeto.completo).length,
        documentosFormalizacaoCompletos: propostas.filter((proposta) => proposta.progressoDocumentosFormalizacao.completo).length,
        alertas,
        filtros: {
            ufs: [...UFS_FORMALIZACAO_PROFOR],
            grupos: Array.from(new Set(propostas.map((proposta) => proposta.grupo).filter(Boolean))).sort(),
            status: Array.from(new Set(propostas.map((proposta) => proposta.situacaoGeral).filter(Boolean))).sort()
        }
    };
}

function extrairFormalizacaoProforDoWorkbook(workbook) {
    const propostas = montarPropostasFormalizacao(workbook);
    return {
        arquivo: ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR,
        ufsAutorizadas: UFS_FORMALIZACAO_PROFOR,
        ufsCondicaoSuspensiva: Array.from(UFS_CONDICAO_SUSPENSIVA_PROFOR),
        valorRepassePadrao: VALOR_REPASSE_PROFOR,
        propostas,
        resumo: montarResumoFormalizacao(propostas)
    };
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

export async function carregarDadosFormalizacaoProfor() {
    if (dadosFormalizacaoProforCache) {
        return dadosFormalizacaoProforCache;
    }

    try {
        if (window.location.protocol === 'file:') {
            throw new Error('Abra a aplicacao por um servidor local para carregar a planilha de formalizacao.');
        }

        const planilhaUrl = new URL(`../../${ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR}`, import.meta.url);
        const resposta = await fetch(planilhaUrl, { cache: 'no-store' });

        if (!resposta.ok) {
            throw new Error(`Planilha de formalizacao nao encontrada (${resposta.status}).`);
        }

        const workbook = await lerWorkbookDeArrayBuffer(await resposta.arrayBuffer());
        dadosFormalizacaoProforCache = extrairFormalizacaoProforDoWorkbook(workbook);
        return dadosFormalizacaoProforCache;
    } catch (error) {
        dadosFormalizacaoProforCache = null;
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_FORMALIZACAO_PROFOR}:`, error);
        return null;
    }
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

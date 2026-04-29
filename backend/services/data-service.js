const JSON_APLICACAO_URL = new URL('../data/aplicacao.json', import.meta.url);
const ABA_RESUMO_CONVENIOS = 'Geral';
const ARQUIVO_PLANILHA_ORCAMENTO = 'banco_dados_orcamentario_onasp.xlsx';
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

function obterTextoCelula(linha, indice, fallback = '-') {
    if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
        return fallback;
    }

    const texto = limparTexto(linha[indice]);
    return texto || fallback;
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
        const planilhaUrl = new URL(`../../${ARQUIVO_PLANILHA_ORCAMENTO}`, import.meta.url);
        const resposta = await fetch(planilhaUrl, { cache: 'no-store' });
        
        if (!resposta.ok) {
            console.warn(`Planilha orçamentária não encontrada (${resposta.status}).`);
            dadosOrcamentoCache = null;
            return;
        }
        
        const arrayBuffer = await resposta.arrayBuffer();
        const workbook = await lerWorkbookDeArrayBuffer(arrayBuffer);
        
        let totalAllocated = 0;
        let totalSpent = 0;
        const departments = [];

        const sheetNames = workbook.SheetNames.filter((name) => {
            const nomeNormalizado = normalizarTexto(name);
            return !nomeNormalizado.includes('IND_') && !ABAS_ORCAMENTO_IGNORADAS.has(nomeNormalizado);
        });

        for (const sheetName of sheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const linhas = obterLinhasPlanilha(sheet);
            if (linhas.length < 2) continue;

            // Busca a linha de cabeçalho dinamicamente
            let headerRowIndex = -1;
            let headers = [];
            
            for (let r = 0; r < Math.min(linhas.length, 10); r++) {
                const rowText = (linhas[r] || []).map(c => String(c || '').toUpperCase()).join(' ');
                if (
                    rowText.includes('DESCRI')
                    || rowText.includes('ITENS')
                    || rowText.includes('PREVISTO')
                    || rowText.includes('ALOCADO')
                    || rowText.includes('VALOR TOTAL')
                ) {
                    headerRowIndex = r;
                    headers = (linhas[r] || []).map(h => normalizarTexto(String(h)));
                    break;
                }
            }

            if (headerRowIndex === -1) {
                headers = (linhas[0] || []).map(h => normalizarTexto(String(h)));
                headerRowIndex = 0;
            }
            
            const colUf = obterIndiceColuna(headers, [
                { tipo: 'igual', valor: 'UF' },
                { tipo: 'igual', valor: 'ESTADO' },
                { tipo: 'inclui', valor: 'UF' },
                { tipo: 'inclui', valor: 'ABRANGENCIA' }
            ]);
            const colInstrumento = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'INSTRUMENTO' },
                { tipo: 'inclui', valor: 'MODALIDADE' }
            ]);
            const colArea = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'AREA' },
                { tipo: 'inclui', valor: 'FRENTE' },
                { tipo: 'inclui', valor: 'DEPARTAMENTO' },
                { tipo: 'inclui', valor: 'SETOR' },
                { tipo: 'inclui', valor: 'DESTINA' }
            ]);
            const colNatureza = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'NATUREZA' },
                { tipo: 'inclui', valor: 'CATEGORIA' }
            ]);
            const colDescricao = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'DESCRI' },
                { tipo: 'inclui', valor: 'OBJETO' },
                { tipo: 'inclui', valor: 'ITENS' },
                { tipo: 'inclui', valor: 'ITEM' },
                { tipo: 'inclui', valor: 'SERVICO' },
                { tipo: 'igual', valor: 'NOME' }
            ]);
            const colQtd = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'QUANT' },
                { tipo: 'inclui', valor: 'QTD' }
            ]);
            const colVlrUnit = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'VALOR UNIT' },
                { tipo: 'inclui', valor: 'UNITARIO' },
                { tipo: 'inclui', valor: 'UNIT' }
            ]);
            const colAlocado = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'VALOR TOTAL' },
                { tipo: 'inclui', valor: 'PREVISTO' },
                { tipo: 'inclui', valor: 'ALOCADO' },
                { tipo: 'inclui', valor: 'ORCAMENTO' }
            ]);
            let colExecutado = obterIndiceColuna(headers, [
                { tipo: 'inclui', valor: 'EXECUTADO' },
                { tipo: 'inclui', valor: 'GASTO' },
                { tipo: 'inclui', valor: 'UTILIZADO' },
                { tipo: 'inclui', valor: 'EMPENHADO' }
            ]);
            
            if (colExecutado === colAlocado) {
                colExecutado = headers.findIndex((h, idx) => idx !== colAlocado && (h.includes('EXECUTADO') || h.includes('GASTO') || h.includes('UTILIZADO')));
            }

            const idxAloc = colAlocado >= 0 ? colAlocado : -1;
            const idxDesc = colDescricao >= 0 ? colDescricao : -1;
            if (idxAloc === -1 || idxDesc === -1) continue; // Pula a aba se faltarem colunas chave

            for (let i = headerRowIndex + 1; i < linhas.length; i++) {
                const linha = linhas[i];
                if (!linha || linha[idxDesc] === null || linha[idxDesc] === undefined) continue;

                const descricao = String(linha[idxDesc]).trim();
                if (!descricao || descricao === '-' || normalizarTexto(descricao).includes('TOTAL')) continue;

                const allocated = converterNumeroPlanilha(linha[idxAloc]);
                const spent = colExecutado >= 0 ? converterNumeroPlanilha(linha[colExecutado]) : 0;
                const uf = obterTextoCelula(linha, colUf, sheetName);
                const instrumento = obterTextoCelula(linha, colInstrumento);
                const area = obterTextoCelula(linha, colArea);
                const natureza = obterTextoCelula(linha, colNatureza);
                const quantidade = obterTextoCelula(linha, colQtd);
                const valorUnitario = colVlrUnit >= 0 && linha[colVlrUnit] !== undefined ? converterNumeroPlanilha(linha[colVlrUnit]) : 0;

                if (allocated > 0 || spent > 0) {
                    departments.push({
                        id: `${sheetName}-${i}`,
                        uf,
                        instrumento,
                        area,
                        natureza,
                        descricao,
                        quantidade,
                        valorUnitario,
                        allocated,
                        spent
                    });
                    totalAllocated += allocated;
                    totalSpent += spent;
                }
            }
        }

        dadosOrcamentoCache = {
            total: totalAllocated,
            used: totalSpent,
            available: totalAllocated - totalSpent,
            departments: departments
        };
    } catch (error) {
        dadosOrcamentoCache = null;
        console.error(`Erro ao ler e processar ${ARQUIVO_PLANILHA_ORCAMENTO}:`, error);
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

const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const {
  normalizarTextoProfor,
  normalizarNumeroConvenio,
  normalizarAnoProfor,
  moedaParaNumeroProfor,
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

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
};

const ORIGEM_RATEIO_INICIAL = "planilha-antiga";
const TOLERANCIA_MOEDA = 0.01;

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarDescricaoRateioProfor(valor) {
  return normalizarTextoProfor(valor).replace(/\s+/g, " ").trim();
}

function criarChaveItemRateioProfor(numeroConvenio, descricaoNormalizada) {
  return `${numeroConvenio}::${descricaoNormalizada}`;
}

function obterLinhasPlanilha(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function obterValorMoeda(linha, indice) {
  return arredondarMoedaProfor(moedaParaNumeroProfor(linha[indice]));
}

function obterValorQuantidade(linha, indice) {
  const valor = moedaParaNumeroProfor(linha[indice]);
  return Number.isFinite(valor) ? valor : 0;
}

function listarAbasUfPlanoAplicacao(workbook, catalogoAplicacao) {
  const { configuracao = {}, nomesEstados = {} } = catalogoAplicacao;
  const abasIgnoradas = new Set([
    "Geral",
    "IND_PRORROG",
    ...(configuracao.abasPlanilhaIgnoradas || []),
  ].map((nomeAba) => normalizarTextoProfor(nomeAba)));

  return workbook.SheetNames.filter((sheetName) => {
    const nomeNormalizado = normalizarTextoProfor(sheetName);
    return nomesEstados[nomeNormalizado] && !abasIgnoradas.has(nomeNormalizado);
  });
}

function linhaTemConteudoPlano(linha) {
  return Object.values(COLUNAS_PLANO_PROFOR).some((indice) => limparTexto(linha[indice]));
}

function criarAlerta({ tipo, chaveItem = null, linha, detalhe, nivel = "impeditivo" }) {
  return {
    tipo,
    nivel,
    chaveItem,
    numeroConvenio: linha?.numeroConvenio || null,
    uf: linha?.uf || null,
    ano: linha?.ano || null,
    descricao: linha?.descricaoOriginal || null,
    detalhe,
    origem: {
      arquivo: linha?.arquivoOrigem || null,
      aba: linha?.abaOrigem || null,
      linha: linha?.linhaOrigem || null,
    },
  };
}

function extrairLinhaPlanoAntigo(linha, contexto) {
  const uf = normalizarTextoProfor(linha[COLUNAS_PLANO_PROFOR.uf]);
  const numeroConvenio = normalizarNumeroConvenio(linha[COLUNAS_PLANO_PROFOR.numero]);
  const ano = normalizarAnoProfor(linha[COLUNAS_PLANO_PROFOR.ano]);
  const area = normalizarTextoProfor(linha[COLUNAS_PLANO_PROFOR.area]);
  const natureza = normalizarTextoProfor(linha[COLUNAS_PLANO_PROFOR.natureza]);
  const descricaoOriginal = limparTexto(linha[COLUNAS_PLANO_PROFOR.descricao]);
  const descricaoNormalizada = normalizarDescricaoRateioProfor(descricaoOriginal);
  const chaveItem = numeroConvenio && descricaoNormalizada
    ? criarChaveItemRateioProfor(numeroConvenio, descricaoNormalizada)
    : null;
  const valorPrevisto = obterValorMoeda(linha, COLUNAS_PLANO_PROFOR.valorPrevisto);
  const valorExecutado = obterValorMoeda(linha, COLUNAS_PLANO_PROFOR.valorExecutado);
  const saldoPlanilha = obterValorMoeda(linha, COLUNAS_PLANO_PROFOR.saldo);

  return {
    chaveItem,
    uf,
    ufEsperada: contexto.ufEsperada,
    numeroConvenio,
    ano,
    area,
    natureza,
    descricaoOriginal,
    descricaoNormalizada,
    quantidade: obterValorQuantidade(linha, COLUNAS_PLANO_PROFOR.quantidade),
    valorUnitario: obterValorMoeda(linha, COLUNAS_PLANO_PROFOR.valorUnitario),
    valorPrevisto,
    valorExecutado,
    saldoPlanilha,
    saldoCalculado: arredondarMoedaProfor(valorPrevisto - valorExecutado),
    arquivoOrigem: contexto.arquivoOrigem,
    abaOrigem: contexto.abaOrigem,
    linhaOrigem: contexto.linhaOrigem,
  };
}

function extrairLinhasPlanoAntigo(workbook, catalogoAplicacao, contexto) {
  const abas = listarAbasUfPlanoAplicacao(workbook, catalogoAplicacao);
  const linhasExtraidas = [];
  let totalLinhasLidas = 0;

  for (const aba of abas) {
    const sheet = workbook.Sheets[aba];
    const linhas = obterLinhasPlanilha(sheet);
    const ufEsperada = normalizarTextoProfor(aba);

    linhas.slice(1).forEach((linha, indice) => {
      if (!linhaTemConteudoPlano(linha)) return;
      totalLinhasLidas += 1;
      linhasExtraidas.push(extrairLinhaPlanoAntigo(linha, {
        arquivoOrigem: contexto.arquivoOrigem,
        abaOrigem: aba,
        linhaOrigem: indice + 2,
        ufEsperada,
      }));
    });
  }

  return { abas, linhasExtraidas, totalLinhasLidas };
}

function adicionarAlertasLinha(linha, alertas) {
  if (!linha.numeroConvenio || !linha.ano || !linha.uf || linha.uf !== linha.ufEsperada) {
    alertas.push(criarAlerta({
      tipo: "linha_sem_numero_ano_uf",
      chaveItem: linha.chaveItem,
      linha,
      detalhe: "Linha sem numero, ano ou UF valida para a aba de UF processada.",
    }));
  }

  if (!linha.descricaoOriginal) {
    alertas.push(criarAlerta({
      tipo: "descricao_vazia",
      linha,
      detalhe: "Linha da aba UF sem descricao do item.",
    }));
  }

  if (!linha.area) {
    alertas.push(criarAlerta({
      tipo: "area_vazia",
      chaveItem: linha.chaveItem,
      linha,
      detalhe: "Linha da aba UF sem area classificada.",
    }));
  }

  if (!linha.natureza) {
    alertas.push(criarAlerta({
      tipo: "natureza_vazia",
      chaveItem: linha.chaveItem,
      linha,
      detalhe: "Linha da aba UF sem natureza classificada.",
    }));
  }

  if (linha.quantidade === 0 && linha.valorPrevisto > 0) {
    alertas.push(criarAlerta({
      tipo: "quantidade_zero_com_valor_previsto",
      chaveItem: linha.chaveItem,
      linha,
      detalhe: "Linha com quantidade zero e valor previsto positivo.",
    }));
  }

  if (Math.abs(linha.saldoCalculado - linha.saldoPlanilha) > TOLERANCIA_MOEDA) {
    alertas.push(criarAlerta({
      tipo: "fechamento_valor_inconsistente",
      chaveItem: linha.chaveItem,
      linha,
      detalhe: `Saldo calculado (${linha.saldoCalculado}) diverge do saldo da planilha (${linha.saldoPlanilha}).`,
    }));
  }
}

function agruparPorChaveItem(linhas) {
  const grupos = new Map();

  for (const linha of linhas) {
    if (!linha.chaveItem) continue;
    if (!grupos.has(linha.chaveItem)) {
      grupos.set(linha.chaveItem, []);
    }
    grupos.get(linha.chaveItem).push(linha);
  }

  return grupos;
}

function valoresUnicosOrdenados(valores) {
  return Array.from(new Set(valores.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function calcularPercentual(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100000000) / 1000000;
}

function somarNumero(linhas, campo) {
  return linhas.reduce((total, linha) => total + (Number(linha[campo]) || 0), 0);
}

function agregarRateiosPorArea(grupo) {
  const rateiosMap = new Map();

  for (const linha of grupo) {
    const chaveRateio = `${linha.area || "NAO INFORMADO"}::${linha.natureza || "NAO INFORMADO"}`;
    if (!rateiosMap.has(chaveRateio)) {
      rateiosMap.set(chaveRateio, {
        chaveItem: linha.chaveItem,
        area: linha.area || "NAO INFORMADO",
        natureza: linha.natureza || "NAO INFORMADO",
        quantidadeReferencia: 0,
        valorPrevistoReferencia: 0,
        valorExecutadoReferencia: 0,
      });
    }

    const rateio = rateiosMap.get(chaveRateio);
    rateio.quantidadeReferencia += linha.quantidade;
    rateio.valorPrevistoReferencia = arredondarMoedaProfor(rateio.valorPrevistoReferencia + linha.valorPrevisto);
    rateio.valorExecutadoReferencia = arredondarMoedaProfor(rateio.valorExecutadoReferencia + linha.valorExecutado);
  }

  const totalQuantidade = somarNumero(grupo, "quantidade");
  const totalValorPrevisto = arredondarMoedaProfor(somarNumero(grupo, "valorPrevisto"));

  return Array.from(rateiosMap.values()).map((rateio) => ({
    ...rateio,
    quantidadeReferencia: Math.round((rateio.quantidadeReferencia + Number.EPSILON) * 1000000) / 1000000,
    percentualQuantidade: calcularPercentual(rateio.quantidadeReferencia, totalQuantidade),
    percentualValor: calcularPercentual(rateio.valorPrevistoReferencia, totalValorPrevisto),
  }));
}

function adicionarAlertasGrupo(chaveItem, grupo, alertas) {
  const referencia = grupo[0];
  const naturezas = valoresUnicosOrdenados(grupo.map((linha) => linha.natureza));
  const valoresUnitarios = valoresUnicosOrdenados(
    grupo
      .map((linha) => linha.valorUnitario)
      .filter((valor) => valor > 0)
      .map((valor) => valor.toFixed(2))
  );

  if (naturezas.length > 1) {
    alertas.push(criarAlerta({
      tipo: "natureza_conflitante",
      chaveItem,
      linha: referencia,
      detalhe: "Mesma descricao apareceu com naturezas diferentes.",
    }));
  }

  if (valoresUnitarios.length > 1) {
    alertas.push(criarAlerta({
      tipo: "valor_unitario_divergente_na_mesma_chave",
      chaveItem,
      linha: referencia,
      detalhe: `Mesma chave operacional apareceu com valores unitarios diferentes: ${valoresUnitarios.join(", ")}.`,
    }));
  }
}

function grupoPossuiPendenciaImpedativa(chaveItem, alertas) {
  return alertas.some((alerta) => alerta.nivel === "impeditivo" && alerta.chaveItem === chaveItem);
}

function montarItemConhecido(chaveItem, grupo, alertas) {
  const referencia = grupo[0];
  const valoresUnitarios = grupo.map((linha) => linha.valorUnitario).filter((valor) => valor > 0);
  const possuiPendenciaImpedativa = grupoPossuiPendenciaImpedativa(chaveItem, alertas);

  return {
    chaveItem,
    numeroConvenio: referencia.numeroConvenio,
    descricaoNormalizada: referencia.descricaoNormalizada,
    descricaoOriginalReferencia: referencia.descricaoOriginal,
    uf: referencia.uf,
    ano: referencia.ano,
    naturezasEncontradas: valoresUnicosOrdenados(grupo.map((linha) => linha.natureza)),
    unidadesEncontradas: [],
    valorUnitarioReferencia: valoresUnitarios.length ? valoresUnitarios[0] : 0,
    origem: ORIGEM_RATEIO_INICIAL,
    possuiPendenciaImpedativa,
    aptoParaImportacaoFutura: !possuiPendenciaImpedativa,
  };
}

function montarResumo({ totalLinhasLidas, itensConhecidos, rateios, alertas, abas, arquivoPlanilha }) {
  return {
    arquivoPlanilha,
    abasProcessadas: abas,
    totalLinhasLidas,
    totalItensConhecidos: itensConhecidos.length,
    totalRateios: rateios.length,
    totalAlertas: alertas.length,
    totalAlertasImpedativos: alertas.filter((alerta) => alerta.nivel === "impeditivo").length,
    totalNaturezasConflitantes: alertas.filter((alerta) => alerta.tipo === "natureza_conflitante").length,
  };
}

function extrairRateioInicialProfor2022DryRun(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const caminhoCatalogo = opcoes.caminhoCatalogo || path.join(repoRoot, "backend/data/aplicacao.json");
  const catalogoAplicacao = JSON.parse(fs.readFileSync(caminhoCatalogo, "utf8"));
  const arquivoPlanilhaRelativo = catalogoAplicacao?.configuracao?.arquivoPlanilhaConvenios;

  if (!arquivoPlanilhaRelativo) {
    throw new Error("Configuracao arquivoPlanilhaConvenios nao encontrada em backend/data/aplicacao.json.");
  }

  const caminhoPlanilha = path.join(repoRoot, arquivoPlanilhaRelativo);
  const workbook = XLSX.readFile(caminhoPlanilha, { cellDates: true });
  const arquivoOrigem = caminhoRelativo(repoRoot, caminhoPlanilha);
  const { abas, linhasExtraidas, totalLinhasLidas } = extrairLinhasPlanoAntigo(workbook, catalogoAplicacao, {
    arquivoOrigem,
  });
  const alertas = [];

  for (const linha of linhasExtraidas) {
    adicionarAlertasLinha(linha, alertas);
  }

  const grupos = agruparPorChaveItem(linhasExtraidas);
  const itensConhecidos = [];
  const rateios = [];

  for (const [chaveItem, grupo] of grupos.entries()) {
    adicionarAlertasGrupo(chaveItem, grupo, alertas);
    rateios.push(...agregarRateiosPorArea(grupo));
    itensConhecidos.push(montarItemConhecido(chaveItem, grupo, alertas));
  }

  const resumo = montarResumo({
    totalLinhasLidas,
    itensConhecidos,
    rateios,
    alertas,
    abas,
    arquivoPlanilha: arquivoOrigem,
  });

  return {
    itensConhecidos,
    rateios,
    alertas,
    resumo,
  };
}

module.exports = {
  COLUNAS_PLANO_PROFOR,
  normalizarDescricaoRateioProfor,
  criarChaveItemRateioProfor,
  listarAbasUfPlanoAplicacao,
  extrairRateioInicialProfor2022DryRun,
};

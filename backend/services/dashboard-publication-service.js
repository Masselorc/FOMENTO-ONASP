const path = require("path");
const xlsx = require("xlsx");
const { resolverOrigemDadosProfor2022 } = require("./profor-2022/profor-origem-service");
const { montarConsolidadoProfor2022 } = require("./profor-2022/profor-consolidado-service");
const {
  carregarPlanoAplicacaoReconstrucaoPad,
} = require("./profor-2022/profor-pad-origem-reconstrucao-service");
const {
  obterUltimaAtualizacaoDadosProfor2022
} = require("./profor-2022/profor-atualizacao-meta-service");

const ABA_RESUMO_CONVENIOS = "Geral";
const COLUNA_VALOR_OUVIDORIA_GERAL = 18;
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

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function converterNumeroPlanilha(valor) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor !== "string") {
    return 0;
  }

  const texto = valor.trim();
  if (!texto) return 0;

  const numeroNormalizado = texto
    .replace(/\s+/g, "")
    .replace(/^R\$/i, "")
    .replace(/%$/, "");

  if (numeroNormalizado.includes(",") && numeroNormalizado.includes(".")) {
    return Number.parseFloat(numeroNormalizado.replace(/\./g, "").replace(",", ".")) || 0;
  }

  if (numeroNormalizado.includes(",")) {
    return Number.parseFloat(numeroNormalizado.replace(",", ".")) || 0;
  }

  return Number.parseFloat(numeroNormalizado) || 0;
}

function converterPercentualPlanilha(valor) {
  const numero = converterNumeroPlanilha(valor);
  return Math.abs(numero) <= 1.5 ? numero * 100 : numero;
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

function somarCampoMoeda(itens, campo) {
  const totalCentavos = itens.reduce((total, item) => (
    total + moedaParaCentavos(item[campo])
  ), 0);

  return centavosParaMoeda(totalCentavos);
}

function obterLinhasPlanilha(sheet) {
  return xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false
  });
}

function obterTextoCelula(linha, indice, fallback = "-") {
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
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

function formatarDataPlanilha(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return "";
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return formatarDataPtBr(valor);
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    if (valor <= 0) return "";
    const dataFormatada = xlsx.SSF?.format?.("dd/mm/yyyy", valor);
    if (dataFormatada) return limparTexto(dataFormatada);

    const data = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 86400000));
    return formatarDataPtBr(data, true);
  }

  const texto = limparTexto(valor);
  const textoNumerico = texto.replace(",", ".");
  if (/^\d+([.,]\d+)?$/.test(texto) && Number(textoNumerico) > 20000 && Number(textoNumerico) < 80000) {
    return formatarDataPlanilha(Number(textoNumerico));
  }

  return texto;
}

function obterDataCelula(linha, indice) {
  if (indice < 0 || linha[indice] === undefined || linha[indice] === null) {
    return "";
  }

  return formatarDataPlanilha(linha[indice]);
}

function formatarMoedaMensagem(centavos) {
  return centavosParaMoeda(centavos).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function anexarMetadadosOrigemProfor2022(dados, metadados = {}) {
  const avisos = Array.isArray(metadados.avisos) ? metadados.avisos : [];

  return {
    ...dados,
    origemDados: metadados.origemDados || "planilha",
    origemDadosEfetiva: metadados.origemDadosEfetiva || "planilha",
    fallbackUsado: Boolean(metadados.fallbackUsado),
    avisos,
    diagnostico: {
      totalConvenios: dados?.convenios?.length || 0,
      totalAvisos: avisos.length,
      ...(metadados.diagnostico || {})
    }
  };
}

function obterUltimaAtualizacaoDadosSeguro() {
  try {
    return obterUltimaAtualizacaoDadosProfor2022();
  } catch (_err) {
    return { dataHora: null, fonte: null, fontesConsideradas: { detru: null, rendimentos: null } };
  }
}

function anexarUltimaAtualizacaoDados(dados) {
  return {
    ...dados,
    ultimaAtualizacaoDados: obterUltimaAtualizacaoDadosSeguro()
  };
}

function montarDadosProfor2022Publicacao(workbook, catalogoAplicacao, opcoes = {}) {
  const origemResolvida = resolverOrigemDadosProfor2022({
    origemDados: opcoes.origemDados,
    detalhado: true
  });

  if (origemResolvida.origemDados !== "reconstrucao-pad") {
    throw new Error(
      `[montarDadosProfor2022Publicacao] Origem de dados invalida ou removida: '${origemResolvida.origemDados}'. ` +
        `Use reconstrucao-pad.`
    );
  }

  const carregar = opcoes.carregarPlanoReconstrucaoPad || carregarPlanoAplicacaoReconstrucaoPad;
  const { planoAplicacao: planoReconstruido, metadados } = carregar({
    caminho: opcoes.caminhoReconstrucaoPad,
    conveniosEsperados: opcoes.conveniosEsperadosReconstrucaoPad,
    minimoLinhasExigido: opcoes.minimoLinhasExigidoReconstrucaoPad,
  });
  const montarConsolidado = opcoes.montarConsolidado || montarConsolidadoProfor2022;
  const consolidado = montarConsolidado({
    origemDados: "reconstrucao-pad",
    planoAplicacao: planoReconstruido,
  });
  return anexarUltimaAtualizacaoDados(anexarMetadadosOrigemProfor2022(consolidado, {
    origemDados: "reconstrucao-pad",
    origemDadosEfetiva: "reconstrucao-pad",
    avisos: origemResolvida.avisos || [],
    diagnostico: {
      reconstrucaoPad: metadados,
    },
  }));
}

function removerConveniosDoDadosBase(dadosBase) {
  return (dadosBase || []).filter((item) => !normalizarTexto(item.instrumento).includes("CONV"));
}

function calcularResumoDashboard(dadosBase) {
  const resumo = {
    totalFomentoCentavos: 0,
    totalConveniosCentavos: 0,
    totalFafCentavos: 0,
    totalDoacoesCentavos: 0,
    ufsConvenios: new Set()
  };

  dadosBase.forEach((item) => {
    const instrumento = normalizarTexto(item.instrumento);
    const valorTotalCentavos = moedaParaCentavos(item.valorTotal);

    if (instrumento.includes("CONV")) {
      resumo.totalConveniosCentavos += valorTotalCentavos;
      if (item.uf && valorTotalCentavos > 0) resumo.ufsConvenios.add(item.uf);
    } else if (instrumento.includes("FAF")) {
      resumo.totalFafCentavos += valorTotalCentavos;
    } else if (instrumento.includes("DOA")) {
      resumo.totalDoacoesCentavos += valorTotalCentavos;
    }
  });

  resumo.totalFomentoCentavos = resumo.totalConveniosCentavos
    + resumo.totalFafCentavos
    + resumo.totalDoacoesCentavos;

  return {
    totalFomento: centavosParaMoeda(resumo.totalFomentoCentavos),
    totalConvenios: centavosParaMoeda(resumo.totalConveniosCentavos),
    totalFaf: centavosParaMoeda(resumo.totalFafCentavos),
    totalDoacoes: centavosParaMoeda(resumo.totalDoacoesCentavos),
    ufsConvenios: Array.from(resumo.ufsConvenios).sort(),
    quantidadeUfsConvenios: resumo.ufsConvenios.size
  };
}

function consolidarCatalogoDashboard(catalogoAplicacao, publicadoEm) {
  const dadosBaseConsolidado = [
    ...removerConveniosDoDadosBase(catalogoAplicacao.dadosBase)
  ];
  const dadosProfor2022 = montarDadosProfor2022Publicacao(null, catalogoAplicacao, {
    origemDados: "reconstrucao-pad",
  });
  const conveniosProfor = Array.isArray(dadosProfor2022?.convenios)
    ? dadosProfor2022.convenios
    : [];
  for (const convenio of conveniosProfor) {
    dadosBaseConsolidado.push({
      instrumento: convenio.instrumento || "Convênio",
      uf: convenio.uf || "",
      numero: convenio.numero || convenio.numeroConvenio || "",
      ano: convenio.ano || "2022",
      valorTotal: convenio.valorGlobal || 0,
      valorExecutado: convenio.valorExecutado || 0,
      saldo: convenio.saldo || 0,
      programaOrigem: "PROFOR 2022"
    });
  }
  const resumoDashboard = calcularResumoDashboard(dadosBaseConsolidado);

  if (resumoDashboard.totalConvenios <= 0 || resumoDashboard.quantidadeUfsConvenios <= 0) {
    throw new Error("Publicacao abortada: dados de convenios ausentes no dadosBase publicado.");
  }

  return {
    catalogoPublicado: {
      ...catalogoAplicacao,
      dadosBase: dadosBaseConsolidado,
      dadosProfor2022,
      metadadosPublicacao: {
        publicadoEm,
        fonteDadosBase: "dados consolidados da Home local",
        origemProfor2022: "reconstrucao-pad"
      }
    },
    dashboardGeral: {
      publicadoEm,
      fonteDadosBase: "dados consolidados da Home local",
      dadosBase: dadosBaseConsolidado,
      dadosProfor2022,
      resumoEsperado: resumoDashboard
    },
    resumoDashboard,
    totaisExtracao: {
      itensConvenio: conveniosProfor.length,
      conveniosProfor2022: conveniosProfor.length
    }
  };
}

module.exports = {
  consolidarCatalogoDashboard,
  montarDadosProfor2022Publicacao
};

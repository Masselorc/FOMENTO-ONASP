const path = require("path");
const xlsx = require("xlsx");
const { resolverOrigemDadosProfor2022 } = require("./profor-2022/profor-origem-service");
const { montarConsolidadoProfor2022 } = require("./profor-2022/profor-consolidado-service");
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
        instrumento: "Convênio"
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

    if (!uf || !catalogoAplicacao.nomesEstados[uf] || !instrumento.includes("CONV")) {
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
      `A soma dos convenios extraidos diverge da coluna S da aba Geral. ${divergencias.join("; ")}.`
    );
  }
}

function extrairConveniosDoWorkbook(workbook, catalogoAplicacao) {
  const { configuracao, nomesEstados } = catalogoAplicacao;
  const abasIgnoradas = new Set([
    ABA_RESUMO_CONVENIOS,
    "IND_PRORROG",
    ...(configuracao.abasPlanilhaIgnoradas || [])
  ].map((nomeAba) => normalizarTexto(nomeAba)));
  const abasDeEstado = workbook.SheetNames.filter((sheetName) => (
    nomesEstados[normalizarTexto(sheetName)] && !abasIgnoradas.has(normalizarTexto(sheetName))
  ));

  const dadosConvenio = abasDeEstado.flatMap((sheetName) => (
    extrairItensConvenioDaAba(workbook.Sheets[sheetName], sheetName, configuracao)
  ));

  if (dadosConvenio.length === 0) {
    throw new Error("Nenhum item classificado como OUVIDORIA foi encontrado na planilha.");
  }

  validarConveniosContraAbaGeral(workbook, dadosConvenio, catalogoAplicacao);

  return dadosConvenio;
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
      instrumento: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.instrumento, ""),
      numero: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.numero, ""),
      ano: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.ano, ""),
      area: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.area, "Não informado"),
      natureza: obterTextoCelula(linha, COLUNAS_PLANO_PROFOR.natureza, "Não informado"),
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
    normalizarTexto(item.area) === "OUVIDORIA"
  ));

  return {
    totalItens: planoAplicacao.length,
    totalItensOuvidoria: itensOuvidoria.length,
    valorPrevistoOuvidoriaPlano: somarCampoMoeda(itensOuvidoria, "valorPrevisto"),
    valorExecutadoOuvidoria: somarCampoMoeda(itensOuvidoria, "valorExecutado"),
    previstoCapitalOuvidoria: somarCampoMoeda(
      itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === "CAPITAL"),
      "valorPrevisto"
    ),
    previstoCusteioOuvidoria: somarCampoMoeda(
      itensOuvidoria.filter((item) => normalizarTexto(item.natureza) === "CUSTEIO"),
      "valorPrevisto"
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
    valorGlobal: somarCampoMoeda(convenios, "valorGlobal"),
    valorRepasse: somarCampoMoeda(convenios, "valorRepasse"),
    valorContrapartida: somarCampoMoeda(convenios, "valorContrapartida"),
    repasseDesembolsado: somarCampoMoeda(convenios, "repasseDesembolsado"),
    rendimentoAprovado: somarCampoMoeda(convenios, "rendimentoAprovado"),
    saldoRendimentosAtual: somarCampoMoeda(convenios, "saldoRendimentosAtual"),
    saldoResidualCapital: somarCampoMoeda(convenios, "saldoResidualCapital"),
    saldoResidualCusteio: somarCampoMoeda(convenios, "saldoResidualCusteio"),
    contrapartidaIntegralizada: somarCampoMoeda(convenios, "contrapartidaIntegralizada"),
    valorExecutadoGeral: somarCampoMoeda(convenios, "valorExecutadoGeral"),
    previstoOuvidoria: centavosParaMoeda(totalPrevistoOuvidoriaCentavos),
    previstoCorregedoria: somarCampoMoeda(convenios, "previstoCorregedoria"),
    previstoEscolaPenal: somarCampoMoeda(convenios, "previstoEscolaPenal"),
    valorExecutadoOuvidoria: centavosParaMoeda(totalExecutadoOuvidoriaCentavos),
    execucaoGeralPercentual: somarCampoMoeda(convenios, "valorGlobal") > 0
      ? (somarCampoMoeda(convenios, "valorExecutadoGeral") / somarCampoMoeda(convenios, "valorGlobal")) * 100
      : 0,
    execucaoOuvidoriaPercentual: totalPrevistoOuvidoriaCentavos > 0
      ? (totalExecutadoOuvidoriaCentavos / totalPrevistoOuvidoriaCentavos) * 100
      : 0,
    saldoDisponivelOuvidoria: somarCampoMoeda(convenios, "saldoDisponivelOuvidoria")
  };
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

function extrairProfor2022DoWorkbook(workbook, catalogoAplicacao) {
  const sheetGeral = workbook.Sheets[ABA_RESUMO_CONVENIOS];
  if (!sheetGeral) {
    throw new Error(`A aba ${ABA_RESUMO_CONVENIOS} nao foi encontrada na planilha.`);
  }

  const linhas = obterLinhasPlanilha(sheetGeral);
  const convenios = linhas.slice(1).map((linha) => {
    const uf = normalizarTexto(linha[COLUNAS_GERAL_PROFOR.uf]);
    const instrumento = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.instrumento, "");
    const ano = obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.ano, "");

    if (!uf || !catalogoAplicacao.nomesEstados[uf] || !normalizarTexto(instrumento).includes("CONV") || ano !== "2022") {
      return null;
    }

    const planoAplicacao = extrairPlanoAplicacaoProforDaAba(workbook.Sheets[uf], uf);
    const resumoPlano = resumirPlanoAplicacaoProfor(planoAplicacao);

    return {
      uf,
      instrumento,
      numero: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.numero, ""),
      ano,
      processoSei: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.processoSei, ""),
      vencimento: obterDataCelula(linha, COLUNAS_GERAL_PROFOR.vencimento),
      quantidadeTa: converterNumeroPlanilha(linha[COLUNAS_GERAL_PROFOR.quantidadeTa]),
      solicitouProrrogacao: obterTextoCelula(linha, COLUNAS_GERAL_PROFOR.solicitouProrrogacao, ""),
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
    throw new Error("Nenhum convenio PROFOR 2022 foi encontrado na aba Geral.");
  }

  return anexarMetadadosOrigemProfor2022({
    resumo: montarResumoProfor2022(convenios),
    convenios,
    filtros: {
      ufs: convenios.map((convenio) => convenio.uf).sort(),
      areas: Array.from(new Set(
        convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.area))
      )).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
      naturezas: Array.from(new Set(
        convenios.flatMap((convenio) => convenio.planoAplicacao.map((item) => item.natureza))
      )).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"))
    }
  });
}

function listarAbasEstadoProfor(workbook, catalogoAplicacao) {
  const { configuracao, nomesEstados } = catalogoAplicacao;
  const abasIgnoradas = new Set([
    ABA_RESUMO_CONVENIOS,
    "IND_PRORROG",
    ...(configuracao.abasPlanilhaIgnoradas || [])
  ].map((nomeAba) => normalizarTexto(nomeAba)));

  return workbook.SheetNames.filter((sheetName) => (
    nomesEstados[normalizarTexto(sheetName)] && !abasIgnoradas.has(normalizarTexto(sheetName))
  ));
}

function extrairPlanoAplicacaoProforDoWorkbook(workbook, catalogoAplicacao) {
  return listarAbasEstadoProfor(workbook, catalogoAplicacao)
    .flatMap((sheetName) => extrairPlanoAplicacaoProforDaAba(workbook.Sheets[sheetName], sheetName));
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

function validarConsolidadoProfor2022Publicavel(dadosConsolidados) {
  const diagnostico = dadosConsolidados?.diagnostico || {};
  const conveniosLength = Array.isArray(dadosConsolidados?.convenios) ? dadosConsolidados.convenios.length : 0;
  const totalComDetru = Number(diagnostico.totalComDetru ?? 0);
  const totalComPlano = Number(diagnostico.totalComPlano ?? 0);
  const totalComRendimentos = Number(diagnostico.totalComRendimentos ?? 0);
  const totalCarteira = Number(diagnostico.totalCarteira ?? conveniosLength);
  const ultimaAtualizacao = dadosConsolidados?.ultimaAtualizacaoDados;
  const dataHora = ultimaAtualizacao && typeof ultimaAtualizacao === "object" ? ultimaAtualizacao.dataHora : null;

  if (
    totalCarteira !== 15 ||
    conveniosLength !== 15 ||
    totalComDetru !== 15 ||
    totalComPlano !== 15 ||
    totalComRendimentos !== 15
  ) {
    throw new Error(
      `Publicação bloqueada: consolidado PROFOR 2022 incompleto. ` +
        `Esperado 15/15/15. Obtido carteira=${totalCarteira}, ` +
        `detru=${totalComDetru}, plano=${totalComPlano}, rendimentos=${totalComRendimentos}.`
    );
  }

  if (!dataHora || typeof dataHora !== "string" || dataHora.trim() === "") {
    throw new Error(
      "Publicação bloqueada: dadosProfor2022.ultimaAtualizacaoDados.dataHora ausente no consolidado banco-cache."
    );
  }
}

function montarDadosProfor2022Publicacao(workbook, catalogoAplicacao, opcoes = {}) {
  const origemResolvida = resolverOrigemDadosProfor2022({
    origemDados: opcoes.origemDados,
    detalhado: true
  });

  if (origemResolvida.origemDados !== "banco-cache") {
    const dadosPlanilha = extrairProfor2022DoWorkbook(workbook, catalogoAplicacao);
    return anexarUltimaAtualizacaoDados(anexarMetadadosOrigemProfor2022(dadosPlanilha, {
      origemDados: "planilha",
      origemDadosEfetiva: "planilha",
      avisos: origemResolvida.avisos || []
    }));
  }

  const montarConsolidado = opcoes.montarConsolidado || montarConsolidadoProfor2022;
  const planoAplicacao = opcoes.planoAplicacao || extrairPlanoAplicacaoProforDoWorkbook(workbook, catalogoAplicacao);
  const consolidado = montarConsolidado({
    origemDados: "banco-cache",
    planoAplicacao
  });
  const dadosConsolidados = anexarUltimaAtualizacaoDados(consolidado);
  validarConsolidadoProfor2022Publicavel(dadosConsolidados);
  return dadosConsolidados;
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
  const planilhaRelativa = catalogoAplicacao?.configuracao?.arquivoPlanilhaConvenios;
  if (!planilhaRelativa) {
    throw new Error("Catalogo da aplicacao sem configuracao.arquivoPlanilhaConvenios.");
  }

  const planilhaPath = path.join(__dirname, "..", "..", planilhaRelativa);
  const workbook = xlsx.readFile(planilhaPath, { cellDates: true });
  const dadosConvenio = extrairConveniosDoWorkbook(workbook, catalogoAplicacao);
  const dadosBaseConsolidado = [
    ...removerConveniosDoDadosBase(catalogoAplicacao.dadosBase),
    ...dadosConvenio
  ];
  const dadosProfor2022 = montarDadosProfor2022Publicacao(workbook, catalogoAplicacao);
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
        arquivoPlanilhaConvenios: planilhaRelativa
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
      itensConvenio: dadosConvenio.length,
      conveniosProfor2022: dadosProfor2022.convenios.length
    }
  };
}

module.exports = {
  consolidarCatalogoDashboard,
  montarDadosProfor2022Publicacao,
  extrairPlanoAplicacaoProforDoWorkbook,
  validarConsolidadoProfor2022Publicavel
};

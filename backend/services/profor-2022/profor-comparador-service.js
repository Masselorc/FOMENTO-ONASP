const {
  moedaParaNumeroProfor,
  normalizarAnoProfor,
  normalizarNumeroConvenio,
  normalizarTextoProfor,
} = require("./profor-plano-aplicacao-service");

const CAMPOS_CONVENIO_COMPARACAO = [
  { campo: "uf", tipo: "texto", severidade: "media" },
  { campo: "numero", tipo: "texto", severidade: "alta", obter: (item) => item?.numero ?? item?.numeroConvenio },
  { campo: "ano", tipo: "texto", severidade: "alta" },
  { campo: "processoSei", tipo: "texto", severidade: "media" },
  { campo: "vencimento", tipo: "texto", severidade: "media" },
  { campo: "quantidadeTa", tipo: "numero", severidade: "baixa" },
  { campo: "valorGlobal", tipo: "moeda", severidade: "alta" },
  { campo: "valorRepasse", tipo: "moeda", severidade: "alta" },
  { campo: "valorContrapartida", tipo: "moeda", severidade: "alta" },
  { campo: "repasseDesembolsado", tipo: "moeda", severidade: "alta" },
  { campo: "rendimentoAprovado", tipo: "moeda", severidade: "media" },
  { campo: "saldoRendimentosAtual", tipo: "moeda", severidade: "media" },
  { campo: "contrapartidaIntegralizada", tipo: "moeda", severidade: "media" },
  { campo: "valorExecutadoGeral", tipo: "moeda", severidade: "alta" },
  { campo: "previstoOuvidoria", tipo: "moeda", severidade: "alta" },
  { campo: "previstoCorregedoria", tipo: "moeda", severidade: "media" },
  { campo: "previstoEscolaPenal", tipo: "moeda", severidade: "media" },
  { campo: "valorExecutadoOuvidoria", tipo: "moeda", severidade: "alta" },
  { campo: "saldoResidualCapital", tipo: "moeda", severidade: "media" },
  { campo: "saldoResidualCusteio", tipo: "moeda", severidade: "media" },
  { campo: "execucaoGeralPercentual", tipo: "percentual", severidade: "media" },
  { campo: "execucaoOuvidoriaPercentual", tipo: "percentual", severidade: "media" },
];

function valorAusente(valor) {
  return valor === undefined || valor === null || valor === "";
}

function maiorSeveridade(a, b) {
  const pesos = { baixa: 1, media: 2, alta: 3 };
  return pesos[b] > pesos[a] ? b : a;
}

function criarChaveComparacao(convenio) {
  const numero = normalizarNumeroConvenio(convenio?.numeroConvenio ?? convenio?.numero);
  const ano = normalizarAnoProfor(convenio?.ano);
  return numero ? `${numero}::${ano || ""}` : null;
}

function compararMoedaProfor(valorAntigo, valorNovo, tolerancia = 0.01) {
  if (valorAusente(valorAntigo) && valorAusente(valorNovo)) {
    return { status: "igual", severidade: "baixa", diferenca: 0 };
  }
  if (valorAusente(valorAntigo)) return { status: "ausente_antigo", severidade: "media", diferenca: null };
  if (valorAusente(valorNovo)) return { status: "ausente_novo", severidade: "media", diferenca: null };

  const antigo = moedaParaNumeroProfor(valorAntigo);
  const novo = moedaParaNumeroProfor(valorNovo);
  const diferenca = Math.round(Math.abs(antigo - novo) * 100) / 100;
  if (diferenca <= tolerancia) return { status: "igual", severidade: "baixa", diferenca };
  if (diferenca <= 1) return { status: "divergente", severidade: "baixa", diferenca };
  if (diferenca <= 100) return { status: "divergente", severidade: "media", diferenca };
  return { status: "divergente", severidade: "alta", diferenca };
}

function compararPercentualProfor(valorAntigo, valorNovo, tolerancia = 0.1) {
  if (valorAusente(valorAntigo) && valorAusente(valorNovo)) {
    return { status: "igual", severidade: "baixa", diferenca: 0 };
  }
  if (valorAusente(valorAntigo)) return { status: "ausente_antigo", severidade: "media", diferenca: null };
  if (valorAusente(valorNovo)) return { status: "ausente_novo", severidade: "media", diferenca: null };

  const antigo = Number(valorAntigo);
  const novo = Number(valorNovo);
  const diferenca = Math.round(Math.abs(antigo - novo) * 100) / 100;
  if (diferenca <= tolerancia) return { status: "igual", severidade: "baixa", diferenca };
  if (diferenca <= 1) return { status: "divergente", severidade: "baixa", diferenca };
  if (diferenca <= 5) return { status: "divergente", severidade: "media", diferenca };
  return { status: "divergente", severidade: "alta", diferenca };
}

function compararNumeroProfor(valorAntigo, valorNovo, tolerancia = 0) {
  if (valorAusente(valorAntigo) && valorAusente(valorNovo)) {
    return { status: "igual", severidade: "baixa", diferenca: 0 };
  }
  if (valorAusente(valorAntigo)) return { status: "ausente_antigo", severidade: "media", diferenca: null };
  if (valorAusente(valorNovo)) return { status: "ausente_novo", severidade: "media", diferenca: null };

  const antigo = Number(valorAntigo);
  const novo = Number(valorNovo);
  if (!Number.isFinite(antigo) || !Number.isFinite(novo)) {
    return compararTextoProfor(valorAntigo, valorNovo);
  }

  const diferenca = Math.abs(antigo - novo);
  if (diferenca <= tolerancia) return { status: "igual", severidade: "baixa", diferenca };
  return { status: "divergente", severidade: diferenca <= 1 ? "baixa" : "media", diferenca };
}

function compararTextoProfor(valorAntigo, valorNovo) {
  if (valorAusente(valorAntigo) && valorAusente(valorNovo)) return { status: "igual", severidade: "baixa" };
  if (valorAusente(valorAntigo)) return { status: "ausente_antigo", severidade: "media" };
  if (valorAusente(valorNovo)) return { status: "ausente_novo", severidade: "media" };

  const antigo = normalizarTextoProfor(valorAntigo);
  const novo = normalizarTextoProfor(valorNovo);
  return antigo === novo
    ? { status: "igual", severidade: "baixa" }
    : { status: "divergente", severidade: "media" };
}

function compararCampo(campoConfig, convenioAntigo, convenioNovo, opcoes) {
  const valorAntigo = campoConfig.obter ? campoConfig.obter(convenioAntigo) : convenioAntigo?.[campoConfig.campo];
  const valorNovo = campoConfig.obter ? campoConfig.obter(convenioNovo) : convenioNovo?.[campoConfig.campo];
  let resultado;

  if (campoConfig.tipo === "moeda") {
    resultado = compararMoedaProfor(valorAntigo, valorNovo, opcoes.toleranciaMoeda ?? 0.01);
  } else if (campoConfig.tipo === "percentual") {
    resultado = compararPercentualProfor(valorAntigo, valorNovo, opcoes.toleranciaPercentual ?? 0.1);
  } else if (campoConfig.tipo === "numero") {
    resultado = compararNumeroProfor(valorAntigo, valorNovo, opcoes.toleranciaNumero ?? 0);
  } else {
    resultado = compararTextoProfor(valorAntigo, valorNovo);
  }

  const severidade = resultado.status === "igual"
    ? "baixa"
    : maiorSeveridade(resultado.severidade, campoConfig.severidade);

  return {
    campo: campoConfig.campo,
    status: resultado.status,
    severidade,
    valorAntigo: valorAntigo ?? null,
    valorNovo: valorNovo ?? null,
    diferenca: resultado.diferenca ?? null,
  };
}

function compararConvenioProfor2022(convenioAntigo, convenioNovo, opcoes = {}) {
  const chave = criarChaveComparacao(convenioAntigo) || criarChaveComparacao(convenioNovo);
  const divergencias = CAMPOS_CONVENIO_COMPARACAO
    .map((campo) => compararCampo(campo, convenioAntigo, convenioNovo, opcoes))
    .filter((item) => item.status !== "igual");

  return {
    chave,
    numeroConvenio: normalizarNumeroConvenio(convenioNovo?.numeroConvenio ?? convenioNovo?.numero ?? convenioAntigo?.numeroConvenio ?? convenioAntigo?.numero),
    ano: normalizarAnoProfor(convenioNovo?.ano ?? convenioAntigo?.ano),
    status: divergencias.length ? "divergente" : "igual",
    severidade: divergencias.reduce((acc, item) => maiorSeveridade(acc, item.severidade), "baixa"),
    totalDivergencias: divergencias.length,
    divergencias,
  };
}

function compararResumoProfor2022(resumoAntigo, resumoNovo, opcoes = {}) {
  const camposResumo = [
    "totalConvenios",
    "valorGlobal",
    "valorRepasse",
    "valorContrapartida",
    "repasseDesembolsado",
    "rendimentoAprovado",
    "saldoRendimentosAtual",
    "saldoResidualCapital",
    "saldoResidualCusteio",
    "contrapartidaIntegralizada",
    "valorExecutadoGeral",
    "previstoOuvidoria",
    "previstoCorregedoria",
    "previstoEscolaPenal",
    "valorExecutadoOuvidoria",
    "execucaoGeralPercentual",
    "execucaoOuvidoriaPercentual",
  ];

  const divergencias = camposResumo
    .map((campo) => {
      const tipo = campo.includes("Percentual") ? "percentual" : "moeda";
      return compararCampo({ campo, tipo, severidade: "media" }, resumoAntigo, resumoNovo, opcoes);
    })
    .filter((item) => item.status !== "igual");

  return {
    status: divergencias.length ? "divergente" : "igual",
    totalDivergencias: divergencias.length,
    divergencias,
  };
}

function extrairConvenios(base) {
  if (Array.isArray(base)) return base;
  return Array.isArray(base?.convenios) ? base.convenios : [];
}

function extrairResumo(base) {
  return base?.resumo ?? null;
}

function indexarConvenios(convenios) {
  const indice = {};
  const semChave = [];
  for (const convenio of convenios) {
    const chave = criarChaveComparacao(convenio);
    if (!chave) {
      semChave.push(convenio);
      continue;
    }
    indice[chave] ??= [];
    indice[chave].push(convenio);
  }
  return { indice, semChave };
}

function compararBasesProfor2022(baseAntiga, baseNova, opcoes = {}) {
  const conveniosAntigos = extrairConvenios(baseAntiga);
  const conveniosNovos = extrairConvenios(baseNova);
  const antigos = indexarConvenios(conveniosAntigos);
  const novos = indexarConvenios(conveniosNovos);
  const chaves = new Set([...Object.keys(antigos.indice), ...Object.keys(novos.indice)]);
  const divergencias = [];
  let totalIguais = 0;
  let totalComDivergencia = 0;
  let totalAusentesAntigo = 0;
  let totalAusentesNovo = 0;

  for (const chave of chaves) {
    const antigo = antigos.indice[chave]?.[0] ?? null;
    const novo = novos.indice[chave]?.[0] ?? null;

    if (!antigo) {
      totalAusentesAntigo += 1;
      divergencias.push({ chave, status: "ausente_antigo", severidade: "alta", divergencias: [] });
      continue;
    }
    if (!novo) {
      totalAusentesNovo += 1;
      divergencias.push({ chave, status: "ausente_novo", severidade: "alta", divergencias: [] });
      continue;
    }

    const comparacao = compararConvenioProfor2022(antigo, novo, opcoes);
    if (comparacao.status === "igual") totalIguais += 1;
    else {
      totalComDivergencia += 1;
      divergencias.push(comparacao);
    }
  }

  const resumoComparacao = compararResumoProfor2022(extrairResumo(baseAntiga), extrairResumo(baseNova), opcoes);
  const comparacao = {
    geradoEm: new Date().toISOString(),
    totalAntigo: conveniosAntigos.length,
    totalNovo: conveniosNovos.length,
    totalIguais,
    totalComDivergencia,
    totalAusentesAntigo,
    totalAusentesNovo,
    divergencias,
    resumo: {
      ...gerarResumoDivergenciasProfor2022({ divergencias }),
      resumoComparacao,
    },
  };

  return comparacao;
}

function gerarResumoDivergenciasProfor2022(comparacao) {
  const resumo = {
    porStatus: {},
    porSeveridade: {},
    porCampo: {},
  };

  for (const item of comparacao?.divergencias || []) {
    resumo.porStatus[item.status] = (resumo.porStatus[item.status] || 0) + 1;
    resumo.porSeveridade[item.severidade] = (resumo.porSeveridade[item.severidade] || 0) + 1;
    for (const campo of item.divergencias || []) {
      resumo.porCampo[campo.campo] = (resumo.porCampo[campo.campo] || 0) + 1;
    }
  }

  return resumo;
}

module.exports = {
  compararMoedaProfor,
  compararPercentualProfor,
  compararNumeroProfor,
  compararTextoProfor,
  compararConvenioProfor2022,
  compararResumoProfor2022,
  compararBasesProfor2022,
  gerarResumoDivergenciasProfor2022,
};

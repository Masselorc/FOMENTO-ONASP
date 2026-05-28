const { listarConveniosMonitorados } = require("./convenios-monitorados-service");
const { listarCacheDetruProfor2022 } = require("./profor-detru-cache-service");
const { listarSaldosRendimentosCache } = require("./transferegov-rendimentos-cache-service");
const {
  arredondarMoedaProfor,
  calcularEconomicidadeItem,
  filtrarPlanoAplicacaoSeguro,
  moedaParaNumeroProfor,
  normalizarAnoProfor,
  normalizarNumeroConvenio,
  normalizarTextoProfor,
} = require("./profor-plano-aplicacao-service");
const {
  aplicarCalculosInternosProfor,
  calcularResumoGeralProfor,
} = require("./profor-calculos-service");
const { resolverOrigemDadosProfor2022 } = require("./profor-origem-service");

function criarChaveConvenioProfor(numeroConvenio, ano) {
  const numero = normalizarNumeroConvenio(numeroConvenio);
  const anoNormalizado = normalizarAnoProfor(ano);
  return numero ? `${numero}::${anoNormalizado || ""}` : null;
}

function extrairNumeroRegistro(registro) {
  return normalizarNumeroConvenio(
    registro?.numeroConvenio ?? registro?.numero ?? registro?.dados?.numeroConvenio ?? registro?.dados?.numero
  );
}

function extrairAnoRegistro(registro) {
  return normalizarAnoProfor(registro?.ano ?? registro?.dados?.ano);
}

function indexarRegistrosPorNumeroAno(registros, opcoes = {}) {
  const indice = {
    porChave: {},
    porNumero: {},
    duplicidades: [],
    avisos: [],
  };
  const nomeFonte = opcoes.nomeFonte || "registros";

  for (const registro of Array.isArray(registros) ? registros : []) {
    const numero = extrairNumeroRegistro(registro);
    const ano = extrairAnoRegistro(registro);
    const chave = criarChaveConvenioProfor(numero, ano);

    if (!numero || !chave) {
      indice.avisos.push(`Registro ignorado em ${nomeFonte}: numero de convenio ausente ou invalido.`);
      continue;
    }

    indice.porChave[chave] ??= [];
    indice.porChave[chave].push(registro);
    indice.porNumero[numero] ??= [];
    indice.porNumero[numero].push(registro);

    if (indice.porChave[chave].length > 1) {
      indice.duplicidades.push({ chave, numero, ano });
      indice.avisos.push(`Duplicidade em ${nomeFonte} para ${numero}/${ano || "s/ano"}.`);
    }
  }

  return indice;
}

function obterRegistroPorNumeroAno(indice, numeroConvenio, ano) {
  const numero = normalizarNumeroConvenio(numeroConvenio);
  const anoNormalizado = normalizarAnoProfor(ano);
  if (!numero || !indice) return null;

  if (anoNormalizado) {
    const registros = indice.porChave?.[criarChaveConvenioProfor(numero, anoNormalizado)] || [];
    return registros.length === 1 ? registros[0] : null;
  }

  const registrosPorNumero = indice.porNumero?.[numero] || [];
  return registrosPorNumero.length === 1 ? registrosPorNumero[0] : null;
}

function normalizarCarteiraConvenioProfor(convenio) {
  const numeroConvenio = normalizarNumeroConvenio(convenio?.numeroConvenio ?? convenio?.numero);
  const ano = normalizarAnoProfor(convenio?.ano);
  const uf = convenio?.uf ? normalizarTextoProfor(convenio.uf) : null;

  return {
    ...convenio,
    uf,
    instrumento: convenio?.instrumento ?? null,
    numero: numeroConvenio,
    numeroConvenio,
    ano,
  };
}

function normalizarItemPlanoConsolidado(item) {
  const valorPrevisto = moedaParaNumeroProfor(item?.valorPrevisto);
  const valorExecutado = moedaParaNumeroProfor(item?.valorExecutado);

  return {
    ...item,
    saldo: arredondarMoedaProfor(valorPrevisto - valorExecutado),
    saldoEconomicidade: calcularEconomicidadeItem(item, []),
    percentualExecucao: valorPrevisto > 0 ? Math.round((valorExecutado / valorPrevisto) * 10000) / 100 : 0,
  };
}

function normalizarPlanoConsolidado(planoAplicacao) {
  return (Array.isArray(planoAplicacao) ? planoAplicacao : []).map(normalizarItemPlanoConsolidado);
}

function obterPlanoPorChave(planoAplicacao, numeroConvenio, ano, avisos, filtros = {}) {
  if (Array.isArray(planoAplicacao)) {
    const filtragem = filtrarPlanoAplicacaoSeguro(planoAplicacao, {
      uf: filtros.uf,
      numeroConvenio,
      ano,
    });
    avisos.push(...filtragem.avisos);
    if (numeroConvenio && filtragem.itens.length === 0) {
      avisos.push(`Plano de aplicacao nao encontrado para ${numeroConvenio}/${normalizarAnoProfor(ano) || "s/ano"}.`);
    }
    return normalizarPlanoConsolidado(filtragem.itens);
  }

  if (!planoAplicacao || typeof planoAplicacao !== "object") {
    avisos.push("Plano de aplicacao ausente; calculos do plano retornarao zero.");
    return [];
  }

  const numero = normalizarNumeroConvenio(numeroConvenio);
  const anoNormalizado = normalizarAnoProfor(ano);
  const chave = criarChaveConvenioProfor(numero, anoNormalizado);

  if (chave && Array.isArray(planoAplicacao[chave])) return normalizarPlanoConsolidado(planoAplicacao[chave]);
  if (numero && Array.isArray(planoAplicacao[numero])) return normalizarPlanoConsolidado(planoAplicacao[numero]);

  if (numero && !anoNormalizado) {
    const chaves = Object.keys(planoAplicacao).filter((item) => item === numero || item.startsWith(`${numero}::`));
    if (chaves.length === 1 && Array.isArray(planoAplicacao[chaves[0]])) {
      return normalizarPlanoConsolidado(planoAplicacao[chaves[0]]);
    }
    if (chaves.length > 1) {
      avisos.push(`Plano de aplicacao nao escolhido para ${numero}: ha mais de uma chave possivel.`);
      return [];
    }
  }

  avisos.push(`Plano de aplicacao nao encontrado para ${numero || "s/numero"}/${anoNormalizado || "s/ano"}.`);
  return [];
}

function montarFontesConvenioProfor(convenio, fontes) {
  const avisos = [];
  const normalizado = normalizarCarteiraConvenioProfor(convenio);
  const detru =
    fontes?.detru ??
    obterRegistroPorNumeroAno(fontes?.detruIndice, normalizado.numeroConvenio, normalizado.ano);
  const transferegov =
    fontes?.transferegov ??
    fontes?.rendimentos ??
    obterRegistroPorNumeroAno(fontes?.rendimentosIndice, normalizado.numeroConvenio, normalizado.ano);
  const planoAplicacao = obterPlanoPorChave(
    fontes?.planoAplicacao,
    normalizado.numeroConvenio,
    normalizado.ano,
    avisos,
    { uf: normalizado.uf }
  );

  if (!detru) avisos.push(`Cache DETRU ausente para ${normalizado.numeroConvenio || "s/numero"}/${normalizado.ano || "s/ano"}.`);
  if (!transferegov) {
    avisos.push(
      `Cache Transferegov de rendimentos ausente para ${normalizado.numeroConvenio || "s/numero"}/${normalizado.ano || "s/ano"}.`
    );
  }

  return {
    convenio: normalizado,
    detru,
    transferegov,
    planoAplicacao,
    avisos,
  };
}

function montarConvenioConsolidadoProfor(convenio, fontes = {}) {
  const origemDados = fontes.origemDados || "banco-cache";
  const fontesConvenio = montarFontesConvenioProfor(convenio, fontes);
  const { convenio: base, detru, transferegov, planoAplicacao } = fontesConvenio;
  const calculado = aplicarCalculosInternosProfor(base, {
    detru,
    transferegov,
    planoAplicacao,
  });
  const detruDados = detru?.dados ?? detru ?? {};
  const fontesUtilizadas = ["Carteira local", ...calculado.fontesUtilizadas];
  const avisos = [
    ...fontesConvenio.avisos,
    ...calculado.avisos,
  ];

  return {
    uf: base.uf,
    instrumento: base.instrumento,
    numero: base.numeroConvenio,
    numeroConvenio: base.numeroConvenio,
    ano: base.ano,
    processoSei: calculado.processoSei ?? detruDados.processoSei ?? null,
    vencimento: calculado.vencimento ?? detruDados.vencimento ?? null,
    quantidadeTa: calculado.quantidadeTa ?? detruDados.quantidadeTa ?? null,
    valorGlobal: calculado.valorGlobal,
    valorRepasse: calculado.valorRepasse,
    valorContrapartida: calculado.valorContrapartida,
    repasseDesembolsado: calculado.repasseDesembolsado,
    rendimentoAprovado: calculado.rendimentoAprovado,
    saldoRendimentosAtual: calculado.saldoRendimentosAtual,
    saldoDisponivelOuvidoria: calculado.saldoDisponivelOuvidoria,
    saldoEconomicidadeCapital: calculado.saldoEconomicidadeCapital,
    saldoEconomicidadeCusteio: calculado.saldoEconomicidadeCusteio,
    saldoPotencialDestinavelOuvidoria: calculado.saldoPotencialDestinavelOuvidoria,
    saldoResidualCapital: calculado.saldoResidualCapital,
    saldoResidualCusteio: calculado.saldoResidualCusteio,
    contrapartidaIntegralizada: calculado.contrapartidaIntegralizada,
    valorExecutadoGeral: calculado.valorExecutadoGeral,
    previstoOuvidoria: calculado.previstoOuvidoria,
    previstoCorregedoria: calculado.previstoCorregedoria,
    previstoEscolaPenal: calculado.previstoEscolaPenal,
    valorPrevistoGeral: calculado.valorPrevistoGeral,
    valorExecutadoOuvidoria: calculado.valorExecutadoOuvidoria,
    valorExecutadoCorregedoria: calculado.valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal: calculado.valorExecutadoEscolaPenal,
    execucaoGeralPercentual: calculado.execucaoGeralPercentual,
    execucaoOuvidoriaPercentual: calculado.execucaoOuvidoriaPercentual,
    execucaoCorregedoriaPercentual: calculado.execucaoCorregedoriaPercentual,
    execucaoEscolaPenalPercentual: calculado.execucaoEscolaPenalPercentual,
    valorRelativoOuvidoria: null,
    totalItensPlano: calculado.totalItensPlano,
    totalItensOuvidoria: calculado.totalItensOuvidoria,
    planoAplicacao: Array.isArray(planoAplicacao) ? planoAplicacao : [],
    fontesUtilizadas: [...new Set(fontesUtilizadas)],
    avisos: [...new Set(avisos)],
    origemDados,
  };
}

function montarResumoConsolidadoProfor2022(convenios) {
  return calcularResumoGeralProfor(convenios);
}

function listarAvisosConsolidadoProfor2022(convenios) {
  return (Array.isArray(convenios) ? convenios : []).flatMap((convenio) =>
    (convenio.avisos || []).map((aviso) => ({
      numeroConvenio: convenio.numeroConvenio ?? convenio.numero ?? null,
      ano: convenio.ano ?? null,
      aviso,
    }))
  );
}

function coletarFiltros(convenios) {
  const ufs = new Set();
  const areas = new Set();
  const naturezas = new Set();

  for (const convenio of convenios) {
    if (convenio.uf) ufs.add(convenio.uf);
    for (const item of convenio.planoAplicacao || []) {
      const area = normalizarTextoProfor(item.area);
      const natureza = normalizarTextoProfor(item.natureza);
      if (area) areas.add(area);
      if (natureza) naturezas.add(natureza);
    }
  }

  return {
    ufs: [...ufs].sort(),
    areas: [...areas].sort(),
    naturezas: [...naturezas].sort(),
  };
}

function obterPendenciasConhecidasProfor2022() {
  return [];
}

async function montarConsolidadoProfor2022(opcoes = {}) {
  const origemDetalhada = resolverOrigemDadosProfor2022({
    origemDados: opcoes.origemDados,
    detalhado: true,
  });
  const origemDados = origemDetalhada.origemDados;
  const carteira = opcoes.carteira ?? await listarConveniosMonitorados({ incluirInativos: false });
  const detruCache = opcoes.detruCache ?? await listarCacheDetruProfor2022();
  const rendimentosCache = opcoes.rendimentosCache ?? await listarSaldosRendimentosCache();
  const detruIndice = indexarRegistrosPorNumeroAno(detruCache, { nomeFonte: "detruCache" });
  const rendimentosIndice = indexarRegistrosPorNumeroAno(rendimentosCache, { nomeFonte: "rendimentosCache" });
  const avisos = [...origemDetalhada.avisos, ...detruIndice.avisos, ...rendimentosIndice.avisos];
  const convenios = (Array.isArray(carteira) ? carteira : []).map((convenio) =>
    montarConvenioConsolidadoProfor(convenio, {
      detruIndice,
      rendimentosIndice,
      planoAplicacao: opcoes.planoAplicacao,
      origemDados,
    })
  );
  const avisosConvenios = listarAvisosConsolidadoProfor2022(convenios);

  return {
    origemDados,
    geradoEm: new Date().toISOString(),
    resumo: montarResumoConsolidadoProfor2022(convenios),
    convenios,
    filtros: coletarFiltros(convenios),
    avisos: [...avisos, ...avisosConvenios.map((item) => item.aviso)],
    pendenciasConhecidas: obterPendenciasConhecidasProfor2022(),
    diagnostico: {
      totalCarteira: convenios.length,
      totalComDetru: convenios.filter((item) => item.fontesUtilizadas.includes("DETRU/cache")).length,
      totalComRendimentos: convenios.filter((item) => item.fontesUtilizadas.includes("Transferegov/cache")).length,
      totalComPlano: convenios.filter((item) => item.totalItensPlano > 0).length,
      totalAvisos: avisos.length + avisosConvenios.length,
    },
  };
}

module.exports = {
  criarChaveConvenioProfor,
  indexarRegistrosPorNumeroAno,
  obterRegistroPorNumeroAno,
  normalizarCarteiraConvenioProfor,
  montarFontesConvenioProfor,
  montarConvenioConsolidadoProfor,
  montarConsolidadoProfor2022,
  montarResumoConsolidadoProfor2022,
  listarAvisosConsolidadoProfor2022,
};

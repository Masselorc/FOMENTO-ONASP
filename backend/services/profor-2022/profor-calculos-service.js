const {
  arredondarMoedaProfor,
  moedaParaNumeroProfor,
  normalizarAnoProfor,
  normalizarNumeroConvenio,
  normalizarTextoProfor,
  resumirPlanoAplicacaoSeguro,
} = require("./profor-plano-aplicacao-service");

function calcularPercentualProfor(executado, previsto) {
  const valorExecutado = moedaParaNumeroProfor(executado);
  const valorPrevisto = moedaParaNumeroProfor(previsto);
  return valorPrevisto > 0 ? Math.round((valorExecutado / valorPrevisto) * 10000) / 100 : 0;
}

function calcularSaldosPorNatureza(planoAplicacao) {
  const resumo = resumirPlanoAplicacaoSeguro(planoAplicacao, {});
  return {
    saldoResidualCapital: resumo.saldoResidualCapital,
    saldoResidualCusteio: resumo.saldoResidualCusteio,
    avisos: resumo.avisos,
  };
}

function calcularExecucaoPorArea(planoAplicacao) {
  const resumo = resumirPlanoAplicacaoSeguro(planoAplicacao, {});
  return {
    previstoOuvidoria: resumo.previstoOuvidoria,
    previstoCorregedoria: resumo.previstoCorregedoria,
    previstoEscolaPenal: resumo.previstoEscolaPenal,
    valorPrevistoGeral: resumo.valorPrevistoGeral,
    valorExecutadoOuvidoria: resumo.valorExecutadoOuvidoria,
    valorExecutadoCorregedoria: resumo.valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal: resumo.valorExecutadoEscolaPenal,
    valorExecutadoGeral: resumo.valorExecutadoGeral,
    execucaoOuvidoriaPercentual: resumo.execucaoOuvidoriaPercentual,
    execucaoCorregedoriaPercentual: resumo.execucaoCorregedoriaPercentual,
    execucaoEscolaPenalPercentual: resumo.execucaoEscolaPenalPercentual,
    execucaoGeralPercentual: resumo.execucaoGeralPercentual,
    totalItensPlano: resumo.totalItensPlano,
    totalItensOuvidoria: resumo.totalItensOuvidoria,
    avisos: resumo.avisos,
  };
}

function obterDadosDetru(fonte) {
  return fonte?.dados ?? fonte ?? {};
}

function obterDadosTransferegov(fonte) {
  return fonte?.dados ?? fonte ?? {};
}

function obterPrimeiroValor(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== "") return valor;
  }
  return null;
}

function arredondarMoedaOpcional(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  return arredondarMoedaProfor(valor);
}

function calcularSaldoPotencialDestinavelOuvidoria({
  saldoRendimentosAtual,
  saldoEconomicidadeCapital,
  saldoEconomicidadeCusteio,
}) {
  return arredondarMoedaProfor(
    moedaParaNumeroProfor(saldoRendimentosAtual)
      + moedaParaNumeroProfor(saldoEconomicidadeCapital)
      + moedaParaNumeroProfor(saldoEconomicidadeCusteio)
  );
}

function obterNumeroBase(convenioBase, detru) {
  return normalizarNumeroConvenio(
    obterPrimeiroValor(convenioBase?.numero, convenioBase?.numeroConvenio, detru?.numeroConvenio, detru?.numero)
  );
}

function obterAnoBase(convenioBase, detru) {
  return normalizarAnoProfor(obterPrimeiroValor(convenioBase?.ano, detru?.ano));
}

function obterUfBase(convenioBase, detru) {
  const uf = obterPrimeiroValor(convenioBase?.uf, detru?.uf);
  return uf ? normalizarTextoProfor(uf) : null;
}

function calcularResumoFinanceiroConvenioProfor(fontes = {}) {
  const detru = obterDadosDetru(fontes.detru);
  const transferegov = obterDadosTransferegov(fontes.transferegov);
  const planoAplicacao = Array.isArray(fontes.planoAplicacao) ? fontes.planoAplicacao : [];
  const resumoPlano = resumirPlanoAplicacaoSeguro(planoAplicacao, fontes.filtrosPlano ?? {});
  const saldoRendimentosAtual =
    transferegov.saldoRendimentosAtual === undefined || transferegov.saldoRendimentosAtual === null
      ? null
      : arredondarMoedaProfor(transferegov.saldoRendimentosAtual);
  const saldoPotencialDestinavelOuvidoria = calcularSaldoPotencialDestinavelOuvidoria({
    saldoRendimentosAtual,
    saldoEconomicidadeCapital: resumoPlano.saldoEconomicidadeCapital,
    saldoEconomicidadeCusteio: resumoPlano.saldoEconomicidadeCusteio,
  });

  return {
    valorGlobal: arredondarMoedaOpcional(detru.valorGlobal),
    valorRepasse: arredondarMoedaOpcional(detru.valorRepasse),
    valorContrapartida: arredondarMoedaOpcional(detru.valorContrapartida),
    repasseDesembolsado: arredondarMoedaOpcional(detru.repasseDesembolsado),
    rendimentoAprovado: arredondarMoedaOpcional(detru.rendimentoAprovado),
    saldoRendimentosAtual,
    saldoDisponivelOuvidoria: resumoPlano.saldoDisponivelOuvidoria,
    saldoEconomicidadeCapital: resumoPlano.saldoEconomicidadeCapital,
    saldoEconomicidadeCusteio: resumoPlano.saldoEconomicidadeCusteio,
    saldoPotencialDestinavelOuvidoria,
    contrapartidaIntegralizada: arredondarMoedaOpcional(detru.contrapartidaIntegralizada),
    valorExecutadoGeral: resumoPlano.valorExecutadoGeral,
    previstoOuvidoria: resumoPlano.previstoOuvidoria,
    previstoCorregedoria: resumoPlano.previstoCorregedoria,
    previstoEscolaPenal: resumoPlano.previstoEscolaPenal,
    valorPrevistoGeral: resumoPlano.valorPrevistoGeral,
    valorExecutadoOuvidoria: resumoPlano.valorExecutadoOuvidoria,
    valorExecutadoCorregedoria: resumoPlano.valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal: resumoPlano.valorExecutadoEscolaPenal,
    saldoResidualCapital: resumoPlano.saldoResidualCapital,
    saldoResidualCusteio: resumoPlano.saldoResidualCusteio,
    execucaoGeralPercentual: resumoPlano.execucaoGeralPercentual,
    execucaoOuvidoriaPercentual: resumoPlano.execucaoOuvidoriaPercentual,
    execucaoCorregedoriaPercentual: resumoPlano.execucaoCorregedoriaPercentual,
    execucaoEscolaPenalPercentual: resumoPlano.execucaoEscolaPenalPercentual,
    totalItensPlano: resumoPlano.totalItensPlano,
    totalItensOuvidoria: resumoPlano.totalItensOuvidoria,
    resumoPlano,
  };
}

function calcularResumoGeralProfor(convenios) {
  const lista = Array.isArray(convenios) ? convenios : [];
  const somar = (campo) => arredondarMoedaProfor(lista.reduce((total, item) => total + moedaParaNumeroProfor(item?.[campo]), 0));
  const valorExecutadoGeral = somar("valorExecutadoGeral");
  const previstoOuvidoria = somar("previstoOuvidoria");
  const previstoCorregedoria = somar("previstoCorregedoria");
  const previstoEscolaPenal = somar("previstoEscolaPenal");
  const valorPrevistoGeralCalculado = somar("valorPrevistoGeral");
  const valorExecutadoOuvidoria = somar("valorExecutadoOuvidoria");
  const valorExecutadoCorregedoria = somar("valorExecutadoCorregedoria");
  const valorExecutadoEscolaPenal = somar("valorExecutadoEscolaPenal");
  const valorPrevistoGeral = valorPrevistoGeralCalculado > 0
    ? valorPrevistoGeralCalculado
    : arredondarMoedaProfor(previstoOuvidoria + previstoCorregedoria + previstoEscolaPenal);

  return {
    totalConvenios: lista.length,
    valorGlobal: somar("valorGlobal"),
    valorRepasse: somar("valorRepasse"),
    valorContrapartida: somar("valorContrapartida"),
    repasseDesembolsado: somar("repasseDesembolsado"),
    rendimentoAprovado: somar("rendimentoAprovado"),
    saldoRendimentosAtual: somar("saldoRendimentosAtual"),
    saldoDisponivelOuvidoria: somar("saldoDisponivelOuvidoria"),
    saldoEconomicidadeCapital: somar("saldoEconomicidadeCapital"),
    saldoEconomicidadeCusteio: somar("saldoEconomicidadeCusteio"),
    saldoPotencialDestinavelOuvidoria: somar("saldoPotencialDestinavelOuvidoria"),
    contrapartidaIntegralizada: somar("contrapartidaIntegralizada"),
    valorExecutadoGeral,
    previstoOuvidoria,
    previstoCorregedoria,
    previstoEscolaPenal,
    valorPrevistoGeral,
    valorExecutadoOuvidoria,
    valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal,
    saldoResidualCapital: somar("saldoResidualCapital"),
    saldoResidualCusteio: somar("saldoResidualCusteio"),
    execucaoGeralPercentual: calcularPercentualProfor(valorExecutadoGeral, valorPrevistoGeral),
    execucaoOuvidoriaPercentual: calcularPercentualProfor(valorExecutadoOuvidoria, previstoOuvidoria),
    execucaoCorregedoriaPercentual: calcularPercentualProfor(valorExecutadoCorregedoria, previstoCorregedoria),
    execucaoEscolaPenalPercentual: calcularPercentualProfor(valorExecutadoEscolaPenal, previstoEscolaPenal),
  };
}

function aplicarCalculosInternosProfor(convenioBase = {}, fontes = {}) {
  const detru = obterDadosDetru(fontes.detru);
  const transferegov = obterDadosTransferegov(fontes.transferegov);
  const numero = obterNumeroBase(convenioBase, detru);
  const ano = obterAnoBase(convenioBase, detru);
  const uf = obterUfBase(convenioBase, detru);
  const filtrosPlano = {
    uf,
    numeroConvenio: numero,
    ano,
    ...(fontes.filtrosPlano || {}),
  };
  const resumo = calcularResumoFinanceiroConvenioProfor({
    detru,
    transferegov,
    planoAplicacao: fontes.planoAplicacao,
    filtrosPlano,
  });
  const fontesUtilizadas = [];
  const avisos = [...resumo.resumoPlano.avisos];

  if (fontes.detru) fontesUtilizadas.push("DETRU/cache");
  if (fontes.transferegov) fontesUtilizadas.push("Transferegov/cache");
  if (Array.isArray(fontes.planoAplicacao)) fontesUtilizadas.push("Plano de aplicação filtrado");

  if (resumo.saldoRendimentosAtual === null) {
    avisos.push("saldoRendimentosAtual não calculado internamente; depende de Transferegov/cache.");
  }

  return {
    numero,
    ano,
    uf,
    processoSei: detru.processoSei ?? convenioBase.processoSei ?? null,
    vencimento: detru.vencimento ?? convenioBase.vencimento ?? null,
    quantidadeTa: detru.quantidadeTa ?? convenioBase.quantidadeTa ?? null,
    valorGlobal: resumo.valorGlobal,
    valorRepasse: resumo.valorRepasse,
    valorContrapartida: resumo.valorContrapartida,
    repasseDesembolsado: resumo.repasseDesembolsado,
    rendimentoAprovado: resumo.rendimentoAprovado,
    saldoRendimentosAtual: resumo.saldoRendimentosAtual,
    saldoDisponivelOuvidoria: resumo.saldoDisponivelOuvidoria,
    saldoEconomicidadeCapital: resumo.saldoEconomicidadeCapital,
    saldoEconomicidadeCusteio: resumo.saldoEconomicidadeCusteio,
    saldoPotencialDestinavelOuvidoria: resumo.saldoPotencialDestinavelOuvidoria,
    contrapartidaIntegralizada: resumo.contrapartidaIntegralizada,
    valorExecutadoGeral: resumo.valorExecutadoGeral,
    previstoOuvidoria: resumo.previstoOuvidoria,
    previstoCorregedoria: resumo.previstoCorregedoria,
    previstoEscolaPenal: resumo.previstoEscolaPenal,
    valorPrevistoGeral: resumo.valorPrevistoGeral,
    valorExecutadoOuvidoria: resumo.valorExecutadoOuvidoria,
    valorExecutadoCorregedoria: resumo.valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal: resumo.valorExecutadoEscolaPenal,
    saldoResidualCapital: resumo.saldoResidualCapital,
    saldoResidualCusteio: resumo.saldoResidualCusteio,
    execucaoGeralPercentual: resumo.execucaoGeralPercentual,
    execucaoOuvidoriaPercentual: resumo.execucaoOuvidoriaPercentual,
    execucaoCorregedoriaPercentual: resumo.execucaoCorregedoriaPercentual,
    execucaoEscolaPenalPercentual: resumo.execucaoEscolaPenalPercentual,
    totalItensPlano: resumo.totalItensPlano,
    totalItensOuvidoria: resumo.totalItensOuvidoria,
    fontesUtilizadas,
    avisos,
  };
}

module.exports = {
  calcularPercentualProfor,
  calcularSaldosPorNatureza,
  calcularExecucaoPorArea,
  calcularSaldoPotencialDestinavelOuvidoria,
  calcularResumoFinanceiroConvenioProfor,
  calcularResumoGeralProfor,
  aplicarCalculosInternosProfor,
};

function normalizarTextoProfor(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarNumeroConvenio(valor) {
  const numero = String(valor ?? "").replace(/\D/g, "");
  return numero || null;
}

function normalizarAnoProfor(valor) {
  const ano = String(valor ?? "").replace(/\D/g, "");
  return ano.length === 4 ? ano : null;
}

function moedaParaNumeroProfor(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor).trim();
  if (!texto) return 0;

  const normalizado = texto
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function arredondarMoedaProfor(valor) {
  const numero = moedaParaNumeroProfor(valor);
  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function obterNumeroItem(item) {
  return normalizarNumeroConvenio(item?.numeroConvenio ?? item?.numero);
}

function obterAnoItem(item) {
  return normalizarAnoProfor(item?.ano);
}

function obterValorItem(item, campo) {
  return arredondarMoedaProfor(item?.[campo]);
}

function obterSaldoItem(item) {
  return arredondarMoedaProfor(obterValorItem(item, "valorPrevisto") - obterValorItem(item, "valorExecutado"));
}

function calcularSaldoDisponivelOuvidoria(itens, avisos = []) {
  const lista = Array.isArray(itens) ? itens : [];
  return arredondarMoedaProfor(lista.reduce((total, item) => {
    if (!ehAreaOuvidoria(item?.area)) return total;
    const saldoBruto = obterSaldoItem(item);
    if (saldoBruto < 0) {
      avisos.push("Item da OUVIDORIA com sobre-execucao; saldo disponivel considera zero no item.");
    }
    return total + Math.max(saldoBruto, 0);
  }, 0));
}

function calcularEconomicidadeItem(item, avisos = []) {
  const area = normalizarTextoProfor(item?.area);
  const valorPrevisto = obterValorItem(item, "valorPrevisto");
  const valorExecutado = obterValorItem(item, "valorExecutado");
  let economicidade = 0;

  if (area === "N/A") {
    economicidade = valorPrevisto;
  } else if (valorExecutado > 0) {
    economicidade = valorPrevisto - valorExecutado;
  }

  if (economicidade < 0) {
    avisos.push("Item com sobre-execucao para economicidade; valor negativo ajustado para zero.");
    return 0;
  }

  return arredondarMoedaProfor(economicidade);
}

function calcularSaldosEconomicidadePorNatureza(itens, avisos = []) {
  const acumulado = { saldoEconomicidadeCapital: 0, saldoEconomicidadeCusteio: 0 };
  for (const item of Array.isArray(itens) ? itens : []) {
    const natureza = normalizarTextoProfor(item?.natureza);
    const economicidade = calcularEconomicidadeItem(item, avisos);
    if (natureza === "CAPITAL") {
      acumulado.saldoEconomicidadeCapital = arredondarMoedaProfor(acumulado.saldoEconomicidadeCapital + economicidade);
    } else if (natureza === "CUSTEIO") {
      acumulado.saldoEconomicidadeCusteio = arredondarMoedaProfor(acumulado.saldoEconomicidadeCusteio + economicidade);
    }
  }
  return acumulado;
}

function ehAreaOuvidoria(area) {
  return normalizarTextoProfor(area) === "OUVIDORIA";
}

function ehAreaCorregedoria(area) {
  return normalizarTextoProfor(area) === "CORREGEDORIA";
}

function ehAreaEscolaPenal(area) {
  const normalizada = normalizarTextoProfor(area);
  return normalizada === "ESCOLA PENAL" || normalizada === "ESCOLA";
}

function montarFiltrosAplicados(filtros = {}) {
  const numeroConvenio = normalizarNumeroConvenio(filtros.numeroConvenio ?? filtros.numero);

  return {
    uf: filtros.uf ? normalizarTextoProfor(filtros.uf) : null,
    numeroConvenio,
    ano: filtros.ano ? normalizarAnoProfor(filtros.ano) : null,
    area: filtros.area ? normalizarTextoProfor(filtros.area) : null,
    natureza: filtros.natureza ? normalizarTextoProfor(filtros.natureza) : null,
  };
}

function filtrarPlanoAplicacaoSeguro(planoAplicacao, filtros = {}) {
  const itensOriginais = Array.isArray(planoAplicacao) ? planoAplicacao : [];
  const filtrosAplicados = montarFiltrosAplicados(filtros);
  const avisos = [];

  if ((filtros.numeroConvenio ?? filtros.numero) && !filtrosAplicados.numeroConvenio) {
    avisos.push("Filtro de número de convênio inválido; nenhum item será retornado.");
  }

  if (filtros.ano && !filtrosAplicados.ano) {
    avisos.push("Filtro de ano inválido; nenhum item será retornado.");
  }

  if (avisos.length) {
    return {
      itens: [],
      totalAntes: itensOriginais.length,
      totalDepois: 0,
      filtrosAplicados,
      avisos,
    };
  }

  const itensDaUf = filtrosAplicados.uf
    ? itensOriginais.filter((item) => normalizarTextoProfor(item?.uf) === filtrosAplicados.uf)
    : itensOriginais;
  const numerosDaUf = new Set(itensDaUf.map(obterNumeroItem).filter(Boolean));
  if (filtrosAplicados.uf && !filtrosAplicados.numeroConvenio && numerosDaUf.size > 1) {
    avisos.push("Filtro por UF sem número do convênio bloqueado para evitar mistura de convênios.");
    return {
      itens: [],
      totalAntes: itensOriginais.length,
      totalDepois: 0,
      filtrosAplicados,
      avisos,
    };
  }

  const itens = itensOriginais.filter((item) => {
    if (filtrosAplicados.uf && normalizarTextoProfor(item?.uf) !== filtrosAplicados.uf) return false;

    if (filtrosAplicados.numeroConvenio) {
      const numeroItem = obterNumeroItem(item);
      if (!numeroItem || numeroItem !== filtrosAplicados.numeroConvenio) return false;
    }

    if (filtrosAplicados.ano) {
      const anoItem = obterAnoItem(item);
      if (!anoItem || anoItem !== filtrosAplicados.ano) return false;
    }

    if (filtrosAplicados.area && normalizarTextoProfor(item?.area) !== filtrosAplicados.area) return false;
    if (filtrosAplicados.natureza && normalizarTextoProfor(item?.natureza) !== filtrosAplicados.natureza) return false;

    return true;
  });

  return {
    itens,
    totalAntes: itensOriginais.length,
    totalDepois: itens.length,
    filtrosAplicados,
    avisos,
  };
}

function criarGrupoVazio() {
  return {
    totalItens: 0,
    valorPrevisto: 0,
    valorExecutado: 0,
    saldo: 0,
  };
}

function acumularGrupo(grupo, item) {
  grupo.totalItens += 1;
  grupo.valorPrevisto = arredondarMoedaProfor(grupo.valorPrevisto + obterValorItem(item, "valorPrevisto"));
  grupo.valorExecutado = arredondarMoedaProfor(grupo.valorExecutado + obterValorItem(item, "valorExecutado"));
  grupo.saldo = arredondarMoedaProfor(grupo.saldo + obterSaldoItem(item));
}

function agruparPlanoPorAreaENatureza(planoAplicacao) {
  const grupos = {
    areas: {},
    naturezas: {},
    areaNatureza: {},
  };

  for (const item of Array.isArray(planoAplicacao) ? planoAplicacao : []) {
    const area = normalizarTextoProfor(item?.area) || "NAO INFORMADO";
    const natureza = normalizarTextoProfor(item?.natureza) || "NAO INFORMADO";
    const chaveAreaNatureza = `${area}::${natureza}`;

    grupos.areas[area] ??= criarGrupoVazio();
    grupos.naturezas[natureza] ??= criarGrupoVazio();
    grupos.areaNatureza[chaveAreaNatureza] ??= criarGrupoVazio();

    acumularGrupo(grupos.areas[area], item);
    acumularGrupo(grupos.naturezas[natureza], item);
    acumularGrupo(grupos.areaNatureza[chaveAreaNatureza], item);
  }

  return grupos;
}

function calcularPercentual(executado, previsto) {
  const valorExecutado = moedaParaNumeroProfor(executado);
  const valorPrevisto = moedaParaNumeroProfor(previsto);
  return valorPrevisto > 0 ? Math.round((valorExecutado / valorPrevisto) * 10000) / 100 : 0;
}

function somarItens(itens, predicado, campo) {
  return arredondarMoedaProfor(
    itens
      .filter(predicado)
      .reduce((total, item) => total + (campo === "saldo" ? obterSaldoItem(item) : obterValorItem(item, campo)), 0)
  );
}

function resumirPlanoAplicacaoSeguro(planoAplicacao, filtros = {}) {
  const filtragem = filtrarPlanoAplicacaoSeguro(planoAplicacao, filtros);
  const itens = filtragem.itens;
  const avisos = [...filtragem.avisos];
  const itensOuvidoria = itens.filter((item) => ehAreaOuvidoria(item?.area));
  const previstoOuvidoria = somarItens(itens, (item) => ehAreaOuvidoria(item?.area), "valorPrevisto");
  const previstoCorregedoria = somarItens(itens, (item) => ehAreaCorregedoria(item?.area), "valorPrevisto");
  const previstoEscolaPenal = somarItens(itens, (item) => ehAreaEscolaPenal(item?.area), "valorPrevisto");
  const valorExecutadoOuvidoria = somarItens(itens, (item) => ehAreaOuvidoria(item?.area), "valorExecutado");
  const valorExecutadoCorregedoria = somarItens(itens, (item) => ehAreaCorregedoria(item?.area), "valorExecutado");
  const valorExecutadoEscolaPenal = somarItens(itens, (item) => ehAreaEscolaPenal(item?.area), "valorExecutado");
  const valorPrevistoGeral = somarItens(itens, () => true, "valorPrevisto");
  const valorExecutadoGeral = somarItens(itens, () => true, "valorExecutado");
  const saldoDisponivelOuvidoria = calcularSaldoDisponivelOuvidoria(itens, avisos);
  const { saldoEconomicidadeCapital, saldoEconomicidadeCusteio } = calcularSaldosEconomicidadePorNatureza(itens, avisos);

  return {
    totalItensPlano: itens.length,
    totalItensOuvidoria: itensOuvidoria.length,
    valorPrevistoOuvidoriaPlano: previstoOuvidoria,
    valorExecutadoOuvidoria,
    previstoCapitalOuvidoria: somarItens(
      itensOuvidoria,
      (item) => normalizarTextoProfor(item?.natureza) === "CAPITAL",
      "valorPrevisto"
    ),
    previstoCusteioOuvidoria: somarItens(
      itensOuvidoria,
      (item) => normalizarTextoProfor(item?.natureza) === "CUSTEIO",
      "valorPrevisto"
    ),
    previstoOuvidoria,
    previstoCorregedoria,
    previstoEscolaPenal,
    valorPrevistoGeral,
    valorExecutadoGeral,
    valorExecutadoCorregedoria,
    valorExecutadoEscolaPenal,
    saldoResidualCapital: somarItens(itens, (item) => normalizarTextoProfor(item?.natureza) === "CAPITAL", "saldo"),
    saldoResidualCusteio: somarItens(itens, (item) => normalizarTextoProfor(item?.natureza) === "CUSTEIO", "saldo"),
    saldoEconomicidadeCapital,
    saldoEconomicidadeCusteio,
    saldoDisponivelOuvidoria,
    execucaoOuvidoriaPercentual: calcularPercentual(valorExecutadoOuvidoria, previstoOuvidoria),
    execucaoCorregedoriaPercentual: calcularPercentual(valorExecutadoCorregedoria, previstoCorregedoria),
    execucaoEscolaPenalPercentual: calcularPercentual(valorExecutadoEscolaPenal, previstoEscolaPenal),
    execucaoGeralPercentual: calcularPercentual(valorExecutadoGeral, valorPrevistoGeral),
    filtragem,
    avisos,
  };
}

module.exports = {
  normalizarTextoProfor,
  normalizarNumeroConvenio,
  normalizarAnoProfor,
  moedaParaNumeroProfor,
  arredondarMoedaProfor,
  filtrarPlanoAplicacaoSeguro,
  agruparPlanoPorAreaENatureza,
  calcularSaldoDisponivelOuvidoria,
  calcularEconomicidadeItem,
  calcularSaldosEconomicidadePorNatureza,
  resumirPlanoAplicacaoSeguro,
};

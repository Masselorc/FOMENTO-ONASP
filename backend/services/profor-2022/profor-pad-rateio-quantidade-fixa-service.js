const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

function numeroOuNull(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function arredondarQuantidade(valor) {
  const numero = numeroOuNull(valor);
  if (numero === null) return null;
  return Math.round((numero + Number.EPSILON) * 1e6) / 1e6;
}

function normalizarNatureza(valor) {
  return String(valor || "").trim().toUpperCase();
}

function validarNaturezaUnica(item, rateios) {
  const naturezaItem = normalizarNatureza(item?.natureza);
  const erros = [];
  for (const [indice, rateio] of rateios.entries()) {
    if (!rateio.natureza) continue;
    const naturezaRateio = normalizarNatureza(rateio.natureza);
    if (naturezaRateio && naturezaItem && naturezaRateio !== naturezaItem) {
      erros.push({
        tipo: "natureza_mista",
        indice,
        naturezaItem,
        naturezaRateio,
      });
    }
  }
  return erros;
}

function simularRateioQuantidadeFixa(entrada) {
  const item = entrada?.item || {};
  const rateios = Array.isArray(entrada?.rateios) ? entrada.rateios : [];
  const avisos = [];
  const erros = [];

  const quantidadeTotal = arredondarQuantidade(item.quantidade);
  const valorUnitario = numeroOuNull(item.valorUnitario);
  const valorPrevisto = numeroOuNull(item.valorPrevisto);

  if (quantidadeTotal === null || quantidadeTotal < 0) {
    erros.push({ tipo: "quantidade_total_invalida", valor: item.quantidade });
  }
  if (valorUnitario === null || valorUnitario < 0) {
    erros.push({ tipo: "valor_unitario_invalido", valor: item.valorUnitario });
  }

  erros.push(...validarNaturezaUnica(item, rateios));

  let somaQuantidade = 0;
  const linhas = rateios.map((rateio, indice) => {
    const quantidade = arredondarQuantidade(rateio.quantidade);
    const avisosLinha = [];
    const errosLinha = [];

    if (quantidade === null) {
      errosLinha.push({ tipo: "quantidade_invalida", valor: rateio.quantidade });
    } else if (quantidade < 0) {
      errosLinha.push({ tipo: "quantidade_negativa", valor: rateio.quantidade });
    } else {
      somaQuantidade = arredondarQuantidade(somaQuantidade + quantidade);
    }

    const qtd = quantidade === null ? 0 : quantidade;
    const valorPrevistoRateado = valorUnitario === null ? 0 : arredondarMoedaProfor(qtd * valorUnitario);
    const percentualDerivado = quantidadeTotal > 0
      ? Math.round((qtd / quantidadeTotal) * 1000000) / 10000
      : 0;

    const linha = {
      area: String(rateio.area || "").trim(),
      natureza: rateio.natureza ? normalizarNatureza(rateio.natureza) : normalizarNatureza(item.natureza),
      quantidade: qtd,
      valorUnitario: valorUnitario === null ? 0 : valorUnitario,
      valorPrevistoRateado,
      percentualDerivado,
      diferencaResidual: 0,
      avisos: avisosLinha,
      erros: errosLinha,
      indice,
    };

    if (!linha.area) avisosLinha.push({ tipo: "area_ausente" });
    erros.push(...errosLinha.map((erro) => ({ ...erro, indice })));
    return linha;
  });

  const quantidadeNaoRateada = quantidadeTotal === null ? 0 : arredondarQuantidade(quantidadeTotal - somaQuantidade);
  if (quantidadeNaoRateada > 0) {
    avisos.push({ tipo: "quantidade_nao_rateada", quantidade: quantidadeNaoRateada });
  }
  if (quantidadeNaoRateada < 0) {
    erros.push({ tipo: "soma_rateios_superior_quantidade_total", quantidadeExcedente: Math.abs(quantidadeNaoRateada) });
  }

  const totalRateado = linhas.reduce((acc, linha) => arredondarMoedaProfor(acc + linha.valorPrevistoRateado), 0);
  const valorReferencia = valorPrevisto !== null
    ? valorPrevisto
    : (quantidadeTotal !== null && valorUnitario !== null ? arredondarMoedaProfor(quantidadeTotal * valorUnitario) : 0);
  const diferencaResidualTotal = arredondarMoedaProfor(valorReferencia - totalRateado);

  if (Math.abs(diferencaResidualTotal) > 0) {
    avisos.push({ tipo: "diferenca_residual_total", valor: diferencaResidualTotal });
  }

  if (linhas.length > 0) {
    linhas[linhas.length - 1].diferencaResidual = diferencaResidualTotal;
  }

  return {
    modo: "dry-run",
    item: {
      numero: item.numero || null,
      uf: item.uf || null,
      descricao: item.descricao || null,
      natureza: normalizarNatureza(item.natureza),
      quantidade: quantidadeTotal,
      valorUnitario: valorUnitario === null ? null : valorUnitario,
      valorPrevisto: valorReferencia,
    },
    totais: {
      quantidadeTotal,
      somaQuantidadeRateada: somaQuantidade,
      quantidadeNaoRateada,
      valorPrevistoReferencia: valorReferencia,
      totalValorRateado: totalRateado,
      diferencaResidualTotal,
    },
    rateios: linhas,
    avisos,
    erros,
    apto: erros.length === 0,
  };
}

function montarMarkdownRateioQuantidadeFixa(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Rateio por área + quantidade fixa (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm || "-"}`,
    `Apto: ${relatorio.resultado.apto ? "sim" : "não"}`,
    "",
    "## Totais",
    "",
    `- Quantidade total: ${relatorio.resultado.totais.quantidadeTotal}`,
    `- Quantidade rateada: ${relatorio.resultado.totais.somaQuantidadeRateada}`,
    `- Quantidade não rateada: ${relatorio.resultado.totais.quantidadeNaoRateada}`,
    `- Valor referência: ${relatorio.resultado.totais.valorPrevistoReferencia}`,
    `- Total rateado: ${relatorio.resultado.totais.totalValorRateado}`,
    `- Diferença residual: ${relatorio.resultado.totais.diferencaResidualTotal}`,
    "",
    "## Rateios",
    "",
    "| Área | Quantidade | Valor unitário | Valor rateado | Percentual derivado | Residual |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const item of relatorio.resultado.rateios) {
    linhas.push(`| ${item.area || "-"} | ${item.quantidade} | ${item.valorUnitario} | ${item.valorPrevistoRateado} | ${item.percentualDerivado} | ${item.diferencaResidual} |`);
  }

  linhas.push("");
  linhas.push("## Garantias");
  linhas.push("");
  linhas.push("- Simulação dry-run com amostra não oficial.");
  linhas.push("- Nenhuma decisão registrada.");
  linhas.push("- Banco não alterado.");
  linhas.push("- Nenhuma publicação executada.");

  return `${linhas.join("\n")}\n`;
}

module.exports = {
  simularRateioQuantidadeFixa,
  montarMarkdownRateioQuantidadeFixa,
  arredondarQuantidade,
};

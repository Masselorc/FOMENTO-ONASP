const {
  simularRateioQuantidadeFixa,
} = require("./profor-pad-rateio-quantidade-fixa-service");

function simularReconstrucaoComRateioQuantidadeFixa(entradas = []) {
  const itens = entradas.map((entrada, indice) => {
    const resultadoRateio = simularRateioQuantidadeFixa(entrada);
    const bloqueios = resultadoRateio.erros.map((erro) => ({
      tipo: erro.tipo,
      indice,
      erro,
    }));

    return {
      indice,
      numero: resultadoRateio.item.numero,
      uf: resultadoRateio.item.uf,
      descricao: resultadoRateio.item.descricao,
      natureza: resultadoRateio.item.natureza,
      apto: resultadoRateio.apto,
      quantidadeTotal: resultadoRateio.totais.quantidadeTotal,
      quantidadeRateada: resultadoRateio.totais.somaQuantidadeRateada,
      saldoNaoRateado: resultadoRateio.totais.quantidadeNaoRateada,
      diferencaResidual: resultadoRateio.totais.diferencaResidualTotal,
      bloqueios,
      rateiosSimulados: resultadoRateio.rateios,
      avisos: resultadoRateio.avisos,
    };
  });

  const resumo = itens.reduce((acc, item) => {
    acc.totalItensSimulados += 1;
    if (item.apto) acc.itensAptos += 1;
    if (!item.apto) acc.itensComErro += 1;
    acc.quantidadeTotal += Number(item.quantidadeTotal) || 0;
    acc.quantidadeRateada += Number(item.quantidadeRateada) || 0;
    acc.saldoNaoRateado += Number(item.saldoNaoRateado) || 0;
    acc.diferencasResiduais += Number(item.diferencaResidual) || 0;
    acc.totalBloqueios += item.bloqueios.length;
    return acc;
  }, {
    totalItensSimulados: 0,
    itensAptos: 0,
    itensComErro: 0,
    quantidadeTotal: 0,
    quantidadeRateada: 0,
    saldoNaoRateado: 0,
    diferencasResiduais: 0,
    totalBloqueios: 0,
  });

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    origem: "simulacao_controlada_rateio_quantidade_fixa",
    resumo,
    itens,
    garantias: {
      reconstrutorOficialAlterado: false,
      planoAplicacaoOficialAlterado: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
      decisaoRegistrada: false,
    },
  };
}

function montarMarkdownReconstrucaoRateioFixo(relatorio) {
  const r = relatorio.resumo;
  const linhas = [
    "# PROFOR 2022 - Reconstrução com rateio por quantidade fixa (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "## Resumo",
    "",
    `- Total de itens simulados: ${r.totalItensSimulados}`,
    `- Itens aptos: ${r.itensAptos}`,
    `- Itens com erro: ${r.itensComErro}`,
    `- Quantidade total: ${r.quantidadeTotal}`,
    `- Quantidade rateada: ${r.quantidadeRateada}`,
    `- Saldo não rateado: ${r.saldoNaoRateado}`,
    `- Diferenças residuais: ${r.diferencasResiduais}`,
    `- Bloqueios: ${r.totalBloqueios}`,
    "",
    "## Itens",
    "",
    "| Índice | Convênio | UF | Natureza | Apto | Quantidade | Rateada | Saldo não rateado | Bloqueios |",
    "| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
  ];

  for (const item of relatorio.itens) {
    linhas.push(`| ${item.indice} | ${item.numero || "-"} | ${item.uf || "-"} | ${item.natureza || "-"} | ${item.apto ? "sim" : "não"} | ${item.quantidadeTotal} | ${item.quantidadeRateada} | ${item.saldoNaoRateado} | ${item.bloqueios.length} |`);
  }

  linhas.push("");
  linhas.push("## Garantias");
  linhas.push("");
  linhas.push("- Reconstrutor oficial não alterado.");
  linhas.push("- Plano de aplicação oficial não alterado.");
  linhas.push("- Banco não alterado.");
  linhas.push("- Nenhuma publicação executada.");
  linhas.push("- Nenhuma decisão registrada.");
  return `${linhas.join("\n")}\n`;
}

module.exports = {
  simularReconstrucaoComRateioQuantidadeFixa,
  montarMarkdownReconstrucaoRateioFixo,
};

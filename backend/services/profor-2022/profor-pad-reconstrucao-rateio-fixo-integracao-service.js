// Adaptador de integração entre o reconstrutor dry-run oficial e o serviço de
// rateio por área + quantidade fixa.
//
// Recebe o plano reconstruído dry-run e um conjunto de instruções de rateio
// fixo (opcional). Aplica o rateio fixo APENAS em modo dry-run, gerando um
// plano simulado SEPARADO do plano original. Preserva o plano original intacto.
// Não altera o reconstrutor oficial, não publica, não toca banco, não decide.

const {
  simularRateioQuantidadeFixa,
} = require("./profor-pad-rateio-quantidade-fixa-service");

const {
  arredondarMoedaProfor,
} = require("./profor-plano-aplicacao-service");

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function clonarLinha(linha) {
  return { ...linha };
}

function chaveItemPad(linha) {
  const numeroConvenio = String(linha?.numero || "").trim();
  const descricao = String(linha?.descricao || "").trim().toUpperCase();
  return `${numeroConvenio}::${descricao}`;
}

function indexarInstrucoesPorChave(instrucoes = []) {
  const indice = new Map();
  for (const instrucao of instrucoes) {
    const chave = String(instrucao?.chaveItem || chaveItemPad(instrucao?.item || {})).trim();
    if (!chave) continue;
    indice.set(chave, instrucao);
  }
  return indice;
}

function agruparLinhasOriginalPorItem(planoOriginal = []) {
  const grupos = new Map();
  for (const linha of planoOriginal) {
    const chave = String(linha?.chaveItem || chaveItemPad(linha)).trim();
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(linha);
  }
  return grupos;
}

function projetarItemBaseParaRateio(chave, grupoLinhasOriginal, instrucao) {
  const referencia = grupoLinhasOriginal[0] || {};
  // Quantidade total e valor previsto do GRUPO (soma de todas as linhas com a
  // mesma chave de item). Usar apenas a primeira linha como referência produz
  // residual incorreto quando o item já foi rateado em mais de uma linha.
  const somaQuantidadeGrupo = grupoLinhasOriginal.reduce(
    (acc, linha) => acc + numero(linha.quantidade),
    0,
  );
  const somaValorPrevistoGrupo = grupoLinhasOriginal.reduce(
    (acc, linha) => acc + numero(linha.valorPrevisto),
    0,
  );
  const quantidadeTotalInstrucao = instrucao?.item?.quantidade;
  const valorUnitarioInstrucao = instrucao?.item?.valorUnitario;
  return {
    numero: instrucao?.item?.numero || referencia.numero || null,
    uf: instrucao?.item?.uf || referencia.uf || null,
    instrumento: instrucao?.item?.instrumento || referencia.instrumento || null,
    ano: instrucao?.item?.ano || referencia.ano || null,
    descricao: instrucao?.item?.descricao || referencia.descricao || null,
    natureza: instrucao?.item?.natureza || referencia.natureza || null,
    quantidade: quantidadeTotalInstrucao ?? somaQuantidadeGrupo,
    valorUnitario: valorUnitarioInstrucao ?? referencia.valorUnitario,
    valorPrevisto: instrucao?.item?.valorPrevisto ?? somaValorPrevistoGrupo,
    chaveItem: chave,
  };
}

function aplicarRateioFixoEmGrupo(chave, grupoLinhasOriginal, instrucao) {
  const itemBase = projetarItemBaseParaRateio(chave, grupoLinhasOriginal, instrucao);
  const entrada = { item: itemBase, rateios: instrucao?.rateios || [] };
  const resultado = simularRateioQuantidadeFixa(entrada);

  if (!resultado.apto) {
    // Bloqueado: preserva linhas originais e marca cada uma como bloqueada.
    const linhasBloqueadas = grupoLinhasOriginal.map((linha) => ({
      ...clonarLinha(linha),
      rateioFixoAplicado: false,
      rateioFixoBloqueado: true,
      rateioFixoBloqueios: resultado.erros,
      rateioFixoAvisos: resultado.avisos,
    }));
    return {
      chave,
      apto: false,
      linhasOriginais: grupoLinhasOriginal,
      linhasSimuladas: linhasBloqueadas,
      totaisOriginal: agregarTotaisGrupo(grupoLinhasOriginal),
      totaisSimulado: agregarTotaisGrupo(linhasBloqueadas),
      bloqueios: resultado.erros.map((erro) => ({ chave, tipo: erro.tipo, detalhes: erro })),
      saldoNaoRateado: numero(resultado.totais.quantidadeNaoRateada),
      diferencaResidualTotal: numero(resultado.totais.diferencaResidualTotal),
      avisos: resultado.avisos,
    };
  }

  // Apto: substitui o grupo por uma linha por rateio.
  // Para preservar totais (executado, saldo) consistentes com o grupo original,
  // distribui o executado original proporcionalmente ao valor previsto rateado.
  const executadoTotalOriginal = grupoLinhasOriginal.reduce(
    (acc, linha) => acc + numero(linha.valorExecutado),
    0,
  );
  const valoresRateados = resultado.rateios.map((r) => arredondarMoedaProfor(numero(r.valorPrevistoRateado)));
  const somaValoresRateados = valoresRateados.reduce((acc, v) => acc + v, 0);
  const executadosDistribuidos = valoresRateados.map((valorRateado) => {
    if (somaValoresRateados <= 0) return 0;
    return arredondarMoedaProfor((executadoTotalOriginal * valorRateado) / somaValoresRateados);
  });
  // Ajusta arredondamento residual na última linha para fechar o executado total.
  const somaExecutadosDistribuidos = executadosDistribuidos.reduce((acc, v) => acc + v, 0);
  const residualExecutado = arredondarMoedaProfor(executadoTotalOriginal - somaExecutadosDistribuidos);
  if (executadosDistribuidos.length > 0 && Math.abs(residualExecutado) > 0) {
    executadosDistribuidos[executadosDistribuidos.length - 1] = arredondarMoedaProfor(
      executadosDistribuidos[executadosDistribuidos.length - 1] + residualExecutado,
    );
  }

  const linhasSimuladas = resultado.rateios.map((rateio, indice) => {
    const valorRateado = valoresRateados[indice];
    const executadoLinha = executadosDistribuidos[indice];
    const saldoLinha = arredondarMoedaProfor(valorRateado - executadoLinha);
    return {
      uf: itemBase.uf,
      instrumento: itemBase.instrumento,
      numero: itemBase.numero,
      ano: itemBase.ano,
      area: rateio.area,
      natureza: rateio.natureza,
      descricao: itemBase.descricao,
      quantidade: numero(rateio.quantidade),
      valorUnitario: numero(rateio.valorUnitario),
      valorPrevisto: valorRateado,
      valorExecutado: executadoLinha,
      saldo: saldoLinha,
      saldoEconomicidade: 0,
      percentualExecucao: valorRateado > 0
        ? Math.round((executadoLinha / valorRateado) * 10000) / 100
        : 0,
      origemReconstrucao: "rateio-fixo-dry-run",
      chaveItem: chave,
      itemConhecidoId: grupoLinhasOriginal[0]?.itemConhecidoId ?? null,
      baseRateioValor: "quantidade-fixa",
      baseRateioQuantidade: "fixa",
      diferencaResidual: numero(rateio.diferencaResidual),
      rateioFixoAplicado: true,
      rateioFixoBloqueado: false,
      rateioFixoIndice: indice,
      rateioFixoAvisos: rateio.avisos || [],
    };
  });

  return {
    chave,
    apto: true,
    linhasOriginais: grupoLinhasOriginal,
    linhasSimuladas,
    totaisOriginal: agregarTotaisGrupo(grupoLinhasOriginal),
    totaisSimulado: agregarTotaisGrupo(linhasSimuladas),
    bloqueios: [],
    saldoNaoRateado: numero(resultado.totais.quantidadeNaoRateada),
    diferencaResidualTotal: numero(resultado.totais.diferencaResidualTotal),
    avisos: resultado.avisos,
  };
}

function agregarTotaisGrupo(linhas = []) {
  return linhas.reduce((acc, linha) => {
    acc.quantidade = arredondarMoedaProfor(acc.quantidade + numero(linha.quantidade));
    acc.valorPrevisto = arredondarMoedaProfor(acc.valorPrevisto + numero(linha.valorPrevisto));
    acc.valorExecutado = arredondarMoedaProfor(acc.valorExecutado + numero(linha.valorExecutado));
    acc.saldo = arredondarMoedaProfor(acc.saldo + numero(linha.saldo));
    return acc;
  }, { quantidade: 0, valorPrevisto: 0, valorExecutado: 0, saldo: 0 });
}

function agregarTotaisPlano(linhas = []) {
  return linhas.reduce((acc, linha) => {
    acc.totalLinhas += 1;
    acc.quantidadeTotal = arredondarMoedaProfor(acc.quantidadeTotal + numero(linha.quantidade));
    acc.valorPrevistoTotal = arredondarMoedaProfor(acc.valorPrevistoTotal + numero(linha.valorPrevisto));
    acc.valorExecutadoTotal = arredondarMoedaProfor(acc.valorExecutadoTotal + numero(linha.valorExecutado));
    acc.saldoTotal = arredondarMoedaProfor(acc.saldoTotal + numero(linha.saldo));
    return acc;
  }, {
    totalLinhas: 0,
    quantidadeTotal: 0,
    valorPrevistoTotal: 0,
    valorExecutadoTotal: 0,
    saldoTotal: 0,
  });
}

function integrarRateioFixoNoPlanoReconstruido(planoOriginal = [], instrucoes = []) {
  // Defensive copy do plano original: cada linha preservada intacta.
  const planoOriginalClonado = planoOriginal.map(clonarLinha);
  const planoSimulado = planoOriginalClonado.map(clonarLinha);

  const grupos = agruparLinhasOriginalPorItem(planoOriginalClonado);
  const indiceInstrucoes = indexarInstrucoesPorChave(instrucoes);

  const resultadosGrupos = [];
  const bloqueiosAgregados = [];
  let saldoNaoRateadoTotal = 0;
  let diferencaResidualTotal = 0;
  let totalItensComRateioFixoAplicado = 0;
  let totalItensBloqueados = 0;
  let totalItensSemInstrucao = 0;

  // Para cada chave com instrução, processa o grupo.
  for (const [chave, grupoLinhasOriginal] of grupos.entries()) {
    const instrucao = indiceInstrucoes.get(chave);
    if (!instrucao) {
      totalItensSemInstrucao += 1;
      continue;
    }
    const r = aplicarRateioFixoEmGrupo(chave, grupoLinhasOriginal, instrucao);
    resultadosGrupos.push(r);
    saldoNaoRateadoTotal += r.saldoNaoRateado;
    diferencaResidualTotal = arredondarMoedaProfor(diferencaResidualTotal + r.diferencaResidualTotal);
    if (!r.apto) {
      totalItensBloqueados += 1;
      bloqueiosAgregados.push(...r.bloqueios);
      continue;
    }
    totalItensComRateioFixoAplicado += 1;

    // Substitui as linhas originais do grupo pelas linhas simuladas no planoSimulado.
    const indicesGrupo = [];
    for (let i = 0; i < planoSimulado.length; i += 1) {
      const linha = planoSimulado[i];
      const chaveLinha = String(linha?.chaveItem || chaveItemPad(linha)).trim();
      if (chaveLinha === chave) indicesGrupo.push(i);
    }
    if (indicesGrupo.length > 0) {
      // Remove (em ordem reversa) e injeta as novas linhas no lugar do primeiro índice.
      const primeiroIndice = indicesGrupo[0];
      for (let i = indicesGrupo.length - 1; i >= 0; i -= 1) {
        planoSimulado.splice(indicesGrupo[i], 1);
      }
      planoSimulado.splice(primeiroIndice, 0, ...r.linhasSimuladas);
    }
  }

  const totaisOriginal = agregarTotaisPlano(planoOriginalClonado);
  const totaisSimulado = agregarTotaisPlano(planoSimulado);
  const diferencasAgregadas = {
    deltaQuantidade: arredondarMoedaProfor(totaisSimulado.quantidadeTotal - totaisOriginal.quantidadeTotal),
    deltaValorPrevisto: arredondarMoedaProfor(totaisSimulado.valorPrevistoTotal - totaisOriginal.valorPrevistoTotal),
    deltaValorExecutado: arredondarMoedaProfor(totaisSimulado.valorExecutadoTotal - totaisOriginal.valorExecutadoTotal),
    deltaSaldo: arredondarMoedaProfor(totaisSimulado.saldoTotal - totaisOriginal.saldoTotal),
    deltaLinhas: totaisSimulado.totalLinhas - totaisOriginal.totalLinhas,
  };

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    origem: "integracao_reconstrucao_rateio_quantidade_fixa",
    resumo: {
      totalItensPlanoOriginal: grupos.size,
      totalInstrucoesRecebidas: instrucoes.length,
      totalItensComRateioFixoAplicado,
      totalItensBloqueados,
      totalItensSemInstrucao,
      totalBloqueios: bloqueiosAgregados.length,
      saldoNaoRateadoTotal: arredondarMoedaProfor(saldoNaoRateadoTotal),
      diferencaResidualTotal,
    },
    totaisOriginal,
    totaisSimulado,
    diferencasAgregadas,
    grupos: resultadosGrupos,
    bloqueios: bloqueiosAgregados,
    planoOriginalIntacto: planoOriginalClonado,
    planoSimulado,
    garantias: {
      reconstrutorOficialAlterado: false,
      planoAplicacaoOficialAlterado: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
      decisaoRegistrada: false,
      sqlDireto: false,
      novaMigration: false,
      envAlterado: false,
      transferegovAcionado: false,
      frontendDataPublicadosAlterado: false,
      filaOficialAlterada: false,
    },
  };
}

function montarMarkdownIntegracaoRateioFixo(relatorio) {
  const r = relatorio.resumo;
  const t = relatorio.totaisOriginal;
  const ts = relatorio.totaisSimulado;
  const d = relatorio.diferencasAgregadas;

  const linhas = [
    "# PROFOR 2022 - Integração reconstrução dry-run × rateio por quantidade fixa",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Modo: ${relatorio.modo}`,
    `Origem: ${relatorio.origem}`,
    "",
    "## Resumo",
    "",
    `- Itens distintos no plano original: ${r.totalItensPlanoOriginal}`,
    `- Instruções de rateio fixo recebidas: ${r.totalInstrucoesRecebidas}`,
    `- Itens com rateio fixo aplicado: ${r.totalItensComRateioFixoAplicado}`,
    `- Itens bloqueados pelo rateio fixo: ${r.totalItensBloqueados}`,
    `- Itens sem instrução (permaneceram originais): ${r.totalItensSemInstrucao}`,
    `- Bloqueios totais: ${r.totalBloqueios}`,
    `- Saldo não rateado total: ${r.saldoNaoRateadoTotal}`,
    `- Diferença residual total: ${r.diferencaResidualTotal}`,
    "",
    "## Totais",
    "",
    "| Métrica | Original | Simulado | Δ |",
    "| --- | ---: | ---: | ---: |",
    `| Linhas | ${t.totalLinhas} | ${ts.totalLinhas} | ${d.deltaLinhas} |`,
    `| Quantidade total | ${t.quantidadeTotal} | ${ts.quantidadeTotal} | ${d.deltaQuantidade} |`,
    `| Valor previsto | ${t.valorPrevistoTotal} | ${ts.valorPrevistoTotal} | ${d.deltaValorPrevisto} |`,
    `| Valor executado | ${t.valorExecutadoTotal} | ${ts.valorExecutadoTotal} | ${d.deltaValorExecutado} |`,
    `| Saldo | ${t.saldoTotal} | ${ts.saldoTotal} | ${d.deltaSaldo} |`,
    "",
    "## Garantias",
    "",
    "- Reconstrutor oficial não alterado.",
    "- Plano de aplicação oficial não alterado.",
    "- Plano dry-run original preservado intacto.",
    "- Banco não alterado (sem SQL direto, sem migration).",
    "- Nenhuma publicação executada.",
    "- Nenhuma decisão automática registrada.",
    "- `.env` não alterado.",
    "- Transferegov não acionado.",
    "- `frontend/data/publicados/` não alterado.",
    "- Fila oficial real não alterada.",
  ];
  return `${linhas.join("\n")}\n`;
}

function compararPlanoOriginalEComRateioFixo(relatorioIntegracao) {
  const grupos = (relatorioIntegracao?.grupos || []).map((g) => ({
    chave: g.chave,
    apto: g.apto,
    linhasOriginais: g.linhasOriginais.length,
    linhasSimuladas: g.linhasSimuladas.length,
    deltaLinhas: g.linhasSimuladas.length - g.linhasOriginais.length,
    quantidadeOriginal: g.totaisOriginal.quantidade,
    quantidadeSimulada: g.totaisSimulado.quantidade,
    valorPrevistoOriginal: g.totaisOriginal.valorPrevisto,
    valorPrevistoSimulado: g.totaisSimulado.valorPrevisto,
    saldoNaoRateado: g.saldoNaoRateado,
    diferencaResidual: g.diferencaResidualTotal,
    bloqueios: g.bloqueios.length,
  }));

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    origem: "comparacao_plano_original_vs_rateio_fixo",
    resumoIntegracao: relatorioIntegracao.resumo,
    totaisOriginal: relatorioIntegracao.totaisOriginal,
    totaisSimulado: relatorioIntegracao.totaisSimulado,
    diferencasAgregadas: relatorioIntegracao.diferencasAgregadas,
    grupos,
    bloqueios: relatorioIntegracao.bloqueios,
    garantias: relatorioIntegracao.garantias,
  };
}

function montarMarkdownComparacaoRateioFixo(relatorio) {
  const t = relatorio.totaisOriginal;
  const ts = relatorio.totaisSimulado;
  const d = relatorio.diferencasAgregadas;

  const linhas = [
    "# PROFOR 2022 - Comparação plano padrão × plano com rateio fixo (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "## Totais agregados",
    "",
    "| Métrica | Original | Simulado | Δ |",
    "| --- | ---: | ---: | ---: |",
    `| Linhas | ${t.totalLinhas} | ${ts.totalLinhas} | ${d.deltaLinhas} |`,
    `| Quantidade total | ${t.quantidadeTotal} | ${ts.quantidadeTotal} | ${d.deltaQuantidade} |`,
    `| Valor previsto | ${t.valorPrevistoTotal} | ${ts.valorPrevistoTotal} | ${d.deltaValorPrevisto} |`,
    `| Valor executado | ${t.valorExecutadoTotal} | ${ts.valorExecutadoTotal} | ${d.deltaValorExecutado} |`,
    `| Saldo | ${t.saldoTotal} | ${ts.saldoTotal} | ${d.deltaSaldo} |`,
    "",
    "## Itens alterados pelo rateio fixo (grupos)",
    "",
    "| Chave | Apto | Linhas orig → sim (Δ) | Qtd orig → sim | Valor previsto orig → sim | Saldo n/rateado | Residual | Bloqueios |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const g of relatorio.grupos || []) {
    linhas.push(
      `| ${g.chave} | ${g.apto ? "sim" : "não"} | ${g.linhasOriginais} → ${g.linhasSimuladas} (${g.deltaLinhas >= 0 ? "+" : ""}${g.deltaLinhas}) | ` +
        `${g.quantidadeOriginal} → ${g.quantidadeSimulada} | ${g.valorPrevistoOriginal} → ${g.valorPrevistoSimulado} | ` +
        `${g.saldoNaoRateado} | ${g.diferencaResidual} | ${g.bloqueios} |`,
    );
  }

  if (!relatorio.grupos || relatorio.grupos.length === 0) {
    linhas.push("| _(nenhum grupo alterado nesta execução)_ |  |  |  |  |  |  |  |");
  }

  linhas.push("");
  linhas.push("## Bloqueios");
  linhas.push("");
  if (!relatorio.bloqueios || relatorio.bloqueios.length === 0) {
    linhas.push("- Nenhum bloqueio.");
  } else {
    for (const b of relatorio.bloqueios) {
      linhas.push(`- \`${b.chave}\` :: \`${b.tipo}\``);
    }
  }
  linhas.push("");
  linhas.push("## Garantias");
  linhas.push("");
  linhas.push("- Plano dry-run padrão preservado.");
  linhas.push("- Plano com rateio fixo gerado em paralelo (sem substituir).");
  linhas.push("- Nenhuma alteração em banco, publicação ou origem ativa.");
  linhas.push("- `frontend/data/publicados/` não alterado.");
  return `${linhas.join("\n")}\n`;
}

module.exports = {
  chaveItemPad,
  agruparLinhasOriginalPorItem,
  agregarTotaisGrupo,
  agregarTotaisPlano,
  aplicarRateioFixoEmGrupo,
  integrarRateioFixoNoPlanoReconstruido,
  compararPlanoOriginalEComRateioFixo,
  montarMarkdownIntegracaoRateioFixo,
  montarMarkdownComparacaoRateioFixo,
};

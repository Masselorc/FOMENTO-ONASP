const fs = require("node:fs");
const path = require("node:path");

const CAMINHO_ENTRADA_PADRAO = "backend/data/relatorios/profor-2022-pad-rateios-dry-run.json";
const CAMINHO_SAIDA_JSON = "backend/data/relatorios/profor-2022-pad-saneamento.json";
const CAMINHO_SAIDA_MD = "backend/data/relatorios/profor-2022-pad-saneamento.md";

function lerJson(caminho) {
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function chaveConvenioUf(item) {
  return `${item?.numeroConvenio || "sem-convenio"}::${item?.uf || "sem-uf"}`;
}

function chaveNormalizada(item) {
  return `${item?.numeroConvenio || ""}::${item?.descricaoNormalizada || ""}`;
}

function ordenarPorConvenioDescricao(a, b) {
  return String(a.numeroConvenio || "").localeCompare(String(b.numeroConvenio || ""), "pt-BR")
    || String(a.uf || "").localeCompare(String(b.uf || ""), "pt-BR")
    || String(a.descricaoOriginal || a.descricaoOriginalReferencia || "").localeCompare(
      String(b.descricaoOriginal || b.descricaoOriginalReferencia || ""),
      "pt-BR"
    );
}

function obterResumoConvenio(mapa, item) {
  const chave = chaveConvenioUf(item);
  if (!mapa.has(chave)) {
    mapa.set(chave, {
      numeroConvenio: item?.numeroConvenio || null,
      uf: item?.uf || null,
      itensPadSemRateio: 0,
      coincidenciasApenasNormalizadas: 0,
      itensConhecidosNaoAptos: 0,
      itensConhecidosAusentesNoPad: 0,
      totalPendencias: 0,
    });
  }
  return mapa.get(chave);
}

function agruparPorConvenioUf({ itensPadSemRateio, coincidenciasApenasNormalizadas, itensConhecidosNaoAptos, itensConhecidosAusentesNoPad }) {
  const mapa = new Map();

  for (const item of itensPadSemRateio) {
    const registro = obterResumoConvenio(mapa, item);
    registro.itensPadSemRateio += 1;
    registro.totalPendencias += 1;
  }
  for (const item of coincidenciasApenasNormalizadas) {
    obterResumoConvenio(mapa, item).coincidenciasApenasNormalizadas += 1;
  }
  for (const item of itensConhecidosNaoAptos) {
    const registro = obterResumoConvenio(mapa, item);
    registro.itensConhecidosNaoAptos += 1;
    registro.totalPendencias += 1;
  }
  for (const item of itensConhecidosAusentesNoPad) {
    const registro = obterResumoConvenio(mapa, item);
    registro.itensConhecidosAusentesNoPad += 1;
    registro.totalPendencias += 1;
  }

  return Array.from(mapa.values())
    .sort((a, b) => String(a.numeroConvenio || "").localeCompare(String(b.numeroConvenio || ""), "pt-BR"));
}

function montarRecomendacaoItemPadSemRateio(item) {
  if (item?.motivo === "descricao_original_divergente_da_memoria_rateio") {
    return "Conferir manualmente o nome original no PAD e na memória; se for o mesmo item, ajustar a memória futura sem aceitar correspondência automática por normalização.";
  }
  return "Criar ou validar memória de rateio para este item antes de permitir reconstrução automática.";
}

function montarRecomendacaoNaoApto(item) {
  return item?.possuiPendenciaImpedativa
    ? "Resolver a pendência impeditiva herdada da extração inicial antes de usar o item na reconstrução."
    : "Revisar o cadastro do item conhecido e confirmar aptidão para importação futura.";
}

function montarRecomendacaoAusente() {
  return "Confirmar se o item foi excluído, substituído ou consolidado no PAD atual; não inativar automaticamente.";
}

function montarParesPossiveis(itensPadSemRateio, itensConhecidosAusentesNoPad) {
  const ausentesPorNormalizada = new Map();
  for (const item of itensConhecidosAusentesNoPad) {
    const chave = chaveNormalizada(item);
    if (!chave.endsWith("::")) {
      if (!ausentesPorNormalizada.has(chave)) ausentesPorNormalizada.set(chave, []);
      ausentesPorNormalizada.get(chave).push(item);
    }
  }

  const pares = [];
  for (const itemPad of itensPadSemRateio) {
    const candidatos = ausentesPorNormalizada.get(chaveNormalizada(itemPad)) || [];
    for (const conhecido of candidatos) {
      pares.push({
        numeroConvenio: itemPad.numeroConvenio,
        uf: itemPad.uf || conhecido.uf || null,
        descricaoNormalizada: itemPad.descricaoNormalizada,
        itemPad: {
          descricaoOriginal: itemPad.descricaoOriginal,
          arquivo: itemPad.arquivo,
          aba: itemPad.aba,
          linha: itemPad.linha,
          valorTotalPrevisto: itemPad.valorTotalPrevisto,
        },
        itemConhecidoAusente: {
          id: conhecido.id,
          descricaoOriginalReferencia: conhecido.descricaoOriginalReferencia,
          totalRateiosAtivos: conhecido.totalRateiosAtivos,
          aptoParaImportacaoFutura: conhecido.aptoParaImportacaoFutura,
        },
        recomendacao: "Possível relação por descrição normalizada. Exige validação humana porque a descrição original não é critério automático de equivalência.",
      });
    }
  }

  return pares.sort(ordenarPorConvenioDescricao);
}

function montarRelatorio(payload) {
  const itensPadSemRateio = garantirArray(payload.itensPadSemRateio).slice().sort(ordenarPorConvenioDescricao);
  const itensConhecidosNaoAptos = garantirArray(payload.itensConhecidosNaoAptos).slice().sort(ordenarPorConvenioDescricao);
  const itensConhecidosAusentesNoPad = garantirArray(payload.itensConhecidosAusentesNoPad).slice().sort(ordenarPorConvenioDescricao);
  const coincidenciasApenasNormalizadas = itensPadSemRateio
    .filter((item) => item.motivo === "descricao_original_divergente_da_memoria_rateio")
    .sort(ordenarPorConvenioDescricao);
  const paresPossiveis = montarParesPossiveis(itensPadSemRateio, itensConhecidosAusentesNoPad);
  const resumoPorConvenioUf = agruparPorConvenioUf({
    itensPadSemRateio,
    coincidenciasApenasNormalizadas,
    itensConhecidosNaoAptos,
    itensConhecidosAusentesNoPad,
  });
  const conveniosAfetados = Array.from(new Set(resumoPorConvenioUf.map((item) => item.numeroConvenio).filter(Boolean))).sort();

  const itensPadSemRateioComProvidencia = itensPadSemRateio.map((item) => ({
    ...item,
    bloqueiaEtapa6: true,
    recomendacao: montarRecomendacaoItemPadSemRateio(item),
  }));
  const naoAptosComProvidencia = itensConhecidosNaoAptos.map((item) => ({
    ...item,
    bloqueiaEtapa6: true,
    recomendacao: montarRecomendacaoNaoApto(item),
  }));
  const ausentesComProvidencia = itensConhecidosAusentesNoPad.map((item) => ({
    ...item,
    bloqueiaEtapa6: false,
    recomendacao: montarRecomendacaoAusente(item),
  }));

  const resumo = {
    geradoEm: new Date().toISOString(),
    fonte: CAMINHO_ENTRADA_PADRAO,
    totalItensPadSemRateio: itensPadSemRateio.length,
    totalCoincidenciasApenasNormalizadas: coincidenciasApenasNormalizadas.length,
    totalItensConhecidosNaoAptos: itensConhecidosNaoAptos.length,
    totalItensConhecidosAusentesNoPad: itensConhecidosAusentesNoPad.length,
    totalParesPossiveisPorDescricaoNormalizada: paresPossiveis.length,
    totalConveniosAfetados: conveniosAfetados.length,
    conveniosAfetados,
    impedemEtapa6: {
      itensPadSemRateio: itensPadSemRateio.length,
      coincidenciasApenasNormalizadas: coincidenciasApenasNormalizadas.length,
      itensConhecidosNaoAptos: itensConhecidosNaoAptos.length,
      instrumentosNaoEncontradosNaCarteira: garantirArray(payload.instrumentosNaoEncontradosNaCarteira).length,
    },
  };

  return {
    resumo,
    resumoPorConvenioUf,
    itensPadSemRateio: itensPadSemRateioComProvidencia,
    itensPadCoincidemApenasPorDescricaoNormalizada: coincidenciasApenasNormalizadas.map((item) => ({
      ...item,
      bloqueiaEtapa6: true,
      recomendacao: montarRecomendacaoItemPadSemRateio(item),
    })),
    itensConhecidosNaoAptos: naoAptosComProvidencia,
    itensConhecidosAusentesNoPad: ausentesComProvidencia,
    possiveisParesDescricaoNormalizada: paresPossiveis,
    recomendacoesGerais: [
      "Não aplicar rateio automático em itens PAD sem correspondência por descrição original.",
      "Resolver itens conhecidos não aptos antes de reconstruir automaticamente o planoAplicacao.",
      "Tratar itens conhecidos ausentes no PAD como validação humana de exclusão/substituição, sem inativação automática.",
      "Usar pares por descrição normalizada apenas como apoio de saneamento, nunca como correspondência automática.",
    ],
  };
}

function escaparMarkdown(valor) {
  return String(valor ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function linhaTabela(colunas) {
  return `| ${colunas.map(escaparMarkdown).join(" | ")} |`;
}

function montarTabelaItens(titulo, itens, obterDescricao) {
  const linhas = [`## ${titulo}`, "", linhaTabela(["Convênio", "UF", "Descrição", "Providência"])];
  linhas.push(linhaTabela(["---", "---", "---", "---"]));
  for (const item of itens) {
    linhas.push(linhaTabela([
      item.numeroConvenio,
      item.uf,
      obterDescricao(item),
      item.recomendacao,
    ]));
  }
  linhas.push("");
  return linhas;
}

function montarMarkdown(relatorio) {
  const { resumo } = relatorio;
  const linhas = [
    "# PROFOR 2022 - Relatório de saneamento PAD x rateios",
    "",
    `Gerado em: ${resumo.geradoEm}`,
    "",
    "## Resumo",
    "",
    linhaTabela(["Indicador", "Quantidade"]),
    linhaTabela(["---", "---"]),
    linhaTabela(["Itens PAD sem rateio", resumo.totalItensPadSemRateio]),
    linhaTabela(["Coincidências apenas por descrição normalizada", resumo.totalCoincidenciasApenasNormalizadas]),
    linhaTabela(["Itens conhecidos não aptos", resumo.totalItensConhecidosNaoAptos]),
    linhaTabela(["Itens conhecidos ausentes no PAD", resumo.totalItensConhecidosAusentesNoPad]),
    linhaTabela(["Possíveis pares por descrição normalizada", resumo.totalParesPossiveisPorDescricaoNormalizada]),
    linhaTabela(["Convênios afetados", resumo.totalConveniosAfetados]),
    "",
    `Convênios afetados: ${resumo.conveniosAfetados.join(", ") || "nenhum"}`,
    "",
    "## Resumo por convênio e UF",
    "",
    linhaTabela(["Convênio", "UF", "PAD sem rateio", "Só normalizada", "Não aptos", "Ausentes no PAD", "Total"]),
    linhaTabela(["---", "---", "---", "---", "---", "---", "---"]),
  ];

  for (const item of relatorio.resumoPorConvenioUf) {
    linhas.push(linhaTabela([
      item.numeroConvenio,
      item.uf,
      item.itensPadSemRateio,
      item.coincidenciasApenasNormalizadas,
      item.itensConhecidosNaoAptos,
      item.itensConhecidosAusentesNoPad,
      item.totalPendencias,
    ]));
  }

  linhas.push("");
  linhas.push(...montarTabelaItens("Itens PAD sem rateio", relatorio.itensPadSemRateio, (item) => item.descricaoOriginal));
  linhas.push(...montarTabelaItens("Itens PAD que coincidem apenas por descrição normalizada", relatorio.itensPadCoincidemApenasPorDescricaoNormalizada, (item) => item.descricaoOriginal));
  linhas.push(...montarTabelaItens("Itens conhecidos não aptos", relatorio.itensConhecidosNaoAptos, (item) => item.descricaoOriginal));
  linhas.push(...montarTabelaItens("Itens conhecidos ausentes no PAD", relatorio.itensConhecidosAusentesNoPad, (item) => item.descricaoOriginalReferencia));

  linhas.push("## Possíveis pares por descrição normalizada");
  linhas.push("");
  linhas.push(linhaTabela(["Convênio", "UF", "Item PAD", "Item conhecido ausente", "Providência"]));
  linhas.push(linhaTabela(["---", "---", "---", "---", "---"]));
  for (const par of relatorio.possiveisParesDescricaoNormalizada) {
    linhas.push(linhaTabela([
      par.numeroConvenio,
      par.uf,
      par.itemPad.descricaoOriginal,
      par.itemConhecidoAusente.descricaoOriginalReferencia,
      par.recomendacao,
    ]));
  }

  linhas.push("");
  linhas.push("## Itens que impedem a Etapa 6");
  linhas.push("");
  linhas.push("- Itens PAD sem rateio impedem reconstrução automática enquanto não houver memória validada.");
  linhas.push("- Coincidências apenas por descrição normalizada impedem reconstrução automática para esses itens.");
  linhas.push("- Itens conhecidos não aptos impedem uso automático até saneamento das pendências impeditivas.");
  linhas.push("- Itens conhecidos ausentes no PAD não bloqueiam a reconstrução dos itens PAD atuais, mas exigem validação humana antes de qualquer exclusão/substituição.");
  linhas.push("");

  return `${linhas.join("\n")}\n`;
}

function escreverArquivoJson(caminho, dados) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoEntrada = path.join(repoRoot, CAMINHO_ENTRADA_PADRAO);
  const caminhoSaidaJson = path.join(repoRoot, CAMINHO_SAIDA_JSON);
  const caminhoSaidaMd = path.join(repoRoot, CAMINHO_SAIDA_MD);
  const payload = lerJson(caminhoEntrada);
  const relatorio = montarRelatorio(payload);

  escreverArquivoJson(caminhoSaidaJson, relatorio);
  fs.writeFileSync(caminhoSaidaMd, montarMarkdown(relatorio), "utf8");

  console.log("Relatório de saneamento PAD x rateios PROFOR 2022");
  console.log(`Entrada: ${CAMINHO_ENTRADA_PADRAO}`);
  console.log(`Saída JSON: ${CAMINHO_SAIDA_JSON}`);
  console.log(`Saída Markdown: ${CAMINHO_SAIDA_MD}`);
  console.log(`Itens PAD sem rateio: ${relatorio.resumo.totalItensPadSemRateio}`);
  console.log(`Coincidências apenas por descrição normalizada: ${relatorio.resumo.totalCoincidenciasApenasNormalizadas}`);
  console.log(`Itens conhecidos não aptos: ${relatorio.resumo.totalItensConhecidosNaoAptos}`);
  console.log(`Itens conhecidos ausentes no PAD: ${relatorio.resumo.totalItensConhecidosAusentesNoPad}`);
  console.log(`Possíveis pares por descrição normalizada: ${relatorio.resumo.totalParesPossiveisPorDescricaoNormalizada}`);
  console.log(`Convênios afetados: ${relatorio.resumo.conveniosAfetados.join(", ") || "nenhum"}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao gerar relatório de saneamento PAD x rateios PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

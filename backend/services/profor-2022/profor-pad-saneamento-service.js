const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");

const CAMINHO_SANEAMENTO_PADRAO = "backend/data/relatorios/profor-2022-pad-saneamento.json";

const ORDEM_NIVEL_ALERTA = { impeditivo: 0, aviso: 1, info: 2 };

function repoRootPadrao() {
  return path.resolve(__dirname, "../../..");
}

function lerJson(caminhoAbsoluto) {
  return JSON.parse(fs.readFileSync(caminhoAbsoluto, "utf8"));
}

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function chaveItemNormalizada(valor) {
  return String(valor ?? "").trim();
}

function escaparMarkdown(valor) {
  return String(valor ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function linhaTabela(colunas) {
  return `| ${colunas.map(escaparMarkdown).join(" | ")} |`;
}

function escreverArquivoJson(caminho, dados) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

/**
 * Lê o relatório de saneamento base (saída de gerar-relatorio-saneamento-pad-profor-2022.js)
 * e valida a presença das listas esperadas.
 */
function carregarSaneamentoBase(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || repoRootPadrao();
  const caminhoRelativo = opcoes.caminhoSaneamento || CAMINHO_SANEAMENTO_PADRAO;
  const caminhoAbsoluto = path.isAbsolute(caminhoRelativo)
    ? caminhoRelativo
    : path.join(repoRoot, caminhoRelativo);

  if (!fs.existsSync(caminhoAbsoluto)) {
    throw new Error(
      `Relatório de saneamento não encontrado: ${caminhoAbsoluto}. ` +
      "Execute 'npm run profor:pad:relatorio-saneamento' antes."
    );
  }

  const dados = lerJson(caminhoAbsoluto);
  if (!dados || typeof dados !== "object") {
    throw new Error("Relatório de saneamento inválido: conteúdo ausente.");
  }
  if (!Array.isArray(dados.itensConhecidosNaoAptos)) {
    throw new Error("Relatório de saneamento inválido: itensConhecidosNaoAptos deve ser um array.");
  }

  return { repoRoot, caminhoRelativo, caminhoAbsoluto, dados };
}

/**
 * Carrega os alertas da importação inicial agrupados por chave_item.
 * O cruzamento é feito apenas por igualdade exata de chave_item (sem fuzzy).
 */
function carregarAlertasPorChaveItem() {
  const linhas = db.prepare(`
    SELECT
      a.id,
      a.lote_importacao_id,
      a.chave_item,
      a.tipo,
      a.nivel,
      a.numero_convenio,
      a.uf,
      a.ano,
      a.descricao,
      a.detalhe,
      a.origem_arquivo,
      a.origem_aba,
      a.origem_linha,
      a.criado_em
    FROM profor_2022_rateio_import_alertas a
    ORDER BY a.chave_item, a.id
  `).all();

  const mapa = new Map();
  for (const linha of linhas) {
    const chave = chaveItemNormalizada(linha.chave_item);
    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push({
      id: linha.id,
      loteImportacaoId: linha.lote_importacao_id,
      tipo: linha.tipo,
      nivel: linha.nivel,
      numeroConvenio: linha.numero_convenio,
      uf: linha.uf,
      ano: linha.ano,
      descricao: linha.descricao,
      detalhe: linha.detalhe,
      origem: {
        arquivo: linha.origem_arquivo,
        aba: linha.origem_aba,
        linha: linha.origem_linha,
      },
      criadoEm: linha.criado_em,
    });
  }

  for (const alertas of mapa.values()) {
    alertas.sort((a, b) => {
      const ordemA = ORDEM_NIVEL_ALERTA[a.nivel] ?? 9;
      const ordemB = ORDEM_NIVEL_ALERTA[b.nivel] ?? 9;
      return ordemA - ordemB || (a.id || 0) - (b.id || 0);
    });
  }
  return mapa;
}

/** Carrega os itens conhecidos ativos indexados por chave_item. */
function carregarItensConhecidosPorChave() {
  const linhas = db.prepare(`
    SELECT
      id,
      chave_item,
      numero_convenio,
      descricao_normalizada,
      descricao_original_referencia,
      uf,
      ano,
      possui_pendencia_impeditiva,
      apto_para_importacao_futura,
      status_item,
      lote_importacao_id
    FROM profor_2022_itens_conhecidos
    WHERE ativo = 1
  `).all();

  const mapa = new Map();
  for (const linha of linhas) {
    mapa.set(chaveItemNormalizada(linha.chave_item), {
      id: linha.id,
      chaveItem: linha.chave_item,
      numeroConvenio: linha.numero_convenio,
      descricaoNormalizada: linha.descricao_normalizada,
      descricaoOriginalReferencia: linha.descricao_original_referencia,
      uf: linha.uf,
      ano: linha.ano,
      possuiPendenciaImpeditiva: linha.possui_pendencia_impeditiva === 1,
      aptoParaImportacaoFutura: linha.apto_para_importacao_futura === 1,
      statusItem: linha.status_item,
      loteImportacaoId: linha.lote_importacao_id,
    });
  }
  return mapa;
}

/** Carrega os rateios ativos agrupados por item_conhecido_id. */
function carregarRateiosAtivosPorItem() {
  const linhas = db.prepare(`
    SELECT
      item_conhecido_id,
      area,
      natureza,
      quantidade_referencia,
      valor_previsto_referencia,
      valor_executado_referencia,
      percentual_quantidade,
      percentual_valor
    FROM profor_2022_item_rateios
    WHERE ativo = 1
    ORDER BY item_conhecido_id, area, natureza
  `).all();

  const mapa = new Map();
  for (const linha of linhas) {
    const itemId = linha.item_conhecido_id;
    if (!mapa.has(itemId)) mapa.set(itemId, []);
    mapa.get(itemId).push({
      area: linha.area,
      natureza: linha.natureza,
      quantidadeReferencia: linha.quantidade_referencia,
      valorPrevistoReferencia: linha.valor_previsto_referencia,
      valorExecutadoReferencia: linha.valor_executado_referencia,
      percentualQuantidade: linha.percentual_quantidade,
      percentualValor: linha.percentual_valor,
    });
  }
  return mapa;
}

/** Deriva a providência recomendada para um item não apto, a partir dos alertas originais. */
function derivarProvidencia(item, alertas) {
  if (!alertas.length) {
    return "Item marcado como não apto, mas nenhum alerta de origem foi localizado. "
      + "Revisar manualmente o cadastro e a aptidão para importação futura.";
  }
  const impeditivos = alertas.filter((alerta) => alerta.nivel === "impeditivo");
  if (impeditivos.length) {
    const tipos = Array.from(new Set(impeditivos.map((alerta) => alerta.tipo))).join(", ");
    const lote = impeditivos[0].loteImportacaoId;
    return `Resolver o(s) alerta(s) impeditivo(s) [${tipos}] herdado(s) do lote de importação ${lote} `
      + "antes de liberar o item para reconstrução.";
  }
  return "Revisar os alertas de origem (nível aviso) e confirmar a aptidão do item para importação futura.";
}

/**
 * Cruza os 19 itens conhecidos não aptos do relatório de saneamento com os alertas
 * originais, itens conhecidos e rateios ativos persistidos no banco.
 */
function enriquecerItensNaoAptos(itensNaoAptos, contexto) {
  const { alertasPorChave, itensPorChave, rateiosPorItem } = contexto;
  const detalhados = [];
  const semAlertaOrigem = [];

  for (const item of itensNaoAptos) {
    const chave = chaveItemNormalizada(item.chaveItem);
    const alertasOriginais = alertasPorChave.get(chave) || [];
    const itemBanco = itensPorChave.get(chave) || null;
    const itemConhecidoId = item.itemConhecidoId || itemBanco?.id || null;
    const rateiosAtivos = itemConhecidoId ? (rateiosPorItem.get(itemConhecidoId) || []) : [];

    const detalhado = {
      chaveItem: item.chaveItem,
      chaveDescricaoOriginal: item.chaveDescricaoOriginal || null,
      numeroConvenio: item.numeroConvenio || null,
      uf: item.uf || itemBanco?.uf || null,
      ano: item.ano || itemBanco?.ano || null,
      descricaoOriginal: item.descricaoOriginal || itemBanco?.descricaoOriginalReferencia || null,
      descricaoNormalizada: item.descricaoNormalizada || itemBanco?.descricaoNormalizada || null,
      itemConhecidoId,
      statusItem: itemBanco?.statusItem || null,
      possuiPendenciaImpeditiva: Boolean(
        item.possuiPendenciaImpedativa ?? itemBanco?.possuiPendenciaImpeditiva
      ),
      loteImportacaoOrigem: itemBanco?.loteImportacaoId ?? null,
      totalAlertasOriginais: alertasOriginais.length,
      totalAlertasImpeditivos: alertasOriginais.filter((a) => a.nivel === "impeditivo").length,
      alertasOriginais: alertasOriginais.map((alerta) => ({
        tipo: alerta.tipo,
        nivel: alerta.nivel,
        detalhe: alerta.detalhe,
        loteImportacaoId: alerta.loteImportacaoId,
        origem: alerta.origem,
      })),
      rateiosAtivos,
      providenciaRecomendada: derivarProvidencia(item, alertasOriginais),
    };

    detalhados.push(detalhado);
    if (!alertasOriginais.length) semAlertaOrigem.push(detalhado);
  }

  detalhados.sort((a, b) =>
    String(a.numeroConvenio || "").localeCompare(String(b.numeroConvenio || ""), "pt-BR")
    || String(a.descricaoOriginal || "").localeCompare(String(b.descricaoOriginal || ""), "pt-BR")
  );
  return { detalhados, semAlertaOrigem };
}

/** Orquestra a montagem do relatório de saneamento detalhado. */
function montarSaneamentoDetalhado(opcoes = {}) {
  const base = carregarSaneamentoBase(opcoes);
  const itensNaoAptos = garantirArray(base.dados.itensConhecidosNaoAptos);

  const contexto = {
    alertasPorChave: carregarAlertasPorChaveItem(),
    itensPorChave: carregarItensConhecidosPorChave(),
    rateiosPorItem: carregarRateiosAtivosPorItem(),
  };

  const { detalhados, semAlertaOrigem } = enriquecerItensNaoAptos(itensNaoAptos, contexto);

  const resumo = {
    geradoEm: new Date().toISOString(),
    fonteSaneamento: base.caminhoRelativo,
    totalItensNaoAptos: detalhados.length,
    totalItensNaoAptosComAlertaOrigem: detalhados.length - semAlertaOrigem.length,
    totalItensNaoAptosSemAlertaOrigem: semAlertaOrigem.length,
    totalAlertasImpeditivosVinculados: detalhados.reduce(
      (soma, item) => soma + item.totalAlertasImpeditivos,
      0
    ),
  };

  return {
    resumo,
    itensNaoAptosDetalhados: detalhados,
    itensSemAlertaOrigem: semAlertaOrigem,
  };
}

/** Gera o Markdown do relatório detalhado. */
function montarMarkdownDetalhado(relatorio) {
  const { resumo } = relatorio;
  const linhas = [
    "# PROFOR 2022 - Saneamento PAD detalhado (causa original dos itens não aptos)",
    "",
    `Gerado em: ${resumo.geradoEm}`,
    `Fonte: ${resumo.fonteSaneamento}`,
    "",
    "## Resumo",
    "",
    linhaTabela(["Indicador", "Quantidade"]),
    linhaTabela(["---", "---"]),
    linhaTabela(["Itens conhecidos não aptos", resumo.totalItensNaoAptos]),
    linhaTabela(["Com alerta de origem identificado", resumo.totalItensNaoAptosComAlertaOrigem]),
    linhaTabela(["Sem alerta de origem identificado", resumo.totalItensNaoAptosSemAlertaOrigem]),
    linhaTabela(["Alertas impeditivos vinculados", resumo.totalAlertasImpeditivosVinculados]),
    "",
    "## Itens não aptos e causa original",
    "",
    linhaTabela(["Convênio", "UF", "Descrição", "Alertas de origem", "Rateios ativos", "Providência"]),
    linhaTabela(["---", "---", "---", "---", "---", "---"]),
  ];

  for (const item of relatorio.itensNaoAptosDetalhados) {
    const alertasTexto = item.alertasOriginais.length
      ? item.alertasOriginais
          .map((a) => `[${a.nivel}] ${a.tipo}: ${a.detalhe || "sem detalhe"} `
            + `(${a.origem?.arquivo || "?"} / ${a.origem?.aba || "?"} / linha ${a.origem?.linha ?? "?"})`)
          .join(" • ")
      : "Nenhum alerta de origem localizado";
    const rateiosTexto = item.rateiosAtivos.length
      ? item.rateiosAtivos
          .map((r) => `${r.area}/${r.natureza} (${r.percentualValor}% valor)`)
          .join(" • ")
      : "Nenhum rateio ativo";
    linhas.push(linhaTabela([
      item.numeroConvenio,
      item.uf,
      item.descricaoOriginal,
      alertasTexto,
      rateiosTexto,
      item.providenciaRecomendada,
    ]));
  }

  linhas.push("");
  if (relatorio.itensSemAlertaOrigem.length) {
    linhas.push("## Itens não aptos sem alerta de origem");
    linhas.push("");
    linhas.push("Estes itens estão marcados como não aptos, mas nenhum alerta da importação");
    linhas.push("inicial foi localizado por chave_item. Exigem investigação manual.");
    linhas.push("");
    linhas.push(linhaTabela(["Convênio", "UF", "Descrição", "Providência"]));
    linhas.push(linhaTabela(["---", "---", "---", "---"]));
    for (const item of relatorio.itensSemAlertaOrigem) {
      linhas.push(linhaTabela([
        item.numeroConvenio,
        item.uf,
        item.descricaoOriginal,
        item.providenciaRecomendada,
      ]));
    }
    linhas.push("");
  } else {
    linhas.push("## Itens não aptos sem alerta de origem");
    linhas.push("");
    linhas.push("Nenhum: todos os itens não aptos têm alerta de origem identificado.");
    linhas.push("");
  }

  return `${linhas.join("\n")}\n`;
}

/** Persiste o relatório detalhado em JSON e Markdown. */
function salvarSaneamentoDetalhado(relatorio, { caminhoJson, caminhoMd }) {
  escreverArquivoJson(caminhoJson, relatorio);
  fs.mkdirSync(path.dirname(caminhoMd), { recursive: true });
  fs.writeFileSync(caminhoMd, montarMarkdownDetalhado(relatorio), "utf8");
}

module.exports = {
  CAMINHO_SANEAMENTO_PADRAO,
  carregarSaneamentoBase,
  carregarAlertasPorChaveItem,
  carregarItensConhecidosPorChave,
  carregarRateiosAtivosPorItem,
  enriquecerItensNaoAptos,
  montarSaneamentoDetalhado,
  montarMarkdownDetalhado,
  salvarSaneamentoDetalhado,
};

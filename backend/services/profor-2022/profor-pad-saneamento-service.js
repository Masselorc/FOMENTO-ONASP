const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const { normalizarTextoProfor } = require("./profor-plano-aplicacao-service");

const CAMINHO_SANEAMENTO_PADRAO = "backend/data/relatorios/profor-2022-pad-saneamento.json";
const CAMINHO_SANEAMENTO_DETALHADO_PADRAO = "backend/data/relatorios/profor-2022-pad-saneamento-detalhado.json";
const CAMINHO_DECISOES_PADRAO = "backend/data/relatorios/profor-2022-pad-decisoes-saneamento.json";

const ORDEM_NIVEL_ALERTA = { impeditivo: 0, aviso: 1, info: 2 };

const VERSAO_ESQUEMA_DECISOES = 1;
const DECISAO_PENDENTE = "PENDENTE";

// Áreas reconhecidas em descrições de itens PAD para sugestão (nunca decisão final).
const PALAVRAS_AREA = [
  { regex: /\bOUVIDORIA\b/, area: "OUVIDORIA" },
  { regex: /\bCORREGEDORIA\b/, area: "CORREGEDORIA" },
  { regex: /\bESCOLA\b/, area: "ESCOLA PENAL" },
];

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
      valor_unitario_referencia,
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
      valorUnitarioReferencia: linha.valor_unitario_referencia,
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
      valorUnitarioReferencia: itemBanco?.valorUnitarioReferencia ?? null,
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

/* ------------------------------------------------------------------ *
 * Etapa C — Template de decisões de saneamento
 * ------------------------------------------------------------------ */

/**
 * Sugere uma área de rateio quando a descrição contém claramente o nome de
 * uma área. É APENAS sugestão informativa — nunca decisão final.
 */
function derivarSugestaoArea(descricao) {
  const normalizada = normalizarTextoProfor(descricao);
  if (!normalizada) return null;
  const encontradas = PALAVRAS_AREA
    .filter((item) => item.regex.test(normalizada))
    .map((item) => item.area);
  if (encontradas.length !== 1) return null; // ambíguo ou nenhum → sem sugestão
  return encontradas[0];
}

/**
 * Resume o indício de equivalência (valor unitário + natureza) de um item PAD,
 * em formato seguro para o template. É evidência informativa para decisão
 * humana — nunca decisão automática.
 */
function resumirIndicioEquivalencia(item) {
  const indicio = item && item.indicioEquivalencia;
  if (!indicio || typeof indicio !== "object") return null;
  return {
    valorUnitarioPad: indicio.valorUnitarioPad ?? null,
    valorUnitarioReferenciaMemoria: indicio.valorUnitarioReferenciaMemoria ?? null,
    valorUnitarioCoincide: indicio.valorUnitarioCoincide ?? null,
    diferencaValorUnitario: indicio.diferencaValorUnitario ?? null,
    naturezaPad: indicio.naturezaPad ?? null,
    naturezasEncontradasMemoria: garantirArray(indicio.naturezasEncontradasMemoria),
  };
}

/** Monta as entradas de equivalência (4 coincidências apenas normalizadas). */
function montarEntradasEquivalencias(saneamento) {
  return garantirArray(saneamento.itensPadCoincidemApenasPorDescricaoNormalizada)
    .map((item) => ({
      id: chaveItemNormalizada(item.chaveItem),
      numeroConvenio: item.numeroConvenio || null,
      uf: item.uf || null,
      descricaoPad: item.descricaoOriginal || null,
      descricaoItemConhecido: item.descricaoOriginalReferencia || null,
      itemConhecidoNormalizadoId: item.itemConhecidoNormalizadoId || null,
      indicioEquivalencia: resumirIndicioEquivalencia(item),
      decisao: DECISAO_PENDENTE,
      acao: null,
      justificativa: "",
      validadoPor: null,
      validadoEm: null,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR"));
}

/**
 * Monta as entradas de rateios novos para itens PAD sem rateio.
 * Exclui os itens de coincidência apenas normalizada (tratados em
 * equivalenciasConfirmadas — não recebem rateio novo até a equivalência decidida).
 */
function montarEntradasRateiosNovos(saneamento) {
  return garantirArray(saneamento.itensPadSemRateio)
    .filter((item) => item.motivo !== "descricao_original_divergente_da_memoria_rateio")
    .map((item) => ({
      id: chaveItemNormalizada(item.chaveItem),
      numeroConvenio: item.numeroConvenio || null,
      uf: item.uf || null,
      descricaoPad: item.descricaoOriginal || null,
      natureza: item.natureza || null,
      codigoNaturezaDespesa: item.codigoNaturezaDespesa || null,
      quantidadePad: item.quantidade ?? null,
      valorTotalPrevistoPad: item.valorTotalPrevisto ?? null,
      sugestaoRateio: derivarSugestaoArea(item.descricaoOriginal),
      decisao: DECISAO_PENDENTE,
      acao: null,
      rateio: [],
      justificativa: "",
      validadoPor: null,
      validadoEm: null,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR"));
}

/** Monta as entradas de correção de itens não aptos (19), com alertas da Etapa B. */
function montarEntradasCorrecoes(saneamento, detalhadoPorChave) {
  return garantirArray(saneamento.itensConhecidosNaoAptos)
    .map((item) => {
      const chave = chaveItemNormalizada(item.chaveItem);
      const detalhado = detalhadoPorChave.get(chave) || null;
      return {
        id: chave,
        numeroConvenio: item.numeroConvenio || null,
        uf: item.uf || null,
        descricaoItemConhecido: item.descricaoOriginal || null,
        itemConhecidoId: item.itemConhecidoId || detalhado?.itemConhecidoId || null,
        possuiPendenciaImpeditiva: Boolean(
          item.possuiPendenciaImpedativa ?? detalhado?.possuiPendenciaImpeditiva
        ),
        alertasOriginais: detalhado ? detalhado.alertasOriginais : [],
        decisao: DECISAO_PENDENTE,
        acao: null,
        rateiosCorrigidos: [],
        justificativa: "",
        validadoPor: null,
        validadoEm: null,
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR"));
}

/** Monta as entradas de validação de ausências (32 itens conhecidos ausentes no PAD). */
function montarEntradasAusencias(saneamento) {
  return garantirArray(saneamento.itensConhecidosAusentesNoPad)
    .map((item) => ({
      id: chaveItemNormalizada(item.chaveItem),
      numeroConvenio: item.numeroConvenio || null,
      uf: item.uf || null,
      descricaoItemConhecido: item.descricaoOriginalReferencia || null,
      itemConhecidoId: item.id || null,
      totalRateiosAtivos: item.totalRateiosAtivos ?? null,
      decisao: DECISAO_PENDENTE,
      acao: null,
      descricaoItemPadSubstituto: null,
      justificativa: "",
      validadoPor: null,
      validadoEm: null,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR"));
}

/** Campos preenchidos pelo humano que o merge deve preservar entre regenerações. */
const CAMPOS_DECISAO_HUMANA = [
  "decisao",
  "acao",
  "justificativa",
  "rateio",
  "rateiosCorrigidos",
  "descricaoItemPadSubstituto",
  "validadoPor",
  "validadoEm",
];

/**
 * Mescla uma lista recém-gerada com a lista existente, por `id`.
 * Preserva os campos de decisão humana; atualiza apenas campos descritivos.
 * Devolve { lista, obsoletas } — entradas existentes sem correspondência viram obsoletas.
 */
function mesclarLista(secao, listaNova, listaExistente) {
  const existentePorId = new Map(
    garantirArray(listaExistente).map((item) => [String(item?.id ?? ""), item])
  );
  const idsNovos = new Set(listaNova.map((item) => String(item.id)));

  const lista = listaNova.map((entradaNova) => {
    const anterior = existentePorId.get(String(entradaNova.id));
    if (!anterior) return entradaNova;
    const mesclada = { ...entradaNova };
    for (const campo of CAMPOS_DECISAO_HUMANA) {
      if (Object.prototype.hasOwnProperty.call(anterior, campo) && anterior[campo] !== undefined) {
        mesclada[campo] = anterior[campo];
      }
    }
    return mesclada;
  });

  const obsoletas = garantirArray(listaExistente)
    .filter((item) => !idsNovos.has(String(item?.id ?? "")))
    .map((item) => ({
      secao,
      id: item?.id ?? null,
      decisao: item?.decisao ?? null,
      justificativa: item?.justificativa ?? null,
      motivo: "Entrada não corresponde a nenhuma pendência do saneamento atual.",
    }));

  return { lista, obsoletas };
}

/**
 * Gera (ou atualiza, de forma idempotente) o template de decisões de saneamento.
 * Se já existir um arquivo, preserva as decisões humanas mesclando por `id`.
 */
function gerarTemplateDecisoesSaneamento(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || repoRootPadrao();
  const base = carregarSaneamentoBase({ repoRoot, caminhoSaneamento: opcoes.caminhoSaneamento });
  const saneamento = base.dados;

  // Relatório detalhado (Etapa B) é opcional: fornece os alertasOriginais.
  const caminhoDetalhado = path.join(
    repoRoot,
    opcoes.caminhoSaneamentoDetalhado || CAMINHO_SANEAMENTO_DETALHADO_PADRAO
  );
  const detalhadoPorChave = new Map();
  let fonteSaneamentoDetalhado = null;
  if (fs.existsSync(caminhoDetalhado)) {
    const detalhado = lerJson(caminhoDetalhado);
    fonteSaneamentoDetalhado = opcoes.caminhoSaneamentoDetalhado || CAMINHO_SANEAMENTO_DETALHADO_PADRAO;
    for (const item of garantirArray(detalhado.itensNaoAptosDetalhados)) {
      detalhadoPorChave.set(chaveItemNormalizada(item.chaveItem), item);
    }
  }

  const caminhoDecisoes = path.join(repoRoot, opcoes.caminhoDecisoes || CAMINHO_DECISOES_PADRAO);
  const existente = fs.existsSync(caminhoDecisoes) ? lerJson(caminhoDecisoes) : null;

  const equivalencias = mesclarLista(
    "equivalenciasConfirmadas",
    montarEntradasEquivalencias(saneamento),
    existente?.equivalenciasConfirmadas
  );
  const rateiosNovos = mesclarLista(
    "rateiosNovos",
    montarEntradasRateiosNovos(saneamento),
    existente?.rateiosNovos
  );
  const correcoes = mesclarLista(
    "correcoesItensNaoAptos",
    montarEntradasCorrecoes(saneamento, detalhadoPorChave),
    existente?.correcoesItensNaoAptos
  );
  const ausencias = mesclarLista(
    "ausenciasValidadas",
    montarEntradasAusencias(saneamento),
    existente?.ausenciasValidadas
  );

  // substituicoes e observacoes são criadas só pelo humano: nunca pré-populadas.
  const substituicoes = garantirArray(existente?.substituicoes);
  const observacoes = garantirArray(existente?.observacoes);

  const entradasObsoletas = [
    ...equivalencias.obsoletas,
    ...rateiosNovos.obsoletas,
    ...correcoes.obsoletas,
    ...ausencias.obsoletas,
  ];

  const agora = new Date().toISOString();
  const metadados = {
    versaoEsquema: VERSAO_ESQUEMA_DECISOES,
    geradoEm: existente?.metadados?.geradoEm || agora,
    atualizadoEm: agora,
    origem: "relatorio-saneamento-pad",
    observacao: "Template para decisões humanas de saneamento PAD x rateios. "
      + "Não edite o campo 'id'. 'decisao' deve permanecer 'PENDENTE' até validação humana. "
      + "'sugestaoRateio' é informativo e não substitui a decisão.",
    fonteSaneamento: base.caminhoRelativo,
    fonteSaneamentoDetalhado,
    totais: {
      equivalenciasConfirmadas: equivalencias.lista.length,
      rateiosNovos: rateiosNovos.lista.length,
      correcoesItensNaoAptos: correcoes.lista.length,
      ausenciasValidadas: ausencias.lista.length,
      substituicoes: substituicoes.length,
      observacoes: observacoes.length,
    },
    entradasObsoletas,
  };

  return {
    caminhoDecisoes,
    template: {
      metadados,
      equivalenciasConfirmadas: equivalencias.lista,
      rateiosNovos: rateiosNovos.lista,
      correcoesItensNaoAptos: correcoes.lista,
      ausenciasValidadas: ausencias.lista,
      substituicoes,
      observacoes,
    },
  };
}

/** Persiste o template de decisões em JSON. */
function salvarTemplateDecisoes(caminhoDecisoes, template) {
  escreverArquivoJson(caminhoDecisoes, template);
}

module.exports = {
  CAMINHO_SANEAMENTO_PADRAO,
  CAMINHO_SANEAMENTO_DETALHADO_PADRAO,
  CAMINHO_DECISOES_PADRAO,
  VERSAO_ESQUEMA_DECISOES,
  DECISAO_PENDENTE,
  carregarSaneamentoBase,
  carregarAlertasPorChaveItem,
  carregarItensConhecidosPorChave,
  carregarRateiosAtivosPorItem,
  enriquecerItensNaoAptos,
  montarSaneamentoDetalhado,
  montarMarkdownDetalhado,
  salvarSaneamentoDetalhado,
  derivarSugestaoArea,
  gerarTemplateDecisoesSaneamento,
  salvarTemplateDecisoes,
};

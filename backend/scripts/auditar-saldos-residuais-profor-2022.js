const fs = require("node:fs");
const path = require("node:path");

const db = require("../db/database");
const {
  DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
  ehSaldoResidualProfor,
  normalizarTextoSaldoResidual,
  normalizarAreaSaldoResidual,
  areaSaldoResidualEhOperacional,
  areaSaldoResidualEhTecnica,
  normalizarNaturezaSaldoResidual,
  naturezaSaldoResidualValida,
  criarChaveSaldoResidual,
} = require("../services/profor-2022/profor-saldo-residual-service");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.md";

const FONTES_RELATORIOS = [
  "backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json",
  "backend/data/relatorios/profor-2022-pad-saneamento.json",
  "backend/data/relatorios/profor-2022-pad-saneamento-detalhado.json",
  "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json",
  "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json",
  "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
  "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json",
];

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(repoRoot(), caminhoRelativo);
}

function parseJsonSeguro(texto, padrao = null) {
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

function lerJsonSeExistir(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  if (!fs.existsSync(caminho)) return null;
  return parseJsonSeguro(fs.readFileSync(caminho, "utf8"), null);
}

function escreverJson(caminhoRelativo, dados) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverTexto(caminhoRelativo, texto) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${texto.trimEnd()}\n`, "utf8");
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function arredondarMoeda(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function descricaoDoObjeto(obj) {
  if (!obj || typeof obj !== "object") return "";
  return obj.descricao
    || obj.descricaoOriginal
    || obj.descricaoNormalizada
    || obj.descricaoOriginalReferencia
    || obj.descricaoMemoria
    || obj.descricaoPad
    || obj.descricaoItemConhecido
    || obj.valorAnterior
    || obj.valorNovo
    || obj.chaveItem
    || obj.chave_item
    || "";
}

function objetoResumo(obj) {
  if (!obj || typeof obj !== "object") return {};
  return {
    numeroConvenio: obj.numeroConvenio || obj.numero_convenio || obj.instrumento || obj.numero || null,
    uf: obj.uf || null,
    descricaoOriginal: descricaoDoObjeto(obj),
    descricaoNormalizada: normalizarTextoSaldoResidual(descricaoDoObjeto(obj)),
    natureza: normalizarNaturezaSaldoResidual(obj.natureza || obj.naturezaPad || obj.naturezaMemoria),
    codigoNaturezaDespesa: obj.codigoNaturezaDespesa || obj.codigo_natureza_despesa || null,
    areaOriginal: obj.area || obj.areaMemoria || null,
    areaTecnica: normalizarAreaSaldoResidual(obj.area || obj.areaMemoria),
    valorUnitario: numero(obj.valorUnitario ?? obj.valorUnitarioPad ?? obj.valorUnitarioMemoria ?? obj.valor_unitario_referencia),
    quantidade: numero(obj.quantidade ?? obj.quantidadePad ?? obj.quantidadeMemoria ?? obj.quantidadeReferencia ?? obj.quantidade_referencia),
    valorPrevisto: numero(obj.valorPrevisto ?? obj.valorPrevistoPad ?? obj.valorPrevistoMemoria ?? obj.valorPrevistoReferencia ?? obj.valor_previsto_referencia ?? obj.valorTotalPrevisto),
    valorExecutado: numero(obj.valorExecutado ?? obj.valorExecutadoPad ?? obj.valorExecutadoMemoria ?? obj.valorExecutadoReferencia ?? obj.valor_executado_referencia ?? obj.valorTotalExecutado),
    saldo: numero(obj.saldo ?? obj.saldoPad ?? obj.saldoMemoria),
  };
}

function classificarRegistro(base) {
  const areaOperacionalIndevida = areaSaldoResidualEhOperacional(base.areaOriginal);
  const areaTecnicaNaoSetorializada = areaSaldoResidualEhTecnica(base.areaOriginal);
  const naturezaValida = naturezaSaldoResidualValida(base.natureza);
  let classificacao = "saldo_residual_ok_nao_setorializado";
  if (!naturezaValida) classificacao = "saldo_residual_sem_natureza";
  if (areaOperacionalIndevida) classificacao = "saldo_residual_rateado_indevidamente";
  return {
    ...base,
    chaveSaldoResidual: criarChaveSaldoResidual({
      numeroConvenio: base.numeroConvenio,
      descricao: base.descricaoOriginal,
      natureza: base.natureza,
    }),
    areaTecnicaNaoSetorializada,
    areaOperacionalIndevida,
    naturezaValida,
    classificacao,
    recomendacao: areaOperacionalIndevida
      ? "Neutralizar rateio por area operacional no dry-run; manter area tecnica nao setorializada."
      : "Manter como item tecnico segregado por natureza.",
  };
}

function adicionarRegistro(registros, origem, obj, extra = {}) {
  const desc = descricaoDoObjeto(obj);
  if (!ehSaldoResidualProfor(desc)) return;
  registros.push(classificarRegistro({
    origem,
    ...objetoResumo(obj),
    ...extra,
  }));
}

function varrerJson(registros, origem, valor, limite = { total: 0 }) {
  if (limite.total > 20000 || valor === null || valor === undefined) return;
  if (Array.isArray(valor)) {
    for (const item of valor) varrerJson(registros, origem, item, limite);
    return;
  }
  if (typeof valor !== "object") return;
  limite.total += 1;
  adicionarRegistro(registros, origem, valor);
  for (const item of Object.values(valor)) {
    if (item && typeof item === "object") varrerJson(registros, origem, item, limite);
  }
}

function carregarRegistrosBanco() {
  const registros = [];
  const itens = db.prepare(`
    SELECT i.id AS item_conhecido_id, i.chave_item, i.numero_convenio, i.uf, i.ano,
           i.descricao_normalizada, i.descricao_original_referencia,
           i.naturezas_encontradas_json, r.area, r.natureza,
           r.quantidade_referencia, r.valor_previsto_referencia,
           r.valor_executado_referencia, r.percentual_quantidade, r.percentual_valor
    FROM profor_2022_itens_conhecidos i
    LEFT JOIN profor_2022_item_rateios r ON r.item_conhecido_id = i.id AND r.ativo = 1
    WHERE i.ativo = 1
    ORDER BY i.numero_convenio, i.descricao_original_referencia, r.area, r.natureza
  `).all();
  for (const linha of itens) {
    adicionarRegistro(registros, "sqlite:itens_conhecidos_rateios", {
      numero_convenio: linha.numero_convenio,
      uf: linha.uf,
      descricaoOriginalReferencia: linha.descricao_original_referencia || linha.descricao_normalizada,
      area: linha.area,
      natureza: linha.natureza,
      quantidade_referencia: linha.quantidade_referencia,
      valor_previsto_referencia: linha.valor_previsto_referencia,
      valor_executado_referencia: linha.valor_executado_referencia,
      saldo: arredondarMoeda(linha.valor_previsto_referencia - linha.valor_executado_referencia),
    }, {
      itemConhecidoId: linha.item_conhecido_id,
      chaveItem: linha.chave_item,
      ano: linha.ano,
      percentualQuantidade: linha.percentual_quantidade,
      percentualValor: linha.percentual_valor,
    });
  }

  const divergencias = db.prepare(`
    SELECT id, numero_convenio, uf, chave_item, tipo_alerta, status, bloqueia_publicacao,
           payload_json
    FROM profor_2022_revisao_divergencias
    ORDER BY id
  `).all();
  for (const linha of divergencias) {
    const payload = parseJsonSeguro(linha.payload_json, {});
    for (const fonte of [payload.memoria, payload.antes, payload.pad, payload.depois, payload]) {
      adicionarRegistro(registros, "sqlite:revisao_divergencias", {
        numeroConvenio: linha.numero_convenio,
        uf: linha.uf,
        chaveItem: linha.chave_item,
        ...fonte,
      }, {
        divergenciaId: linha.id,
        tipoAlerta: linha.tipo_alerta,
        status: linha.status,
        bloqueiaPublicacao: linha.bloqueia_publicacao === 1,
      });
    }
  }
  return { registros, divergencias };
}

function carregarDecisoesAfetadas(divergencias) {
  const porId = new Map(divergencias.map((item) => [item.id, item]));
  const decisoes = db.prepare(`
    SELECT id, divergencia_id, decisao, usuario, decidido_em, payload_decisao_json
    FROM profor_2022_revisao_decisoes
    ORDER BY id
  `).all();
  const afetadas = [];
  for (const decisao of decisoes) {
    const divergencia = porId.get(decisao.divergencia_id);
    const payloadDivergencia = parseJsonSeguro(divergencia?.payload_json, {});
    const payloadDecisao = parseJsonSeguro(decisao.payload_decisao_json, {});
    const descricao = descricaoDoObjeto(payloadDivergencia) || descricaoDoObjeto(payloadDecisao) || divergencia?.chave_item;
    const rateios = Array.isArray(payloadDecisao.rateio) ? payloadDecisao.rateio
      : (Array.isArray(payloadDecisao.rateios) ? payloadDecisao.rateios : []);
    const residual = ehSaldoResidualProfor(descricao);
    const rateioOperacional = rateios.some((rateio) => areaSaldoResidualEhOperacional(rateio.area));
    const naturezas = new Set(rateios.map((rateio) => normalizarNaturezaSaldoResidual(rateio.natureza)).filter(Boolean));
    if (!residual && !rateioOperacional) continue;
    afetadas.push({
      decisaoId: decisao.id,
      divergenciaId: decisao.divergencia_id,
      decisao: decisao.decisao,
      usuario: decisao.usuario,
      decididoEm: decisao.decidido_em,
      descricao,
      rateioOperacional,
      misturaNatureza: naturezas.size > 1,
      aplicadaAoPlano: false,
      classificacao: rateioOperacional || naturezas.size > 1
        ? "saldo_residual_decisao_anterior_incompativel"
        : "saldo_residual_decisao_anterior_relacionada",
      recomendacao: rateioOperacional || naturezas.size > 1
        ? "Impedir efeito automatico no dry-run e revalidar por decisao retificadora se necessario."
        : "Manter rastreada para auditoria.",
    });
  }
  return afetadas;
}

/**
 * Conjunto de divergenciaId cuja comparacao de saldo residual/remanescente
 * fecha quando segregada por natureza. Lido do relatorio de item nao apto, que
 * separa a memoria consolidada e compara cada natureza com a linha PAD de mesma
 * natureza. Para esses itens, ter CAPITAL e CUSTEIO juntos NAO e divergencia:
 * e apenas memoria consolidada com correspondente PAD em cada natureza.
 */
function carregarSaldosResiduaisFechadosPorNatureza() {
  const relatorio = lerJsonSeExistir(
    "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json"
  );
  const fechados = new Set();
  if (!relatorio) return fechados;
  const listas = [
    relatorio.semDivergenciaMaterialDetectada,
    relatorio.candidatosAceiteAutomatico,
    relatorio.falsosPositivosSaneaveis,
    relatorio.divergenciasMateriais,
  ].filter(Array.isArray);
  for (const item of listas.flat()) {
    const comparacao = item?.comparacaoSaldoResidualPorNatureza;
    const id = Number(item?.id);
    if (Number.isInteger(id) && comparacao && comparacao.todasNaturezasFecham === true) {
      fechados.add(id);
    }
  }
  return fechados;
}

function detectarMisturas(registros, fechadosPorNatureza = new Set()) {
  const porDescricao = new Map();
  for (const item of registros) {
    const chave = `${normalizarTextoSaldoResidual(item.numeroConvenio).replace(/\D/g, "")}::${item.descricaoNormalizada}`;
    if (!porDescricao.has(chave)) porDescricao.set(chave, new Set());
    if (item.natureza) porDescricao.get(chave).add(item.natureza);
  }
  const chavesMistas = new Set(
    Array.from(porDescricao.entries())
      .filter(([, naturezas]) => naturezas.has("CAPITAL") && naturezas.has("CUSTEIO"))
      .map(([chave]) => chave)
  );
  return registros.map((item) => {
    const chave = `${normalizarTextoSaldoResidual(item.numeroConvenio).replace(/\D/g, "")}::${item.descricaoNormalizada}`;
    if (!chavesMistas.has(chave)) return item;
    // Mistura cuja comparacao fecha em cada natureza: a memoria estava apenas
    // consolidada, com correspondente PAD por natureza. Nao e divergencia real.
    const fechaPorNatureza = Number.isInteger(Number(item.divergenciaId))
      && fechadosPorNatureza.has(Number(item.divergenciaId));
    if (fechaPorNatureza && item.classificacao !== "saldo_residual_rateado_indevidamente") {
      return {
        ...item,
        misturaCapitalCusteio: true,
        chaveIgnorouNatureza: true,
        naturezasFechamComPad: true,
        classificacao: "saldo_residual_ok_nao_setorializado",
        recomendacao: "Memoria consolidada separavel por natureza; cada natureza fecha com linha PAD equivalente. "
          + "Tratar como falso positivo saneavel, comparando sempre segregado por natureza.",
      };
    }
    const classificacao = item.classificacao === "saldo_residual_rateado_indevidamente"
      ? item.classificacao
      : "saldo_residual_natureza_divergente";
    return {
      ...item,
      misturaCapitalCusteio: true,
      chaveIgnorouNatureza: true,
      classificacao,
      recomendacao: DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
    };
  });
}

function sintetizar(registros, decisoesAfetadas) {
  const porNatureza = {};
  for (const item of registros) {
    porNatureza[item.natureza || "SEM_NATUREZA"] = (porNatureza[item.natureza || "SEM_NATUREZA"] || 0) + 1;
  }
  return {
    totalSaldosResiduaisEncontrados: registros.length,
    totalPorNatureza: porNatureza,
    totalAreaTecnicaCorreta: registros.filter((item) => item.areaTecnicaNaoSetorializada).length,
    totalIndevidamenteRateadoPorSetor: registros.filter((item) => item.areaOperacionalIndevida).length,
    totalMisturaCapitalCusteio: registros.filter((item) => item.misturaCapitalCusteio).length,
    totalMisturaFechaPorNatureza: registros.filter((item) => item.naturezasFechamComPad).length,
    totalDecisaoAnteriorAfetada: decisoesAfetadas.length,
    totalCorrigidoAutomaticamente: registros.filter((item) => [
      "saldo_residual_ok_nao_setorializado",
      "saldo_residual_rateado_indevidamente",
    ].includes(item.classificacao)).length,
    totalPendenteDecisaoHumana: registros.filter((item) => [
      "saldo_residual_natureza_divergente",
      "saldo_residual_sem_natureza",
    ].includes(item.classificacao)).length,
    totalBloqueadoPorSeguranca: registros.filter((item) => item.classificacao === "saldo_residual_natureza_divergente").length,
  };
}

function renderMarkdown(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Auditoria de saldos residuais/remanescentes (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "Auditoria somente leitura: nao registra decisao, nao altera status, nao publica e nao altera o planoAplicacao oficial.",
    "",
    "## Resumo executivo",
    "",
    `- Saldos residuais/remanescentes encontrados: ${relatorio.resumo.totalSaldosResiduaisEncontrados}`,
    `- Area tecnica correta: ${relatorio.resumo.totalAreaTecnicaCorreta}`,
    `- Indevidamente rateados por setor: ${relatorio.resumo.totalIndevidamenteRateadoPorSetor}`,
    `- Mistura CAPITAL/CUSTEIO: ${relatorio.resumo.totalMisturaCapitalCusteio}`,
    `- Mistura que fecha segregada por natureza (falso positivo saneavel): ${relatorio.resumo.totalMisturaFechaPorNatureza}`,
    `- Decisoes anteriores afetadas: ${relatorio.resumo.totalDecisaoAnteriorAfetada}`,
    `- Pendentes de decisao humana: ${relatorio.resumo.totalPendenteDecisaoHumana}`,
    "",
    "Regra aplicada: Saldo residual/remanescente e item tecnico nao setorializado por area e segregado por natureza. CAPITAL e CUSTEIO nao sao equivalentes.",
    "",
    "## Itens detalhados",
    "",
    "| Origem | Divergencia | Convenio | UF | Descricao | Natureza | Area | Valor previsto | Classificacao | Recomendacao |",
    "|---|---:|---|---|---|---|---|---:|---|---|",
  ];
  for (const item of relatorio.itens.slice(0, 200)) {
    linhas.push(`| ${item.origem} | ${item.divergenciaId || "-"} | ${item.numeroConvenio || "-"} | ${item.uf || "-"} | ${String(item.descricaoOriginal || "-").replace(/\|/g, "/")} | ${item.natureza || "-"} | ${item.areaOriginal || "-"} | ${item.valorPrevisto || 0} | \`${item.classificacao}\` | ${String(item.recomendacao || "-").replace(/\|/g, "/")} |`);
  }
  linhas.push("");
  linhas.push("## Decisoes anteriores afetadas");
  linhas.push("");
  if (!relatorio.decisoesAfetadas.length) {
    linhas.push("- Nenhuma decisao anterior relacionada a saldo residual/remanescente foi encontrada.");
  } else {
    for (const decisao of relatorio.decisoesAfetadas) {
      linhas.push(`- Decisao #${decisao.decisaoId} / divergencia #${decisao.divergenciaId}: ${decisao.classificacao}. ${decisao.recomendacao}`);
    }
  }
  linhas.push("");
  linhas.push("Rollback: reverter o commit e regenerar os relatorios dry-run; nao apagar decisoes/logs historicos.");
  return `${linhas.join("\n")}\n`;
}

function executar() {
  const registros = [];
  const fontes = [];
  const banco = carregarRegistrosBanco();
  registros.push(...banco.registros);
  const decisoesAfetadas = carregarDecisoesAfetadas(banco.divergencias);

  for (const fonte of FONTES_RELATORIOS) {
    const dados = lerJsonSeExistir(fonte);
    fontes.push({ caminho: fonte, disponivel: Boolean(dados) });
    if (dados) varrerJson(registros, fonte, dados);
  }

  const fechadosPorNatureza = carregarSaldosResiduaisFechadosPorNatureza();
  const itens = detectarMisturas(registros, fechadosPorNatureza)
    .sort((a, b) => String(a.numeroConvenio || "").localeCompare(String(b.numeroConvenio || ""), "pt-BR")
      || String(a.descricaoOriginal || "").localeCompare(String(b.descricaoOriginal || ""), "pt-BR")
      || String(a.origem || "").localeCompare(String(b.origem || ""), "pt-BR"));

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    regra: {
      diagnostico: DIAGNOSTICO_SALDO_RESIDUAL_NATUREZA,
      chaveEquivalenciaMinima: "numeroConvenio + descricaoNormalizada + natureza",
      areaOperacionalPermitida: false,
      misturaCapitalCusteioPermitida: false,
    },
    fontes,
    resumo: sintetizar(itens, decisoesAfetadas),
    itens,
    decisoesAfetadas,
    recomendacoes: [
      "Manter #44 como pendencia operacional real/bloqueio tecnico por natureza divergente.",
      "Neutralizar no dry-run qualquer decisao/rateio que distribua saldo residual entre areas operacionais.",
      "Comparar e reconstruir saldos residuais sempre segregando por natureza.",
    ],
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
    },
  };

  escreverJson(SAIDA_JSON, relatorio);
  escreverTexto(SAIDA_MD, renderMarkdown(relatorio));

  console.log("Auditoria de saldos residuais/remanescentes concluida (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Total encontrado: ${relatorio.resumo.totalSaldosResiduaisEncontrados}`);
  console.log(`Mistura CAPITAL/CUSTEIO: ${relatorio.resumo.totalMisturaCapitalCusteio}`);
  console.log(`Rateio por setor: ${relatorio.resumo.totalIndevidamenteRateadoPorSetor}`);
  console.log(`Decisoes anteriores afetadas: ${relatorio.resumo.totalDecisaoAnteriorAfetada}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha na auditoria de saldos residuais/remanescentes.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

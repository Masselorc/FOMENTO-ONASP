const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../db/database");
const { coletarDivergencias } = require("./profor-pad-revisao-service");
const {
  carregarAplicacaoDecisoesDryRun,
} = require("./profor-pad-decisao-aplicacao-service");

/**
 * Etapa 8.2 — Segurança pré-ativação PAD/PROFOR 2022.
 *
 * Auditoria dry-run que impede dois riscos antes de qualquer ativação/publicação:
 *  1. decisão antiga validando payload de divergência que mudou;
 *  2. divergência antiga que não aparece mais na geração atual da fila.
 *
 * Modo somente leitura: não escreve em tabelas, não altera a origem ativa,
 * não publica e não aplica decisões ao planoAplicacao oficial.
 */

const CAMINHO_RELATORIO_SEGURANCA =
  "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json";
const CAMINHO_RELATORIO_SEGURANCA_MD =
  "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.md";

const DECISOES_RESOLUTIVAS = ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"];

function agoraIso() {
  return new Date().toISOString();
}

function parseJsonSeguro(texto, padrao) {
  if (texto === null || texto === undefined || texto === "") return padrao;
  if (typeof texto === "object") return texto;
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

/**
 * Serialização estável e independente da ordem das chaves: ordena
 * recursivamente as chaves de objetos. Arrays preservam a ordem.
 */
function stringifyOrdenado(valor) {
  if (valor === undefined) return "null";
  if (valor === null || typeof valor !== "object") {
    const texto = JSON.stringify(valor);
    return texto === undefined ? "null" : texto;
  }
  if (Array.isArray(valor)) {
    return `[${valor.map(stringifyOrdenado).join(",")}]`;
  }
  const chaves = Object.keys(valor).filter((chave) => valor[chave] !== undefined).sort();
  return `{${chaves.map((chave) => `${JSON.stringify(chave)}:${stringifyOrdenado(valor[chave])}`).join(",")}}`;
}

/** Normaliza a divergência (linha do banco ou objeto formatado) para o hash. */
function normalizarParaHash(divergencia) {
  const d = divergencia || {};
  let payload = {};
  if (typeof d.payload_json === "string") payload = parseJsonSeguro(d.payload_json, {});
  else if (typeof d.payloadJson === "string") payload = parseJsonSeguro(d.payloadJson, {});
  else if (d.payload && typeof d.payload === "object") payload = d.payload;
  return {
    chaveDivergencia: d.chave_divergencia ?? d.chaveDivergencia ?? null,
    tipoAlerta: d.tipo_alerta ?? d.tipoAlerta ?? null,
    campoAfetado: d.campo_afetado ?? d.campoAfetado ?? null,
    numeroConvenio: d.numero_convenio ?? d.numeroConvenio ?? null,
    uf: d.uf ?? null,
    chaveItem: d.chave_item ?? d.chaveItem ?? null,
    payload,
  };
}

/**
 * Gera o hash SHA-256 estável do payload técnico de uma divergência.
 * Considera chave_divergencia, tipo_alerta, campo_afetado, numero_convenio,
 * uf, chave_item e payload_json. Independente da ordem das chaves.
 */
function gerarHashPayloadDivergencia(divergencia) {
  const base = normalizarParaHash(divergencia);
  return crypto.createHash("sha256").update(stringifyOrdenado(base)).digest("hex");
}

/* ----------------------------- classificadores puros ----------------------------- */

/**
 * Classifica o estado de uma decisão resolutiva quanto ao payload da
 * divergência. Função pura.
 */
function classificarPayloadDecisao({ temDivergencia, temSnapshot, hashSnapshot, hashAtual, liberaAtivacao }) {
  if (!temDivergencia) {
    return { classificacao: "divergencia_nao_encontrada_para_decisao", bloqueia: true };
  }
  if (!temSnapshot) {
    return { classificacao: "decisao_sem_snapshot_payload", bloqueia: Boolean(liberaAtivacao) };
  }
  if (hashSnapshot === hashAtual) {
    return { classificacao: "payload_preservado", bloqueia: false };
  }
  return { classificacao: "payload_alterado_apos_decisao", bloqueia: true };
}

/**
 * Classifica uma divergência existente quanto à sua reapresentação na geração
 * atual da fila. Função pura.
 */
function classificarDivergenciaReapresentacao({ reapresentada, status, bloqueiaPublicacao, temDecisaoResolutiva }) {
  if (reapresentada) {
    return { classificacao: "reapresentada", bloqueia: false };
  }
  if (temDecisaoResolutiva) {
    return { classificacao: "nao_reapresentada_com_decisao_resolutiva", bloqueia: true };
  }
  if (bloqueiaPublicacao) {
    return { classificacao: "nao_reapresentada_bloqueante", bloqueia: true };
  }
  if (String(status || "").toUpperCase() === "EM_REVISAO") {
    return { classificacao: "nao_reapresentada_em_revisao", bloqueia: false };
  }
  return { classificacao: "nao_reapresentada_sem_decisao", bloqueia: false };
}

/* ----------------------------- auditoria de payload ----------------------------- */

function auditarPayloadDecisoes() {
  const placeholders = DECISOES_RESOLUTIVAS.map(() => "?").join(", ");
  const linhas = db.prepare(`
    SELECT
      dec.id AS decisao_id, dec.divergencia_id, dec.decisao, dec.usuario,
      dec.decidido_em, dec.payload_decisao_json,
      d.id AS divergencia_db_id, d.chave_divergencia, d.tipo_alerta, d.campo_afetado,
      d.numero_convenio, d.uf, d.chave_item, d.payload_json, d.status, d.bloqueia_publicacao
    FROM profor_2022_revisao_decisoes dec
    LEFT JOIN profor_2022_revisao_divergencias d ON d.id = dec.divergencia_id
    WHERE dec.decisao IN (${placeholders})
      AND (d.chave_divergencia IS NULL OR d.chave_divergencia NOT LIKE 'revisao_teste:%')
    ORDER BY dec.id
  `).all(...DECISOES_RESOLUTIVAS);

  // Decisões que liberam ativação: última decisão resolutiva da divergência cujo
  // efeito altera a reconstrução ou cuja divergência bloqueia publicação.
  const aplicacao = carregarAplicacaoDecisoesDryRun();
  const liberadorasPorDecisaoId = new Map();
  for (const registro of aplicacao.decisoesAplicadasDryRun) {
    const liberaAtivacao = Boolean(
      registro.bloqueiaPublicacao
      || (registro.efeito && registro.efeito.afetaReconstrucao === true)
    );
    liberadorasPorDecisaoId.set(registro.decisaoId, liberaAtivacao);
  }

  const auditadas = [];
  for (const linha of linhas) {
    const temDivergencia = linha.divergencia_db_id !== null && linha.divergencia_db_id !== undefined;
    const payloadDecisao = parseJsonSeguro(linha.payload_decisao_json, {});
    const snapshot = payloadDecisao && typeof payloadDecisao === "object"
      ? payloadDecisao._segurancaPreAtivacao
      : null;
    const temSnapshot = Boolean(
      snapshot && typeof snapshot.payloadHashNoMomentoDaDecisao === "string"
    );
    const hashSnapshot = temSnapshot ? snapshot.payloadHashNoMomentoDaDecisao : null;
    const hashAtual = temDivergencia ? gerarHashPayloadDivergencia(linha) : null;
    const liberaAtivacao = liberadorasPorDecisaoId.get(linha.decisao_id) === true;

    const classificacao = classificarPayloadDecisao({
      temDivergencia,
      temSnapshot,
      hashSnapshot,
      hashAtual,
      liberaAtivacao,
    });

    auditadas.push({
      decisaoId: linha.decisao_id,
      divergenciaId: linha.divergencia_id,
      chaveDivergencia: linha.chave_divergencia || null,
      tipoAlerta: linha.tipo_alerta || null,
      campoAfetado: linha.campo_afetado || null,
      decisao: linha.decisao,
      usuario: linha.usuario || null,
      decididoEm: linha.decidido_em || null,
      bloqueiaPublicacao: linha.bloqueia_publicacao === 1,
      liberaAtivacao,
      temSnapshot,
      payloadHashNoMomentoDaDecisao: hashSnapshot,
      payloadHashAtual: hashAtual,
      classificacao: classificacao.classificacao,
      bloqueia: classificacao.bloqueia,
    });
  }
  return auditadas;
}

/* ------------------------- auditoria de divergências não reapresentadas ------------------------- */

function auditarDivergenciasNaoReapresentadas(repoRoot) {
  let chavesGeradasHoje = null;
  let erroGeracao = null;
  try {
    const { divergencias } = coletarDivergencias(repoRoot);
    chavesGeradasHoje = new Set(divergencias.map((item) => item.chaveDivergencia));
  } catch (erro) {
    erroGeracao = erro?.message || String(erro);
  }

  const existentes = db.prepare(`
    SELECT id, chave_divergencia, tipo_alerta, numero_convenio, uf, status, bloqueia_publicacao
    FROM profor_2022_revisao_divergencias
    WHERE chave_divergencia NOT LIKE 'revisao_teste:%'
    ORDER BY id
  `).all();

  const placeholders = DECISOES_RESOLUTIVAS.map(() => "?").join(", ");
  const comDecisaoResolutiva = new Set(
    db.prepare(`
      SELECT DISTINCT divergencia_id FROM profor_2022_revisao_decisoes
      WHERE decisao IN (${placeholders})
    `).all(...DECISOES_RESOLUTIVAS).map((linha) => linha.divergencia_id)
  );

  const auditadas = existentes.map((divergencia) => {
    const reapresentada = chavesGeradasHoje
      ? chavesGeradasHoje.has(divergencia.chave_divergencia)
      : false;
    const classificacao = classificarDivergenciaReapresentacao({
      reapresentada,
      status: divergencia.status,
      bloqueiaPublicacao: divergencia.bloqueia_publicacao === 1,
      temDecisaoResolutiva: comDecisaoResolutiva.has(divergencia.id),
    });
    return {
      divergenciaId: divergencia.id,
      chaveDivergencia: divergencia.chave_divergencia,
      tipoAlerta: divergencia.tipo_alerta,
      numeroConvenio: divergencia.numero_convenio,
      uf: divergencia.uf,
      status: divergencia.status,
      bloqueiaPublicacao: divergencia.bloqueia_publicacao === 1,
      temDecisaoResolutiva: comDecisaoResolutiva.has(divergencia.id),
      reapresentada,
      classificacao: classificacao.classificacao,
      bloqueia: classificacao.bloqueia,
    };
  });

  return { auditadas, erroGeracao, geracaoDisponivel: chavesGeradasHoje !== null };
}

/* --------------------------------- consolidação --------------------------------- */

/**
 * Executa a auditoria de segurança pré-ativação em dry-run.
 * Não escreve em tabelas.
 */
function auditarSegurancaPreAtivacaoDryRun(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");

  const decisoesAuditadas = auditarPayloadDecisoes();
  const divergencias = auditarDivergenciasNaoReapresentadas(repoRoot);

  const payloadAlteradoAposDecisao = decisoesAuditadas.filter(
    (item) => item.classificacao === "payload_alterado_apos_decisao"
  );
  const decisoesSemSnapshotPayload = decisoesAuditadas.filter(
    (item) => item.classificacao === "decisao_sem_snapshot_payload"
  );
  const decisoesComDivergenciaNaoEncontrada = decisoesAuditadas.filter(
    (item) => item.classificacao === "divergencia_nao_encontrada_para_decisao"
  );
  const totalPayloadPreservado = decisoesAuditadas.filter(
    (item) => item.classificacao === "payload_preservado"
  ).length;

  const divergenciasNaoReapresentadas = divergencias.auditadas.filter(
    (item) => !item.reapresentada
  );
  const totalReapresentadas = divergencias.auditadas.length - divergenciasNaoReapresentadas.length;

  const bloqueiosAtivacao = [];
  for (const decisao of decisoesAuditadas) {
    if (!decisao.bloqueia) continue;
    bloqueiosAtivacao.push({
      origem: "payload_decisao",
      classificacao: decisao.classificacao,
      decisaoId: decisao.decisaoId,
      divergenciaId: decisao.divergenciaId,
      chaveDivergencia: decisao.chaveDivergencia,
      decisao: decisao.decisao,
      motivo: motivoBloqueioDecisao(decisao.classificacao),
    });
  }
  for (const divergencia of divergenciasNaoReapresentadas) {
    if (!divergencia.bloqueia) continue;
    bloqueiosAtivacao.push({
      origem: "divergencia_nao_reapresentada",
      classificacao: divergencia.classificacao,
      divergenciaId: divergencia.divergenciaId,
      chaveDivergencia: divergencia.chaveDivergencia,
      motivo: motivoBloqueioDivergencia(divergencia.classificacao),
    });
  }

  const avisos = [];
  for (const decisao of decisoesSemSnapshotPayload) {
    if (decisao.bloqueia) continue;
    avisos.push({
      origem: "payload_decisao",
      classificacao: "decisao_sem_snapshot_payload",
      decisaoId: decisao.decisaoId,
      divergenciaId: decisao.divergenciaId,
      detalhe: "Decisão resolutiva sem snapshot de payload; não foi usada para liberar ativação.",
    });
  }
  for (const divergencia of divergenciasNaoReapresentadas) {
    if (divergencia.bloqueia) continue;
    avisos.push({
      origem: "divergencia_nao_reapresentada",
      classificacao: divergencia.classificacao,
      divergenciaId: divergencia.divergenciaId,
      chaveDivergencia: divergencia.chaveDivergencia,
      detalhe: "Divergência não reapresentada na geração atual; não bloqueia, mas exige conferência.",
    });
  }
  if (!divergencias.geracaoDisponivel) {
    avisos.push({
      origem: "geracao_fila",
      classificacao: "geracao_atual_indisponivel",
      detalhe: `Não foi possível recriar a geração atual da fila: ${divergencias.erroGeracao}.`,
    });
  }

  const resumo = {
    totalDecisoesResolutivasAuditadas: decisoesAuditadas.length,
    totalPayloadPreservado,
    totalPayloadAlteradoAposDecisao: payloadAlteradoAposDecisao.length,
    totalDecisoesSemSnapshotPayload: decisoesSemSnapshotPayload.length,
    totalDecisoesComDivergenciaNaoEncontrada: decisoesComDivergenciaNaoEncontrada.length,
    totalDivergenciasExistentes: divergencias.auditadas.length,
    totalDivergenciasReapresentadas: totalReapresentadas,
    totalDivergenciasNaoReapresentadas: divergenciasNaoReapresentadas.length,
    totalBloqueiosAtivacao: bloqueiosAtivacao.length,
    totalAvisos: avisos.length,
    geracaoAtualDisponivel: divergencias.geracaoDisponivel,
    aptoParaProsseguirAtivacao: bloqueiosAtivacao.length === 0,
  };

  return {
    geradoEm: agoraIso(),
    modo: "dry-run",
    payloadAlteradoAposDecisao,
    decisoesSemSnapshotPayload,
    decisoesComDivergenciaNaoEncontrada,
    divergenciasNaoReapresentadas,
    bloqueiosAtivacao,
    avisos,
    resumo,
  };
}

function motivoBloqueioDecisao(classificacao) {
  if (classificacao === "payload_alterado_apos_decisao") {
    return "Payload da divergência mudou após a decisão; a decisão precisa ser revalidada.";
  }
  if (classificacao === "divergencia_nao_encontrada_para_decisao") {
    return "Decisão resolutiva referencia divergência inexistente.";
  }
  if (classificacao === "decisao_sem_snapshot_payload") {
    return "Decisão sem snapshot de payload usada para liberar ativação; revalidar manualmente.";
  }
  return "Bloqueio de segurança pré-ativação.";
}

function motivoBloqueioDivergencia(classificacao) {
  if (classificacao === "nao_reapresentada_com_decisao_resolutiva") {
    return "Divergência com decisão resolutiva não aparece na geração atual da fila.";
  }
  if (classificacao === "nao_reapresentada_bloqueante") {
    return "Divergência bloqueante não aparece na geração atual da fila.";
  }
  return "Bloqueio de segurança pré-ativação.";
}

/** Resumo enxuto para embutir em outros relatórios dry-run. */
function resumoSegurancaParaRelatorio(resultado) {
  return {
    geradoEm: resultado.geradoEm,
    resumo: resultado.resumo,
    bloqueiosAtivacao: resultado.bloqueiosAtivacao,
  };
}

function formatarLinhasMd(titulo, itens, formatar) {
  const linhas = [`## ${titulo}`, ""];
  if (!itens.length) {
    linhas.push("- (nenhum)");
  } else {
    for (const item of itens) linhas.push(`- ${formatar(item)}`);
  }
  linhas.push("");
  return linhas;
}

/** Monta um relatório Markdown resumido da auditoria de segurança pré-ativação. */
function montarMarkdownSeguranca(resultado) {
  const { resumo } = resultado;
  const linhas = [];
  linhas.push("# PROFOR 2022 — Segurança pré-ativação PAD (dry-run)");
  linhas.push("");
  linhas.push(`Gerado em: ${resultado.geradoEm}`);
  linhas.push(`Modo: ${resultado.modo}`);
  linhas.push("");
  linhas.push("## Resumo");
  linhas.push("");
  linhas.push(`- Decisões resolutivas auditadas: ${resumo.totalDecisoesResolutivasAuditadas}`);
  linhas.push(`- Payload preservado: ${resumo.totalPayloadPreservado}`);
  linhas.push(`- Payload alterado após a decisão: ${resumo.totalPayloadAlteradoAposDecisao}`);
  linhas.push(`- Decisões sem snapshot de payload: ${resumo.totalDecisoesSemSnapshotPayload}`);
  linhas.push(`- Decisões com divergência não encontrada: ${resumo.totalDecisoesComDivergenciaNaoEncontrada}`);
  linhas.push(`- Divergências existentes: ${resumo.totalDivergenciasExistentes}`);
  linhas.push(`- Divergências reapresentadas: ${resumo.totalDivergenciasReapresentadas}`);
  linhas.push(`- Divergências não reapresentadas: ${resumo.totalDivergenciasNaoReapresentadas}`);
  linhas.push(`- Bloqueios de ativação: ${resumo.totalBloqueiosAtivacao}`);
  linhas.push(`- Avisos: ${resumo.totalAvisos}`);
  linhas.push(`- Geração atual da fila disponível: ${resumo.geracaoAtualDisponivel ? "sim" : "não"}`);
  linhas.push(`- Apto para prosseguir ativação: ${resumo.aptoParaProsseguirAtivacao ? "sim" : "não"}`);
  linhas.push("");
  linhas.push(...formatarLinhasMd(
    "Bloqueios de ativação",
    resultado.bloqueiosAtivacao,
    (item) => `[${item.classificacao}] ${item.origem} | divergência ${item.divergenciaId || "-"} `
      + `(${item.chaveDivergencia || "-"}) | ${item.motivo}`
  ));
  linhas.push(...formatarLinhasMd(
    "Payload alterado após a decisão",
    resultado.payloadAlteradoAposDecisao,
    (item) => `decisão ${item.decisaoId} | divergência ${item.divergenciaId} | ${item.decisao}`
  ));
  linhas.push(...formatarLinhasMd(
    "Divergências não reapresentadas",
    resultado.divergenciasNaoReapresentadas,
    (item) => `[${item.classificacao}] divergência ${item.divergenciaId} (${item.chaveDivergencia})`
  ));
  linhas.push("Etapa dry-run: não altera origem ativa, não publica e não aplica decisões ao planoAplicacao.");
  return `${linhas.join("\n")}\n`;
}

/** Persiste o relatório dry-run de segurança pré-ativação (JSON e Markdown). */
function salvarRelatorioSeguranca(resultado, caminhoJson, caminhoMarkdown) {
  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
  if (caminhoMarkdown) {
    fs.writeFileSync(caminhoMarkdown, montarMarkdownSeguranca(resultado), "utf8");
  }
}

module.exports = {
  CAMINHO_RELATORIO_SEGURANCA,
  CAMINHO_RELATORIO_SEGURANCA_MD,
  stringifyOrdenado,
  gerarHashPayloadDivergencia,
  classificarPayloadDecisao,
  classificarDivergenciaReapresentacao,
  auditarSegurancaPreAtivacaoDryRun,
  resumoSegurancaParaRelatorio,
  montarMarkdownSeguranca,
  salvarRelatorioSeguranca,
};

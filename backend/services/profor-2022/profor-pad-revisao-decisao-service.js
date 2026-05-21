const repo = require("./profor-pad-revisao-repository");
const {
  gerarHashPayloadDivergencia,
} = require("./profor-pad-seguranca-pre-ativacao-service");

// Decisões que o usuário pode registrar pela revisão assistida.
// COMENTAR mantém o status PENDENTE (apenas registra comentário/log).
const DECISOES_VALIDAS = ["ACEITO", "REJEITADO", "EM_REVISAO", "CORRIGIDO", "REVERTIDO", "COMENTAR"];

// Decisão -> status resultante da divergência.
const STATUS_POR_DECISAO = {
  ACEITO: "ACEITO",
  REJEITADO: "REJEITADO",
  EM_REVISAO: "EM_REVISAO",
  CORRIGIDO: "CORRIGIDO",
  REVERTIDO: "REVERTIDO",
  COMENTAR: "PENDENTE",
};

// Decisões que exigem justificativa obrigatória.
const DECISOES_JUSTIFICATIVA_OBRIGATORIA = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);

/** Erro de validação de entrada da API (HTTP 400). */
class RevisaoDecisaoError extends Error {
  constructor(message) {
    super(message);
    this.name = "RevisaoDecisaoError";
    this.statusCode = 400;
  }
}

function parseJsonSeguro(texto, padrao) {
  if (texto === null || texto === undefined || texto === "") return padrao;
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
}

/** Converte a linha bruta da divergência num objeto de API, com payload parseado. */
function formatarDivergencia(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    loteRevisaoId: linha.lote_revisao_id,
    chaveDivergencia: linha.chave_divergencia,
    numeroConvenio: linha.numero_convenio,
    uf: linha.uf,
    chaveItem: linha.chave_item,
    tipoAlerta: linha.tipo_alerta,
    nivel: linha.nivel,
    status: linha.status,
    campoAfetado: linha.campo_afetado,
    valorAnterior: linha.valor_anterior,
    valorNovo: linha.valor_novo,
    fonteAnterior: linha.fonte_anterior,
    fonteNova: linha.fonte_nova,
    diferenca: linha.diferenca,
    motivoProvavel: linha.motivo_provavel,
    acaoSugerida: linha.acao_sugerida,
    impactoReconstrucao: linha.impacto_reconstrucao,
    bloqueiaPublicacao: linha.bloqueia_publicacao === 1,
    payload: parseJsonSeguro(linha.payload_json, {}),
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function formatarDecisao(linha) {
  return {
    id: linha.id,
    divergenciaId: linha.divergencia_id,
    decisao: linha.decisao,
    valorAplicado: linha.valor_aplicado,
    justificativa: linha.justificativa,
    usuario: linha.usuario,
    decididoEm: linha.decidido_em,
    loteSaneamentoId: linha.lote_saneamento_id,
    payloadDecisao: parseJsonSeguro(linha.payload_decisao_json, {}),
    criadoEm: linha.criado_em,
  };
}

function formatarLog(linha) {
  return {
    id: linha.id,
    entidadeTipo: linha.entidade_tipo,
    entidadeId: linha.entidade_id,
    evento: linha.evento,
    estadoAnterior: parseJsonSeguro(linha.estado_anterior_json, null),
    estadoNovo: parseJsonSeguro(linha.estado_novo_json, null),
    usuario: linha.usuario,
    detalhe: linha.detalhe,
    criadoEm: linha.criado_em,
  };
}

/* ------------------------------- consultas ------------------------------- */

function listarDivergencias(filtros = {}) {
  const revisaoService = require("./profor-pad-revisao-service");
  const resultado = repo.listarDivergencias(filtros);
  
  let chavesGeradas = null;
  try {
    const path = require("node:path");
    const repoRoot = path.resolve(__dirname, "../../..");
    const { divergencias } = revisaoService.coletarDivergencias(repoRoot);
    chavesGeradas = new Set(divergencias.map(d => d.chaveDivergencia));
  } catch (err) {
    // ignore
  }

  return {
    total: resultado.total,
    limite: resultado.limite,
    offset: resultado.offset,
    divergencias: resultado.divergencias.map(linha => {
      const d = formatarDivergencia(linha);
      if (chavesGeradas) {
        d.reapresentada = chavesGeradas.has(d.chaveDivergencia);
      } else {
        d.reapresentada = true;
      }
      return d;
    }),
  };
}

/** Retorna a divergência com payload parseado, decisões e logs. */
function obterDivergencia(id) {
  const revisaoService = require("./profor-pad-revisao-service");
  const linha = repo.buscarDivergenciaPorId(id);
  if (!linha) {
    throw Object.assign(new Error("Divergência não encontrada."), { statusCode: 404 });
  }
  const divergencia = formatarDivergencia(linha);

  try {
    const path = require("node:path");
    const repoRoot = path.resolve(__dirname, "../../..");
    const { divergencias } = revisaoService.coletarDivergencias(repoRoot);
    divergencia.reapresentada = divergencias.some(d => d.chaveDivergencia === divergencia.chaveDivergencia);
  } catch (err) {
    divergencia.reapresentada = true;
  }

  return {
    ...divergencia,
    decisoes: repo.listarDecisoesDaDivergencia(divergencia.id).map(formatarDecisao),
    logs: repo.listarLogsDaDivergencia(divergencia.id).map(formatarLog),
  };
}

function listarLogsDaDivergencia(id) {
  const linha = repo.buscarDivergenciaPorId(id);
  if (!linha) {
    throw Object.assign(new Error("Divergência não encontrada."), { statusCode: 404 });
  }
  return repo.listarLogsDaDivergencia(Number(id)).map(formatarLog);
}

/** Auditoria de pendências, com destaque para impeditivas. */
function auditarPendencias() {
  const estatisticas = repo.obterEstatisticasAuditoria();
  return {
    totalDivergencias: estatisticas.totalDivergencias,
    totalPendentes: estatisticas.totalPendentes,
    totalEmRevisao: estatisticas.totalEmRevisao,
    totalImpeditivas: estatisticas.totalImpeditivas,
    totalBloqueiamPublicacao: estatisticas.totalBloqueiamPublicacao,
    totalPendentesQueBloqueiamPublicacao: estatisticas.totalPendentesQueBloqueiamPublicacao,
    totalEmRevisaoQueBloqueiamPublicacao: estatisticas.totalEmRevisaoQueBloqueiamPublicacao,
    totalComDecisaoResolutiva: estatisticas.totalComDecisaoResolutiva,
    totalComComentario: estatisticas.totalComComentario,
    totalSemDecisaoResolutiva: estatisticas.totalSemDecisaoResolutiva,
    publicacaoLiberada: estatisticas.publicacaoLiberada,
    // Aliases legados mantidos para consumidores locais existentes.
    total: estatisticas.totalDivergencias,
    pendentes: estatisticas.totalPendentes,
    impeditivas: estatisticas.totalImpeditivas,
    bloqueiamPublicacao: estatisticas.totalBloqueiamPublicacao,
    semDecisao: estatisticas.totalSemDecisaoResolutiva,
    porStatus: estatisticas.porStatus,
    porNivel: estatisticas.porNivel,
    porTipo: estatisticas.porTipo,
    porConvenio: estatisticas.porConvenio,
  };
}

/* ------------------------------- decisão ------------------------------- */

/**
 * Registra uma decisão humana sobre uma divergência.
 * Valida existência, decisão permitida e justificativa obrigatória.
 * NÃO aplica a decisão ao planoAplicacao — ACEITO significa apenas
 * "decisão humana registrada".
 */
function registrarDecisao(divergenciaId, entrada = {}) {
  const id = Number(divergenciaId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RevisaoDecisaoError("Identificador de divergência inválido.");
  }

  const linha = repo.buscarDivergenciaPorId(id);
  if (!linha) {
    throw Object.assign(new Error("Divergência não encontrada."), { statusCode: 404 });
  }

  const decisao = String(entrada.decisao || "").trim().toUpperCase();
  if (!DECISOES_VALIDAS.includes(decisao)) {
    throw new RevisaoDecisaoError(
      `Decisão inválida. Valores permitidos: ${DECISOES_VALIDAS.join(", ")}.`
    );
  }

  const justificativa = typeof entrada.justificativa === "string" ? entrada.justificativa.trim() : "";
  if (DECISOES_JUSTIFICATIVA_OBRIGATORIA.has(decisao) && !justificativa) {
    throw new RevisaoDecisaoError(
      `A decisão '${decisao}' exige justificativa.`
    );
  }

  const usuario = typeof entrada.usuario === "string" ? entrada.usuario.trim() : "";
  if (!usuario) {
    throw new RevisaoDecisaoError("Informe o usuário responsável pela decisão.");
  }

  const novoStatus = STATUS_POR_DECISAO[decisao];

  // Snapshot de segurança pré-ativação: registra o hash do payload da
  // divergência no momento da decisão, preservando o payload do usuário.
  const payloadDecisaoUsuario = entrada.payloadDecisao && typeof entrada.payloadDecisao === "object"
    ? entrada.payloadDecisao
    : {};
  const payloadDecisao = {
    ...payloadDecisaoUsuario,
    _segurancaPreAtivacao: {
      versao: 1,
      divergenciaId: id,
      chaveDivergencia: linha.chave_divergencia,
      tipoAlerta: linha.tipo_alerta,
      campoAfetado: linha.campo_afetado,
      payloadHashNoMomentoDaDecisao: gerarHashPayloadDivergencia(linha),
      registradoEm: new Date().toISOString(),
    },
  };

  const resultado = repo.registrarDecisao({
    divergencia: linha,
    decisao,
    novoStatus,
    valorAplicado: entrada.valorAplicado,
    justificativa: justificativa || null,
    usuario,
    payloadDecisao,
  });

  return {
    divergenciaId: id,
    decisao,
    decisaoId: resultado.decisaoId,
    statusAnterior: resultado.statusAnterior,
    statusNovo: resultado.statusNovo,
    decididoEm: resultado.decididoEm,
    aplicadaAoPlano: false,
  };
}

module.exports = {
  DECISOES_VALIDAS,
  DECISOES_JUSTIFICATIVA_OBRIGATORIA,
  RevisaoDecisaoError,
  formatarDivergencia,
  listarDivergencias,
  obterDivergencia,
  listarLogsDaDivergencia,
  auditarPendencias,
  registrarDecisao,
};

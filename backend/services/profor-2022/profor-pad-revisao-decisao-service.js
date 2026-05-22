const fs = require("node:fs");
const path = require("node:path");

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
const CAMINHO_PENDENCIAS_PROFUNDO = "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json";
const CAMINHO_ITEM_NAO_APTO = "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json";
const CAMINHO_SALDOS_RESIDUAIS = "backend/data/relatorios/profor-2022-saldos-residuais-auditoria-dry-run.json";
const CATEGORIA_OPERACIONAL_EFETIVA = "pendencia_operacional_real";

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

function repoRootPadrao() {
  return path.resolve(__dirname, "../../..");
}

function lerJsonRelatorio(caminhoRelativo, padrao) {
  const caminho = path.join(repoRootPadrao(), caminhoRelativo);
  if (!fs.existsSync(caminho)) return padrao;
  return parseJsonSeguro(fs.readFileSync(caminho, "utf8"), padrao);
}

function indexarPorId(lista = []) {
  const mapa = new Map();
  for (const item of Array.isArray(lista) ? lista : []) {
    const id = Number(item?.id ?? item?.divergenciaId);
    if (Number.isInteger(id) && id > 0) mapa.set(id, item);
  }
  return mapa;
}

function carregarIndicePendenciasProfundo() {
  const relatorio = lerJsonRelatorio(CAMINHO_PENDENCIAS_PROFUNDO, { itens: [] });
  return indexarPorId(relatorio.itens || []);
}

function carregarIndiceItemNaoApto() {
  const relatorio = lerJsonRelatorio(CAMINHO_ITEM_NAO_APTO, {});
  const listas = [
    relatorio.semDivergenciaMaterialDetectada,
    relatorio.candidatosAceiteAutomatico,
    relatorio.falsosPositivosSaneaveis,
    relatorio.divergenciasMateriais,
    relatorio.dadosMemoriaInsuficientes,
    relatorio.jaDecididos,
    relatorio.errosPayload,
  ].filter(Array.isArray);
  return indexarPorId(listas.flat());
}

function carregarIndiceSaldosResiduais() {
  const relatorio = lerJsonRelatorio(CAMINHO_SALDOS_RESIDUAIS, { itens: [] });
  const mapa = new Map();
  for (const item of Array.isArray(relatorio.itens) ? relatorio.itens : []) {
    const id = Number(item?.divergenciaId);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(item);
  }
  return mapa;
}

function carregarIndicesAuditoriaOperacional() {
  return {
    pendenciasProfundo: carregarIndicePendenciasProfundo(),
    itemNaoApto: carregarIndiceItemNaoApto(),
    saldosResiduais: carregarIndiceSaldosResiduais(),
  };
}

function montarMemoriaConsolidadaItemNaoApto(itemNaoApto) {
  if (!itemNaoApto) return null;
  const padConsolidado = itemNaoApto.padConsolidado || null;
  return {
    descricao: itemNaoApto.descricao,
    natureza: itemNaoApto.naturezaMemoria,
    quantidade: padConsolidado?.quantidade ?? itemNaoApto.quantidadeMemoria,
    valorUnitario: itemNaoApto.valorUnitarioMemoria,
    valorPrevisto: itemNaoApto.valorPrevistoMemoria,
    valorExecutado: itemNaoApto.valorExecutadoMemoria,
    saldo: itemNaoApto.saldoMemoria,
    quantidadeOriginalMemoria: itemNaoApto.quantidadeMemoria,
  };
}

function enriquecerDivergenciaComAuditoria(divergencia, indices = carregarIndicesAuditoriaOperacional()) {
  if (!divergencia) return null;
  const profundo = indices.pendenciasProfundo?.get(Number(divergencia.id));
  const itemNaoApto = indices.itemNaoApto?.get(Number(divergencia.id));
  const saldosResiduais = indices.saldosResiduais?.get(Number(divergencia.id)) || [];
  const categoriaOperacional = profundo?.classificacaoOperacional || null;
  const classificacaoDetalhada = itemNaoApto?.classificacao
    || (Array.isArray(profundo?.classificacoes) ? profundo.classificacoes.join(", ") : null);
  const falsoPositivoSaneavel = categoriaOperacional === "falso_positivo_saneavel"
    || itemNaoApto?.classificacao === "falso_positivo_saneavel"
    || Boolean(profundo?.classificacoes?.includes?.("possivel_falso_positivo"));
  return {
    ...divergencia,
    categoriaOperacional,
    classificacaoDetalhada,
    riscoOperacional: profundo?.exigeDecisaoHumanaSubstantiva === true ? "alto" : (categoriaOperacional ? "baixo" : null),
    falsoPositivoSaneavel,
    padConsolidado: itemNaoApto?.padConsolidado || null,
    memoriaConsolidada: montarMemoriaConsolidadaItemNaoApto(itemNaoApto),
    motivosSaneamento: itemNaoApto?.motivos || (profundo?.evidencia ? [profundo.evidencia] : []),
    acaoOperacionalRecomendada: profundo?.recomendacao || itemNaoApto?.justificativaSugerida || divergencia.acaoSugerida,
    saldoResidualTecnico: Boolean(profundo?.saldoResidualTecnico || saldosResiduais.length),
    alertaSaldoResidual: profundo?.alertaSaldoResidual || (saldosResiduais.length
      ? "Saldo residual/remanescente é item técnico não setorializado por área, mas segregado por natureza. CAPITAL e CUSTEIO não devem ser pareados nem consolidados como equivalentes."
      : null),
    detalhesSaldoResidual: saldosResiduais,
  };
}

function aplicarFiltrosOperacionais(divergencias, filtros = {}) {
  let resultado = divergencias;
  if (filtros.categoriaOperacional) {
    resultado = resultado.filter((item) => item.categoriaOperacional === filtros.categoriaOperacional);
  }
  if (filtros.operacionalEfetiva === true) {
    resultado = resultado.filter((item) => item.categoriaOperacional === CATEGORIA_OPERACIONAL_EFETIVA);
  }
  if (filtros.operacionalEfetiva === false) {
    resultado = resultado.filter((item) => item.categoriaOperacional !== CATEGORIA_OPERACIONAL_EFETIVA);
  }
  if (filtros.saldoResidual === true) {
    resultado = resultado.filter((item) => item.saldoResidualTecnico === true);
  }
  if (filtros.saldoResidual === false) {
    resultado = resultado.filter((item) => item.saldoResidualTecnico !== true);
  }
  return resultado;
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
  const usaFiltroOperacional = filtros.categoriaOperacional
    || filtros.operacionalEfetiva !== undefined
    || filtros.saldoResidual !== undefined;
  const limiteSolicitado = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
  const offsetSolicitado = Math.max(Number(filtros.offset) || 0, 0);
  const filtrosRepo = usaFiltroOperacional
    ? { ...filtros, limite: 500, offset: 0 }
    : filtros;
  const resultado = repo.listarDivergencias(filtrosRepo);
  const indicesAuditoria = carregarIndicesAuditoriaOperacional();
  
  let chavesGeradas = null;
  try {
    const path = require("node:path");
    const repoRoot = path.resolve(__dirname, "../../..");
    const { divergencias } = revisaoService.coletarDivergencias(repoRoot);
    chavesGeradas = new Set(divergencias.map(d => d.chaveDivergencia));
  } catch (err) {
    // ignore
  }

  const divergenciasEnriquecidas = resultado.divergencias.map(linha => {
      const d = formatarDivergencia(linha);
      if (chavesGeradas) {
        d.reapresentada = chavesGeradas.has(d.chaveDivergencia);
      } else {
        d.reapresentada = true;
      }
      return enriquecerDivergenciaComAuditoria(d, indicesAuditoria);
    });
  const filtradas = aplicarFiltrosOperacionais(divergenciasEnriquecidas, filtros);
  const pagina = usaFiltroOperacional
    ? filtradas.slice(offsetSolicitado, offsetSolicitado + limiteSolicitado)
    : filtradas;

  return {
    total: usaFiltroOperacional ? filtradas.length : resultado.total,
    limite: usaFiltroOperacional ? limiteSolicitado : resultado.limite,
    offset: usaFiltroOperacional ? offsetSolicitado : resultado.offset,
    divergencias: pagina,
  };
}

/** Retorna a divergência com payload parseado, decisões e logs. */
function obterDivergencia(id) {
  const revisaoService = require("./profor-pad-revisao-service");
  const linha = repo.buscarDivergenciaPorId(id);
  if (!linha) {
    throw Object.assign(new Error("Divergência não encontrada."), { statusCode: 404 });
  }
  let divergencia = formatarDivergencia(linha);

  try {
    const path = require("node:path");
    const repoRoot = path.resolve(__dirname, "../../..");
    const { divergencias } = revisaoService.coletarDivergencias(repoRoot);
    divergencia.reapresentada = divergencias.some(d => d.chaveDivergencia === divergencia.chaveDivergencia);
  } catch (err) {
    divergencia.reapresentada = true;
  }

  divergencia = enriquecerDivergenciaComAuditoria(divergencia);

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
  enriquecerDivergenciaComAuditoria,
  formatarDivergencia,
  listarDivergencias,
  obterDivergencia,
  listarLogsDaDivergencia,
  auditarPendencias,
  registrarDecisao,
};

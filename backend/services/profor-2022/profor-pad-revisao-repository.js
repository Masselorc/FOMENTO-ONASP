const db = require("../../db/database");

const STATUS_VALIDOS = [
  "PENDENTE",
  "ACEITO",
  "REJEITADO",
  "EM_REVISAO",
  "CORRIGIDO",
  "APLICADO",
  "REVERTIDO",
];
const NIVEIS_VALIDOS = ["info", "aviso", "impeditivo"];

function agoraIso() {
  return new Date().toISOString();
}

/** Cria um lote de revisão com totais zerados (atualizados ao final da geração). */
function criarLoteRevisao({ origem, arquivoOrigem = null, hashOrigem = null }) {
  const agora = agoraIso();
  const info = db.prepare(`
    INSERT INTO profor_2022_revisao_lotes (
      origem, arquivo_origem, hash_origem, status,
      total_divergencias, total_pendentes, total_impeditivas, criado_em, atualizado_em
    ) VALUES (?, ?, ?, 'ABERTO', 0, 0, 0, ?, ?)
  `).run(origem, arquivoOrigem, hashOrigem, agora, agora);
  return Number(info.lastInsertRowid);
}

/** Atualiza os totais de um lote de revisão. */
function atualizarTotaisLote(loteId, { totalDivergencias, totalPendentes, totalImpeditivas }) {
  db.prepare(`
    UPDATE profor_2022_revisao_lotes
    SET total_divergencias = ?, total_pendentes = ?, total_impeditivas = ?, atualizado_em = ?
    WHERE id = ?
  `).run(totalDivergencias, totalPendentes, totalImpeditivas, agoraIso(), loteId);
}

/** Busca uma divergência existente pela chave estável. */
function buscarDivergenciaPorChave(chaveDivergencia) {
  return db.prepare(`
    SELECT * FROM profor_2022_revisao_divergencias WHERE chave_divergencia = ?
  `).get(chaveDivergencia) || null;
}

/** Registra um evento no log de revisão. */
function registrarLog({ entidadeTipo, entidadeId = null, evento, estadoAnterior = null, estadoNovo = null, usuario = null, detalhe = null }) {
  db.prepare(`
    INSERT INTO profor_2022_revisao_logs (
      entidade_tipo, entidade_id, evento, estado_anterior_json, estado_novo_json,
      usuario, detalhe, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entidadeTipo,
    entidadeId,
    evento,
    estadoAnterior === null ? null : JSON.stringify(estadoAnterior),
    estadoNovo === null ? null : JSON.stringify(estadoNovo),
    usuario,
    detalhe,
    agoraIso()
  );
}

/**
 * Insere ou atualiza uma divergência por chave_divergencia.
 *
 * Inserção: cria a divergência com status PENDENTE.
 * Atualização: refresca os dados técnicos e o payload, mas PRESERVA o
 * `status` e nunca toca nas decisões já registradas — o `lote_revisao_id`
 * permanece o do lote que primeiro detectou a divergência.
 *
 * Retorna { id, acao: "criada" | "atualizada" }.
 */
function inserirOuAtualizarDivergencia(loteId, divergencia) {
  const agora = agoraIso();
  const existente = buscarDivergenciaPorChave(divergencia.chaveDivergencia);

  if (!existente) {
    const info = db.prepare(`
      INSERT INTO profor_2022_revisao_divergencias (
        lote_revisao_id, chave_divergencia, numero_convenio, uf, chave_item,
        tipo_alerta, nivel, status, campo_afetado, valor_anterior, valor_novo,
        fonte_anterior, fonte_nova, diferenca, motivo_provavel, acao_sugerida,
        impacto_reconstrucao, bloqueia_publicacao, payload_json, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      loteId,
      divergencia.chaveDivergencia,
      divergencia.numeroConvenio,
      divergencia.uf,
      divergencia.chaveItem,
      divergencia.tipoAlerta,
      divergencia.nivel,
      divergencia.campoAfetado,
      divergencia.valorAnterior,
      divergencia.valorNovo,
      divergencia.fonteAnterior,
      divergencia.fonteNova,
      divergencia.diferenca,
      divergencia.motivoProvavel,
      divergencia.acaoSugerida,
      divergencia.impactoReconstrucao,
      divergencia.bloqueiaPublicacao ? 1 : 0,
      JSON.stringify(divergencia.payload || {}),
      agora,
      agora
    );
    return { id: Number(info.lastInsertRowid), acao: "criada" };
  }

  // Atualização: dados técnicos e payload são refrescados; status preservado.
  db.prepare(`
    UPDATE profor_2022_revisao_divergencias
    SET numero_convenio = ?, uf = ?, chave_item = ?, tipo_alerta = ?, nivel = ?,
        campo_afetado = ?, valor_anterior = ?, valor_novo = ?, fonte_anterior = ?,
        fonte_nova = ?, diferenca = ?, motivo_provavel = ?, acao_sugerida = ?,
        impacto_reconstrucao = ?, bloqueia_publicacao = ?, payload_json = ?, atualizado_em = ?
    WHERE id = ?
  `).run(
    divergencia.numeroConvenio,
    divergencia.uf,
    divergencia.chaveItem,
    divergencia.tipoAlerta,
    divergencia.nivel,
    divergencia.campoAfetado,
    divergencia.valorAnterior,
    divergencia.valorNovo,
    divergencia.fonteAnterior,
    divergencia.fonteNova,
    divergencia.diferenca,
    divergencia.motivoProvavel,
    divergencia.acaoSugerida,
    divergencia.impactoReconstrucao,
    divergencia.bloqueiaPublicacao ? 1 : 0,
    JSON.stringify(divergencia.payload || {}),
    agora,
    existente.id
  );
  return { id: existente.id, acao: "atualizada" };
}

/** Lista todas as chaves de divergência atualmente persistidas. */
function listarChavesExistentes() {
  return db.prepare("SELECT chave_divergencia FROM profor_2022_revisao_divergencias")
    .all()
    .map((linha) => linha.chave_divergencia);
}

/** Conta divergências decididas (com pelo menos uma decisão registrada). */
function contarDivergenciasComDecisao() {
  return db.prepare(`
    SELECT COUNT(DISTINCT divergencia_id) AS total FROM profor_2022_revisao_decisoes
  `).get().total;
}

/* --------------------------- consultas de auditoria --------------------------- */

function agregar(coluna) {
  return db.prepare(`
    SELECT ${coluna} AS chave, COUNT(*) AS total
    FROM profor_2022_revisao_divergencias
    GROUP BY ${coluna}
    ORDER BY total DESC, chave
  `).all();
}

function obterEstatisticasAuditoria() {
  const total = db.prepare("SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias").get().t;
  const pendentes = db.prepare(
    "SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias WHERE status = 'PENDENTE'"
  ).get().t;
  const impeditivas = db.prepare(
    "SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias WHERE nivel = 'impeditivo'"
  ).get().t;
  const bloqueiamPublicacao = db.prepare(
    "SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias WHERE bloqueia_publicacao = 1"
  ).get().t;
  const semDecisao = db.prepare(`
    SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias d
    WHERE NOT EXISTS (
      SELECT 1 FROM profor_2022_revisao_decisoes x WHERE x.divergencia_id = d.id
    )
  `).get().t;

  return {
    total,
    pendentes,
    impeditivas,
    bloqueiamPublicacao,
    semDecisao,
    porStatus: agregar("status"),
    porNivel: agregar("nivel"),
    porTipo: agregar("tipo_alerta"),
    porConvenio: agregar("numero_convenio"),
  };
}

/* --------------------------- consultas da API --------------------------- */

const COLUNAS_DIVERGENCIA = `
  id, lote_revisao_id, chave_divergencia, numero_convenio, uf, chave_item,
  tipo_alerta, nivel, status, campo_afetado, valor_anterior, valor_novo,
  fonte_anterior, fonte_nova, diferenca, motivo_provavel, acao_sugerida,
  impacto_reconstrucao, bloqueia_publicacao, payload_json, criado_em, atualizado_em
`;

/**
 * Lista divergências com filtros opcionais (status, nivel, tipo_alerta,
 * numero_convenio, uf, bloqueia_publicacao) e paginação.
 */
function listarDivergencias(filtros = {}) {
  const condicoes = [];
  const parametros = [];
  const mapaFiltro = {
    status: "status",
    nivel: "nivel",
    tipo: "tipo_alerta",
    convenio: "numero_convenio",
    uf: "uf",
  };
  for (const [chaveFiltro, coluna] of Object.entries(mapaFiltro)) {
    if (filtros[chaveFiltro] !== undefined && filtros[chaveFiltro] !== null && filtros[chaveFiltro] !== "") {
      condicoes.push(`${coluna} = ?`);
      parametros.push(String(filtros[chaveFiltro]));
    }
  }
  if (filtros.bloqueiaPublicacao !== undefined && filtros.bloqueiaPublicacao !== null) {
    condicoes.push("bloqueia_publicacao = ?");
    parametros.push(filtros.bloqueiaPublicacao ? 1 : 0);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
  const offset = Math.max(Number(filtros.offset) || 0, 0);

  const total = db.prepare(
    `SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias ${where}`
  ).get(...parametros).t;

  const linhas = db.prepare(`
    SELECT ${COLUNAS_DIVERGENCIA}
    FROM profor_2022_revisao_divergencias
    ${where}
    ORDER BY (nivel = 'impeditivo') DESC, numero_convenio, id
    LIMIT ? OFFSET ?
  `).all(...parametros, limite, offset);

  return { total, limite, offset, divergencias: linhas };
}

/** Busca uma divergência por id. */
function buscarDivergenciaPorId(id) {
  return db.prepare(`
    SELECT ${COLUNAS_DIVERGENCIA}
    FROM profor_2022_revisao_divergencias WHERE id = ?
  `).get(Number(id)) || null;
}

/** Lista as decisões registradas para uma divergência (mais recentes primeiro). */
function listarDecisoesDaDivergencia(divergenciaId) {
  return db.prepare(`
    SELECT id, divergencia_id, decisao, valor_aplicado, justificativa, usuario,
           decidido_em, lote_saneamento_id, payload_decisao_json, criado_em
    FROM profor_2022_revisao_decisoes
    WHERE divergencia_id = ?
    ORDER BY id DESC
  `).all(Number(divergenciaId));
}

/** Lista os logs de uma divergência (mais recentes primeiro). */
function listarLogsDaDivergencia(divergenciaId) {
  return db.prepare(`
    SELECT id, entidade_tipo, entidade_id, evento, estado_anterior_json,
           estado_novo_json, usuario, detalhe, criado_em
    FROM profor_2022_revisao_logs
    WHERE entidade_tipo = 'divergencia' AND entidade_id = ?
    ORDER BY id DESC
  `).all(Number(divergenciaId));
}

/**
 * Registra uma decisão sobre uma divergência, de forma transacional:
 * insere em profor_2022_revisao_decisoes, atualiza o status da divergência
 * (quando o status mudar) e grava log com estado anterior e novo.
 * NÃO aplica a decisão ao planoAplicacao.
 */
function registrarDecisao({ divergencia, decisao, novoStatus, valorAplicado, justificativa, usuario, payloadDecisao }) {
  const executar = db.transaction(() => {
    const agora = agoraIso();
    const statusAnterior = divergencia.status;

    const infoDecisao = db.prepare(`
      INSERT INTO profor_2022_revisao_decisoes (
        divergencia_id, decisao, valor_aplicado, justificativa, usuario,
        decidido_em, lote_saneamento_id, payload_decisao_json, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      divergencia.id,
      decisao,
      valorAplicado === undefined ? null : valorAplicado,
      justificativa || null,
      usuario || null,
      agora,
      JSON.stringify(payloadDecisao || {}),
      agora
    );
    const decisaoId = Number(infoDecisao.lastInsertRowid);

    if (novoStatus && novoStatus !== statusAnterior) {
      db.prepare(`
        UPDATE profor_2022_revisao_divergencias
        SET status = ?, atualizado_em = ?
        WHERE id = ?
      `).run(novoStatus, agora, divergencia.id);
    }

    registrarLog({
      entidadeTipo: "divergencia",
      entidadeId: divergencia.id,
      evento: "decisao_registrada",
      estadoAnterior: { status: statusAnterior },
      estadoNovo: {
        status: novoStatus || statusAnterior,
        decisao,
        decisaoId,
        valorAplicado: valorAplicado === undefined ? null : valorAplicado,
      },
      usuario: usuario || null,
      detalhe: `Decisão '${decisao}' registrada na divergência ${divergencia.id}.`,
    });

    return { decisaoId, statusAnterior, statusNovo: novoStatus || statusAnterior, decididoEm: agora };
  });

  return executar();
}

/** Retorna o último lote de revisão registrado. */
function obterUltimoLote() {
  return db.prepare(`
    SELECT * FROM profor_2022_revisao_lotes ORDER BY id DESC LIMIT 1
  `).get() || null;
}

/** Conta divergências criadas/atualizadas em um lote (via logs do lote). */
function contarEventosDoLote(loteId, evento) {
  return db.prepare(`
    SELECT COUNT(*) AS t FROM profor_2022_revisao_logs
    WHERE entidade_tipo = 'divergencia' AND evento = ?
      AND json_extract(estado_novo_json, '$.loteGeracaoId') = ?
  `).get(evento, loteId).t;
}

module.exports = {
  STATUS_VALIDOS,
  NIVEIS_VALIDOS,
  criarLoteRevisao,
  atualizarTotaisLote,
  buscarDivergenciaPorChave,
  inserirOuAtualizarDivergencia,
  registrarLog,
  listarChavesExistentes,
  contarDivergenciasComDecisao,
  obterEstatisticasAuditoria,
  obterUltimoLote,
  contarEventosDoLote,
  listarDivergencias,
  buscarDivergenciaPorId,
  listarDecisoesDaDivergencia,
  listarLogsDaDivergencia,
  registrarDecisao,
};

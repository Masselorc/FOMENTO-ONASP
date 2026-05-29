const { query, withTransaction } = require("../../db/postgres-client");

// Normaliza linha vinda do Postgres para preservar o contrato esperado pelos
// consumidores (formatarDivergencia em profor-pad-revisao-decisao-service):
// - bloqueia_publicacao: boolean -> 0/1 (consumidor compara === 1)
// - *_json: objeto/array -> string JSON (consumidor faz parseJsonSeguro)
function normalizarLinhaDivergencia(linha) {
  if (!linha) return linha;
  return {
    ...linha,
    bloqueia_publicacao: linha.bloqueia_publicacao === true || linha.bloqueia_publicacao === 1 ? 1 : 0,
    payload_json: typeof linha.payload_json === "string"
      ? linha.payload_json
      : JSON.stringify(linha.payload_json ?? {}),
  };
}

function normalizarLinhaDecisao(linha) {
  if (!linha) return linha;
  return {
    ...linha,
    payload_decisao_json: typeof linha.payload_decisao_json === "string"
      ? linha.payload_decisao_json
      : JSON.stringify(linha.payload_decisao_json ?? {}),
  };
}

function normalizarLinhaLog(linha) {
  if (!linha) return linha;
  const norm = { ...linha };
  if (norm.estado_anterior_json !== null && norm.estado_anterior_json !== undefined && typeof norm.estado_anterior_json !== "string") {
    norm.estado_anterior_json = JSON.stringify(norm.estado_anterior_json);
  }
  if (norm.estado_novo_json !== null && norm.estado_novo_json !== undefined && typeof norm.estado_novo_json !== "string") {
    norm.estado_novo_json = JSON.stringify(norm.estado_novo_json);
  }
  return norm;
}

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
const DECISOES_RESOLUTIVAS = ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"];
const DECISAO_COMENTARIO = "COMENTAR";
const STATUS_RESOLUTIVOS = ["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"];

function agoraIso() {
  return new Date().toISOString();
}

/** Cria um lote de revisão com totais zerados (atualizados ao final da geração). */
async function criarLoteRevisao({ origem, arquivoOrigem = null, hashOrigem = null }, client = null) {
  const agora = agoraIso();
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const result = await exec(
    `INSERT INTO profor_2022_revisao_lotes (
       origem, arquivo_origem, hash_origem, status,
       total_divergencias, total_pendentes, total_impeditivas, criado_em, atualizado_em
     ) VALUES ($1, $2, $3, 'ABERTO', 0, 0, 0, $4, $5)
     RETURNING id`,
    [origem, arquivoOrigem, hashOrigem, agora, agora]
  );
  return Number(result.rows[0].id);
}

/** Atualiza os totais de um lote de revisão. */
async function atualizarTotaisLote(loteId, { totalDivergencias, totalPendentes, totalImpeditivas }, client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  await exec(
    `UPDATE profor_2022_revisao_lotes
     SET total_divergencias = $1, total_pendentes = $2, total_impeditivas = $3, atualizado_em = $4
     WHERE id = $5`,
    [totalDivergencias, totalPendentes, totalImpeditivas, agoraIso(), loteId]
  );
}

/** Busca uma divergência existente pela chave estável. */
async function buscarDivergenciaPorChave(chaveDivergencia, client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const result = await exec(
    "SELECT * FROM profor_2022_revisao_divergencias WHERE chave_divergencia = $1",
    [chaveDivergencia]
  );
  return result.rows[0] ? normalizarLinhaDivergencia(result.rows[0]) : null;
}

/** Registra um evento no log de revisão. */
async function registrarLog({ entidadeTipo, entidadeId = null, evento, estadoAnterior = null, estadoNovo = null, usuario = null, detalhe = null }, client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  await exec(
    `INSERT INTO profor_2022_revisao_logs (
       entidade_tipo, entidade_id, evento, estado_anterior_json, estado_novo_json,
       usuario, detalhe, criado_em
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entidadeTipo,
      entidadeId,
      evento,
      estadoAnterior === null ? null : JSON.stringify(estadoAnterior),
      estadoNovo === null ? null : JSON.stringify(estadoNovo),
      usuario,
      detalhe,
      agoraIso(),
    ]
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
async function inserirOuAtualizarDivergencia(loteId, divergencia, client = null) {
  const agora = agoraIso();
  const existente = await buscarDivergenciaPorChave(divergencia.chaveDivergencia, client);

  if (!existente) {
    const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
    const result = await exec(
      `INSERT INTO profor_2022_revisao_divergencias (
         lote_revisao_id, chave_divergencia, numero_convenio, uf, chave_item,
         tipo_alerta, nivel, status, campo_afetado, valor_anterior, valor_novo,
         fonte_anterior, fonte_nova, diferenca, motivo_provavel, acao_sugerida,
         impacto_reconstrucao, bloqueia_publicacao, payload_json, criado_em, atualizado_em
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDENTE', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
       RETURNING id`,
      [
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
        Boolean(divergencia.bloqueiaPublicacao),
        JSON.stringify(divergencia.payload || {}),
        agora,
      ]
    );
    return { id: Number(result.rows[0].id), acao: "criada" };
  }

  // Atualização: dados técnicos e payload são refrescados; status preservado.
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  await exec(
    `UPDATE profor_2022_revisao_divergencias
     SET numero_convenio = $1, uf = $2, chave_item = $3, tipo_alerta = $4, nivel = $5,
         campo_afetado = $6, valor_anterior = $7, valor_novo = $8, fonte_anterior = $9,
         fonte_nova = $10, diferenca = $11, motivo_provavel = $12, acao_sugerida = $13,
         impacto_reconstrucao = $14, bloqueia_publicacao = $15, payload_json = $16, atualizado_em = $17
     WHERE id = $18`,
    [
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
      Boolean(divergencia.bloqueiaPublicacao),
      JSON.stringify(divergencia.payload || {}),
      agora,
      existente.id,
    ]
  );
  return { id: existente.id, acao: "atualizada" };
}

/** Lista todas as chaves de divergência atualmente persistidas. */
async function listarChavesExistentes(client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const result = await exec(
    "SELECT chave_divergencia FROM profor_2022_revisao_divergencias",
    []
  );
  return result.rows.map((linha) => linha.chave_divergencia);
}

/** Conta divergências decididas (com pelo menos uma decisão registrada). */
async function contarDivergenciasComDecisao() {
  const result = await query(
    "SELECT COUNT(DISTINCT divergencia_id) AS total FROM profor_2022_revisao_decisoes"
  );
  return Number(result.rows[0]?.total || 0);
}

/* --------------------------- consultas de auditoria --------------------------- */

const COLUNAS_AGREGAVEIS = new Set(["status", "nivel", "tipo_alerta", "numero_convenio"]);

async function agregar(coluna, client = null) {
  if (!COLUNAS_AGREGAVEIS.has(coluna)) throw new Error(`Coluna não suportada: ${coluna}`);
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const result = await exec(
    `SELECT ${coluna} AS chave, COUNT(*) AS total
     FROM profor_2022_revisao_divergencias
     GROUP BY ${coluna}
     ORDER BY total DESC, chave`,
    []
  );
  return result.rows.map((r) => ({ chave: r.chave, total: Number(r.total || 0) }));
}

async function obterEstatisticasAuditoria(client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const placeholdersRes1 = DECISOES_RESOLUTIVAS.map((_, i) => `$${i + 1}`).join(", ");
  const idxComent = DECISOES_RESOLUTIVAS.length + 1;
  const placeholdersRes2 = DECISOES_RESOLUTIVAS.map((_, i) => `$${idxComent + 1 + i}`).join(", ");

  const totaisResult = await exec(
    `SELECT
       COUNT(*) AS "totalDivergencias",
       SUM(CASE WHEN status = 'PENDENTE' THEN 1 ELSE 0 END) AS "totalPendentes",
       SUM(CASE WHEN status = 'EM_REVISAO' THEN 1 ELSE 0 END) AS "totalEmRevisao",
       SUM(CASE WHEN nivel = 'impeditivo' THEN 1 ELSE 0 END) AS "totalImpeditivas",
       SUM(CASE WHEN bloqueia_publicacao = true THEN 1 ELSE 0 END) AS "totalBloqueiamPublicacao",
       SUM(CASE WHEN status = 'PENDENTE' AND bloqueia_publicacao = true THEN 1 ELSE 0 END) AS "totalPendentesQueBloqueiamPublicacao",
       SUM(CASE WHEN status = 'EM_REVISAO' AND bloqueia_publicacao = true THEN 1 ELSE 0 END) AS "totalEmRevisaoQueBloqueiamPublicacao"
     FROM profor_2022_revisao_divergencias`,
    []
  );
  const totais = totaisResult.rows[0] || {};

  const decisoesResult = await exec(
    `SELECT
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM profor_2022_revisao_decisoes x
         WHERE x.divergencia_id = d.id AND x.decisao IN (${placeholdersRes1})
       ) THEN 1 ELSE 0 END) AS "totalComDecisaoResolutiva",
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM profor_2022_revisao_decisoes x
         WHERE x.divergencia_id = d.id AND x.decisao = $${idxComent}
       ) THEN 1 ELSE 0 END) AS "totalComComentario",
       SUM(CASE WHEN NOT EXISTS (
         SELECT 1 FROM profor_2022_revisao_decisoes x
         WHERE x.divergencia_id = d.id AND x.decisao IN (${placeholdersRes2})
       ) THEN 1 ELSE 0 END) AS "totalSemDecisaoResolutiva"
     FROM profor_2022_revisao_divergencias d`,
    [...DECISOES_RESOLUTIVAS, DECISAO_COMENTARIO, ...DECISOES_RESOLUTIVAS]
  );
  const decisoes = decisoesResult.rows[0] || {};

  const bloqueiosAtivos = Number(totais.totalPendentesQueBloqueiamPublicacao || 0)
    + Number(totais.totalEmRevisaoQueBloqueiamPublicacao || 0);

  const [porStatus, porNivel, porTipo, porConvenio] = await Promise.all([
    agregar("status", client),
    agregar("nivel", client),
    agregar("tipo_alerta", client),
    agregar("numero_convenio", client),
  ]);

  return {
    totalDivergencias: Number(totais.totalDivergencias || 0),
    totalPendentes: Number(totais.totalPendentes || 0),
    totalEmRevisao: Number(totais.totalEmRevisao || 0),
    totalImpeditivas: Number(totais.totalImpeditivas || 0),
    totalBloqueiamPublicacao: Number(totais.totalBloqueiamPublicacao || 0),
    totalPendentesQueBloqueiamPublicacao: Number(totais.totalPendentesQueBloqueiamPublicacao || 0),
    totalEmRevisaoQueBloqueiamPublicacao: Number(totais.totalEmRevisaoQueBloqueiamPublicacao || 0),
    totalComDecisaoResolutiva: Number(decisoes.totalComDecisaoResolutiva || 0),
    totalComComentario: Number(decisoes.totalComComentario || 0),
    totalSemDecisaoResolutiva: Number(decisoes.totalSemDecisaoResolutiva || 0),
    publicacaoLiberada: bloqueiosAtivos === 0,
    porStatus,
    porNivel,
    porTipo,
    porConvenio,
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
async function listarDivergencias(filtros = {}) {
  const condicoes = [];
  const parametros = [];
  let proximoIndice = 1;
  const mapaFiltro = {
    status: "status",
    nivel: "nivel",
    tipo: "tipo_alerta",
    convenio: "numero_convenio",
    uf: "uf",
  };
  for (const [chaveFiltro, coluna] of Object.entries(mapaFiltro)) {
    if (filtros[chaveFiltro] !== undefined && filtros[chaveFiltro] !== null && filtros[chaveFiltro] !== "") {
      condicoes.push(`${coluna} = $${proximoIndice++}`);
      parametros.push(String(filtros[chaveFiltro]));
    }
  }
  if (filtros.bloqueiaPublicacao !== undefined && filtros.bloqueiaPublicacao !== null) {
    condicoes.push(`bloqueia_publicacao = $${proximoIndice++}`);
    parametros.push(Boolean(filtros.bloqueiaPublicacao));
  }
  const adicionarFiltroDecisaoResolutiva = (negado) => {
    const placeholders = DECISOES_RESOLUTIVAS.map(() => `$${proximoIndice++}`).join(", ");
    condicoes.push(`${negado ? "NOT " : ""}EXISTS (
      SELECT 1 FROM profor_2022_revisao_decisoes x
      WHERE x.divergencia_id = profor_2022_revisao_divergencias.id
        AND x.decisao IN (${placeholders})
    )`);
    parametros.push(...DECISOES_RESOLUTIVAS);
  };
  if (filtros.semDecisaoResolutiva !== undefined && filtros.semDecisaoResolutiva !== null) {
    adicionarFiltroDecisaoResolutiva(Boolean(filtros.semDecisaoResolutiva));
  }
  if (filtros.comDecisaoResolutiva !== undefined && filtros.comDecisaoResolutiva !== null) {
    adicionarFiltroDecisaoResolutiva(!filtros.comDecisaoResolutiva);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
  const offset = Math.max(Number(filtros.offset) || 0, 0);

  const totalResult = await query(
    `SELECT COUNT(*) AS t FROM profor_2022_revisao_divergencias ${where}`,
    parametros
  );
  const total = Number(totalResult.rows[0]?.t || 0);

  const linhasResult = await query(
    `SELECT ${COLUNAS_DIVERGENCIA}
     FROM profor_2022_revisao_divergencias
     ${where}
     ORDER BY (nivel = 'impeditivo') DESC, numero_convenio, id
     LIMIT $${proximoIndice++} OFFSET $${proximoIndice++}`,
    [...parametros, limite, offset]
  );
  const linhas = linhasResult.rows.map(normalizarLinhaDivergencia);

  return { total, limite, offset, divergencias: linhas };
}

/** Busca uma divergência por id. */
async function buscarDivergenciaPorId(id, client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const result = await exec(
    `SELECT ${COLUNAS_DIVERGENCIA} FROM profor_2022_revisao_divergencias WHERE id = $1`,
    [Number(id)]
  );
  return result.rows[0] ? normalizarLinhaDivergencia(result.rows[0]) : null;
}

/** Lista as decisões registradas para uma divergência (mais recentes primeiro). */
async function listarDecisoesDaDivergencia(divergenciaId) {
  const result = await query(
    `SELECT id, divergencia_id, decisao, valor_aplicado, justificativa, usuario,
            decidido_em, lote_saneamento_id, payload_decisao_json, criado_em
     FROM profor_2022_revisao_decisoes
     WHERE divergencia_id = $1
     ORDER BY id DESC`,
    [Number(divergenciaId)]
  );
  return result.rows.map(normalizarLinhaDecisao);
}

/** Lista os logs de uma divergência (mais recentes primeiro). */
async function listarLogsDaDivergencia(divergenciaId) {
  const result = await query(
    `SELECT id, entidade_tipo, entidade_id, evento, estado_anterior_json,
            estado_novo_json, usuario, detalhe, criado_em
     FROM profor_2022_revisao_logs
     WHERE entidade_tipo = 'divergencia' AND entidade_id = $1
     ORDER BY id DESC`,
    [Number(divergenciaId)]
  );
  return result.rows.map(normalizarLinhaLog);
}

/**
 * Registra uma decisão sobre uma divergência, de forma transacional:
 * insere em profor_2022_revisao_decisoes, atualiza o status da divergência
 * (quando o status mudar) e grava log com estado anterior e novo.
 * NÃO aplica a decisão ao planoAplicacao.
 */
async function registrarDecisao({ divergencia, decisao, novoStatus, valorAplicado, justificativa, usuario, payloadDecisao }) {
  return withTransaction(async (client) => {
    const agora = agoraIso();
    const statusAnterior = divergencia.status;

    const resDecisao = await client.query(
      `INSERT INTO profor_2022_revisao_decisoes (
         divergencia_id, decisao, valor_aplicado, justificativa, usuario,
         decidido_em, lote_saneamento_id, payload_decisao_json, criado_em
       ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $6)
       RETURNING id`,
      [
        divergencia.id,
        decisao,
        valorAplicado === undefined ? null : valorAplicado,
        justificativa || null,
        usuario || null,
        agora,
        JSON.stringify(payloadDecisao || {}),
      ]
    );
    const decisaoId = Number(resDecisao.rows[0].id);

    if (novoStatus && novoStatus !== statusAnterior) {
      await client.query(
        `UPDATE profor_2022_revisao_divergencias SET status = $1, atualizado_em = $2 WHERE id = $3`,
        [novoStatus, agora, divergencia.id]
      );
    }

    await registrarLog({
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
    }, client);

    return { decisaoId, statusAnterior, statusNovo: novoStatus || statusAnterior, decididoEm: agora };
  });
}

/** Retorna o último lote de revisão registrado. */
async function obterUltimoLote() {
  const result = await query(
    "SELECT * FROM profor_2022_revisao_lotes ORDER BY id DESC LIMIT 1"
  );
  return result.rows[0] || null;
}

/** Conta divergências criadas/atualizadas em um lote (via logs do lote). */
async function contarEventosDoLote(loteId, evento) {
  // Em Postgres usamos jsonb com `->>` para extrair o campo loteGeracaoId
  // como texto e comparamos contra o id do lote (também convertido a texto).
  const result = await query(
    `SELECT COUNT(*) AS t FROM profor_2022_revisao_logs
     WHERE entidade_tipo = 'divergencia' AND evento = $1
       AND estado_novo_json->>'loteGeracaoId' = $2`,
    [evento, String(loteId)]
  );
  return Number(result.rows[0]?.t || 0);
}

/**
 * Remove apenas divergências controladas de teste da revisão assistida.
 * Não toca em lotes nem em divergências reais.
 */
async function limparDivergenciasTeste() {
  return withTransaction(async (client) => {
    const selResult = await client.query(
      `SELECT id, chave_divergencia
       FROM profor_2022_revisao_divergencias
       WHERE chave_divergencia LIKE 'revisao_teste:%'
       ORDER BY id`,
      []
    );
    const divergencias = selResult.rows;

    if (!divergencias.length) {
      return {
        totalDivergenciasTeste: 0,
        totalDecisoesRemovidas: 0,
        totalLogsRemovidos: 0,
        totalDivergenciasRemovidas: 0,
        chaves: [],
      };
    }

    const ids = divergencias.map((item) => item.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

    const rDec = await client.query(
      `DELETE FROM profor_2022_revisao_decisoes WHERE divergencia_id IN (${placeholders})`,
      ids
    );
    const rLog = await client.query(
      `DELETE FROM profor_2022_revisao_logs WHERE entidade_tipo = 'divergencia' AND entidade_id IN (${placeholders})`,
      ids
    );
    const rDiv = await client.query(
      `DELETE FROM profor_2022_revisao_divergencias WHERE id IN (${placeholders}) AND chave_divergencia LIKE 'revisao_teste:%'`,
      ids
    );

    return {
      totalDivergenciasTeste: divergencias.length,
      totalDecisoesRemovidas: rDec.rowCount,
      totalLogsRemovidos: rLog.rowCount,
      totalDivergenciasRemovidas: rDiv.rowCount,
      chaves: divergencias.map((item) => item.chave_divergencia),
    };
  });
}

/** Lista divergências com status resolutivo sem decisão resolutiva auditável. */
async function listarStatusResolutivosOrfaos(client = null) {
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => query(sql, p);
  const statusPlaceholders = STATUS_RESOLUTIVOS.map((_, i) => `$${i + 1}`).join(", ");
  const decisoesBase = STATUS_RESOLUTIVOS.length + 1;
  const decisoesPlaceholders = DECISOES_RESOLUTIVAS.map((_, i) => `$${decisoesBase + i}`).join(", ");
  const result = await exec(
    `SELECT ${COLUNAS_DIVERGENCIA}
     FROM profor_2022_revisao_divergencias d
     WHERE d.status IN (${statusPlaceholders})
       AND d.chave_divergencia NOT LIKE 'revisao_teste:%'
       AND NOT EXISTS (
         SELECT 1
         FROM profor_2022_revisao_decisoes x
         WHERE x.divergencia_id = d.id
           AND x.decisao IN (${decisoesPlaceholders})
       )
     ORDER BY d.id`,
    [...STATUS_RESOLUTIVOS, ...DECISOES_RESOLUTIVAS]
  );
  return result.rows.map(normalizarLinhaDivergencia);
}

/**
 * Reverte para PENDENTE status resolutivo sem decisão correspondente.
 * Não cria decisão falsa e preserva divergências, decisões existentes e logs.
 */
async function sanearStatusResolutivosOrfaos() {
  return withTransaction(async (client) => {
    const orfaos = await listarStatusResolutivosOrfaos(client);
    if (!orfaos.length) {
      return { totalEncontrados: 0, totalSaneados: 0, divergencias: [] };
    }

    const agora = agoraIso();
    let totalSaneados = 0;
    for (const divergencia of orfaos) {
      const upd = await client.query(
        `UPDATE profor_2022_revisao_divergencias
         SET status = 'PENDENTE', atualizado_em = $1
         WHERE id = $2 AND status = $3`,
        [agora, divergencia.id, divergencia.status]
      );
      if (!upd.rowCount) continue;

      await client.query(
        `INSERT INTO profor_2022_revisao_logs (
           entidade_tipo, entidade_id, evento, estado_anterior_json, estado_novo_json,
           usuario, detalhe, criado_em
         ) VALUES ('divergencia', $1, 'status_resolutivo_orfao_saneado', $2, $3, $4, $5, $6)`,
        [
          divergencia.id,
          JSON.stringify({
            status: divergencia.status,
            chaveDivergencia: divergencia.chave_divergencia,
            tipoAlerta: divergencia.tipo_alerta,
            motivo: "Status resolutivo sem decisão resolutiva auditável.",
          }),
          JSON.stringify({ status: "PENDENTE" }),
          "sistema-saneamento",
          "Status resolutivo não possuía decisão resolutiva auditável e foi revertido para PENDENTE.",
          agora,
        ]
      );
      totalSaneados += 1;
    }

    return {
      totalEncontrados: orfaos.length,
      totalSaneados,
      divergencias: orfaos,
    };
  });
}

module.exports = {
  STATUS_VALIDOS,
  NIVEIS_VALIDOS,
  DECISOES_RESOLUTIVAS,
  DECISAO_COMENTARIO,
  STATUS_RESOLUTIVOS,
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
  limparDivergenciasTeste,
  listarStatusResolutivosOrfaos,
  sanearStatusResolutivosOrfaos,
};

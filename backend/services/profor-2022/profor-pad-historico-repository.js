const postgresClient = require("../../db/postgres-client");

function resolverExecutor(executor) {
  if (executor == null) return (sql, params) => postgresClient.query(sql, params);
  if (typeof executor === "function") return executor;
  if (typeof executor.query === "function") return (sql, params) => executor.query(sql, params);
  throw new TypeError("Executor deve ser uma função ou um objeto com método query(sql, params).");
}

function agoraIso() {
  return new Date().toISOString();
}

function serializarJsonb(valor, padrao) {
  const efetivo = valor === undefined || (valor === null && padrao !== null) ? padrao : valor;
  return efetivo === null || typeof efetivo === "string" ? efetivo : JSON.stringify(efetivo);
}

function lerJsonb(valor) {
  return typeof valor === "string" ? JSON.parse(valor) : valor;
}

function idNumero(valor) {
  return valor == null ? null : Number(valor);
}

function normalizarAtualizacao(linha) {
  if (!linha) return null;
  return {
    id: idNumero(linha.id),
    jobId: linha.job_id,
    origem: linha.origem,
    status: linha.status,
    resultado: linha.resultado,
    iniciadoEm: linha.iniciado_em,
    concluidoEm: linha.concluido_em,
    totalItensAntes: linha.total_itens_antes,
    totalItensDepois: linha.total_itens_depois,
    totalNovos: linha.total_novos,
    totalRemovidos: linha.total_removidos,
    totalAlterados: linha.total_alterados,
    totalValorPrevistoAntes: linha.total_valor_previsto_antes,
    totalValorPrevistoDepois: linha.total_valor_previsto_depois,
    deltaValorPrevisto: linha.delta_valor_previsto,
    totalValorExecutadoAntes: linha.total_valor_executado_antes,
    totalValorExecutadoDepois: linha.total_valor_executado_depois,
    deltaValorExecutado: linha.delta_valor_executado,
    totalSaldoAntes: linha.total_saldo_antes,
    totalSaldoDepois: linha.total_saldo_depois,
    deltaSaldo: linha.delta_saldo,
    temPendenciasRevisao: linha.tem_pendencias_revisao,
    totalPendenciasRevisao: linha.total_pendencias_revisao,
    versaoSnapshot: linha.versao_snapshot,
    versaoComparador: linha.versao_comparador,
    mensagemErro: linha.mensagem_erro,
    metadados: lerJsonb(linha.metadados_json),
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function normalizarSnapshot(linha) {
  const normalizado = {
    id: idNumero(linha.id),
    atualizacaoId: idNumero(linha.atualizacao_id),
    momento: linha.momento,
    checksum: linha.checksum,
    versaoSnapshot: linha.versao_snapshot,
    parserVersao: linha.parser_versao,
    origem: linha.origem,
    geradoEm: linha.gerado_em,
    resumo: lerJsonb(linha.resumo_json),
    criadoEm: linha.criado_em,
  };
  if (Object.hasOwn(linha, "snapshot_json")) {
    normalizado.snapshot = lerJsonb(linha.snapshot_json);
  }
  return normalizado;
}

function normalizarAlteracao(linha) {
  return {
    id: idNumero(linha.id),
    atualizacaoId: idNumero(linha.atualizacao_id),
    chaveAlteracao: linha.chave_alteracao,
    tipo: linha.tipo,
    numeroConvenio: linha.numero_convenio,
    uf: linha.uf,
    chaveItemAnterior: linha.chave_item_anterior,
    chaveItemNova: linha.chave_item_nova,
    origemPareamento: linha.origem_pareamento,
    descricaoAnterior: linha.descricao_anterior,
    descricaoNova: linha.descricao_nova,
    areaAnterior: linha.area_anterior,
    areaNova: linha.area_nova,
    naturezaAnterior: linha.natureza_anterior,
    naturezaNova: linha.natureza_nova,
    classificacaoEstado: linha.classificacao_estado,
    revisaoDivergenciaId: idNumero(linha.revisao_divergencia_id),
    decisaoSubstitutoId: idNumero(linha.decisao_substituto_id),
    camposAlterados: lerJsonb(linha.campos_alterados_json),
    itemAnterior: lerJsonb(linha.item_anterior_json),
    itemNovo: lerJsonb(linha.item_novo_json),
    criadoEm: linha.criado_em,
  };
}

async function criarAtualizacao(executor, dados) {
  const exec = resolverExecutor(executor);
  const campos = [
    ["job_id", dados.jobId],
    ["origem", dados.origem],
    ["status", dados.status],
    ["resultado", dados.resultado],
    ["iniciado_em", dados.iniciadoEm],
    ["versao_snapshot", dados.versaoSnapshot],
    ["versao_comparador", dados.versaoComparador],
    ["metadados_json", dados.metadados === undefined ? undefined : serializarJsonb(dados.metadados, {})],
  ].filter(([, valor]) => valor !== undefined);
  const sql = `INSERT INTO public.profor_2022_pad_atualizacoes (${campos.map(([coluna]) => coluna).join(", ")})
    VALUES (${campos.map((_, indice) => `$${indice + 1}`).join(", ")}) RETURNING *`;
  const result = await exec(sql, campos.map(([, valor]) => valor));
  return normalizarAtualizacao(result.rows[0]);
}

async function concluirAtualizacao(executor, id, dados = {}) {
  const exec = resolverExecutor(executor);
  const campos = [
    ["status", "CONCLUIDA"],
    ["resultado", dados.resultado],
    ["concluido_em", dados.concluidoEm ?? agoraIso()],
    ["total_itens_antes", dados.totalItensAntes],
    ["total_itens_depois", dados.totalItensDepois],
    ["total_novos", dados.totalNovos],
    ["total_removidos", dados.totalRemovidos],
    ["total_alterados", dados.totalAlterados],
    ["total_valor_previsto_antes", dados.totalValorPrevistoAntes],
    ["total_valor_previsto_depois", dados.totalValorPrevistoDepois],
    ["delta_valor_previsto", dados.deltaValorPrevisto],
    ["total_valor_executado_antes", dados.totalValorExecutadoAntes],
    ["total_valor_executado_depois", dados.totalValorExecutadoDepois],
    ["delta_valor_executado", dados.deltaValorExecutado],
    ["total_saldo_antes", dados.totalSaldoAntes],
    ["total_saldo_depois", dados.totalSaldoDepois],
    ["delta_saldo", dados.deltaSaldo],
    ["tem_pendencias_revisao", dados.temPendenciasRevisao],
    ["total_pendencias_revisao", dados.totalPendenciasRevisao],
    ["versao_snapshot", dados.versaoSnapshot],
    ["versao_comparador", dados.versaoComparador],
    ["metadados_json", dados.metadados === undefined ? undefined : serializarJsonb(dados.metadados, {})],
    ["mensagem_erro", null],
    ["atualizado_em", agoraIso()],
  ].filter(([, valor]) => valor !== undefined);
  const params = campos.map(([, valor]) => valor);
  params.push(id);
  const sql = `UPDATE public.profor_2022_pad_atualizacoes
    SET ${campos.map(([coluna], indice) => `${coluna} = $${indice + 1}`).join(", ")}
    WHERE id = $${params.length} RETURNING *`;
  const result = await exec(sql, params);
  return normalizarAtualizacao(result.rows[0]);
}

async function falharAtualizacao(executor, id, dados = {}) {
  const exec = resolverExecutor(executor);
  const campos = [
    ["status", "FALHOU"],
    ["resultado", null],
    ["concluido_em", dados.concluidoEm ?? agoraIso()],
    ["mensagem_erro", dados.mensagemErro ?? null],
    ["atualizado_em", agoraIso()],
  ];
  if (dados.metadados !== undefined) campos.push(["metadados_json", serializarJsonb(dados.metadados, {})]);
  const params = campos.map(([, valor]) => valor);
  params.push(id);
  const sql = `UPDATE public.profor_2022_pad_atualizacoes
    SET ${campos.map(([coluna], indice) => `${coluna} = $${indice + 1}`).join(", ")}
    WHERE id = $${params.length} RETURNING *`;
  const result = await exec(sql, params);
  return normalizarAtualizacao(result.rows[0]);
}

async function inserirSnapshot(executor, dados) {
  const exec = resolverExecutor(executor);
  const params = [
    dados.atualizacaoId, dados.momento, dados.checksum, dados.versaoSnapshot ?? null,
    dados.parserVersao ?? null, dados.origem ?? null, dados.geradoEm,
    serializarJsonb(dados.snapshot, null), serializarJsonb(dados.resumo, {}),
  ];
  const result = await exec(
    `INSERT INTO public.profor_2022_pad_snapshots (
      atualizacao_id, momento, checksum, versao_snapshot, parser_versao, origem,
      gerado_em, snapshot_json, resumo_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    params
  );
  return normalizarSnapshot(result.rows[0]);
}

async function inserirAlteracoes(executor, alteracoes) {
  const exec = resolverExecutor(executor);
  if (!Array.isArray(alteracoes)) throw new TypeError("Alterações devem ser um array.");
  if (alteracoes.length === 0) return [];
  const colunas = [
    "atualizacao_id", "chave_alteracao", "tipo", "numero_convenio", "uf",
    "chave_item_anterior", "chave_item_nova", "origem_pareamento",
    "descricao_anterior", "descricao_nova", "area_anterior", "area_nova",
    "natureza_anterior", "natureza_nova", "classificacao_estado",
    "revisao_divergencia_id", "decisao_substituto_id", "campos_alterados_json",
    "item_anterior_json", "item_novo_json",
  ];
  const params = [];
  const valores = alteracoes.map((alteracao) => {
    const linha = [
      alteracao.atualizacaoId, alteracao.chaveAlteracao, alteracao.tipo,
      alteracao.numeroConvenio ?? null, alteracao.uf ?? null,
      alteracao.chaveItemAnterior ?? null, alteracao.chaveItemNova ?? null,
      alteracao.origemPareamento ?? null, alteracao.descricaoAnterior ?? null,
      alteracao.descricaoNova ?? null, alteracao.areaAnterior ?? null,
      alteracao.areaNova ?? null, alteracao.naturezaAnterior ?? null,
      alteracao.naturezaNova ?? null, alteracao.classificacaoEstado ?? "NAO_APLICAVEL",
      alteracao.revisaoDivergenciaId ?? null, alteracao.decisaoSubstitutoId ?? null,
      serializarJsonb(alteracao.camposAlterados, []),
      serializarJsonb(alteracao.itemAnterior, null),
      serializarJsonb(alteracao.itemNovo, null),
    ];
    const inicio = params.length;
    params.push(...linha);
    return `(${linha.map((_, indice) => `$${inicio + indice + 1}`).join(", ")})`;
  });
  const result = await exec(
    `INSERT INTO public.profor_2022_pad_alteracoes (${colunas.join(", ")})
     VALUES ${valores.join(", ")}
     ON CONFLICT (atualizacao_id, chave_alteracao) DO NOTHING RETURNING *`,
    params
  );
  return result.rows.map(normalizarAlteracao);
}

async function buscarAtualizacaoPorId(id, executor = null) {
  const exec = resolverExecutor(executor);
  const result = await exec(
    "SELECT * FROM public.profor_2022_pad_atualizacoes WHERE id = $1",
    [id]
  );
  return normalizarAtualizacao(result.rows[0]);
}

async function buscarAtualizacaoPorJobId(jobId, executor = null) {
  const exec = resolverExecutor(executor);
  const result = await exec(
    `SELECT * FROM public.profor_2022_pad_atualizacoes
     WHERE job_id = $1 ORDER BY id DESC LIMIT 1`,
    [jobId]
  );
  return normalizarAtualizacao(result.rows[0]);
}

async function listarAtualizacoesPorMes({ mes }, executor = null) {
  const exec = resolverExecutor(executor);
  const primeiroDia = `${mes}-01`;
  const result = await exec(
    `SELECT to_char(iniciado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS data,
       COUNT(*)::integer AS total_execucoes,
       COUNT(*) FILTER (WHERE resultado = 'COM_ALTERACOES')::integer AS com_alteracoes,
       COUNT(*) FILTER (WHERE resultado = 'SEM_ALTERACOES')::integer AS sem_alteracoes,
       COUNT(*) FILTER (WHERE status = 'FALHOU')::integer AS falhas
     FROM public.profor_2022_pad_atualizacoes
     WHERE iniciado_em >= ($1::date AT TIME ZONE 'America/Sao_Paulo')
       AND iniciado_em < (($1::date + INTERVAL '1 month') AT TIME ZONE 'America/Sao_Paulo')
     GROUP BY data ORDER BY data ASC`,
    [primeiroDia]
  );
  return result.rows.map((linha) => ({
    data: linha.data,
    totalExecucoes: Number(linha.total_execucoes),
    comAlteracoes: Number(linha.com_alteracoes),
    semAlteracoes: Number(linha.sem_alteracoes),
    falhas: Number(linha.falhas),
  }));
}

const COLUNAS_RESUMO_ATUALIZACAO = `a.id, a.job_id, a.origem, a.status, a.resultado,
  a.iniciado_em, a.concluido_em, a.total_itens_antes, a.total_itens_depois,
  a.total_novos, a.total_removidos, a.total_alterados,
  a.total_valor_previsto_antes, a.total_valor_previsto_depois, a.delta_valor_previsto,
  a.total_valor_executado_antes, a.total_valor_executado_depois, a.delta_valor_executado,
  a.total_saldo_antes, a.total_saldo_depois, a.delta_saldo,
  a.tem_pendencias_revisao, a.total_pendencias_revisao,
  a.versao_snapshot, a.versao_comparador, a.mensagem_erro, a.criado_em, a.atualizado_em`;

async function listarAtualizacoesPorData({ data, uf, convenio, tipo, area }, executor = null) {
  const exec = resolverExecutor(executor);
  const params = [data];
  const filtros = [];
  for (const [coluna, valor] of [
    ["uf", uf], ["numero_convenio", convenio], ["tipo", tipo],
  ]) {
    if (valor !== undefined && valor !== null && valor !== "") {
      params.push(valor);
      filtros.push(`alt.${coluna} = $${params.length}`);
    }
  }
  if (area !== undefined && area !== null && area !== "") {
    params.push(area);
    filtros.push(`(alt.area_anterior = $${params.length} OR alt.area_nova = $${params.length})`);
  }
  const filtroAlteracoes = filtros.length
    ? `AND EXISTS (SELECT 1 FROM public.profor_2022_pad_alteracoes alt
       WHERE alt.atualizacao_id = a.id AND ${filtros.join(" AND ")})`
    : "";
  const result = await exec(
    `SELECT ${COLUNAS_RESUMO_ATUALIZACAO}
     FROM public.profor_2022_pad_atualizacoes a
     WHERE a.iniciado_em >= ($1::date AT TIME ZONE 'America/Sao_Paulo')
       AND a.iniciado_em < (($1::date + INTERVAL '1 day') AT TIME ZONE 'America/Sao_Paulo')
       ${filtroAlteracoes}
     ORDER BY a.iniciado_em DESC, a.id DESC`,
    params
  );
  return result.rows.map(normalizarAtualizacao);
}

async function buscarDetalheAtualizacao(id, executor = null) {
  const exec = resolverExecutor(executor);
  const atualizacao = await buscarAtualizacaoPorId(id, exec);
  if (!atualizacao) return null;
  const alteracoesResult = await exec(
    `SELECT * FROM public.profor_2022_pad_alteracoes
     WHERE atualizacao_id = $1 ORDER BY tipo, numero_convenio, uf, id`,
    [id]
  );
  const snapshotsResult = await exec(
    `SELECT id, atualizacao_id, momento, checksum, versao_snapshot, parser_versao,
       origem, gerado_em, resumo_json, criado_em
     FROM public.profor_2022_pad_snapshots
     WHERE atualizacao_id = $1 ORDER BY momento, id`,
    [id]
  );
  const snapshots = { antes: null, depois: null };
  for (const linha of snapshotsResult.rows) {
    if (linha.momento === "ANTES") snapshots.antes = normalizarSnapshot(linha);
    if (linha.momento === "DEPOIS") snapshots.depois = normalizarSnapshot(linha);
  }
  return {
    atualizacao,
    alteracoes: alteracoesResult.rows.map(normalizarAlteracao),
    snapshots,
  };
}

module.exports = {
  criarAtualizacao,
  concluirAtualizacao,
  falharAtualizacao,
  inserirSnapshot,
  inserirAlteracoes,
  buscarAtualizacaoPorId,
  buscarAtualizacaoPorJobId,
  listarAtualizacoesPorMes,
  listarAtualizacoesPorData,
  buscarDetalheAtualizacao,
};

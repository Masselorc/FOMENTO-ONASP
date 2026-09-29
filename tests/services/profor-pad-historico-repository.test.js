const test = require("node:test");
const assert = require("node:assert/strict");

const postgresClient = require("../../backend/db/postgres-client");
const repository = require("../../backend/services/profor-2022/profor-pad-historico-repository");

function executorFake(respostas = []) {
  const chamadas = [];
  return {
    chamadas,
    async query(sql, params) {
      chamadas.push({ sql, params });
      return { rows: respostas.shift() || [] };
    },
  };
}

function valorInsert(chamada, coluna) {
  const colunas = chamada.sql.match(/INSERT INTO [^(]+\(([^)]+)\)\s*VALUES/i)[1]
    .split(",").map((nome) => nome.trim());
  return chamada.params[colunas.indexOf(coluna)];
}

function valorUpdate(chamada, coluna) {
  const posicao = chamada.sql.match(new RegExp(`\\b${coluna}\\s*=\\s*\\$(\\d+)`))[1];
  return chamada.params[Number(posicao) - 1];
}

test("criarAtualizacao usa parâmetros, defaults do banco e devolve camelCase", async () => {
  const executor = executorFake([[{
    id: "42", job_id: "job-42", origem: "TRANSFEREGOV", status: "EM_EXECUCAO",
    iniciado_em: new Date("2026-09-29T10:00:00Z"), metadados_json: { fonte: "PAD" },
  }]]);
  const criada = await repository.criarAtualizacao(executor, {
    jobId: "job-42", status: "EM_EXECUCAO", versaoSnapshot: "0.2",
    metadados: { fonte: "PAD" },
  });
  assert.equal(executor.chamadas.length, 1);
  const chamada = executor.chamadas[0];
  assert.match(chamada.sql, /INSERT INTO public\.profor_2022_pad_atualizacoes/);
  assert.match(chamada.sql, /RETURNING \*/);
  assert.equal(valorInsert(chamada, "job_id"), "job-42");
  assert.equal(valorInsert(chamada, "versao_snapshot"), "0.2");
  assert.equal(valorInsert(chamada, "metadados_json"), '{"fonte":"PAD"}');
  assert.doesNotMatch(chamada.sql, /job-42|fonte|iniciado_em/);
  assert.equal(criada.id, 42);
  assert.equal(criada.jobId, "job-42");
  assert.deepEqual(criada.metadados, { fonte: "PAD" });
  assert.equal(Object.hasOwn(criada, "job_id"), false);
});

test("concluirAtualizacao força status, persiste resumo e limpa mensagem de erro", async () => {
  const executor = executorFake([[{
    id: "9", status: "CONCLUIDA", resultado: "COM_ALTERACOES",
    mensagem_erro: null, total_novos: 2, total_valor_previsto_depois: 150.5,
  }]]);
  const resultado = await repository.concluirAtualizacao(executor, 9, {
    resultado: "COM_ALTERACOES", totalItensAntes: 10, totalItensDepois: 12,
    totalNovos: 2, totalValorPrevistoDepois: 150.5, temPendenciasRevisao: false,
    metadados: { origem: "teste" },
  });
  const chamada = executor.chamadas[0];
  assert.equal(valorUpdate(chamada, "status"), "CONCLUIDA");
  assert.equal(valorUpdate(chamada, "resultado"), "COM_ALTERACOES");
  assert.equal(valorUpdate(chamada, "total_itens_antes"), 10);
  assert.equal(valorUpdate(chamada, "total_itens_depois"), 12);
  assert.equal(valorUpdate(chamada, "total_novos"), 2);
  assert.equal(valorUpdate(chamada, "total_valor_previsto_depois"), 150.5);
  assert.equal(valorUpdate(chamada, "tem_pendencias_revisao"), false);
  assert.equal(valorUpdate(chamada, "mensagem_erro"), null);
  assert.equal(valorUpdate(chamada, "metadados_json"), '{"origem":"teste"}');
  assert.match(chamada.sql, /atualizado_em = \$\d+/);
  assert.equal(chamada.params.at(-1), 9);
  assert.equal(resultado.id, 9);
  assert.equal(resultado.totalNovos, 2);
});

test("concluirAtualizacao retorna null quando o ID não existe", async () => {
  const executor = executorFake([[]]);
  assert.equal(await repository.concluirAtualizacao(executor, 999, {}), null);
});

test("falharAtualizacao força FALHOU, resultado nulo e usa mensagem recebida", async () => {
  const executor = executorFake([[{
    id: "8", status: "FALHOU", resultado: null, mensagem_erro: "Falha segura.",
  }]]);
  const falha = await repository.falharAtualizacao(executor, 8, {
    mensagemErro: "Falha segura.", metadados: '{"fase":"extracao"}',
  });
  const chamada = executor.chamadas[0];
  assert.equal(valorUpdate(chamada, "status"), "FALHOU");
  assert.equal(valorUpdate(chamada, "resultado"), null);
  assert.equal(valorUpdate(chamada, "mensagem_erro"), "Falha segura.");
  assert.equal(valorUpdate(chamada, "metadados_json"), '{"fase":"extracao"}');
  assert.doesNotMatch(chamada.sql, /Falha segura|stack/);
  assert.equal(falha.mensagemErro, "Falha segura.");
});

test("falharAtualizacao retorna null quando o ID não existe", async () => {
  const executor = executorFake([[]]);
  assert.equal(await repository.falharAtualizacao(executor, 999, { mensagemErro: "Falha segura." }), null);
});

test("inserirSnapshot mantém checksum e envia JSONB sem upsert", async () => {
  const executor = executorFake([[{
    id: "3", atualizacao_id: "2", momento: "ANTES", checksum: "hash-original",
    snapshot_json: { planoAplicacao: [] }, resumo_json: '{"totalLinhas":0}',
  }]]);
  const snapshot = { planoAplicacao: [] };
  const inserido = await repository.inserirSnapshot(executor, {
    atualizacaoId: 2, momento: "ANTES", checksum: "hash-original",
    geradoEm: "2026-09-29T12:00:00Z", snapshot,
  });
  const chamada = executor.chamadas[0];
  assert.match(chamada.sql, /INSERT INTO public\.profor_2022_pad_snapshots/);
  assert.doesNotMatch(chamada.sql, /ON CONFLICT/);
  assert.equal(chamada.params[1], "ANTES");
  assert.equal(chamada.params[2], "hash-original");
  assert.equal(chamada.params[7], '{"planoAplicacao":[]}');
  assert.equal(chamada.params[8], "{}");
  assert.deepEqual(snapshot, { planoAplicacao: [] });
  assert.equal(inserido.id, 3);
  assert.equal(inserido.atualizacaoId, 2);
  assert.deepEqual(inserido.snapshot, snapshot);
  assert.deepEqual(inserido.resumo, { totalLinhas: 0 });
});

test("inserirAlteracoes vazio não executa SQL", async () => {
  const executor = executorFake();
  assert.deepEqual(await repository.inserirAlteracoes(executor, []), []);
  assert.equal(executor.chamadas.length, 0);
});

test("inserirAlteracoes faz um INSERT em lote e ignora conflito sem sobrescrever", async () => {
  const executor = executorFake([[{
    id: "11", atualizacao_id: "2", chave_alteracao: "chave-a", tipo: "ALTERADO",
    revisao_divergencia_id: "31", decisao_substituto_id: "32",
    campos_alterados_json: '["valorPrevisto"]', item_anterior_json: { valor: 1 },
    item_novo_json: { valor: 2 }, classificacao_estado: "PRESERVADA",
  }]]);
  const alteracoes = [
    { atualizacaoId: 2, chaveAlteracao: "chave-a", tipo: "ALTERADO",
      descricaoNova: "texto ' privado", classificacaoEstado: "PRESERVADA",
      revisaoDivergenciaId: 31, decisaoSubstitutoId: 32,
      camposAlterados: ["valorPrevisto"], itemAnterior: { valor: 1 }, itemNovo: { valor: 2 } },
    { atualizacaoId: 2, chaveAlteracao: "chave-b", tipo: "NOVO" },
  ];
  const inseridas = await repository.inserirAlteracoes(executor, alteracoes);
  assert.equal(executor.chamadas.length, 1);
  const chamada = executor.chamadas[0];
  assert.match(chamada.sql, /ON CONFLICT \(atualizacao_id, chave_alteracao\) DO NOTHING RETURNING \*/);
  assert.doesNotMatch(chamada.sql, /DO UPDATE|texto ' privado|chave-a/);
  assert.equal(chamada.params.length, 40);
  assert.equal(chamada.params[9], "texto ' privado");
  assert.equal(chamada.params[14], "PRESERVADA");
  assert.equal(chamada.params[18], '{"valor":1}');
  assert.equal(chamada.params[34], "NAO_APLICAVEL");
  assert.equal(chamada.params[37], "[]");
  assert.equal(inseridas.length, 1);
  assert.equal(inseridas[0].id, 11);
  assert.equal(inseridas[0].revisaoDivergenciaId, 31);
  assert.equal(inseridas[0].decisaoSubstitutoId, 32);
  assert.deepEqual(inseridas[0].camposAlterados, ["valorPrevisto"]);
});

test("buscarAtualizacaoPorId normaliza linha e retorna null quando ausente", async () => {
  const executor = executorFake([[{ id: "5", job_id: "job-5", metadados_json: '{}' }], []]);
  assert.equal((await repository.buscarAtualizacaoPorId(5, executor)).id, 5);
  assert.equal(await repository.buscarAtualizacaoPorId(6, executor), null);
  assert.deepEqual(executor.chamadas.map((c) => c.params), [[5], [6]]);
});

test("buscarAtualizacaoPorJobId usa a execução mais recente", async () => {
  const executor = executorFake([[{ id: "7", job_id: "job-7" }]]);
  const resultado = await repository.buscarAtualizacaoPorJobId("job-7", executor);
  assert.match(executor.chamadas[0].sql, /WHERE job_id = \$1 ORDER BY id DESC LIMIT 1/);
  assert.deepEqual(executor.chamadas[0].params, ["job-7"]);
  assert.equal(resultado.id, 7);
});

test("listarAtualizacoesPorMes agrega por dia no fuso de São Paulo", async () => {
  const executor = executorFake([[{
    data: "2026-09-29", total_execucoes: "3", com_alteracoes: "1",
    sem_alteracoes: "1", falhas: "1",
  }]]);
  const dias = await repository.listarAtualizacoesPorMes({ mes: "2026-09" }, executor);
  const chamada = executor.chamadas[0];
  assert.match(chamada.sql, /AT TIME ZONE 'America\/Sao_Paulo'/);
  assert.match(chamada.sql, /GROUP BY data ORDER BY data ASC/);
  assert.doesNotMatch(chamada.sql, /snapshot_json|item_anterior_json|item_novo_json/);
  assert.deepEqual(chamada.params, ["2026-09-01"]);
  assert.deepEqual(dias, [{
    data: "2026-09-29", totalExecucoes: 3, comAlteracoes: 1,
    semAlteracoes: 1, falhas: 1,
  }]);
});

test("listarAtualizacoesPorData sem filtros consulta só execuções", async () => {
  const executor = executorFake([[{ id: "1", status: "CONCLUIDA" }]]);
  const execucoes = await repository.listarAtualizacoesPorData({ data: "2026-09-29" }, executor);
  const chamada = executor.chamadas[0];
  assert.doesNotMatch(chamada.sql, /\bJOIN\b|\bEXISTS\b|snapshot_json|metadados_json/);
  assert.match(chamada.sql, /AT TIME ZONE 'America\/Sao_Paulo'/);
  assert.match(chamada.sql, /ORDER BY a\.iniciado_em DESC, a\.id DESC/);
  assert.deepEqual(chamada.params, ["2026-09-29"]);
  assert.equal(execucoes.length, 1);
  assert.equal(execucoes[0].id, 1);
});

test("listarAtualizacoesPorData aplica UF, convênio, tipo e ambas as áreas via EXISTS", async () => {
  const executor = executorFake([[]]);
  await repository.listarAtualizacoesPorData({
    data: "2026-09-29", uf: "RN", convenio: "123", tipo: "ALTERADO", area: "OUVIDORIA",
  }, executor);
  const chamada = executor.chamadas[0];
  assert.match(chamada.sql, /EXISTS \(SELECT 1 FROM public\.profor_2022_pad_alteracoes alt/);
  assert.match(chamada.sql, /alt\.atualizacao_id = a\.id/);
  assert.match(chamada.sql, /alt\.uf = \$2/);
  assert.match(chamada.sql, /alt\.numero_convenio = \$3/);
  assert.match(chamada.sql, /alt\.tipo = \$4/);
  assert.match(chamada.sql, /alt\.area_anterior = \$5 OR alt\.area_nova = \$5/);
  assert.doesNotMatch(chamada.sql, /\bJOIN\b|RN|OUVIDORIA/);
  assert.deepEqual(chamada.params, ["2026-09-29", "RN", "123", "ALTERADO", "OUVIDORIA"]);
});

test("buscarDetalheAtualizacao separa snapshots e não lê snapshot_json", async () => {
  const executor = executorFake([
    [{ id: "14", status: "CONCLUIDA", metadados_json: '{"lote":1}' }],
    [{ id: "17", atualizacao_id: "14", chave_alteracao: "a", tipo: "NOVO",
      classificacao_estado: "NAO_APLICAVEL", campos_alterados_json: [] }],
    [{ id: "18", atualizacao_id: "14", momento: "ANTES", checksum: "igual", resumo_json: { totalLinhas: 1 } },
      { id: "19", atualizacao_id: "14", momento: "DEPOIS", checksum: "igual", resumo_json: { totalLinhas: 1 } }],
  ]);
  const detalhe = await repository.buscarDetalheAtualizacao(14, executor);
  assert.equal(executor.chamadas.length, 3);
  assert.match(executor.chamadas[1].sql, /ORDER BY tipo, numero_convenio, uf, id/);
  assert.match(executor.chamadas[2].sql, /resumo_json/);
  assert.doesNotMatch(executor.chamadas[2].sql, /snapshot_json/);
  assert.equal(detalhe.atualizacao.id, 14);
  assert.deepEqual(detalhe.atualizacao.metadados, { lote: 1 });
  assert.equal(detalhe.alteracoes[0].id, 17);
  assert.equal(detalhe.snapshots.antes.id, 18);
  assert.equal(detalhe.snapshots.depois.id, 19);
  assert.equal(detalhe.snapshots.antes.checksum, detalhe.snapshots.depois.checksum);
  assert.equal(Object.hasOwn(detalhe.snapshots.antes, "snapshot"), false);
});

test("buscarDetalheAtualizacao ausente encerra após uma consulta", async () => {
  const executor = executorFake([[]]);
  assert.equal(await repository.buscarDetalheAtualizacao(404, executor), null);
  assert.equal(executor.chamadas.length, 1);
});

test("executor explícito é usado e executor inválido falha claramente", async () => {
  const original = postgresClient.query;
  postgresClient.query = async () => { throw new Error("Pool não deveria ser usado"); };
  try {
    const executor = executorFake([[{ id: "1" }]]);
    assert.equal((await repository.buscarAtualizacaoPorId(1, executor)).id, 1);
    assert.equal(executor.chamadas.length, 1);
    await assert.rejects(repository.buscarAtualizacaoPorId(1, {}), TypeError);
  } finally {
    postgresClient.query = original;
  }
});

test("sem executor usa postgresClient.query sem exigir DATABASE_URL no teste", async () => {
  const original = postgresClient.query;
  const chamadas = [];
  postgresClient.query = async (sql, params) => {
    chamadas.push({ sql, params });
    return { rows: [{ id: "6", job_id: "padrao" }] };
  };
  try {
    assert.equal((await repository.buscarAtualizacaoPorId(6)).id, 6);
    assert.deepEqual(chamadas[0].params, [6]);
  } finally {
    postgresClient.query = original;
  }
});

test("memória consulta rateios ativos e divergências em lote por chave exata", async () => {
  const executor = executorFake([
    [{ id: "3", chave_item: "pad-1", area: "OUVIDORIA", natureza: "CAPITAL" }],
    [{ id: "4", chave_item: "pad-2", status: "PENDENTE", payload_json: '{"a":1}' }],
  ]);
  const rateios = await repository.listarRateiosAtivosPorChavesItem(["pad-1", "pad-1"], executor);
  const divergencias = await repository.listarDivergenciasPorChavesItem(["pad-2"], executor);
  assert.deepEqual(executor.chamadas.map((c) => c.params), [[["pad-1"]], [["pad-2"]]]);
  assert.match(executor.chamadas[0].sql, /ativo = true AND chave_item = ANY\(\$1::text\[\]\)/);
  assert.match(executor.chamadas[1].sql, /chave_item = ANY\(\$1::text\[\]\)/);
  assert.equal(rateios[0].area, "OUVIDORIA");
  assert.equal(divergencias[0].id, 4);
  assert.deepEqual(divergencias[0].payload, { a: 1 });
});

test("vínculos consultam apenas decisão mais recente, efetiva e explícita", async () => {
  const executor = executorFake([[{
    decisao_id: "9", divergencia_ausente_id: "7", decisao: "CORRIGIDO",
    chave_item_ausente: "pad-antigo", status_divergencia_ausente: "CORRIGIDO",
    payload_decisao_json: { tipoSaneamento: "vinculo_item_substituto", divergenciaAusenteId: 7, divergenciaSubstitutaId: 8 },
  }]]);
  const vinculos = await repository.listarVinculosSubstitutoPorDivergenciasSubstitutas([8, 8], executor);
  assert.deepEqual(executor.chamadas[0].params, [["8"]]);
  assert.match(executor.chamadas[0].sql, /SELECT MAX\(ultima\.id\)/);
  assert.match(executor.chamadas[0].sql, /aus\.status IN \('ACEITO', 'CORRIGIDO', 'APLICADO'\)/);
  assert.match(executor.chamadas[0].sql, /tipoSaneamento.*vinculo_item_substituto/);
  assert.equal(vinculos[0].divergenciaSubstitutaId, 8);
  assert.equal(vinculos[0].chaveItemAusente, "pad-antigo");
});

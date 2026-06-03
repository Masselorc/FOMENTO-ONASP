/**
 * Testes unitarios para as pendencias residuais de auditoria/logs:
 * - Historico por item FAF 2021
 * - Logs PAD (decisao registrada, rateio e area atualizados)
 * - Tipos novos em logs-operacionais-service
 * - Filtros tela Sistema/Logs
 *
 * Todos os testes mockam postgres-client diretamente. Nenhuma integracao real
 * e executada. Nenhum dado e alterado.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const postgresClient = require("../../backend/db/postgres-client");
const logsService = require("../../backend/services/logs-operacionais-service");
const revisaoRepo = require("../../backend/services/profor-2022/profor-pad-revisao-repository");
const decisaoService = require("../../backend/services/profor-2022/profor-pad-revisao-decisao-service");
const revisoesPlanoDecisoesService = require("../../backend/services/profor-2022/profor-pad-revisoes-plano-decisoes-service");

const queryOriginal = postgresClient.query;
const withTransactionOriginal = postgresClient.withTransaction;
const registrarLogOperacionalOriginal = logsService.registrarLogOperacional;
const buscarDivergenciaPorIdOriginal = revisaoRepo.buscarDivergenciaPorId;
const registrarDecisaoRepoOriginal = revisaoRepo.registrarDecisao;

test.afterEach(() => {
  postgresClient.query = queryOriginal;
  postgresClient.withTransaction = withTransactionOriginal;
  logsService.registrarLogOperacional = registrarLogOperacionalOriginal;
  revisaoRepo.buscarDivergenciaPorId = buscarDivergenciaPorIdOriginal;
  revisaoRepo.registrarDecisao = registrarDecisaoRepoOriginal;
});

// ---------------------------------------------------------------------------
// Logs operacionais: tipos PAD novos
// ---------------------------------------------------------------------------

test("logs-operacionais aceita tipo profor_pad_revisao_decisao_registrada", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_pad_revisao_decisao_registrada"));
});

test("logs-operacionais aceita tipo profor_pad_revisao_rateio_atualizado", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_pad_revisao_rateio_atualizado"));
});

test("logs-operacionais aceita tipo profor_pad_revisao_area_atualizada", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_pad_revisao_area_atualizada"));
});

test("logs-operacionais mantem tipos da Prioridade 3", () => {
  const tiposP3 = [
    "profor_pad_recarga_operacional_inicio",
    "profor_pad_recarga_operacional_sucesso",
    "profor_pad_recarga_operacional_erro",
    "profor_pad_transferegov_atualizacao_inicio",
    "profor_pad_transferegov_atualizacao_sucesso",
    "profor_pad_transferegov_atualizacao_erro",
    "profor_detru_atualizacao_inicio",
    "profor_detru_atualizacao_sucesso",
    "profor_detru_atualizacao_erro",
    "profor_rendimentos_atualizacao_inicio",
    "profor_rendimentos_atualizacao_sucesso",
    "profor_rendimentos_atualizacao_erro",
    "publicacao_estatica_inicio",
    "publicacao_estatica_sucesso",
    "publicacao_estatica_erro",
  ];
  for (const tipo of tiposP3) {
    assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has(tipo), `tipo ausente: ${tipo}`);
  }
});

test("logs-operacionais sanitizarPayloadLog nao expoe database_url ou segredo", () => {
  const resultado = logsService.sanitizarPayloadLog({
    divergenciaId: 1,
    decisao: "ACEITO",
    database_url: "postgres://usuario:segredo@host/db",
    password: "abc123",
    token: "bearer-xyz",
  });
  assert.equal(resultado.database_url, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(resultado.password, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(resultado.token, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(resultado.divergenciaId, 1);
  assert.equal(resultado.decisao, "ACEITO");
});

// ---------------------------------------------------------------------------
// Historico FAF 2021
// ---------------------------------------------------------------------------
const { listarHistoricoFaf2021, obterIndiceItemFaf2021 } =
  require("../../backend/services/faf-2021-service");

test("listarHistoricoFaf2021 rejeita itemId com prefixo invalido", async () => {
  await assert.rejects(
    () => listarHistoricoFaf2021("idx_invalido"),
    /inválido/i
  );
});

test("listarHistoricoFaf2021 rejeita itemId vazio", async () => {
  await assert.rejects(
    () => listarHistoricoFaf2021(""),
    /inválido/i
  );
});

test("listarHistoricoFaf2021 consulta pagina faf-2021 e registro correto", async () => {
  let queryCapturada = null;
  let paramsCapturados = null;
  postgresClient.query = async (sql, params) => {
    queryCapturada = sql;
    paramsCapturados = params;
    return {
      rows: [
        { campo: "valor_executado", valor_anterior: "50.25", valor_novo: "180.00", alterado_em: "2026-06-01T10:00:00.000Z" },
        { campo: "observacao_execucao", valor_anterior: "", valor_novo: "Nova obs", alterado_em: "2026-06-01T09:00:00.000Z" },
      ],
    };
  };

  const resultado = await listarHistoricoFaf2021("faf2021_idx_10");

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].campo, "valor_executado");
  assert.equal(resultado[0].valorAnterior, "50.25");
  assert.equal(resultado[0].valorNovo, "180.00");
  assert.equal(paramsCapturados[0], "faf-2021");
  assert.equal(paramsCapturados[1], "faf2021_idx_10");
});

test("listarHistoricoFaf2021 nao altera dados (somente SELECT)", async () => {
  let sqlExecutado = "";
  postgresClient.query = async (sql) => {
    sqlExecutado = sql;
    return { rows: [] };
  };

  await listarHistoricoFaf2021("faf2021_idx_5");

  assert.match(sqlExecutado, /SELECT/i);
  assert.doesNotMatch(sqlExecutado, /INSERT|UPDATE|DELETE/i);
});

test("listarHistoricoFaf2021 aplica limite padrao 100", async () => {
  let limitePassado = null;
  postgresClient.query = async (_sql, params) => {
    limitePassado = params[2];
    return { rows: [] };
  };

  await listarHistoricoFaf2021("faf2021_idx_0");

  assert.equal(limitePassado, 100);
});

test("listarHistoricoFaf2021 aceita limite customizado ate 500", async () => {
  let limitePassado = null;
  postgresClient.query = async (_sql, params) => {
    limitePassado = params[2];
    return { rows: [] };
  };

  await listarHistoricoFaf2021("faf2021_idx_0", { limite: 50 });
  assert.equal(limitePassado, 50);

  // Acima de 500 deve ser capped em 500.
  await listarHistoricoFaf2021("faf2021_idx_0", { limite: 9999 });
  assert.equal(limitePassado, 500);
});

// ---------------------------------------------------------------------------
// Logs PAD: decisao registrada (mock via postgresClient)
// ---------------------------------------------------------------------------

test("profor_pad_revisao_decisao_registrada aparece no filtro frontend", () => {
  const fonte = fs.readFileSync(
    path.resolve(__dirname, "../../frontend/js/app.js"), "utf8"
  );
  assert.ok(fonte.includes("profor_pad_revisao_decisao_registrada"));
  assert.ok(fonte.includes("profor_pad_revisao_rateio_atualizado"));
  assert.ok(fonte.includes("profor_pad_revisao_area_atualizada"));
});

test("Prioridade 3: todos os 15 tipos de execucao operacional nos filtros frontend", () => {
  const fonte = fs.readFileSync(
    path.resolve(__dirname, "../../frontend/js/app.js"), "utf8"
  );
  const tipos = [
    "profor_pad_recarga_operacional_inicio",
    "profor_pad_recarga_operacional_sucesso",
    "profor_pad_recarga_operacional_erro",
    "profor_pad_transferegov_atualizacao_inicio",
    "profor_pad_transferegov_atualizacao_sucesso",
    "profor_pad_transferegov_atualizacao_erro",
    "profor_detru_atualizacao_inicio",
    "profor_detru_atualizacao_sucesso",
    "profor_detru_atualizacao_erro",
    "profor_rendimentos_atualizacao_inicio",
    "profor_rendimentos_atualizacao_sucesso",
    "profor_rendimentos_atualizacao_erro",
    "publicacao_estatica_inicio",
    "publicacao_estatica_sucesso",
    "publicacao_estatica_erro",
  ];
  for (const tipo of tipos) {
    assert.ok(fonte.includes(tipo), `tipo ausente no frontend: ${tipo}`);
  }
});

test("registrarDecisao gera log operacional resumido sem bloquear decisao", async () => {
  const logs = [];
  logsService.registrarLogOperacional = async (entrada) => {
    logs.push(entrada);
    return { id: 1 };
  };
  revisaoRepo.buscarDivergenciaPorId = async () => ({
    id: 77,
    chave_divergencia: "AM::CONV::OBJETO",
    tipo_alerta: "VALOR_DIVERGENTE",
    campo_afetado: "valor_total",
    uf: "AM",
    payload_json: JSON.stringify({ quantidade: 1, valorTotal: 100 }),
  });
  revisaoRepo.registrarDecisao = async ({ decisao, novoStatus }) => ({
    decisaoId: 901,
    statusAnterior: "PENDENTE",
    statusNovo: novoStatus,
    decididoEm: "2026-06-03T10:00:00.000Z",
    decisao,
  });

  const resultado = await decisaoService.registrarDecisao(77, {
    decisao: "ACEITO",
    justificativa: "Teste unitario",
    usuario: "teste",
  });

  assert.equal(resultado.aplicadaAoPlano, false);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "profor_pad_revisao_decisao_registrada");
  assert.equal(logs[0].modulo, "profor-2022");
  assert.equal(logs[0].status, "sucesso");
  assert.deepEqual(Object.keys(logs[0].payload).sort(), [
    "chaveDivergencia",
    "decididoEm",
    "decisao",
    "divergenciaId",
    "origem",
    "statusAnterior",
    "statusNovo",
    "tipoAlerta",
    "uf",
  ].sort());
});

function montarDadosRevisaoPlano() {
  return {
    ufs: ["AM"],
    linhasMae: {
      AM: [{
        id: "mae-1",
        uf: "AM",
        numeroConvenio: "123",
        descricao: "Item de teste",
        chaveItem: "123::item-de-teste",
        natureza: "CAPITAL",
        codigoNatureza: "4490",
        quantidadeOriginal: 10,
        valorUnitario: 5,
      }],
    },
    linhasFilhas: {
      AM: [
        { id: "filha-1", parentId: "mae-1", area: "NAO_CLASSIFICADO", quantidade: 10 },
      ],
    },
  };
}

test("salvarAreaRevisaoPlano gera log operacional resumido sem regerar/publicar em teste", async () => {
  const logs = [];
  logsService.registrarLogOperacional = async (entrada) => {
    logs.push(entrada);
    return { id: 2 };
  };

  const resultado = await revisoesPlanoDecisoesService.salvarAreaRevisaoPlano({
    parentId: "mae-1",
    linhaFilhaId: "filha-1",
    areaNova: "OUVIDORIA",
  }, {
    carregarRevisoesPlano: montarDadosRevisaoPlano,
    persistirRateiosOperacionais: async () => 55,
    pularRegerarRecarga: true,
  });

  assert.equal(resultado.statusGrupo, "AREA_ALTERADA");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "profor_pad_revisao_area_atualizada");
  assert.equal(logs[0].payload.itemConhecidoId, 55);
  assert.equal(logs[0].payload.areaNova, "OUVIDORIA");
  assert.equal(logs[0].payload.origem, "interface");
});

test("salvarRateioRevisaoPlano gera log operacional resumido sem regerar/publicar em teste", async () => {
  const logs = [];
  logsService.registrarLogOperacional = async (entrada) => {
    logs.push(entrada);
    return { id: 3 };
  };

  const resultado = await revisoesPlanoDecisoesService.salvarRateioRevisaoPlano({
    parentId: "mae-1",
    linhas: [
      { area: "OUVIDORIA", quantidade: 4 },
      { area: "CORREGEDORIA", quantidade: 6 },
    ],
  }, {
    carregarRevisoesPlano: montarDadosRevisaoPlano,
    persistirRateiosOperacionais: async () => 56,
    pularRegerarRecarga: true,
  });

  assert.equal(resultado.statusGrupo, "RATEIO_ALTERADO");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "profor_pad_revisao_rateio_atualizado");
  assert.equal(logs[0].payload.itemConhecidoId, 56);
  assert.equal(logs[0].payload.totalLinhas, 2);
  assert.equal(logs[0].payload.origem, "interface");
});

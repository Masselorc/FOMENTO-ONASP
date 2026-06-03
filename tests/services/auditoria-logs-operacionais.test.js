/**
 * Testes unitarios para a Prioridade 1 de auditoria:
 * - FAF 2021: historico por campo + log operacional
 * - Convenios Monitorados: criacao/edicao/inativacao
 * - Logs operacionais: novos modulos e tipos de evento
 *
 * Os mocks substituem propriedades nos objetos de modulo exportados:
 * - postgresClient.query / withTransaction  -> intercepta queries de negocio
 * - historicoService.registrarHistoricoPostgres -> intercepta historico
 * - logsOperacionaisService.registrarLogOperacional -> intercepta logs
 *
 * Nao dependem de banco real.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ONASP_EDIT_PASSWORD = "senha-correta-testes";

const postgresClient = require("../../backend/db/postgres-client");
const historicoService = require("../../backend/services/historico-service");
const logsService = require("../../backend/services/logs-operacionais-service");

const queryOriginal = postgresClient.query;
const withTransactionOriginal = postgresClient.withTransaction;
const registrarHistoricoOriginal = historicoService.registrarHistoricoPostgres;
const registrarLogOriginal = logsService.registrarLogOperacional;

test.afterEach(() => {
  postgresClient.query = queryOriginal;
  postgresClient.withTransaction = withTransactionOriginal;
  historicoService.registrarHistoricoPostgres = registrarHistoricoOriginal;
  logsService.registrarLogOperacional = registrarLogOriginal;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linhaBaseFaf(overrides = {}) {
  return {
    item_id: "faf2021_idx_10",
    indice_dados_base: 10,
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    quantidade: "2.00",
    valor_unitario: "100.50",
    valor_total: "201.00",
    valor_executado: "50.25",
    observacao_execucao: "Execucao parcial",
    atualizado_em: "2026-01-02T03:04:05.000Z",
    instrumento: "FAF 2021",
    ...overrides,
  };
}

function instalarMockFaf({ item = linhaBaseFaf(), updateDate = "2026-02-03T04:05:06.000Z" } = {}) {
  const historicos = [];
  const logs = [];

  historicoService.registrarHistoricoPostgres = async (_client, args) => {
    historicos.push({ ...args });
  };

  logsService.registrarLogOperacional = async (log) => {
    logs.push({ ...log });
    return { id: 1 };
  };

  postgresClient.withTransaction = async (callback) => {
    const client = {
      async query(sql) {
        if (/SELECT\s+item_id/i.test(sql)) return { rows: item ? [item] : [] };
        if (/UPDATE\s+faf_2021_itens/i.test(sql)) return { rows: [{ atualizado_em: updateDate }] };
        throw new Error(`SQL inesperado no mock FAF: ${sql}`);
      },
    };
    return callback(client);
  };

  return { historicos, logs };
}

const linhaConvenio = {
  id: 42,
  numero_convenio: "937221",
  ano: "2022",
  uf: "AL",
  instrumento: "Convenio",
  programa_origem: "PROFOR 2022",
  ativo: true,
  id_convenio_transferegov: null,
  observacao: null,
  criado_em: "2026-01-01T00:00:00.000Z",
  atualizado_em: "2026-01-01T00:00:00.000Z",
};

function instalarMockConvenio({ anterior = linhaConvenio, posOperacao = linhaConvenio } = {}) {
  const historicos = [];
  const logs = [];

  historicoService.registrarHistoricoPostgres = async (_client, args) => {
    historicos.push({ ...args });
  };

  logsService.registrarLogOperacional = async (log) => {
    logs.push({ ...log });
    return { id: 1 };
  };

  // Mock de query global para leituras fora da transacao (busca do anterior e listar).
  postgresClient.query = async (sql) => {
    if (/SELECT \* FROM profor_convenios_monitorados/i.test(sql) ||
        /SELECT\s+\*\s+FROM\s+profor_convenios_monitorados/i.test(sql)) {
      return { rows: [anterior] };
    }
    throw new Error(`postgresClient.query inesperado: ${sql}`);
  };

  postgresClient.withTransaction = async (callback) => {
    const client = {
      async query(sql) {
        if (/INSERT\s+INTO\s+profor_convenios_monitorados/i.test(sql)) return { rows: [{ id: 42 }] };
        if (/UPDATE\s+profor_convenios_monitorados/i.test(sql)) return { rows: [] };
        if (/SELECT \* FROM profor_convenios_monitorados/i.test(sql) ||
            /SELECT\s+\*\s+FROM\s+profor_convenios_monitorados/i.test(sql)) {
          return { rows: [posOperacao] };
        }
        throw new Error(`client.query inesperado no mock Convenios: ${sql}`);
      },
    };
    return callback(client);
  };

  return { historicos, logs };
}

// ---------------------------------------------------------------------------
// LOGS OPERACIONAIS: novos modulos e tipos de evento
// ---------------------------------------------------------------------------

test("logs-operacionais aceita modulo faf-2021", () => {
  assert.ok(logsService.MODULOS_PERMITIDOS.has("faf-2021"));
});

test("logs-operacionais aceita tipo faf_2021_edicao", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("faf_2021_edicao"));
});

test("logs-operacionais aceita tipos de convenio monitorado", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_convenio_monitorado_criacao"));
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_convenio_monitorado_edicao"));
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_convenio_monitorado_inativacao"));
});

test("logs-operacionais mantem tipos antigos", () => {
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_atualizacao_consolidada"));
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_publicacao_estatica"));
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_detru"));
  assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has("profor_rendimentos_transferegov"));
});

test("sanitizarPayloadLog remove password do objeto", () => {
  const r = logsService.sanitizarPayloadLog({ itemId: "x", password: "abc123" });
  assert.equal(r.password, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(r.itemId, "x");
});

test("sanitizarPayloadLog remove senha do objeto", () => {
  const r = logsService.sanitizarPayloadLog({ campo: "ok", senha: "segredo" });
  assert.equal(r.senha, "[REMOVIDO_POR_SANITIZACAO]");
});

test("sanitizarPayloadLog remove token do objeto", () => {
  const r = logsService.sanitizarPayloadLog({ token: "bearer-xyz", dado: "ok" });
  assert.equal(r.token, "[REMOVIDO_POR_SANITIZACAO]");
  assert.equal(r.dado, "ok");
});

// ---------------------------------------------------------------------------
// FAF 2021: historico por campo
// ---------------------------------------------------------------------------
const fafService = require("../../backend/services/faf-2021-service");

test("salvarExecucaoFaf2021 registra historico quando quantidade muda", async () => {
  const { historicos } = instalarMockFaf();

  await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    quantidade: 5,
    valorUnitario: 100.5,
    valorExecutado: 50.25,
  });

  const h = historicos.find((x) => x.campo === "quantidade");
  assert.ok(h, "Esperava historico de quantidade");
  assert.equal(h.pagina, "faf-2021");
  assert.equal(h.registro, "faf2021_idx_10");
  assert.equal(Number(h.valorAnterior), 2);
  assert.equal(Number(h.valorNovo), 5);
});

test("salvarExecucaoFaf2021 registra historico de valor_executado", async () => {
  const { historicos } = instalarMockFaf();

  await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 180,
  });

  const h = historicos.find((x) => x.campo === "valor_executado");
  assert.ok(h, "Esperava historico de valor_executado");
  assert.equal(Number(h.valorAnterior), 50.25);
  assert.equal(Number(h.valorNovo), 180);
});

test("salvarExecucaoFaf2021 aceita valorExecutado maior que valorTotal", async () => {
  instalarMockFaf();

  const resultado = await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 500,
  });

  assert.equal(resultado.success, true);
  assert.equal(resultado.valorTotal, 201);
  assert.equal(resultado.valorExecutado, 500);
  assert.ok(resultado.percentualExecutado > 100);
});

test("salvarExecucaoFaf2021 nao inclui password no log operacional", async () => {
  const { logs } = instalarMockFaf();

  await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 200,
  });

  assert.ok(logs.length > 0, "Log deve ter sido registrado");
  const payload = logs[0].payload || {};
  assert.ok(!("password" in payload), "password nao deve aparecer no payload do log");
  assert.ok(!("senha" in payload), "senha nao deve aparecer no payload do log");
});

test("salvarExecucaoFaf2021 chama log operacional com tipo faf_2021_edicao", async () => {
  const { logs } = instalarMockFaf();

  await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 200,
  });

  assert.ok(logs.length > 0, "Log operacional deve ter sido chamado");
  assert.equal(logs[0].modulo, "faf-2021");
  assert.equal(logs[0].tipoEvento, "faf_2021_edicao");
  assert.equal(logs[0].status, "sucesso");
  assert.ok(logs[0].payload.camposAlterados.includes("valor_executado"));
});

test("salvarExecucaoFaf2021 nao registra log quando sem alteracao efetiva", async () => {
  const { logs } = instalarMockFaf({
    item: linhaBaseFaf({ quantidade: "2.00", valor_unitario: "100.50", valor_total: "201.00", valor_executado: "50.25" }),
  });

  const resultado = await fafService.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    quantidade: 2,
    valorUnitario: 100.5,
    valorExecutado: 50.25,
  });

  assert.equal(resultado.success, true);
  assert.equal(logs.length, 0, "Log nao deve ser chamado sem alteracao efetiva");
  assert.deepEqual(resultado.camposAlterados, []);
});

// ---------------------------------------------------------------------------
// CONVENIOS MONITORADOS
// ---------------------------------------------------------------------------
const { criarConvenioMonitorado, atualizarConvenioMonitorado, inativarConvenioMonitorado } =
  require("../../backend/services/profor-2022/convenios-monitorados-service");

test("criarConvenioMonitorado registra historico de criacao", async () => {
  const { historicos } = instalarMockConvenio();

  await criarConvenioMonitorado({ numero_convenio: "937221", ano: "2022", uf: "AL" });

  assert.equal(historicos.length, 1);
  assert.equal(historicos[0].campo, "criacao");
  assert.equal(historicos[0].pagina, "profor-2022-convenios-monitorados");
  assert.equal(historicos[0].valorAnterior, "");
  assert.ok(historicos[0].valorNovo.includes("937221"));
});

test("criarConvenioMonitorado registra log operacional com tipo criacao", async () => {
  const { logs } = instalarMockConvenio();

  await criarConvenioMonitorado({ numero_convenio: "937221", ano: "2022", uf: "AL" });

  assert.ok(logs.length > 0, "Log deve ter sido chamado");
  assert.equal(logs[0].tipoEvento, "profor_convenio_monitorado_criacao");
  assert.equal(logs[0].status, "sucesso");
  const payload = logs[0].payload || {};
  assert.ok(!("password" in payload));
});

test("atualizarConvenioMonitorado registra historico apenas de campos alterados", async () => {
  const { historicos } = instalarMockConvenio({
    anterior: linhaConvenio,
    posOperacao: { ...linhaConvenio, uf: "AC" },
  });

  await atualizarConvenioMonitorado(42, { uf: "AC" });

  assert.equal(historicos.length, 1);
  assert.equal(historicos[0].campo, "uf");
  assert.equal(historicos[0].valorAnterior, "AL");
  assert.equal(historicos[0].valorNovo, "AC");
});

test("atualizarConvenioMonitorado nao gera log quando nada muda", async () => {
  const { logs } = instalarMockConvenio({
    anterior: linhaConvenio,
    posOperacao: linhaConvenio,
  });

  await atualizarConvenioMonitorado(42, { uf: "AL" });

  assert.equal(logs.length, 0, "Log nao deve ser chamado quando nenhum campo muda");
});

test("inativarConvenioMonitorado registra historico de ativo false", async () => {
  const { historicos } = instalarMockConvenio({
    anterior: linhaConvenio,
    posOperacao: { ...linhaConvenio, ativo: false },
  });

  await inativarConvenioMonitorado(42);

  assert.equal(historicos.length, 1);
  assert.equal(historicos[0].campo, "ativo");
  assert.equal(historicos[0].valorAnterior, "true");
  assert.equal(historicos[0].valorNovo, "false");
});

test("inativarConvenioMonitorado registra log com tipo inativacao", async () => {
  const { logs } = instalarMockConvenio({
    anterior: linhaConvenio,
    posOperacao: { ...linhaConvenio, ativo: false },
  });

  await inativarConvenioMonitorado(42);

  assert.ok(logs.length > 0, "Log deve ter sido chamado");
  assert.equal(logs[0].tipoEvento, "profor_convenio_monitorado_inativacao");
  assert.equal(logs[0].status, "sucesso");
  const payload = logs[0].payload || {};
  assert.equal(payload.ativoAnterior, true);
  assert.equal(payload.ativoNovo, false);
  assert.ok(!("password" in payload));
});

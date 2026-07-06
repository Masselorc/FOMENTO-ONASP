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

test("logs-operacionais aceita tipos de historico existente", () => {
  [
    "parametros_minimos_edicao",
    "formalizacao_profor_edicao",
    "orcamento_2026_edicao",
    "orcamento_2026_criacao_processo_vinculado",
    "orcamento_2026_inativacao",
    "orcamento_2026_alocacao_saldo",
  ].forEach((tipo) => {
    assert.ok(logsService.TIPOS_EVENTO_PERMITIDOS.has(tipo), `Tipo ausente: ${tipo}`);
  });
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

function recarregarServico(caminho) {
  delete require.cache[require.resolve(caminho)];
  return require(caminho);
}

function instalarMockParametros({ anterior = { status: "PENDENTE", quantidade_atual: null, quantidade_ideal: null }, falhaLog = false } = {}) {
  const historicos = [];
  const logs = [];

  historicoService.registrarHistoricoPostgres = async (_client, args) => {
    historicos.push({ ...args });
  };
  logsService.registrarLogOperacional = async (log) => {
    logs.push({ ...log });
    if (falhaLog) throw new Error("falha simulada de log");
    return { id: 1 };
  };
  postgresClient.withTransaction = async (callback) => callback({
    async query(sql) {
      if (/SELECT status, quantidade_atual, quantidade_ideal FROM parametros_minimos/i.test(sql)) {
        return { rows: anterior ? [anterior] : [] };
      }
      if (/INSERT INTO parametros_minimos/i.test(sql)) return { rows: [] };
      throw new Error(`SQL inesperado no mock Parametros: ${sql}`);
    },
  });

  const service = recarregarServico("../../backend/services/parametros-minimos-service");
  return { service, historicos, logs };
}

function instalarMockFormalizacao({ anterior = { status: "PENDENTE", observacao: "" } } = {}) {
  const historicos = [];
  const logs = [];

  historicoService.registrarHistoricoPostgres = async (_client, args) => {
    historicos.push({ ...args });
  };
  logsService.registrarLogOperacional = async (log) => {
    logs.push({ ...log });
    return { id: 1 };
  };
  postgresClient.query = async (sql) => {
    if (/SELECT COUNT\(\*\)::int AS total FROM formalizacao_profor/i.test(sql)) {
      return { rows: [{ total: 1 }] };
    }
    throw new Error(`postgresClient.query inesperado no mock Formalizacao: ${sql}`);
  };
  postgresClient.withTransaction = async (callback) => callback({
    async query(sql) {
      if (/SELECT status, observacao FROM formalizacao_profor/i.test(sql)) return { rows: anterior ? [anterior] : [] };
      if (/INSERT INTO formalizacao_profor/i.test(sql)) return { rows: [] };
      throw new Error(`SQL inesperado no mock Formalizacao: ${sql}`);
    },
  });

  const service = recarregarServico("../../backend/services/formalizacao-profor-service");
  return { service, historicos, logs };
}

const linhaOrcamento = {
  id: "ITEM-1",
  categoria: "Aparelhamento",
  descricao: "Item teste",
  acao_orcamentaria: "",
  plano_orcamentario: "",
  natureza: "449052",
  valor_previsto: 1000,
  valor_disponibilizado: 0,
  valor_empenhado: 0,
  valor_executado: 0,
  valor_estimado_pesquisa_preco: 0,
  processo_autuado: false,
  pena_justa: false,
  processo_sei: "",
  status: "PLANEJADO",
  setor_atual: "",
  responsavel_atual: "",
  data_entrada_setor: "",
  pendencia_atual: "",
  observacao: "",
  compoe_orcamento: true,
  processo_pai_id: "",
  tipo_processo: "PRINCIPAL",
  origem_recurso_id: "",
  ordem_exibicao: 1,
  valor_alocado_origem: 0,
  classificacao_gerencial: "APARELHAMENTO",
  ativo: true,
  tipo_rastreio: "GERAL",
};

function instalarMockOrcamento({ linhas = [linhaOrcamento], falhaLog = false } = {}) {
  const historicos = [];
  const logs = [];
  const updates = [];

  historicoService.registrarHistoricoPostgres = async (_client, args) => {
    historicos.push({ ...args });
  };
  logsService.registrarLogOperacional = async (log) => {
    logs.push({ ...log });
    if (falhaLog) throw new Error("falha simulada de log");
    return { id: 1 };
  };
  postgresClient.query = async (sql, params = []) => {
    if (/ALTER TABLE orcamento_2026 ADD COLUMN IF NOT EXISTS pena_justa/i.test(sql)) return { rows: [] };
    if (/CREATE TABLE IF NOT EXISTS orcamento_2026_frentes/i.test(sql)) return { rows: [] };
    if (/SELECT frente, valor_disponivel, atualizado_em\s+FROM orcamento_2026_frentes/i.test(sql)) return { rows: [] };
    if (/SELECT valor_disponivel FROM orcamento_2026_frentes WHERE frente = \$1/i.test(sql)) {
      return { rows: params[0] === "Aparelhamento" ? [{ valor_disponivel: 1000 }] : [] };
    }
    if (/SELECT \* FROM orcamento_2026_movimentacoes WHERE ativo = true/i.test(sql)) return { rows: [] };
    if (/SELECT \* FROM orcamento_2026/i.test(sql)) return { rows: linhas };
    if (/SELECT id, status, processo_autuado/i.test(sql)) return { rows: [] };
    if (/SELECT id, classificacao_gerencial/i.test(sql)) return { rows: [] };
    throw new Error(`postgresClient.query inesperado no mock Orcamento: ${sql}`);
  };
  postgresClient.withTransaction = async (callback) => callback({
    async query(sql, params = []) {
      if (/SELECT id, processo_sei FROM orcamento_2026 WHERE ativo = true/i.test(sql)) {
        return {
          rows: linhas
            .filter((linha) => linha.ativo !== false)
            .map((linha) => ({ id: linha.id, processo_sei: linha.processo_sei }))
        };
      }
      if (/SELECT \* FROM orcamento_2026 WHERE id = \$1/i.test(sql)) {
        const id = String(params[0] || "");
        return { rows: linhas.filter((linha) => String(linha.id) === id) };
      }
      if (/INSERT INTO orcamento_2026_movimentacoes/i.test(sql)) return { rows: [{ id: 77 }] };
      if (/INSERT INTO orcamento_2026_frentes/i.test(sql)) {
        updates.push({ sql, params });
        return { rows: [] };
      }
      if (/INSERT INTO orcamento_2026/i.test(sql) || /UPDATE orcamento_2026/i.test(sql)) {
        updates.push({ sql, params });
        return { rows: [] };
      }
      throw new Error(`SQL inesperado no mock Orcamento: ${sql}`);
    },
  });

  const service = recarregarServico("../../backend/services/orcamento-2026-service");
  return { service, historicos, logs, updates };
}

test("salvarParametrosMinimos registra log operacional resumido sem senha", async () => {
  const { service, logs } = instalarMockParametros();

  const resultado = await service.salvarParametrosMinimos({
    password: "senha-correta-testes",
    changes: { AC: { atoNormativoEspecifico: "ATENDE" } },
  });

  assert.equal(resultado.success, true);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "parametros_minimos_edicao");
  assert.equal(logs[0].modulo, "sistema");
  assert.deepEqual(logs[0].payload.camposAlterados, ["atoNormativoEspecifico"]);
  assert.ok(!("password" in logs[0].payload));
  assert.ok(!("senha" in logs[0].payload));
});

test("salvarParametrosMinimos nao quebra salvamento quando log falha", async () => {
  const warnOriginal = console.warn;
  console.warn = () => {};
  try {
    const { service } = instalarMockParametros({ falhaLog: true });
    const resultado = await service.salvarParametrosMinimos({
      password: "senha-correta-testes",
      changes: { AC: { atoNormativoEspecifico: "ATENDE" } },
    });
    assert.equal(resultado.success, true);
  } finally {
    console.warn = warnOriginal;
  }
});

test("salvarFormalizacaoProfor preserva historico e registra log operacional", async () => {
  const { service, historicos, logs } = instalarMockFormalizacao();

  const resultado = await service.salvarFormalizacaoProfor({
    password: "senha-correta-testes",
    changes: { AM: { propostaCadastrada: { status: "CONCLUÍDO", observacao: "ok" } } },
  });

  assert.equal(resultado.success, true);
  assert.ok(historicos.some((h) => h.campo === "propostaCadastrada"));
  assert.ok(historicos.some((h) => h.campo === "propostaCadastrada.observacao"));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "formalizacao_profor_edicao");
  assert.equal(logs[0].modulo, "profor-2022");
  assert.ok(logs[0].payload.camposAlterados.includes("propostaCadastrada"));
  assert.ok(logs[0].payload.camposAlterados.includes("propostaCadastrada.observacao"));
});

test("salvarOrcamento2026 registra log de edicao resumido", async () => {
  const { service, logs } = instalarMockOrcamento();

  const resultado = await service.salvarOrcamento2026({
    password: "senha-correta-testes",
    changes: { "ITEM-1": { observacao: "Atualizado" } },
  });

  assert.equal(resultado.success, true);
  assert.ok(logs.some((log) => log.tipoEvento === "orcamento_2026_edicao"));
  const log = logs.find((item) => item.tipoEvento === "orcamento_2026_edicao");
  assert.deepEqual(log.payload.idsAfetados, ["ITEM-1"]);
  assert.deepEqual(log.payload.camposAlterados, ["observacao"]);
  assert.ok(!("password" in log.payload));
});

test("salvarValorFrenteOrcamento2026 registra historico e log operacional", async () => {
  const { service, historicos, logs, updates } = instalarMockOrcamento();

  const resultado = await service.salvarValorFrenteOrcamento2026({
    password: "senha-correta-testes",
    frente: "Aparelhamento",
    valorDisponivel: 1500,
  });

  assert.equal(resultado.success, true);
  const updateFrente = updates.find((update) => /INSERT INTO orcamento_2026_frentes/.test(update.sql));
  const historicoFrente = historicos.find((historico) => historico.campo === "valor_disponivel_frente");
  assert.ok(updateFrente);
  assert.equal(historicoFrente.registro, "frente:Aparelhamento");
  assert.equal(historicoFrente.campo, "valor_disponivel_frente");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipoEvento, "orcamento_2026_frente_valor_disponivel");
  assert.deepEqual(logs[0].payload.camposAlterados, ["valor_disponivel_frente"]);
});

test("salvarOrcamento2026 registra vinculo Pena Justa", async () => {
  const { service, historicos, logs, updates } = instalarMockOrcamento();

  const resultado = await service.salvarOrcamento2026({
    password: "senha-correta-testes",
    changes: { "ITEM-1": { pena_justa: true } },
  });

  assert.equal(resultado.success, true);

  const updateItem = updates.find((update) => update.params.includes("ITEM-1"));
  assert.ok(updateItem);
  assert.match(updateItem.sql, /pena_justa/);
  assert.ok(historicos.some((h) => h.registro === "ITEM-1" && h.campo === "pena_justa" && h.valorNovo === true));

  const log = logs.find((item) => item.tipoEvento === "orcamento_2026_edicao");
  assert.deepEqual(log.payload.idsAfetados, ["ITEM-1"]);
  assert.deepEqual(log.payload.camposAlterados, ["pena_justa"]);
  assert.ok(!("password" in log.payload));
});

test("salvarOrcamento2026 replica rastreio para itens ativos do mesmo processo SEI", async () => {
  const processoSei = "08016003997202630";
  const linhas = [
    { ...linhaOrcamento, id: "ITEM-1", processo_sei: processoSei },
    { ...linhaOrcamento, id: "ITEM-2", descricao: "Item relacionado", processo_sei: processoSei },
  ];
  const { service, historicos, logs, updates } = instalarMockOrcamento({ linhas });

  const resultado = await service.salvarOrcamento2026({
    password: "senha-correta-testes",
    changes: {
      "ITEM-1": {
        autorizacao_autoridade: "SEI 35718291",
        link_autorizacao_autoridade: "https://sei.example/processo/35718291",
        data_autorizacao_autoridade: "2026-05-29",
      },
    },
  });

  assert.equal(resultado.success, true);

  const updatesItem2 = updates.filter((update) => update.params.includes("ITEM-2"));
  assert.equal(updatesItem2.length, 1);
  assert.match(updatesItem2[0].sql, /autorizacao_autoridade/);
  assert.match(updatesItem2[0].sql, /link_autorizacao_autoridade/);
  assert.match(updatesItem2[0].sql, /data_autorizacao_autoridade/);
  assert.ok(historicos.some((h) => h.registro === "ITEM-2" && h.campo === "autorizacao_autoridade"));

  const log = logs.find((item) => item.tipoEvento === "orcamento_2026_edicao");
  assert.deepEqual(log.payload.idsAfetados, ["ITEM-1", "ITEM-2"]);
  assert.ok(log.payload.camposAlterados.includes("autorizacao_autoridade"));
});

test("salvarOrcamento2026 registra log de inativacao", async () => {
  const { service, logs } = instalarMockOrcamento();

  const resultado = await service.salvarOrcamento2026({
    password: "senha-correta-testes",
    inativos: ["ITEM-1"],
  });

  assert.equal(resultado.success, true);
  assert.ok(logs.some((log) => log.tipoEvento === "orcamento_2026_inativacao"));
});

test("criarProcessoVinculadoOrcamento2026 registra log de criacao vinculada", async () => {
  const { service, logs } = instalarMockOrcamento();

  const resultado = await service.criarProcessoVinculadoOrcamento2026({
    password: "senha-correta-testes",
    processoPaiId: "ITEM-1",
    descricao: "Processo vinculado teste",
    valorAlocado: 100,
  });

  assert.equal(resultado.success, true);
  const log = logs.find((item) => item.tipoEvento === "orcamento_2026_criacao_processo_vinculado");
  assert.ok(log);
  assert.equal(log.payload.processoPaiId, "ITEM-1");
  assert.equal(log.payload.valor, 100);
  assert.ok(log.payload.idFilho);
});

test("alocarSaldoOrcamento2026 registra log de alocacao", async () => {
  const destino = { ...linhaOrcamento, id: "ITEM-2", valor_previsto: 0 };
  const { service, logs } = instalarMockOrcamento({ linhas: [linhaOrcamento, destino] });

  const resultado = await service.alocarSaldoOrcamento2026({
    password: "senha-correta-testes",
    origemId: "ITEM-1",
    destinoId: "ITEM-2",
    valor: 100,
    justificativa: "Ajuste de saldo",
  });

  assert.equal(resultado.success, true);
  const log = logs.find((item) => item.tipoEvento === "orcamento_2026_alocacao_saldo");
  assert.ok(log);
  assert.equal(log.payload.origemId, "ITEM-1");
  assert.equal(log.payload.destinoId, "ITEM-2");
  assert.equal(log.payload.valor, 100);
});

test("salvarOrcamento2026 nao quebra operacao principal quando log falha", async () => {
  const warnOriginal = console.warn;
  console.warn = () => {};
  try {
    const { service } = instalarMockOrcamento({ falhaLog: true });
    const resultado = await service.salvarOrcamento2026({
      password: "senha-correta-testes",
      changes: { "ITEM-1": { observacao: "Atualizado" } },
    });
    assert.equal(resultado.success, true);
  } finally {
    console.warn = warnOriginal;
  }
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

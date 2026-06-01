const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ONASP_EDIT_PASSWORD = "senha-correta-testes";

const postgresClient = require("../../backend/db/postgres-client");
const service = require("../../backend/services/faf-2021-service");

const queryOriginal = postgresClient.query;
const withTransactionOriginal = postgresClient.withTransaction;

function linhaBase(overrides = {}) {
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
    ...overrides
  };
}

function instalarTransacaoMock({ item = linhaBase(), updateDate = "2026-02-03T04:05:06.000Z", onUpdate } = {}) {
  postgresClient.withTransaction = async (callback) => {
    const client = {
      async query(sql, params = []) {
        if (/SELECT\s+item_id/i.test(sql)) {
          return { rows: item ? [item] : [] };
        }

        if (/UPDATE\s+faf_2021_itens/i.test(sql)) {
          if (onUpdate) onUpdate(sql, params);
          return { rows: [{ atualizado_em: updateDate }] };
        }

        throw new Error(`SQL inesperado no mock: ${sql}`);
      }
    };

    return callback(client);
  };
}

test.afterEach(() => {
  postgresClient.query = queryOriginal;
  postgresClient.withTransaction = withTransactionOriginal;
});

test("listarFaf2021 retorna itens do Postgres no contrato da API", async () => {
  postgresClient.query = async () => ({ rows: [linhaBase()] });

  const resultado = await service.listarFaf2021();

  assert.equal(resultado.success, true);
  assert.equal(resultado.itens.length, 1);
  assert.deepEqual(resultado.itens[0], {
    itemId: "faf2021_idx_10",
    indiceDadosBase: 10,
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    quantidade: 2,
    valorUnitario: 100.5,
    valorTotal: 201,
    valorExecutado: 50.25,
    percentualExecutado: 25,
    observacaoExecucao: "Execucao parcial",
    atualizadoEm: "2026-01-02T03:04:05.000Z",
    instrumento: "FAF 2021"
  });
});

test("salvarExecucaoFaf2021 atualiza valor e observacao validos", async () => {
  let parametrosUpdate = null;
  instalarTransacaoMock({
    onUpdate(_sql, params) {
      parametrosUpdate = params;
    }
  });

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: "100,25",
    observacaoExecucao: "Nova observacao"
  });

  assert.equal(resultado.success, true);
  assert.equal(resultado.itemId, "faf2021_idx_10");
  assert.equal(resultado.atualizadoEm, "2026-02-03T04:05:06.000Z");
  assert.deepEqual(parametrosUpdate, ["faf2021_idx_10", 100.25, true, "Nova observacao"]);
});

test("salvarExecucaoFaf2021 rejeita senha invalida", async () => {
  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-invalida",
    itemId: "faf2021_idx_10"
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /senha inválida/i);
});

test("salvarExecucaoFaf2021 rejeita item inexistente", async () => {
  instalarTransacaoMock({ item: null });

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 10
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /não localizado/i);
});

test("salvarExecucaoFaf2021 rejeita UF divergente", async () => {
  instalarTransacaoMock();

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AL",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 10
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /UF informada/i);
});

test("salvarExecucaoFaf2021 rejeita objeto divergente", async () => {
  instalarTransacaoMock();

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Objeto alterado",
    valorExecutado: 10
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /Objeto informado/i);
});

test("salvarExecucaoFaf2021 rejeita valor negativo", async () => {
  instalarTransacaoMock();

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: -1
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /negativo/i);
});

test("salvarExecucaoFaf2021 rejeita valor maior que total", async () => {
  instalarTransacaoMock();

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 202
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /maior que o valor total/i);
});

test("salvarExecucaoFaf2021 rejeita HTML na observacao", async () => {
  instalarTransacaoMock();

  const resultado = await service.salvarExecucaoFaf2021({
    password: "senha-correta-testes",
    itemId: "faf2021_idx_10",
    uf: "AC",
    objeto: "Equipamento de ouvidoria",
    valorExecutado: 10,
    observacaoExecucao: "<b>html</b>"
  });

  assert.equal(resultado.success, false);
  assert.match(resultado.message, /HTML/i);
});

const testPostgres = process.env.DATABASE_URL ? test : test.skip;

testPostgres("salvarExecucaoFaf2021 funciona com seed isolado no Postgres", async () => {
  const itemId = "faf2021_idx_999901";

  try {
    await queryOriginal(
      `
        INSERT INTO faf_2021_itens (
          item_id,
          indice_dados_base,
          uf,
          objeto,
          quantidade,
          valor_unitario,
          valor_total,
          valor_executado,
          instrumento
        )
        VALUES ($1, 999901, 'ZZ', 'Item teste FAF 2021', 1, 100, 100, 0, 'FAF 2021')
        ON CONFLICT (item_id) DO UPDATE SET
          uf = EXCLUDED.uf,
          objeto = EXCLUDED.objeto,
          valor_total = EXCLUDED.valor_total,
          valor_executado = 0
      `,
      [itemId]
    );

    const resultado = await service.salvarExecucaoFaf2021({
      password: "senha-correta-testes",
      itemId,
      uf: "ZZ",
      objeto: "Item teste FAF 2021",
      valorExecutado: 10,
      observacaoExecucao: "Teste integrado"
    });

    assert.equal(resultado.success, true);

    const conferido = await queryOriginal(
      "SELECT valor_executado, observacao_execucao FROM faf_2021_itens WHERE item_id = $1",
      [itemId]
    );
    assert.equal(Number(conferido.rows[0].valor_executado), 10);
    assert.equal(conferido.rows[0].observacao_execucao, "Teste integrado");
  } finally {
    await queryOriginal("DELETE FROM faf_2021_itens WHERE item_id = $1", [itemId]);
  }
});

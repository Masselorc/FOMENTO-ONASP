const test = require("node:test");
const assert = require("node:assert/strict");

const {
  salvarOrcamento2026,
  criarProcessoVinculadoOrcamento2026,
  alocarSaldoOrcamento2026,
  valorBooleano,
  normalizarDataPostgres
} = require("../../backend/services/orcamento-2026-service");
const {
  salvarParametrosMinimos,
  reverterHistoricoParametrosMinimos
} = require("../../backend/services/parametros-minimos-service");

function assertFalhaSenhaInvalida(resultado) {
  assert.equal(resultado?.success, false);
  assert.match(String(resultado?.message || ""), /senha inválida/i);
}

test("salvarOrcamento2026 rejeita senha inválida", async () => {
  const resultado = await salvarOrcamento2026({
    password: "senha-invalida",
    changes: {}
  });
  assertFalhaSenhaInvalida(resultado);
});

test("criarProcessoVinculadoOrcamento2026 rejeita senha inválida", async () => {
  const resultado = await criarProcessoVinculadoOrcamento2026({
    password: "senha-invalida"
  });
  assertFalhaSenhaInvalida(resultado);
});

test("alocarSaldoOrcamento2026 rejeita senha inválida", async () => {
  const resultado = await alocarSaldoOrcamento2026({
    password: "senha-invalida"
  });
  assertFalhaSenhaInvalida(resultado);
});

test("salvarParametrosMinimos rejeita senha inválida", async () => {
  const resultado = await salvarParametrosMinimos({
    password: "senha-invalida",
    changes: {}
  });
  assertFalhaSenhaInvalida(resultado);
});

test("reverterHistoricoParametrosMinimos rejeita senha inválida", async () => {
  const resultado = await reverterHistoricoParametrosMinimos({
    password: "senha-invalida",
    historicoId: 1
  });
  assertFalhaSenhaInvalida(resultado);
});

test("valorBooleano aceita true, 1, '1', 'true' e rejeita o resto", () => {
  assert.equal(valorBooleano(true), true);
  assert.equal(valorBooleano(1), true);
  assert.equal(valorBooleano("1"), true);
  assert.equal(valorBooleano("true"), true);
  assert.equal(valorBooleano("TRUE"), true);
  assert.equal(valorBooleano(" 1 "), true);
  assert.equal(valorBooleano(false), false);
  assert.equal(valorBooleano(0), false);
  assert.equal(valorBooleano("0"), false);
  assert.equal(valorBooleano("false"), false);
  assert.equal(valorBooleano("abc"), false);
  assert.equal(valorBooleano(null), false);
  assert.equal(valorBooleano(undefined), false);
});

test("normalizarDataPostgres normaliza corretamente", () => {
  assert.equal(normalizarDataPostgres(null), null);
  assert.equal(normalizarDataPostgres(undefined), null);
  assert.equal(normalizarDataPostgres(""), null);
  assert.equal(normalizarDataPostgres("   "), null);
  
  // DD/MM/YYYY
  assert.equal(normalizarDataPostgres("25/12/2026"), "2026-12-25");
  assert.equal(normalizarDataPostgres("1/1/2026"), "2026-01-01");
  
  // YYYY-MM-DD
  assert.equal(normalizarDataPostgres("2026-12-25"), "2026-12-25");
  
  // ISO Datetime
  assert.equal(normalizarDataPostgres("2026-12-25T15:30:00.000Z"), "2026-12-25");
  
  // Outros formatos que comecem com YYYY-MM-DD
  assert.equal(normalizarDataPostgres("2026-12-25 15:30:00"), "2026-12-25");
});

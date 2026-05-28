const test = require("node:test");
const assert = require("node:assert/strict");

const {
  salvarOrcamento2026,
  criarProcessoVinculadoOrcamento2026,
  alocarSaldoOrcamento2026
} = require("../../backend/services/orcamento-2026-service");
const {
  salvarParametrosMinimos,
  reverterHistoricoParametrosMinimos
} = require("../../backend/services/parametros-minimos-service");

function assertFalhaSenhaInvalida(resultado) {
  assert.equal(resultado?.success, false);
  assert.match(String(resultado?.message || ""), /senha inválida/i);
}

test("salvarOrcamento2026 rejeita senha inválida", () => {
  const resultado = salvarOrcamento2026({
    password: "senha-invalida",
    changes: {}
  });
  assertFalhaSenhaInvalida(resultado);
});

test("criarProcessoVinculadoOrcamento2026 rejeita senha inválida", () => {
  const resultado = criarProcessoVinculadoOrcamento2026({
    password: "senha-invalida"
  });
  assertFalhaSenhaInvalida(resultado);
});

test("alocarSaldoOrcamento2026 rejeita senha inválida", () => {
  const resultado = alocarSaldoOrcamento2026({
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

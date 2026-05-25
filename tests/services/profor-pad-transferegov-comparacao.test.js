const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compararPadTransferegovComExcel,
} = require("../../backend/services/profor-2022/profor-pad-transferegov-comparacao-service");

function item(overrides = {}) {
  return {
    instrumento: "937782",
    tipoDespesa: "BEM",
    descricao: "Computador completo",
    codigoNaturezaDespesa: "44.90.52",
    unidade: "UN",
    quantidade: 2,
    valorUnitario: 100,
    valorTotalPrevisto: 200,
    valorTotalExecutado: 50,
    saldo: 150,
    ...overrides,
  };
}

function comparar(transferegov, excel) {
  return compararPadTransferegovComExcel({
    instrumento: "937782",
    itensTransferegov: transferegov,
    itensExcel: excel,
  });
}

test("comparacao retorna equivalente quando itens Transferegov e Excel sao iguais", () => {
  const resultado = comparar([item()], [item()]);

  assert.equal(resultado.equivalente, true);
  assert.equal(resultado.divergenciasCriticas.length, 0);
});

test("comparacao detecta divergencia de total de itens", () => {
  const resultado = comparar([item()], [item(), item({ descricao: "Mesa", valorTotalPrevisto: 10, valorTotalExecutado: 0, saldo: 10 })]);

  assert.equal(resultado.equivalente, false);
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "total_itens_divergente"));
});

test("comparacao detecta divergencia de valor previsto", () => {
  const resultado = comparar([item({ valorTotalPrevisto: 210, saldo: 160 })], [item()]);

  assert.ok(resultado.itensComValorDivergente.some((divergencia) => divergencia.campo === "valorTotalPrevisto"));
  assert.equal(resultado.itensComDescricaoSemelhanteHashDiferente.length, 1);
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "total_valorTotalPrevisto_divergente"));
});

test("comparacao detecta divergencia de valor executado", () => {
  const resultado = comparar([item({ valorTotalExecutado: 40, saldo: 160 })], [item()]);

  assert.ok(resultado.itensComValorDivergente.some((divergencia) => divergencia.campo === "valorTotalExecutado"));
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "total_valorTotalExecutado_divergente"));
});

test("comparacao detecta divergencia de saldo", () => {
  const resultado = comparar([item({ saldo: 140 })], [item()]);

  assert.ok(resultado.itensComValorDivergente.some((divergencia) => divergencia.campo === "saldo"));
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "total_saldo_divergente"));
});

test("comparacao detecta item ausente no Transferegov", () => {
  const resultado = comparar([], [item()]);

  assert.equal(resultado.itensAusentesNoTransferegov.length, 1);
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "item_ausente_no_transferegov"));
});

test("comparacao detecta item ausente no Excel", () => {
  const resultado = comparar([item()], []);

  assert.equal(resultado.itensAusentesNoExcel.length, 1);
  assert.ok(resultado.divergenciasCriticas.some((divergencia) => divergencia.tipo === "item_ausente_no_excel"));
});

test("comparacao ignora area rateio e decisao", () => {
  const resultado = comparar([
    item({ area: "OUVIDORIA", rateio: [{ area: "OUVIDORIA", quantidade: 1 }], decisao: "A" }),
  ], [
    item({ area: "CORREGEDORIA", rateio: [{ area: "CORREGEDORIA", quantidade: 2 }], decisao: "B" }),
  ]);

  assert.equal(resultado.equivalente, true);
  assert.equal(resultado.divergenciasCriticas.length, 0);
});

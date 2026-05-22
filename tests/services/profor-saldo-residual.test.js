const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ehSaldoResidualProfor,
  criarChaveSaldoResidual,
  normalizarAreaSaldoResidual,
  areaSaldoResidualEhOperacional,
  naturezaSaldoResidualValida,
} = require("../../backend/services/profor-2022/profor-saldo-residual-service");

test("identifica saldo residual e saldo remanescente por descritor controlado", () => {
  assert.equal(ehSaldoResidualProfor("Saldo Residual"), true);
  assert.equal(ehSaldoResidualProfor("Saldo Remanescente de Aplicação"), true);
  assert.equal(ehSaldoResidualProfor("Notebook 14 polegadas"), false);
});

test("chave de saldo residual inclui natureza", () => {
  const capital = criarChaveSaldoResidual({
    numeroConvenio: "938128",
    descricao: "Saldo Residual",
    natureza: "CAPITAL",
  });
  const custeio = criarChaveSaldoResidual({
    numeroConvenio: "938128",
    descricao: "Saldo Residual",
    natureza: "CUSTEIO",
  });
  assert.notEqual(capital, custeio);
  assert.equal(capital, "938128::SALDO RESIDUAL::CAPITAL");
  assert.equal(custeio, "938128::SALDO RESIDUAL::CUSTEIO");
});

test("saldo residual aceita area tecnica, mas nao area operacional", () => {
  assert.equal(normalizarAreaSaldoResidual("N/A"), "NAO INFORMADO");
  assert.equal(areaSaldoResidualEhOperacional("OUVIDORIA"), true);
  assert.equal(areaSaldoResidualEhOperacional("NAO INFORMADO"), false);
});

test("saldo residual exige natureza CAPITAL ou CUSTEIO", () => {
  assert.equal(naturezaSaldoResidualValida("CAPITAL"), true);
  assert.equal(naturezaSaldoResidualValida("CUSTEIO"), true);
  assert.equal(naturezaSaldoResidualValida(""), false);
  assert.equal(naturezaSaldoResidualValida("OUTROS"), false);
});

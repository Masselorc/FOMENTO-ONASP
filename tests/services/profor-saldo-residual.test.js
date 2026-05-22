const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ehSaldoResidualProfor,
  criarChaveSaldoResidual,
  normalizarAreaSaldoResidual,
  areaSaldoResidualEhOperacional,
  naturezaSaldoResidualValida,
  normalizarNaturezaSaldoResidual,
  naturezaSaldoResidualEhMista,
  naturezasSaldoResidualDoTexto,
  separarMemoriaSaldoResidualPorNatureza,
  NATUREZA_SALDO_RESIDUAL_MISTA,
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

test("natureza 'CAPITAL, CUSTEIO' e tratada como mista, nunca como CAPITAL", () => {
  assert.equal(normalizarNaturezaSaldoResidual("CAPITAL, CUSTEIO"), NATUREZA_SALDO_RESIDUAL_MISTA);
  assert.equal(normalizarNaturezaSaldoResidual("Custeio e Capital"), NATUREZA_SALDO_RESIDUAL_MISTA);
  assert.equal(naturezaSaldoResidualEhMista("CAPITAL, CUSTEIO"), true);
  assert.equal(naturezaSaldoResidualEhMista("CAPITAL"), false);
  // Mista nunca e uma natureza valida de comparacao: exige split por natureza.
  assert.equal(naturezaSaldoResidualValida("CAPITAL, CUSTEIO"), false);
  assert.deepEqual(naturezasSaldoResidualDoTexto("CAPITAL, CUSTEIO"), ["CAPITAL", "CUSTEIO"]);
});

test("chave de saldo residual misto difere da chave CAPITAL e da chave CUSTEIO", () => {
  const misto = criarChaveSaldoResidual({
    numeroConvenio: "938277",
    descricao: "Saldo Remanescente",
    natureza: "CAPITAL, CUSTEIO",
  });
  const capital = criarChaveSaldoResidual({
    numeroConvenio: "938277",
    descricao: "Saldo Remanescente",
    natureza: "CAPITAL",
  });
  assert.notEqual(misto, capital);
  assert.equal(misto, "938277::SALDO REMANESCENTE::MISTA");
});

test("separa memoria consolidada de saldo remanescente em uma linha por natureza", () => {
  const rateios = [
    { natureza: "CAPITAL", quantidadeReferencia: 10, valorPrevistoReferencia: 7267.88, valorExecutadoReferencia: 0 },
    { natureza: "CUSTEIO", quantidadeReferencia: 10, valorPrevistoReferencia: 5924.45, valorExecutadoReferencia: 0 },
  ];
  const parcelas = separarMemoriaSaldoResidualPorNatureza(
    { descricao: "SALDO REMANESCENTE", natureza: "CAPITAL, CUSTEIO", valorPrevisto: 13192.33 },
    rateios
  );
  assert.equal(parcelas.length, 2);
  const capital = parcelas.find((p) => p.natureza === "CAPITAL");
  const custeio = parcelas.find((p) => p.natureza === "CUSTEIO");
  assert.equal(capital.valorPrevisto, 7267.88);
  assert.equal(custeio.valorPrevisto, 5924.45);
  assert.equal(capital.saldo, 7267.88);
  // O total so fecha como conferencia, nunca como chave de equivalencia.
  assert.equal(capital.valorPrevisto + custeio.valorPrevisto, 13192.33);
});

test("sem rateios utilizaveis nao ha como separar a memoria por natureza", () => {
  assert.deepEqual(
    separarMemoriaSaldoResidualPorNatureza({ natureza: "CAPITAL, CUSTEIO" }, []),
    []
  );
});

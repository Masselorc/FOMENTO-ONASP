const test = require("node:test");
const assert = require("node:assert/strict");

const {
  simularRateioQuantidadeFixa,
} = require("../../backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-service");

function entrada(overrides = {}) {
  return {
    item: {
      numero: "1",
      uf: "DF",
      descricao: "Notebook",
      natureza: "CAPITAL",
      quantidade: 10,
      valorUnitario: 1000,
      valorPrevisto: 10000,
      ...(overrides.item || {}),
    },
    rateios: overrides.rateios || [
      { area: "Ouvidoria", quantidade: 4 },
      { area: "Gestao", quantidade: 6 },
    ],
  };
}

test("rateio quantidade fixa: soma exata fecha sem erro", () => {
  const rel = simularRateioQuantidadeFixa(entrada());

  assert.equal(rel.apto, true);
  assert.equal(rel.totais.somaQuantidadeRateada, 10);
  assert.equal(rel.totais.quantidadeNaoRateada, 0);
  assert.equal(rel.totais.totalValorRateado, 10000);
});

test("rateio quantidade fixa: soma inferior gera saldo não rateado", () => {
  const rel = simularRateioQuantidadeFixa(entrada({
    rateios: [{ area: "Ouvidoria", quantidade: 4 }],
  }));

  assert.equal(rel.apto, true);
  assert.equal(rel.totais.quantidadeNaoRateada, 6);
  assert.ok(rel.avisos.some((aviso) => aviso.tipo === "quantidade_nao_rateada"));
});

test("rateio quantidade fixa: soma superior e quantidade negativa geram erro", () => {
  const superior = simularRateioQuantidadeFixa(entrada({
    rateios: [{ area: "Ouvidoria", quantidade: 11 }],
  }));
  const negativa = simularRateioQuantidadeFixa(entrada({
    rateios: [{ area: "Ouvidoria", quantidade: -1 }],
  }));

  assert.equal(superior.apto, false);
  assert.ok(superior.erros.some((erro) => erro.tipo === "soma_rateios_superior_quantidade_total"));
  assert.equal(negativa.apto, false);
  assert.ok(negativa.erros.some((erro) => erro.tipo === "quantidade_negativa"));
});

test("rateio quantidade fixa: percentual derivado e valor rateado são calculados", () => {
  const rel = simularRateioQuantidadeFixa(entrada());

  assert.equal(rel.rateios[0].percentualDerivado, 40);
  assert.equal(rel.rateios[0].valorPrevistoRateado, 4000);
  assert.equal(rel.rateios[1].percentualDerivado, 60);
  assert.equal(rel.rateios[1].valorPrevistoRateado, 6000);
});

test("rateio quantidade fixa: 1.0 permanece 1", () => {
  const rel = simularRateioQuantidadeFixa(entrada({
    item: { quantidade: "1.0", valorUnitario: 1000, valorPrevisto: 1000 },
    rateios: [{ area: "Ouvidoria", quantidade: "1.0" }],
  }));

  assert.equal(rel.item.quantidade, 1);
  assert.equal(rel.rateios[0].quantidade, 1);
});

test("rateio quantidade fixa: CAPITAL e CUSTEIO não podem ser misturados", () => {
  const rel = simularRateioQuantidadeFixa(entrada({
    rateios: [{ area: "Ouvidoria", quantidade: 1, natureza: "CUSTEIO" }],
  }));

  assert.equal(rel.apto, false);
  assert.ok(rel.erros.some((erro) => erro.tipo === "natureza_mista"));
});

test("rateio quantidade fixa: residual de arredondamento é explícito", () => {
  const rel = simularRateioQuantidadeFixa(entrada({
    item: { quantidade: 3, valorUnitario: 33.33, valorPrevisto: 100 },
    rateios: [
      { area: "A", quantidade: 1 },
      { area: "B", quantidade: 1 },
      { area: "C", quantidade: 1 },
    ],
  }));

  assert.equal(rel.totais.diferencaResidualTotal, 0.01);
  assert.ok(rel.avisos.some((aviso) => aviso.tipo === "diferenca_residual_total"));
});

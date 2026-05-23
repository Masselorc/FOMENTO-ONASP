const test = require("node:test");
const assert = require("node:assert/strict");

const {
  simularReconstrucaoComRateioQuantidadeFixa,
} = require("../../backend/services/profor-2022/profor-pad-rateio-quantidade-fixa-reconstrucao-dry-run-service");

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

test("reconstrução com rateio fixo dry-run: não altera plano oficial nem banco", () => {
  const rel = simularReconstrucaoComRateioQuantidadeFixa([entrada()]);

  assert.equal(rel.garantias.reconstrutorOficialAlterado, false);
  assert.equal(rel.garantias.planoAplicacaoOficialAlterado, false);
  assert.equal(rel.garantias.bancoAlterado, false);
  assert.equal(rel.garantias.publicacaoExecutada, false);
  assert.equal(rel.garantias.decisaoRegistrada, false);
});

test("reconstrução com rateio fixo dry-run: soma superior bloqueia simulação", () => {
  const rel = simularReconstrucaoComRateioQuantidadeFixa([
    entrada({ item: { quantidade: 3 }, rateios: [{ area: "Ouvidoria", quantidade: 4 }] }),
  ]);

  assert.equal(rel.resumo.itensComErro, 1);
  assert.equal(rel.resumo.totalBloqueios, 1);
  assert.equal(rel.itens[0].apto, false);
});

test("reconstrução com rateio fixo dry-run: soma inferior gera saldo não rateado", () => {
  const rel = simularReconstrucaoComRateioQuantidadeFixa([
    entrada({ rateios: [{ area: "Ouvidoria", quantidade: 4 }] }),
  ]);

  assert.equal(rel.resumo.itensAptos, 1);
  assert.equal(rel.resumo.saldoNaoRateado, 6);
  assert.equal(rel.itens[0].saldoNaoRateado, 6);
});

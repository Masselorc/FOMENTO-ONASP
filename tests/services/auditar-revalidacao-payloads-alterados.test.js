const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  IDS_REVALIDAR,
  classificar,
} = require("../../backend/scripts/auditar-revalidacao-payloads-alterados-pad-profor-2022");

test("IDS_REVALIDAR contem exatamente 27 IDs", () => {
  assert.equal(IDS_REVALIDAR.length, 27);
  const expectedIds = [
    47, 48, 49, 50, 51, 52, 53, 54,
    56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
    72, 73, 74,
  ];
  assert.deepEqual([...IDS_REVALIDAR].sort(), expectedIds.sort());
});

test("Divergencia #72 e explicitamente esperada com 2 decisoes afetadas no relatorio JSON gerado", () => {
  const caminhoRelatorio = path.resolve(__dirname, "../../backend/data/relatorios/profor-2022-revalidacao-payloads-alterados-dry-run.json");

  // O relatorio ja deve ter sido gerado na etapa manual.
  assert.ok(fs.existsSync(caminhoRelatorio), "Relatorio dry-run deve existir");

  const relatorio = JSON.parse(fs.readFileSync(caminhoRelatorio, "utf8"));
  const item72 = relatorio.matriz.find((item) => item.id === 72);

  assert.ok(item72, "ID #72 deve estar na matriz do relatorio");
  assert.equal(item72.totalDecisoesAfetadas, 2);
  assert.equal(item72.decisoesAfetadas.length, 2);
});

test("classificar() retorna revalidacao_por_prevalencia_pad com parametros corretos", () => {
  const resultado = classificar({
    chaveDivergenciaPreservada: true,
    totalDecisoes: 1,
    decisoesComMesmoSnapshot: 1,
    ausenciaAplicadaPorDecisao: true,
    itemAusentePorMemoria: true,
    impedimentosChaveItem: [],
    diffsCriticasChaveItem: [],
    reconstrucaoSeguraSemEsseItem: true,
  });

  assert.equal(resultado.classificacao, "revalidacao_por_prevalencia_pad");
  assert.equal(resultado.podeSairDoBloqueio, "sim, mediante decisao de revalidacao registrada via servico");
  assert.equal(resultado.exigeDecisaoNova, true);
});

test("classificar() retorna decisao_retificadora_necessaria se chaveDivergencia nao preservada", () => {
  const resultado = classificar({
    chaveDivergenciaPreservada: false,
    totalDecisoes: 1,
    decisoesComMesmoSnapshot: 1,
    ausenciaAplicadaPorDecisao: true,
    itemAusentePorMemoria: true,
    impedimentosChaveItem: [],
    diffsCriticasChaveItem: [],
    reconstrucaoSeguraSemEsseItem: true,
  });

  assert.equal(resultado.classificacao, "decisao_retificadora_necessaria");
  assert.equal(resultado.podeSairDoBloqueio, "nao sem decisao retificadora");
});

test("classificar() retorna revisao_humana_necessaria se houver impedimento ou diferenca critica", () => {
  // Caso com impedimentos
  const resultadoImp = classificar({
    chaveDivergenciaPreservada: true,
    totalDecisoes: 1,
    decisoesComMesmoSnapshot: 1,
    ausenciaAplicadaPorDecisao: true,
    itemAusentePorMemoria: true,
    impedimentosChaveItem: [{ tipo: "erro_valor" }],
    diffsCriticasChaveItem: [],
    reconstrucaoSeguraSemEsseItem: true,
  });
  assert.equal(resultadoImp.classificacao, "revisao_humana_necessaria");
  assert.equal(resultadoImp.podeSairDoBloqueio, "nao automaticamente");

  // Caso com diferencas criticas
  const resultadoCrit = classificar({
    chaveDivergenciaPreservada: true,
    totalDecisoes: 1,
    decisoesComMesmoSnapshot: 1,
    ausenciaAplicadaPorDecisao: true,
    itemAusentePorMemoria: true,
    impedimentosChaveItem: [],
    diffsCriticasChaveItem: [{ chave: "x" }],
    reconstrucaoSeguraSemEsseItem: true,
  });
  assert.equal(resultadoCrit.classificacao, "revisao_humana_necessaria");
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  montarRelatorio,
} = require("../../backend/scripts/auditar-promocao-snapshot-anterior-oficial-pad-profor-2022");

const {
  gerarFotografiaCanonica,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

test("promoção snapshot anterior: sem aprovação humana não pode promover", () => {
  const snapshot = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);
  const rel = montarRelatorio(snapshot);

  assert.equal(rel.validacoes.aprovacaoHumanaExpressa, false);
  assert.equal(rel.avaliacao.podePromover, false);
  assert.ok(rel.avaliacao.impedimentos.includes("aprovacao_humana_ausente"));
});

test("promoção snapshot anterior: auditoria não cria snapshot anterior oficial", () => {
  const caminhoAnterior = path.join(__dirname, "../../backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json");
  const existiaAntes = fs.existsSync(caminhoAnterior);
  const snapshot = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);

  const rel = montarRelatorio(snapshot);

  assert.equal(rel.garantias.snapshotCopiado, false);
  assert.equal(rel.garantias.snapshotAnteriorOficialCriado, false);
  assert.equal(fs.existsSync(caminhoAnterior), existiaAntes);
});

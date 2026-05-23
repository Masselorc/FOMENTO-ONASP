const test = require("node:test");
const assert = require("node:assert/strict");

const {
  gerarFilaRevisaoSnapshots,
} = require("../../backend/services/profor-2022/profor-pad-fila-revisao-snapshots-service");

function comparacaoCom(divergencias = [], bloqueiosTecnicos = []) {
  return {
    versaoComparador: "0.2",
    checksumAnterior: "a",
    checksumNovo: "b",
    checksumsValidos: bloqueiosTecnicos.length === 0,
    divergencias,
    bloqueiosTecnicos,
  };
}

test("fila snapshots: diacrítico e textual simples viram saneáveis", () => {
  const rel = gerarFilaRevisaoSnapshots(comparacaoCom([
    { tipo: "descricao_apenas_diacritico", chave: "1", uf: "DF", numero: "1" },
    { tipo: "descricao_apenas_textual", chave: "2", uf: "DF", numero: "2" },
  ]));

  assert.equal(rel.resumo.totalCandidatos, 2);
  assert.equal(rel.candidatos[0].categoriaOperacional, "falso_positivo_saneavel");
  assert.equal(rel.candidatos[1].categoriaOperacional, "falso_positivo_saneavel");
});

test("fila snapshots: checksum inválido e colisão viram bloqueio técnico", () => {
  const rel = gerarFilaRevisaoSnapshots(comparacaoCom([], [
    { tipo: "checksum_invalido", mensagem: "Checksum inválido" },
    { tipo: "colisao_chave", chave: "k", mensagem: "Colisão" },
  ]));

  assert.equal(rel.resumo.totalBloqueiosTecnicos, 2);
  assert.equal(rel.candidatos.every((item) => item.aptaParaDecisaoHumana === false), true);
});

test("fila snapshots: item novo, removido e natureza alterada têm classificação esperada", () => {
  const rel = gerarFilaRevisaoSnapshots(comparacaoCom([
    { tipo: "item_novo", chave: "n" },
    { tipo: "item_removido", chave: "r" },
    { tipo: "natureza_alterada", chave: "nat" },
  ]));

  assert.equal(rel.candidatos[0].categoriaOperacional, "pendencia_operacional_real");
  assert.equal(rel.candidatos[1].categoriaOperacional, "pendencia_operacional_real");
  assert.equal(rel.candidatos[2].categoriaOperacional, "bloqueio_tecnico_seguranca");
  assert.equal(rel.candidatos[2].aptaParaDecisaoHumana, false);
});

test("fila snapshots: ausência de comparação não inventa divergência", () => {
  const rel = gerarFilaRevisaoSnapshots(null);

  assert.equal(rel.status, "comparacao_indisponivel");
  assert.equal(rel.resumo.totalCandidatos, 0);
  assert.deepEqual(rel.candidatos, []);
});

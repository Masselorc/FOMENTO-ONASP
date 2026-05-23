const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STATUS_SNAPSHOT,
  validarChecksum,
  avaliarSnapshotCandidato,
  ausenciaSnapshotAnteriorNaoGeraDivergencia,
} = require("../../backend/services/profor-2022/profor-pad-politica-snapshots-service");

const {
  gerarFotografiaCanonica,
} = require("../../backend/services/profor-2022/profor-pad-fotografia-service");

function contextoValido(overrides = {}) {
  return {
    commitReferencia: "abc1234",
    relatorioMarkdownPresente: true,
    validacoesRegistradas: true,
    aprovacaoHumanaExpressa: true,
    errosCriticosTratados: true,
    avisosClassificados: true,
    statusSnapshot: STATUS_SNAPSHOT.CANDIDATO,
    ...overrides,
  };
}

test("política de snapshots: snapshot válido pode ser candidato e promovido", () => {
  const snapshot = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);
  const avaliacao = avaliarSnapshotCandidato(snapshot, contextoValido());

  assert.equal(validarChecksum(snapshot), true);
  assert.equal(avaliacao.podeSerCandidato, true);
  assert.equal(avaliacao.podePromover, true);
});

test("política de snapshots: snapshot sem checksum ou checksum inválido não pode ser promovido", () => {
  const semChecksum = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);
  delete semChecksum.checksum;

  const checksumInvalido = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);
  checksumInvalido.checksum = "corrompido";

  assert.equal(avaliarSnapshotCandidato(semChecksum, contextoValido()).podePromover, false);
  assert.equal(avaliarSnapshotCandidato(checksumInvalido, contextoValido()).podePromover, false);
});

test("política de snapshots: snapshot temporário e sobrescrita silenciosa são proibidos", () => {
  const snapshot = gerarFotografiaCanonica([
    { uf: "DF", numero: "1", natureza: "CUSTEIO", area: "OUVIDORIA", descricao: "Notebook", quantidade: 1 },
  ]);

  const temporario = avaliarSnapshotCandidato(snapshot, contextoValido({
    statusSnapshot: STATUS_SNAPSHOT.TEMPORARIO,
  }));
  const sobrescrita = avaliarSnapshotCandidato(snapshot, contextoValido({
    sobrescreverSemRegistro: true,
  }));

  assert.equal(temporario.podePromover, false);
  assert.ok(temporario.impedimentos.includes("snapshot_temporario_nao_promovivel"));
  assert.equal(sobrescrita.podePromover, false);
  assert.ok(sobrescrita.impedimentos.includes("sobrescrita_silenciosa_proibida"));
});

test("política de snapshots: ausência de snapshot anterior não gera divergência artificial", () => {
  assert.equal(ausenciaSnapshotAnteriorNaoGeraDivergencia(false), true);
});

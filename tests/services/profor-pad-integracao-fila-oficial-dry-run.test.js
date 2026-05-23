const test = require("node:test");
const assert = require("node:assert/strict");

const {
  simularIntegracaoFilaOficialSnapshots,
  adaptarCandidatoParaFilaOficialDryRun,
} = require("../../backend/services/profor-2022/profor-pad-integracao-fila-oficial-dry-run-service");

test("integração fila oficial dry-run: ausência de comparação não cria candidatos artificiais", () => {
  const rel = simularIntegracaoFilaOficialSnapshots({
    status: "comparacao_indisponivel",
    candidatos: [],
  });

  assert.equal(rel.status, "sem_candidatos_integraveis");
  assert.equal(rel.resumo.totalCandidatosOrigem, 0);
  assert.deepEqual(rel.itens, []);
});

test("integração fila oficial dry-run: não inventa schema quando faltam dados mínimos", () => {
  const item = adaptarCandidatoParaFilaOficialDryRun({ idCandidato: "x" });

  assert.equal(item.integravel, false);
  assert.equal(item.motivo, "dados_insuficientes_para_inferir_schema_oficial");
  assert.equal(item.payloadFilaOficial, null);
});

test("integração fila oficial dry-run: não registra decisão nem altera banco/fila", () => {
  const rel = simularIntegracaoFilaOficialSnapshots({
    status: "fila_gerada",
    candidatos: [{
      idCandidato: "snap-1",
      origem: "comparador_snapshots_pad",
      tipoDivergencia: "descricao_apenas_textual",
      categoriaOperacional: "falso_positivo_saneavel",
      severidade: "baixa",
      motivo: "teste",
    }],
  });

  assert.equal(rel.resumo.totalIntegraveis, 1);
  assert.equal(rel.garantias.filaOficialAlterada, false);
  assert.equal(rel.garantias.decisaoRegistrada, false);
  assert.equal(rel.garantias.bancoAlterado, false);
  assert.equal(rel.garantias.publicacaoExecutada, false);
});

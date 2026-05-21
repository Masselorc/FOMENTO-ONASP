const test = require("node:test");
const assert = require("node:assert/strict");

const {
  interpretarDecisaoRevisao,
  validarRateioManual,
  extrairRateioManual,
} = require("../../backend/services/profor-2022/profor-pad-decisao-aplicacao-service");

// Os testes usam objetos simulados de divergência/decisão. Não tocam o banco
// (apenas a função pura interpretarDecisaoRevisao é exercitada).

function divergencia(tipoAlerta, extra = {}) {
  return { tipoAlerta, chaveItem: "937698::ITEM", campoAfetado: null, ...extra };
}

function decisao(acao, extra = {}) {
  return { decisao: acao, payloadDecisao: {}, valorAplicado: null, ...extra };
}

test("equivalência ACEITO gera efeito aplicável", () => {
  const r = interpretarDecisaoRevisao(divergencia("equivalencia_por_descricao_normalizada"), decisao("ACEITO"));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "equivalencia_aceita");
});

test("equivalência REJEITADO mantém impedimento e é aplicável", () => {
  const r = interpretarDecisaoRevisao(divergencia("equivalencia_por_descricao_normalizada"), decisao("REJEITADO"));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "equivalencia_rejeitada");
});

test("item novo sem rateio ACEITO sem payload de rateio é não aplicável", () => {
  const r = interpretarDecisaoRevisao(divergencia("item_novo_sem_rateio"), decisao("ACEITO"));
  assert.equal(r.aplicavel, false);
  assert.equal(r.efeito.tipo, "decisao_sem_rateio_aplicavel");
});

test("item novo sem rateio ACEITO com rateio válido gera rateio_manual", () => {
  const payloadDecisao = {
    rateio: [
      { area: "OUVIDORIA", natureza: "CUSTEIO", percentualValor: 60, percentualQuantidade: 60 },
      { area: "CORREGEDORIA", natureza: "CUSTEIO", percentualValor: 40, percentualQuantidade: 40 },
    ],
  };
  const r = interpretarDecisaoRevisao(divergencia("item_novo_sem_rateio"), decisao("ACEITO", { payloadDecisao }));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "rateio_manual");
  assert.equal(r.efeito.rateios.length, 2);
});

test("rateio com soma de percentual diferente de 100 é inválido", () => {
  const payloadDecisao = {
    rateio: [{ area: "OUVIDORIA", natureza: "CUSTEIO", percentualValor: 70 }],
  };
  const r = interpretarDecisaoRevisao(divergencia("item_novo_sem_rateio"), decisao("CORRIGIDO", { payloadDecisao }));
  assert.equal(r.aplicavel, false);
  assert.equal(r.efeito.tipo, "decisao_rateio_invalido");
});

test("item ausente no PAD ACEITO confirma ausência", () => {
  const r = interpretarDecisaoRevisao(divergencia("item_ausente_no_pad"), decisao("ACEITO"));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "ausencia_confirmada");
});

test("item não apto ACEITO libera uso na reconstrução", () => {
  const r = interpretarDecisaoRevisao(divergencia("item_nao_apto"), decisao("ACEITO"));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "nao_apto_liberado");
});

test("inconsistência quantidade × valor unitário ACEITO marca saneamento", () => {
  const r = interpretarDecisaoRevisao(divergencia("quantidade_valor_unitario_inconsistente"), decisao("ACEITO"));
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "consistencia_saneada");
});

test("campo CORRIGIDO sem valor corrigido é não aplicável", () => {
  const r = interpretarDecisaoRevisao(
    divergencia("valor_diferente", { campoAfetado: "valorPrevisto" }),
    decisao("CORRIGIDO")
  );
  assert.equal(r.aplicavel, false);
  assert.equal(r.efeito.tipo, "decisao_corrigido_sem_valor");
});

test("campo CORRIGIDO com valor corrigido gera campo_corrigido", () => {
  const r = interpretarDecisaoRevisao(
    divergencia("valor_diferente", { campoAfetado: "valorPrevisto" }),
    decisao("CORRIGIDO", { payloadDecisao: { valorCorrigido: 1234.56 } })
  );
  assert.equal(r.aplicavel, true);
  assert.equal(r.efeito.tipo, "campo_corrigido");
  assert.equal(r.efeito.valor, 1234.56);
});

test("tipo de alerta desconhecido é não aplicável", () => {
  const r = interpretarDecisaoRevisao(divergencia("tipo_inexistente"), decisao("ACEITO"));
  assert.equal(r.aplicavel, false);
  assert.equal(r.efeito.tipo, "tipo_alerta_nao_suportado");
});

test("decisão não resolutiva (COMENTAR) não é aplicável", () => {
  const r = interpretarDecisaoRevisao(divergencia("item_nao_apto"), decisao("COMENTAR"));
  assert.equal(r.aplicavel, false);
  assert.equal(r.efeito.tipo, "decisao_nao_resolutiva");
});

test("validarRateioManual aceita rateio com valores de referência", () => {
  const rateios = extrairRateioManual({
    rateios: [
      { area: "OUVIDORIA", natureza: "CAPITAL", valorPrevistoReferencia: 1000 },
      { area: "ESCOLA PENAL", natureza: "CAPITAL", valorPrevistoReferencia: 500 },
    ],
  });
  assert.equal(validarRateioManual(rateios).valido, true);
});

test("validarRateioManual rejeita rateio com área vazia", () => {
  const rateios = extrairRateioManual({ rateio: [{ area: "", natureza: "CUSTEIO", percentualValor: 100 }] });
  assert.equal(validarRateioManual(rateios).valido, false);
});

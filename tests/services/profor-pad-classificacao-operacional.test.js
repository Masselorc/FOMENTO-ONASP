const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classificarOperacional,
} = require("../../backend/scripts/auditar-pendencias-profor-2022-profundo");

// Mapas vazios por padrão (sem bloqueio de segurança / payload alterado).
function mapasVazios(overrides = {}) {
  return {
    payloadAlterado: overrides.payloadAlterado || new Map(),
    naoReapresentadas: overrides.naoReapresentadas || new Map(),
    reapresentacaoIndeterminada: overrides.reapresentacaoIndeterminada || new Map(),
  };
}

test("1. divergência com decisão ACEITO canônica não vira pendencia_operacional_real só por regra de saldo residual", () => {
  // Caso #18: saldo residual com decisão anterior incompatível (rateio por área
  // operacional), mas sem divergência material de natureza, e já decidida.
  const item = {
    id: 18,
    classificacoes: [
      "saldo_residual_ok_nao_setorializado",
      "saldo_residual_decisao_anterior_incompativel",
      "ja_saneado_mas_ainda_pendente",
    ],
  };
  const divergencia = {
    id: 18,
    status: "ACEITO",
    bloqueia_publicacao: 1,
    temDecisaoResolutiva: true,
  };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.notEqual(resultado.categoria, "pendencia_operacional_real");
  assert.equal(resultado.categoria, "decisao_resolutiva_com_pendencia_tecnica");
  assert.equal(resultado.exigeDecisaoHumanaSubstantiva, false);
});

test("2. decisão resolutiva com pendência técnica de saldo residual é decisao_resolutiva_com_pendencia_tecnica", () => {
  const item = {
    id: 200,
    classificacoes: ["saldo_residual_rateado_indevidamente", "ja_saneado_mas_ainda_pendente"],
  };
  const divergencia = { id: 200, status: "CORRIGIDO", bloqueia_publicacao: 0, temDecisaoResolutiva: true };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.equal(resultado.categoria, "decisao_resolutiva_com_pendencia_tecnica");
});

test("3. payload alterado após decisão continua como revalidacao_necessaria", () => {
  // Mesmo carregando pendência técnica de saldo residual, payload alterado tem
  // precedência: a decisão precisa ser revalidada.
  const item = {
    id: 201,
    classificacoes: ["saldo_residual_decisao_anterior_incompativel"],
  };
  const divergencia = { id: 201, status: "ACEITO", bloqueia_publicacao: 1, temDecisaoResolutiva: true };
  const mapas = mapasVazios({ payloadAlterado: new Map([[201, [{ divergenciaId: 201 }]]]) });
  const resultado = classificarOperacional(item, divergencia, mapas);
  assert.equal(resultado.categoria, "revalidacao_necessaria");
});

test("4. saldo residual com natureza divergente e SEM decisão vira saneável por prevalência do PAD", () => {
  const item = {
    id: 300,
    classificacoes: ["saldo_residual_natureza_divergente"],
  };
  const divergencia = { id: 300, status: "PENDENTE", bloqueia_publicacao: 1, temDecisaoResolutiva: false };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.equal(resultado.categoria, "falso_positivo_saneavel");
  assert.equal(resultado.exigeDecisaoHumanaSubstantiva, false);
});

test("5. #44 — saldo residual com PAD prevalente não permanece pendencia_operacional_real", () => {
  // Regra fixa: o PAD novo prevalece sobre a memória antiga. A diferença fica
  // rastreada, mas não exige nova decisão humana substantiva.
  const item = {
    id: 44,
    classificacoes: [
      "saldo_residual_prevalencia_pad",
      "possivel_falso_positivo",
      "ja_saneado_mas_ainda_pendente",
    ],
  };
  const divergencia = { id: 44, status: "ACEITO", bloqueia_publicacao: 1, temDecisaoResolutiva: true };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.equal(resultado.categoria, "historico_saneado");
  assert.equal(resultado.exigeDecisaoHumanaSubstantiva, false);
});

test("6. saldo residual com incompatibilidade técnica SEM decisão resolutiva continua pendencia_operacional_real", () => {
  const item = {
    id: 301,
    classificacoes: ["saldo_residual_decisao_anterior_incompativel"],
  };
  const divergencia = { id: 301, status: "PENDENTE", bloqueia_publicacao: 1, temDecisaoResolutiva: false };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.equal(resultado.categoria, "pendencia_operacional_real");
});

test("7. pendência real material sem decisão resolutiva continua pendencia_operacional_real", () => {
  const item = { id: 302, classificacoes: ["pendencia_real"] };
  const divergencia = { id: 302, status: "PENDENTE", bloqueia_publicacao: 1, temDecisaoResolutiva: false };
  const resultado = classificarOperacional(item, divergencia, mapasVazios());
  assert.equal(resultado.categoria, "pendencia_operacional_real");
});

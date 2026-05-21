const test = require("node:test");
const assert = require("node:assert/strict");

const {
  stringifyOrdenado,
  gerarHashPayloadDivergencia,
  classificarPayloadDecisao,
  classificarDivergenciaReapresentacao,
} = require("../../backend/services/profor-2022/profor-pad-seguranca-pre-ativacao-service");

// Testes com objetos simulados. Exercitam apenas funções puras — não tocam o
// banco, não geram divergências/decisões reais.

test("stringifyOrdenado independe da ordem das chaves", () => {
  const a = stringifyOrdenado({ b: 1, a: 2, c: { y: 9, x: 8 } });
  const b = stringifyOrdenado({ c: { x: 8, y: 9 }, a: 2, b: 1 });
  assert.equal(a, b);
});

test("hash do payload é estável e independe da ordem das chaves", () => {
  const divergenciaA = {
    chave_divergencia: "tipo:abc123",
    tipo_alerta: "item_nao_apto",
    campo_afetado: "aptidao",
    numero_convenio: "937698",
    uf: "MT",
    chave_item: "937698::ITEM",
    payload_json: JSON.stringify({ campoAfetado: "aptidao", numeroConvenio: "937698", quantidadePad: 9 }),
  };
  const divergenciaB = {
    chave_divergencia: "tipo:abc123",
    tipo_alerta: "item_nao_apto",
    campo_afetado: "aptidao",
    numero_convenio: "937698",
    uf: "MT",
    chave_item: "937698::ITEM",
    payload_json: JSON.stringify({ quantidadePad: 9, numeroConvenio: "937698", campoAfetado: "aptidao" }),
  };
  assert.equal(gerarHashPayloadDivergencia(divergenciaA), gerarHashPayloadDivergencia(divergenciaB));
});

test("alteração no payload muda o hash", () => {
  const base = {
    chave_divergencia: "tipo:abc123",
    tipo_alerta: "item_nao_apto",
    campo_afetado: "aptidao",
    numero_convenio: "937698",
    uf: "MT",
    chave_item: "937698::ITEM",
    payload_json: JSON.stringify({ quantidadePad: 9 }),
  };
  const alterada = { ...base, payload_json: JSON.stringify({ quantidadePad: 10 }) };
  assert.notEqual(gerarHashPayloadDivergencia(base), gerarHashPayloadDivergencia(alterada));
});

test("decisão sem snapshot é classificada como decisao_sem_snapshot_payload", () => {
  const semLiberacao = classificarPayloadDecisao({
    temDivergencia: true,
    temSnapshot: false,
    hashSnapshot: null,
    hashAtual: "hash-atual",
    liberaAtivacao: false,
  });
  assert.equal(semLiberacao.classificacao, "decisao_sem_snapshot_payload");
  assert.equal(semLiberacao.bloqueia, false);

  const comLiberacao = classificarPayloadDecisao({
    temDivergencia: true,
    temSnapshot: false,
    hashSnapshot: null,
    hashAtual: "hash-atual",
    liberaAtivacao: true,
  });
  assert.equal(comLiberacao.classificacao, "decisao_sem_snapshot_payload");
  assert.equal(comLiberacao.bloqueia, true);
});

test("hash diferente vira payload_alterado_apos_decisao e bloqueia", () => {
  const resultado = classificarPayloadDecisao({
    temDivergencia: true,
    temSnapshot: true,
    hashSnapshot: "hash-antigo",
    hashAtual: "hash-novo",
    liberaAtivacao: false,
  });
  assert.equal(resultado.classificacao, "payload_alterado_apos_decisao");
  assert.equal(resultado.bloqueia, true);
});

test("hash igual mantém payload_preservado", () => {
  const resultado = classificarPayloadDecisao({
    temDivergencia: true,
    temSnapshot: true,
    hashSnapshot: "hash-igual",
    hashAtual: "hash-igual",
    liberaAtivacao: true,
  });
  assert.equal(resultado.classificacao, "payload_preservado");
  assert.equal(resultado.bloqueia, false);
});

test("divergência sem divergência associada bloqueia", () => {
  const resultado = classificarPayloadDecisao({
    temDivergencia: false,
    temSnapshot: false,
    hashSnapshot: null,
    hashAtual: null,
    liberaAtivacao: false,
  });
  assert.equal(resultado.classificacao, "divergencia_nao_encontrada_para_decisao");
  assert.equal(resultado.bloqueia, true);
});

test("divergência existente fora do conjunto atual vira não reapresentada", () => {
  const chavesGeradasHoje = new Set(["tipo:gerada1", "tipo:gerada2"]);
  const reapresentada = chavesGeradasHoje.has("tipo:antiga-sumida");
  const resultado = classificarDivergenciaReapresentacao({
    reapresentada,
    status: "PENDENTE",
    bloqueiaPublicacao: false,
    temDecisaoResolutiva: false,
  });
  assert.equal(resultado.classificacao, "nao_reapresentada_sem_decisao");
  assert.equal(resultado.bloqueia, false);
});

test("falha na geração atual deixa reapresentação indeterminada", () => {
  const resultado = classificarDivergenciaReapresentacao({
    reapresentada: null,
    status: "PENDENTE",
    bloqueiaPublicacao: true,
    temDecisaoResolutiva: true,
  });
  assert.equal(resultado.classificacao, "reapresentacao_indeterminada");
  assert.equal(resultado.bloqueia, false);
});

test("não reapresentada com decisão resolutiva ou bloqueante gera bloqueio", () => {
  const comDecisao = classificarDivergenciaReapresentacao({
    reapresentada: false,
    status: "ACEITO",
    bloqueiaPublicacao: false,
    temDecisaoResolutiva: true,
  });
  assert.equal(comDecisao.classificacao, "nao_reapresentada_com_decisao_resolutiva");
  assert.equal(comDecisao.bloqueia, true);

  const bloqueante = classificarDivergenciaReapresentacao({
    reapresentada: false,
    status: "PENDENTE",
    bloqueiaPublicacao: true,
    temDecisaoResolutiva: false,
  });
  assert.equal(bloqueante.classificacao, "nao_reapresentada_bloqueante");
  assert.equal(bloqueante.bloqueia, true);
});

test("divergência reapresentada não bloqueia", () => {
  const resultado = classificarDivergenciaReapresentacao({
    reapresentada: true,
    status: "PENDENTE",
    bloqueiaPublicacao: true,
    temDecisaoResolutiva: true,
  });
  assert.equal(resultado.classificacao, "reapresentada");
  assert.equal(resultado.bloqueia, false);
});

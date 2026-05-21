const test = require("node:test");
const assert = require("node:assert/strict");
const {
  descricaoCompativelPorAlteracaoControlada,
  valorCompativel,
  quantidadeCompativel,
  avaliarCompatibilidadeSubstituto,
  classificarAusenteComSubstituto,
} = require("../../backend/services/profor-2022/profor-pad-substituto-auditoria-service");

/* --------------------- compatibilidade de descrição --------------------- */

test("substituição de especificação técnica (2.4ghz x 4.2ghz) é alteração controlada", () => {
  assert.equal(
    descricaoCompativelPorAlteracaoControlada(
      "Notebook 4 núcleos 2.4ghz ram ddr 4 8gb",
      "Notebook 4 núcleos 4.2ghz ram ddr 4 8gb"
    ),
    true
  );
});

test("descrições idênticas (após normalização) são compatíveis", () => {
  assert.equal(descricaoCompativelPorAlteracaoControlada("Câmera Digital", "camera digital"), true);
});

test("descrições totalmente diferentes NÃO são alteração controlada", () => {
  assert.equal(descricaoCompativelPorAlteracaoControlada("Notebook 8gb", "Cadeira giratória"), false);
});

test("dois tokens divergentes NÃO são alteração controlada (sem fuzzy amplo)", () => {
  assert.equal(
    descricaoCompativelPorAlteracaoControlada("Notebook 2.4ghz preto", "Notebook 4.2ghz branco"),
    false
  );
});

test("token divergente sem dígito NÃO é alteração controlada", () => {
  assert.equal(descricaoCompativelPorAlteracaoControlada("Mesa redonda", "Mesa quadrada"), false);
});

test("valorCompativel respeita tolerância de R$ 0,01", () => {
  assert.equal(valorCompativel(7199.98, 7199.98), true);
  assert.equal(valorCompativel(7199.98, 7199.985), true);
  assert.equal(valorCompativel(7199.98, 7200.50), false);
});

test("quantidadeCompativel exige igualdade", () => {
  assert.equal(quantidadeCompativel(2, 2), true);
  assert.equal(quantidadeCompativel(2, 3), false);
});

/* ------------- classificação: caso #76 -> #23 (notebook) ------------- */

const DIV_76 = {
  id: 76,
  numero_convenio: "937782",
  uf: "AC",
  tipo_alerta: "item_ausente_no_pad",
  status: "PENDENTE",
};
const PAYLOAD_76 = {
  numeroConvenio: "937782",
  uf: "AC",
  descricaoMemoria: "Notebook 4 núcleos 2.4ghz ram ddr 4 8gb",
  naturezaMemoria: "CAPITAL",
  quantidadeMemoria: 2,
  valorUnitarioMemoria: 3599.99,
  valorPrevistoMemoria: 7199.98,
  valorExecutadoMemoria: 6229.86,
  saldoMemoria: 970.12,
};
const DIV_23 = {
  id: 23,
  numero_convenio: "937782",
  uf: "AC",
  tipo_alerta: "item_novo_sem_rateio",
  status: "ACEITO",
  valor_novo: "Notebook 4 núcleos 4.2ghz ram ddr 4 8gb",
};
const PAYLOAD_23 = {
  numeroConvenio: "937782",
  uf: "AC",
  descricaoPad: "Notebook 4 núcleos 4.2ghz ram ddr 4 8gb",
  naturezaPad: "CAPITAL",
  quantidadePad: 2,
  valorUnitarioPad: 3599.99,
  valorPrevistoPad: 7199.98,
  valorExecutadoPad: 6229.86,
  saldoPad: 970.12,
};

test("#76 é classificada como substituto_compativel vinculada a #23", () => {
  const r = classificarAusenteComSubstituto(DIV_76, PAYLOAD_76, [
    { divergencia: DIV_23, payload: PAYLOAD_23 },
  ]);
  assert.equal(r.classificacao, "substituto_compativel");
  assert.equal(r.substituto.divergenciaSubstitutaId, 23);
  assert.equal(r.substituto.decisaoSubstitutaJaAceita, true);
  assert.equal(r.substituto.criterios.descricaoCompativel, true);
});

test("avaliarCompatibilidadeSubstituto confirma todas as travas materiais para #76/#23", () => {
  const ausente = {
    numeroConvenio: "937782", uf: "AC", descricao: PAYLOAD_76.descricaoMemoria,
    natureza: "CAPITAL", quantidade: 2, valorUnitario: 3599.99,
    valorPrevisto: 7199.98, valorExecutado: 6229.86, saldo: 970.12,
  };
  const candidato = {
    numeroConvenio: "937782", uf: "AC", descricao: PAYLOAD_23.descricaoPad,
    natureza: "CAPITAL", quantidade: 2, valorUnitario: 3599.99,
    valorPrevisto: 7199.98, valorExecutado: 6229.86, saldo: 970.12,
  };
  const { criterios, todosCompativeis } = avaliarCompatibilidadeSubstituto(ausente, candidato);
  assert.equal(todosCompativeis, true);
  assert.equal(criterios.mesmoConvenio, true);
  assert.equal(criterios.quantidadeCompativel, true);
  assert.equal(criterios.valorPrevistoCompativel, true);
  assert.equal(criterios.saldoCompativel, true);
});

/* --------------- não saneia divergências materiais / ausência real --------------- */

test("ausente sem candidato compatível é classificado como ausencia_real_sem_substituto", () => {
  const r = classificarAusenteComSubstituto(DIV_76, PAYLOAD_76, []);
  assert.equal(r.classificacao, "ausencia_real_sem_substituto");
  assert.equal(r.substituto, null);
});

test("candidato com quantidade divergente NÃO vira substituto_compativel", () => {
  const cand = { ...DIV_23, id: 99 };
  const payloadCand = { ...PAYLOAD_23, quantidadePad: 5 };
  const r = classificarAusenteComSubstituto(DIV_76, PAYLOAD_76, [
    { divergencia: cand, payload: payloadCand },
  ]);
  assert.notEqual(r.classificacao, "substituto_compativel");
});

test("candidato com valor previsto divergente NÃO vira substituto_compativel", () => {
  const cand = { ...DIV_23, id: 98 };
  const payloadCand = { ...PAYLOAD_23, valorPrevistoPad: 9000.00 };
  const r = classificarAusenteComSubstituto(DIV_76, PAYLOAD_76, [
    { divergencia: cand, payload: payloadCand },
  ]);
  assert.notEqual(r.classificacao, "substituto_compativel");
});

test("candidato com natureza divergente NÃO vira substituto_compativel", () => {
  const cand = { ...DIV_23, id: 97 };
  const payloadCand = { ...PAYLOAD_23, naturezaPad: "CUSTEIO" };
  const r = classificarAusenteComSubstituto(DIV_76, PAYLOAD_76, [
    { divergencia: cand, payload: payloadCand },
  ]);
  assert.notEqual(r.classificacao, "substituto_compativel");
});

test("divergência ausente já decidida é classificada como ja_decidido", () => {
  const r = classificarAusenteComSubstituto(
    { ...DIV_76, status: "CORRIGIDO" },
    PAYLOAD_76,
    [{ divergencia: DIV_23, payload: PAYLOAD_23 }]
  );
  assert.equal(r.classificacao, "ja_decidido");
});

test("ausente sem descrição/dados materiais é dados_insuficientes", () => {
  const r = classificarAusenteComSubstituto(DIV_76, { numeroConvenio: "937782" }, []);
  assert.equal(r.classificacao, "dados_insuficientes");
});

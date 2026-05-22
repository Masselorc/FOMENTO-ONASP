const test = require("node:test");
const assert = require("node:assert/strict");

const {
  chaveIdentidadeMaterial,
  avaliarGrupo,
} = require("../../backend/scripts/auditar-identidade-material-pad-profor-2022");

const {
  classificarAchado,
  TIPOS_SENSIVEIS_A_PAREAMENTO,
} = require("../../backend/scripts/auditar-regressao-saneamentos-pad-profor-2022");

test("1. Mesma descrição Saldo Residual com CAPITAL e CUSTEIO deve ser risco alto em identidade material", () => {
  const grupoLines = [
    { descricaoOriginal: "Saldo Residual", descricaoNormalizada: "SALDO RESIDUAL", natureza: "CUSTEIO" },
    { descricaoOriginal: "Saldo Residual", descricaoNormalizada: "SALDO RESIDUAL", natureza: "CAPITAL" }
  ];
  const resultado = avaliarGrupo(grupoLines);
  assert.equal(resultado.severidade, "alto");
  assert.ok(resultado.riscos.includes("mesma_descricao_capital_e_custeio"));
  assert.ok(resultado.riscos.includes("descricao_com_multiplas_naturezas"));
});

test("2. Mesma descrição com códigos de natureza diferentes deve ser risco médio/material, mesmo dentro da mesma natureza", () => {
  const grupoLines = [
    { descricaoOriginal: "Camisa Tática", descricaoNormalizada: "CAMISA TATICA", natureza: "CUSTEIO", codigoNaturezaDespesa: "33903016" },
    { descricaoOriginal: "Camisa Tática", descricaoNormalizada: "CAMISA TATICA", natureza: "CUSTEIO", codigoNaturezaDespesa: "33903023" }
  ];
  const resultado = avaliarGrupo(grupoLines);
  assert.equal(resultado.severidade, "medio");
  assert.ok(resultado.riscos.includes("descricao_com_multiplos_codigos_natureza"));
});

test("3. chaveIdentidadeMaterial deve incluir número do convênio, descrição normalizada, natureza e código de natureza", () => {
  const linha = {
    numeroConvenio: "937265",
    descricaoNormalizada: "MEIA MILITAR",
    natureza: "CUSTEIO",
    codigoNaturezaDespesa: "33903016"
  };
  const chave = chaveIdentidadeMaterial(linha);
  assert.equal(chave, "937265::MEIA MILITAR::CUSTEIO::33903016");
});

test("4. Divergência ACEITA em grupo PAD multi-linha deve ser classificada como saneamento_suspeito_chave_fragil", () => {
  const divergencia = { id: 24, status: "ACEITO", tipoAlerta: "equivalencia_por_descricao_normalizada" };
  const fatores = ["chave_descricao_com_multiplas_linhas_pad"];
  const grupoPad = { totalLinhasPad: 2, naturezas: ["CUSTEIO"], codigosNatureza: ["33903099"] };
  const jaDiagnosticado = false;
  const temDecisaoResolutiva = true;

  const resultado = classificarAchado(divergencia, fatores, grupoPad, jaDiagnosticado, temDecisaoResolutiva);
  assert.equal(resultado.classificacao, "saneamento_suspeito_chave_fragil");
  assert.equal(resultado.reabrir, false);
});

test("5. Divergência PENDENTE em grupo PAD multi-linha não pode ser classificada como saneamento_suspeito_chave_fragil; deve virar divergencia_aberta_com_alerta_pareamento ou pendencia_material_potencial_aberta", () => {
  // Caso 1: mesma natureza/código
  const div1 = { id: 31, status: "PENDENTE", tipoAlerta: "item_nao_apto" };
  const fatores1 = ["chave_descricao_com_multiplas_linhas_pad"];
  const grupoPad1 = { totalLinhasPad: 2, naturezas: ["CUSTEIO"], codigosNatureza: ["33903099"] };
  
  const res1 = classificarAchado(div1, fatores1, grupoPad1, false, false);
  assert.equal(res1.classificacao, "divergencia_aberta_com_alerta_pareamento");
  assert.equal(res1.reabrir, false);

  // Caso 2: múltiplas naturezas/códigos (risco material)
  const div2 = { id: 46, status: "PENDENTE", tipoAlerta: "item_nao_apto" };
  const fatores2 = ["chave_descricao_com_multiplas_linhas_pad", "grupo_pad_com_multiplas_naturezas"];
  const grupoPad2 = { totalLinhasPad: 2, naturezas: ["CUSTEIO", "CAPITAL"], codigosNatureza: ["33903099", "44905299"] };
  
  const res2 = classificarAchado(div2, fatores2, grupoPad2, false, false);
  assert.equal(res2.classificacao, "pendencia_material_potencial_aberta");
  assert.equal(res2.reabrir, false);
});

test("6. #44 deve ser preservada como risco_confirmado_ja_diagnosticado", () => {
  const divergencia = { id: 44, status: "ACEITO", tipoAlerta: "item_nao_apto" };
  const fatores = ["chave_descricao_com_multiplas_linhas_pad", "grupo_pad_com_multiplas_naturezas"];
  const grupoPad = { totalLinhasPad: 2, naturezas: ["CUSTEIO", "CAPITAL"], codigosNatureza: ["33903099", "44905299"] };
  const jaDiagnosticado = true;
  const temDecisaoResolutiva = true;

  const resultado = classificarAchado(divergencia, fatores, grupoPad, jaDiagnosticado, temDecisaoResolutiva);
  assert.equal(resultado.classificacao, "risco_confirmado_ja_diagnosticado");
  assert.equal(resultado.reabrir, false);
});

test("7. Divergência de quantidade x valor unitário por arredondamento não deve ser reaberta por chave frágil", () => {
  // Divergência não sensível
  const tipoAlerta = "quantidade_valor_unitario_inconsistente";
  const sensivel = TIPOS_SENSIVEIS_A_PAREAMENTO.has(tipoAlerta);
  assert.equal(sensivel, false);
});

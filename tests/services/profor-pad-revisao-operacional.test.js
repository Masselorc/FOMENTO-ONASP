const test = require("node:test");
const assert = require("node:assert/strict");

const {
  enriquecerDivergenciaComAuditoria,
} = require("../../backend/services/profor-2022/profor-pad-revisao-decisao-service");

test("enriquece divergência com classificação operacional e PAD consolidado", () => {
  const divergencia = {
    id: 31,
    status: "PENDENTE",
    tipoAlerta: "item_nao_apto",
    acaoSugerida: "liberar_ou_manter_bloqueado",
  };
  const padConsolidado = {
    quantidade: 50,
    valorPrevisto: 16526.33,
    valorExecutado: 0,
    saldo: 16526.33,
    linhas: [{ linha: 22, quantidade: 30 }, { linha: 23, quantidade: 20 }],
  };
  const indices = {
    pendenciasProfundo: new Map([[31, {
      classificacaoOperacional: "falso_positivo_saneavel",
      classificacoes: ["item_nao_apto_sem_divergencia_material", "possivel_falso_positivo"],
      recomendacao: "Tratar como falso positivo saneável.",
      exigeDecisaoHumanaSubstantiva: false,
    }]]),
    itemNaoApto: new Map([[31, {
      classificacao: "falso_positivo_saneavel",
      descricao: "Calça Tática",
      naturezaMemoria: "CUSTEIO",
      quantidadeMemoria: 49.999486,
      valorUnitarioMemoria: 330.53,
      valorPrevistoMemoria: 16526.33,
      valorExecutadoMemoria: 0,
      saldoMemoria: 16526.33,
      padConsolidado,
      motivos: ["PAD equivalente fecha no conjunto."],
    }]]),
  };

  const enriquecida = enriquecerDivergenciaComAuditoria(divergencia, indices);

  assert.equal(enriquecida.categoriaOperacional, "falso_positivo_saneavel");
  assert.equal(enriquecida.falsoPositivoSaneavel, true);
  assert.equal(enriquecida.padConsolidado.quantidade, 50);
  assert.equal(enriquecida.memoriaConsolidada.quantidade, 50);
  assert.equal(enriquecida.memoriaConsolidada.quantidadeOriginalMemoria, 49.999486);
  assert.deepEqual(enriquecida.motivosSaneamento, ["PAD equivalente fecha no conjunto."]);
});

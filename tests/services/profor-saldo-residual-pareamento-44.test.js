const test = require("node:test");
const assert = require("node:assert/strict");

const {
  gerarLinhasItem,
} = require("../../backend/services/profor-2022/profor-pad-plano-reconstrucao-service");
const {
  detectarMisturas,
  misturaFechaPorNatureza,
} = require("../../backend/scripts/auditar-saldos-residuais-profor-2022");
const {
  classificarDivergencia,
} = require("../../backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022");

// Convênio 938128/SP, "Saldo Residual": a chave de item tem DUAS linhas PAD —
// uma CAPITAL (R$ 20.704,73) e uma CUSTEIO (R$ 71,36) — e ambas compartilham
// os rateios da memória do item conhecido #212 (que são todos CAPITAL).

test("reconstrução: linha PAD CUSTEIO de saldo residual com rateios só CAPITAL não gera impedimento de natureza divergente", () => {
  const itemPadCusteio = {
    numeroConvenio: "938128",
    uf: "SP",
    descricaoOriginal: "Saldo Residual",
    chaveItem: "938128::SALDO RESIDUAL",
    natureza: "CUSTEIO",
    valorTotalPrevisto: 71.36,
    valorTotalExecutado: 0,
    quantidade: 1,
    valorUnitario: 71.36,
  };
  const rateiosMemoriaCapital = [
    { area: "N/A", natureza: "CAPITAL", quantidade_referencia: 1, valor_previsto_referencia: 22279.73 },
    { area: "NAO INFORMADO", natureza: "CAPITAL", quantidade_referencia: 1, valor_previsto_referencia: 71.36 },
  ];
  const resultado = gerarLinhasItem(itemPadCusteio, rateiosMemoriaCapital, {
    fonteRateio: "relatorios-pad-rateados",
  });
  // Cada linha PAD de saldo residual é de uma natureza própria; o PAD é a
  // fonte de verdade. A linha CUSTEIO não é divergência de reconstrução só
  // porque a memória consolidada tinha rateios CAPITAL.
  assert.equal(
    resultado.impedimentosItem.some((i) => i.tipo === "saldo_residual_natureza_divergente"),
    false,
    "não deve haver impedimento saldo_residual_natureza_divergente na reconstrução"
  );
  assert.equal(
    resultado.alertasItem.some((a) => a.tipo === "saldo_residual_natureza_sem_rateio_memoria"),
    true,
    "deve registrar alerta informativo de rastreabilidade"
  );
  assert.equal(resultado.linhas.length, 1);
  assert.equal(resultado.linhas[0].natureza, "CUSTEIO");
});

test("reconstrução: linha PAD CAPITAL com rateio CAPITAL na memória continua sem impedimento", () => {
  const itemPadCapital = {
    numeroConvenio: "938128",
    uf: "SP",
    descricaoOriginal: "Saldo Residual",
    chaveItem: "938128::SALDO RESIDUAL",
    natureza: "CAPITAL",
    valorTotalPrevisto: 20704.73,
    valorTotalExecutado: 0,
    quantidade: 1,
    valorUnitario: 20704.73,
  };
  const rateiosMemoriaCapital = [
    { area: "N/A", natureza: "CAPITAL", quantidade_referencia: 1, valor_previsto_referencia: 22279.73 },
  ];
  const resultado = gerarLinhasItem(itemPadCapital, rateiosMemoriaCapital, {});
  assert.equal(
    resultado.impedimentosItem.some((i) => i.tipo === "saldo_residual_natureza_divergente"),
    false
  );
  assert.equal(
    resultado.alertasItem.some((a) => a.tipo === "saldo_residual_natureza_sem_rateio_memoria"),
    false
  );
});

test("reconstrução: rateio de saldo residual por área operacional ainda gera impedimento", () => {
  const itemPad = {
    numeroConvenio: "999999",
    uf: "SP",
    descricaoOriginal: "Saldo Residual",
    chaveItem: "999999::SALDO RESIDUAL",
    natureza: "CAPITAL",
    valorTotalPrevisto: 100,
    valorTotalExecutado: 0,
    quantidade: 1,
    valorUnitario: 100,
  };
  const rateiosOperacionais = [
    { area: "OUVIDORIA", natureza: "CAPITAL", quantidade_referencia: 1, valor_previsto_referencia: 100 },
  ];
  const resultado = gerarLinhasItem(itemPad, rateiosOperacionais, {});
  assert.equal(
    resultado.impedimentosItem.some((i) => i.tipo === "saldo_residual_rateado_indevidamente"),
    true,
    "rateio por área operacional permanece impeditivo"
  );
});

test("misturaFechaPorNatureza só é verdadeira quando todas as naturezas fecham", () => {
  assert.equal(misturaFechaPorNatureza(null), false);
  assert.equal(misturaFechaPorNatureza({ porNatureza: [], todasNaturezasFecham: true }), false);
  assert.equal(
    misturaFechaPorNatureza({ porNatureza: [{ natureza: "CAPITAL" }], todasNaturezasFecham: false }),
    false
  );
  assert.equal(
    misturaFechaPorNatureza({ porNatureza: [{ natureza: "CAPITAL" }], todasNaturezasFecham: true }),
    true
  );
});

test("detectarMisturas: #44 — divergência material de saldo residual permanece natureza_divergente", () => {
  // Dois registros da mesma chave mista (CAPITAL + CUSTEIO) cuja comparação por
  // natureza NÃO fecha: é divergência material real, não falso positivo.
  const registros = [
    {
      numeroConvenio: "938128",
      descricaoNormalizada: "SALDO RESIDUAL",
      natureza: "CAPITAL",
      divergenciaId: 44,
      classificacao: "saldo_residual_ok_nao_setorializado",
    },
    {
      numeroConvenio: "938128",
      descricaoNormalizada: "SALDO RESIDUAL",
      natureza: "CUSTEIO",
      divergenciaId: 44,
      classificacao: "saldo_residual_ok_nao_setorializado",
    },
  ];
  const comparacoes = new Map([
    [44, { porNatureza: [{ natureza: "CAPITAL" }, { natureza: "CUSTEIO" }], todasNaturezasFecham: false }],
  ]);
  const resultado = detectarMisturas(registros, comparacoes);
  for (const item of resultado) {
    assert.equal(item.misturaCapitalCusteio, true);
    assert.equal(item.classificacao, "saldo_residual_natureza_divergente");
  }
});

test("detectarMisturas: mistura que fecha por natureza vira falso positivo saneável", () => {
  const registros = [
    {
      numeroConvenio: "938277",
      descricaoNormalizada: "SALDO REMANESCENTE",
      natureza: "CAPITAL",
      divergenciaId: 46,
      classificacao: "saldo_residual_ok_nao_setorializado",
    },
    {
      numeroConvenio: "938277",
      descricaoNormalizada: "SALDO REMANESCENTE",
      natureza: "CUSTEIO",
      divergenciaId: 46,
      classificacao: "saldo_residual_ok_nao_setorializado",
    },
  ];
  const comparacoes = new Map([
    [46, { porNatureza: [{ natureza: "CAPITAL" }, { natureza: "CUSTEIO" }], todasNaturezasFecham: true }],
  ]);
  const resultado = detectarMisturas(registros, comparacoes);
  for (const item of resultado) {
    assert.equal(item.naturezasFechamComPad, true);
    assert.equal(item.classificacao, "saldo_residual_ok_nao_setorializado");
  }
});

test("classificarDivergencia: saldo residual já decidido carrega comparação por natureza", () => {
  // Mesmo com decisão resolutiva (ja_decidido), uma divergência de saldo
  // residual precisa expor comparacaoSaldoResidualPorNatureza para que o
  // auditor de saldos residuais consiga avaliar fechamento por natureza.
  const divergencia = {
    id: 44,
    numeroConvenio: "938128",
    uf: "SP",
    chaveItem: "938128::SALDO RESIDUAL",
    tipoAlerta: "item_nao_apto",
    status: "ACEITO",
    temDecisaoResolutiva: true,
    payload: {
      memoria: { descricao: "Saldo Residual", natureza: "CAPITAL", quantidade: 1, valorUnitario: 22279.73, valorPrevisto: 22351.09, valorExecutado: 0, saldo: 22351.09 },
      pad: { descricao: "Saldo Residual", natureza: "CUSTEIO", quantidade: 1, valorUnitario: 71.36, valorPrevisto: 71.36, valorExecutado: 0, saldo: 71.36 },
      rateiosAtivos: [
        { area: "N/A", natureza: "CAPITAL", quantidadeReferencia: 1, valorPrevistoReferencia: 22279.73, valorExecutadoReferencia: 0 },
        { area: "NAO INFORMADO", natureza: "CAPITAL", quantidadeReferencia: 1, valorPrevistoReferencia: 71.36, valorExecutadoReferencia: 0 },
      ],
    },
  };
  const itensPad = [
    { numeroConvenio: "938128", descricaoOriginal: "Saldo Residual", natureza: "CAPITAL", quantidade: 1, valorUnitario: 20704.73, valorTotalPrevisto: 20704.73, valorTotalExecutado: 0, saldo: 20704.73 },
    { numeroConvenio: "938128", descricaoOriginal: "Saldo Residual", natureza: "CUSTEIO", quantidade: 1, valorUnitario: 71.36, valorTotalPrevisto: 71.36, valorTotalExecutado: 0, saldo: 71.36 },
  ];
  const resultado = classificarDivergencia(divergencia, { itensPad });
  assert.equal(resultado.classificacao, "ja_decidido");
  assert.ok(
    resultado.comparacaoSaldoResidualPorNatureza,
    "divergência de saldo residual já decidida deve carregar comparação por natureza"
  );
  const naturezas = resultado.comparacaoSaldoResidualPorNatureza.porNatureza.map((n) => n.natureza);
  assert.deepEqual(naturezas.sort(), ["CAPITAL", "CUSTEIO"]);
});

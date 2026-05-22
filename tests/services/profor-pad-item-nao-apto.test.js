const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classificarDivergencia,
  detectarRateiosQuantidadeSuspeita,
} = require("../../backend/scripts/auditar-item-nao-apto-sem-divergencia-pad-profor-2022");

const DIVERGENCIA_CALCA_TATICA = {
  id: 31,
  status: "PENDENTE",
  tipoAlerta: "item_nao_apto",
  numeroConvenio: "937265",
  uf: "MS",
  chaveItem: "937265::CALCA TATICA",
  payload: {
    numeroConvenio: "937265",
    uf: "MS",
    chaveItem: "937265::CALCA TATICA",
    memoria: {
      descricao: "Calça Tática",
      area: "CORREGEDORIA, OUVIDORIA",
      natureza: "CUSTEIO",
      quantidade: 49.999486,
      valorUnitario: 330.53,
      valorPrevisto: 16526.33,
      valorExecutado: 0,
      saldo: 16526.33,
    },
    pad: {
      descricao: "Calça Tática",
      natureza: "CUSTEIO",
      quantidade: 30,
      valorUnitario: 330.53,
      valorPrevisto: 9915.8,
      valorExecutado: 0,
      saldo: 9915.8,
    },
    rateiosAtivos: [
      {
        area: "CORREGEDORIA",
        natureza: "CUSTEIO",
        quantidadeReferencia: 300,
        valorPrevistoReferencia: 9915.8,
        valorExecutadoReferencia: 0,
      },
      {
        area: "OUVIDORIA",
        natureza: "CUSTEIO",
        quantidadeReferencia: 200,
        valorPrevistoReferencia: 6610.53,
        valorExecutadoReferencia: 0,
      },
    ],
    alertasOriginais: [
      { tipo: "fechamento_valor_inconsistente", detalhe: "Saldo antigo inconsistente." },
    ],
  },
};

const LINHAS_PAD_CALCA_TATICA = [
  {
    instrumento: "937265",
    arquivo: "Planilhas/profor-2022/instrumentos/RelatorioItensDespesasPAD_937265.xls",
    aba: "937265",
    linha: 22,
    descricao: "Calça Tática",
    natureza: "CUSTEIO",
    quantidade: 30,
    valorUnitario: 330.53,
    valorTotalPrevisto: 9915.8,
    valorTotalExecutado: 0,
    saldo: 9915.8,
  },
  {
    instrumento: "937265",
    arquivo: "Planilhas/profor-2022/instrumentos/RelatorioItensDespesasPAD_937265.xls",
    aba: "937265",
    linha: 23,
    descricao: "Calça Tática",
    natureza: "CUSTEIO",
    quantidade: 20,
    valorUnitario: 330.53,
    valorTotalPrevisto: 6610.53,
    valorTotalExecutado: 0,
    saldo: 6610.53,
  },
];

test("Calça Tática 937265/MS vira falso positivo saneável quando o PAD equivalente fecha no conjunto", () => {
  const resultado = classificarDivergencia(DIVERGENCIA_CALCA_TATICA, {
    itensPad: LINHAS_PAD_CALCA_TATICA,
  });

  assert.equal(resultado.classificacao, "falso_positivo_saneavel");
  assert.equal(resultado.padConsolidado.totalLinhasPadEquivalentes, 2);
  assert.equal(resultado.padConsolidado.quantidade, 50);
  assert.equal(resultado.padConsolidado.valorPrevisto, 16526.33);
  assert.equal(resultado.padConsolidado.valorExecutado, 0);
  assert.equal(resultado.padConsolidado.saldo, 16526.33);
  assert.match(resultado.motivos.join(" "), /linha PAD isolada/);
});

test("detecta quantidade legada inflada por fator 10 em rateios da memória", () => {
  const resultado = detectarRateiosQuantidadeSuspeita(
    { memoria: DIVERGENCIA_CALCA_TATICA.payload.memoria },
    DIVERGENCIA_CALCA_TATICA.payload
  );

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].fatorInflacaoDecimal10, true);
  assert.ok(Math.abs(resultado[0].quantidadeEstimada - 30) <= 0.001);
  assert.ok(Math.abs(resultado[1].quantidadeEstimada - 20) <= 0.001);
});

// Divergência #46 — Convênio 938277/MA — SALDO REMANESCENTE.
// Memória consolidada "CAPITAL, CUSTEIO" (R$ 13.192,33). O PAD novo tem duas
// linhas de mesma descrição: CUSTEIO R$ 5.924,45 e CAPITAL R$ 7.267,88.
const DIVERGENCIA_SALDO_REMANESCENTE_938277 = {
  id: 46,
  status: "PENDENTE",
  tipoAlerta: "item_nao_apto",
  numeroConvenio: "938277",
  uf: "MA",
  chaveItem: "938277::SALDO REMANESCENTE",
  payload: {
    numeroConvenio: "938277",
    uf: "MA",
    chaveItem: "938277::SALDO REMANESCENTE",
    memoria: {
      descricao: "SALDO REMANESCENTE",
      area: "N/A",
      natureza: "CAPITAL, CUSTEIO",
      quantidade: 2.22676,
      valorUnitario: 5924.45,
      valorPrevisto: 13192.33,
      valorExecutado: 0,
      saldo: 13192.33,
    },
    pad: {
      descricao: "SALDO REMANESCENTE",
      natureza: "CUSTEIO",
      quantidade: 1,
      valorUnitario: 5924.45,
      valorPrevisto: 5924.45,
      valorExecutado: 0,
      saldo: 5924.45,
    },
    rateiosAtivos: [
      { area: "N/A", natureza: "CAPITAL", quantidadeReferencia: 10, valorPrevistoReferencia: 7267.88, valorExecutadoReferencia: 0 },
      { area: "N/A", natureza: "CUSTEIO", quantidadeReferencia: 10, valorPrevistoReferencia: 5924.45, valorExecutadoReferencia: 0 },
    ],
  },
};

const LINHAS_PAD_SALDO_REMANESCENTE_938277 = [
  {
    instrumento: "938277",
    aba: "938277",
    linha: 27,
    descricao: "SALDO REMANESCENTE",
    natureza: "CUSTEIO",
    quantidade: 1,
    valorUnitario: 5924.45,
    valorTotalPrevisto: 5924.45,
    valorTotalExecutado: 0,
    saldo: 5924.45,
  },
  {
    instrumento: "938277",
    aba: "938277",
    linha: 52,
    descricao: "SALDO REMANESCENTE",
    natureza: "CAPITAL",
    quantidade: 1,
    valorUnitario: 7267.88,
    valorTotalPrevisto: 7267.88,
    valorTotalExecutado: 0,
    saldo: 7267.88,
  },
];

test("#46 SALDO REMANESCENTE não gera pendência: CAPITAL e CUSTEIO fecham com o PAD por natureza", () => {
  const resultado = classificarDivergencia(DIVERGENCIA_SALDO_REMANESCENTE_938277, {
    itensPad: LINHAS_PAD_SALDO_REMANESCENTE_938277,
  });

  assert.equal(resultado.classificacao, "falso_positivo_saneavel");
  const comparacao = resultado.comparacaoSaldoResidualPorNatureza;
  assert.equal(comparacao.naturezaMista, true);
  assert.equal(comparacao.todasNaturezasFecham, true);
  assert.equal(comparacao.porNatureza.length, 2);
  const capital = comparacao.porNatureza.find((n) => n.natureza === "CAPITAL");
  const custeio = comparacao.porNatureza.find((n) => n.natureza === "CUSTEIO");
  assert.equal(capital.fecha, true);
  assert.equal(capital.pad.valorPrevisto, 7267.88);
  assert.equal(custeio.fecha, true);
  assert.equal(custeio.pad.valorPrevisto, 5924.45);
  // O total fecha apenas como conferência, não como chave de equivalência.
  assert.equal(comparacao.totalApenasConferencia, true);
  assert.equal(comparacao.totalPadPrevisto, 13192.33);
});

test("CAPITAL e CUSTEIO não são pareados entre si: PAD sem natureza correspondente fica divergente", () => {
  // Memória só tem CAPITAL; o PAD só tem uma linha de CUSTEIO. Não há
  // correspondente de mesma natureza — comparar o total seria falso positivo.
  const divergencia = {
    id: 44,
    status: "PENDENTE",
    tipoAlerta: "item_nao_apto",
    numeroConvenio: "938128",
    uf: "SP",
    chaveItem: "938128::SALDO RESIDUAL",
    payload: {
      numeroConvenio: "938128",
      memoria: {
        descricao: "Saldo Residual",
        area: "N/A, NAO INFORMADO",
        natureza: "CAPITAL",
        valorPrevisto: 22351.09,
        valorExecutado: 0,
        saldo: 22351.09,
      },
      pad: { descricao: "Saldo Residual", natureza: "CUSTEIO", valorPrevisto: 71.36, valorExecutado: 0, saldo: 71.36 },
      rateiosAtivos: [
        { area: "N/A", natureza: "CAPITAL", quantidadeReferencia: 10, valorPrevistoReferencia: 22279.73, valorExecutadoReferencia: 0 },
        { area: "NAO INFORMADO", natureza: "CAPITAL", quantidadeReferencia: 1, valorPrevistoReferencia: 71.36, valorExecutadoReferencia: 0 },
      ],
    },
  };
  const linhasPad = [
    { instrumento: "938128", aba: "938128", linha: 9, descricao: "Saldo Residual", natureza: "CUSTEIO", quantidade: 1, valorUnitario: 71.36, valorTotalPrevisto: 71.36, valorTotalExecutado: 0, saldo: 71.36 },
  ];
  const resultado = classificarDivergencia(divergencia, { itensPad: linhasPad });

  assert.equal(resultado.classificacao, "divergencia_material");
  const comparacao = resultado.comparacaoSaldoResidualPorNatureza;
  assert.equal(comparacao.todasNaturezasFecham, false);
  const capital = comparacao.porNatureza.find((n) => n.natureza === "CAPITAL");
  const custeio = comparacao.porNatureza.find((n) => n.natureza === "CUSTEIO");
  // CAPITAL tem memória mas nenhuma linha PAD de CAPITAL.
  assert.equal(capital.fecha, false);
  assert.equal(capital.pad, null);
  // CUSTEIO tem linha PAD mas nenhuma parcela de memória de CUSTEIO.
  assert.equal(custeio.fecha, false);
  assert.equal(custeio.memoria, null);
});

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

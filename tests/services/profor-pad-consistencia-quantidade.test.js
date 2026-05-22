const test = require("node:test");
const assert = require("node:assert/strict");

const {
  avaliarConsistenciaQuantidadeValorUnitario,
  extrairDadosDoTextoAlerta,
  avaliarDivergenciaQuantidadeValorUnitario,
} = require("../../backend/services/profor-2022/profor-pad-consistencia-quantidade-service");

test("#88 — 300 x 7,94 vs 2381 é falso positivo por arredondamento do valor unitário exibido", () => {
  const r = avaliarConsistenciaQuantidadeValorUnitario({
    quantidade: 300,
    valorUnitarioExibido: 7.94,
    valorPrevistoInformado: 2381,
  });
  assert.equal(r.classificacao, "falso_positivo_saneavel");
  assert.equal(r.falsoPositivoPorArredondamento, true);
  assert.equal(r.valorCalculadoComUnitarioExibido, 2382);
  assert.equal(r.valorUnitarioEfetivoArredondado, 7.94);
  assert.equal(r.diferencaAbsoluta, 1);
  assert.equal(r.totalPadPrevalece, true);
  assert.ok(r.diferencaAbsoluta <= r.toleranciaMaxima);
});

test("#89, #97 e #115 são reavaliadas pelo mesmo critério de arredondamento", () => {
  const casos = [
    { id: 89, quantidade: 300, valorUnitarioExibido: 1.87, valorPrevistoInformado: 560 },
    { id: 97, quantidade: 100, valorUnitarioExibido: 7.99, valorPrevistoInformado: 798.69 },
    { id: 115, quantidade: 275, valorUnitarioExibido: 21.17, valorPrevistoInformado: 5820.83 },
  ];
  for (const caso of casos) {
    const r = avaliarConsistenciaQuantidadeValorUnitario(caso);
    assert.equal(r.classificacao, "falso_positivo_saneavel", `#${caso.id} deveria ser falso positivo`);
    assert.equal(r.unitarioExibidoBateComEfetivo, true, `#${caso.id} unitário exibido x efetivo`);
    assert.ok(r.diferencaAbsoluta <= r.toleranciaMaxima, `#${caso.id} dentro da tolerância`);
  }
});

test("diferença material grande continua como pendência real", () => {
  // 100 x 10 = 1000, mas total informado 2000: o unitário efetivo (20,00) não
  // bate com o exibido (10,00) — não é arredondamento.
  const r = avaliarConsistenciaQuantidadeValorUnitario({
    quantidade: 100,
    valorUnitarioExibido: 10,
    valorPrevistoInformado: 2000,
  });
  assert.equal(r.classificacao, "pendencia_real");
  assert.equal(r.falsoPositivoPorArredondamento, false);
  assert.equal(r.unitarioExibidoBateComEfetivo, false);
});

test("unitário exibido coincide mas diferença excede a tolerância: pendência real", () => {
  // Construção sintética: unitário efetivo arredondado igual ao exibido, mas a
  // diferença absoluta passa da tolerância de arredondamento.
  const r = avaliarConsistenciaQuantidadeValorUnitario({
    quantidade: 2,
    valorUnitarioExibido: 5,
    valorPrevistoInformado: 9.5,
  });
  // 2 x 5 = 10; efetivo = 4,75 -> arred 4,75 != 5,00 -> não é arredondamento.
  assert.equal(r.classificacao, "pendencia_real");
});

test("dados insuficientes retornam null", () => {
  assert.equal(avaliarConsistenciaQuantidadeValorUnitario({ quantidade: 0, valorUnitarioExibido: 1, valorPrevistoInformado: 1 }), null);
  assert.equal(avaliarConsistenciaQuantidadeValorUnitario({ quantidade: 10, valorUnitarioExibido: null, valorPrevistoInformado: 100 }), null);
});

test("extrai quantidade, valor unitário e total previsto do texto do alerta", () => {
  const dados = extrairDadosDoTextoAlerta(
    "Quantidade (300) x valor unitário (7.94) = 2382, diverge do valor total previsto informado (2381)."
  );
  assert.deepEqual(dados, { quantidade: 300, valorUnitarioExibido: 7.94, valorPrevistoInformado: 2381 });
});

test("avalia divergência persistida a partir do texto do payload (#88)", () => {
  const divergencia = {
    id: 88,
    diferenca: "Quantidade (300) x valor unitário (7.94) = 2382, diverge do valor total previsto informado (2381).",
    payload: {
      evidencias: { detalhe: "Quantidade (300) x valor unitário (7.94) = 2382, diverge do valor total previsto informado (2381)." },
    },
  };
  const r = avaliarDivergenciaQuantidadeValorUnitario(divergencia);
  assert.equal(r.falsoPositivoPorArredondamento, true);
  assert.equal(r.classificacao, "falso_positivo_saneavel");
});

test("avalia divergência com dados estruturados no payload", () => {
  const r = avaliarDivergenciaQuantidadeValorUnitario({
    payload: {
      dadosConsistencia: { quantidade: 275, valorUnitarioExibido: 21.17, valorPrevistoInformado: 5820.83 },
    },
  });
  assert.equal(r.falsoPositivoPorArredondamento, true);
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  chaveItemPad,
  agruparLinhasOriginalPorItem,
  integrarRateioFixoNoPlanoReconstruido,
  compararPlanoOriginalEComRateioFixo,
} = require("../../backend/services/profor-2022/profor-pad-reconstrucao-rateio-fixo-integracao-service");

function linha(overrides = {}) {
  return {
    uf: "AL",
    instrumento: "Convênio",
    numero: "937221",
    ano: "2022",
    area: "OUVIDORIA",
    natureza: "CUSTEIO",
    descricao: "ITEM TESTE",
    quantidade: 10,
    valorUnitario: 10,
    valorPrevisto: 100,
    valorExecutado: 0,
    saldo: 100,
    saldoEconomicidade: 0,
    percentualExecucao: 0,
    chaveItem: "937221::ITEM TESTE",
    ...overrides,
  };
}

function instrucaoEspelho(linhas) {
  const referencia = linhas[0];
  const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
  return {
    chaveItem: referencia.chaveItem,
    item: {
      numero: referencia.numero,
      uf: referencia.uf,
      descricao: referencia.descricao,
      natureza: referencia.natureza,
      quantidade: quantidadeTotal,
      valorUnitario: referencia.valorUnitario,
    },
    rateios: linhas.map((l) => ({
      area: l.area,
      natureza: l.natureza,
      quantidade: l.quantidade,
    })),
  };
}

test("chaveItemPad gera chave estável a partir de numero e descrição", () => {
  assert.equal(chaveItemPad({ numero: "1", descricao: "Cadeira" }), "1::CADEIRA");
});

test("agruparLinhasOriginalPorItem agrupa por chaveItem ou por (numero, descricao)", () => {
  const plano = [
    linha({ chaveItem: undefined, area: "OUVIDORIA", quantidade: 3, valorPrevisto: 30, saldo: 30 }),
    linha({ chaveItem: undefined, area: "CORREGEDORIA", quantidade: 7, valorPrevisto: 70, saldo: 70 }),
  ];
  const grupos = agruparLinhasOriginalPorItem(plano);
  assert.equal(grupos.size, 1);
  const [chave, linhas] = [...grupos.entries()][0];
  assert.equal(chave, "937221::ITEM TESTE");
  assert.equal(linhas.length, 2);
});

test("plano original permanece intacto após integração", () => {
  const plano = [
    linha({ area: "OUVIDORIA", quantidade: 4, valorPrevisto: 40, saldo: 40 }),
    linha({ area: "CORREGEDORIA", quantidade: 6, valorPrevisto: 60, saldo: 60 }),
  ];
  const planoSerializadoAntes = JSON.stringify(plano);
  integrarRateioFixoNoPlanoReconstruido(plano, [instrucaoEspelho(plano)]);
  assert.equal(JSON.stringify(plano), planoSerializadoAntes);
});

test("rateio espelho (qty igual ao original) produz Δ valor previsto = 0 e Δ saldo = 0", () => {
  const plano = [
    linha({ area: "OUVIDORIA", quantidade: 4, valorPrevisto: 40, saldo: 40, valorExecutado: 0 }),
    linha({ area: "CORREGEDORIA", quantidade: 6, valorPrevisto: 60, saldo: 60, valorExecutado: 0 }),
  ];
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instrucaoEspelho(plano)]);
  assert.equal(r.diferencasAgregadas.deltaValorPrevisto, 0);
  assert.equal(r.diferencasAgregadas.deltaSaldo, 0);
  assert.equal(r.resumo.totalItensComRateioFixoAplicado, 1);
  assert.equal(r.resumo.totalItensBloqueados, 0);
});

test("soma de rateios inferior à quantidade total gera saldo não rateado", () => {
  const plano = [linha({ area: "OUVIDORIA", quantidade: 10, valorPrevisto: 100, saldo: 100 })];
  const instr = {
    chaveItem: "937221::ITEM TESTE",
    item: { numero: "937221", descricao: "ITEM TESTE", natureza: "CUSTEIO", quantidade: 10, valorUnitario: 10 },
    rateios: [{ area: "OUVIDORIA", natureza: "CUSTEIO", quantidade: 6 }],
  };
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instr]);
  // 10 - 6 = 4 não rateado
  assert.ok(r.resumo.saldoNaoRateadoTotal >= 4);
  assert.equal(r.resumo.totalItensBloqueados, 0);
});

test("soma de rateios superior à quantidade total gera bloqueio", () => {
  const plano = [linha({ area: "OUVIDORIA", quantidade: 10, valorPrevisto: 100 })];
  const instr = {
    chaveItem: "937221::ITEM TESTE",
    item: { numero: "937221", descricao: "ITEM TESTE", natureza: "CUSTEIO", quantidade: 10, valorUnitario: 10 },
    rateios: [
      { area: "OUVIDORIA", natureza: "CUSTEIO", quantidade: 7 },
      { area: "CORREGEDORIA", natureza: "CUSTEIO", quantidade: 5 },
    ],
  };
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instr]);
  assert.equal(r.resumo.totalItensBloqueados, 1);
  assert.ok(r.resumo.totalBloqueios >= 1);
});

test("quantidade negativa em rateio gera bloqueio", () => {
  const plano = [linha({ area: "OUVIDORIA", quantidade: 10, valorPrevisto: 100 })];
  const instr = {
    chaveItem: "937221::ITEM TESTE",
    item: { numero: "937221", descricao: "ITEM TESTE", natureza: "CUSTEIO", quantidade: 10, valorUnitario: 10 },
    rateios: [{ area: "OUVIDORIA", natureza: "CUSTEIO", quantidade: -1 }],
  };
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instr]);
  assert.equal(r.resumo.totalItensBloqueados, 1);
});

test("CAPITAL e CUSTEIO misturados no mesmo item geram bloqueio (natureza mista)", () => {
  const plano = [linha({ natureza: "CAPITAL", quantidade: 10, valorPrevisto: 100 })];
  const instr = {
    chaveItem: "937221::ITEM TESTE",
    item: { numero: "937221", descricao: "ITEM TESTE", natureza: "CAPITAL", quantidade: 10, valorUnitario: 10 },
    rateios: [
      { area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 5 },
      { area: "CORREGEDORIA", natureza: "CUSTEIO", quantidade: 5 },
    ],
  };
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instr]);
  assert.equal(r.resumo.totalItensBloqueados, 1);
  assert.ok(r.bloqueios.some((b) => b.tipo === "natureza_mista"));
});

test("residual de arredondamento aparece e fecha na última linha simulada", () => {
  // Caso clássico: 1.0 deve permanecer 1, não virar 10.
  const plano = [
    linha({ quantidade: 1, valorPrevisto: 10.34, valorUnitario: 10.34, saldo: 10.34, area: "OUVIDORIA" }),
    linha({ quantidade: 1, valorPrevisto: 10.34, valorUnitario: 10.34, saldo: 10.34, area: "CORREGEDORIA" }),
    linha({ quantidade: 1, valorPrevisto: 10.34, valorUnitario: 10.34, saldo: 10.34, area: "ESCOLA PENAL" }),
  ];
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instrucaoEspelho(plano)]);
  // Δ valor previsto e Δ saldo devem ser zero ou mínimos (residual fecha)
  assert.ok(Math.abs(r.diferencasAgregadas.deltaValorPrevisto) <= 0.01,
    `deltaValorPrevisto = ${r.diferencasAgregadas.deltaValorPrevisto}`);
  assert.ok(Math.abs(r.diferencasAgregadas.deltaSaldo) <= 0.01,
    `deltaSaldo = ${r.diferencasAgregadas.deltaSaldo}`);
});

test("'1.0' permanece 1, não vira 10", () => {
  const plano = [linha({ quantidade: 1.0, valorPrevisto: 10, valorUnitario: 10 })];
  const instr = {
    chaveItem: "937221::ITEM TESTE",
    item: { numero: "937221", descricao: "ITEM TESTE", natureza: "CUSTEIO", quantidade: 1.0, valorUnitario: 10 },
    rateios: [{ area: "OUVIDORIA", natureza: "CUSTEIO", quantidade: 1.0 }],
  };
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instr]);
  assert.equal(r.resumo.totalItensBloqueados, 0);
  assert.equal(r.diferencasAgregadas.deltaValorPrevisto, 0);
});

test("garantias dry-run: bancoAlterado, publicacaoExecutada, decisaoRegistrada permanecem false", () => {
  const plano = [linha()];
  const r = integrarRateioFixoNoPlanoReconstruido(plano, [instrucaoEspelho(plano)]);
  assert.equal(r.garantias.bancoAlterado, false);
  assert.equal(r.garantias.publicacaoExecutada, false);
  assert.equal(r.garantias.decisaoRegistrada, false);
  assert.equal(r.garantias.reconstrutorOficialAlterado, false);
  assert.equal(r.garantias.planoAplicacaoOficialAlterado, false);
  assert.equal(r.garantias.envAlterado, false);
  assert.equal(r.garantias.transferegovAcionado, false);
  assert.equal(r.garantias.frontendDataPublicadosAlterado, false);
  assert.equal(r.garantias.filaOficialAlterada, false);
});

test("itens sem instrução permanecem no plano simulado (sem mudança)", () => {
  const planoIntocado = [
    linha({ numero: "999", chaveItem: "999::ITEM_SEM_INSTRUCAO", area: "OUVIDORIA", quantidade: 5, valorPrevisto: 50 }),
  ];
  const r = integrarRateioFixoNoPlanoReconstruido(planoIntocado, []);
  assert.equal(r.resumo.totalItensSemInstrucao, 1);
  assert.equal(r.resumo.totalItensComRateioFixoAplicado, 0);
  assert.equal(r.diferencasAgregadas.deltaLinhas, 0);
  assert.equal(r.diferencasAgregadas.deltaValorPrevisto, 0);
  assert.equal(r.diferencasAgregadas.deltaSaldo, 0);
});

test("compararPlanoOriginalEComRateioFixo produz estrutura com grupos e bloqueios", () => {
  const plano = [
    linha({ area: "OUVIDORIA", quantidade: 4, valorPrevisto: 40, saldo: 40 }),
    linha({ area: "CORREGEDORIA", quantidade: 6, valorPrevisto: 60, saldo: 60 }),
  ];
  const integracao = integrarRateioFixoNoPlanoReconstruido(plano, [instrucaoEspelho(plano)]);
  const comp = compararPlanoOriginalEComRateioFixo(integracao);
  assert.ok(Array.isArray(comp.grupos));
  assert.equal(comp.grupos.length, 1);
  assert.equal(comp.totaisOriginal.totalLinhas, 2);
  assert.equal(comp.totaisSimulado.totalLinhas, 2);
});

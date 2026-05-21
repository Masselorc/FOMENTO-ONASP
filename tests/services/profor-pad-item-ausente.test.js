const test = require("node:test");
const assert = require("node:assert/strict");
const { divergenciasAusentes } = require("../../backend/services/profor-2022/profor-pad-revisao-service");

/**
 * Testes do payload de item_ausente_no_pad (campoAfetado = 'existencia').
 *
 * Regra: valorAnterior/valorNovo são marcadores de ESTADO, nunca descrição
 * textual; os valores financeiros da memória vão em campos próprios do payload.
 */

function montarSaneamento(itens, equivalencias = []) {
  return {
    itensConhecidosAusentesNoPad: itens,
    equivalenciasDiacriticoSaneadas: equivalencias,
  };
}

test("item_ausente_no_pad NÃO usa descrição textual em valorAnterior/valorNovo", () => {
  const [div] = divergenciasAusentes(
    montarSaneamento([
      {
        numeroConvenio: "937221",
        uf: "MS",
        chaveItem: "937221::AR-CONDICIONADO",
        descricaoOriginalReferencia: "Ar condicionado Split 24000 BTUs",
        naturezasEncontradas: ["CAPITAL"],
        quantidadeReferencia: 3,
        valorUnitarioReferencia: 4500,
        valorPrevistoReferencia: 13500,
        valorExecutadoReferencia: 0,
        saldoReferencia: 13500,
        totalRateiosAtivos: 2,
      },
    ])
  );

  assert.equal(div.tipoAlerta, "item_ausente_no_pad");
  assert.equal(div.campoAfetado, "existencia");
  assert.equal(div.valorAnterior, "presente_na_memoria");
  assert.equal(div.valorNovo, "ausente_no_pad");
  // Garante que a descrição NÃO vazou para os marcadores de estado.
  assert.notEqual(div.valorAnterior, "Ar condicionado Split 24000 BTUs");
});

test("payload financeiro da memória é preenchido quando há rateio ativo", () => {
  const [div] = divergenciasAusentes(
    montarSaneamento([
      {
        numeroConvenio: "937221",
        uf: "MS",
        chaveItem: "937221::CADEIRA",
        descricaoOriginalReferencia: "Cadeira Longarina plástica 03 lugares",
        naturezasEncontradas: ["CUSTEIO"],
        quantidadeReferencia: 10,
        valorUnitarioReferencia: 320.5,
        valorPrevistoReferencia: 3205,
        valorExecutadoReferencia: 1000,
        saldoReferencia: 2205,
        totalRateiosAtivos: 4,
      },
    ])
  );

  const p = div.payload;
  assert.equal(p.descricaoMemoria, "Cadeira Longarina plástica 03 lugares");
  assert.equal(p.naturezaMemoria, "CUSTEIO");
  assert.equal(p.quantidadeMemoria, 10);
  assert.equal(p.valorUnitarioMemoria, 320.5);
  assert.equal(p.valorPrevistoMemoria, 3205);
  assert.equal(p.valorExecutadoMemoria, 1000);
  assert.equal(p.saldoMemoria, 2205);
  assert.equal(p.totalRateiosAtivosMemoria, 4);
  // memoria e antes presentes para a comparação Antes x Depois.
  assert.ok(p.memoria);
  assert.ok(p.antes);
  assert.equal(p.memoria.descricao, "Cadeira Longarina plástica 03 lugares");
});

test("payload financeiro usa null (não descrição) quando valores não existem", () => {
  const [div] = divergenciasAusentes(
    montarSaneamento([
      {
        numeroConvenio: "937221",
        uf: "MS",
        chaveItem: "937221::ITEM-SEM-VALOR",
        descricaoOriginalReferencia: "Item sem valores materiais",
        naturezasEncontradas: [],
      },
    ])
  );

  const p = div.payload;
  assert.equal(p.quantidadeMemoria, null);
  assert.equal(p.valorUnitarioMemoria, null);
  assert.equal(p.valorPrevistoMemoria, null);
  assert.equal(p.valorExecutadoMemoria, null);
  assert.equal(p.saldoMemoria, null);
  // Nunca usa a descrição como fallback de valor financeiro.
  assert.notEqual(p.valorPrevistoMemoria, "Item sem valores materiais");
});

test("saneadoPorDiacritico fica true quando há equivalência saneada correspondente", () => {
  const [div] = divergenciasAusentes(
    montarSaneamento(
      [
        {
          numeroConvenio: "937782",
          uf: "AC",
          chaveItem: "937782::DESKTOP-VIDEO",
          descricaoOriginalReferencia: "Desktop para edição de video",
          naturezasEncontradas: ["CAPITAL"],
          quantidadeReferencia: 1,
          valorUnitarioReferencia: 14849,
          valorPrevistoReferencia: 14849,
          valorExecutadoReferencia: 0,
          saldoReferencia: 14849,
          totalRateiosAtivos: 1,
        },
      ],
      [
        {
          numeroConvenio: "937782",
          descricaoOriginalMemoria: "Desktop para edição de video",
          descricaoOriginalPad: "Desktop para edição de vídeo",
        },
      ]
    )
  );

  assert.equal(div.payload.saneadoPorDiacritico, true);
});

test("saneadoPorDiacritico fica false para item ausente sem correspondência", () => {
  const [div] = divergenciasAusentes(
    montarSaneamento(
      [
        {
          numeroConvenio: "937221",
          uf: "MS",
          chaveItem: "937221::CADEIRA",
          descricaoOriginalReferencia: "Cadeira Secretária Fixa",
          naturezasEncontradas: ["CUSTEIO"],
        },
      ],
      [] // nenhuma equivalência saneada
    )
  );

  assert.equal(div.payload.saneadoPorDiacritico, false);
});

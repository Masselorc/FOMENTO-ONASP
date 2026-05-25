const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  montarRevisoesPlanoPad,
} = require("../../backend/services/profor-2022/profor-pad-revisoes-plano-service");
const {
  salvarAreaRevisaoPlano,
  salvarRateioRevisaoPlano,
} = require("../../backend/services/profor-2022/profor-pad-revisoes-plano-decisoes-service");

function montarDados() {
  return montarRevisoesPlanoPad({
    recarga: {
      dataHora: "2026-05-25T10:00:00.000Z",
      sucesso: true,
      planoAplicacaoReconstruido: [
        {
          uf: "DF",
          numero: "900001",
          area: "OUVIDORIA",
          natureza: "CUSTEIO",
          descricao: "Notebook operacional",
          quantidade: 6,
          valorUnitario: 3000,
          valorPrevisto: 18000,
          origemReconstrucao: "memoria_rateio_operacional",
          chaveItem: "900001::notebook",
          itemConhecidoId: 1,
          codigoNaturezaDespesa: "339030",
        },
        {
          uf: "DF",
          numero: "900001",
          area: "CORREGEDORIA",
          natureza: "CUSTEIO",
          descricao: "Notebook operacional",
          quantidade: 4,
          valorUnitario: 3000,
          valorPrevisto: 12000,
          origemReconstrucao: "memoria_rateio_operacional",
          chaveItem: "900001::notebook",
          itemConhecidoId: 1,
          codigoNaturezaDespesa: "339030",
        },
      ],
      impedimentos: [
        {
          tipo: "item_novo_sem_rateio_memorizado",
          uf: "DF",
          numeroConvenio: "900001",
          descricao: "Drone novo",
          natureza: "CAPITAL",
          codigoNaturezaDespesa: "449052",
          quantidade: 1,
          valorUnitario: 10000,
          chaveItem: "900001::drone",
          detalhe: "Item PAD sem rateio memorizado.",
        },
      ],
      alertas: [],
    },
  });
}

function opcoesTeste(dados, capturas = []) {
  return {
    carregarRevisoesPlano: () => dados,
    persistirRateiosOperacionais: (parametros) => {
      capturas.push(parametros);
      return 123;
    },
  };
}

test("alteracao de area valida e aceita sem alterar quantidade", () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);
  const capturas = [];

  const resultado = salvarAreaRevisaoPlano({
    uf: "DF",
    numeroConvenio: mae.numeroConvenio,
    parentId: mae.id,
    linhaFilhaId: filha.id,
    chaveItem: mae.chaveItem,
    areaAnterior: filha.area,
    areaNova: "OUVIDORIA",
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidade: filha.quantidade,
    quantidadeOriginal: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
  }, opcoesTeste(dados, capturas));

  assert.equal(resultado.linhaFilhaAtualizada.area, "OUVIDORIA");
  assert.equal(resultado.linhaFilhaAtualizada.quantidade, filha.quantidade);
  assert.equal(resultado.statusGrupo, "AREA_ALTERADA");
  assert.equal(capturas[0].evento, "ALTERAR_AREA_RATEIO");
});

test("area invalida e rejeitada", () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  assert.throws(() => salvarAreaRevisaoPlano({
    parentId: mae.id,
    linhaFilhaId: filha.id,
    areaNova: "FINANCEIRO",
    numeroConvenio: mae.numeroConvenio,
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidadeOriginal: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
  }, opcoesTeste(dados)), /Área inválida/);
});

test("rateio com soma divergente e rejeitado", () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");

  assert.throws(() => salvarRateioRevisaoPlano({
    parentId: mae.id,
    numeroConvenio: mae.numeroConvenio,
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidadeOriginal: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
    linhas: [
      { area: "OUVIDORIA", quantidade: 5 },
      { area: "CORREGEDORIA", quantidade: 4 },
    ],
  }, opcoesTeste(dados)), /Soma das quantidades/);
});

test("rateio com soma correta e aceito", () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");
  const capturas = [];

  const resultado = salvarRateioRevisaoPlano({
    parentId: mae.id,
    numeroConvenio: mae.numeroConvenio,
    chaveItem: mae.chaveItem,
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidadeOriginal: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
    linhas: [
      { area: "OUVIDORIA", quantidade: 5 },
      { area: "CORREGEDORIA", quantidade: 5 },
    ],
  }, opcoesTeste(dados, capturas));

  assert.equal(resultado.linhasFilhasAtualizadas.length, 2);
  assert.equal(resultado.linhasFilhasAtualizadas[0].natureza, mae.natureza);
  assert.equal(resultado.statusGrupo, "RATEIO_ALTERADO");
  assert.equal(capturas[0].evento, "ALTERAR_QUANTIDADE_RATEIO");
});

test("item novo classificado deixa de ficar como NAO_CLASSIFICADO", () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  const resultado = salvarAreaRevisaoPlano({
    parentId: mae.id,
    linhaFilhaId: filha.id,
    areaAnterior: "NAO_CLASSIFICADO",
    areaNova: "ESCOLA_PENAL",
    numeroConvenio: mae.numeroConvenio,
    chaveItem: mae.chaveItem,
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidadeOriginal: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
  }, opcoesTeste(dados));

  assert.notEqual(resultado.linhaFilhaAtualizada.area, "NAO_CLASSIFICADO");
  assert.notEqual(resultado.linhaFilhaAtualizada.status, "AREA_NAO_CLASSIFICADA");
});

test("servico de decisoes nao chama origem antiga nem publicacao", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-revisoes-plano-decisoes-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("compararPlanosPadDryRun"), false);
  assert.equal(source.includes("gestao_financeira_ouvidoria"), false);
  assert.equal(source.includes("comparar-origens"), false);
  assert.equal(source.includes("publicarDadosEstaticos"), false);
});

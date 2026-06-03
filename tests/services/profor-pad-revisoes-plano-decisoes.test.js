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
  persistirRateiosOperacionais,
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
    pularRegerarRecarga: true,
    persistirRateiosOperacionais: (parametros) => {
      capturas.push(parametros);
      return 123;
    },
  };
}

function contextoPersistencia(sufixo = "notebook") {
  return {
    itemConhecidoId: null,
    chaveItem: `900001::${sufixo}`,
    numeroConvenio: "900001",
    uf: "DF",
    descricao: "Notebook operacional",
    descricaoNormalizada: "notebook operacional",
    natureza: "CUSTEIO",
    codigoNatureza: "339030",
    quantidadeOriginal: 10,
    valorUnitario: 3000,
  };
}

function linhasPersistencia() {
  return [
    { area: "OUVIDORIA", natureza: "CUSTEIO", quantidade: 4, valorTotal: 12000 },
    { area: "CORREGEDORIA", natureza: "CUSTEIO", quantidade: 6, valorTotal: 18000 },
  ];
}

function criarClienteMock(respostas = []) {
  const chamadas = [];
  return {
    chamadas,
    async query(sql, params = []) {
      chamadas.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      const resposta = respostas.shift();
      if (resposta instanceof Error) throw resposta;
      if (typeof resposta === "function") return resposta(sql, params);
      return resposta || { rows: [] };
    },
  };
}

test("persistirRateiosOperacionais cria item conhecido e substitui rateios em Postgres", async () => {
  const client = criarClienteMock([
    { rows: [] },
    { rows: [{ id: 321 }] },
    { rows: [{ area: "NAO_CLASSIFICADO", natureza: "CUSTEIO", quantidade_referencia: "10" }] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
  ]);

  const itemConhecidoId = await persistirRateiosOperacionais({
    contexto: contextoPersistencia(),
    linhas: linhasPersistencia(),
    evento: "ALTERAR_QUANTIDADE_RATEIO",
    detalhe: "Teste unitario D2",
  }, {
    withTransaction: async (callback) => callback(client),
  });

  assert.equal(itemConhecidoId, 321);
  assert.match(client.chamadas[0].sql, /SELECT id FROM profor_2022_itens_conhecidos WHERE chave_item = \$1/);
  assert.match(client.chamadas[1].sql, /INSERT INTO profor_2022_itens_conhecidos/);
  assert.match(client.chamadas[2].sql, /FROM profor_2022_item_rateios/);
  assert.match(client.chamadas[3].sql, /UPDATE profor_2022_item_rateios SET ativo = false/);
  assert.match(client.chamadas[4].sql, /INSERT INTO profor_2022_item_rateios/);
  assert.match(client.chamadas[5].sql, /INSERT INTO profor_2022_item_rateios/);
  assert.match(client.chamadas[6].sql, /INSERT INTO profor_2022_revisao_logs/);
  assert.equal(client.chamadas[4].params[0], 321);
  assert.equal(client.chamadas[4].params[6], 40);
  assert.equal(client.chamadas[5].params[6], 60);
  assert.equal(client.chamadas[6].params[1], "ALTERAR_QUANTIDADE_RATEIO");
});

test("persistirRateiosOperacionais reutiliza item conhecido por chave sem duplicar item", async () => {
  const client = criarClienteMock([
    { rows: [{ id: 654 }] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
  ]);

  const itemConhecidoId = await persistirRateiosOperacionais({
    contexto: contextoPersistencia("item-existente"),
    linhas: linhasPersistencia(),
    evento: "ALTERAR_AREA_RATEIO",
    detalhe: "Teste item existente",
  }, {
    withTransaction: async (callback) => callback(client),
  });

  assert.equal(itemConhecidoId, 654);
  assert.equal(client.chamadas.some((c) => /INSERT INTO profor_2022_itens_conhecidos/.test(c.sql)), false);
  assert.equal(client.chamadas.filter((c) => /INSERT INTO profor_2022_item_rateios/.test(c.sql)).length, 2);
});

test("persistirRateiosOperacionais propaga falha de Postgres sem fallback silencioso", async () => {
  const client = criarClienteMock([
    { rows: [] },
    { rows: [{ id: 987 }] },
    { rows: [] },
    { rows: [] },
    new Error("falha postgres simulada"),
  ]);
  const eventosTransacao = [];

  await assert.rejects(
    () => persistirRateiosOperacionais({
      contexto: contextoPersistencia("erro"),
      linhas: linhasPersistencia(),
      evento: "ALTERAR_QUANTIDADE_RATEIO",
      detalhe: "Teste erro",
    }, {
      withTransaction: async (callback) => {
        eventosTransacao.push("BEGIN");
        try {
          const resultado = await callback(client);
          eventosTransacao.push("COMMIT");
          return resultado;
        } catch (erro) {
          eventosTransacao.push("ROLLBACK");
          throw erro;
        }
      },
    }),
    /falha postgres simulada/
  );

  assert.deepEqual(eventosTransacao, ["BEGIN", "ROLLBACK"]);
  assert.equal(client.chamadas.some((c) => /INSERT INTO profor_2022_revisao_logs/.test(c.sql)), false);
});

test("alteracao de area valida e aceita sem alterar quantidade", async () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);
  const capturas = [];

  const resultado = await salvarAreaRevisaoPlano({
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

test("area invalida e rejeitada", async () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  await assert.rejects(() => salvarAreaRevisaoPlano({
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

test("rateio com soma divergente e rejeitado", async () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");

  await assert.rejects(() => salvarRateioRevisaoPlano({
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

test("rateio com soma correta e aceito", async () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.descricao === "Notebook operacional");
  const capturas = [];

  const resultado = await salvarRateioRevisaoPlano({
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

test("item novo classificado deixa de ficar como NAO_CLASSIFICADO", async () => {
  const dados = montarDados();
  const mae = dados.linhasMae.DF.find((linha) => linha.tipo === "ITEM_NOVO");
  const filha = dados.linhasFilhas.DF.find((linha) => linha.parentId === mae.id);

  const resultado = await salvarAreaRevisaoPlano({
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

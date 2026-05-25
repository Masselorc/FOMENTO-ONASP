const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  executarDryRunPadsTransferegov,
} = require("../../backend/services/profor-2022/profor-pad-transferegov-dry-run-service");

function item(overrides = {}) {
  return {
    instrumento: "937782",
    tipoDespesa: "BEM",
    descricao: "Computador completo",
    codigoNaturezaDespesa: "44.90.52",
    unidade: "UN",
    quantidade: 2,
    valorUnitario: 100,
    valorTotalPrevisto: 200,
    valorTotalExecutado: 50,
    saldo: 150,
    ...overrides,
  };
}

function referencia() {
  return {
    caminhoRelativo: "memoria/teste.json",
    relatorios: [{ codigoInstrumento: "937782", arquivo: "Planilhas/profor-2022/instrumentos/teste.xls" }],
    itens: [item()],
  };
}

test("dry-run compara convenio por HTTP e nao chama fallback Playwright por padrao", async () => {
  const chamadas = [];
  const resultado = await executarDryRunPadsTransferegov({
    referencia: referencia(),
    extrairPad: async (instrumento, opcoes) => {
      chamadas.push({ instrumento, opcoes });
      return {
        sucesso: true,
        origem: "http",
        dados: { itens: [item()] },
        diagnostico: { status: 200 },
      };
    },
  });

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].instrumento, "937782");
  assert.equal(chamadas[0].opcoes.fallbackPlaywright, false);
  assert.equal(resultado.resumo.totalAptosParaImportacaoTecnica, 1);
  assert.equal(resultado.resumo.aptoParaImportacaoTecnica, true);
});

test("dry-run respeita filtro por convenio e limite", async () => {
  const instrumentos = [];
  const resultado = await executarDryRunPadsTransferegov({
    referencia: {
      relatorios: [
        { codigoInstrumento: "937782" },
        { codigoInstrumento: "937783" },
      ],
      itens: [item(), item({ instrumento: "937783" })],
    },
    convenio: "937783",
    limite: 1,
    extrairPad: async (instrumento) => {
      instrumentos.push(instrumento);
      return { sucesso: true, origem: "http", dados: { itens: [item({ instrumento })] } };
    },
  });

  assert.deepEqual(instrumentos, ["937783"]);
  assert.equal(resultado.resumo.totalConveniosEsperados, 1);
});

test("dry-run registra falha tecnica estruturada", async () => {
  const resultado = await executarDryRunPadsTransferegov({
    referencia: referencia(),
    extrairPad: async () => ({
      sucesso: false,
      origem: "falhou",
      erros: [{ origem: "http", mensagem: "HTTP indisponivel" }],
    }),
  });

  assert.equal(resultado.resumo.totalConveniosComFalha, 1);
  assert.equal(resultado.resultados[0].errosTecnicos[0].origem, "http");
  assert.equal(resultado.resumo.aptoParaImportacaoTecnica, false);
});

test("diferenca historica contra Excel nao bloqueia importacao tecnica", async () => {
  const resultado = await executarDryRunPadsTransferegov({
    referencia: referencia(),
    extrairPad: async () => ({
      sucesso: true,
      origem: "http",
      dados: { itens: [item({ valorTotalExecutado: 40, saldo: 160 })] },
    }),
  });

  assert.equal(resultado.resultados[0].aptoParaImportacaoTecnica, true);
  assert.equal(resultado.resultados[0].equivalenteHistorico, false);
  assert.equal(resultado.resumo.totalAptosParaImportacaoTecnica, 1);
  assert.equal(resultado.resumo.totalComDiferencaHistoricaExcel, 1);
});

test("item novo ou suprimido em relacao ao Excel nao bloqueia importacao tecnica", async () => {
  const resultado = await executarDryRunPadsTransferegov({
    referencia: referencia(),
    extrairPad: async () => ({
      sucesso: true,
      origem: "http",
      dados: { itens: [item({ descricao: "Item novo", valorTotalPrevisto: 10, valorTotalExecutado: 0, saldo: 10 })] },
    }),
  });

  assert.equal(resultado.resultados[0].aptoParaImportacaoTecnica, true);
  assert.equal(resultado.resultados[0].atualizacoesDetectadas > 0, true);
});

test("item atual sem descricao codigo quantidade ou valor previsto bloqueia importacao tecnica", async () => {
  const resultado = await executarDryRunPadsTransferegov({
    referencia: referencia(),
    extrairPad: async () => ({
      sucesso: true,
      origem: "http",
      dados: {
        itens: [
          item({
            descricao: "",
            codigoNaturezaDespesa: "",
            quantidade: Number.NaN,
            valorTotalPrevisto: Number.NaN,
          }),
        ],
      },
    }),
  });

  assert.equal(resultado.resultados[0].aptoParaImportacaoTecnica, false);
  assert.deepEqual(
    resultado.resultados[0].bloqueiosTecnicos.map((bloqueio) => bloqueio.tipo),
    ["item_sem_descricao", "item_sem_codigo_natureza", "quantidade_nao_parseavel", "valor_total_previsto_nao_parseavel"]
  );
});

test("dry-run nao persiste cache, nao altera banco, nao chama recarga PAD, DETRU ou rendimentos", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-transferegov-dry-run-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("sqlite"), false);
  assert.equal(source.includes("better-sqlite3"), false);
  assert.equal(source.includes("writeFileSync"), false);
  assert.equal(source.includes("recarregarPadsOperacional"), false);
  assert.equal(source.includes("detru"), false);
  assert.equal(source.includes("rendimentos"), false);
});

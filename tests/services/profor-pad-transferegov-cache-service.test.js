const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  montarCachePadTransferegov,
  validarCachePadTransferegov,
  salvarCachePadTransferegov,
  lerCachePadTransferegov,
  obterCaminhoCache,
  existeCachePadTransferegov,
} = require("../../backend/services/profor-2022/profor-pad-transferegov-cache-service");

function criarConvenioMockValido(overrides = {}) {
  return {
    numeroConvenio: "937782",
    uf: "DF",
    origemUsada: "http",
    extraidoEm: new Date().toISOString(),
    totalItens: 1,
    totalizadores: {
      concedente: "SENAPPEN",
      convenente: "MJ",
      situacao: "Em execução",
      valorTotalPrevisto: 100.0,
      valorTotalExecutado: 50.0,
      saldoTotal: 50.0,
    },
    hashConteudo: "hash_convenio_mock",
    aptoParaImportacaoTecnica: true,
    bloqueiosTecnicos: [],
    avisos: [],
    itens: [
      {
        instrumento: "937782",
        tipoDespesa: "Bem",
        descricao: "Item de Teste",
        codigoNaturezaDespesa: "449052",
        codigoNaturezaNormalizado: "44.90.52",
        natureza: "CAPITAL",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 100.0,
        valorTotalPrevisto: 100.0,
        valorTotalExecutado: 50.0,
        saldo: 50.0,
      },
    ],
    ...overrides,
  };
}

test("1. monta cache válido com convênios aptos", () => {
  const conveniosMock = [criarConvenioMockValido()];
  const cache = montarCachePadTransferegov(conveniosMock);

  assert.equal(cache.versao, 1);
  assert.equal(cache.origem, "transferegov");
  assert.equal(cache.totalConvenios, 1);
  assert.equal(cache.totalItens, 1);
  assert.ok(cache.hashGlobal);
  assert.equal(cache.convenios[0].numeroConvenio, "937782");
  assert.equal(cache.convenios[0].aptoParaImportacaoTecnica, true);
});

test("2. rejeita cache com convênio inapto", () => {
  const conveniosMock = [
    criarConvenioMockValido({
      aptoParaImportacaoTecnica: false,
      bloqueiosTecnicos: [{ tipo: "erro_teste", detalhe: "Algum erro de validação" }],
    }),
  ];
  const cache = montarCachePadTransferegov(conveniosMock);
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /não está tecnicamente apto/);
});

test("3. rejeita cache sem itens", () => {
  const conveniosMock = [
    criarConvenioMockValido({
      itens: [],
      totalItens: 0,
    }),
  ];
  const cache = montarCachePadTransferegov(conveniosMock);
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /não possui itens/);
});

test("4. rejeita cache sem origem 'transferegov'", () => {
  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  cache.origem = "outra_origem";
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /origem do cache inválida/i);
});

test("5. escrita atômica não corrompe cache anterior", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profor-cache-test-"));
  const opcoes = { repoRoot: tmpDir };

  // Salvar cache inicial válido
  const cacheInicial = montarCachePadTransferegov([criarConvenioMockValido()]);
  salvarCachePadTransferegov(cacheInicial, opcoes);

  // Tentativa de salvar cache inválido (deve falhar e preservar o arquivo anterior intacto)
  const cacheInvalido = montarCachePadTransferegov([
    criarConvenioMockValido({
      aptoParaImportacaoTecnica: false,
      bloqueiosTecnicos: [{ tipo: "bloqueio", detalhe: "Erro" }],
    }),
  ]);

  assert.throws(() => {
    salvarCachePadTransferegov(cacheInvalido, opcoes);
  });

  // Ler novamente do disco para verificar se o conteúdo do primeiro salvamento foi preservado
  const cacheLido = lerCachePadTransferegov(opcoes);
  assert.ok(cacheLido);
  assert.equal(cacheLido.convenios[0].numeroConvenio, "937782");

  // Limpar pasta temporária
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("6. leitura retorna último cache válido", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profor-cache-test-"));
  const opcoes = { repoRoot: tmpDir };

  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  salvarCachePadTransferegov(cache, opcoes);

  const cacheLido = lerCachePadTransferegov(opcoes);
  assert.ok(cacheLido);
  assert.equal(cacheLido.hashGlobal, cache.hashGlobal);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("7. cache não contém HTML bruto", () => {
  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  cache.convenios[0].itens[0].descricao = "<html><body>bruto</body></html>";
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /dados proibidos/);
});

test("8. cache não contém ViewState", () => {
  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  cache.convenios[0].itens[0].descricao = "algum valor com ViewState contido";
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /dados proibidos/);
});

test("9. cache não contém cookie", () => {
  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  cache.convenios[0].itens[0].descricao = "conteúdo com session cookie";
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /dados proibidos/);
});

test("10. cache não contém authorization", () => {
  const cache = montarCachePadTransferegov([criarConvenioMockValido()]);
  cache.convenios[0].itens[0].descricao = "header com Authorization: Bearer";
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, false);
  assert.match(validacao.erro, /dados proibidos/);
});

test("11. divergência histórica contra Excel não impede cache", () => {
  // Divergências/avisos contra Excel não devem bloquear o cache
  const convenioComAviso = criarConvenioMockValido({
    avisos: [{ tipo: "divergencia_excel", detalhe: "Item com valor unitário diferente no Excel" }],
  });
  const cache = montarCachePadTransferegov([convenioComAviso]);
  const validacao = validarCachePadTransferegov(cache);

  assert.equal(validacao.valido, true);
});

test("12-15. serviço não chama Excel, recarga PAD, DETRU ou rendimentos", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-transferegov-cache-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  // Verificar ausência de importações proibidas
  assert.equal(source.includes("report-reader"), false);
  assert.equal(source.includes("recarga-operacional"), false);
  assert.equal(source.includes("carregador-operacional"), false);
  assert.equal(source.includes("detru"), false);
  assert.equal(source.includes("rendimentos"), false);
  assert.equal(source.includes("XLSX"), false);
  assert.equal(source.includes("xlsx"), false);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  validarEstruturaCachePadTransferegov,
  validarSegurancaCachePadTransferegov,
  validarCompletudeCachePadTransferegov,
  validarConsistenciaInternaCachePadTransferegov,
  gerarDiagnosticoCachePadTransferegov
} = require("../../backend/services/profor-2022/profor-pad-transferegov-cache-validacao-service");

// Helper para gerar um cache mock completo válido com 15 convênios e 525 itens
function criarCacheMockCompleto(overrides = {}) {
  const convenios = [];
  let totalItens = 0;
  for (let i = 0; i < 15; i++) {
    const itens = [];
    for (let j = 0; j < 35; j++) {
      itens.push({
        instrumento: `93700${i}`,
        tipoDespesa: "Bem",
        descricao: `Descrição Item ${i}-${j}`,
        codigoNaturezaDespesa: "449052",
        codigoNaturezaNormalizado: "44.90.52",
        natureza: "CAPITAL",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 10.0,
        valorTotalPrevisto: 10.0,
        valorTotalExecutado: 10.0,
        saldo: 0.0,
      });
    }
    totalItens += itens.length;

    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(itens));
    const hashConteudo = hash.digest("hex");

    convenios.push({
      numeroConvenio: `93700${i}`,
      uf: "DF",
      origemUsada: "http",
      extraidoEm: new Date().toISOString(),
      totalItens: itens.length,
      totalizadores: {
        concedente: "SENAPPEN",
        convenente: "UF",
        situacao: "Em execução",
        valorTotalPrevisto: 350.0,
        valorTotalExecutado: 350.0,
        saldoTotal: 0.0
      },
      hashConteudo,
      aptoParaImportacaoTecnica: true,
      bloqueiosTecnicos: [],
      avisos: [],
      itens
    });
  }

  const hashes = convenios.map((c) => c.hashConteudo).sort();
  const hashGlobalObj = crypto.createHash("sha256");
  hashGlobalObj.update(hashes.join("|"));
  const hashGlobal = hashGlobalObj.digest("hex");

  return {
    versao: 1,
    origem: "transferegov",
    geradoEm: new Date().toISOString(),
    totalConvenios: convenios.length,
    totalItens,
    hashGlobal,
    convenios,
    ...overrides
  };
}

// 1. cache completo válido passa
test("1. cache completo válido passa", () => {
  const cache = criarCacheMockCompleto();
  const diag = gerarDiagnosticoCachePadTransferegov(cache, { completo: true });

  assert.equal(diag.valido, true);
  assert.equal(diag.totalErrosBloqueantes, 0);
  assert.equal(diag.totalAlertas, 0);
});

// 2. origem diferente de transferegov bloqueia
test("2. origem diferente de transferegov bloqueia", () => {
  const cache = criarCacheMockCompleto({ origem: "excel" });
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "origem"));
});

// 3. versão diferente de 1 bloqueia
test("3. versão diferente de 1 bloqueia", () => {
  const cache = criarCacheMockCompleto({ versao: 2 });
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "versao"));
});

// 4. totalConvenios diferente de convenios.length bloqueia
test("4. totalConvenios diferente de convenios.length bloqueia", () => {
  const cache = criarCacheMockCompleto({ totalConvenios: 10 });
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "totalConvenios"));
});

// 5. convênio sem itens bloqueia
test("5. convênio sem itens bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens = [];
  cache.convenios[0].totalItens = 0;
  
  // Recalcular hashes para consistência (exceto o fato de estar vazio)
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify([]));
  cache.convenios[0].hashConteudo = hash.digest("hex");
  
  const hashes = cache.convenios.map((c) => c.hashConteudo).sort();
  const hashGlobalObj = crypto.createHash("sha256");
  hashGlobalObj.update(hashes.join("|"));
  cache.hashGlobal = hashGlobalObj.digest("hex");
  cache.totalItens = cache.convenios.reduce((acc, c) => acc + c.totalItens, 0);

  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("itens")));
});

// 6. totalItens divergente da soma bloqueia
test("6. totalItens divergente da soma bloqueia", () => {
  const cache = criarCacheMockCompleto({ totalItens: 500 });
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "totalItens"));
});

// 7. convênio com bloqueiosTecnicos bloqueia
test("7. convênio com bloqueiosTecnicos bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].bloqueiosTecnicos = ["Erro de timeout"];
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("bloqueiosTecnicos")));
});

// 8. convênio com aptoParaImportacaoTecnica=false bloqueia
test("8. convênio com aptoParaImportacaoTecnica=false bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].aptoParaImportacaoTecnica = false;
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("aptoParaImportacaoTecnica")));
});

// 9. origemUsada=playwright gera alerta ou bloqueio conforme regra desta etapa
test("9. origemUsada=playwright gera alerta ou bloqueio conforme regra desta etapa", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].origemUsada = "playwright";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("origemUsada")));
});

// 10. HTML bruto bloqueia
test("10. HTML bruto bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "Serviço com tag <html> e conteúdo";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "seguranca"));
});

// 11. ViewState bloqueia
test("11. ViewState bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "Alguma string contendo ViewState aqui";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "seguranca"));
});

// 12. cookie bloqueia
test("12. cookie bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "String contendo o termo cookie para teste";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "seguranca"));
});

// 13. authorization/bearer bloqueia
test("13. authorization/bearer bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "String contendo Authorization ou Bearer";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "seguranca"));
});

// 14. JSESSIONID bloqueia
test("14. JSESSIONID bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "String contendo JSESSIONID";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "seguranca"));
});

// 15. item sem descrição bloqueia
test("15. item sem descrição bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].descricao = "";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("descricao")));
});

// 16. item sem código de natureza bloqueia
test("16. item sem código de natureza bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].codigoNaturezaDespesa = "";
  cache.convenios[0].itens[0].codigoNaturezaNormalizado = "";
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("codigoNatureza")));
});

// 17. quantidade não numérica bloqueia
test("17. quantidade não numérica bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].quantidade = NaN;
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("quantidade")));
});

// 18. valorTotalPrevisto não numérico bloqueia
test("18. valorTotalPrevisto não numérico bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].valorTotalPrevisto = Infinity;
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("valorTotalPrevisto")));
});

// 19. valorTotalExecutado não numérico bloqueia
test("19. valorTotalExecutado não numérico bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].valorTotalExecutado = "100"; // string
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("valorTotalExecutado")));
});

// 20. saldo não numérico bloqueia
test("20. saldo não numérico bloqueia", () => {
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens[0].saldo = null;
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo.includes("saldo")));
});

// 21. hashGlobal inconsistente bloqueia
test("21. hashGlobal inconsistente bloqueia", () => {
  const cache = criarCacheMockCompleto({ hashGlobal: "hash_global_fake" });
  const diag = gerarDiagnosticoCachePadTransferegov(cache);

  assert.equal(diag.valido, false);
  assert.ok(diag.totalErrosBloqueantes > 0);
  assert.ok(diag.erros.some((e) => e.campo === "hashGlobal"));
});

// 22. totalItens diferente de 525 gera alerta, não bloqueio, se a soma interna estiver correta
test("22. totalItens diferente de 525 gera alerta, não bloqueio, se a soma interna estiver correta", () => {
  // Criar cache válido mas remover um item para mudar a soma interna, e recalcular hashes e totais
  const cache = criarCacheMockCompleto();
  cache.convenios[0].itens.pop(); // Remove um item (total vai para 524)
  cache.convenios[0].totalItens = cache.convenios[0].itens.length;
  
  // Recalcular hashes e total de itens para que a consistência interna seja 100% válida
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(cache.convenios[0].itens));
  cache.convenios[0].hashConteudo = hash.digest("hex");
  
  const hashes = cache.convenios.map((c) => c.hashConteudo).sort();
  const hashGlobalObj = crypto.createHash("sha256");
  hashGlobalObj.update(hashes.join("|"));
  cache.hashGlobal = hashGlobalObj.digest("hex");
  cache.totalItens = cache.convenios.reduce((acc, c) => acc + c.totalItens, 0); // 524

  const diag = gerarDiagnosticoCachePadTransferegov(cache, { completo: true });

  assert.equal(diag.valido, true); // Permanece válido
  assert.equal(diag.totalErrosBloqueantes, 0);
  assert.equal(diag.totalAlertas, 1);
  assert.ok(diag.alertas.some((a) => a.campo === "totalItens"));
});

// 23-26. validação não chama Excel, recarga PAD, DETRU ou rendimentos
test("23-26. validação não chama Excel, recarga PAD, DETRU ou rendimentos", () => {
  const servicePath = path.resolve(__dirname, "../../backend/services/profor-2022/profor-pad-transferegov-cache-validacao-service.js");
  const source = fs.readFileSync(servicePath, "utf8");

  assert.equal(source.includes("report-reader"), false);
  assert.equal(source.includes("recarga-operacional"), false);
  assert.equal(source.includes("carregador-operacional"), false);
  assert.equal(source.includes("detru"), false);
  assert.equal(source.includes("rendimentos"), false);
  assert.equal(source.includes("XLSX"), false);
  assert.equal(source.includes("xlsx"), false);
});

// 27. validação não altera cache
test("27. validação não altera cache", () => {
  const cacheOriginal = criarCacheMockCompleto();
  const cacheCopia = JSON.parse(JSON.stringify(cacheOriginal));

  gerarDiagnosticoCachePadTransferegov(cacheOriginal, { completo: true });

  assert.deepEqual(cacheOriginal, cacheCopia);
});

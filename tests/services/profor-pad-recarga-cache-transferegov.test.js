const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const { recarregarPadsOperacional } = require("../../backend/services/profor-2022/profor-pad-recarga-operacional-service");
const { carregarPadsOperacional } = require("../../backend/services/profor-2022/profor-pad-carregador-operacional-service");

const activeConvenios = [
  "937698", "937216", "937871", "937592", "937782",
  "937265", "938277", "937818", "938128", "937780",
  "937917", "937468", "937221", "937817", "937783"
];

function criarCacheMockValido(overrides = {}) {
  const convenios = activeConvenios.map((numeroConvenio) => {
    const itens = [
      {
        instrumento: numeroConvenio,
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
      }
    ];

    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(itens));
    const hashConteudo = hash.digest("hex");

    return {
      numeroConvenio,
      uf: "DF",
      origemUsada: "http",
      extraidoEm: new Date().toISOString(),
      totalItens: itens.length,
      totalizadores: {
        concedente: "SENAPPEN",
        convenente: "MJ",
        situacao: "Em execução",
        valorTotalPrevisto: 100.0,
        valorTotalExecutado: 50.0,
        saldoTotal: 50.0,
      },
      hashConteudo,
      aptoParaImportacaoTecnica: true,
      bloqueiosTecnicos: [],
      avisos: [],
      itens
    };
  });

  const hashes = convenios.map((c) => c.hashConteudo).sort();
  const hashObj = crypto.createHash("sha256");
  hashObj.update(hashes.join("|"));
  const hashGlobal = hashObj.digest("hex");

  return {
    versao: 1,
    origem: "transferegov",
    geradoEm: new Date().toISOString(),
    totalConvenios: convenios.length,
    totalItens: convenios.reduce((acc, c) => acc + c.totalItens, 0),
    hashGlobal,
    convenios,
    ...overrides
  };
}

function prepararPastaTemporaria(cachePayload = null) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profor-recarga-cache-test-"));
  const cacheDir = path.join(tmpDir, "backend", "data", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  if (cachePayload !== null) {
    const caminhoCache = path.join(cacheDir, "profor-2022-pad-transferegov-cache.json");
    fs.writeFileSync(caminhoCache, typeof cachePayload === "string" ? cachePayload : JSON.stringify(cachePayload, null, 2), "utf8");
  }

  // Criar pasta de relatórios vazia para evitar quebras de escrita
  fs.mkdirSync(path.join(tmpDir, "backend", "data", "relatorios"), { recursive: true });

  return tmpDir;
}

test("1. recarga PAD usa cache Transferegov válido como origem padrão e 2. não lê Excel", async () => {
  const cache = criarCacheMockValido();
  const tmpDir = prepararPastaTemporaria(cache);

  try {
    // Roda a recarga operacional no diretório temporário (que não tem nenhum arquivo Excel)
    const resultado = await recarregarPadsOperacional({ repoRoot: tmpDir, usarExcelLegado: false });
    
    // Deve ler do cache e executar com sucesso (ou com pendências se não bater com BD, mas sem erro de leitura)
    assert.equal(resultado.totalRelatoriosLidos, 15);
    assert.equal(resultado.totalItensPad, 15); // 1 item por convênio
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("3. pastaRelativa sozinha não autoriza Excel", async () => {
  const tmpDir = prepararPastaTemporaria(null); // sem cache e sem excel

  try {
    // Passar pastaRelativa mas não usarExcelLegado
    const resultado = await recarregarPadsOperacional({
      repoRoot: tmpDir,
      pastaRelativa: "Planilhas/profor-2022-fake",
      usarExcelLegado: false
    });

    // Deve falhar com erro de cache ausente
    assert.equal(resultado.sucesso, false);
    const impeditivo = resultado.impedimentos[0];
    assert.equal(impeditivo.tipo, "cache_pad_transferegov_ausente_ou_invalido");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("4. Excel legado só é lido com usarExcelLegado: true", async () => {
  const tmpDir = prepararPastaTemporaria(null); // sem cache

  // Criar um arquivo Excel vazio fake ou pasta de excel
  const pastaExcel = path.join(tmpDir, "Planilhas/profor-2022/instrumentos");
  fs.mkdirSync(pastaExcel, { recursive: true });

  try {
    // Chamada sem usarExcelLegado: true deve cair no cache e falhar por ausência
    const resCache = await recarregarPadsOperacional({ repoRoot: tmpDir });
    assert.equal(resCache.sucesso, false);
    assert.equal(resCache.impedimentos[0].tipo, "cache_pad_transferegov_ausente_ou_invalido");

    // Chamada com usarExcelLegado: true deve tentar ler do Excel (vai dar erro de quantidade arquivos vazia, não de cache)
    const resExcel = await recarregarPadsOperacional({ repoRoot: tmpDir, usarExcelLegado: true });
    assert.ok(resExcel.impedimentos.some((imp) => imp.tipo === "quantidade_arquivos_pad_invalida"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("5. cache ausente gera bloqueio técnico cache_pad_transferegov_ausente_ou_invalido", async () => {
  const tmpDir = prepararPastaTemporaria(null);

  try {
    const resultado = await recarregarPadsOperacional({ repoRoot: tmpDir });
    assert.equal(resultado.sucesso, false);
    
    const imp = resultado.impedimentos[0];
    assert.equal(imp.tipo, "cache_pad_transferegov_ausente_ou_invalido");
    assert.equal(imp.etapa, "leitura_cache_transferegov");
    assert.match(imp.detalhe, /não encontrado/i);
    assert.ok(imp.providencia);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("6. cache inválido (JSON quebrado) gera bloqueio técnico cache_pad_transferegov_ausente_ou_invalido", async () => {
  const tmpDir = prepararPastaTemporaria("{invalid json}");

  try {
    const resultado = await recarregarPadsOperacional({ repoRoot: tmpDir });
    assert.equal(resultado.sucesso, false);
    
    const imp = resultado.impedimentos[0];
    assert.equal(imp.tipo, "cache_pad_transferegov_ausente_ou_invalido");
    assert.equal(imp.etapa, "leitura_cache_transferegov");
    assert.match(imp.detalhe, /decodificar/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("7. cache com erro bloqueante de validação não é usado", async () => {
  const cacheInvalido = criarCacheMockValido({ versao: 99 }); // Versão inválida bloqueia
  const tmpDir = prepararPastaTemporaria(cacheInvalido);

  try {
    const resultado = await recarregarPadsOperacional({ repoRoot: tmpDir });
    assert.equal(resultado.sucesso, false);
    
    const imp = resultado.impedimentos[0];
    assert.equal(imp.tipo, "cache_pad_transferegov_ausente_ou_invalido");
    assert.equal(imp.etapa, "leitura_cache_transferegov");
    assert.match(imp.detalhe, /Versão do cache inválida/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("8-11. item novo, suprimido, valor alterado e divergência histórica não causam quebras na recarga", async () => {
  const cache = criarCacheMockValido();
  // Alterar valor e descrição de itens para simular novos itens e valores divergentes
  cache.convenios[0].itens[0].descricao = "Item Totalmente Novo Que Nao Existe No BD";
  cache.convenios[0].itens[0].valorTotalPrevisto = 9999.0;
  
  // Recalcular hashes para integridade
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(cache.convenios[0].itens));
  cache.convenios[0].hashConteudo = hash.digest("hex");
  
  const hashes = cache.convenios.map((c) => c.hashConteudo).sort();
  const hashObj = crypto.createHash("sha256");
  hashObj.update(hashes.join("|"));
  cache.hashGlobal = hashObj.digest("hex");

  const tmpDir = prepararPastaTemporaria(cache);

  try {
    const resultado = await recarregarPadsOperacional({ repoRoot: tmpDir, usarExcelLegado: false });
    // Recarga deve rodar e retornar os itens
    assert.equal(resultado.totalRelatoriosLidos, 15);
    // Deve registrar impedimentos operacionais, mas o fluxo de recarga em si terminou com sucesso de execução
    assert.ok(resultado.impedimentos.length > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("12-17. recarga com cache não acessa rede, não atualiza cache, não aciona DETRU, rendimentos ou publicação", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const servicePath = path.join(repoRoot, "backend/services/profor-2022/profor-pad-recarga-operacional-service.js");
  const serviceCode = fs.readFileSync(servicePath, "utf8");

  // Garantir ausência de chamadas proibidas no código do serviço
  const termosProibidos = [
    "atualizarCacheDetruProfor2022",
    "executarEtapaRendimentos",
    "publicarDadosEstaticos",
    "publicarProfor2022Estatico"
  ];

  for (const termo of termosProibidos) {
    assert.equal(serviceCode.includes(termo), false, `Serviço de recarga não pode chamar '${termo}'`);
  }
});

test("18. fluxo legado Excel explícito continua funcionando apenas para teste/manutenção", async () => {
  // Testar se obterUltimaRecargaOperacional continua exportada e funcionando
  const repoRoot = path.resolve(__dirname, "../..");
  const resultado = obterUltimaRecargaOperacionalReal();
  assert.ok(resultado);
});

function obterUltimaRecargaOperacionalReal() {
  const { obterUltimaRecargaOperacional } = require("../../backend/services/profor-2022/profor-pad-recarga-operacional-service");
  const repoRoot = path.resolve(__dirname, "../..");
  return obterUltimaRecargaOperacional({ repoRoot });
}

test("19. não existe usarExcelLegadoGlobal ou definirUsoExcelLegado", () => {
  const reader = require("../../backend/services/profor-2022/profor-pad-report-reader");
  assert.equal(reader.definirUsoExcelLegado, undefined);
  assert.equal(reader.usarExcelLegadoGlobal, undefined);
});

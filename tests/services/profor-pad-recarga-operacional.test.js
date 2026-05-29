const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  recarregarPadsOperacional,
  obterUltimaRecargaOperacional,
} = require("../../backend/services/profor-2022/profor-pad-recarga-operacional-service");

// A recarga operacional aciona a reconstrução PAD, que lê estatísticas de revisão
// do Postgres (obterEstatisticasAuditoria). Esses testes exigem DATABASE_URL.
const testPostgres = process.env.DATABASE_URL ? test : test.skip;

testPostgres("1. estrutura do retorno de recarregarPadsOperacional", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const resultado = await recarregarPadsOperacional({ repoRoot });

  const chavesEsperadas = [
    "sucesso",
    "aptoParaUsoLocal",
    "aptoParaPublicacao",
    "totalArquivosPad",
    "totalRelatoriosLidos",
    "totalItensPad",
    "totalLinhasReconstruidas",
    "totalConveniosReconstruidos",
    "totalItensComRateioAplicado",
    "totalItensSemRateio",
    "totalItensNovos",
    "totalItensSuprimidos",
    "totalImpedimentos",
    "totalAlertas",
    "impedimentos",
    "alertas",
    "caminhosRelatorios",
    "dataHora"
  ];

  for (const chave of chavesEsperadas) {
    assert.ok(chave in resultado, `A chave '${chave}' deve estar presente no retorno da recarga`);
  }
});

testPostgres("2. recarregarPadsOperacional escreve os relatórios nos caminhos apropriados", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoJson = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-recarga-operacional.json");
  const caminhoMd = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-recarga-operacional.md");
  const caminhoReconstrucaoCorreto = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json"
  );

  // Remove os arquivos se já existirem para certificar que serão criados/atualizados
  if (fs.existsSync(caminhoJson)) fs.unlinkSync(caminhoJson);
  if (fs.existsSync(caminhoMd)) fs.unlinkSync(caminhoMd);

  const resultado = await recarregarPadsOperacional({ repoRoot });

  assert.ok(fs.existsSync(caminhoJson), "O arquivo JSON de recarga operacional deve ser criado");
  assert.ok(fs.existsSync(caminhoMd), "O arquivo MD de recarga operacional deve ser criado");
  assert.ok(fs.existsSync(caminhoReconstrucaoCorreto), "A recarga deve atualizar o arquivo de reconstrução com nome correto");
  assert.equal(
    resultado.caminhosRelatorios.reconstrucaoJson,
    "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
    "O caminho de reconstrução retornado pela recarga deve usar 'reconstruido'"
  );

  const dadosPersistidos = JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
  assert.equal(dadosPersistidos.dataHora, resultado.dataHora, "A data e hora no arquivo persistido deve coincidir com o resultado");
});

testPostgres("3. obterUltimaRecargaOperacional retorna o conteúdo da última recarga persistida", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoJson = path.join(repoRoot, "backend/data/relatorios/profor-2022-pad-recarga-operacional.json");

  assert.ok(fs.existsSync(caminhoJson), "O arquivo persistido da última recarga deve existir");

  const dadosPersistidos = JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
  const resultado = obterUltimaRecargaOperacional({ repoRoot });

  assert.deepEqual(resultado, dadosPersistidos, "O resultado de obterUltimaRecargaOperacional deve coincidir exatamente com os dados salvos");
});

test("4. rotas POST /api/profor-2022/pad/recarregar e GET /api/profor-2022/pad/ultima-recarga estão registradas no server.js", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const serverPath = path.join(repoRoot, "backend/server.js");
  const serverCode = fs.readFileSync(serverPath, "utf8");

  assert.ok(
    serverCode.includes("POST") && serverCode.includes("/api/profor-2022/pad/recarregar"),
    "A rota POST /api/profor-2022/pad/recarregar deve estar registrada no server.js"
  );
  assert.ok(
    serverCode.includes("GET") && serverCode.includes("/api/profor-2022/pad/ultima-recarga"),
    "A rota GET /api/profor-2022/pad/ultima-recarga deve estar registrada no server.js"
  );
});

testPostgres("5. recarga operacional não publica dados, não aciona DETRU nem Transferegov", async () => {
  const repoRoot = path.resolve(__dirname, "../..");

  const originalWriteFileSync = fs.writeFileSync;
  const originalWriteFile = fs.writeFile;
  const originalMkdirSync = fs.mkdirSync;

  let escreveuEmPublicados = false;
  let escreveuDetruTransferegov = false;

  fs.writeFileSync = function(filePath, ...args) {
    const norm = path.resolve(filePath).replace(/\\/g, "/");
    if (norm.includes("frontend/data/publicados")) {
      escreveuEmPublicados = true;
    }
    if (norm.includes("detru") || norm.includes("transferegov")) {
      escreveuDetruTransferegov = true;
    }
    return originalWriteFileSync.call(fs, filePath, ...args);
  };

  fs.writeFile = function(filePath, ...args) {
    const norm = path.resolve(filePath).replace(/\\/g, "/");
    if (norm.includes("frontend/data/publicados")) {
      escreveuEmPublicados = true;
    }
    if (norm.includes("detru") || norm.includes("transferegov")) {
      escreveuDetruTransferegov = true;
    }
    return originalWriteFile.call(fs, filePath, ...args);
  };

  fs.mkdirSync = function(dirPath, ...args) {
    const norm = path.resolve(dirPath).replace(/\\/g, "/");
    if (norm.includes("frontend/data/publicados")) {
      escreveuEmPublicados = true;
    }
    if (norm.includes("detru") || norm.includes("transferegov")) {
      escreveuDetruTransferegov = true;
    }
    return originalMkdirSync.call(fs, dirPath, ...args);
  };

  try {
    await recarregarPadsOperacional({ repoRoot });
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.writeFile = originalWriteFile;
    fs.mkdirSync = originalMkdirSync;
  }

  assert.equal(escreveuEmPublicados, false, "A recarga operacional não deve editar ou escrever nada em frontend/data/publicados/");
  assert.equal(escreveuDetruTransferegov, false, "A recarga operacional não deve acionar ou escrever nada em pastas de DETRU/Transferegov");

  const servicePath = path.join(repoRoot, "backend/services/profor-2022/profor-pad-recarga-operacional-service.js");
  const serviceCode = fs.readFileSync(servicePath, "utf8");

  const termosProibidos = [
    "publicarDadosEstaticos",
    "publicarProfor2022Estatico",
    "atualizarCacheDetruProfor2022",
    "executarEtapaRendimentos",
    "detru",
    "transferegov",
    "frontend/data/publicados"
  ];

  for (const termo of termosProibidos) {
    assert.equal(
      serviceCode.includes(termo),
      false,
      `O código de recarga operacional não deve conter referências ao termo proibido '${termo}'`
    );
  }
});

test("6. serviço de recarga contém apenas o caminho canônico de reconstrução", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const servicePath = path.join(repoRoot, "backend/services/profor-2022/profor-pad-recarga-operacional-service.js");
  const serviceCode = fs.readFileSync(servicePath, "utf8");
  assert.equal(
    serviceCode.includes("profor-2022-pad-plano-reconstruido-dry-run.json"),
    true,
    "O serviço de recarga deve usar o caminho canônico de reconstrução"
  );
});

const fs = require("node:fs");
const path = require("node:path");
const cacheService = require("../services/profor-2022/profor-pad-transferegov-cache-service");
const validationService = require("../services/profor-2022/profor-pad-transferegov-cache-validacao-service");

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const resumoMode = args.includes("--resumo") || !jsonMode;

  const caminhoCache = cacheService.obterCaminhoCache();
  const cacheExiste = fs.existsSync(caminhoCache);

  if (!cacheExiste) {
    const erroDiagnostico = {
      cacheExiste: false,
      cacheValido: false,
      totalConvenios: 0,
      totalItens: 0,
      totalErrosBloqueantes: 1,
      totalAlertas: 0,
      totalInformativos: 0,
      hashGlobal: null,
      geradoEm: null,
      caminhoCache,
      veredito: { cacheValidado: false },
      erros: [{ tipo: "erro_tecnico_bloqueante", mensagem: `Arquivo de cache não encontrado em: ${caminhoCache}` }]
    };

    if (jsonMode) {
      console.log(JSON.stringify(erroDiagnostico, null, 2));
    } else {
      console.log(`[Validação Cache] Erro: Arquivo de cache não encontrado em: ${caminhoCache}`);
      console.log(`cacheExiste: false`);
      console.log(`cacheValido: false`);
      console.log(`totalConvenios: 0`);
      console.log(`totalItens: 0`);
      console.log(`totalErrosBloqueantes: 1`);
      console.log(`totalAlertas: 0`);
      console.log(`totalInformativos: 0`);
      console.log(`hashGlobal: null`);
      console.log(`geradoEm: null`);
      console.log(`caminhoCache: ${caminhoCache}`);
      console.log(`veredito: cacheValidado=false`);
    }
    process.exit(1);
  }

  let cache = null;
  let parseError = null;

  try {
    const conteudo = fs.readFileSync(caminhoCache, "utf8");
    cache = JSON.parse(conteudo);
  } catch (err) {
    parseError = err.message;
  }

  if (parseError) {
    const erroDiagnostico = {
      cacheExiste: true,
      cacheValido: false,
      totalConvenios: 0,
      totalItens: 0,
      totalErrosBloqueantes: 1,
      totalAlertas: 0,
      totalInformativos: 0,
      hashGlobal: null,
      geradoEm: null,
      caminhoCache,
      veredito: { cacheValidado: false },
      erros: [{ tipo: "erro_tecnico_bloqueante", mensagem: `Erro ao fazer parse do JSON do cache: ${parseError}` }]
    };

    if (jsonMode) {
      console.log(JSON.stringify(erroDiagnostico, null, 2));
    } else {
      console.log(`[Validação Cache] Erro de parse JSON: ${parseError}`);
      console.log(`cacheExiste: true`);
      console.log(`cacheValido: false`);
      console.log(`totalConvenios: 0`);
      console.log(`totalItens: 0`);
      console.log(`totalErrosBloqueantes: 1`);
      console.log(`totalAlertas: 0`);
      console.log(`totalInformativos: 0`);
      console.log(`hashGlobal: null`);
      console.log(`geradoEm: null`);
      console.log(`caminhoCache: ${caminhoCache}`);
      console.log(`veredito: cacheValidado=false`);
    }
    process.exit(1);
  }

  // Executar validação técnica
  const diag = validationService.gerarDiagnosticoCachePadTransferegov(cache, { completo: true });

  const output = {
    cacheExiste: true,
    cacheValido: diag.valido,
    totalConvenios: cache.totalConvenios || 0,
    totalItens: cache.totalItens || 0,
    totalErrosBloqueantes: diag.totalErrosBloqueantes,
    totalAlertas: diag.totalAlertas,
    totalInformativos: diag.totalInformativos,
    hashGlobal: cache.hashGlobal || null,
    geradoEm: cache.geradoEm || null,
    caminhoCache,
    veredito: { cacheValidado: diag.valido },
    erros: diag.erros,
    alertas: diag.alertas,
    informativos: diag.informativos
  };

  if (jsonMode) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`==================================================`);
    console.log(`RELATÓRIO DE VALIDAÇÃO DO CACHE PAD TRANSFEREGOV`);
    console.log(`==================================================`);
    console.log(`cacheExiste:            true`);
    console.log(`cacheValido:            ${output.cacheValido}`);
    console.log(`totalConvenios:         ${output.totalConvenios}`);
    console.log(`totalItens:             ${output.totalItens}`);
    console.log(`totalErrosBloqueantes:  ${output.totalErrosBloqueantes}`);
    console.log(`totalAlertas:           ${output.totalAlertas}`);
    console.log(`totalInformativos:      ${output.totalInformativos}`);
    console.log(`hashGlobal:             ${output.hashGlobal}`);
    console.log(`geradoEm:               ${output.geradoEm}`);
    console.log(`caminhoCache:           ${output.caminhoCache}`);
    console.log(`veredito:               cacheValidado=${output.cacheValido}`);
    console.log(`==================================================`);

    if (output.erros.length > 0) {
      console.log(`\n[ERROS BLOQUEANTES] (${output.erros.length}):`);
      output.erros.forEach((e) => console.log(`  - [${e.campo || "geral"}]: ${e.mensagem}`));
    }

    if (output.alertas.length > 0) {
      console.log(`\n[ALERTAS DE REVISÃO] (${output.alertas.length}):`);
      output.alertas.forEach((a) => console.log(`  - [${a.campo || "geral"}]: ${a.mensagem}`));
    }

    if (output.informativos.length > 0) {
      console.log(`\n[INFORMATIVOS] (${output.informativos.length}):`);
      output.informativos.forEach((i) => console.log(`  - ${i.mensagem}`));
    }
  }

  process.exit(output.cacheValido ? 0 : 1);
}

main();

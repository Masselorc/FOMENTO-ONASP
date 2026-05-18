const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "frontend", "data", "publicados");
const FLAG_PERMITIR_ALTERACOES = "--permitir-alteracoes-locais";

const PADROES_PROIBIDOS = [
  { nome: "JSESSIONID", regex: /JSESSIONID/i },
  { nome: "SAMLRequest", regex: /SAMLRequest/i },
  { nome: "SAMLResponse", regex: /SAMLResponse/i },
  { nome: "Cookie:", regex: /Cookie:/i },
  { nome: "Set-Cookie", regex: /Set-Cookie/i },
  { nome: "Authorization:", regex: /Authorization:/i },
  { nome: "Bearer ", regex: /Bearer\s+/i },
  { nome: "ONASP_EDIT_PASSWORD", regex: /ONASP_EDIT_PASSWORD/i },
  { nome: "DETRU_SICONV_CONVENIO_URL", regex: /DETRU_SICONV_CONVENIO_URL/i },
  { nome: "Dados/detru", regex: /Dados\/detru/i },
  { nome: ".sqlite", regex: /\.sqlite/i },
  { nome: ".har", regex: /\.har/i },
  { nome: "<html", regex: /<html/i },
  { nome: "<!DOCTYPE html", regex: /<!DOCTYPE html/i },
  {
    nome: "gov.br",
    regex: /gov\.br/i,
    condicao: (texto) => /(login|cookie|samlrequest|samlresponse|set-cookie|authorization|bearer)/i.test(texto),
  },
  { nome: "C:\\Users\\", regex: /C:\\Users\\/i },
];

function agoraIso() {
  return new Date().toISOString();
}

function formatarDuracao(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  const segundos = (ms / 1000).toFixed(1);
  return `${segundos} s`;
}

function executarComando(rotulo, comando, args, { cwd = ROOT_DIR, usarShell = false } = {}) {
  const iniciadoEm = Date.now();
  const resultado = spawnSync(comando, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    shell: usarShell,
  });
  const duracaoMs = Date.now() - iniciadoEm;

  if (resultado.error) {
    process.stderr.write(`${resultado.error.message}\n`);
  }
  if (resultado.stdout) process.stdout.write(resultado.stdout);
  if (resultado.stderr) process.stderr.write(resultado.stderr);

  return {
    rotulo,
    comando,
    args,
    code: typeof resultado.status === "number" ? resultado.status : 1,
    signal: resultado.signal || null,
    stdout: resultado.stdout || "",
    stderr: resultado.stderr || "",
    duracaoMs,
  };
}

function executarNpmScript(script) {
  return executarComando(`npm run ${script}`, "npm", ["run", script], { usarShell: true });
}

function executarGit(args) {
  return executarComando(`git ${args.join(" ")}`, "git", args);
}

function lerTextoGit(args) {
  const resultado = executarGit(args);
  return resultado.stdout.trim();
}

function listarArquivosJsonPublicados(dir = PUBLIC_DIR) {
  const arquivos = [];
  if (!fs.existsSync(dir)) return arquivos;

  const visitar = (atual) => {
    for (const entrada of fs.readdirSync(atual, { withFileTypes: true })) {
      const caminho = path.join(atual, entrada.name);
      if (entrada.isDirectory()) {
        visitar(caminho);
        continue;
      }
      if (entrada.isFile() && entrada.name.toLowerCase().endsWith(".json")) {
        arquivos.push(caminho);
      }
    }
  };

  visitar(dir);
  return arquivos.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function detectarPadraoProibido(texto) {
  for (const padrao of PADROES_PROIBIDOS) {
    if (padrao.regex.test(texto) && (!padrao.condicao || padrao.condicao(texto))) {
      return padrao.nome;
    }
  }
  return null;
}

function auditarArquivoPublicado(caminho) {
  const conteudo = fs.readFileSync(caminho, "utf8");
  const padrao = detectarPadraoProibido(conteudo);
  if (padrao) {
    return {
      ok: false,
      motivo: `padrão proibido "${padrao}" encontrado`,
      arquivo: path.relative(ROOT_DIR, caminho),
    };
  }

  if (path.basename(caminho) === "aplicacao.json") {
    let dados;
    try {
      dados = JSON.parse(conteudo);
    } catch (error) {
      return {
        ok: false,
        motivo: `JSON inválido em aplicacao.json: ${error.message}`,
        arquivo: path.relative(ROOT_DIR, caminho),
      };
    }

    if (Object.prototype.hasOwnProperty.call(dados, "detru")) {
      return {
        ok: false,
        motivo: "seção interna detru não deve existir no catálogo público",
        arquivo: path.relative(ROOT_DIR, caminho),
      };
    }

    const dadosProfor2022 = dados?.dadosProfor2022;
    const ultimaAtualizacao = dadosProfor2022?.ultimaAtualizacaoDados;
    if (!ultimaAtualizacao || typeof ultimaAtualizacao !== "object") {
      return {
        ok: false,
        motivo: "dadosProfor2022.ultimaAtualizacaoDados ausente",
        arquivo: path.relative(ROOT_DIR, caminho),
      };
    }

    if (typeof ultimaAtualizacao.dataHora !== "string" || ultimaAtualizacao.dataHora.trim() === "") {
      return {
        ok: false,
        motivo: "dadosProfor2022.ultimaAtualizacaoDados.dataHora ausente",
        arquivo: path.relative(ROOT_DIR, caminho),
      };
    }

    if (typeof ultimaAtualizacao.fonte !== "string" || ultimaAtualizacao.fonte.trim() === "") {
      return {
        ok: false,
        motivo: "dadosProfor2022.ultimaAtualizacaoDados.fonte ausente",
        arquivo: path.relative(ROOT_DIR, caminho),
      };
    }

    const diagnostico = dadosProfor2022?.diagnostico;
    if (diagnostico) {
      const totalComDetru = Number(diagnostico.totalComDetru ?? 0);
      const totalComPlano = Number(diagnostico.totalComPlano ?? 0);
      const totalComRendimentos = Number(diagnostico.totalComRendimentos ?? 0);
      if (totalComDetru !== 15 || totalComPlano !== 15 || totalComRendimentos !== 15) {
        return {
          ok: false,
          motivo: `diagnóstico inconsistente em aplicacao.json (${totalComDetru}/${totalComPlano}/${totalComRendimentos})`,
          arquivo: path.relative(ROOT_DIR, caminho),
        };
      }
    }
  }

  return { ok: true, arquivo: path.relative(ROOT_DIR, caminho) };
}

function auditarArquivosPublicados() {
  const arquivos = listarArquivosJsonPublicados();
  const resultados = arquivos.map(auditarArquivoPublicado);
  const falhas = resultados.filter((item) => !item.ok);
  return {
    ok: falhas.length === 0,
    arquivos,
    falhas,
  };
}

function extrairResumoAtualizacao(stdout) {
  const resumo = {
    sucesso: false,
    detru: null,
    rendimentos: null,
    consolidado: null,
  };

  const matchDetru = stdout.match(/DETRU:\s+sucesso=(true|false)\s+encontrados=(\d+)\/(\d+)/);
  if (matchDetru) {
    resumo.detru = {
      sucesso: matchDetru[1] === "true",
      encontrados: Number(matchDetru[2]),
      total: Number(matchDetru[3]),
    };
  }

  const matchRendimentos = stdout.match(/Rendimentos:\s+sucesso=(true|false)\s+sucessos=(\d+)\/(\d+)\s+falhas=(\d+)/);
  if (matchRendimentos) {
    resumo.rendimentos = {
      sucesso: matchRendimentos[1] === "true",
      sucessos: Number(matchRendimentos[2]),
      total: Number(matchRendimentos[3]),
      falhas: Number(matchRendimentos[4]),
    };
  }

  const matchConsolidado = stdout.match(/Consolidado:\s+convenios=(\d+)\s+detru=(\d+)\s+plano=(\d+)\s+rendimentos=(\d+)/);
  if (matchConsolidado) {
    resumo.consolidado = {
      convenios: Number(matchConsolidado[1]),
      detru: Number(matchConsolidado[2]),
      plano: Number(matchConsolidado[3]),
      rendimentos: Number(matchConsolidado[4]),
    };
  }

  const sucessoCompleto =
    resumo.detru?.sucesso &&
    resumo.rendimentos?.sucesso &&
    resumo.consolidado &&
    resumo.detru.encontrados === 15 &&
    resumo.detru.total === 15 &&
    resumo.rendimentos.sucessos === 15 &&
    resumo.rendimentos.total === 15 &&
    resumo.rendimentos.falhas === 0 &&
    resumo.consolidado.convenios === 15 &&
    resumo.consolidado.detru === 15 &&
    resumo.consolidado.plano === 15 &&
    resumo.consolidado.rendimentos === 15;

  resumo.sucesso = Boolean(sucessoCompleto);
  return resumo;
}

function lerJson(caminho) {
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

function obterUltimaAtualizacaoPublicada() {
  const aplicacaoPath = path.join(PUBLIC_DIR, "aplicacao.json");
  if (!fs.existsSync(aplicacaoPath)) return null;
  try {
    const aplicacao = lerJson(aplicacaoPath);
    return {
      dataHora: aplicacao?.dadosProfor2022?.ultimaAtualizacaoDados?.dataHora || null,
      fonte: aplicacao?.dadosProfor2022?.ultimaAtualizacaoDados?.fonte || null,
    };
  } catch (_error) {
    return null;
  }
}

function imprimirSecao(titulo) {
  console.log("");
  console.log(`=== ${titulo} ===`);
}

function main() {
  const inicio = Date.now();
  const inicioIso = agoraIso();
  const permitirAlteracoesLocais = process.argv.slice(2).includes(FLAG_PERMITIR_ALTERACOES);

  console.log(`[PROFOR 2022] Rotina semiautomática de publicação iniciada em ${inicioIso}.`);
  console.log(`[PROFOR 2022] Flag de exceção de working tree: ${permitirAlteracoesLocais ? "habilitada" : "desabilitada"}.`);

  const branch = lerTextoGit(["branch", "--show-current"]);
  console.log(`[PROFOR 2022] Branch atual: ${branch || "(não identificada)"}.`);
  if (branch && branch !== "main") {
    console.error(`[PROFOR 2022] Branch inesperada: ${branch}. Esperado: main.`);
    return 1;
  }

  const statusInicial = executarGit(["status", "--short"]).stdout.trim();
  console.log(`[PROFOR 2022] git status --short inicial: ${statusInicial || "(limpo)"}`);
  if (statusInicial && !permitirAlteracoesLocais) {
    console.error(
      `[PROFOR 2022] Working tree possui alterações locais. ` +
        `Use ${FLAG_PERMITIR_ALTERACOES} para permitir este teste controlado.`
    );
    return 1;
  }

  imprimirSecao("Atualização consolidada");
  const resultadoAtualizacao = executarNpmScript("atualizar:profor-2022");
  const resumoAtualizacao = extrairResumoAtualizacao(resultadoAtualizacao.stdout + "\n" + resultadoAtualizacao.stderr);

  console.log(
    `[PROFOR 2022] atualizar:profor-2022 => code=${resultadoAtualizacao.code}` +
      ` duração=${formatarDuracao(resultadoAtualizacao.duracaoMs)}` +
      ` sucesso=${resumoAtualizacao.sucesso}`
  );

  if (resultadoAtualizacao.code !== 0 || !resumoAtualizacao.sucesso) {
    console.error("[PROFOR 2022] Atualização consolidada não atingiu o critério 15/15/15. Publicação abortada.");
    const fimFalha = Date.now();
    console.log(`[PROFOR 2022] Fim: ${agoraIso()} | duração total: ${formatarDuracao(fimFalha - inicio)}`);
    return 1;
  }

  imprimirSecao("Publicação estática");
  const resultadoPublicacao = executarNpmScript("publicar:dados");
  const publicacaoOk = resultadoPublicacao.code === 0;
  console.log(
    `[PROFOR 2022] publicar:dados => code=${resultadoPublicacao.code}` +
      ` duração=${formatarDuracao(resultadoPublicacao.duracaoMs)}`
  );

  if (!publicacaoOk) {
    console.error("[PROFOR 2022] Publicação estática falhou. Nenhuma validação adicional foi concluída.");
    const fimFalha = Date.now();
    console.log(`[PROFOR 2022] Fim: ${agoraIso()} | duração total: ${formatarDuracao(fimFalha - inicio)}`);
    return 1;
  }

  imprimirSecao("Validações");
  const resultadoValidarJson = executarNpmScript("validar:json");
  const resultadoValidarSyntax = executarNpmScript("validar:syntax");
  const validarJsonOk = resultadoValidarJson.code === 0;
  const validarSyntaxOk = resultadoValidarSyntax.code === 0;

  console.log(
    `[PROFOR 2022] validar:json => code=${resultadoValidarJson.code} duração=${formatarDuracao(resultadoValidarJson.duracaoMs)}`
  );
  console.log(
    `[PROFOR 2022] validar:syntax => code=${resultadoValidarSyntax.code} duração=${formatarDuracao(resultadoValidarSyntax.duracaoMs)}`
  );

  imprimirSecao("Auditoria de vazamento");
  const auditoria = auditarArquivosPublicados();
  if (auditoria.ok) {
    console.log(`[PROFOR 2022] Auditoria sem vazamento: OK (${auditoria.arquivos.length} arquivos JSON).`);
  } else {
    console.error("[PROFOR 2022] Auditoria encontrou padrão proibido:");
    auditoria.falhas.forEach((falha) => {
      console.error(`- ${falha.arquivo}: ${falha.motivo}`);
    });
  }

  const statusFinal = executarGit(["status", "--short"]).stdout.trim();
  const diffNames = executarGit(["diff", "--name-only"]).stdout.trim();
  const arquivosAlterados = diffNames ? diffNames.split(/\r?\n/).filter(Boolean) : [];
  const arquivosPublicadosAlterados = arquivosAlterados.filter((arquivo) => arquivo.startsWith("frontend/data/publicados/"));
  const ultimaAtualizacao = obterUltimaAtualizacaoPublicada();
  const sucessoFinal = publicacaoOk && validarJsonOk && validarSyntaxOk && auditoria.ok;

  console.log("");
  console.log("=== Relatório final ===");
  console.log(`Início: ${inicioIso}`);
  console.log(`Fim: ${agoraIso()}`);
  console.log(`Duração total: ${formatarDuracao(Date.now() - inicio)}`);
  console.log(`Atualização consolidada: ${resumoAtualizacao.sucesso ? "OK" : "FALHA"}`);
  console.log(`Publicação estática: ${publicacaoOk ? "OK" : "FALHA"}`);
  console.log(`Validação JSON: ${validarJsonOk ? "OK" : "FALHA"}`);
  console.log(`Validação syntax: ${validarSyntaxOk ? "OK" : "FALHA"}`);
  console.log(`Auditoria de vazamento: ${auditoria.ok ? "OK" : "FALHA"}`);
  console.log(`Arquivos publicados alterados: ${arquivosPublicadosAlterados.length ? arquivosPublicadosAlterados.join(", ") : "(nenhum)"}`);
  console.log(`Arquivos alterados no working tree: ${arquivosAlterados.length ? arquivosAlterados.join(", ") : "(nenhum)"}`);
  console.log(`Última atualização operacional publicada: ${ultimaAtualizacao?.dataHora || "(ausente)"}`);
  console.log(`Origem da última atualização: ${ultimaAtualizacao?.fonte || "(ausente)"}`);
  console.log("Próximos comandos manuais sugeridos:");
  console.log("  git diff --name-only");
  console.log("  git status --short");
  console.log("  git add frontend/data/publicados/aplicacao.json frontend/data/publicados/dashboard-geral.json frontend/data/publicados/resumo-publicacao.json");
  console.log("  git commit -m \"chore(profor-2022): atualizar publicacao estatica\"");
  console.log("  git push");
  console.log("Observação: este script não executa commit/push automático.");

  if (!sucessoFinal) {
    return 1;
  }

  if (statusFinal) {
    console.log(`[PROFOR 2022] git status --short final:`);
    console.log(statusFinal);
  } else {
    console.log("[PROFOR 2022] git status --short final: (limpo)");
  }

  return 0;
}

const exitCode = main();
process.exit(exitCode);

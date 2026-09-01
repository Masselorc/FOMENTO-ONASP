const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "frontend", "data", "publicados");
const FLAG_PERMITIR_ALTERACOES = "--permitir-alteracoes-locais";

const { registrarLogOperacional } = require("../services/logs-operacionais-service");
const {
  recarregarPadsOperacional,
} = require("../services/profor-2022/profor-pad-recarga-operacional-service");

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

function obterDiagnosticoConsolidadoPublicado() {
  const aplicacaoPath = path.join(PUBLIC_DIR, "aplicacao.json");
  if (!fs.existsSync(aplicacaoPath)) return null;
  try {
    const aplicacao = lerJson(aplicacaoPath);
    const diag = aplicacao?.dadosProfor2022?.diagnostico || null;
    if (!diag) return null;
    return {
      totalConvenios: Number(diag.totalCarteira ?? diag.totalConvenios ?? 0),
      totalComDetru: Number(diag.totalComDetru ?? 0),
      totalComPlano: Number(diag.totalComPlano ?? 0),
      totalComRendimentos: Number(diag.totalComRendimentos ?? 0),
    };
  } catch (_error) {
    return null;
  }
}

async function registrarLogPublicacaoEstatica(estado) {
  const resumoLog =
    `atualizacao=${estado.atualizacaoOk ? "OK" : "FALHA"} | ` +
    `publicacao=${estado.publicacaoExecutada ? (estado.publicacaoOk ? "OK" : "FALHA") : "nao executada"} | ` +
    `validacaoJson=${estado.validarJsonOk === null ? "n/a" : (estado.validarJsonOk ? "OK" : "FALHA")} | ` +
    `validacaoSyntax=${estado.validarSyntaxOk === null ? "n/a" : (estado.validarSyntaxOk ? "OK" : "FALHA")} | ` +
    `auditoria=${estado.auditoriaOk === null ? "n/a" : (estado.auditoriaOk ? "OK" : "FALHA")}` +
    (estado.motivoBloqueio ? ` | bloqueio=${estado.motivoBloqueio}` : "");

  try {
    await registrarLogOperacional({
      modulo: "profor-2022",
      tipoEvento: "profor_publicacao_estatica",
      status: estado.status,
      iniciadoEm: estado.iniciadoEm,
      concluidoEm: estado.concluidoEm,
      duracaoMs: estado.duracaoMs,
      resumo: resumoLog,
      payload: {
        atualizacaoExecutada: Boolean(estado.atualizacaoExecutada),
        atualizacaoOk: Boolean(estado.atualizacaoOk),
        publicacaoExecutada: Boolean(estado.publicacaoExecutada),
        publicacaoOk: Boolean(estado.publicacaoOk),
        motivoBloqueio: estado.motivoBloqueio || null,
        diagnostico: estado.diagnostico || null,
        validacaoJson: estado.validarJsonOk === null ? null : (estado.validarJsonOk ? "OK" : "erro"),
        validacaoSyntax: estado.validarSyntaxOk === null ? null : (estado.validarSyntaxOk ? "OK" : "erro"),
        auditoriaVazamento: estado.auditoriaOk === null ? null : (estado.auditoriaOk ? "OK" : "erro"),
        arquivosPublicadosAlterados: estado.arquivosPublicadosAlterados || [],
        publicadoEm: estado.concluidoEm,
        ultimaAtualizacaoDados: estado.ultimaAtualizacaoDados || null,
        sucessoFinal: Boolean(estado.sucessoFinal),
        exitCode: estado.exitCode,
      },
    });
  } catch (erroLog) {
    console.warn("[PROFOR 2022] Falha ao registrar log operacional da publicacao:", erroLog?.message || erroLog);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida. Este script agora depende do Postgres/Supabase.");
    process.exit(1);
  }
  const inicio = Date.now();
  const inicioIso = agoraIso();
  const permitirAlteracoesLocais = process.argv.slice(2).includes(FLAG_PERMITIR_ALTERACOES);

  const estado = {
    iniciadoEm: inicioIso,
    concluidoEm: null,
    duracaoMs: 0,
    status: "falha",
    atualizacaoExecutada: false,
    atualizacaoOk: false,
    publicacaoExecutada: false,
    publicacaoOk: false,
    motivoBloqueio: null,
    diagnostico: null,
    validarJsonOk: null,
    validarSyntaxOk: null,
    auditoriaOk: null,
    arquivosPublicadosAlterados: [],
    ultimaAtualizacaoDados: null,
    sucessoFinal: false,
    exitCode: 1,
  };

  const finalizar = async (codigo) => {
    estado.concluidoEm = agoraIso();
    estado.duracaoMs = Date.now() - inicio;
    estado.exitCode = codigo;
    if (estado.sucessoFinal && codigo === 0) {
      estado.status = "sucesso";
    } else if (estado.motivoBloqueio) {
      estado.status = "bloqueado";
    } else {
      estado.status = "falha";
    }
    await registrarLogPublicacaoEstatica(estado);
    return codigo;
  };

  console.log(`[PROFOR 2022] Rotina semiautomática de publicação iniciada em ${inicioIso}.`);
  console.log(`[PROFOR 2022] Flag de exceção de working tree: ${permitirAlteracoesLocais ? "habilitada" : "desabilitada"}.`);

  const branch = lerTextoGit(["branch", "--show-current"]);
  console.log(`[PROFOR 2022] Branch atual: ${branch || "(não identificada)"}.`);
  if (branch && branch !== "main") {
    console.error(`[PROFOR 2022] Branch inesperada: ${branch}. Esperado: main.`);
    estado.motivoBloqueio = `branch inesperada: ${branch}`;
    return await finalizar(1);
  }

  const statusInicial = executarGit(["status", "--short"]).stdout.trim();
  console.log(`[PROFOR 2022] git status --short inicial: ${statusInicial || "(limpo)"}`);
  if (statusInicial && !permitirAlteracoesLocais) {
    console.error(
      `[PROFOR 2022] Working tree possui alterações locais. ` +
        `Use ${FLAG_PERMITIR_ALTERACOES} para permitir este teste controlado.`
    );
    estado.motivoBloqueio = "working tree com alteracoes locais";
    return await finalizar(1);
  }

  imprimirSecao("Recarga/reconstrução PAD operacional");
  estado.atualizacaoExecutada = true;
  const inicioRecarga = Date.now();
  let recarga;
  try {
    recarga = await recarregarPadsOperacional({ repoRoot: ROOT_DIR });
  } catch (erro) {
    console.error(`[PROFOR 2022] Falha na recarga/reconstrução PAD operacional: ${erro?.message || erro}`);
    estado.motivoBloqueio = `recarga/reconstrucao PAD falhou: ${erro?.message || erro}`;
    return await finalizar(1);
  }

  const aptoParaPublicacao = recarga?.aptoParaPublicacao === true;
  estado.atualizacaoOk = aptoParaPublicacao;

  console.log(
    `[PROFOR 2022] recarga operacional => sucesso=${recarga?.sucesso} ` +
      `aptoParaUsoLocal=${recarga?.aptoParaUsoLocal} ` +
      `aptoParaPublicacao=${recarga?.aptoParaPublicacao} ` +
      `impedimentos=${recarga?.totalImpedimentos ?? "?"} ` +
      `duração=${formatarDuracao(Date.now() - inicioRecarga)}`
  );

  if (!aptoParaPublicacao) {
    console.error("[PROFOR 2022] Reconstrução PAD não está apta para publicação. Publicação abortada.");
    estado.motivoBloqueio = `reconstrucao PAD com aptoParaPublicacao=${String(recarga?.aptoParaPublicacao)}`;
    if (Array.isArray(recarga?.impedimentos) && recarga.impedimentos.length > 0) {
      estado.motivoBloqueio += ` (${recarga.impedimentos.length} impedimento(s))`;
    }
    console.log(`[PROFOR 2022] Fim: ${agoraIso()} | duração total: ${formatarDuracao(Date.now() - inicio)}`);
    return await finalizar(1);
  }

  imprimirSecao("Publicação estática");
  estado.publicacaoExecutada = true;
  const resultadoPublicacao = executarNpmScript("publicar:dados");
  const publicacaoOk = resultadoPublicacao.code === 0;
  estado.publicacaoOk = publicacaoOk;
  console.log(
    `[PROFOR 2022] publicar:dados => code=${resultadoPublicacao.code}` +
      ` duração=${formatarDuracao(resultadoPublicacao.duracaoMs)}`
  );

  if (!publicacaoOk) {
    console.error("[PROFOR 2022] Publicação estática falhou. Nenhuma validação adicional foi concluída.");
    estado.motivoBloqueio = "publicar:dados falhou";
    const fimFalha = Date.now();
    console.log(`[PROFOR 2022] Fim: ${agoraIso()} | duração total: ${formatarDuracao(fimFalha - inicio)}`);
    return await finalizar(1);
  }

  imprimirSecao("Validações");
  const resultadoValidarJson = executarNpmScript("validar:json");
  const resultadoValidarSyntax = executarNpmScript("validar:syntax");
  const validarJsonOk = resultadoValidarJson.code === 0;
  const validarSyntaxOk = resultadoValidarSyntax.code === 0;
  estado.validarJsonOk = validarJsonOk;
  estado.validarSyntaxOk = validarSyntaxOk;

  console.log(
    `[PROFOR 2022] validar:json => code=${resultadoValidarJson.code} duração=${formatarDuracao(resultadoValidarJson.duracaoMs)}`
  );
  console.log(
    `[PROFOR 2022] validar:syntax => code=${resultadoValidarSyntax.code} duração=${formatarDuracao(resultadoValidarSyntax.duracaoMs)}`
  );

  imprimirSecao("Auditoria de vazamento");
  const auditoria = auditarArquivosPublicados();
  estado.auditoriaOk = auditoria.ok;
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

  estado.arquivosPublicadosAlterados = arquivosPublicadosAlterados;
  estado.ultimaAtualizacaoDados = ultimaAtualizacao;
  estado.diagnostico = obterDiagnosticoConsolidadoPublicado();
  estado.sucessoFinal = sucessoFinal;

  console.log("");
  console.log("=== Relatório final ===");
  console.log(`Início: ${inicioIso}`);
  console.log(`Fim: ${agoraIso()}`);
  console.log(`Duração total: ${formatarDuracao(Date.now() - inicio)}`);
  console.log(`Recarga/reconstrução PAD: ${aptoParaPublicacao ? "OK (aptoParaPublicacao=true)" : "FALHA"}`);
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
    estado.motivoBloqueio = estado.motivoBloqueio || "validacao ou auditoria falhou";
    return await finalizar(1);
  }

  if (statusFinal) {
    console.log(`[PROFOR 2022] git status --short final:`);
    console.log(statusFinal);
  } else {
    console.log("[PROFOR 2022] git status --short final: (limpo)");
  }

  return await finalizar(0);
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

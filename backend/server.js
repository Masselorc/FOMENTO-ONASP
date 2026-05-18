const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const xlsx = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const { prepararBanco } = require("./db/preparar-banco");
const {
  listarParametrosMinimos,
  salvarParametrosMinimos,
  reverterHistoricoParametrosMinimos,
  listarHistoricoParametrosMinimos
} = require("./services/parametros-minimos-service");
const {
  listarFormalizacaoProfor,
  salvarFormalizacaoProfor,
  listarHistoricoFormalizacaoProfor,
  inicializarFormalizacaoProfor
} = require("./services/formalizacao-profor-service");
const {
  listarOrcamento2026,
  criarProcessoVinculadoOrcamento2026,
  alocarSaldoOrcamento2026,
  listarMovimentacoesOrcamento2026,
  salvarOrcamento2026,
  listarHistoricoOrcamento2026,
  inicializarOrcamento2026
} = require("./services/orcamento-2026-service");
const {
  listarFaf2021,
  salvarExecucaoFaf2021
} = require("./services/faf-2021-service");
const {
  listarConveniosMonitorados,
  criarConvenioMonitorado,
  atualizarConvenioMonitorado,
  inativarConvenioMonitorado
} = require("./services/profor-2022/convenios-monitorados-service");
const { atualizarCacheDetruProfor2022 } = require("./services/profor-2022/profor-detru-update-service");
const { obterUltimaAtualizacaoDetru } = require("./services/profor-2022/profor-detru-cache-service");
const { obterUltimaConsultaRendimentos } = require("./services/profor-2022/transferegov-rendimentos-cache-service");
const { montarConsolidadoProfor2022 } = require("./services/profor-2022/profor-consolidado-service");
const { compararBasesProfor2022 } = require("./services/profor-2022/profor-comparador-service");
const { resolverOrigemDadosProfor2022 } = require("./services/profor-2022/profor-origem-service");
const {
  atualizarProfor2022Consolidado
} = require("./services/profor-2022/profor-atualizacao-consolidada-service");
const {
  calcularUltimaAtualizacaoDadosProfor2022
} = require("./services/profor-2022/profor-atualizacao-meta-service");
const {
  montarDadosProfor2022Publicacao,
  extrairPlanoAplicacaoProforDoWorkbook
} = require("./services/dashboard-publication-service");
const {
  exportarParametrosMinimosExcel,
  exportarFormalizacaoProforExcel,
  exportarOrcamento2026Excel
} = require("./services/excel-export-service");
const { publicarDadosEstaticos } = require("./services/static-publication-service");

const rootDir = path.join(__dirname, "..");
const catalogoAplicacaoPath = path.join(__dirname, "data", "aplicacao.json");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8790);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const CAMINHOS_ESTATICOS_PERMITIDOS = new Set([
  "index.html",
  "backend/services/data-service.js",
  "backend/services/analytics.js",
  "backend/data/aplicacao.json"
]);
const PREFIXOS_ESTATICOS_PERMITIDOS = [
  "frontend/",
  "planilhas/"
];
const PREFIXOS_ESTATICOS_BLOQUEADOS = [
  "backend/data/backups/",
  "backend/db/",
  "backend/scripts/",
  "memoria/",
  "node_modules/",
  ".git/"
];
const ARQUIVOS_ESTATICOS_BLOQUEADOS = new Set([
  ".env",
  "package.json",
  "package-lock.json"
]);
const EXTENSOES_ESTATICAS_BLOQUEADAS = [
  ".sqlite",
  ".sqlite-wal",
  ".sqlite-shm",
  ".log"
];

function enviarJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function enviarErroApi(res, error) {
  const statusCode = Number(error?.statusCode);
  const ehErroCliente = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500;

  if (ehErroCliente) {
    enviarJson(res, statusCode, {
      success: false,
      message: error.message || "Requisicao invalida."
    });
    return;
  }

  console.error("Erro interno na API:", error);
  enviarJson(res, 500, {
    success: false,
    message: "Erro interno no servidor."
  });
}

function lerJsonBody(req) {
  return new Promise((resolve, reject) => {
    const limiteBytes = 1_000_000;
    let bytesRecebidos = 0;
    let body = "";
    let finalizado = false;

    function rejeitar(error) {
      if (finalizado) return;
      finalizado = true;
      reject(error);
    }

    function resolver(payload) {
      if (finalizado) return;
      finalizado = true;
      resolve(payload);
    }

    req.on("data", (chunk) => {
      if (finalizado) return;
      bytesRecebidos += chunk.length;
      if (bytesRecebidos > limiteBytes) {
        rejeitar(new HttpError(413, "Corpo da requisição excedeu o limite."));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (finalizado) return;
      try {
        resolver(body ? JSON.parse(body) : {});
      } catch {
        rejeitar(new HttpError(400, "JSON inválido."));
      }
    });
    req.on("error", (error) => {
      if (finalizado) return;
      rejeitar(error);
    });
  });
}

async function publicarAposSalvamento(resultado) {
  if (!resultado?.success) return resultado;

  try {
    const publicacao = await publicarDadosEstaticos();
    return {
      ...resultado,
      publicacaoEstatica: publicacao,
      message: "Alterações salvas e dados públicos atualizados."
    };
  } catch (error) {
    console.error("Falha ao publicar dados estaticos:", error);
    return {
      ...resultado,
      warning: true,
      publicacaoEstatica: {
        success: false,
        message: error.message || "Erro ao atualizar dados publicos."
      },
      message: "Alterações salvas localmente, mas houve falha ao atualizar os dados públicos."
    };
  }
}

function camelParaSnakeConvenio(payload) {
  const resultado = {};
  if (payload.numeroConvenio !== undefined) resultado.numero_convenio = payload.numeroConvenio;
  if (payload.ano !== undefined) resultado.ano = payload.ano;
  if (payload.uf !== undefined) resultado.uf = payload.uf;
  if (payload.instrumento !== undefined) resultado.instrumento = payload.instrumento;
  if (payload.programaOrigem !== undefined) resultado.programa_origem = payload.programaOrigem;
  if (payload.idConvenioTransferegov !== undefined) resultado.id_convenio_transferegov = payload.idConvenioTransferegov;
  if (payload.observacao !== undefined) resultado.observacao = payload.observacao;
  return resultado;
}

function extrairIdConvenioMonitorado(pathname, sufixo) {
  const prefixo = "/api/profor-2022/convenios-monitorados/";
  if (!pathname.startsWith(prefixo) || !pathname.endsWith(sufixo)) return null;
  const segmento = pathname.slice(prefixo.length, pathname.length - sufixo.length);
  const id = Number(segmento);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizarUltimaAtualizacaoDetru(registro) {
  if (!registro) return null;

  let resumo = null;
  if (registro.resumo_json) {
    try {
      resumo = JSON.parse(registro.resumo_json);
    } catch {
      resumo = null;
    }
  }

  return {
    id: registro.id ?? null,
    iniciadoEm: registro.iniciado_em ?? null,
    concluidoEm: registro.concluido_em ?? null,
    sucesso: registro.sucesso === 1,
    caminhoArquivo: registro.caminho_arquivo ?? null,
    arquivoHash: registro.arquivo_hash ?? null,
    totalCarteiraAtiva: registro.total_carteira_ativa ?? 0,
    totalLinhasDetruLidas: registro.total_linhas_detru_lidas ?? 0,
    totalEncontrados: registro.total_encontrados ?? 0,
    totalNaoEncontrados: registro.total_nao_encontrados ?? 0,
    erro: registro.erro ?? null,
    resumo
  };
}

function carregarCatalogoAplicacaoLocal() {
  return JSON.parse(fs.readFileSync(catalogoAplicacaoPath, "utf8"));
}

function carregarWorkbookProfor2022(catalogoAplicacao) {
  const planilhaRelativa = catalogoAplicacao?.configuracao?.arquivoPlanilhaConvenios;
  if (!planilhaRelativa) {
    throw new Error("Catalogo da aplicacao sem configuracao.arquivoPlanilhaConvenios.");
  }

  return xlsx.readFile(path.join(rootDir, planilhaRelativa), { cellDates: true });
}

function montarConsolidadoProfor2022Local() {
  const catalogoAplicacao = carregarCatalogoAplicacaoLocal();
  const workbook = carregarWorkbookProfor2022(catalogoAplicacao);
  const planoAplicacao = extrairPlanoAplicacaoProforDoWorkbook(workbook, catalogoAplicacao);
  return montarConsolidadoProfor2022({
    origemDados: "banco-cache",
    planoAplicacao
  });
}

function montarComparacaoOrigensProfor2022Local() {
  const catalogoAplicacao = carregarCatalogoAplicacaoLocal();
  const workbook = carregarWorkbookProfor2022(catalogoAplicacao);
  const planoAplicacao = extrairPlanoAplicacaoProforDoWorkbook(workbook, catalogoAplicacao);
  const baseAntiga = montarDadosProfor2022Publicacao(workbook, catalogoAplicacao, {
    origemDados: "planilha"
  });
  const baseNova = montarConsolidadoProfor2022({
    origemDados: "banco-cache",
    planoAplicacao
  });
  return compararBasesProfor2022(baseAntiga, baseNova);
}

function enviarArquivoEstatico(req, res, pathname) {
  const caminhoRelativo = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const caminhoArquivo = path.resolve(rootDir, caminhoRelativo);
  const relativoRaiz = path.relative(rootDir, caminhoArquivo);
  const caminhoNormalizado = relativoRaiz.replace(/\\/g, "/").toLowerCase();

  if (relativoRaiz.startsWith("..") || path.isAbsolute(relativoRaiz)) {
    enviarJson(res, 403, { success: false, message: "Acesso negado." });
    return;
  }

  if (!caminhoEstaticoPermitido(caminhoNormalizado)) {
    enviarJson(res, 403, { success: false, message: "Acesso negado." });
    return;
  }

  fs.readFile(caminhoArquivo, (error, conteudo) => {
    if (error) {
      enviarJson(res, 404, { success: false, message: "Arquivo não encontrado." });
      return;
    }

    const ext = path.extname(caminhoArquivo).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(conteudo);
  });
}

function caminhoEstaticoPermitido(caminhoRelativoNormalizado) {
  if (!caminhoRelativoNormalizado || caminhoRelativoNormalizado.startsWith("../")) {
    return false;
  }

  if (ARQUIVOS_ESTATICOS_BLOQUEADOS.has(caminhoRelativoNormalizado)) {
    return false;
  }

  for (const sufixo of EXTENSOES_ESTATICAS_BLOQUEADAS) {
    if (caminhoRelativoNormalizado.endsWith(sufixo)) {
      return false;
    }
  }

  for (const prefixo of PREFIXOS_ESTATICOS_BLOQUEADOS) {
    if (caminhoRelativoNormalizado.startsWith(prefixo)) {
      return false;
    }
  }

  if (caminhoRelativoNormalizado.startsWith("backend/services/")) {
    return CAMINHOS_ESTATICOS_PERMITIDOS.has(caminhoRelativoNormalizado);
  }

  if (caminhoRelativoNormalizado.startsWith("backend/data/")) {
    return CAMINHOS_ESTATICOS_PERMITIDOS.has(caminhoRelativoNormalizado);
  }

  if (CAMINHOS_ESTATICOS_PERMITIDOS.has(caminhoRelativoNormalizado)) {
    return true;
  }

  return PREFIXOS_ESTATICOS_PERMITIDOS.some((prefixo) => caminhoRelativoNormalizado.startsWith(prefixo));
}

function obterUrlsRede(porta) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${porta}/index.html`);
}

function exibirMensagemServidor() {
  console.log("Aplicação ONASP disponível em:");
  console.log(`- Local: http://localhost:${port}/index.html`);

  if (host === "0.0.0.0" || host === "::") {
    const urlsRede = obterUrlsRede(port);
    if (urlsRede.length) {
      urlsRede.forEach((endereco) => console.log(`- Rede: ${endereco}`));
      return;
    }
  }

  console.log(`- Host configurado: http://${host}:${port}/index.html`);
}

async function rotearApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/parametros-minimos") {
      enviarJson(res, 200, listarParametrosMinimos());
      return;
    }

    if (req.method === "POST" && pathname === "/api/parametros-minimos/salvar") {
      const payload = await lerJsonBody(req);
      const resultado = salvarParametrosMinimos(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "GET" && pathname === "/api/parametros-minimos/historico") {
      enviarJson(res, 200, {
        success: true,
        historico: listarHistoricoParametrosMinimos()
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/parametros-minimos/historico/reverter") {
      const payload = await lerJsonBody(req);
      const resultado = reverterHistoricoParametrosMinimos(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "GET" && pathname === "/api/parametros-minimos/exportar") {
      const buffer = exportarParametrosMinimosExcel();
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"parametros-minimos.xlsx\"",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": buffer.length
      });
      res.end(buffer);
      return;
    }

    if (req.method === "GET" && pathname === "/api/formalizacao-profor") {
      enviarJson(res, 200, listarFormalizacaoProfor());
      return;
    }

    if (req.method === "POST" && pathname === "/api/formalizacao-profor/salvar") {
      const payload = await lerJsonBody(req);
      const resultado = salvarFormalizacaoProfor(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "GET" && pathname === "/api/formalizacao-profor/historico") {
      enviarJson(res, 200, {
        success: true,
        historico: listarHistoricoFormalizacaoProfor()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/formalizacao-profor/exportar") {
      const buffer = exportarFormalizacaoProforExcel();
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"formalizacao-profor.xlsx\"",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": buffer.length
      });
      res.end(buffer);
      return;
    }

    if (req.method === "GET" && pathname === "/api/orcamento-2026") {
      enviarJson(res, 200, listarOrcamento2026());
      return;
    }

    if (req.method === "POST" && pathname === "/api/orcamento-2026/salvar") {
      const payload = await lerJsonBody(req);
      const resultado = salvarOrcamento2026(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "POST" && pathname === "/api/orcamento-2026/processos-vinculados/criar") {
      const payload = await lerJsonBody(req);
      const resultado = criarProcessoVinculadoOrcamento2026(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "POST" && pathname === "/api/orcamento-2026/saldos/alocar") {
      const payload = await lerJsonBody(req);
      const resultado = alocarSaldoOrcamento2026(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "GET" && pathname === "/api/orcamento-2026/movimentacoes") {
      enviarJson(res, 200, {
        success: true,
        movimentacoes: listarMovimentacoesOrcamento2026()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/orcamento-2026/historico") {
      enviarJson(res, 200, {
        success: true,
        historico: listarHistoricoOrcamento2026()
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/orcamento-2026/exportar") {
      const buffer = exportarOrcamento2026Excel();
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"orcamento-2026.xlsx\"",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": buffer.length
      });
      res.end(buffer);
      return;
    }

    if (req.method === "GET" && pathname === "/api/faf2021") {
      enviarJson(res, 200, listarFaf2021());
      return;
    }

    if (req.method === "POST" && pathname === "/api/faf2021/salvar") {
      const payload = await lerJsonBody(req);
      const resultado = salvarExecucaoFaf2021(payload);
      const resposta = await publicarAposSalvamento(resultado);
      enviarJson(res, resposta.success ? 200 : 400, resposta);
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/origem") {
      const origem = resolverOrigemDadosProfor2022({ detalhado: true });
      enviarJson(res, 200, {
        success: true,
        origemDados: origem.origemDados,
        origemDadosEfetiva: origem.origemDados,
        fallbackUsado: false,
        avisos: origem.avisos || []
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/consolidado") {
      try {
        const data = montarConsolidadoProfor2022Local();
        enviarJson(res, 200, {
          success: true,
          origemDados: "banco-cache",
          data: {
            resumo: data.resumo,
            convenios: data.convenios,
            filtros: data.filtros,
            avisos: data.avisos,
            diagnostico: data.diagnostico,
            origemDados: data.origemDados,
            geradoEm: data.geradoEm
          }
        });
      } catch (erro) {
        console.error("Falha ao montar consolidado PROFOR 2022:", erro);
        enviarJson(res, 500, {
          success: false,
          message: "Não foi possível montar o consolidado PROFOR 2022 no momento."
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/comparar-origens") {
      try {
        const comparacao = montarComparacaoOrigensProfor2022Local();
        enviarJson(res, 200, {
          success: true,
          comparacao,
          resumo: comparacao.resumo,
          avisos: []
        });
      } catch (erro) {
        console.error("Falha ao comparar origens PROFOR 2022:", erro);
        enviarJson(res, 500, {
          success: false,
          message: "Não foi possível comparar as origens PROFOR 2022 no momento."
        });
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/profor-2022/detru/atualizar") {
      const body = await lerJsonBody(req);
      try {
        const resultado = await atualizarCacheDetruProfor2022(body || {});
        const ultimaAtualizacao = normalizarUltimaAtualizacaoDetru(obterUltimaAtualizacaoDetru());
        enviarJson(res, 200, {
          success: true,
          message: "Atualização DETRU concluída com sucesso.",
          totalSalvos: resultado.totalSalvos,
          resultadoResumo: resultado.resultadoResumo,
          ultimaAtualizacao
        });
      } catch (erro) {
        const statusCode = Number.isInteger(Number(erro?.statusCode)) && Number(erro?.statusCode) >= 400 && Number(erro?.statusCode) < 600
          ? Number(erro.statusCode)
          : 500;
        if (statusCode >= 500) {
          console.error("Falha ao atualizar DETRU:", erro);
        }
        enviarJson(res, statusCode, {
          success: false,
          message: erro?.message || "Erro ao atualizar o DETRU."
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/detru/ultima-atualizacao") {
      enviarJson(res, 200, {
        success: true,
        ultimaAtualizacao: normalizarUltimaAtualizacaoDetru(obterUltimaAtualizacaoDetru())
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/profor-2022/atualizar") {
      const body = await lerJsonBody(req);
      try {
        const resultado = await atualizarProfor2022Consolidado(body || {});
        enviarJson(res, 200, {
          success: true,
          message: resultado.sucesso
            ? "Atualizacao consolidada PROFOR 2022 concluida."
            : "Atualizacao consolidada PROFOR 2022 concluida com avisos/erros.",
          resultado
        });
      } catch (erro) {
        console.error("Falha ao executar atualizacao consolidada PROFOR 2022:", erro);
        enviarJson(res, 500, {
          success: false,
          message: erro?.message || "Erro ao atualizar PROFOR 2022."
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/atualizacao/status") {
      const avisos = [];
      const origem = resolverOrigemDadosProfor2022({ detalhado: true });

      let ultimaAtualizacaoDetru = null;
      try {
        ultimaAtualizacaoDetru = normalizarUltimaAtualizacaoDetru(obterUltimaAtualizacaoDetru());
      } catch (err) {
        avisos.push(`Ultima atualizacao DETRU indisponivel: ${err?.message || err}`);
      }

      let ultimaConsultaRendimentos = null;
      try {
        ultimaConsultaRendimentos = obterUltimaConsultaRendimentos();
      } catch (err) {
        avisos.push(`Ultima consulta de rendimentos indisponivel: ${err?.message || err}`);
      }

      let diagnosticoConsolidado = null;
      let geradoEmConsolidado = null;
      try {
        const consolidado = montarConsolidadoProfor2022Local();
        diagnosticoConsolidado = consolidado?.diagnostico || null;
        geradoEmConsolidado = consolidado?.geradoEm || null;
      } catch (err) {
        avisos.push(`Diagnostico consolidado indisponivel: ${err?.message || err}`);
      }

      const ultimaAtualizacaoDados = calcularUltimaAtualizacaoDadosProfor2022(
        ultimaAtualizacaoDetru,
        ultimaConsultaRendimentos
      );

      enviarJson(res, 200, {
        success: true,
        origemDados: origem.origemDados,
        origemAvisos: origem.avisos || [],
        ultimaAtualizacaoDados,
        ultimaAtualizacaoDetru,
        ultimaConsultaRendimentos,
        diagnosticoConsolidado,
        geradoEmConsolidado,
        avisos
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/convenios-monitorados") {
      const url = new URL(req.url, "http://localhost");
      const incluirInativos = url.searchParams.get("incluirInativos") === "true";
      const convenios = listarConveniosMonitorados({ incluirInativos });
      enviarJson(res, 200, { success: true, convenios });
      return;
    }

    if (req.method === "POST" && pathname === "/api/profor-2022/convenios-monitorados") {
      const body = await lerJsonBody(req);
      try {
        const convenio = criarConvenioMonitorado(camelParaSnakeConvenio(body));
        enviarJson(res, 200, { success: true, convenio });
      } catch (erro) {
        enviarJson(res, 400, { success: false, message: erro.message });
      }
      return;
    }

    const idSalvar = extrairIdConvenioMonitorado(pathname, "/salvar");
    if (req.method === "POST" && idSalvar !== null) {
      const body = await lerJsonBody(req);
      try {
        const convenio = atualizarConvenioMonitorado(idSalvar, camelParaSnakeConvenio(body));
        enviarJson(res, 200, { success: true, convenio });
      } catch (erro) {
        enviarJson(res, 400, { success: false, message: erro.message });
      }
      return;
    }

    const idInativar = extrairIdConvenioMonitorado(pathname, "/inativar");
    if (req.method === "POST" && idInativar !== null) {
      try {
        const convenio = inativarConvenioMonitorado(idInativar);
        enviarJson(res, 200, { success: true, convenio });
      } catch (erro) {
        enviarJson(res, 400, { success: false, message: erro.message });
      }
      return;
    }

    enviarJson(res, 404, { success: false, message: "Endpoint não encontrado." });
  } catch (error) {
    enviarErroApi(res, error);
  }
}

prepararBanco();

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsed.pathname || "/");

  if (pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    rotearApi(req, res, pathname);
    return;
  }

  enviarArquivoEstatico(req, res, pathname);
});

server.listen(port, host, exibirMensagemServidor);

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
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
const { resolverOrigemDadosProfor2022 } = require("./services/profor-2022/profor-origem-service");
const {
  assertEndpointAdminPermitido,
  assertChamadaExternaPermitida,
} = require("./services/profor-2022/profor-workbook-fallback-guard-service");
const {
  executarEtapaRendimentos
} = require("./services/profor-2022/profor-atualizacao-consolidada-service");
const {
  calcularUltimaAtualizacaoDadosProfor2022
} = require("./services/profor-2022/profor-atualizacao-meta-service");
const revisaoDecisaoService = require("./services/profor-2022/profor-pad-revisao-decisao-service");
const {
  recarregarPadsOperacional,
  obterUltimaRecargaOperacional,
} = require("./services/profor-2022/profor-pad-recarga-operacional-service");
const {
  montarDadosProfor2022Publicacao
} = require("./services/dashboard-publication-service");
const {
  exportarParametrosMinimosExcel,
  exportarFormalizacaoProforExcel,
  exportarOrcamento2026Excel
} = require("./services/excel-export-service");
const { publicarDadosEstaticos } = require("./services/static-publication-service");
const {
  listarLogsOperacionais,
  obterLogOperacionalPorId,
  exportarLogsOperacionaisJson,
  exportarLogsOperacionaisCsv,
} = require("./services/logs-operacionais-service");

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

function obterUltimaAtualizacaoDadosProfor2022Seguro() {
  let ultimaDetru = null;
  try {
    ultimaDetru = normalizarUltimaAtualizacaoDetru(obterUltimaAtualizacaoDetru());
  } catch {
    ultimaDetru = null;
  }

  let ultimaRendimentos = null;
  try {
    ultimaRendimentos = obterUltimaConsultaRendimentos();
  } catch {
    ultimaRendimentos = null;
  }

  return calcularUltimaAtualizacaoDadosProfor2022(ultimaDetru, ultimaRendimentos);
}

function carregarCatalogoAplicacaoLocal() {
  return JSON.parse(fs.readFileSync(catalogoAplicacaoPath, "utf8"));
}

// Wrapper centralizado para o endpoint `/api/profor-2022/consolidado`. Resolve
// a origem ativa e monta o consolidado somente por PAD/reconstrucao.
function montarConsolidadoProfor2022PorOrigemAtiva() {
  const origemAtiva = resolverOrigemDadosProfor2022();
  if (origemAtiva !== "reconstrucao-pad") {
    throw new Error(
      `[consolidado_por_origem_ativa] Origem ativa removida: '${origemAtiva}'. ` +
        `A planilha antiga por abas e o banco-cache legado não são mais fontes operacionais. ` +
        `Use reconstrucao-pad.`
    );
  }
  const catalogoAplicacao = carregarCatalogoAplicacaoLocal();
  return montarDadosProfor2022Publicacao(null, catalogoAplicacao, {
    origemDados: "reconstrucao-pad",
  });
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
        const data = montarConsolidadoProfor2022PorOrigemAtiva();
        enviarJson(res, 200, {
          success: true,
          origemDados: data.origemDados,
          data: {
            resumo: data.resumo,
            convenios: data.convenios,
            filtros: data.filtros,
            avisos: data.avisos,
            diagnostico: data.diagnostico,
            origemDados: data.origemDados,
            origemDadosEfetiva: data.origemDadosEfetiva,
            geradoEm: data.geradoEm,
            ultimaAtualizacaoDados: data.ultimaAtualizacaoDados || obterUltimaAtualizacaoDadosProfor2022Seguro()
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

    if (req.method === "POST" && pathname === "/api/profor-2022/detru/atualizar") {
      const body = await lerJsonBody(req);
      try {
        assertEndpointAdminPermitido("api_profor_2022_detru_atualizar");
        assertChamadaExternaPermitida("api_profor_2022_detru_atualizar", { tipo: "DETRU" });
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

    if (req.method === "POST" && pathname === "/api/profor-2022/rendimentos/atualizar") {
      const body = await lerJsonBody(req);
      try {
        assertEndpointAdminPermitido("api_profor_2022_rendimentos_atualizar");
        assertChamadaExternaPermitida("api_profor_2022_rendimentos_atualizar", {
          tipo: "Transferegov",
        });
        const resultado = await executarEtapaRendimentos(body || {});
        enviarJson(res, 200, {
          success: resultado.sucesso,
          message: resultado.sucesso
            ? "Atualização de rendimentos Transferegov concluída."
            : "Atualização de rendimentos Transferegov concluída com avisos/erros.",
          resultado
        });
      } catch (erro) {
        const statusCode = Number.isInteger(Number(erro?.statusCode)) && Number(erro?.statusCode) >= 400 && Number(erro?.statusCode) < 600
          ? Number(erro.statusCode)
          : 500;
        if (statusCode >= 500) {
          console.error("Falha ao atualizar rendimentos Transferegov:", erro);
        }
        enviarJson(res, statusCode, {
          success: false,
          message: erro?.message || "Erro ao atualizar rendimentos Transferegov."
        });
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/profor-2022/atualizar") {
      enviarJson(res, 410, {
        success: false,
        message:
          "Atualizacao consolidada legada PROFOR 2022 removida. " +
          "Use os fluxos PAD/reconstrucao; este endpoint nao aciona DETRU, Transferegov ou workbook."
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/profor-2022/pad/recarregar") {
      try {
        const resultado = await recarregarPadsOperacional();
        const primeiroImpedimento = Array.isArray(resultado?.impedimentos)
          ? resultado.impedimentos[0]
          : null;
        const mensagem = resultado.sucesso
          ? "Recarga PAD concluida."
          : primeiroImpedimento?.detalhe
            || resultado?.mensagem
            || "Recarga PAD concluida com impedimentos.";

        enviarJson(res, 200, {
          success: resultado.sucesso,
          message: mensagem,
          etapa: primeiroImpedimento?.etapa || null,
          payload: resultado
        });
      } catch (erro) {
        console.error("Falha ao recarregar PADs:", erro);
        enviarJson(res, 500, {
          success: false,
          message: erro?.message || "Erro ao recarregar PADs."
        });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/pad/ultima-recarga") {
      try {
        const resultado = obterUltimaRecargaOperacional();
        enviarJson(res, 200, {
          success: resultado.sucesso !== false,
          payload: resultado
        });
      } catch (erro) {
        console.error("Falha ao obter ultima recarga:", erro);
        enviarJson(res, 500, {
          success: false,
          message: erro?.message || "Erro ao obter última recarga."
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
        const consolidado = montarConsolidadoProfor2022PorOrigemAtiva();
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

    if (req.method === "GET" && pathname === "/api/sistema/logs-operacionais") {
      const url = new URL(req.url, "http://localhost");
      const filtros = {
        modulo: url.searchParams.get("modulo") || undefined,
        tipo_evento: url.searchParams.get("tipo_evento") || undefined,
        status: url.searchParams.get("status") || undefined,
        limite: url.searchParams.get("limite") || undefined,
      };
      try {
        const logs = listarLogsOperacionais(filtros);
        enviarJson(res, 200, { success: true, total: logs.length, logs });
      } catch (erro) {
        enviarJson(res, 400, { success: false, message: erro?.message || "Falha ao listar logs." });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/sistema/logs-operacionais/export") {
      const url = new URL(req.url, "http://localhost");
      const formato = String(url.searchParams.get("formato") || "json").toLowerCase();
      const filtros = {
        modulo: url.searchParams.get("modulo") || undefined,
        tipo_evento: url.searchParams.get("tipo_evento") || undefined,
        status: url.searchParams.get("status") || undefined,
        limite: url.searchParams.get("limite") || undefined,
      };

      if (formato === "csv") {
        const csv = exportarLogsOperacionaisCsv(filtros);
        const buffer = Buffer.from(csv, "utf8");
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"logs-operacionais.csv\"",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Length": buffer.length,
        });
        res.end(buffer);
        return;
      }

      if (formato !== "json") {
        enviarJson(res, 400, { success: false, message: "Formato suportado: json ou csv." });
        return;
      }

      const exportado = exportarLogsOperacionaisJson(filtros);
      const body = Buffer.from(JSON.stringify(exportado, null, 2), "utf8");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"logs-operacionais.json\"",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Length": body.length,
      });
      res.end(body);
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/sistema/logs-operacionais/")) {
      const idSegmento = pathname.slice("/api/sistema/logs-operacionais/".length);
      const id = Number(idSegmento);
      if (!Number.isInteger(id) || id <= 0) {
        enviarJson(res, 400, { success: false, message: "ID de log inválido." });
        return;
      }
      const log = obterLogOperacionalPorId(id);
      if (!log) {
        enviarJson(res, 404, { success: false, message: "Log operacional não encontrado." });
        return;
      }
      enviarJson(res, 200, { success: true, log });
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/revisao/divergencias") {
      const sp = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams;
      const lerBooleanQuery = (nome) => {
        const valor = sp.get(nome);
        if (valor !== "true" && valor !== "false") {
          const erro = new Error(`Filtro booleano inválido: ${nome}. Use true ou false.`);
          erro.statusCode = 400;
          throw erro;
        }
        return valor === "true";
      };
      const filtros = {
        status: sp.get("status") || undefined,
        nivel: sp.get("nivel") || undefined,
        tipo: sp.get("tipo") || undefined,
        convenio: sp.get("convenio") || undefined,
        uf: sp.get("uf") || undefined,
        categoriaOperacional: sp.get("categoriaOperacional") || undefined,
        limite: sp.get("limite") || undefined,
        offset: sp.get("offset") || undefined,
      };
      if (sp.has("bloqueiaPublicacao")) {
        filtros.bloqueiaPublicacao = lerBooleanQuery("bloqueiaPublicacao");
      }
      if (sp.has("semDecisaoResolutiva")) {
        filtros.semDecisaoResolutiva = lerBooleanQuery("semDecisaoResolutiva");
      }
      if (sp.has("comDecisaoResolutiva")) {
        filtros.comDecisaoResolutiva = lerBooleanQuery("comDecisaoResolutiva");
      }
      if (sp.has("operacionalEfetiva")) {
        filtros.operacionalEfetiva = lerBooleanQuery("operacionalEfetiva");
      }
      if (sp.has("saldoResidual")) {
        filtros.saldoResidual = lerBooleanQuery("saldoResidual");
      }
      if (
        filtros.semDecisaoResolutiva !== undefined
        && filtros.comDecisaoResolutiva !== undefined
        && filtros.semDecisaoResolutiva === filtros.comDecisaoResolutiva
      ) {
        enviarJson(res, 400, {
          success: false,
          message: "Filtros contraditórios: use apenas um entre semDecisaoResolutiva e comDecisaoResolutiva.",
        });
        return;
      }
      enviarJson(res, 200, { success: true, ...revisaoDecisaoService.listarDivergencias(filtros) });
      return;
    }

    if (req.method === "GET" && pathname === "/api/profor-2022/revisao/auditoria") {
      enviarJson(res, 200, { success: true, auditoria: revisaoDecisaoService.auditarPendencias() });
      return;
    }

    if (pathname.startsWith("/api/profor-2022/revisao/divergencias/")) {
      const resto = pathname.slice("/api/profor-2022/revisao/divergencias/".length);

      if (req.method === "GET" && /^\d+\/logs$/.test(resto)) {
        const id = Number(resto.split("/")[0]);
        enviarJson(res, 200, {
          success: true,
          logs: revisaoDecisaoService.listarLogsDaDivergencia(id),
        });
        return;
      }

      if (req.method === "POST" && /^\d+\/decisoes$/.test(resto)) {
        const id = Number(resto.split("/")[0]);
        const payload = await lerJsonBody(req);
        const resultado = revisaoDecisaoService.registrarDecisao(id, payload);
        enviarJson(res, 201, { success: true, decisao: resultado });
        return;
      }

      if (req.method === "GET" && /^\d+$/.test(resto)) {
        enviarJson(res, 200, {
          success: true,
          divergencia: revisaoDecisaoService.obterDivergencia(Number(resto)),
        });
        return;
      }
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

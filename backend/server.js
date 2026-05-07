const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const url = require("url");
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
  salvarOrcamento2026,
  listarHistoricoOrcamento2026,
  inicializarOrcamento2026
} = require("./services/orcamento-2026-service");
const {
  exportarParametrosMinimosExcel,
  exportarFormalizacaoProforExcel,
  exportarOrcamento2026Excel
} = require("./services/excel-export-service");
const { publicarDadosEstaticos } = require("./services/static-publication-service");

const rootDir = path.join(__dirname, "..");
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
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".sqlite": "application/octet-stream"
};

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

function lerJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Corpo da requisição excedeu o limite."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
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

function enviarArquivoEstatico(req, res, pathname) {
  const caminhoRelativo = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const caminhoArquivo = path.resolve(rootDir, caminhoRelativo);

  if (!caminhoArquivo.startsWith(rootDir)) {
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

    enviarJson(res, 404, { success: false, message: "Endpoint não encontrado." });
  } catch (error) {
    enviarJson(res, 500, {
      success: false,
      message: error.message || "Erro interno no servidor."
    });
  }
}

prepararBanco();

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
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

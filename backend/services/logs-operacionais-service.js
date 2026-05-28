// Serviço de logs operacionais.
// Registra eventos executivos (atualização DETRU, rendimentos Transferegov, consolidado PROFOR 2022,
// publicação estática etc.) em SQLite e expõe consulta e exportação JSON/CSV.
// O payload é sempre sanitizado para nunca registrar/exportar dados sensíveis (cookies, SAML,
// tokens, caminhos locais, HTML bruto, segredos de ambiente).

const { query } = require("../db/postgres-client");

const MODULOS_PERMITIDOS = new Set([
  "profor-2022",
  "sistema",
]);

const TIPOS_EVENTO_PERMITIDOS = new Set([
  "profor_atualizacao_consolidada",
  "profor_publicacao_estatica",
  "profor_detru",
  "profor_rendimentos_transferegov",
]);

const STATUS_PERMITIDOS = new Set([
  "sucesso",
  "falha",
  "bloqueado",
  "parcial",
]);

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO_CONSULTA = 200;
const LIMITE_EXPORTACAO_PADRAO = 500;
const LIMITE_EXPORTACAO_MAXIMO = 2000;
const TAMANHO_MAX_RESUMO = 600;
const TAMANHO_MAX_STRING_PAYLOAD = 600;
const TAMANHO_MAX_PAYLOAD_JSON = 32_000;

const REGEX_CAMPOS_PROIBIDOS = /(jsessionid|samlrequest|samlresponse|cookie|set-cookie|authorization|bearer|onasp_edit_password|detru_siconv_convenio_url|password|senha|token|secret)/i;
const PADROES_TEXTO_PROIBIDO = [
  /JSESSIONID/i,
  /SAMLRequest/i,
  /SAMLResponse/i,
  /Cookie:/i,
  /Set-Cookie/i,
  /Authorization:/i,
  /Bearer\s+/i,
  /ONASP_EDIT_PASSWORD/i,
  /DETRU_SICONV_CONVENIO_URL/i,
  /C:\\Users\\/i,
  /\.sqlite/i,
  /\.har\b/i,
  /<html/i,
  /<!DOCTYPE\s+html/i,
];

function agoraIso() {
  return new Date().toISOString();
}

function normalizarTexto(valor, tamanhoMax = TAMANHO_MAX_STRING_PAYLOAD) {
  if (valor === null || valor === undefined) return null;
  let texto = typeof valor === "string" ? valor : String(valor);

  for (const padrao of PADROES_TEXTO_PROIBIDO) {
    if (padrao.test(texto)) {
      return "[REMOVIDO_POR_SANITIZACAO]";
    }
  }

  if (texto.length > tamanhoMax) {
    texto = `${texto.slice(0, tamanhoMax)}…[truncado]`;
  }
  return texto;
}

function sanitizarPayloadLog(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return null;
  if (profundidade > 6) return "[profundidade-maxima]";

  if (typeof valor === "string") {
    return normalizarTexto(valor);
  }

  if (typeof valor === "number" || typeof valor === "boolean") {
    return valor;
  }

  if (Array.isArray(valor)) {
    const limite = 200;
    const fatiado = valor.slice(0, limite).map((item) => sanitizarPayloadLog(item, profundidade + 1));
    if (valor.length > limite) {
      fatiado.push(`[+${valor.length - limite} itens omitidos]`);
    }
    return fatiado;
  }

  if (typeof valor === "object") {
    const saida = {};
    for (const [chave, conteudo] of Object.entries(valor)) {
      if (typeof chave === "string" && REGEX_CAMPOS_PROIBIDOS.test(chave)) {
        saida[chave] = "[REMOVIDO_POR_SANITIZACAO]";
        continue;
      }
      saida[chave] = sanitizarPayloadLog(conteudo, profundidade + 1);
    }
    return saida;
  }

  return null;
}

function serializarPayloadSanitizado(payload) {
  if (payload === null || payload === undefined) return null;
  const sanitizado = sanitizarPayloadLog(payload);
  let texto;
  try {
    texto = JSON.stringify(sanitizado);
  } catch {
    return null;
  }
  if (!texto) return null;
  if (texto.length > TAMANHO_MAX_PAYLOAD_JSON) {
    texto = `${texto.slice(0, TAMANHO_MAX_PAYLOAD_JSON)}"[truncado]"`;
  }
  return texto;
}

function validarString(valor, nome, permitidos) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) {
    throw new Error(`Campo obrigatório ausente em log operacional: ${nome}.`);
  }
  if (permitidos && !permitidos.has(texto)) {
    throw new Error(`Valor inválido para ${nome}: ${texto}.`);
  }
  return texto;
}

function normalizarLimite(valor, padrao, maximo) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return padrao;
  return Math.min(Math.floor(numero), maximo);
}

function montarFiltrosSql(filtros = {}, indiceInicial = 1) {
  const clausulas = [];
  const parametros = [];
  let idx = indiceInicial;

  if (filtros.modulo) {
    clausulas.push(`modulo = $${idx++}`);
    parametros.push(String(filtros.modulo).trim());
  }
  if (filtros.tipo_evento) {
    clausulas.push(`tipo_evento = $${idx++}`);
    parametros.push(String(filtros.tipo_evento).trim());
  }
  if (filtros.status) {
    clausulas.push(`status = $${idx++}`);
    parametros.push(String(filtros.status).trim());
  }

  return {
    where: clausulas.length ? `WHERE ${clausulas.join(" AND ")}` : "",
    parametros,
    proximoIndice: idx,
  };
}

function mapearLinha(row, { incluirPayload = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    modulo: row.modulo,
    tipoEvento: row.tipo_evento,
    status: row.status,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    duracaoMs: row.duracao_ms !== null && row.duracao_ms !== undefined ? Number(row.duracao_ms) : null,
    resumo: row.resumo,
    criadoEm: row.criado_em,
  };
  if (incluirPayload) {
    let payload = null;
    if (row.payload_json !== null && row.payload_json !== undefined) {
      if (typeof row.payload_json === "string") {
        try {
          payload = JSON.parse(row.payload_json);
        } catch {
          payload = null;
        }
      } else {
        payload = row.payload_json;
      }
    }
    base.payload = payload;
  }
  return base;
}

async function registrarLogOperacional(log = {}) {
  const modulo = validarString(log.modulo, "modulo", MODULOS_PERMITIDOS);
  const tipoEvento = validarString(log.tipoEvento ?? log.tipo_evento, "tipoEvento", TIPOS_EVENTO_PERMITIDOS);
  const status = validarString(log.status, "status", STATUS_PERMITIDOS);

  const iniciadoEm = log.iniciadoEm || null;
  const concluidoEm = log.concluidoEm || agoraIso();
  const duracaoMs = Number.isFinite(Number(log.duracaoMs)) ? Math.max(0, Math.round(Number(log.duracaoMs))) : null;
  const resumo = log.resumo !== undefined && log.resumo !== null
    ? normalizarTexto(log.resumo, TAMANHO_MAX_RESUMO)
    : null;
  const payloadJson = serializarPayloadSanitizado(log.payload);

  const result = await query(`
    INSERT INTO logs_operacionais
      (modulo, tipo_evento, status, iniciado_em, concluido_em, duracao_ms, resumo, payload_json, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    modulo,
    tipoEvento,
    status,
    iniciadoEm,
    concluidoEm,
    duracaoMs,
    resumo,
    payloadJson,
    agoraIso()
  ]);

  return { id: result.rows[0].id };
}

async function listarLogsOperacionais(filtros = {}) {
  const { where, parametros, proximoIndice } = montarFiltrosSql(filtros);
  const limite = normalizarLimite(filtros.limite, LIMITE_PADRAO, LIMITE_MAXIMO_CONSULTA);

  const sql = `
    SELECT id, modulo, tipo_evento, status, iniciado_em, concluido_em, duracao_ms, resumo, criado_em
    FROM logs_operacionais
    ${where}
    ORDER BY id DESC
    LIMIT $${proximoIndice}
  `;

  const result = await query(sql, [...parametros, limite]);
  return result.rows.map((row) => mapearLinha(row));
}

async function obterLogOperacionalPorId(id) {
  const idNumero = Number(id);
  if (!Number.isInteger(idNumero) || idNumero <= 0) {
    return null;
  }
  const result = await query(`
    SELECT id, modulo, tipo_evento, status, iniciado_em, concluido_em, duracao_ms, resumo, payload_json, criado_em
    FROM logs_operacionais
    WHERE id = $1
  `, [idNumero]);
  return mapearLinha(result.rows[0], { incluirPayload: true });
}

async function listarParaExportacao(filtros = {}) {
  const { where, parametros, proximoIndice } = montarFiltrosSql(filtros);
  const limite = normalizarLimite(filtros.limite, LIMITE_EXPORTACAO_PADRAO, LIMITE_EXPORTACAO_MAXIMO);

  const sql = `
    SELECT id, modulo, tipo_evento, status, iniciado_em, concluido_em, duracao_ms, resumo, payload_json, criado_em
    FROM logs_operacionais
    ${where}
    ORDER BY id DESC
    LIMIT $${proximoIndice}
  `;

  const result = await query(sql, [...parametros, limite]);
  return result.rows.map((row) => mapearLinha(row, { incluirPayload: true }));
}

async function exportarLogsOperacionaisJson(filtros = {}) {
  const registros = await listarParaExportacao(filtros);
  return {
    geradoEm: agoraIso(),
    filtros: {
      modulo: filtros.modulo || null,
      tipoEvento: filtros.tipo_evento || null,
      status: filtros.status || null,
      limite: filtros.limite ? Number(filtros.limite) : null,
    },
    total: registros.length,
    registros,
  };
}

function escaparCsv(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = typeof valor === "string" ? valor : String(valor);
  if (/[",;\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

async function exportarLogsOperacionaisCsv(filtros = {}) {
  const registros = await listarParaExportacao(filtros);
  const colunas = [
    "id",
    "modulo",
    "tipoEvento",
    "status",
    "iniciadoEm",
    "concluidoEm",
    "duracaoMs",
    "resumo",
    "criadoEm",
    "payloadJson",
  ];
  const linhas = [colunas.join(";")];
  for (const registro of registros) {
    const payloadJson = registro.payload !== undefined && registro.payload !== null
      ? JSON.stringify(registro.payload)
      : "";
    linhas.push([
      registro.id,
      registro.modulo,
      registro.tipoEvento,
      registro.status,
      registro.iniciadoEm,
      registro.concluidoEm,
      registro.duracaoMs,
      registro.resumo,
      registro.criadoEm,
      payloadJson,
    ].map(escaparCsv).join(";"));
  }
  return linhas.join("\r\n");
}

module.exports = {
  registrarLogOperacional,
  listarLogsOperacionais,
  obterLogOperacionalPorId,
  exportarLogsOperacionaisJson,
  exportarLogsOperacionaisCsv,
  sanitizarPayloadLog,
  MODULOS_PERMITIDOS,
  TIPOS_EVENTO_PERMITIDOS,
  STATUS_PERMITIDOS,
};

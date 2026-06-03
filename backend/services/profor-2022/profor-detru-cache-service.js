// Serviço de cache DETRU para PROFOR 2022.
// Armazena apenas o snapshot filtrado dos convênios monitorados — não o CSV completo.
// A tabela profor_detru_cache é consumida por etapas futuras que compõem dados da página.
// O cache anterior não é apagado em caso de falha — apenas upsert dos encontrados.

const crypto = require("crypto");
const fs = require("fs");
const { query, withTransaction } = require("../../db/postgres-client");
const { registrarLogOperacional } = require("../logs-operacionais-service");

async function registrarLogDetruSeguro(log) {
  try {
    await registrarLogOperacional(log);
  } catch {
    // Falha de auditoria nao pode bloquear a rotina DETRU.
  }
}

function calcularHashArquivo(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo);
  return crypto.createHash("sha256").update(conteudo).digest("hex");
}

function parsePayload(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

async function salvarSnapshotDetru(resultadoCruzamento, metadados = {}) {
  const { conveniosEncontrados, consultadoEm } = resultadoCruzamento;
  const { arquivoOrigem = null, arquivoHash = null } = metadados;
  const agora = consultadoEm || new Date().toISOString();

  const sql = `
    INSERT INTO profor_detru_cache
      (numero_convenio, ano, payload_json, fonte, arquivo_origem, arquivo_hash, consultado_em, atualizado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (numero_convenio, ano) DO UPDATE SET
      payload_json    = excluded.payload_json,
      fonte           = excluded.fonte,
      arquivo_origem  = excluded.arquivo_origem,
      arquivo_hash    = excluded.arquivo_hash,
      consultado_em   = excluded.consultado_em,
      atualizado_em   = excluded.atualizado_em
  `;

  await withTransaction(async (client) => {
    for (const c of conveniosEncontrados) {
      await client.query(sql, [
        c.numeroConvenio,
        c.ano ?? null,
        JSON.stringify(c),
        c.fonte || "DETRU/siconv_convenio.csv.zip",
        arquivoOrigem,
        arquivoHash,
        agora,
        agora
      ]);
    }
  });

  return conveniosEncontrados.length;
}

async function listarCacheDetruProfor2022() {
  const result = await query(
    "SELECT * FROM profor_detru_cache ORDER BY numero_convenio, ano"
  );
  return result.rows.map((row) => ({
    id: row.id,
    numeroConvenio: row.numero_convenio,
    ano: row.ano,
    dados: parsePayload(row.payload_json),
    fonte: row.fonte,
    arquivoOrigem: row.arquivo_origem,
    arquivoHash: row.arquivo_hash,
    consultadoEm: row.consultado_em,
    atualizadoEm: row.atualizado_em,
  }));
}

async function obterCacheDetruPorConvenio(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
  let result;
  if (anoVal !== null) {
    result = await query(
      "SELECT * FROM profor_detru_cache WHERE numero_convenio = $1 AND ano = $2",
      [numero, anoVal]
    );
  } else {
    result = await query(
      "SELECT * FROM profor_detru_cache WHERE numero_convenio = $1 AND ano IS NULL",
      [numero]
    );
  }
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    numeroConvenio: row.numero_convenio,
    ano: row.ano,
    dados: parsePayload(row.payload_json),
    fonte: row.fonte,
    arquivoOrigem: row.arquivo_origem,
    arquivoHash: row.arquivo_hash,
    consultadoEm: row.consultado_em,
    atualizadoEm: row.atualizado_em,
  };
}

async function registrarAtualizacaoDetruInicio(metadados = {}) {
  const { caminhoArquivo = null, arquivoHash = null } = metadados;
  const result = await query(
    "INSERT INTO profor_detru_atualizacoes (iniciado_em, caminho_arquivo, arquivo_hash) VALUES ($1, $2, $3) RETURNING id",
    [new Date().toISOString(), caminhoArquivo, arquivoHash]
  );
  const idAtualizacao = result.rows[0].id;
  await registrarLogDetruSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_detru_atualizacao_inicio",
    status: "sucesso",
    resumo: "Atualização DETRU iniciada.",
    payload: {
      idAtualizacao,
      caminhoArquivo,
      arquivoHash,
    },
  });
  return idAtualizacao;
}

async function registrarAtualizacaoDetruFim(idAtualizacao, resultado) {
  await query(`
    UPDATE profor_detru_atualizacoes SET
      concluido_em             = $1,
      sucesso                  = true,
      total_carteira_ativa     = $2,
      total_linhas_detru_lidas = $3,
      total_encontrados        = $4,
      total_nao_encontrados    = $5,
      resumo_json              = $6
    WHERE id = $7
  `, [
    new Date().toISOString(),
    resultado.totalCarteiraAtiva ?? 0,
    resultado.totalLinhasDetruLidas ?? 0,
    resultado.totalEncontrados ?? 0,
    resultado.totalNaoEncontrados ?? 0,
    JSON.stringify(resultado),
    idAtualizacao
  ]);
  await registrarLogDetruSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_detru_atualizacao_sucesso",
    status: "sucesso",
    resumo: `Atualização DETRU concluída: ${Number(resultado.totalEncontrados || 0)} encontrado(s), ${Number(resultado.totalNaoEncontrados || 0)} não encontrado(s).`,
    payload: {
      idAtualizacao,
      arquivoHash: resultado.arquivoHash || null,
      totalCarteiraAtiva: Number(resultado.totalCarteiraAtiva || 0),
      totalLinhasDetruLidas: Number(resultado.totalLinhasDetruLidas || 0),
      totalEncontrados: Number(resultado.totalEncontrados || 0),
      totalNaoEncontrados: Number(resultado.totalNaoEncontrados || 0),
    },
  });
}

async function registrarAtualizacaoDetruErro(idAtualizacao, erro) {
  const mensagem = typeof erro === "string" ? erro : (erro?.message || String(erro));
  await query(`
    UPDATE profor_detru_atualizacoes SET
      concluido_em = $1,
      sucesso      = false,
      erro         = $2
    WHERE id = $3
  `, [new Date().toISOString(), mensagem, idAtualizacao]);
  await registrarLogDetruSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_detru_atualizacao_erro",
    status: "falha",
    resumo: `Erro na atualização DETRU: ${mensagem}`,
    payload: {
      idAtualizacao,
      erro: mensagem,
    },
  });
}

async function obterUltimaAtualizacaoDetru() {
  const result = await query(
    "SELECT * FROM profor_detru_atualizacoes ORDER BY id DESC LIMIT 1"
  );
  return result.rows[0] ?? null;
}

module.exports = {
  calcularHashArquivo,
  salvarSnapshotDetru,
  listarCacheDetruProfor2022,
  obterCacheDetruPorConvenio,
  registrarAtualizacaoDetruInicio,
  registrarAtualizacaoDetruFim,
  registrarAtualizacaoDetruErro,
  obterUltimaAtualizacaoDetru,
};

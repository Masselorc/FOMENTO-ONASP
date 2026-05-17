// Serviço de cache DETRU para PROFOR 2022.
// Armazena apenas o snapshot filtrado dos convênios monitorados — não o CSV completo.
// A tabela profor_detru_cache é consumida por etapas futuras que compõem dados da página.
// O cache anterior não é apagado em caso de falha — apenas upsert dos encontrados.

const crypto = require("crypto");
const fs = require("fs");
const db = require("../../db/database");

function calcularHashArquivo(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo);
  return crypto.createHash("sha256").update(conteudo).digest("hex");
}

function salvarSnapshotDetru(resultadoCruzamento, metadados = {}) {
  const { conveniosEncontrados, consultadoEm } = resultadoCruzamento;
  const { arquivoOrigem = null, arquivoHash = null } = metadados;
  const agora = consultadoEm || new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO profor_detru_cache
      (numero_convenio, ano, payload_json, fonte, arquivo_origem, arquivo_hash, consultado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(numero_convenio, ano) DO UPDATE SET
      payload_json    = excluded.payload_json,
      fonte           = excluded.fonte,
      arquivo_origem  = excluded.arquivo_origem,
      arquivo_hash    = excluded.arquivo_hash,
      consultado_em   = excluded.consultado_em,
      atualizado_em   = excluded.atualizado_em
  `);

  const inserirTodos = db.transaction((convenios) => {
    for (const c of convenios) {
      stmt.run(
        c.numeroConvenio,
        c.ano ?? null,
        JSON.stringify(c),
        c.fonte || "DETRU/siconv_convenio.csv.zip",
        arquivoOrigem,
        arquivoHash,
        agora,
        agora
      );
    }
  });

  inserirTodos(conveniosEncontrados);
  return conveniosEncontrados.length;
}

function listarCacheDetruProfor2022() {
  return db
    .prepare("SELECT * FROM profor_detru_cache ORDER BY numero_convenio, ano")
    .all()
    .map((row) => ({
      id: row.id,
      numeroConvenio: row.numero_convenio,
      ano: row.ano,
      dados: JSON.parse(row.payload_json),
      fonte: row.fonte,
      arquivoOrigem: row.arquivo_origem,
      arquivoHash: row.arquivo_hash,
      consultadoEm: row.consultado_em,
      atualizadoEm: row.atualizado_em,
    }));
}

function obterCacheDetruPorConvenio(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
  const sql =
    anoVal !== null
      ? "SELECT * FROM profor_detru_cache WHERE numero_convenio = ? AND ano = ?"
      : "SELECT * FROM profor_detru_cache WHERE numero_convenio = ? AND ano IS NULL";
  const row = anoVal !== null ? db.prepare(sql).get(numero, anoVal) : db.prepare(sql).get(numero);
  if (!row) return null;
  return {
    id: row.id,
    numeroConvenio: row.numero_convenio,
    ano: row.ano,
    dados: JSON.parse(row.payload_json),
    fonte: row.fonte,
    arquivoOrigem: row.arquivo_origem,
    arquivoHash: row.arquivo_hash,
    consultadoEm: row.consultado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function registrarAtualizacaoDetruInicio(metadados = {}) {
  const { caminhoArquivo = null, arquivoHash = null } = metadados;
  const result = db
    .prepare(
      "INSERT INTO profor_detru_atualizacoes (iniciado_em, caminho_arquivo, arquivo_hash) VALUES (?, ?, ?)"
    )
    .run(new Date().toISOString(), caminhoArquivo, arquivoHash);
  return result.lastInsertRowid;
}

function registrarAtualizacaoDetruFim(idAtualizacao, resultado) {
  db.prepare(`
    UPDATE profor_detru_atualizacoes SET
      concluido_em             = ?,
      sucesso                  = 1,
      total_carteira_ativa     = ?,
      total_linhas_detru_lidas = ?,
      total_encontrados        = ?,
      total_nao_encontrados    = ?,
      resumo_json              = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    resultado.totalCarteiraAtiva ?? 0,
    resultado.totalLinhasDetruLidas ?? 0,
    resultado.totalEncontrados ?? 0,
    resultado.totalNaoEncontrados ?? 0,
    JSON.stringify(resultado),
    idAtualizacao
  );
}

function registrarAtualizacaoDetruErro(idAtualizacao, erro) {
  const mensagem = typeof erro === "string" ? erro : (erro?.message || String(erro));
  db.prepare(`
    UPDATE profor_detru_atualizacoes SET
      concluido_em = ?,
      sucesso      = 0,
      erro         = ?
    WHERE id = ?
  `).run(new Date().toISOString(), mensagem, idAtualizacao);
}

function obterUltimaAtualizacaoDetru() {
  return db
    .prepare("SELECT * FROM profor_detru_atualizacoes ORDER BY id DESC LIMIT 1")
    .get() ?? null;
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

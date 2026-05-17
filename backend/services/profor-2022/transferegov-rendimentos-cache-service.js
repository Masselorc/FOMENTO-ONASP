const db = require("../../db/database");

function normalizarAno(ano) {
  return ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
}

function linhaCacheParaCamelCase(row) {
  if (!row) return null;

  return {
    id: row.id,
    numeroConvenio: row.numero_convenio,
    ano: row.ano,
    saldoRendimentosAtual: row.saldo_rendimentos_atual,
    valorOriginal: row.valor_original,
    subtitulo: row.subtitulo,
    aviso: row.aviso,
    convenioTexto: row.convenio_texto,
    urlFinal: row.url_final,
    consultadoEm: row.consultado_em,
    atualizadoEm: row.atualizado_em,
    sucesso: row.sucesso === 1,
    erro: row.erro,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
  };
}

function linhaConsultaParaCamelCase(row) {
  if (!row) return null;

  return {
    id: row.id,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    sucesso: row.sucesso === 1,
    totalCarteiraAtiva: row.total_carteira_ativa,
    totalConsultados: row.total_consultados,
    totalSucesso: row.total_sucesso,
    totalFalha: row.total_falha,
    erro: row.erro,
    resumo: row.resumo_json ? JSON.parse(row.resumo_json) : null,
  };
}

function salvarSaldoRendimentoTransferegov(resultado, metadados = {}) {
  if (!resultado?.sucesso) {
    throw new Error(resultado?.erro || "Consulta Transferegov sem sucesso não deve sobrescrever o cache.");
  }

  const numeroConvenio = String(resultado.numeroConvenio ?? metadados.numeroConvenio ?? "").trim();
  if (!/^\d+$/.test(numeroConvenio)) {
    throw new Error("numeroConvenio é obrigatório para salvar saldo de rendimento.");
  }

  const ano = normalizarAno(resultado.ano ?? metadados.ano);
  const consultadoEm = resultado.consultadoEm || new Date().toISOString();
  const atualizadoEm = new Date().toISOString();
  const payloadJson = JSON.stringify({
    numeroConvenio,
    ano,
    convenioTexto: resultado.convenioTexto ?? null,
    subtitulo: resultado.subtitulo ?? null,
    valorOriginal: resultado.valorOriginal ?? null,
    saldoRendimentosAtual: resultado.saldoRendimentosAtual ?? null,
    aviso: resultado.aviso ?? null,
    urlFinal: resultado.urlFinal ?? null,
    consultadoEm,
    payload: resultado.payload ?? null,
  });

  db.prepare(`
    INSERT INTO profor_transferegov_rendimentos_cache
      (numero_convenio, ano, saldo_rendimentos_atual, valor_original, subtitulo, aviso,
       convenio_texto, url_final, consultado_em, atualizado_em, sucesso, erro, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
    ON CONFLICT(numero_convenio, ano) DO UPDATE SET
      saldo_rendimentos_atual = excluded.saldo_rendimentos_atual,
      valor_original          = excluded.valor_original,
      subtitulo               = excluded.subtitulo,
      aviso                   = excluded.aviso,
      convenio_texto          = excluded.convenio_texto,
      url_final               = excluded.url_final,
      consultado_em           = excluded.consultado_em,
      atualizado_em           = excluded.atualizado_em,
      sucesso                 = 1,
      erro                    = NULL,
      payload_json            = excluded.payload_json
  `).run(
    numeroConvenio,
    ano,
    resultado.saldoRendimentosAtual ?? null,
    resultado.valorOriginal ?? null,
    resultado.subtitulo ?? null,
    resultado.aviso ?? null,
    resultado.convenioTexto ?? null,
    resultado.urlFinal ?? null,
    consultadoEm,
    atualizadoEm,
    payloadJson
  );

  return obterSaldoRendimentoPorConvenio(numeroConvenio, ano);
}

function obterSaldoRendimentoPorConvenio(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = normalizarAno(ano);
  const sql = anoVal !== null
    ? "SELECT * FROM profor_transferegov_rendimentos_cache WHERE numero_convenio = ? AND ano = ?"
    : "SELECT * FROM profor_transferegov_rendimentos_cache WHERE numero_convenio = ? AND ano IS NULL ORDER BY id DESC LIMIT 1";
  const row = anoVal !== null
    ? db.prepare(sql).get(numero, anoVal)
    : db.prepare(sql).get(numero);
  return linhaCacheParaCamelCase(row);
}

function listarSaldosRendimentosCache() {
  return db
    .prepare("SELECT * FROM profor_transferegov_rendimentos_cache ORDER BY numero_convenio, ano")
    .all()
    .map(linhaCacheParaCamelCase);
}

function registrarConsultaRendimentosInicio(metadados = {}) {
  const iniciadoEm = metadados.iniciadoEm || new Date().toISOString();
  const result = db
    .prepare(`
      INSERT INTO profor_transferegov_rendimentos_consultas
        (iniciado_em, total_carteira_ativa)
      VALUES (?, ?)
    `)
    .run(iniciadoEm, metadados.totalCarteiraAtiva ?? 0);

  return result.lastInsertRowid;
}

function registrarConsultaRendimentosFim(idConsulta, resumo) {
  db.prepare(`
    UPDATE profor_transferegov_rendimentos_consultas SET
      concluido_em          = ?,
      sucesso               = 1,
      total_carteira_ativa  = ?,
      total_consultados     = ?,
      total_sucesso         = ?,
      total_falha           = ?,
      erro                  = NULL,
      resumo_json           = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    resumo.totalCarteiraAtiva ?? 0,
    resumo.totalConsultados ?? 0,
    resumo.totalSucesso ?? 0,
    resumo.totalFalha ?? 0,
    JSON.stringify(resumo),
    idConsulta
  );
}

function registrarConsultaRendimentosErro(idConsulta, erro) {
  const mensagem = typeof erro === "string" ? erro : (erro?.message || String(erro));
  db.prepare(`
    UPDATE profor_transferegov_rendimentos_consultas SET
      concluido_em = ?,
      sucesso      = 0,
      erro         = ?
    WHERE id = ?
  `).run(new Date().toISOString(), mensagem, idConsulta);
}

function obterUltimaConsultaRendimentos() {
  const row = db
    .prepare("SELECT * FROM profor_transferegov_rendimentos_consultas ORDER BY id DESC LIMIT 1")
    .get();
  return linhaConsultaParaCamelCase(row);
}

module.exports = {
  salvarSaldoRendimentoTransferegov,
  obterSaldoRendimentoPorConvenio,
  listarSaldosRendimentosCache,
  registrarConsultaRendimentosInicio,
  registrarConsultaRendimentosFim,
  registrarConsultaRendimentosErro,
  obterUltimaConsultaRendimentos,
};

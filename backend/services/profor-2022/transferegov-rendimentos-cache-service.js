const { query } = require("../../db/postgres-client");
const { registrarLogOperacional } = require("../logs-operacionais-service");

async function registrarLogRendimentosSeguro(log) {
  try {
    await registrarLogOperacional(log);
  } catch {
    // Falha de auditoria nao pode bloquear a rotina de rendimentos.
  }
}

function normalizarAno(ano) {
  return ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
}

function parsePayload(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function linhaCacheParaCamelCase(row) {
  if (!row) return null;

  return {
    id: row.id,
    numeroConvenio: row.numero_convenio,
    ano: row.ano,
    // Defensivo: garante numero mesmo que o driver devolva NUMERIC como string,
    // evitando que o parser de moeda BR interprete o ponto decimal como milhar.
    saldoRendimentosAtual:
      row.saldo_rendimentos_atual === null || row.saldo_rendimentos_atual === undefined
        ? null
        : Number(row.saldo_rendimentos_atual),
    valorOriginal: row.valor_original,
    subtitulo: row.subtitulo,
    aviso: row.aviso,
    convenioTexto: row.convenio_texto,
    urlFinal: row.url_final,
    consultadoEm: row.consultado_em,
    atualizadoEm: row.atualizado_em,
    sucesso: row.sucesso === true || row.sucesso === 1,
    erro: row.erro,
    payload: parsePayload(row.payload_json),
  };
}

function linhaConsultaParaCamelCase(row) {
  if (!row) return null;

  return {
    id: row.id,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    sucesso: row.sucesso === true || row.sucesso === 1,
    totalCarteiraAtiva: row.total_carteira_ativa,
    totalConsultados: row.total_consultados,
    totalSucesso: row.total_sucesso,
    totalFalha: row.total_falha,
    erro: row.erro,
    resumo: parsePayload(row.resumo_json),
  };
}

async function salvarSaldoRendimentoTransferegov(resultado, metadados = {}) {
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

  await query(`
    INSERT INTO profor_transferegov_rendimentos_cache
      (numero_convenio, ano, saldo_rendimentos_atual, valor_original, subtitulo, aviso,
       convenio_texto, url_final, consultado_em, atualizado_em, sucesso, erro, payload_json)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NULL, $11)
    ON CONFLICT (numero_convenio, ano) DO UPDATE SET
      saldo_rendimentos_atual = excluded.saldo_rendimentos_atual,
      valor_original          = excluded.valor_original,
      subtitulo               = excluded.subtitulo,
      aviso                   = excluded.aviso,
      convenio_texto          = excluded.convenio_texto,
      url_final               = excluded.url_final,
      consultado_em           = excluded.consultado_em,
      atualizado_em           = excluded.atualizado_em,
      sucesso                 = true,
      erro                    = NULL,
      payload_json            = excluded.payload_json
  `, [
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
  ]);

  return obterSaldoRendimentoPorConvenio(numeroConvenio, ano);
}

async function obterSaldoRendimentoPorConvenio(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = normalizarAno(ano);
  let result;
  if (anoVal !== null) {
    result = await query(
      "SELECT * FROM profor_transferegov_rendimentos_cache WHERE numero_convenio = $1 AND ano = $2",
      [numero, anoVal]
    );
  } else {
    result = await query(
      "SELECT * FROM profor_transferegov_rendimentos_cache WHERE numero_convenio = $1 AND ano IS NULL ORDER BY id DESC LIMIT 1",
      [numero]
    );
  }
  return linhaCacheParaCamelCase(result.rows[0]);
}

async function listarSaldosRendimentosCache() {
  const result = await query(
    "SELECT * FROM profor_transferegov_rendimentos_cache ORDER BY numero_convenio, ano"
  );
  return result.rows.map(linhaCacheParaCamelCase);
}

async function registrarConsultaRendimentosInicio(metadados = {}) {
  const iniciadoEm = metadados.iniciadoEm || new Date().toISOString();
  const result = await query(
    `INSERT INTO profor_transferegov_rendimentos_consultas
       (iniciado_em, total_carteira_ativa)
     VALUES ($1, $2)
     RETURNING id`,
    [iniciadoEm, metadados.totalCarteiraAtiva ?? 0]
  );

  const idConsulta = result.rows[0].id;
  await registrarLogRendimentosSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_rendimentos_atualizacao_inicio",
    status: "sucesso",
    iniciadoEm,
    concluidoEm: iniciadoEm,
    resumo: "Atualização de rendimentos Transferegov iniciada.",
    payload: {
      idConsulta,
      totalCarteiraAtiva: Number(metadados.totalCarteiraAtiva || 0),
    },
  });

  return idConsulta;
}

async function registrarConsultaRendimentosFim(idConsulta, resumo) {
  await query(`
    UPDATE profor_transferegov_rendimentos_consultas SET
      concluido_em          = $1,
      sucesso               = true,
      total_carteira_ativa  = $2,
      total_consultados     = $3,
      total_sucesso         = $4,
      total_falha           = $5,
      erro                  = NULL,
      resumo_json           = $6
    WHERE id = $7
  `, [
    new Date().toISOString(),
    resumo.totalCarteiraAtiva ?? 0,
    resumo.totalConsultados ?? 0,
    resumo.totalSucesso ?? 0,
    resumo.totalFalha ?? 0,
    JSON.stringify(resumo),
    idConsulta
  ]);
  await registrarLogRendimentosSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_rendimentos_atualizacao_sucesso",
    status: "sucesso",
    resumo: `Atualização de rendimentos concluída: ${Number(resumo.totalSucesso || 0)} sucesso(s), ${Number(resumo.totalFalha || 0)} falha(s).`,
    payload: {
      idConsulta,
      totalCarteiraAtiva: Number(resumo.totalCarteiraAtiva || 0),
      totalConsultados: Number(resumo.totalConsultados || 0),
      totalSucesso: Number(resumo.totalSucesso || 0),
      totalFalha: Number(resumo.totalFalha || 0),
    },
  });
}

async function registrarConsultaRendimentosErro(idConsulta, erro) {
  const mensagem = typeof erro === "string" ? erro : (erro?.message || String(erro));
  await query(`
    UPDATE profor_transferegov_rendimentos_consultas SET
      concluido_em = $1,
      sucesso      = false,
      erro         = $2
    WHERE id = $3
  `, [new Date().toISOString(), mensagem, idConsulta]);
  await registrarLogRendimentosSeguro({
    modulo: "profor-2022",
    tipoEvento: "profor_rendimentos_atualizacao_erro",
    status: "falha",
    resumo: `Erro na atualização de rendimentos Transferegov: ${mensagem}`,
    payload: {
      idConsulta,
      erro: mensagem,
    },
  });
}

async function obterUltimaConsultaRendimentos() {
  const result = await query(
    "SELECT * FROM profor_transferegov_rendimentos_consultas ORDER BY id DESC LIMIT 1"
  );
  return linhaConsultaParaCamelCase(result.rows[0]);
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

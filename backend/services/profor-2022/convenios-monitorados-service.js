const { query } = require("../../db/postgres-client");

const CAMPOS_EDITAVEIS = new Set([
  "numero_convenio",
  "ano",
  "uf",
  "instrumento",
  "programa_origem",
  "id_convenio_transferegov",
  "observacao"
]);

function validarNumeroConvenio(valor) {
  if (!valor || typeof valor !== "string" || !/^\d+$/.test(valor.trim())) {
    throw new Error("numero_convenio é obrigatório e deve conter apenas dígitos.");
  }
}

function validarAno(valor) {
  if (valor !== undefined && valor !== null && valor !== "") {
    if (!/^\d{4}$/.test(String(valor).trim())) {
      throw new Error("ano deve conter exatamente 4 dígitos.");
    }
  }
}

function validarUf(valor) {
  if (valor !== undefined && valor !== null && valor !== "") {
    const uf = String(valor).trim().toUpperCase();
    if (uf.length !== 2) throw new Error("uf deve ter exatamente 2 caracteres.");
  }
}

function normalizarPayload(payload) {
  const numero = String(payload.numero_convenio ?? "").trim();
  const ano = payload.ano !== undefined && payload.ano !== null && payload.ano !== ""
    ? String(payload.ano).trim()
    : null;
  const uf = payload.uf !== undefined && payload.uf !== null && payload.uf !== ""
    ? String(payload.uf).trim().toUpperCase()
    : null;

  return {
    numero_convenio: numero,
    ano,
    uf,
    instrumento: String(payload.instrumento ?? "Convênio").trim() || "Convênio",
    programa_origem: String(payload.programa_origem ?? "PROFOR 2022").trim() || "PROFOR 2022",
    id_convenio_transferegov: payload.id_convenio_transferegov
      ? String(payload.id_convenio_transferegov).trim()
      : null,
    observacao: payload.observacao ? String(payload.observacao).trim() : null
  };
}

function linhaParaCamelCase(linha) {
  if (!linha) return null;
  return {
    id: linha.id,
    numeroConvenio: linha.numero_convenio,
    ano: linha.ano,
    uf: linha.uf,
    instrumento: linha.instrumento,
    programaOrigem: linha.programa_origem,
    ativo: linha.ativo,
    idConvenioTransferegov: linha.id_convenio_transferegov,
    observacao: linha.observacao,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em
  };
}

async function listarConveniosMonitorados(opcoes = {}) {
  const { incluirInativos = false } = opcoes;
  const sql = incluirInativos
    ? "SELECT * FROM profor_convenios_monitorados ORDER BY numero_convenio, ano"
    : "SELECT * FROM profor_convenios_monitorados WHERE ativo = true ORDER BY numero_convenio, ano";
  const result = await query(sql);
  return result.rows.map(linhaParaCamelCase);
}

async function obterConvenioMonitoradoPorId(id) {
  const result = await query("SELECT * FROM profor_convenios_monitorados WHERE id = $1", [id]);
  return linhaParaCamelCase(result.rows[0]);
}

async function obterConvenioMonitoradoPorNumero(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
  let result;
  if (anoVal !== null) {
    result = await query(
      "SELECT * FROM profor_convenios_monitorados WHERE numero_convenio = $1 AND ano = $2",
      [numero, anoVal]
    );
  } else {
    result = await query(
      "SELECT * FROM profor_convenios_monitorados WHERE numero_convenio = $1 AND ano IS NULL",
      [numero]
    );
  }
  return linhaParaCamelCase(result.rows[0]);
}

async function criarConvenioMonitorado(payload) {
  validarNumeroConvenio(payload.numero_convenio);
  validarAno(payload.ano);
  validarUf(payload.uf);

  const dados = normalizarPayload(payload);
  const agora = new Date().toISOString();

  let inserido;
  try {
    const result = await query(`
      INSERT INTO profor_convenios_monitorados
        (numero_convenio, ano, uf, instrumento, programa_origem, ativo,
         id_convenio_transferegov, observacao, criado_em, atualizado_em)
      VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9)
      RETURNING id
    `, [
      dados.numero_convenio,
      dados.ano,
      dados.uf,
      dados.instrumento,
      dados.programa_origem,
      dados.id_convenio_transferegov,
      dados.observacao,
      agora,
      agora
    ]);
    inserido = result.rows[0];
  } catch (erro) {
    if (erro.code === "23505" || (erro.message && erro.message.toLowerCase().includes("unique"))) {
      throw new Error(
        `Convênio ${dados.numero_convenio}/${dados.ano ?? "s/ano"} já está na carteira.`
      );
    }
    throw erro;
  }

  return obterConvenioMonitoradoPorId(inserido.id);
}

async function atualizarConvenioMonitorado(id, payload) {
  if (payload.ano !== undefined) validarAno(payload.ano);
  if (payload.uf !== undefined) validarUf(payload.uf);

  const atualResult = await query("SELECT * FROM profor_convenios_monitorados WHERE id = $1", [id]);
  if (!atualResult.rows[0]) throw new Error(`Convênio com id ${id} não encontrado.`);

  const campos = [];
  const valores = [];
  let idx = 1;

  Object.entries(payload).forEach(([chave, valor]) => {
    if (!CAMPOS_EDITAVEIS.has(chave)) return;
    if (chave === "numero_convenio") {
      validarNumeroConvenio(valor);
      campos.push(`numero_convenio = $${idx++}`);
      valores.push(String(valor).trim());
    } else if (chave === "uf") {
      const uf = valor !== null && valor !== undefined && valor !== ""
        ? String(valor).trim().toUpperCase()
        : null;
      campos.push(`uf = $${idx++}`);
      valores.push(uf);
    } else if (chave === "instrumento") {
      campos.push(`instrumento = $${idx++}`);
      valores.push(String(valor ?? "Convênio").trim() || "Convênio");
    } else if (chave === "programa_origem") {
      campos.push(`programa_origem = $${idx++}`);
      valores.push(String(valor ?? "PROFOR 2022").trim() || "PROFOR 2022");
    } else {
      campos.push(`${chave} = $${idx++}`);
      valores.push(valor !== undefined && valor !== null && valor !== "" ? String(valor).trim() : null);
    }
  });

  if (!campos.length) throw new Error("Nenhum campo editável informado para atualização.");

  const agora = new Date().toISOString();
  campos.push(`atualizado_em = $${idx++}`);
  valores.push(agora);
  valores.push(id);

  try {
    await query(`UPDATE profor_convenios_monitorados SET ${campos.join(", ")} WHERE id = $${idx}`, valores);
  } catch (erro) {
    if (erro.code === "23505" || (erro.message && erro.message.toLowerCase().includes("unique"))) {
      throw new Error("Já existe outro convênio com esse número e ano na carteira.");
    }
    throw erro;
  }

  return obterConvenioMonitoradoPorId(id);
}

async function inativarConvenioMonitorado(id) {
  const atualResult = await query("SELECT * FROM profor_convenios_monitorados WHERE id = $1", [id]);
  const atual = atualResult.rows[0];
  if (!atual) throw new Error(`Convênio com id ${id} não encontrado.`);
  if (atual.ativo === false || atual.ativo === 0) throw new Error(`Convênio com id ${id} já está inativo.`);

  const agora = new Date().toISOString();
  await query(
    "UPDATE profor_convenios_monitorados SET ativo = false, atualizado_em = $1 WHERE id = $2",
    [agora, id]
  );

  return obterConvenioMonitoradoPorId(id);
}

module.exports = {
  listarConveniosMonitorados,
  obterConvenioMonitoradoPorId,
  obterConvenioMonitoradoPorNumero,
  criarConvenioMonitorado,
  atualizarConvenioMonitorado,
  inativarConvenioMonitorado
};

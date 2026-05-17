const db = require("../../db/database");

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

function listarConveniosMonitorados(opcoes = {}) {
  const { incluirInativos = false } = opcoes;
  const sql = incluirInativos
    ? "SELECT * FROM profor_convenios_monitorados ORDER BY numero_convenio, ano"
    : "SELECT * FROM profor_convenios_monitorados WHERE ativo = 1 ORDER BY numero_convenio, ano";
  return db.prepare(sql).all().map(linhaParaCamelCase);
}

function obterConvenioMonitoradoPorId(id) {
  const linha = db.prepare("SELECT * FROM profor_convenios_monitorados WHERE id = ?").get(id);
  return linhaParaCamelCase(linha);
}

function obterConvenioMonitoradoPorNumero(numeroConvenio, ano) {
  const numero = String(numeroConvenio ?? "").trim();
  const anoVal = ano !== undefined && ano !== null && ano !== "" ? String(ano).trim() : null;
  const sql = anoVal !== null
    ? "SELECT * FROM profor_convenios_monitorados WHERE numero_convenio = ? AND ano = ?"
    : "SELECT * FROM profor_convenios_monitorados WHERE numero_convenio = ? AND ano IS NULL";
  const linha = anoVal !== null
    ? db.prepare(sql).get(numero, anoVal)
    : db.prepare(sql).get(numero);
  return linhaParaCamelCase(linha);
}

function criarConvenioMonitorado(payload) {
  validarNumeroConvenio(payload.numero_convenio);
  validarAno(payload.ano);
  validarUf(payload.uf);

  const dados = normalizarPayload(payload);
  const agora = new Date().toISOString();

  let info;
  try {
    info = db.prepare(`
      INSERT INTO profor_convenios_monitorados
        (numero_convenio, ano, uf, instrumento, programa_origem, ativo,
         id_convenio_transferegov, observacao, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(
      dados.numero_convenio,
      dados.ano,
      dados.uf,
      dados.instrumento,
      dados.programa_origem,
      dados.id_convenio_transferegov,
      dados.observacao,
      agora,
      agora
    );
  } catch (erro) {
    if (erro.message && erro.message.includes("UNIQUE constraint failed")) {
      throw new Error(
        `Convênio ${dados.numero_convenio}/${dados.ano ?? "s/ano"} já está na carteira.`
      );
    }
    throw erro;
  }

  return obterConvenioMonitoradoPorId(info.lastInsertRowid);
}

function atualizarConvenioMonitorado(id, payload) {
  if (payload.ano !== undefined) validarAno(payload.ano);
  if (payload.uf !== undefined) validarUf(payload.uf);

  const atual = db.prepare("SELECT * FROM profor_convenios_monitorados WHERE id = ?").get(id);
  if (!atual) throw new Error(`Convênio com id ${id} não encontrado.`);

  const campos = [];
  const valores = [];

  Object.entries(payload).forEach(([chave, valor]) => {
    if (!CAMPOS_EDITAVEIS.has(chave)) return;
    if (chave === "numero_convenio") {
      validarNumeroConvenio(valor);
      campos.push("numero_convenio = ?");
      valores.push(String(valor).trim());
    } else if (chave === "uf") {
      const uf = valor !== null && valor !== undefined && valor !== ""
        ? String(valor).trim().toUpperCase()
        : null;
      campos.push("uf = ?");
      valores.push(uf);
    } else if (chave === "instrumento") {
      campos.push("instrumento = ?");
      valores.push(String(valor ?? "Convênio").trim() || "Convênio");
    } else if (chave === "programa_origem") {
      campos.push("programa_origem = ?");
      valores.push(String(valor ?? "PROFOR 2022").trim() || "PROFOR 2022");
    } else {
      campos.push(`${chave} = ?`);
      valores.push(valor !== undefined && valor !== null && valor !== "" ? String(valor).trim() : null);
    }
  });

  if (!campos.length) throw new Error("Nenhum campo editável informado para atualização.");

  const agora = new Date().toISOString();
  campos.push("atualizado_em = ?");
  valores.push(agora);
  valores.push(id);

  try {
    db.prepare(`UPDATE profor_convenios_monitorados SET ${campos.join(", ")} WHERE id = ?`).run(...valores);
  } catch (erro) {
    if (erro.message && erro.message.includes("UNIQUE constraint failed")) {
      throw new Error("Já existe outro convênio com esse número e ano na carteira.");
    }
    throw erro;
  }

  return obterConvenioMonitoradoPorId(id);
}

function inativarConvenioMonitorado(id) {
  const atual = db.prepare("SELECT * FROM profor_convenios_monitorados WHERE id = ?").get(id);
  if (!atual) throw new Error(`Convênio com id ${id} não encontrado.`);
  if (atual.ativo === 0) throw new Error(`Convênio com id ${id} já está inativo.`);

  const agora = new Date().toISOString();
  db.prepare(
    "UPDATE profor_convenios_monitorados SET ativo = 0, atualizado_em = ? WHERE id = ?"
  ).run(agora, id);

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

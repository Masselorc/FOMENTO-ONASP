const historicoRepository = require("./profor-pad-historico-repository");

class HistoricoPadConsultaError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HistoricoPadConsultaError";
    this.statusCode = statusCode;
  }
}

function textoOpcional(valor, nome) {
  if (valor == null) return undefined;
  if (typeof valor !== "string") {
    throw new HistoricoPadConsultaError(400, `Parâmetro ${nome} inválido.`);
  }
  const texto = valor.trim();
  return texto || undefined;
}

function validarMes(mes) {
  const correspondencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
  if (!correspondencia || Number(correspondencia[1]) < 1) {
    throw new HistoricoPadConsultaError(400, "Parâmetro mes inválido. Use YYYY-MM.");
  }
}

function validarDataCivil(data) {
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!correspondencia) {
    throw new HistoricoPadConsultaError(400, "Parâmetro data inválido. Use YYYY-MM-DD.");
  }
  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const dia = Number(correspondencia[3]);
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes[mes - 1]) {
    throw new HistoricoPadConsultaError(400, "Parâmetro data inválido. Informe uma data civil existente.");
  }
}

async function consultarHistoricoPad(parametros = {}, executor = null) {
  if (!parametros || typeof parametros !== "object" || Array.isArray(parametros)) {
    throw new HistoricoPadConsultaError(400, "Parâmetros de consulta inválidos.");
  }
  const mes = textoOpcional(parametros.mes, "mes");
  const data = textoOpcional(parametros.data, "data");
  if (Boolean(mes) === Boolean(data)) {
    throw new HistoricoPadConsultaError(400, "Informe exatamente um dos parâmetros mes ou data.");
  }

  if (mes) {
    validarMes(mes);
    const dias = await historicoRepository.listarAtualizacoesPorMes({ mes }, executor);
    return { mes, dias };
  }

  validarDataCivil(data);
  const ufInformada = textoOpcional(parametros.uf, "uf");
  const uf = ufInformada?.toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) {
    throw new HistoricoPadConsultaError(400, "Parâmetro uf inválido. Informe duas letras.");
  }
  const convenio = textoOpcional(parametros.convenio, "convenio");
  const tipoInformado = textoOpcional(parametros.tipo, "tipo");
  const tipo = tipoInformado?.toUpperCase();
  if (tipo && !["NOVO", "REMOVIDO", "ALTERADO"].includes(tipo)) {
    throw new HistoricoPadConsultaError(400, "Parâmetro tipo inválido.");
  }
  const area = textoOpcional(parametros.area, "area");
  const filtros = { uf, convenio, tipo, area };
  for (const chave of Object.keys(filtros)) {
    if (filtros[chave] === undefined) delete filtros[chave];
  }
  const execucoes = await historicoRepository.listarAtualizacoesPorData({ data, ...filtros }, executor);
  return { data, filtros, execucoes };
}

async function obterDetalheHistoricoPad(id, executor = null) {
  let idNumerico;
  if (typeof id === "number") {
    idNumerico = id;
  } else if (typeof id === "string" && /^\d+$/.test(id)) {
    idNumerico = Number(id);
  }
  if (!Number.isSafeInteger(idNumerico) || idNumerico <= 0) {
    throw new HistoricoPadConsultaError(400, "ID da execução histórica do PAD inválido.");
  }
  const detalhe = await historicoRepository.buscarDetalheAtualizacao(idNumerico, executor);
  if (!detalhe) {
    throw new HistoricoPadConsultaError(404, "Execução histórica do PAD não encontrada.");
  }
  return detalhe;
}

module.exports = {
  HistoricoPadConsultaError,
  consultarHistoricoPad,
  obterDetalheHistoricoPad,
};

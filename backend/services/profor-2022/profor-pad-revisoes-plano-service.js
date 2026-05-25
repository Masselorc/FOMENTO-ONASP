const crypto = require("node:crypto");
const path = require("node:path");

const {
  obterUltimaRecargaOperacionalV2,
} = require("./profor-pad-carregador-operacional-service");

const AREAS_PERMITIDAS = new Set([
  "OUVIDORIA",
  "CORREGEDORIA",
  "ESCOLA_PENAL",
  "N/A",
  "NAO_CLASSIFICADO",
]);

function arredondar(valor, casas = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  const fator = 10 ** casas;
  return Math.round((numero + Number.EPSILON) * fator) / fator;
}

function hashCurto(partes) {
  return crypto
    .createHash("sha1")
    .update(partes.map((parte) => String(parte ?? "")).join("|"))
    .digest("hex")
    .slice(0, 16);
}

function normalizarUf(valor) {
  return String(valor || "NA").trim().toUpperCase() || "NA";
}

function normalizarNatureza(valor) {
  const texto = String(valor || "").trim().toUpperCase();
  if (texto.includes("CUSTEIO")) return "CUSTEIO";
  if (texto.includes("CAPITAL")) return "CAPITAL";
  return "NAO_INFORMADO";
}

function normalizarArea(valor, contexto = {}) {
  const texto = String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (texto === "ESCOLA_PENAL") return "ESCOLA_PENAL";
  if (texto === "NA" || texto === "N/A") return "N/A";
  if (texto === "NAO_INFORMADO" && contexto.saldoResidualTecnico) return "N/A";
  if (AREAS_PERMITIDAS.has(texto)) return texto;
  return "NAO_CLASSIFICADO";
}

function obterCodigoNatureza(item) {
  return item?.codigoNaturezaDespesa || item?.codigoNatureza || item?.codigo || "N/A";
}

function obterValorUnitario(item, quantidade, valorTotal) {
  const direto = Number(item?.valorUnitario);
  if (Number.isFinite(direto) && direto > 0) return arredondar(direto, 6);
  const derivado = Number(item?.valorUnitarioDerivado);
  if (Number.isFinite(derivado) && derivado > 0) return arredondar(derivado, 6);
  const referencia = Number(item?.valorUnitarioPadReferencia);
  if (Number.isFinite(referencia) && referencia > 0) return arredondar(referencia, 6);
  const qtd = Number(quantidade);
  const total = Number(valorTotal);
  return qtd > 0 && Number.isFinite(total) ? arredondar(total / qtd, 6) : 0;
}

function statusLinhaFilha(linha) {
  if (linha?.saldoResidualTecnico) return "SALDO_RESIDUAL_NAO_SETORIALIZADO";
  if (normalizarArea(linha?.area, linha) === "NAO_CLASSIFICADO") return "AREA_NAO_CLASSIFICADA";
  if (linha?.origemReconstrucao === "memoria_rateio_operacional") return "RATEIO_MEMORIZADO_APLICADO";
  return "OK";
}

function linhaMaeDeveExpandirPorPadrao(linha, filhos = []) {
  const status = String(linha?.status || "").toUpperCase();
  if (linha?.tipo === "ITEM_NOVO") return true;
  if (status.includes("PENDENTE") || status.includes("NAO_CLASSIFICADA") || status.includes("INCONSISTENTE")) return true;
  return filhos.some((filho) => {
    const statusFilho = String(filho?.status || "").toUpperCase();
    return statusFilho === "AREA_NAO_CLASSIFICADA" || normalizarArea(filho?.area, filho) === "NAO_CLASSIFICADO";
  });
}

function chaveMaePorLinha(linha) {
  return hashCurto([
    linha.numero,
    linha.uf,
    linha.chaveItem,
    linha.descricao,
    normalizarNatureza(linha.natureza),
    obterCodigoNatureza(linha),
  ]);
}

function criarFilhaDeLinhaReconstruida(linha, parentId, indice) {
  const quantidade = arredondar(linha.quantidade, 6);
  const valorUnitario = obterValorUnitario(linha, quantidade, linha.valorPrevisto);
  const valorTotal = arredondar(quantidade * valorUnitario);
  const valorExecutado = arredondar(Number(linha.valorExecutado ?? 0));
  return {
    id: `${parentId}-filha-${indice + 1}`,
    parentId,
    tipo: "ITEM_RATEADO",
    uf: normalizarUf(linha.uf),
    numeroConvenio: linha.numero || linha.numeroConvenio || null,
    itemConhecidoId: linha.itemConhecidoId || null,
    chaveItem: linha.chaveItem || null,
    area: normalizarArea(linha.area, linha),
    descricao: linha.descricao || "-",
    natureza: normalizarNatureza(linha.natureza),
    codigoNatureza: obterCodigoNatureza(linha),
    quantidade,
    valorUnitario,
    valorTotal,
    valorExecutado,
    valorPrevistoOriginal: arredondar(linha.valorPrevisto),
    origem: linha.origemReconstrucao || "MEMORIA_RATEIO_OPERACIONAL",
    status: statusLinhaFilha(linha),
  };
}

function criarMaeDeGrupo(grupo, filhos) {
  const primeira = grupo.linhas[0] || {};
  const quantidadeOriginal = arredondar(filhos.reduce((total, item) => total + Number(item.quantidade || 0), 0), 6);
  const valorTotalOriginal = arredondar(filhos.reduce((total, item) => total + Number(item.valorTotal || 0), 0));
  const valorExecutadoTotal = arredondar(filhos.reduce((total, item) => total + Number(item.valorExecutado || 0), 0));
  const status = filhos.some((filho) => filho.status === "AREA_NAO_CLASSIFICADA")
    ? "PENDENTE_REVISAO"
    : filhos.some((filho) => filho.status === "SALDO_RESIDUAL_NAO_SETORIALIZADO")
      ? "SALDO_RESIDUAL_NAO_SETORIALIZADO"
      : "RATEIO_MEMORIZADO_APLICADO";

  const mae = {
    id: grupo.id,
    tipo: primeira.saldoResidualTecnico ? "SALDO_RESIDUAL" : "ITEM_PAD",
    uf: normalizarUf(primeira.uf),
    numeroConvenio: primeira.numero || primeira.numeroConvenio || null,
    itemConhecidoId: primeira.itemConhecidoId || null,
    itemId: primeira.itemConhecidoId || primeira.chaveItem || grupo.id,
    chaveItem: primeira.chaveItem || null,
    descricao: primeira.descricao || "-",
    natureza: normalizarNatureza(primeira.natureza),
    codigoNatureza: obterCodigoNatureza(primeira),
    quantidadeOriginal,
    valorUnitario: obterValorUnitario(primeira, quantidadeOriginal, valorTotalOriginal),
    valorTotalOriginal,
    valorExecutadoTotal,
    expandidoPorPadrao: false,
    status,
    filhos: filhos.map((filho) => filho.id),
  };
  mae.expandidoPorPadrao = linhaMaeDeveExpandirPorPadrao(mae, filhos);
  return mae;
}

function criarMaeOcorrencia(item, tipo, status) {
  const uf = normalizarUf(item.uf);
  const quantidadeOriginal = arredondar(item.quantidade ?? item.quantidadeOriginal ?? 0, 6);
  const valorTotalReferencia = item.valorTotalOriginal ?? item.valorTotalPrevisto ?? item.valorPrevisto;
  const valorUnitario = obterValorUnitario(item, quantidadeOriginal, valorTotalReferencia);
  const valorTotalOriginal = arredondar(valorTotalReferencia ?? quantidadeOriginal * valorUnitario);
  const valorExecutadoTotal = arredondar(Number(item.valorTotalExecutado ?? item.valorExecutado ?? 0));
  const id = `mae-${tipo.toLowerCase()}-${hashCurto([
    item.numeroConvenio,
    uf,
    item.chaveItem,
    item.descricao,
    item.tipo,
  ])}`;

  return {
    id,
    tipo,
    uf,
    numeroConvenio: item.numeroConvenio || null,
    itemConhecidoId: item.itemConhecidoId || null,
    itemId: item.itemConhecidoId || item.chaveItem || id,
    chaveItem: item.chaveItem || null,
    descricao: item.descricao || "-",
    natureza: normalizarNatureza(item.natureza),
    codigoNatureza: obterCodigoNatureza(item),
    quantidadeOriginal,
    valorUnitario,
    valorTotalOriginal,
    valorExecutadoTotal,
    expandidoPorPadrao: tipo === "ITEM_NOVO",
    status,
    filhos: [],
    observacao: item.detalhe || null,
  };
}

function criarFilhaPendente(mae) {
  return {
    id: `${mae.id}-filha-pendente`,
    parentId: mae.id,
    tipo: "ITEM_RATEADO",
    uf: mae.uf,
    numeroConvenio: mae.numeroConvenio,
    itemConhecidoId: mae.itemConhecidoId || null,
    chaveItem: mae.chaveItem || null,
    area: "NAO_CLASSIFICADO",
    descricao: mae.descricao,
    natureza: mae.natureza,
    codigoNatureza: mae.codigoNatureza,
    quantidade: mae.quantidadeOriginal,
    valorUnitario: mae.valorUnitario,
    valorTotal: arredondar(mae.quantidadeOriginal * mae.valorUnitario),
    valorExecutado: arredondar(Number(mae.valorExecutadoTotal || 0)),
    origem: "PENDENCIA_OPERACIONAL",
    status: "AREA_NAO_CLASSIFICADA",
  };
}

function garantirUf(mapa, uf) {
  if (!mapa.linhasMae[uf]) mapa.linhasMae[uf] = [];
  if (!mapa.linhasFilhas[uf]) mapa.linhasFilhas[uf] = [];
  if (!mapa.pendencias[uf]) mapa.pendencias[uf] = [];
}

function montarResumoUf(uf, linhasMae, linhasFilhas, pendencias) {
  const totalPorArea = {};
  const totalPorNatureza = {};
  let totalPrevisto = 0;
  let totalExecutado = 0;
  for (const filha of linhasFilhas) {
    totalPorArea[filha.area] = arredondar((totalPorArea[filha.area] || 0) + filha.valorTotal);
    totalPorNatureza[filha.natureza] = arredondar((totalPorNatureza[filha.natureza] || 0) + filha.valorTotal);
    totalPrevisto += Number(filha.valorTotal || 0);
    totalExecutado += Number(filha.valorExecutado || 0);
  }
  totalPrevisto = arredondar(totalPrevisto);
  totalExecutado = arredondar(totalExecutado);
  const percentualExecucao = totalPrevisto > 0
    ? Math.round((totalExecutado / totalPrevisto) * 10000) / 100
    : 0;
  const convenio = linhasMae.find((linha) => linha.numeroConvenio)?.numeroConvenio || null;
  return {
    uf,
    numeroConvenio: convenio,
    totalItensPad: linhasMae.filter((linha) => linha.tipo !== "ITEM_SUPRIMIDO").length,
    totalLinhasRateadas: linhasFilhas.length,
    totalPorArea,
    totalPorNatureza,
    totalPrevisto,
    totalExecutado,
    percentualExecucao,
    itensPendentes: linhasMae.filter((linha) => String(linha.status || "").includes("PENDENTE") || linha.status === "ITEM_NOVO_SEM_RATEIO").length,
    itensNovos: linhasMae.filter((linha) => linha.tipo === "ITEM_NOVO").length,
    itensSuprimidos: linhasMae.filter((linha) => linha.tipo === "ITEM_SUPRIMIDO").length,
    pendenciasReais: pendencias.length,
    statusRevisao: pendencias.length ? "PENDENTE_REVISAO" : "OK",
  };
}

function montarRevisoesPlanoPad(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const recarga = opcoes.recarga || obterUltimaRecargaOperacionalV2({ repoRoot });
  const resultado = {
    dataHora: recarga?.dataHora || null,
    origem: "recarga-operacional-v2",
    ufs: [],
    resumoPorUf: {},
    linhasMae: {},
    linhasFilhas: {},
    pendencias: {},
    metadados: {
      sucessoRecarga: recarga?.sucesso === true,
      mensagemRecarga: recarga?.mensagem || null,
    },
  };

  const grupos = new Map();
  for (const linha of recarga?.planoAplicacaoReconstruido || []) {
    const uf = normalizarUf(linha.uf);
    const chave = chaveMaePorLinha(linha);
    if (!grupos.has(chave)) {
      grupos.set(chave, { id: `mae-${chave}`, uf, linhas: [] });
    }
    grupos.get(chave).linhas.push(linha);
  }

  for (const grupo of grupos.values()) {
    garantirUf(resultado, grupo.uf);
    const filhos = grupo.linhas.map((linha, indice) => criarFilhaDeLinhaReconstruida(linha, grupo.id, indice));
    const mae = criarMaeDeGrupo(grupo, filhos);
    resultado.linhasMae[grupo.uf].push(mae);
    resultado.linhasFilhas[grupo.uf].push(...filhos);
  }

  for (const item of recarga?.impedimentos || []) {
    if (!["item_novo_sem_rateio_memorizado", "item_pad_sem_rateio_memorizado"].includes(item.tipo)) continue;
    const mae = criarMaeOcorrencia(item, "ITEM_NOVO", "ITEM_NOVO_SEM_RATEIO");
    const filha = criarFilhaPendente(mae);
    garantirUf(resultado, mae.uf);
    mae.filhos = [filha.id];
    resultado.linhasMae[mae.uf].push(mae);
    resultado.linhasFilhas[mae.uf].push(filha);
    resultado.pendencias[mae.uf].push({
      tipo: item.tipo,
      uf: mae.uf,
      numeroConvenio: mae.numeroConvenio,
      chaveItem: mae.chaveItem,
      detalhe: item.detalhe || "Item novo sem rateio memorizado.",
    });
  }

  for (const item of recarga?.alertas || []) {
    if (item.tipo !== "item_suprimido_historico") continue;
    const mae = criarMaeOcorrencia(item, "ITEM_SUPRIMIDO", "ITEM_SUPRIMIDO_HISTORICO");
    garantirUf(resultado, mae.uf);
    resultado.linhasMae[mae.uf].push(mae);
  }

  resultado.ufs = Object.keys(resultado.linhasMae).sort((a, b) => a.localeCompare(b, "pt-BR"));
  for (const uf of resultado.ufs) {
    resultado.linhasMae[uf].sort((a, b) => {
      if (a.tipo === "ITEM_SUPRIMIDO" && b.tipo !== "ITEM_SUPRIMIDO") return 1;
      if (b.tipo === "ITEM_SUPRIMIDO" && a.tipo !== "ITEM_SUPRIMIDO") return -1;
      return String(a.descricao || "").localeCompare(String(b.descricao || ""), "pt-BR");
    });
    resultado.resumoPorUf[uf] = montarResumoUf(
      uf,
      resultado.linhasMae[uf],
      resultado.linhasFilhas[uf],
      resultado.pendencias[uf] || []
    );
  }

  return resultado;
}

module.exports = {
  AREAS_PERMITIDAS,
  montarRevisoesPlanoPad,
};

const dbPadrao = require("../../db/database");
const {
  persistirRateiosOperacionais,
  AREAS_PERMITIDAS,
} = require("./profor-pad-revisoes-plano-decisoes-service");
const {
  normalizarDescricaoRateioProfor,
} = require("./profor-rateio-extracao-service");

const USUARIO_SANEAMENTO = "saneamento-decisoes-antigas-pad-profor-2022";
const TIPO_SANEAMENTO_ALVO = "rateio_manual";
const DECISAO_ALVO = new Set(["ACEITO", "CORRIGIDO"]);
const TOLERANCIA_QUANTIDADE = 0.000001;

function arredondar(valor, casas = 6) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  const fator = 10 ** casas;
  return Math.round((numero + Number.EPSILON) * fator) / fator;
}

function normalizarAreaPayload(valor) {
  const texto = String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (texto === "ESCOLA" || texto === "ESCOLA_PENAL") return "ESCOLA_PENAL";
  if (texto === "NA" || texto === "N/A") return "N/A";
  if (texto === "NAO_INFORMADO" || texto === "" || texto === "NAO_CLASSIFICADO") return "NAO_CLASSIFICADO";
  if (AREAS_PERMITIDAS.has(texto)) return texto;
  return "NAO_CLASSIFICADO";
}

function normalizarNatureza(valor) {
  const texto = String(valor || "").trim().toUpperCase();
  if (texto.includes("CUSTEIO")) return "CUSTEIO";
  if (texto.includes("CAPITAL")) return "CAPITAL";
  return "NAO_INFORMADO";
}

function obterCampoPayloadDiv(divPayload, ...nomes) {
  for (const nome of nomes) {
    if (divPayload && divPayload[nome] !== undefined && divPayload[nome] !== null && divPayload[nome] !== "") {
      return divPayload[nome];
    }
  }
  return null;
}

function carregarUltimasDecisoesRateioManual(database, opcoes = {}) {
  const filtros = [];
  const params = [];
  if (Array.isArray(opcoes.conveniosFiltro) && opcoes.conveniosFiltro.length) {
    filtros.push(`d.numero_convenio IN (${opcoes.conveniosFiltro.map(() => "?").join(",")})`);
    params.push(...opcoes.conveniosFiltro);
  }
  const where = filtros.length ? `AND ${filtros.join(" AND ")}` : "";

  return database.prepare(`
    SELECT
      d.id AS divergencia_id,
      d.numero_convenio,
      d.uf,
      d.chave_item,
      d.tipo_alerta,
      d.payload_json AS divergencia_payload_json,
      dec.id AS decisao_id,
      dec.decisao,
      dec.payload_decisao_json AS decisao_payload_json,
      dec.usuario AS decisao_usuario,
      dec.decidido_em AS decisao_decidido_em
    FROM profor_2022_revisao_divergencias d
    JOIN profor_2022_revisao_decisoes dec
      ON dec.divergencia_id = d.id
    WHERE d.tipo_alerta = 'item_novo_sem_rateio'
      AND dec.id = (
        SELECT MAX(x.id)
        FROM profor_2022_revisao_decisoes x
        WHERE x.divergencia_id = d.id
      )
      ${where}
    ORDER BY d.id
  `).all(...params);
}

function interpretarRegistro(linha) {
  const erros = [];
  let divPayload = null;
  let decPayload = null;
  try { divPayload = linha.divergencia_payload_json ? JSON.parse(linha.divergencia_payload_json) : {}; }
  catch (e) { erros.push(`divergencia_payload_json invalido: ${e.message}`); }
  try { decPayload = linha.decisao_payload_json ? JSON.parse(linha.decisao_payload_json) : {}; }
  catch (e) { erros.push(`decisao_payload_json invalido: ${e.message}`); }

  if (erros.length) {
    return { aplicavel: false, motivo: "payload_invalido", erros, registro: linha };
  }

  if (!DECISAO_ALVO.has(String(linha.decisao || "").toUpperCase())) {
    return { aplicavel: false, motivo: "decisao_nao_resolutiva", registro: linha, decisao: linha.decisao };
  }

  if (String(decPayload.tipoSaneamento || "").trim() !== TIPO_SANEAMENTO_ALVO) {
    return {
      aplicavel: false,
      motivo: "tipo_saneamento_diferente",
      registro: linha,
      tipoSaneamento: decPayload.tipoSaneamento || null,
    };
  }

  const rateioBruto = Array.isArray(decPayload.rateio) ? decPayload.rateio : [];
  if (rateioBruto.length === 0) {
    return { aplicavel: false, motivo: "rateio_vazio", registro: linha };
  }

  const numeroConvenio = String(linha.numero_convenio || "").trim();
  const uf = String(linha.uf || "").trim().toUpperCase();
  const chaveItem = String(linha.chave_item || "").trim();
  const descricaoPad = String(obterCampoPayloadDiv(divPayload, "descricaoPad", "descricao") || "").trim();
  const naturezaPad = normalizarNatureza(obterCampoPayloadDiv(divPayload, "naturezaPad", "natureza"));
  const codigoNaturezaPad = String(obterCampoPayloadDiv(divPayload, "codigoNaturezaPad", "codigoNaturezaDespesa", "codigoNatureza") || "N/A");
  const quantidadeTotalItem = Number(decPayload.quantidadeTotalItem
    ?? obterCampoPayloadDiv(divPayload, "quantidadePad", "quantidade")
    ?? 0);
  const valorUnitarioPad = Number(obterCampoPayloadDiv(divPayload, "valorUnitarioPad", "valorUnitario") || 0);

  if (!numeroConvenio || !chaveItem || !descricaoPad) {
    return { aplicavel: false, motivo: "dados_insuficientes", registro: linha };
  }

  if (!Number.isFinite(quantidadeTotalItem) || quantidadeTotalItem <= 0) {
    return { aplicavel: false, motivo: "quantidade_invalida", registro: linha, quantidadeTotalItem };
  }

  // Tolera dois formatos historicos do payload de rateio:
  //  1) por quantidade absoluta: { quantidade: 1 }
  //  2) somente por percentual: { percentualQuantidade: 100 }
  // No formato (2), deriva a quantidade a partir de percentualQuantidade *
  // quantidadeTotalItem. Marca o registro para registro de telemetria.
  let derivadoDePercentual = false;
  const linhasRateio = rateioBruto.map((rt, indice) => {
    const area = normalizarAreaPayload(rt.area);
    const natureza = normalizarNatureza(rt.natureza || naturezaPad);
    const quantidadeBruta = Number(rt.quantidade);
    let quantidade;
    if (Number.isFinite(quantidadeBruta) && quantidadeBruta > 0) {
      quantidade = arredondar(quantidadeBruta, 6);
    } else if (Number.isFinite(Number(rt.percentualQuantidade))) {
      quantidade = arredondar((Number(rt.percentualQuantidade) / 100) * quantidadeTotalItem, 6);
      derivadoDePercentual = true;
    } else {
      quantidade = 0;
    }
    return {
      indice,
      area,
      areaOriginal: rt.area,
      natureza,
      quantidade,
      percentualQuantidade: Number(rt.percentualQuantidade) || 0,
    };
  });

  if (linhasRateio.some((l) => !Number.isFinite(l.quantidade) || l.quantidade < 0)) {
    return { aplicavel: false, motivo: "rateio_quantidade_invalida", registro: linha };
  }

  const somaRateio = arredondar(linhasRateio.reduce((soma, l) => soma + l.quantidade, 0), 6);
  if (Math.abs(somaRateio - quantidadeTotalItem) > TOLERANCIA_QUANTIDADE) {
    return {
      aplicavel: false,
      motivo: "soma_rateio_diferente_quantidade",
      registro: linha,
      somaRateio,
      quantidadeTotalItem,
      derivadoDePercentual,
    };
  }

  const contexto = {
    itemConhecidoId: null,
    chaveItem,
    numeroConvenio,
    uf,
    descricao: descricaoPad,
    descricaoNormalizada: normalizarDescricaoRateioProfor(descricaoPad),
    natureza: naturezaPad,
    codigoNatureza: codigoNaturezaPad,
    quantidadeOriginal: arredondar(quantidadeTotalItem, 6),
    valorUnitario: arredondar(valorUnitarioPad, 6),
  };

  const linhasPersistencia = linhasRateio.map((linha) => {
    const valorTotal = arredondar(linha.quantidade * contexto.valorUnitario, 2);
    return {
      id: `${contexto.chaveItem}-saneamento-${linha.indice + 1}`,
      parentId: null,
      tipo: "ITEM_RATEADO",
      uf,
      numeroConvenio,
      itemConhecidoId: null,
      chaveItem,
      area: linha.area,
      descricao: descricaoPad,
      natureza: linha.natureza,
      codigoNatureza: codigoNaturezaPad,
      quantidade: linha.quantidade,
      valorUnitario: contexto.valorUnitario,
      valorTotal,
      origem: "MEMORIA_RATEIO_OPERACIONAL",
      status: linha.area === "NAO_CLASSIFICADO" ? "AREA_NAO_CLASSIFICADA" : "AREA_ALTERADA",
    };
  });

  return {
    aplicavel: true,
    motivo: null,
    registro: linha,
    contexto,
    linhasPersistencia,
    rateioOriginal: linhasRateio,
  };
}

function verificarMaterializacao(database, chaveItem) {
  const item = database.prepare("SELECT id FROM profor_2022_itens_conhecidos WHERE chave_item = ?").get(chaveItem);
  if (!item) return { itemConhecidoId: null, possuiRateioAtivo: false };
  const totalAtivos = database.prepare(
    "SELECT COUNT(*) AS n FROM profor_2022_item_rateios WHERE item_conhecido_id = ? AND ativo = 1"
  ).get(item.id).n;
  return { itemConhecidoId: Number(item.id), possuiRateioAtivo: totalAtivos > 0 };
}

function planejarSaneamentoDecisoesAntigas(opcoes = {}) {
  const database = opcoes.db || dbPadrao;
  const conveniosFiltro = Array.isArray(opcoes.convenios)
    ? opcoes.convenios.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const linhas = carregarUltimasDecisoesRateioManual(database, { conveniosFiltro });
  const candidatas = [];
  const jaMaterializadas = [];
  const ignoradas = [];

  for (const linha of linhas) {
    const interpretacao = interpretarRegistro(linha);
    if (!interpretacao.aplicavel) {
      ignoradas.push(interpretacao);
      continue;
    }
    const estado = verificarMaterializacao(database, interpretacao.contexto.chaveItem);
    interpretacao.estadoAtual = estado;
    if (estado.itemConhecidoId && estado.possuiRateioAtivo) {
      jaMaterializadas.push(interpretacao);
    } else {
      candidatas.push(interpretacao);
    }
  }

  return {
    convenios: conveniosFiltro,
    totalDecisoesLidas: linhas.length,
    candidatas,
    jaMaterializadas,
    ignoradas,
  };
}

async function aplicarSaneamentoDecisoesAntigas(opcoes = {}) {
  const database = opcoes.db || dbPadrao;
  const persistir = opcoes.persistirRateiosOperacionais || persistirRateiosOperacionais;
  const plano = planejarSaneamentoDecisoesAntigas({ ...opcoes, db: database });
  const aplicadas = [];
  const erros = [];

  for (const candidata of plano.candidatas) {
    try {
      const itemConhecidoId = await persistir({
        contexto: candidata.contexto,
        linhas: candidata.linhasPersistencia,
        evento: "MATERIALIZAR_DECISAO_ANTIGA_RATEIO_MANUAL",
        detalhe: `Saneamento: decisão antiga ${candidata.registro.decisao_id} sobre divergência ${candidata.registro.divergencia_id} (${candidata.registro.decisao_decidido_em}).`,
      }, { db: database, usuario: USUARIO_SANEAMENTO });
      aplicadas.push({
        divergenciaId: candidata.registro.divergencia_id,
        decisaoId: candidata.registro.decisao_id,
        chaveItem: candidata.contexto.chaveItem,
        numeroConvenio: candidata.contexto.numeroConvenio,
        uf: candidata.contexto.uf,
        itemConhecidoId,
      });
    } catch (erro) {
      erros.push({
        divergenciaId: candidata.registro.divergencia_id,
        decisaoId: candidata.registro.decisao_id,
        chaveItem: candidata.contexto.chaveItem,
        mensagem: erro?.message || String(erro),
      });
    }
  }

  return {
    ...plano,
    aplicadas,
    erros,
  };
}

module.exports = {
  USUARIO_SANEAMENTO,
  TIPO_SANEAMENTO_ALVO,
  carregarUltimasDecisoesRateioManual,
  interpretarRegistro,
  verificarMaterializacao,
  planejarSaneamentoDecisoesAntigas,
  aplicarSaneamentoDecisoesAntigas,
  // helpers expostos para teste isolado
  normalizarAreaPayload,
  normalizarNatureza,
};

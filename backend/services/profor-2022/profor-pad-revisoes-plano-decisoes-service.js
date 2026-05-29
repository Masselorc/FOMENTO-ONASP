const { withTransaction } = require("../../db/postgres-client");
const {
  AREAS_PERMITIDAS,
  montarRevisoesPlanoPad,
} = require("./profor-pad-revisoes-plano-service");
const {
  carregarPadsOperacional,
} = require("./profor-pad-carregador-operacional-service");
const {
  criarChaveItemRateioProfor,
  normalizarDescricaoRateioProfor,
} = require("./profor-rateio-extracao-service");

const USUARIO_SISTEMA = "interface-revisoes-pad";
const TOLERANCIA_QUANTIDADE = 0.000001;

class RevisoesPlanoDecisaoError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "RevisoesPlanoDecisaoError";
    this.statusCode = statusCode;
  }
}

function agoraIso() {
  return new Date().toISOString();
}

function arredondar(valor, casas = 6) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  const fator = 10 ** casas;
  return Math.round((numero + Number.EPSILON) * fator) / fator;
}

function normalizarArea(valor) {
  const texto = String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (texto === "NA") return "N/A";
  if (!AREAS_PERMITIDAS.has(texto)) {
    throw new RevisoesPlanoDecisaoError(`Área inválida: ${valor || "(vazia)"}.`);
  }
  return texto;
}

function obterDadosRevisoes(opcoes = {}) {
  const carregar = opcoes.carregarRevisoesPlano || montarRevisoesPlanoPad;
  return carregar();
}

function encontrarGrupo(dados, parentId, linhaFilhaId = null) {
  for (const uf of dados?.ufs || Object.keys(dados?.linhasMae || {})) {
    const mae = (dados?.linhasMae?.[uf] || []).find((linha) => linha.id === parentId);
    if (!mae) continue;
    const filhas = (dados?.linhasFilhas?.[uf] || []).filter((linha) => linha.parentId === parentId);
    const filha = linhaFilhaId ? filhas.find((linha) => linha.id === linhaFilhaId) : null;
    return { uf, mae, filhas, filha };
  }
  throw new RevisoesPlanoDecisaoError("Linha-mãe da revisão PAD não encontrada.", 404);
}

function montarChaveItem(mae, payload) {
  const numeroConvenio = String(payload.numeroConvenio || mae.numeroConvenio || "").trim();
  const descricao = String(payload.descricao || mae.descricao || "").trim();
  if (!numeroConvenio || !descricao) {
    throw new RevisoesPlanoDecisaoError("Número do convênio e descrição são obrigatórios para gravar a memória de rateio.");
  }
  return payload.chaveItem || mae.chaveItem || criarChaveItemRateioProfor(
    numeroConvenio,
    normalizarDescricaoRateioProfor(descricao)
  );
}

function montarContextoItem(mae, payload) {
  const numeroConvenio = String(payload.numeroConvenio || mae.numeroConvenio || "").trim();
  const descricao = String(payload.descricao || mae.descricao || "").trim();
  return {
    itemConhecidoId: Number(mae.itemConhecidoId || payload.itemConhecidoId || 0) || null,
    chaveItem: montarChaveItem(mae, payload),
    numeroConvenio,
    uf: String(payload.uf || mae.uf || "").trim().toUpperCase(),
    descricao,
    descricaoNormalizada: normalizarDescricaoRateioProfor(descricao),
    natureza: String(payload.natureza || mae.natureza || "NAO_INFORMADO").trim().toUpperCase(),
    codigoNatureza: String(payload.codigoNatureza || mae.codigoNatureza || "N/A").trim(),
    quantidadeOriginal: arredondar(payload.quantidadeOriginal ?? mae.quantidadeOriginal, 6),
    valorUnitario: arredondar(payload.valorUnitario ?? mae.valorUnitario, 6),
  };
}

function validarLinhasRateio(linhas, contexto, { permitirUmaLinha = false } = {}) {
  if (!Array.isArray(linhas) || linhas.length < (permitirUmaLinha ? 1 : 2)) {
    throw new RevisoesPlanoDecisaoError("O rateio deve ter duas ou mais linhas.");
  }

  const normalizadas = linhas.map((linha, indice) => {
    const quantidade = arredondar(linha.quantidade, 6);
    if (!Number.isFinite(Number(linha.quantidade)) || quantidade < 0) {
      throw new RevisoesPlanoDecisaoError(`Quantidade inválida na linha ${indice + 1}.`);
    }
    const area = normalizarArea(linha.area);
    const valorTotal = arredondar(quantidade * contexto.valorUnitario, 2);
    return {
      id: linha.id || `${contexto.chaveItem}-rateio-${indice + 1}`,
      parentId: linha.parentId || null,
      tipo: "ITEM_RATEADO",
      uf: contexto.uf,
      numeroConvenio: contexto.numeroConvenio,
      itemConhecidoId: contexto.itemConhecidoId,
      chaveItem: contexto.chaveItem,
      area,
      descricao: contexto.descricao,
      natureza: contexto.natureza,
      codigoNatureza: contexto.codigoNatureza,
      quantidade,
      valorUnitario: contexto.valorUnitario,
      valorTotal,
      origem: "MEMORIA_RATEIO_OPERACIONAL",
      status: area === "NAO_CLASSIFICADO" ? "AREA_NAO_CLASSIFICADA" : "AREA_ALTERADA",
    };
  });

  const chaves = new Set();
  for (const linha of normalizadas) {
    const chave = `${linha.area}::${linha.natureza}`;
    if (chaves.has(chave)) {
      throw new RevisoesPlanoDecisaoError(`Rateio duplicado para área ${linha.area} e natureza ${linha.natureza}.`);
    }
    chaves.add(chave);
  }

  const soma = arredondar(normalizadas.reduce((total, linha) => total + linha.quantidade, 0), 6);
  if (Math.abs(soma - contexto.quantidadeOriginal) > TOLERANCIA_QUANTIDADE) {
    throw new RevisoesPlanoDecisaoError(`Soma das quantidades (${soma}) difere da quantidade da linha-mãe (${contexto.quantidadeOriginal}).`);
  }

  return normalizadas;
}

async function obterOuCriarItemConhecido(client, contexto) {
  if (contexto.itemConhecidoId) {
    const existentePorId = await client.query(
      "SELECT id FROM profor_2022_itens_conhecidos WHERE id = $1",
      [contexto.itemConhecidoId]
    );
    if (existentePorId.rows[0]) return Number(existentePorId.rows[0].id);
  }

  const existente = await client.query(
    "SELECT id FROM profor_2022_itens_conhecidos WHERE chave_item = $1",
    [contexto.chaveItem]
  );
  if (existente.rows[0]) return Number(existente.rows[0].id);

  const agora = agoraIso();
  const info = await client.query(`
    INSERT INTO profor_2022_itens_conhecidos (
      chave_item, numero_convenio, descricao_normalizada, descricao_original_referencia,
      uf, ano, naturezas_encontradas_json, unidades_encontradas_json,
      valor_unitario_referencia, origem, possui_pendencia_impeditiva,
      apto_para_importacao_futura, status_item, ultima_ocorrencia_em,
      ativo, criado_em, atualizado_em
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', $8, 'revisao-pad-plano', 0, 1, 'ATIVO', $9, true, $10, $11)
    RETURNING id
  `, [
    contexto.chaveItem,
    contexto.numeroConvenio,
    contexto.descricaoNormalizada,
    contexto.descricao,
    contexto.uf,
    "2022",
    JSON.stringify([contexto.natureza]),
    contexto.valorUnitario,
    agora,
    agora,
    agora
  ]);
  return Number(info.rows[0].id);
}

function persistirRateiosOperacionais({ contexto, linhas, evento, detalhe }, opcoes = {}) {
  return withTransaction(async (client) => {
    const itemConhecidoId = await obterOuCriarItemConhecido(client, contexto);
    const anteriores = (await client.query(`
      SELECT area, natureza, quantidade_referencia, valor_previsto_referencia, percentual_quantidade, percentual_valor
      FROM profor_2022_item_rateios
      WHERE item_conhecido_id = $1 AND ativo = true
      ORDER BY area, natureza
    `, [itemConhecidoId])).rows;
    const agora = agoraIso();
    await client.query(`
      UPDATE profor_2022_item_rateios
      SET ativo = false, atualizado_em = $1
      WHERE item_conhecido_id = $2 AND ativo = true
    `, [agora, itemConhecidoId]);

    const valorTotal = linhas.reduce((total, linha) => total + linha.valorTotal, 0);
    const novas = [];
    for (const linha of linhas) {
      const percentualQuantidade = contexto.quantidadeOriginal > 0
        ? arredondar((linha.quantidade / contexto.quantidadeOriginal) * 100, 6)
        : 0;
      const percentualValor = valorTotal > 0
        ? arredondar((linha.valorTotal / valorTotal) * 100, 6)
        : 0;
      await client.query(`
        INSERT INTO profor_2022_item_rateios (
          item_conhecido_id, chave_item, area, natureza, quantidade_referencia,
          valor_previsto_referencia, valor_executado_referencia,
          percentual_quantidade, percentual_valor, ativo, lote_importacao_id,
          criado_em, atualizado_em
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, true, NULL, $9, $10)
      `, [
        itemConhecidoId,
        contexto.chaveItem,
        linha.area,
        linha.natureza,
        linha.quantidade,
        linha.valorTotal,
        percentualQuantidade,
        percentualValor,
        agora,
        agora
      ]);
      novas.push({ area: linha.area, natureza: linha.natureza, quantidade: linha.quantidade, valorTotal: linha.valorTotal });
    }

    await client.query(`
      INSERT INTO profor_2022_revisao_logs (
        entidade_tipo, entidade_id, evento, estado_anterior_json, estado_novo_json,
        usuario, detalhe, criado_em
      ) VALUES ('rateio_plano', $1, $2, $3, $4, $5, $6, $7)
    `, [
      itemConhecidoId,
      evento,
      JSON.stringify(anteriores),
      JSON.stringify({ contexto: { ...contexto, itemConhecidoId }, linhas: novas }),
      USUARIO_SISTEMA,
      detalhe || null,
      agora
    ]);

    return itemConhecidoId;
  });
}

function persistirRateios(parametros, opcoes = {}) {
  const persistir = opcoes.persistirRateiosOperacionais || persistirRateiosOperacionais;
  return persistir(parametros, opcoes);
}

function regerarRecargaOperacional(opcoes = {}) {
  if (opcoes.pularRegerarRecarga) return;
  const regerar = opcoes.carregarPadsOperacional || carregarPadsOperacional;
  try {
    regerar({ repoRoot: opcoes.repoRoot });
  } catch (erro) {
    console.error("Falha ao regerar recarga operacional pos-decisao:", erro);
  }
}

async function salvarAreaRevisaoPlano(payload = {}, opcoes = {}) {
  const dados = obterDadosRevisoes(opcoes);
  const { mae, filhas, filha } = encontrarGrupo(dados, payload.parentId, payload.linhaFilhaId);
  if (!filha) throw new RevisoesPlanoDecisaoError("Linha-filha da revisão PAD não encontrada.", 404);

  const contexto = montarContextoItem(mae, payload);
  const areaNova = normalizarArea(payload.areaNova);
  const linhasAtualizadas = filhas.map((linha) => ({
    ...linha,
    area: linha.id === filha.id ? areaNova : linha.area,
    quantidade: linha.quantidade,
  }));
  const normalizadas = validarLinhasRateio(linhasAtualizadas, contexto, { permitirUmaLinha: true });
  const itemConhecidoId = await persistirRateios({
    contexto,
    linhas: normalizadas,
    evento: "ALTERAR_AREA_RATEIO",
    detalhe: `Área alterada de ${payload.areaAnterior || filha.area || "-"} para ${areaNova}.`,
  }, opcoes);

  const linhaFilhaAtualizada = normalizadas.find((linha) => linha.id === filha.id) || normalizadas[0];
  linhaFilhaAtualizada.itemConhecidoId = itemConhecidoId;
  const statusGrupo = normalizadas.some((linha) => linha.area === "NAO_CLASSIFICADO")
    ? "PENDENTE_REVISAO"
    : "AREA_ALTERADA";

  regerarRecargaOperacional(opcoes);
  return { linhaFilhaAtualizada, statusGrupo };
}

async function salvarRateioRevisaoPlano(payload = {}, opcoes = {}) {
  const dados = obterDadosRevisoes(opcoes);
  const { mae } = encontrarGrupo(dados, payload.parentId);
  const contexto = montarContextoItem(mae, payload);
  const linhasBase = (payload.linhas || []).map((linha, indice) => ({
    id: `${payload.parentId}-filha-${indice + 1}`,
    parentId: payload.parentId,
    area: linha.area,
    quantidade: linha.quantidade,
  }));
  const normalizadas = validarLinhasRateio(linhasBase, contexto, { permitirUmaLinha: false });
  const itemConhecidoId = await persistirRateios({
    contexto,
    linhas: normalizadas,
    evento: "ALTERAR_QUANTIDADE_RATEIO",
    detalhe: "Rateio de quantidade alterado pela tela de Revisões PAD.",
  }, opcoes);
  const linhasFilhasAtualizadas = normalizadas.map((linha) => ({ ...linha, itemConhecidoId }));
  const statusGrupo = linhasFilhasAtualizadas.some((linha) => linha.area === "NAO_CLASSIFICADO")
    ? "PENDENTE_REVISAO"
    : "RATEIO_ALTERADO";

  regerarRecargaOperacional(opcoes);
  return { linhasFilhasAtualizadas, statusGrupo };
}

module.exports = {
  RevisoesPlanoDecisaoError,
  salvarAreaRevisaoPlano,
  salvarRateioRevisaoPlano,
  validarLinhasRateio,
  // Exportados para reaproveitamento por scripts de saneamento que precisem
  // materializar rateios sem passar pelo fluxo da UI Revisoes PAD.
  persistirRateiosOperacionais,
  obterOuCriarItemConhecido,
  AREAS_PERMITIDAS,
};

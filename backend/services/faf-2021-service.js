const postgresClient = require("../db/postgres-client");
const { validarSenhaEdicao } = require("./auth-service");

const PREFIXO_ITEM_ID = "faf2021_idx_";

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function converterNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;

  const texto = limparTexto(valor);
  if (!texto) return NaN;

  const normalizado = texto.replace(/^R\$/i, "").replace(/\s+/g, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    return Number.parseFloat(normalizado.replace(/\./g, "").replace(",", "."));
  }

  if (normalizado.includes(",")) {
    return Number.parseFloat(normalizado.replace(",", "."));
  }

  return Number.parseFloat(normalizado);
}

function obterIndiceItemFaf2021(itemId) {
  const texto = limparTexto(itemId);
  const match = texto.match(new RegExp(`^${PREFIXO_ITEM_ID}(\\d+)$`));
  if (!match) return null;

  const indice = Number.parseInt(match[1], 10);
  return Number.isInteger(indice) && indice >= 0 ? indice : null;
}

function formatarData(valor) {
  if (!valor) return "";
  if (valor instanceof Date) return valor.toISOString();

  const texto = limparTexto(valor);
  if (!texto) return "";

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toISOString();
}

function montarItemFaf2021(row) {
  const valorTotal = Number(row.valor_total) || 0;
  const valorExecutado = Number(row.valor_executado) || 0;

  return {
    itemId: row.item_id,
    indiceDadosBase: Number(row.indice_dados_base),
    uf: limparTexto(row.uf),
    objeto: limparTexto(row.objeto),
    quantidade: Number(row.quantidade) || 0,
    valorUnitario: Number(row.valor_unitario) || 0,
    valorTotal,
    valorExecutado,
    percentualExecutado: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0,
    observacaoExecucao: limparTexto(row.observacao_execucao || ""),
    atualizadoEm: formatarData(row.atualizado_em),
    instrumento: limparTexto(row.instrumento)
  };
}

async function listarFaf2021() {
  const resultado = await postgresClient.query(
    `
      SELECT
        item_id,
        indice_dados_base,
        uf,
        objeto,
        quantidade,
        valor_unitario,
        valor_total,
        valor_executado,
        observacao_execucao,
        atualizado_em,
        instrumento
      FROM faf_2021_itens
      ORDER BY indice_dados_base ASC NULLS LAST, item_id ASC
    `
  );

  return {
    success: true,
    itens: resultado.rows.map(montarItemFaf2021)
  };
}

async function buscarItemFaf2021(client, itemId) {
  const resultado = await client.query(
    `
      SELECT
        item_id,
        indice_dados_base,
        uf,
        objeto,
        quantidade,
        valor_unitario,
        valor_total
      FROM faf_2021_itens
      WHERE item_id = $1
      LIMIT 1
    `,
    [itemId]
  );

  return resultado.rows[0] || null;
}

async function salvarExecucaoFaf2021(payload = {}) {
  if (!validarSenhaEdicao(payload.password)) {
    return { success: false, message: "Senha inválida. Alterações não foram salvas." };
  }

  const indiceDadosBase = obterIndiceItemFaf2021(payload.itemId);
  if (indiceDadosBase === null) {
    return { success: false, message: "Item FAF 2021 inválido." };
  }

  return postgresClient.withTransaction(async (client) => {
    const item = await buscarItemFaf2021(client, payload.itemId);

    if (!item) {
      return { success: false, message: "Item FAF 2021 não localizado." };
    }

    if (normalizarTexto(item.uf) !== normalizarTexto(payload.uf)) {
      return { success: false, message: "UF informada não confere com o item original." };
    }

    if (limparTexto(item.objeto) !== limparTexto(payload.objeto)) {
      return { success: false, message: "Objeto informado não confere com o item original." };
    }

    const quantidade = Object.prototype.hasOwnProperty.call(payload, "quantidade")
      ? converterNumero(payload.quantidade)
      : Number(item.quantidade);
    const valorUnitario = Object.prototype.hasOwnProperty.call(payload, "valorUnitario")
      ? converterNumero(payload.valorUnitario)
      : Number(item.valor_unitario);
    const valorExecutado = converterNumero(payload.valorExecutado);

    if (!Number.isFinite(quantidade)) {
      return { success: false, message: "Quantidade inválida." };
    }

    if (quantidade < 0) {
      return { success: false, message: "Quantidade não pode ser negativa." };
    }

    if (!Number.isFinite(valorUnitario)) {
      return { success: false, message: "Valor unitário inválido." };
    }

    if (valorUnitario < 0) {
      return { success: false, message: "Valor unitário não pode ser negativo." };
    }

    const valorTotal = Number((quantidade * valorUnitario).toFixed(2));

    if (!Number.isFinite(valorTotal)) {
      return { success: false, message: "Valor total inválido." };
    }

    if (valorTotal < 0) {
      return { success: false, message: "Valor total não pode ser negativo." };
    }

    if (!Number.isFinite(valorExecutado)) {
      return { success: false, message: "Valor executado inválido." };
    }

    if (valorExecutado < 0) {
      return { success: false, message: "Valor executado não pode ser negativo." };
    }

    const atualizarObservacao = Object.prototype.hasOwnProperty.call(payload, "observacaoExecucao");
    const observacao = atualizarObservacao ? limparTexto(payload.observacaoExecucao) : null;

    if (atualizarObservacao && /<[^>]+>/.test(observacao)) {
      return { success: false, message: "Observação não pode conter HTML." };
    }

    const atualizado = await client.query(
      `
        UPDATE faf_2021_itens
        SET
          quantidade = $2,
          valor_unitario = $3,
          valor_total = $4,
          valor_executado = $5,
          observacao_execucao = CASE WHEN $6::boolean THEN $7 ELSE observacao_execucao END,
          atualizado_em = now()
        WHERE item_id = $1
        RETURNING atualizado_em
      `,
      [payload.itemId, quantidade, valorUnitario, valorTotal, valorExecutado, atualizarObservacao, observacao]
    );

    return {
      success: true,
      message: "Execução do item FAF 2021 atualizada com sucesso.",
      itemId: payload.itemId,
      atualizadoEm: formatarData(atualizado.rows[0]?.atualizado_em),
      quantidade,
      valorUnitario,
      valorTotal,
      valorExecutado,
      percentualExecutado: valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0
    };
  });
}

module.exports = {
  listarFaf2021,
  salvarExecucaoFaf2021,
  montarItemFaf2021,
  obterIndiceItemFaf2021,
  converterNumero
};

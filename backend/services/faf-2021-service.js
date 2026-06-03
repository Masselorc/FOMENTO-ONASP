const postgresClient = require("../db/postgres-client");
const { validarSenhaEdicao } = require("./auth-service");
const historicoService = require("./historico-service");
const logsOperacionaisService = require("./logs-operacionais-service");

const PAGINA_FAF = "faf-2021";

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
        valor_total,
        valor_executado,
        observacao_execucao
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

    // Estado anterior — necessário para histórico por campo.
    const qtdAntes = Number(item.quantidade);
    const vuAntes = Number(item.valor_unitario);
    const vtAntes = Number(item.valor_total);
    const veAntes = Number(item.valor_executado) || 0;
    const obsAntes = limparTexto(item.observacao_execucao || "");
    const obsNova = atualizarObservacao ? observacao : obsAntes;

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

    // Histórico por campo — registra apenas campos com diferença real.
    const camposAlterados = [];
    const valoresAntes = {};
    const valoresDepois = {};

    const arredondar2 = (v) => Number(v.toFixed(2));

    if (arredondar2(qtdAntes) !== arredondar2(quantidade)) {
      await historicoService.registrarHistoricoPostgres(client, { pagina: PAGINA_FAF, registro: payload.itemId, campo: "quantidade", valorAnterior: qtdAntes, valorNovo: quantidade });
      camposAlterados.push("quantidade");
      valoresAntes.quantidade = qtdAntes;
      valoresDepois.quantidade = quantidade;
    }
    if (arredondar2(vuAntes) !== arredondar2(valorUnitario)) {
      await historicoService.registrarHistoricoPostgres(client, { pagina: PAGINA_FAF, registro: payload.itemId, campo: "valor_unitario", valorAnterior: vuAntes, valorNovo: valorUnitario });
      camposAlterados.push("valor_unitario");
      valoresAntes.valor_unitario = vuAntes;
      valoresDepois.valor_unitario = valorUnitario;
    }
    if (arredondar2(vtAntes) !== arredondar2(valorTotal)) {
      await historicoService.registrarHistoricoPostgres(client, { pagina: PAGINA_FAF, registro: payload.itemId, campo: "valor_total", valorAnterior: vtAntes, valorNovo: valorTotal });
      camposAlterados.push("valor_total");
      valoresAntes.valor_total = vtAntes;
      valoresDepois.valor_total = valorTotal;
    }
    if (arredondar2(veAntes) !== arredondar2(valorExecutado)) {
      await historicoService.registrarHistoricoPostgres(client, { pagina: PAGINA_FAF, registro: payload.itemId, campo: "valor_executado", valorAnterior: veAntes, valorNovo: valorExecutado });
      camposAlterados.push("valor_executado");
      valoresAntes.valor_executado = veAntes;
      valoresDepois.valor_executado = valorExecutado;
    }
    if (atualizarObservacao && obsAntes !== obsNova) {
      await historicoService.registrarHistoricoPostgres(client, { pagina: PAGINA_FAF, registro: payload.itemId, campo: "observacao_execucao", valorAnterior: obsAntes, valorNovo: obsNova });
      camposAlterados.push("observacao_execucao");
      valoresAntes.observacao_execucao = obsAntes;
      valoresDepois.observacao_execucao = obsNova;
    }

    const percentualExecutado = valorTotal > 0 ? (valorExecutado / valorTotal) * 100 : 0;

    // Log operacional — apenas quando houve alteração efetiva.
    if (camposAlterados.length > 0) {
      try {
        await logsOperacionaisService.registrarLogOperacional({
          modulo: "faf-2021",
          tipoEvento: "faf_2021_edicao",
          status: "sucesso",
          resumo: `Edição FAF 2021: ${payload.itemId} / ${payload.uf}`,
          payload: {
            itemId: payload.itemId,
            uf: payload.uf,
            objeto: payload.objeto,
            camposAlterados,
            valoresAntes,
            valoresDepois,
            percentualExecutado: Number(percentualExecutado.toFixed(4)),
            origem: "interface",
          },
        });
      } catch {
        // Falha no log não interrompe a operação.
      }
    }

    return {
      success: true,
      message: camposAlterados.length > 0
        ? "Execução do item FAF 2021 atualizada com sucesso."
        : "Nenhuma alteração efetiva detectada.",
      itemId: payload.itemId,
      atualizadoEm: formatarData(atualizado.rows[0]?.atualizado_em),
      quantidade,
      valorUnitario,
      valorTotal,
      valorExecutado,
      percentualExecutado,
      camposAlterados,
    };
  });
}

async function listarHistoricoFaf2021(itemId, opcoes = {}) {
  const texto = limparTexto(itemId);
  if (!texto.startsWith(PREFIXO_ITEM_ID)) {
    throw Object.assign(new Error("itemId FAF 2021 inválido."), { statusCode: 400 });
  }
  const limite = Math.min(Math.max(1, Number(opcoes.limite) || 100), 500);
  const resultado = await postgresClient.query(
    `SELECT campo, valor_anterior, valor_novo, alterado_em
     FROM historico_alteracoes
     WHERE pagina = $1 AND registro = $2
     ORDER BY alterado_em DESC
     LIMIT $3`,
    [PAGINA_FAF, texto, limite]
  );
  return resultado.rows.map((row) => ({
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNovo: row.valor_novo,
    alteradoEm: row.alterado_em,
  }));
}

module.exports = {
  listarFaf2021,
  salvarExecucaoFaf2021,
  listarHistoricoFaf2021,
  montarItemFaf2021,
  obterIndiceItemFaf2021,
  converterNumero
};

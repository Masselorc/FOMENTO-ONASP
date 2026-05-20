const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../../db/database");

const STATUS_LOTE_IMPORTADO = "importado";
const STATUS_LOTE_ROLLBACK = "rollback";

function agoraIso() {
  return new Date().toISOString();
}

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function lerJson(caminhoArquivo) {
  return JSON.parse(fs.readFileSync(caminhoArquivo, "utf8"));
}

function calcularHashArquivo(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo);
  return crypto.createHash("sha256").update(conteudo).digest("hex");
}

function garantirEstruturaRateioInicial(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Arquivo JSON inválido: conteúdo ausente.");
  }
  if (!Array.isArray(payload.itensConhecidos)) {
    throw new Error("Arquivo JSON inválido: itensConhecidos deve ser um array.");
  }
  if (!Array.isArray(payload.rateios)) {
    throw new Error("Arquivo JSON inválido: rateios deve ser um array.");
  }
  if (!Array.isArray(payload.alertas)) {
    throw new Error("Arquivo JSON inválido: alertas deve ser um array.");
  }
  if (!payload.resumo || typeof payload.resumo !== "object") {
    throw new Error("Arquivo JSON inválido: resumo deve ser um objeto.");
  }
}

function carregarArquivoRateioInicial(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const caminhoEntrada = opcoes.caminhoJson || "backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json";
  const caminhoAbsoluto = path.isAbsolute(caminhoEntrada)
    ? caminhoEntrada
    : path.join(repoRoot, caminhoEntrada);

  if (!fs.existsSync(caminhoAbsoluto)) {
    throw new Error(`Arquivo de rateio inicial não encontrado: ${caminhoAbsoluto}`);
  }

  const dados = lerJson(caminhoAbsoluto);
  garantirEstruturaRateioInicial(dados);

  return {
    repoRoot,
    caminhoAbsoluto,
    caminhoRelativoJson: caminhoRelativo(repoRoot, caminhoAbsoluto),
    hashArquivo: calcularHashArquivo(caminhoAbsoluto),
    dados,
  };
}

function obterLotePorHash(hashArquivo) {
  if (!hashArquivo) return null;
  return db.prepare(`
    SELECT id, status, criado_em
    FROM profor_2022_rateio_import_lotes
    WHERE hash_arquivo_json = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(hashArquivo) || null;
}

function normalizarBooleanoInteiro(valor, padrao = 0) {
  if (valor === true) return 1;
  if (valor === false) return 0;
  if (valor === 1 || valor === 0) return valor;
  return padrao;
}

function numeroSeguro(valor, padrao = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

function jsonSeguroArray(valor) {
  return JSON.stringify(Array.isArray(valor) ? valor : []);
}

function simularImportacaoRateioInicialJson(opcoes = {}) {
  const entrada = carregarArquivoRateioInicial(opcoes);
  const loteExistente = obterLotePorHash(entrada.hashArquivo);

  return {
    caminhoJson: entrada.caminhoRelativoJson,
    hashArquivo: entrada.hashArquivo,
    arquivoOrigemPlanilha: entrada.dados?.resumo?.arquivoPlanilha || null,
    totalItens: entrada.dados.itensConhecidos.length,
    totalRateios: entrada.dados.rateios.length,
    totalAlertas: entrada.dados.alertas.length,
    totalAlertasImpeditivos: entrada.dados.alertas.filter((item) => item?.nivel === "impeditivo").length,
    loteExistente: loteExistente
      ? { id: loteExistente.id, status: loteExistente.status, criadoEm: loteExistente.criado_em }
      : null,
  };
}

function importarRateioInicialJson(opcoes = {}) {
  const entrada = carregarArquivoRateioInicial(opcoes);
  const { dados } = entrada;
  const permitirReimportacao = Boolean(opcoes.permitirReimportacao);
  const loteExistente = obterLotePorHash(entrada.hashArquivo);

  if (loteExistente && loteExistente.status !== STATUS_LOTE_ROLLBACK && !permitirReimportacao) {
    throw new Error(
      `Arquivo já importado no lote ${loteExistente.id} (${loteExistente.status}). ` +
      "Use a opção --forcar para reimportar conscientemente."
    );
  }

  const executarImportacao = db.transaction(() => {
    const agora = agoraIso();
    const totalAlertasImpeditivos = dados.alertas.filter((item) => item?.nivel === "impeditivo").length;
    const infoLote = db.prepare(`
      INSERT INTO profor_2022_rateio_import_lotes (
        arquivo_origem, arquivo_json_dry_run, hash_arquivo_json, status,
        total_itens, total_rateios, total_alertas, total_alertas_impeditivos,
        observacao, criado_em
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?)
    `).run(
      dados?.resumo?.arquivoPlanilha || "planilha-antiga",
      entrada.caminhoRelativoJson,
      entrada.hashArquivo,
      STATUS_LOTE_IMPORTADO,
      opcoes.observacao || null,
      agora
    );
    const loteId = Number(infoLote.lastInsertRowid);

    const upsertItem = db.prepare(`
      INSERT INTO profor_2022_itens_conhecidos (
        chave_item, numero_convenio, descricao_normalizada, descricao_original_referencia,
        uf, ano, naturezas_encontradas_json, unidades_encontradas_json, valor_unitario_referencia,
        origem, possui_pendencia_impeditiva, apto_para_importacao_futura, status_item,
        ultima_ocorrencia_em, ativo, lote_importacao_id, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chave_item) DO UPDATE SET
        numero_convenio = excluded.numero_convenio,
        descricao_normalizada = excluded.descricao_normalizada,
        descricao_original_referencia = excluded.descricao_original_referencia,
        uf = excluded.uf,
        ano = excluded.ano,
        naturezas_encontradas_json = excluded.naturezas_encontradas_json,
        unidades_encontradas_json = excluded.unidades_encontradas_json,
        valor_unitario_referencia = excluded.valor_unitario_referencia,
        origem = excluded.origem,
        possui_pendencia_impeditiva = excluded.possui_pendencia_impeditiva,
        apto_para_importacao_futura = excluded.apto_para_importacao_futura,
        ultima_ocorrencia_em = excluded.ultima_ocorrencia_em,
        ativo = excluded.ativo,
        lote_importacao_id = excluded.lote_importacao_id,
        atualizado_em = excluded.atualizado_em
    `);
    const selectItemId = db.prepare("SELECT id FROM profor_2022_itens_conhecidos WHERE chave_item = ?");
    const itensPorChave = new Map();

    for (const item of dados.itensConhecidos) {
      const chave = String(item?.chaveItem || "").trim();
      if (!chave) continue;

      upsertItem.run(
        chave,
        String(item?.numeroConvenio || "").trim(),
        String(item?.descricaoNormalizada || "").trim(),
        item?.descricaoOriginalReferencia ? String(item.descricaoOriginalReferencia).trim() : null,
        item?.uf ? String(item.uf).trim() : null,
        item?.ano ? String(item.ano).trim() : null,
        jsonSeguroArray(item?.naturezasEncontradas),
        jsonSeguroArray(item?.unidadesEncontradas),
        numeroSeguro(item?.valorUnitarioReferencia, 0),
        item?.origem ? String(item.origem).trim() : "planilha-antiga",
        normalizarBooleanoInteiro(item?.possuiPendenciaImpedativa, 0),
        normalizarBooleanoInteiro(item?.aptoParaImportacaoFutura, 1),
        "ATIVO",
        agora,
        1,
        loteId,
        agora,
        agora
      );

      const registro = selectItemId.get(chave);
      if (!registro?.id) {
        throw new Error(`Falha ao localizar item conhecido após upsert: ${chave}`);
      }
      itensPorChave.set(chave, Number(registro.id));
    }

    const inativarRateioAtivo = db.prepare(`
      UPDATE profor_2022_item_rateios
      SET ativo = 0, atualizado_em = ?
      WHERE item_conhecido_id = ? AND area = ? AND natureza = ? AND ativo = 1
    `);
    const inserirRateio = db.prepare(`
      INSERT INTO profor_2022_item_rateios (
        item_conhecido_id, chave_item, area, natureza, quantidade_referencia,
        valor_previsto_referencia, valor_executado_referencia, percentual_quantidade,
        percentual_valor, ativo, lote_importacao_id, criado_em, atualizado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    for (const rateio of dados.rateios) {
      const chave = String(rateio?.chaveItem || "").trim();
      const itemId = itensPorChave.get(chave);
      if (!itemId) {
        throw new Error(`Rateio sem item conhecido correspondente para chave: ${chave}`);
      }

      const area = String(rateio?.area || "").trim();
      const natureza = String(rateio?.natureza || "").trim();
      inativarRateioAtivo.run(agora, itemId, area, natureza);
      inserirRateio.run(
        itemId,
        chave,
        area,
        natureza,
        numeroSeguro(rateio?.quantidadeReferencia, 0),
        numeroSeguro(rateio?.valorPrevistoReferencia, 0),
        numeroSeguro(rateio?.valorExecutadoReferencia, 0),
        numeroSeguro(rateio?.percentualQuantidade, 0),
        numeroSeguro(rateio?.percentualValor, 0),
        loteId,
        agora,
        agora
      );
    }

    const inserirAlerta = db.prepare(`
      INSERT INTO profor_2022_rateio_import_alertas (
        lote_importacao_id, chave_item, tipo, nivel, numero_convenio, uf, ano,
        descricao, detalhe, origem_arquivo, origem_aba, origem_linha, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const alerta of dados.alertas) {
      inserirAlerta.run(
        loteId,
        alerta?.chaveItem ? String(alerta.chaveItem).trim() : null,
        String(alerta?.tipo || "").trim(),
        String(alerta?.nivel || "impeditivo").trim(),
        alerta?.numeroConvenio ? String(alerta.numeroConvenio).trim() : null,
        alerta?.uf ? String(alerta.uf).trim() : null,
        alerta?.ano ? String(alerta.ano).trim() : null,
        alerta?.descricao ? String(alerta.descricao).trim() : null,
        alerta?.detalhe ? String(alerta.detalhe).trim() : null,
        alerta?.origem?.arquivo ? String(alerta.origem.arquivo).trim() : null,
        alerta?.origem?.aba ? String(alerta.origem.aba).trim() : null,
        Number.isFinite(Number(alerta?.origem?.linha)) ? Number(alerta.origem.linha) : null,
        agora
      );
    }

    db.prepare(`
      UPDATE profor_2022_rateio_import_lotes
      SET total_itens = ?, total_rateios = ?, total_alertas = ?, total_alertas_impeditivos = ?, status = ?
      WHERE id = ?
    `).run(
      dados.itensConhecidos.length,
      dados.rateios.length,
      dados.alertas.length,
      totalAlertasImpeditivos,
      STATUS_LOTE_IMPORTADO,
      loteId
    );

    return {
      loteId,
      totalItens: dados.itensConhecidos.length,
      totalRateios: dados.rateios.length,
      totalAlertas: dados.alertas.length,
      totalAlertasImpeditivos,
      hashArquivo: entrada.hashArquivo,
      caminhoJson: entrada.caminhoRelativoJson,
      arquivoOrigemPlanilha: dados?.resumo?.arquivoPlanilha || null,
    };
  });

  return executarImportacao();
}

function rollbackLoteRateioInicial(opcoes = {}) {
  const loteId = Number(opcoes.loteId);
  if (!Number.isFinite(loteId) || loteId <= 0) {
    throw new Error("Informe um id de lote válido para rollback.");
  }
  const motivo = opcoes.motivo ? String(opcoes.motivo).trim() : "Rollback manual do lote";

  const executarRollback = db.transaction(() => {
    const lote = db.prepare("SELECT id, status FROM profor_2022_rateio_import_lotes WHERE id = ?").get(loteId);
    if (!lote) {
      throw new Error(`Lote ${loteId} não encontrado.`);
    }
    if (lote.status === STATUS_LOTE_ROLLBACK) {
      throw new Error(`Lote ${loteId} já está marcado como rollback.`);
    }

    const agora = agoraIso();
    const loteAtualizado = db.prepare(`
      UPDATE profor_2022_rateio_import_lotes
      SET status = ?, rollback_em = ?, rollback_motivo = ?
      WHERE id = ?
    `).run(STATUS_LOTE_ROLLBACK, agora, motivo, loteId);

    const rateiosInativados = db.prepare(`
      UPDATE profor_2022_item_rateios
      SET ativo = 0, atualizado_em = ?
      WHERE lote_importacao_id = ? AND ativo = 1
    `).run(agora, loteId);

    const itensInativados = db.prepare(`
      UPDATE profor_2022_itens_conhecidos
      SET ativo = 0, atualizado_em = ?
      WHERE lote_importacao_id = ? AND ativo = 1
    `).run(agora, loteId);

    return {
      loteId,
      lotesAtualizados: loteAtualizado.changes,
      itensInativados: itensInativados.changes,
      rateiosInativados: rateiosInativados.changes,
      rollbackEm: agora,
      motivo,
    };
  });

  return executarRollback();
}

module.exports = {
  carregarArquivoRateioInicial,
  simularImportacaoRateioInicialJson,
  importarRateioInicialJson,
  rollbackLoteRateioInicial,
};

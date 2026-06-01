const fs = require("fs");
const path = require("path");

const { query, withTransaction, closePool } = require("../db/postgres-client");

const ARQUIVO_APLICACAO = path.join(__dirname, "..", "data", "aplicacao.json");
const PREFIXO_ITEM_ID = "faf2021_idx_";
const INSTRUMENTO_FAF_NORMALIZADO = "FAF 2021";

function limparTexto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function normalizarTexto(valor) {
  return limparTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function converterNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = limparTexto(valor);
  if (!texto) return 0;

  const normalizado = texto.replace(/^R\$/i, "").replace(/\s+/g, "");
  if (normalizado.includes(",") && normalizado.includes(".")) {
    return Number.parseFloat(normalizado.replace(/\./g, "").replace(",", ".")) || 0;
  }

  if (normalizado.includes(",")) {
    return Number.parseFloat(normalizado.replace(",", ".")) || 0;
  }

  return Number.parseFloat(normalizado) || 0;
}

function converterData(valor) {
  const texto = limparTexto(valor);
  if (!texto) return null;

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

function carregarItensFaf2021() {
  const aplicacao = JSON.parse(fs.readFileSync(ARQUIVO_APLICACAO, "utf8"));
  const dadosBase = Array.isArray(aplicacao?.dadosBase) ? aplicacao.dadosBase : [];

  return dadosBase
    .map((item, indiceDadosBase) => ({ item, indiceDadosBase }))
    .filter(({ item }) => normalizarTexto(item.instrumento) === INSTRUMENTO_FAF_NORMALIZADO)
    .map(({ item, indiceDadosBase }) => ({
      itemId: `${PREFIXO_ITEM_ID}${indiceDadosBase}`,
      indiceDadosBase,
      uf: limparTexto(item.uf),
      objeto: limparTexto(item.objeto),
      quantidade: converterNumero(item.quantidade),
      valorUnitario: converterNumero(item.valorUnitario),
      valorTotal: converterNumero(item.valorTotal),
      valorExecutado: converterNumero(item.valorExecutado),
      observacaoExecucao: limparTexto(item.observacaoExecucao || item.observacao_execucao || ""),
      atualizadoEm: converterData(item.atualizadoEm || item.atualizado_em),
      instrumento: limparTexto(item.instrumento) || "FAF 2021",
      payloadOriginalJson: item
    }));
}

function resumirItens(itens, existentes = new Set()) {
  const ufs = [...new Set(itens.map((item) => item.uf).filter(Boolean))].sort();
  const valorTotal = itens.reduce((soma, item) => soma + item.valorTotal, 0);
  const totalAtualizar = itens.filter((item) => existentes.has(item.itemId)).length;
  const totalInserir = itens.length - totalAtualizar;

  return {
    totalItens: itens.length,
    ufs,
    valorTotal,
    totalInserir,
    totalAtualizar
  };
}

function imprimirResumo(resumo, modo) {
  console.log(`Modo: ${modo}`);
  console.log(`Total encontrado: ${resumo.totalItens}`);
  console.log(`UFs: ${resumo.ufs.join(", ")}`);
  console.log(`Valor total: ${resumo.valorTotal.toFixed(2)}`);
  console.log(`Total a inserir: ${resumo.totalInserir}`);
  console.log(`Total a atualizar: ${resumo.totalAtualizar}`);
}

async function obterItensExistentes(itemIds) {
  if (itemIds.length === 0) return new Set();

  const resultado = await query(
    "SELECT item_id FROM faf_2021_itens WHERE item_id = ANY($1::text[])",
    [itemIds]
  );

  return new Set(resultado.rows.map((row) => row.item_id));
}

async function aplicarMigracao(itens) {
  return withTransaction(async (client) => {
    let gravados = 0;

    for (const item of itens) {
      await client.query(
        `
          INSERT INTO faf_2021_itens (
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
            instrumento,
            payload_original_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, $11, $12::jsonb)
          ON CONFLICT (item_id) DO UPDATE SET
            indice_dados_base = EXCLUDED.indice_dados_base,
            uf = EXCLUDED.uf,
            objeto = EXCLUDED.objeto,
            quantidade = EXCLUDED.quantidade,
            valor_unitario = EXCLUDED.valor_unitario,
            valor_total = EXCLUDED.valor_total,
            instrumento = EXCLUDED.instrumento,
            payload_original_json = EXCLUDED.payload_original_json
        `,
        [
          item.itemId,
          item.indiceDadosBase,
          item.uf,
          item.objeto,
          item.quantidade,
          item.valorUnitario,
          item.valorTotal,
          item.valorExecutado,
          item.observacaoExecucao,
          item.atualizadoEm,
          item.instrumento,
          JSON.stringify(item.payloadOriginalJson)
        ]
      );
      gravados += 1;
    }

    return gravados;
  });
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const dryRun = !aplicar || process.argv.includes("--dry-run");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada. Postgres indisponivel.");
  }

  if (aplicar && process.env.CONFIRMAR_MIGRACAO_FAF_2021 !== "SIM") {
    throw new Error("Para aplicar, defina CONFIRMAR_MIGRACAO_FAF_2021=SIM.");
  }

  const itens = carregarItensFaf2021();
  const existentes = await obterItensExistentes(itens.map((item) => item.itemId));
  const resumo = resumirItens(itens, existentes);

  imprimirResumo(resumo, dryRun ? "dry-run" : "aplicar");

  if (dryRun) {
    console.log("Dry-run concluido. Nenhuma linha foi alterada.");
    return;
  }

  const gravados = await aplicarMigracao(itens);
  console.log(`Linhas gravadas: ${gravados}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

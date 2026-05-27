const fs = require("node:fs");
const path = require("node:path");

const TABLES = [
  "parametros_minimos",
  "formalizacao_profor",
  "orcamento_2026",
  "historico_alteracoes",
  "orcamento_2026_movimentacoes",
  "profor_convenios_monitorados",
  "profor_detru_cache",
  "profor_detru_atualizacoes",
  "profor_transferegov_rendimentos_cache",
  "profor_transferegov_rendimentos_consultas",
  "logs_operacionais",
  "profor_2022_rateio_import_lotes",
  "profor_2022_revisao_lotes",
  "profor_2022_itens_conhecidos",
  "profor_2022_item_rateios",
  "profor_2022_rateio_import_alertas",
  "profor_2022_revisao_divergencias",
  "profor_2022_revisao_decisoes",
  "profor_2022_revisao_logs"
];

const BOOLEAN_COLUMNS = new Set([
  "processo_autuado",
  "compoe_orcamento",
  "ativo",
  "sucesso",
  "bloqueia_publicacao"
]);

const JSON_COLUMNS = new Set([
  "payload_json",
  "resumo_json",
  "naturezas_encontradas_json",
  "unidades_encontradas_json",
  "payload_decisao_json",
  "estado_anterior_json",
  "estado_novo_json"
]);

const NUMERIC_COLUMNS = new Set([
  "valor_previsto",
  "valor_disponibilizado",
  "valor_empenhado",
  "valor_executado",
  "valor_alocado_origem",
  "valor_estimado_pesquisa_preco",
  "valor_unitario",
  "valor",
  "saldo_rendimentos_atual",
  "valor_unitario_referencia",
  "valor_previsto_referencia",
  "valor_executado_referencia"
]);

const BR_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function validateData() {
  const exportDir = path.join(__dirname, "../backups/postgres-migration-export");
  const manifestPath = path.join(exportDir, "_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error("Validação cancelada: manifesto _manifest.json não encontrado.");
    console.error("Execute o script de exportação primeiro para gerar os dados.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`=== Inspecionando manifesto de exportação (${manifest.exportadoEm}) ===`);

  let totalWarnings = 0;
  let totalErrors = 0;

  for (const table of TABLES) {
    const tableManifest = manifest.tabelas.find(t => t.tabela === table);
    if (!tableManifest) {
      console.warn(`[AVISO] Tabela ${table} não consta no manifesto.`);
      totalWarnings++;
      continue;
    }

    const filePath = path.join(exportDir, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`[ERRO] Arquivo JSON de dados para ${table} ausente.`);
      totalErrors++;
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (rows.length !== tableManifest.quantidadeRegistros) {
      console.error(`[ERRO] Discrepância na contagem de ${table}: manifesto indica ${tableManifest.quantidadeRegistros}, arquivo contém ${rows.length}.`);
      totalErrors++;
    }

    // Validação das colunas de cada registro
    let dateErrors = 0;
    let tsErrors = 0;
    let jsonErrors = 0;
    let boolErrors = 0;
    let numErrors = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      for (const [col, val] of Object.entries(row)) {
        if (val === null || val === undefined) continue;

        // 1. Validar datas data_* (devem ser DD/MM/YYYY ou YYYY-MM-DD)
        if (col.startsWith("data_")) {
          const sVal = String(val);
          if (sVal !== "" && !BR_DATE_REGEX.test(sVal) && !ISO_DATE_REGEX.test(sVal)) {
            dateErrors++;
          }
        }
        // 2. Validar timestamps *_em (devem ser ISO-8601)
        else if (col.endsWith("_em") || ["criado_em", "iniciado_em", "concluido_em", "consultado_em"].includes(col)) {
          const sVal = String(val);
          if (sVal !== "" && !ISO_DATE_REGEX.test(sVal)) {
            tsErrors++;
          }
        }
        // 3. Validar JSON strings
        else if (JSON_COLUMNS.has(col)) {
          if (typeof val === "string" && val.trim() !== "") {
            try {
              JSON.parse(val);
            } catch {
              jsonErrors++;
            }
          }
        }
        // 4. Validar booleanos (SQLite deve armazenar como 0, 1 ou null)
        else if (BOOLEAN_COLUMNS.has(col)) {
          if (val !== 0 && val !== 1 && val !== "0" && val !== "1" && val !== true && val !== false) {
            boolErrors++;
          }
        }
        // 5. Validar numeric (no máximo 2 casas decimais)
        else if (NUMERIC_COLUMNS.has(col)) {
          const fVal = parseFloat(val);
          if (!isNaN(fVal)) {
            const diff = Math.abs(fVal - Math.round(fVal * 100) / 100);
            if (diff > 1e-9) {
              numErrors++;
            }
          }
        }
      }
    }

    if (dateErrors > 0 || tsErrors > 0 || jsonErrors > 0 || boolErrors > 0 || numErrors > 0) {
      console.log(`\nTabela [${table}]:`);
      if (dateErrors > 0) console.log(`  - ${dateErrors} datas data_* fora do padrão DD/MM/YYYY ou ISO.`);
      if (tsErrors > 0) console.log(`  - ${tsErrors} timestamps *_em fora do padrão ISO-8601.`);
      if (jsonErrors > 0) console.log(`  - ${jsonErrors} campos JSON contendo strings malformadas.`);
      if (boolErrors > 0) console.log(`  - ${boolErrors} booleanos com valores diferentes de 0/1.`);
      if (numErrors > 0) console.log(`  - ${numErrors} valores monetários com mais de 2 casas decimais.`);
      totalErrors++;
    }
  }

  console.log("\n=== Resumo da Validação ===");
  console.log(`Tabelas analisadas: ${TABLES.length}`);
  console.log(`Erros críticos: ${totalErrors}`);
  console.log(`Avisos: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.error("\n[FALHA] Foram encontrados problemas que podem impedir a importação no Postgres.");
    process.exit(1);
  } else {
    console.log("\n[SUCESSO] Todos os dados analisados estão prontos e compatíveis para migração.");
  }
}

if (require.main === module) {
  validateData();
}

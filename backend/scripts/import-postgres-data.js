const fs = require("node:fs");
const path = require("node:path");

// Carrega dotenv opcionalmente
try {
  require("dotenv").config();
} catch (e) {
  // Ignora se dotenv não estiver instalado
}

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

function transformRow(row) {
  const transformed = {};
  for (const [col, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      transformed[col] = null;
      continue;
    }

    // 1. Converter datas brasileiras DD/MM/YYYY para ISO YYYY-MM-DD
    if (col.startsWith("data_") && typeof val === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      transformed[col] = val.split("/").reverse().join("-");
    }
    // 2. Converter booleanos do SQLite (0/1) para booleanos do Postgres
    else if (BOOLEAN_COLUMNS.has(col)) {
      if (val === 1 || val === "1" || val === true) {
        transformed[col] = true;
      } else if (val === 0 || val === "0" || val === false) {
        transformed[col] = false;
      } else {
        transformed[col] = null;
      }
    }
    // 3. Converter strings JSON para objetos para inserção no jsonb
    else if (JSON_COLUMNS.has(col)) {
      if (typeof val === "string" && val.trim() !== "") {
        try {
          transformed[col] = JSON.parse(val);
        } catch {
          transformed[col] = val;
        }
      } else {
        transformed[col] = val;
      }
    } else {
      transformed[col] = val;
    }
  }
  return transformed;
}

async function runImport() {
  // 1. Validações de ambiente obrigatórias
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Erro: A variável de ambiente DATABASE_URL está ausente.");
    process.exit(1);
  }

  const allowImport = process.env.ALLOW_POSTGRES_IMPORT;
  if (allowImport !== "1") {
    console.error("Erro: Execução recusada. A variável ALLOW_POSTGRES_IMPORT=1 deve estar definida.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("=== MODO DRY-RUN: Simulação sem persistência ===");
  }

  // 2. Carrega biblioteca pg dinamicamente para não exigir instalação nesta etapa
  let Client;
  try {
    Client = require("pg").Client;
  } catch (err) {
    console.error("Erro: A biblioteca 'pg' (node-postgres) é necessária para executar este script.");
    console.error("Por favor, instale-a como dependência do projeto: npm install pg");
    process.exit(1);
  }

  const exportDir = path.join(__dirname, "../backups/postgres-migration-export");
  const manifestPath = path.join(exportDir, "_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`Erro: Manifesto de exportação não encontrado em: ${manifestPath}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Inicia transação
    await client.query("BEGIN");
    console.log("Transação iniciada no Postgres.");

    for (const table of TABLES) {
      const filePath = path.join(exportDir, `${table}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo de dados para a tabela ${table} não encontrado: ${filePath}`);
      }

      const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(`Processando tabela ${table} (${rows.length} registros)...`);

      for (const rawRow of rows) {
        const transformedRow = transformRow(rawRow);
        const cols = Object.keys(transformedRow);
        const vals = Object.values(transformedRow);

        if (cols.length === 0) continue;

        const colNames = cols.map(c => `"${c}"`).join(", ");
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const queryText = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`;

        if (!dryRun) {
          await client.query(queryText, vals);
        }
      }

      // Se houver coluna "id" serial/identity, atualiza sequência se não for dry-run
      if (!dryRun && rows.length > 0) {
        const info = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'id'
        `, [table]);

        if (info.rows.length > 0 && ["bigint", "integer"].includes(info.rows[0].data_type)) {
          // Verifica se é identity ou serial
          await client.query(`
            SELECT pg_catalog.pg_get_serial_sequence($1, 'id') as seq
          `, [table]).then(async (res) => {
            const seqName = res.rows[0]?.seq;
            if (seqName) {
              await client.query(`
                SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${table}"), 1))
              `, [seqName]);
            }
          }).catch(() => {
            // Ignora se não houver sequência associada
          });
        }
      }
    }

    if (dryRun) {
      console.log("DRY-RUN concluído: Fazendo Rollback da transação.");
      await client.query("ROLLBACK");
      console.log("Simulação bem-sucedida.");
    } else {
      console.log("Importação concluída. Fazendo Commit da transação.");
      await client.query("COMMIT");
      console.log("Migração de dados persistida com sucesso.");
    }
  } catch (err) {
    console.error("Erro crítico durante a importação. Executando Rollback...");
    try {
      await client.query("ROLLBACK");
    } catch (e) {
      // Ignora erro de rollback se conexão já caiu
    }
    console.error("Erro detalhado:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runImport();
}

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

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

function runExport() {
  const dbPath = path.join(__dirname, "../data/onasp.sqlite");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Banco SQLite não encontrado em: ${dbPath}`);
  }

  // Abre conexão em modo leitura
  const db = new Database(dbPath, { readonly: true });
  const exportDir = path.join(__dirname, "../backups/postgres-migration-export");
  fs.mkdirSync(exportDir, { recursive: true });

  const manifest = {
    exportadoEm: new Date().toISOString(),
    tabelas: []
  };

  console.log("Iniciando exportação das tabelas do SQLite...");

  for (const table of TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all();
      const content = JSON.stringify(rows, null, 2);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      
      const fileName = `${table}.json`;
      const filePath = path.join(exportDir, fileName);
      
      fs.writeFileSync(filePath, content, "utf8");
      
      manifest.tabelas.push({
        tabela: table,
        quantidadeRegistros: rows.length,
        hash: hash,
        caminho: `backend/backups/postgres-migration-export/${fileName}`
      });
      
      console.log(`- ${table}: ${rows.length} registros exportados.`);
    } catch (err) {
      console.error(`Erro ao exportar a tabela ${table}:`, err.message);
      db.close();
      process.exit(1);
    }
  }

  const manifestPath = path.join(exportDir, "_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Manifesto gerado com sucesso em: ${manifestPath}`);

  db.close();
  console.log("Exportação concluída com sucesso.");
}

if (require.main === module) {
  runExport();
}

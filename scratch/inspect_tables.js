const db = require("../backend/db/database");

const tables = ['profor_2022_revisao_divergencias', 'profor_2022_itens_conhecidos', 'profor_2022_item_rateios', 'formalizacao_profor'];

for (const table of tables) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  console.log(`\nTable: ${table}`);
  console.log(info.map(c => `${c.name} (${c.type})`).join("\n"));
}

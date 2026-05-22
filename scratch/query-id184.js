const db = require("../backend/db/database");

const divergencias = db.prepare(`
  SELECT * FROM profor_2022_revisao_divergencias
  WHERE id = 24 OR tipo_alerta = 'equivalencia_por_descricao_normalizada' OR chave_item LIKE '%Meia%Militar%' OR chave_item LIKE '%Meia%militar%' OR payload_json LIKE '%Meia%Militar%' OR payload_json LIKE '%Meia%militar%'
`).all();

console.log("Divergências correspondentes:");
console.log(JSON.stringify(divergencias, null, 2));

const ids = divergencias.map(d => d.id);
if (ids.length > 0) {
  const placeholders = ids.map(() => "?").join(", ");
  const decisoes = db.prepare(`
    SELECT * FROM profor_2022_revisao_decisoes WHERE divergencia_id IN (${placeholders})
  `).all(...ids);

  console.log("\nDecisões correspondentes:");
  console.log(JSON.stringify(decisoes, null, 2));
} else {
  console.log("Nenhuma divergência encontrada.");
}

const db = require("c:/Users/marcelo.cortez/OneDrive - MINISTERIO DA JUSTIÇA/1. SENAPPEN/2. OUVIDORIA/GITHUB/FOMENTO-ONASP/FOMENTO-ONASP/backend/db/database");

const id24 = db.prepare(`
  SELECT id, chave_divergencia, numero_convenio, tipo_alerta, status, valor_anterior, valor_novo, payload_json
  FROM profor_2022_revisao_divergencias
  WHERE id = 24
`).get();

console.log("ID 24:", id24);

const db = require("../backend/db/database");

const ids = [31, 32];
const rows = db.prepare(`
  SELECT * FROM profor_2022_revisao_divergencias
  WHERE id IN (${ids.join(",")})
`).all();

console.log("DIVERGENCES:");
console.log(JSON.stringify(rows, null, 2));

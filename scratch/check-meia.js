const fs = require("node:fs");

const rel = JSON.parse(fs.readFileSync("backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json", "utf8"));

console.log("=== CHECKING 937265 IN ITENS IGUAIS ===");
const list = rel.itensIguais.filter(x => String(x.numeroConvenio) === "937265");
console.log("Found in itensIguais:", list.length);
console.log(list.slice(0, 10));
console.log("Unique descriptions in 937265 in itensIguais:", [...new Set(list.map(x => x.descricao))]);

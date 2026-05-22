const fs = require("fs");
const path = require("path");

const relatoriosDir = path.join(__dirname, "..", "backend", "data", "relatorios");

const compFile = path.join(relatoriosDir, "profor-2022-pad-plano-comparacao-dry-run.json");
if (fs.existsSync(compFile)) {
  const comp = JSON.parse(fs.readFileSync(compFile, "utf-8"));
  console.log("Keys in profor-2022-pad-plano-comparacao-dry-run.json:", Object.keys(comp));
  
  if (comp.itensComparados) {
    const matches = comp.itensComparados.filter(
      item => item.numeroConvenio === "937265" || JSON.stringify(item).includes("937265")
    );
    console.log(`\nMatches in itensComparados: ${matches.length}`);
    console.log(JSON.stringify(matches, null, 2));
  } else if (comp.comparacao) {
    const matches = comp.comparacao.filter(
      item => item.numeroConvenio === "937265" || JSON.stringify(item).includes("937265")
    );
    console.log(`\nMatches in comparacao: ${matches.length}`);
    console.log(JSON.stringify(matches, null, 2));
  } else {
    // If it's a plain array or other format, print a snippet
    const dataStr = JSON.stringify(comp);
    console.log("Length of data:", dataStr.length);
    // Find where Calca or Cinto occurs
    let idx = dataStr.indexOf("937265::CALCA");
    if (idx !== -1) {
      console.log("Calca found at index:", idx);
      console.log(dataStr.substring(idx - 200, idx + 800));
    }
    idx = dataStr.indexOf("937265::CINTO");
    if (idx !== -1) {
      console.log("Cinto found at index:", idx);
      console.log(dataStr.substring(idx - 200, idx + 800));
    }
  }
} else {
  console.log("File not found: profor-2022-pad-plano-comparacao-dry-run.json");
}

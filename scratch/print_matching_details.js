const fs = require("fs");
const path = require("path");

const relatoriosDir = path.join(__dirname, "..", "backend", "data", "relatorios");

function inspectFile(filename, keywords) {
  const filePath = path.join(relatoriosDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }
  console.log(`\n========================================`);
  console.log(`INSPECTING FILE: ${filename}`);
  console.log(`========================================`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  
  if (Array.isArray(data)) {
    const matches = data.filter(item => {
      const str = JSON.stringify(item).toLowerCase();
      return keywords.every(kw => str.includes(kw));
    });
    console.log(`Found ${matches.length} matches in array.`);
    console.log(JSON.stringify(matches.slice(0, 5), null, 2));
  } else {
    // try to find keys or properties
    const matches = [];
    for (const key in data) {
      const str = JSON.stringify({ key, val: data[key] }).toLowerCase();
      if (keywords.every(kw => str.includes(kw))) {
        matches.push({ key, data: data[key] });
      }
    }
    console.log(`Found ${matches.length} matches in object keys.`);
    console.log(JSON.stringify(matches.slice(0, 5), null, 2));
  }
}

inspectFile("profor-2022-pad-saneamento-detalhado.json", ["937265", "calca"]);
inspectFile("profor-2022-pad-saneamento-detalhado.json", ["937265", "cinto"]);

inspectFile("profor-2022-pad-plano-comparacao-dry-run.json", ["937265", "calca"]);
inspectFile("profor-2022-pad-plano-comparacao-dry-run.json", ["937265", "cinto"]);

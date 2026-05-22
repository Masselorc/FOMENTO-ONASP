const fs = require("fs");
const path = require("path");

const relatoriosDir = path.join(__dirname, "..", "backend", "data", "relatorios");

function searchFile(filename, keywords) {
  const filePath = path.join(relatoriosDir, filename);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  console.log(`\n=== SEARCHING IN ${filename} ===`);
  const matches = [];
  
  function recurse(obj, parentPath = "") {
    if (!obj) return;
    if (typeof obj === "object") {
      const isArray = Array.isArray(obj);
      for (const key in obj) {
        const val = obj[key];
        const currentPath = isArray ? `${parentPath}[${key}]` : `${parentPath}.${key}`;
        if (val && typeof val === "string" && keywords.every(kw => val.toLowerCase().includes(kw))) {
          matches.push({ path: currentPath, value: val, context: obj });
        } else {
          recurse(val, currentPath);
        }
      }
    }
  }
  recurse(data);
  console.log(`Found ${matches.length} matches.`);
  if (matches.length > 0) {
    // Print unique objects
    const uniqueContexts = Array.from(new Set(matches.map(m => JSON.stringify(m.context))));
    console.log(uniqueContexts.map(c => JSON.parse(c)).slice(0, 3));
  }
}

searchFile("profor-2022-pad-rateios-dry-run.json", ["937265", "calca"]);
searchFile("profor-2022-pad-rateios-dry-run.json", ["937265", "cinto"]);
searchFile("profor-2022-pad-plano-reconstruido-dry-run.json", ["937265", "calca"]);
searchFile("profor-2022-pad-plano-reconstruido-dry-run.json", ["937265", "cinto"]);

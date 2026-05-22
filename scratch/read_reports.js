const fs = require("fs");
const path = require("path");

const relatoriosDir = path.join(__dirname, "..", "backend", "data", "relatorios");
const files = fs.readdirSync(relatoriosDir);

console.log("Searching in reports:");
for (const file of files) {
  if (file.endsWith(".json") || file.endsWith(".md")) {
    const filePath = path.join(relatoriosDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes("937265") && (content.toLowerCase().includes("calça") || content.toLowerCase().includes("cinto"))) {
      console.log(`- Match in: ${file}`);
    }
  }
}

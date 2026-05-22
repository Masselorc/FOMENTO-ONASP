const XLSX = require("xlsx");
const path = require("path");

const excelPath = path.join(__dirname, "..", "Planilhas", "gestao_financeira_ouvidoria.xlsx");
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets["MS"];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log("Sheet MS Row data (0-indexed lines, Excel lines are 1-indexed):");
for (let i = 0; i < 25; i++) {
  console.log(`Excel Line ${i + 1}:`, data[i]);
}

const fs = require("fs");
const path = require("path");

const serverJsPath = "c:/Users/marcelo.cortez/OneDrive - MINISTERIO DA JUSTIÇA/1. SENAPPEN/2. OUVIDORIA/GITHUB/FOMENTO-ONASP/FOMENTO-ONASP/backend/server.js";
const content = fs.readFileSync(serverJsPath, "utf8");
const lines = content.split("\n");

function showLines(startLine, endLine) {
  console.log(`=== LINES ${startLine} to ${endLine} ===`);
  for (let idx = startLine - 1; idx < endLine; idx++) {
    console.log(`${idx + 1}: ${lines[idx]}`);
  }
}

showLines(860, 930);

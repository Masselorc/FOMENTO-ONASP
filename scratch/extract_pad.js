const fs = require("fs");
const path = require("path");

const relatoriosDir = path.join(__dirname, "..", "backend", "data", "relatorios");

const padSaneamentoDetalhado = JSON.parse(
  fs.readFileSync(path.join(relatoriosDir, "profor-2022-pad-saneamento-detalhado.json"), "utf-8")
);

const naoAptos = padSaneamentoDetalhado.itensNaoAptosDetalhados || [];
console.log(`Total naoAptos: ${naoAptos.length}`);

const matchesNaoAptos = naoAptos.filter(
  item => item.numeroConvenio === "937265" || JSON.stringify(item).includes("937265")
);
console.log(`Matches in naoAptos: ${matchesNaoAptos.length}`);
console.log(JSON.stringify(matchesNaoAptos, null, 2));

const semAlerta = padSaneamentoDetalhado.itensSemAlertaOrigem || [];
console.log(`Total semAlerta: ${semAlerta.length}`);
const matchesSemAlerta = semAlerta.filter(
  item => item.numeroConvenio === "937265" || JSON.stringify(item).includes("937265")
);
console.log(`Matches in semAlerta: ${matchesSemAlerta.length}`);
console.log(JSON.stringify(matchesSemAlerta, null, 2));

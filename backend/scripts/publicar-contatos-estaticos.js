const fs = require("fs");
const path = require("path");

const { listarContatosPublicos } = require("../services/contatos-publication-service");

const destino = path.join(__dirname, "..", "..", "frontend", "data", "publicados", "contatos.json");
const destinoResumo = path.join(__dirname, "..", "..", "frontend", "data", "publicados", "resumo-publicacao.json");
const temporario = `${destino}.tmp`;
const temporarioResumo = `${destinoResumo}.tmp`;
const publicadoEm = new Date().toISOString();
const dados = {
  ...listarContatosPublicos(),
  publicadoEm
};
const resumoAtual = JSON.parse(fs.readFileSync(destinoResumo, "utf8"));
const arquivos = Array.from(new Set([...(resumoAtual.arquivos || []), "contatos.json"]));
const resumo = {
  ...resumoAtual,
  publicadoEm,
  arquivos,
  totais: {
    ...(resumoAtual.totais || {}),
    contatos: dados.totais
  }
};

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");
fs.writeFileSync(temporarioResumo, JSON.stringify(resumo, null, 2), "utf8");
fs.renameSync(temporario, destino);
fs.renameSync(temporarioResumo, destinoResumo);

console.log(`Contatos publicos gerados: ${dados.totais.ufs} UFs e ${dados.totais.contatosNominais} contatos nominais.`);

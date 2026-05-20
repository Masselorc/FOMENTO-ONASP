const { inicializarBanco } = require("../db/init-db");
const { rollbackLoteRateioInicial } = require("../services/profor-2022/profor-rateio-import-service");

function lerArgumento(prefixo) {
  const argumento = process.argv.find((item) => item.startsWith(`${prefixo}=`));
  if (!argumento) return null;
  return argumento.slice(prefixo.length + 1);
}

function executar() {
  inicializarBanco();

  const lote = lerArgumento("--lote");
  if (!lote) {
    throw new Error("Informe o lote com --lote=<id>.");
  }
  const motivo = lerArgumento("--motivo") || "Rollback manual do lote de importação de rateio inicial";
  const resultado = rollbackLoteRateioInicial({
    loteId: lote,
    motivo,
  });

  console.log(`Lote ${resultado.loteId} marcado como rollback.`);
  console.log(`Itens inativados: ${resultado.itensInativados}`);
  console.log(`Rateios inativados: ${resultado.rateiosInativados}`);
  console.log(`Rollback em: ${resultado.rollbackEm}`);
  console.log(`Motivo: ${resultado.motivo}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha no rollback do lote de rateio inicial:", erro?.message || erro);
  process.exit(1);
}

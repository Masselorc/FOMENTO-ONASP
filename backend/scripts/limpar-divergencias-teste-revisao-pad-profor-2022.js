/**
 * Limpa divergências controladas de teste da fila de revisão PAD x memória.
 *
 * Escopo estrito: remove somente divergências com chave_divergencia iniciada
 * por "revisao_teste:" e seus registros vinculados de decisões/logs.
 */
const repo = require("../services/profor-2022/profor-pad-revisao-repository");

async function executar() {
  const resultado = await repo.limparDivergenciasTeste();

  if (!resultado.totalDivergenciasTeste) {
    console.log("Nenhuma divergência de teste encontrada.");
    return;
  }

  console.log("Divergências de teste removidas com segurança.");
  console.log(`  divergências localizadas: ${resultado.totalDivergenciasTeste}`);
  console.log(`  decisões removidas: ${resultado.totalDecisoesRemovidas}`);
  console.log(`  logs removidos: ${resultado.totalLogsRemovidos}`);
  console.log(`  divergências removidas: ${resultado.totalDivergenciasRemovidas}`);
  console.log("  chaves:");
  resultado.chaves.forEach((chave) => console.log(`    - ${chave}`));
  console.log("Lotes de revisão preservados. Divergências reais preservadas.");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Falha ao limpar divergências de teste da revisão PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});

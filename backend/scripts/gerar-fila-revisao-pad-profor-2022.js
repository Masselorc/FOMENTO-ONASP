const path = require("node:path");

const { gerarFilaRevisao } = require("../services/profor-2022/profor-pad-revisao-service");

function imprimirLista(titulo, lista) {
  console.log(titulo);
  for (const item of lista) {
    console.log(`  ${item.chave || "(sem)"}: ${item.total}`);
  }
}

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");

  const resultado = await gerarFilaRevisao({ repoRoot });
  const { estatisticas } = resultado;

  console.log("Geração da fila de revisão PAD x memória PROFOR 2022");
  console.log(`Lote de revisão: ${resultado.loteId}`);
  console.log(`Divergências nesta geração: ${resultado.divergenciasNaGeracao}`);
  console.log(`  criadas: ${resultado.criadas}`);
  console.log(`  atualizadas (preservando status/decisões): ${resultado.atualizadas}`);
  console.log(`  não reapresentadas (mantidas no histórico): ${resultado.naoReapresentadas}`);
  console.log(`Total de divergências persistidas: ${estatisticas.total}`);
  console.log(`  pendentes: ${estatisticas.pendentes}`);
  console.log(`  impeditivas: ${estatisticas.impeditivas}`);
  console.log(`  bloqueiam publicação: ${estatisticas.bloqueiamPublicacao}`);
  console.log(`  sem decisão: ${estatisticas.semDecisao}`);
  imprimirLista("Por status:", estatisticas.porStatus);
  imprimirLista("Por nível:", estatisticas.porNivel);
  imprimirLista("Por tipo:", estatisticas.porTipo);
  imprimirLista("Por convênio:", estatisticas.porConvenio);
  console.log("Nenhuma decisão foi aplicada; nenhum dado publicado foi alterado.");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Falha ao gerar a fila de revisão PAD x memória PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});

const { inicializarBanco } = require("../db/init-db");
const { auditarFilaRevisao } = require("../services/profor-2022/profor-pad-revisao-service");

function imprimirLista(titulo, lista) {
  console.log(titulo);
  for (const item of lista) {
    console.log(`  ${item.chave || "(sem)"}: ${item.total}`);
  }
}

function executar() {
  inicializarBanco();
  const auditoria = auditarFilaRevisao();
  const { estatisticas, ultimoLote } = auditoria;

  console.log("Auditoria da fila de revisão PAD x memória PROFOR 2022");
  console.log(`Total de divergências: ${estatisticas.total}`);
  console.log(`Total pendentes: ${estatisticas.pendentes}`);
  console.log(`Total impeditivas: ${estatisticas.impeditivas}`);
  console.log(`Total que bloqueia publicação: ${estatisticas.bloqueiamPublicacao}`);
  console.log(`Divergências sem decisão: ${auditoria.divergenciasSemDecisao}`);
  console.log(`Divergências com decisão: ${auditoria.divergenciasComDecisao}`);
  imprimirLista("Por status:", estatisticas.porStatus);
  imprimirLista("Por nível:", estatisticas.porNivel);
  imprimirLista("Por tipo:", estatisticas.porTipo);
  imprimirLista("Por convênio:", estatisticas.porConvenio);

  if (ultimoLote) {
    console.log("Último lote de revisão:");
    console.log(`  id: ${ultimoLote.id}`);
    console.log(`  origem: ${ultimoLote.origem}`);
    console.log(`  status: ${ultimoLote.status}`);
    console.log(`  criado em: ${ultimoLote.criado_em}`);
    console.log(`  divergências criadas na última geração: ${auditoria.criadasUltimoLote}`);
    console.log(`  divergências reapresentadas (atualizadas): ${auditoria.reapresentadasUltimoLote}`);
    console.log(`  divergências não reapresentadas: ${auditoria.naoReapresentadasUltimoLote}`);
  } else {
    console.log("Nenhum lote de revisão registrado. Execute 'npm run profor:pad:gerar-fila-revisao'.");
  }
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao auditar a fila de revisão PAD x memória PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

const { inicializarBanco } = require("../db/init-db");
const { auditarFilaRevisao } = require("../services/profor-2022/profor-pad-revisao-service");

function imprimirLista(titulo, lista) {
  console.log(titulo);
  for (const item of lista) {
    console.log(`  ${item.chave || "(sem)"}: ${item.total}`);
  }
}

async function executar() {
  inicializarBanco();
  const auditoria = await auditarFilaRevisao();
  const { estatisticas, ultimoLote } = auditoria;

  console.log("Auditoria da fila de revisão PAD x memória PROFOR 2022");
  console.log(`Total de divergências: ${estatisticas.totalDivergencias}`);
  console.log(`Total pendentes: ${estatisticas.totalPendentes}`);
  console.log(`Total em revisão: ${estatisticas.totalEmRevisao}`);
  console.log(`Total impeditivas: ${estatisticas.totalImpeditivas}`);
  console.log(`Total que bloqueia publicação: ${estatisticas.totalBloqueiamPublicacao}`);
  console.log(`Pendentes que bloqueiam publicação: ${estatisticas.totalPendentesQueBloqueiamPublicacao}`);
  console.log(`Em revisão que bloqueiam publicação: ${estatisticas.totalEmRevisaoQueBloqueiamPublicacao}`);
  console.log(`Divergências com decisão resolutiva: ${auditoria.divergenciasComDecisaoResolutiva}`);
  console.log(`Divergências com comentário: ${auditoria.divergenciasComComentario}`);
  console.log(`Divergências sem decisão resolutiva: ${auditoria.divergenciasSemDecisaoResolutiva}`);
  console.log(`Publicação liberada: ${estatisticas.publicacaoLiberada ? "sim" : "não"}`);
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

executar().catch((erro) => {
  console.error("Falha ao auditar a fila de revisão PAD x memória PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});

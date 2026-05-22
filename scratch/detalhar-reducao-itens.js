const db = require("../backend/db/database");
const { reconstruirPlanoAplicacaoPadDryRun } = require("../backend/services/profor-2022/profor-pad-plano-reconstrucao-service");

const resultado = reconstruirPlanoAplicacaoPadDryRun();
const plano = resultado.planoAplicacaoReconstruido;
const conferencia = resultado.resumo;

console.log("Total de linhas reconstruídas:", plano.length);

// Agrupar linhas reconstruídas por itemConhecidoId
const linhasPorItem = new Map();
for (const linha of plano) {
  if (linha.itemConhecidoId) {
    if (!linhasPorItem.has(linha.itemConhecidoId)) linhasPorItem.set(linha.itemConhecidoId, []);
    linhasPorItem.get(linha.itemConhecidoId).push(linha);
  }
}

// Analisar cada item conhecido
const analiseItens = [];
for (const [itemConhecidoId, linhas] of linhasPorItem) {
  const item = db.prepare("SELECT numero_convenio, descricao_original_referencia FROM profor_2022_itens_conhecidos WHERE id = ?").get(itemConhecidoId);
  const rateiosCount = db.prepare("SELECT COUNT(*) as cnt FROM profor_2022_item_rateios WHERE item_conhecido_id = ? AND ativo = 1").get(itemConhecidoId).cnt;
  
  // Contar quantas linhas físicas do PAD apontaram para este itemConhecidoId
  const linhasOrigemDiferentes = new Set(linhas.map(l => l.linhaOrigem).filter(x => x !== null));
  const totalItensPad = linhasOrigemDiferentes.size || 1;

  const linhasTeoricasSemFiltro = totalItensPad * rateiosCount;
  const linhasReais = linhas.length;

  if (linhasReais < linhasTeoricasSemFiltro) {
    analiseItens.push({
      itemConhecidoId,
      convenio: item.numero_convenio,
      descricao: item.descricao_original_referencia,
      rateiosAtivos: rateiosCount,
      linhasFisicasPad: totalItensPad,
      linhasTeoricasDuplicadas: linhasTeoricasSemFiltro,
      linhasReaisReconstruidas: linhasReais,
      reducaoLinhas: linhasTeoricasSemFiltro - linhasReais
    });
  }
}

console.log("\nItens com redução de linhas devido ao pareamento material:");
console.log(JSON.stringify(analiseItens, null, 2));

// Vamos ver se o total de redução explica a queda de 623 para 567
const totalReducao = analiseItens.reduce((sum, x) => sum + x.reducaoLinhas, 0);
console.log(`\nRedução total de linhas identificada por este filtro: ${totalReducao}`);

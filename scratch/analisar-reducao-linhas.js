const db = require("../backend/db/database");
const { reconstruirPlanoAplicacaoPadDryRun } = require("../backend/services/profor-2022/profor-pad-plano-reconstrucao-service");

// Vamos rodar a reconstrução e observar as linhas reconstruídas
const resultado = reconstruirPlanoAplicacaoPadDryRun();
const plano = resultado.planoAplicacaoReconstruido;

console.log("Total de linhas reconstruídas:", plano.length);

// Agrupar por itemConhecidoId
const contagemPorItem = new Map();
for (const linha of plano) {
  if (linha.itemConhecidoId) {
    contagemPorItem.set(linha.itemConhecidoId, (contagemPorItem.get(linha.itemConhecidoId) || 0) + 1);
  }
}

// Vamos ver quais itens conhecidos geraram mais de uma linha no plano
const itensComMultiplasLinhas = [];
for (const [id, count] of contagemPorItem) {
  const item = db.prepare("SELECT numero_convenio, descricao_original_referencia FROM profor_2022_itens_conhecidos WHERE id = ?").get(id);
  const rateiosCount = db.prepare("SELECT COUNT(*) as cnt FROM profor_2022_item_rateios WHERE item_conhecido_id = ? AND ativo = 1").get(id).cnt;
  if (count > 0) {
    itensComMultiplasLinhas.push({
      id,
      convenio: item.numero_convenio,
      descricao: item.descricao_original_referencia,
      linhasReconstruidas: count,
      totalRateiosAtivos: rateiosCount
    });
  }
}

console.log("\nItens com linhas reconstruídas:");
console.log(JSON.stringify(itensComMultiplasLinhas.filter(x => x.totalRateiosAtivos > 1 || x.linhasReconstruidas > 1), null, 2));

// Vamos analisar especificamente o caso de Meia Militar no convênio 937265
const meiaMilitarLinhas = plano.filter(l => l.numero === '937265' && l.descricao.toLowerCase().includes('meia militar'));
console.log("\nLinhas reconstruídas para Meia Militar no convênio 937265:");
console.log(JSON.stringify(meiaMilitarLinhas.map(l => ({
  uf: l.uf,
  area: l.area,
  natureza: l.natureza,
  descricao: l.descricao,
  quantidade: l.quantidade,
  valorPrevisto: l.valorPrevisto,
  linhaOrigem: l.linhaOrigem,
  origemReconstrucao: l.origemReconstrucao
})), null, 2));

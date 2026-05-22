const db = require("../backend/db/database");

const chaves = ['937265::CALCA TATICA', '937265::CINTO TATICO'];

for (const chave of chaves) {
  console.log(`\n=== CHAVE ITEM: ${chave} ===`);
  const itens = db.prepare("SELECT * FROM profor_2022_itens_conhecidos WHERE chave_item = ?").all(chave);
  console.log("Itens Conhecidos:");
  console.log(JSON.stringify(itens, null, 2));

  if (itens.length > 0) {
    const rateios = db.prepare("SELECT * FROM profor_2022_item_rateios WHERE item_conhecido_id = ?").all(itens[0].id);
    console.log("Item Rateios:");
    console.log(JSON.stringify(rateios, null, 2));
  }
}

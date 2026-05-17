// Rotina de atualização do cache DETRU filtrado para PROFOR 2022.
// Uso: node backend/scripts/atualizar-cache-detru-profor-2022.js [caminho/para/siconv_convenio.csv.zip]
// Se nenhum argumento for fornecido, tenta download automático via DETRU_SICONV_CONVENIO_URL
// ou usa o arquivo local em Dados/detru/siconv_convenio.csv.zip.
// NÃO deve ser chamado durante o carregamento da página.

const { inicializarBanco } = require("../db/init-db");
const {
  atualizarCacheDetruProfor2022,
} = require("../services/profor-2022/profor-detru-update-service");

async function executar() {
  inicializarBanco();

  const arg = process.argv[2];
  const opcoes = arg ? { caminhoZip: arg } : {};

  if (arg) {
    console.log(`Usando arquivo informado por argumento: ${arg}`);
  }

  try {
    const resultado = await atualizarCacheDetruProfor2022(opcoes);
    console.log(`Arquivo DETRU: ${resultado.caminhoZip}`);
    console.log(`Hash do arquivo: ${resultado.arquivoHash}`);
    console.log(resultado.resultadoResumo);
    console.log(`Cache atualizado: ${resultado.totalSalvos} convênio(s) gravado(s).`);
  } catch (err) {
    console.error("Falha na atualização do cache DETRU:", err.message);
    process.exit(1);
  }
}

executar();

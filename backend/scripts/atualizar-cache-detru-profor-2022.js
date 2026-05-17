// Rotina de atualização do cache DETRU filtrado para PROFOR 2022.
// Uso: node backend/scripts/atualizar-cache-detru-profor-2022.js [caminho/para/siconv_convenio.csv.zip]
// Se nenhum argumento for fornecido, tenta download automático via DETRU_SICONV_CONVENIO_URL
// ou usa o arquivo local em Dados/detru/siconv_convenio.csv.zip.
// NÃO deve ser chamado durante o carregamento da página.

const path = require("path");
const { inicializarBanco } = require("../db/init-db");
const { cruzarCarteiraComDetru, resumirCruzamentoDetru } = require("../services/profor-2022/profor-detru-sync-service");
const {
  calcularHashArquivo,
  salvarSnapshotDetru,
  registrarAtualizacaoDetruInicio,
  registrarAtualizacaoDetruFim,
  registrarAtualizacaoDetruErro,
} = require("../services/profor-2022/profor-detru-cache-service");
const { garantirArquivoDetruAtualizado } = require("../services/profor-2022/detru-download-service");

async function resolverCaminhoZip() {
  const arg = process.argv[2];
  if (arg) {
    const caminho = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    console.log(`Usando arquivo informado por argumento: ${caminho}`);
    return caminho;
  }
  // Sem argumento: tenta download automático ou usa local configurado
  const resultado = await garantirArquivoDetruAtualizado();
  return resultado.caminho;
}

async function executar() {
  inicializarBanco();

  let caminhoZip;
  try {
    caminhoZip = await resolverCaminhoZip();
  } catch (err) {
    console.error(`Erro ao obter arquivo DETRU: ${err.message}`);
    process.exit(1);
  }

  console.log(`Arquivo DETRU: ${caminhoZip}`);

  const arquivoHash = calcularHashArquivo(caminhoZip);
  console.log(`Hash do arquivo: ${arquivoHash}`);

  const idAtualizacao = registrarAtualizacaoDetruInicio({
    caminhoArquivo: caminhoZip,
    arquivoHash,
  });

  try {
    console.log("Cruzando carteira com DETRU...");
    const resultado = cruzarCarteiraComDetru(caminhoZip);

    console.log(resumirCruzamentoDetru(resultado));

    const totalSalvos = salvarSnapshotDetru(resultado, {
      arquivoOrigem: caminhoZip,
      arquivoHash,
    });

    registrarAtualizacaoDetruFim(idAtualizacao, resultado);

    console.log(`Cache atualizado: ${totalSalvos} convênio(s) gravado(s).`);
  } catch (err) {
    registrarAtualizacaoDetruErro(idAtualizacao, err);
    console.error("Falha na atualização do cache DETRU:", err.message);
    process.exit(1);
  }
}

executar();

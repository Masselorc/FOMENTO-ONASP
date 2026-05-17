// Rotina manual de atualização do cache DETRU filtrado para PROFOR 2022.
// Uso: node backend/scripts/atualizar-cache-detru-profor-2022.js [caminho/para/siconv_convenio.csv.zip]
// Se nenhum argumento for fornecido, usa o caminho padrão: Dados/detru/siconv_convenio.csv.zip
// NÃO deve ser chamado durante o carregamento da página.

const path = require("path");
const fs = require("fs");
const { inicializarBanco } = require("../db/init-db");
const { cruzarCarteiraComDetru, resumirCruzamentoDetru } = require("../services/profor-2022/profor-detru-sync-service");
const {
  calcularHashArquivo,
  salvarSnapshotDetru,
  registrarAtualizacaoDetruInicio,
  registrarAtualizacaoDetruFim,
  registrarAtualizacaoDetruErro,
} = require("../services/profor-2022/profor-detru-cache-service");

const CAMINHO_PADRAO = path.join(__dirname, "..", "..", "Dados", "detru", "siconv_convenio.csv.zip");

function resolverCaminhoZip() {
  const arg = process.argv[2];
  if (arg) {
    return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  }
  return CAMINHO_PADRAO;
}

function executar() {
  inicializarBanco();

  const caminhoZip = resolverCaminhoZip();
  console.log(`Arquivo DETRU: ${caminhoZip}`);

  if (!fs.existsSync(caminhoZip)) {
    console.error(`Erro: arquivo não encontrado — ${caminhoZip}`);
    console.error("Forneça o caminho como argumento ou coloque o arquivo em Dados/detru/siconv_convenio.csv.zip");
    process.exit(1);
  }

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

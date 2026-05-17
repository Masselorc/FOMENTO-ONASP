const path = require("path");

const { garantirArquivoDetruAtualizado } = require("./detru-download-service");
const {
  calcularHashArquivo,
  salvarSnapshotDetru,
  registrarAtualizacaoDetruInicio,
  registrarAtualizacaoDetruFim,
  registrarAtualizacaoDetruErro,
} = require("./profor-detru-cache-service");
const {
  cruzarCarteiraComDetru,
  resumirCruzamentoDetru,
} = require("./profor-detru-sync-service");

function resolverCaminhoZip(caminhoZip) {
  if (!caminhoZip || typeof caminhoZip !== "string" || caminhoZip.trim() === "") {
    return null;
  }

  const caminhoNormalizado = caminhoZip.trim();
  return path.isAbsolute(caminhoNormalizado)
    ? caminhoNormalizado
    : path.join(process.cwd(), caminhoNormalizado);
}

async function atualizarCacheDetruProfor2022(opcoes = {}) {
  const caminhoZipInformado = resolverCaminhoZip(opcoes.caminhoZip);
  const arquivoDetru = caminhoZipInformado
    ? { caminho: caminhoZipInformado, fonte: "local" }
    : await garantirArquivoDetruAtualizado(opcoes);

  const caminhoZip = arquivoDetru.caminho;
  const arquivoHash = calcularHashArquivo(caminhoZip);
  const idAtualizacao = registrarAtualizacaoDetruInicio({
    caminhoArquivo: caminhoZip,
    arquivoHash,
  });

  try {
    const resultado = cruzarCarteiraComDetru(caminhoZip);
    const totalSalvos = salvarSnapshotDetru(resultado, {
      arquivoOrigem: caminhoZip,
      arquivoHash,
    });

    registrarAtualizacaoDetruFim(idAtualizacao, resultado);

    return {
      sucesso: true,
      idAtualizacao,
      caminhoZip,
      arquivoHash,
      totalSalvos,
      resultado,
      resultadoResumo: resumirCruzamentoDetru(resultado),
    };
  } catch (error) {
    if (idAtualizacao) {
      registrarAtualizacaoDetruErro(idAtualizacao, error);
    }

    const erro = new Error(error?.message || "Falha ao atualizar o cache DETRU.");
    erro.statusCode = error?.statusCode || 500;
    throw erro;
  }
}

module.exports = {
  atualizarCacheDetruProfor2022,
};

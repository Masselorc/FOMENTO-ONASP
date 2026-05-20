const path = require("node:path");

const {
  montarSaneamentoDetalhado,
  salvarSaneamentoDetalhado,
} = require("../services/profor-2022/profor-pad-saneamento-service");

const CAMINHO_SAIDA_JSON = "backend/data/relatorios/profor-2022-pad-saneamento-detalhado.json";
const CAMINHO_SAIDA_MD = "backend/data/relatorios/profor-2022-pad-saneamento-detalhado.md";

function imprimirResumo(relatorio) {
  const { resumo } = relatorio;
  console.log("Relatório de saneamento PAD detalhado PROFOR 2022");
  console.log(`Fonte: ${resumo.fonteSaneamento}`);
  console.log(`Saída JSON: ${CAMINHO_SAIDA_JSON}`);
  console.log(`Saída Markdown: ${CAMINHO_SAIDA_MD}`);
  console.log(`Itens conhecidos não aptos: ${resumo.totalItensNaoAptos}`);
  console.log(`Com alerta de origem identificado: ${resumo.totalItensNaoAptosComAlertaOrigem}`);
  console.log(`Sem alerta de origem identificado: ${resumo.totalItensNaoAptosSemAlertaOrigem}`);
  console.log(`Alertas impeditivos vinculados: ${resumo.totalAlertasImpeditivosVinculados}`);
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const relatorio = montarSaneamentoDetalhado({ repoRoot });

  salvarSaneamentoDetalhado(relatorio, {
    caminhoJson: path.join(repoRoot, CAMINHO_SAIDA_JSON),
    caminhoMd: path.join(repoRoot, CAMINHO_SAIDA_MD),
  });
  imprimirResumo(relatorio);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao gerar relatório de saneamento PAD detalhado PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

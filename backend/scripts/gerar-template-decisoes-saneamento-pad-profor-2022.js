const path = require("node:path");

const {
  CAMINHO_DECISOES_PADRAO,
  gerarTemplateDecisoesSaneamento,
  salvarTemplateDecisoes,
} = require("../services/profor-2022/profor-pad-saneamento-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(repoRoot, caminhoDecisoes, template, jaExistia) {
  const { metadados } = template;
  console.log("Template de decisões de saneamento PAD PROFOR 2022");
  console.log(`Arquivo: ${caminhoRelativo(repoRoot, caminhoDecisoes)}`);
  console.log(`Modo: ${jaExistia ? "merge (preservando decisões existentes)" : "geração inicial"}`);
  console.log(`Fonte: ${metadados.fonteSaneamento}`);
  console.log(
    `Fonte detalhada: ${metadados.fonteSaneamentoDetalhado || "ausente "
      + "(execute profor:pad:relatorio-saneamento-detalhado para incluir alertasOriginais)"}`
  );
  console.log(`Equivalências confirmadas: ${metadados.totais.equivalenciasConfirmadas}`);
  console.log(`Rateios novos: ${metadados.totais.rateiosNovos}`);
  console.log(`Correções de itens não aptos: ${metadados.totais.correcoesItensNaoAptos}`);
  console.log(`Ausências validadas: ${metadados.totais.ausenciasValidadas}`);
  console.log(`Substituições: ${metadados.totais.substituicoes}`);
  console.log(`Observações: ${metadados.totais.observacoes}`);
  if (metadados.entradasObsoletas.length) {
    console.log(`Entradas obsoletas preservadas em metadados: ${metadados.entradasObsoletas.length}`);
  }
  console.log("Todas as decisões geradas iniciam com status PENDENTE.");
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const fs = require("node:fs");
  const caminhoArquivo = path.join(repoRoot, CAMINHO_DECISOES_PADRAO);
  const jaExistia = fs.existsSync(caminhoArquivo);

  const { caminhoDecisoes, template } = gerarTemplateDecisoesSaneamento({ repoRoot });
  salvarTemplateDecisoes(caminhoDecisoes, template);
  imprimirResumo(repoRoot, caminhoDecisoes, template, jaExistia);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao gerar template de decisões de saneamento PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

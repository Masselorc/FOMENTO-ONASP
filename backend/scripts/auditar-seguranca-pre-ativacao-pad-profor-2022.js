/**
 * Auditoria dry-run de segurança pré-ativação PAD/PROFOR 2022 (Etapa 8.2).
 *
 * Verifica dois riscos antes de qualquer ativação/publicação:
 *  1. decisão resolutiva validando payload de divergência que mudou;
 *  2. divergência antiga que não aparece mais na geração atual da fila.
 *
 * Modo somente leitura: não escreve em tabelas, não publica, não altera a
 * origem ativa nem o planoAplicacao oficial.
 */
const path = require("node:path");

const { inicializarBanco } = require("../db/init-db");
const {
  CAMINHO_RELATORIO_SEGURANCA,
  CAMINHO_RELATORIO_SEGURANCA_MD,
  auditarSegurancaPreAtivacaoDryRun,
  salvarRelatorioSeguranca,
} = require("../services/profor-2022/profor-pad-seguranca-pre-ativacao-service");

function caminhoRelativo(repoRoot, caminhoAbsoluto) {
  return path.relative(repoRoot, caminhoAbsoluto).replace(/\\/g, "/");
}

function imprimirResumo(resultado, arquivoJson, arquivoMarkdown) {
  const { resumo } = resultado;

  console.log("Dry-run de auditoria de segurança pré-ativação PAD PROFOR 2022");
  console.log(`Saida JSON: ${arquivoJson}`);
  console.log(`Saida MD: ${arquivoMarkdown}`);
  console.log(`Decisões resolutivas auditadas: ${resumo.totalDecisoesResolutivasAuditadas}`);
  console.log(`Payload preservado: ${resumo.totalPayloadPreservado}`);
  console.log(`Payload alterado após a decisão: ${resumo.totalPayloadAlteradoAposDecisao}`);
  console.log(`Decisões sem snapshot de payload: ${resumo.totalDecisoesSemSnapshotPayload}`);
  console.log(`Decisões com divergência não encontrada: ${resumo.totalDecisoesComDivergenciaNaoEncontrada}`);
  console.log(`Divergências existentes: ${resumo.totalDivergenciasExistentes}`);
  console.log(`Divergências reapresentadas: ${resumo.totalDivergenciasReapresentadas}`);
  console.log(`Divergências não reapresentadas: ${resumo.totalDivergenciasNaoReapresentadas}`);
  console.log(`Bloqueios de ativação: ${resumo.totalBloqueiosAtivacao}`);
  console.log(`Avisos: ${resumo.totalAvisos}`);
  console.log(`Geração atual da fila disponível: ${resumo.geracaoAtualDisponivel ? "sim" : "não"}`);
  console.log(`Apto para prosseguir ativação: ${resumo.aptoParaProsseguirAtivacao ? "sim" : "não"}`);

  if (resultado.bloqueiosAtivacao.length > 0) {
    console.log("Amostra de bloqueios de ativação:");
    for (const bloqueio of resultado.bloqueiosAtivacao.slice(0, 10)) {
      console.log(`- [${bloqueio.classificacao}] ${bloqueio.origem} | ${bloqueio.motivo}`);
    }
  }
}

function executar() {
  inicializarBanco();
  const repoRoot = path.resolve(__dirname, "../..");
  const resultado = auditarSegurancaPreAtivacaoDryRun({ repoRoot });

  const caminhoJson = path.join(repoRoot, CAMINHO_RELATORIO_SEGURANCA);
  const caminhoMarkdown = path.join(repoRoot, CAMINHO_RELATORIO_SEGURANCA_MD);
  salvarRelatorioSeguranca(resultado, caminhoJson, caminhoMarkdown);

  imprimirResumo(
    resultado,
    caminhoRelativo(repoRoot, caminhoJson),
    caminhoRelativo(repoRoot, caminhoMarkdown)
  );
}

try {
  executar();
} catch (erro) {
  console.error("Falha na auditoria de segurança pré-ativação PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

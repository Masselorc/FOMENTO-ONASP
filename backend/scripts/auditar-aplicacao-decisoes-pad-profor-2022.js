/**
 * Auditoria somente leitura do motor de aplicação de decisões de revisão
 * em dry-run (Etapa 8.1).
 *
 * Lista as decisões resolutivas registradas, as decisões aplicáveis em dry-run
 * e as não aplicáveis. Não escreve em nenhuma tabela, não altera a origem ativa
 * e não publica.
 */
const { inicializarBanco } = require("../db/init-db");
const {
  carregarAplicacaoDecisoesDryRun,
} = require("../services/profor-2022/profor-pad-decisao-aplicacao-service");

function imprimirLista(titulo, lista) {
  console.log(titulo);
  if (!lista.length) {
    console.log("  (nenhuma)");
    return;
  }
  for (const item of lista) {
    const efeito = item.efeito ? item.efeito.tipo : "-";
    const detalhe = item.motivoNaoAplicavel ? ` | ${item.motivoNaoAplicavel}` : "";
    console.log(
      `  divergência ${item.divergenciaId} | ${item.tipoAlerta} | ${item.decisao} `
      + `-> ${efeito}${detalhe}`
    );
  }
}

function executar() {
  inicializarBanco();
  const aplicacao = carregarAplicacaoDecisoesDryRun();

  console.log("Auditoria de aplicação de decisões PAD x memória (dry-run) PROFOR 2022");
  console.log(`Decisões resolutivas encontradas: ${aplicacao.totalDecisoesResolutivasEncontradas}`);
  console.log(`Decisões interpretadas em dry-run: ${aplicacao.totalDecisoesInterpretadasDryRun}`);
  console.log(`  com efeito na reconstrução: ${aplicacao.totalDecisoesComEfeitoNaReconstrucao}`);
  console.log(`  sem efeito na reconstrução: ${aplicacao.totalDecisoesSemEfeitoNaReconstrucao}`);
  console.log(`Decisões não aplicáveis: ${aplicacao.totalDecisoesNaoAplicaveis}`);
  imprimirLista("Decisões aplicáveis em dry-run:", aplicacao.decisoesAplicadasDryRun);
  imprimirLista("Decisões não aplicáveis:", aplicacao.decisoesNaoAplicaveis);
  console.log("Etapa dry-run: nenhuma decisão é aplicada materialmente ao planoAplicacao.");
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao auditar a aplicação de decisões PAD x memória PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

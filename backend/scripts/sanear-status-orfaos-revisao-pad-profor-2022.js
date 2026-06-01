/**
 * Saneia divergências com status resolutivo sem decisão resolutiva auditável.
 *
 * Escopo: reverte o status para PENDENTE e registra log. Não cria decisão,
 * não apaga divergências reais e ignora chaves de teste "revisao_teste:".
 */
const repo = require("../services/profor-2022/profor-pad-revisao-repository");

function imprimirOrfaos(orfaos) {
  for (const item of orfaos) {
    console.log(`  - id=${item.id} status=${item.status} convenio=${item.numero_convenio || "-"} uf=${item.uf || "-"} chave=${item.chave_divergencia}`);
  }
}

function exigirConfirmacaoSaneamentoProfor2022(nomeScript) {
  if (process.env.CONFIRMAR_SANEAMENTO_PROFOR_2022 === "SIM") return;
  throw new Error(
    `${nomeScript} executa saneamento com escrita real e exige CONFIRMAR_SANEAMENTO_PROFOR_2022=SIM. ` +
    "Execução bloqueada por segurança."
  );
}

async function executar() {
  const dryRun = process.argv.includes("--dry-run") || process.env.npm_config_dry_run === "true";

  if (dryRun) {
    console.log("Modo dry-run: conferência sem escrita.");
    const orfaos = await repo.listarStatusResolutivosOrfaos();
    if (!orfaos.length) {
      console.log("Nenhum status resolutivo órfão encontrado.");
      return;
    }
    console.log(`Status resolutivos órfãos encontrados: ${orfaos.length}`);
    imprimirOrfaos(orfaos);
    console.log("Dry-run: nenhum dado foi alterado.");
    return;
  }

  exigirConfirmacaoSaneamentoProfor2022("sanear-status-orfaos-revisao-pad-profor-2022");
  const resultado = await repo.sanearStatusResolutivosOrfaos();
  if (!resultado.totalEncontrados) {
    console.log("Nenhum status resolutivo órfão encontrado.");
    return;
  }

  console.log(`Status resolutivos órfãos encontrados: ${resultado.totalEncontrados}`);
  console.log(`Status resolutivos órfãos saneados: ${resultado.totalSaneados}`);
  imprimirOrfaos(resultado.divergencias);
  console.log("Status revertidos para PENDENTE com log de auditoria. Nenhuma decisão foi criada ou aplicada ao planoAplicacao.");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Falha ao sanear status órfãos da revisão PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});

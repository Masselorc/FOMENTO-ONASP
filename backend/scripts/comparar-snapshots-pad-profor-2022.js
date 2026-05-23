const path = require("node:path");
const fs = require("node:fs");

const {
  reconstruirPlanoAplicacaoPadDryRun,
} = require("../services/profor-2022/profor-pad-plano-reconstrucao-service");

const {
  gerarFotografiaCanonica,
  salvarFotografia,
} = require("../services/profor-2022/profor-pad-fotografia-service");

const {
  compararSnapshotsPad,
  salvarRelatorioComparacaoSnapshots,
} = require("../services/profor-2022/profor-pad-comparador-snapshots-service");

// Caminhos padrão
const CAMINHO_SNAPSHOT_NOVO = path.join(
  __dirname,
  "../data/relatorios/profor-2022-pad-fotografia-canonica.json"
);
const CAMINHO_SNAPSHOT_ANTERIOR = path.join(
  __dirname,
  "../data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json"
);
const CAMINHO_RELATORIO_JSON = path.join(
  __dirname,
  "../data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.json"
);
const CAMINHO_RELATORIO_MD = path.join(
  __dirname,
  "../data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.md"
);

function main() {
  console.log("=== Evolução PAD/PROFOR 2022: Comparador de Snapshots (Dry-Run) ===");

  try {
    // 1. Executar a reconstrução do plano de aplicação atual
    console.log("Executando reconstrução do plano de aplicação atual a partir dos relatórios PAD...");
    const resultadoReconstrucao = reconstruirPlanoAplicacaoPadDryRun();

    if (!resultadoReconstrucao || !resultadoReconstrucao.planoAplicacaoReconstruido) {
      throw new Error("Falha ao reconstruir o plano de aplicação: dados vazios.");
    }

    console.log(`Reconstrução concluída. Total de linhas: ${resultadoReconstrucao.planoAplicacaoReconstruido.length}`);

    // 2. Gerar fotografia canônica atual
    console.log("Gerando fotografia canônica atual...");
    const snapshotAtual = gerarFotografiaCanonica(resultadoReconstrucao.planoAplicacaoReconstruido);

    console.log(`Fotografia canônica gerada.`);
    console.log(`- Checksum: ${snapshotAtual.checksum}`);
    console.log(`- Valor Previsto Total: R$ ${snapshotAtual.resumo.valorPrevistoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);

    // 3. Persistir a fotografia canônica atual
    console.log(`Salvando snapshot atual em: ${CAMINHO_SNAPSHOT_NOVO}`);
    salvarFotografia(CAMINHO_SNAPSHOT_NOVO, snapshotAtual);
    console.log("Snapshot atual salvo com sucesso.");

    // 4. Verificar se existe o snapshot anterior para comparação
    if (fs.existsSync(CAMINHO_SNAPSHOT_ANTERIOR)) {
      console.log(`Snapshot anterior encontrado em: ${CAMINHO_SNAPSHOT_ANTERIOR}`);
      console.log("Comparando snapshot anterior com o novo...");

      const resultadoComparacao = compararSnapshotsPad(CAMINHO_SNAPSHOT_ANTERIOR, snapshotAtual);

      console.log("Comparação de snapshots concluída com sucesso.");
      console.log("--- Resumo das Alterações ---");
      console.log(`- Itens Idênticos: ${resultadoComparacao.resumo.totalIguais}`);
      console.log(`- Itens Novos (Adicionados): ${resultadoComparacao.resumo.totalNovos}`);
      console.log(`- Itens Ausentes (Removidos): ${resultadoComparacao.resumo.totalAusentes}`);
      console.log(`- Itens Alterados: ${resultadoComparacao.resumo.totalAlterados}`);
      console.log("-----------------------------");
      console.log("Diferenças Financeiras Líquidas Agregadas (Novo - Anterior):");
      console.log(`- Previsto: R$ ${resultadoComparacao.diferencasAgregadas.valorPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      console.log(`- Executado: R$ ${resultadoComparacao.diferencasAgregadas.valorExecutado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      console.log(`- Saldo: R$ ${resultadoComparacao.diferencasAgregadas.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      console.log(`- Linhas: ${resultadoComparacao.diferencasAgregadas.linhas}`);

      // 5. Salvar os relatórios de comparação
      console.log(`Salvando relatórios de comparação...`);
      console.log(`- JSON: ${CAMINHO_RELATORIO_JSON}`);
      console.log(`- Markdown: ${CAMINHO_RELATORIO_MD}`);
      salvarRelatorioComparacaoSnapshots(resultadoComparacao, CAMINHO_RELATORIO_JSON, CAMINHO_RELATORIO_MD);
      console.log("Relatórios de comparação salvos com sucesso.");
    } else {
      console.log("\n[Aviso] Snapshot anterior não encontrado.");
      console.log(`Caminho esperado: ${CAMINHO_SNAPSHOT_ANTERIOR}`);
      console.log("Para realizar comparações de evolução do PAD:");
      console.log(`1. Copie o snapshot gerado para: ${CAMINHO_SNAPSHOT_ANTERIOR}`);
      console.log("2. Faça alterações em planilhas/rateios");
      console.log("3. Rode este script novamente para obter o comparativo.");
    }

    console.log("\n=== Execução Dry-Run Concluída com Sucesso ===");
  } catch (error) {
    console.error("\n[Erro Crítico] Falha na execução do comparador de snapshots:");
    console.error(error.stack || error.message || error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

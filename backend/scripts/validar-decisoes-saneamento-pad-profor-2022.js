const path = require("node:path");

const {
  validarDecisoesSaneamento,
  salvarRelatorioValidacao,
} = require("../services/profor-2022/profor-pad-decisoes-saneamento-service");

const CAMINHO_SAIDA = "backend/data/relatorios/profor-2022-pad-validacao-decisoes.json";

function imprimirResumo(relatorio, caminhoSaida) {
  const { resumo, erros, avisos, pendentes } = relatorio;
  console.log("Validação do arquivo de decisões de saneamento PAD PROFOR 2022");
  console.log(`Fonte: ${resumo.fonteDecisoes}`);
  console.log(`Relatório PAD: ${resumo.fonteRelatorioPad || "ausente"}`);
  console.log(`Saída JSON: ${caminhoSaida}`);
  console.log(`Erros: ${resumo.totalErros}`);
  console.log(`Avisos: ${resumo.totalAvisos}`);
  console.log(`Decisões pendentes: ${resumo.totalPendentes}`);
  console.log(`Arquivo válido: ${resumo.arquivoValido ? "sim" : "não"}`);
  console.log(`Aplicável ao banco: ${resumo.aplicavel ? "sim" : "não"}`);

  if (erros.length) {
    console.log("\nErros (impedem aplicação e invalidam o arquivo):");
    for (const erro of erros.slice(0, 30)) {
      console.log(`- [${erro.secao}] ${erro.id || "-"} | ${erro.codigo}: ${erro.mensagem}`);
    }
    if (erros.length > 30) console.log(`  ... e mais ${erros.length - 30} erro(s).`);
  }
  if (avisos.length) {
    console.log("\nAvisos:");
    for (const aviso of avisos) {
      console.log(`- [${aviso.secao}] ${aviso.codigo}: ${aviso.mensagem}`);
    }
  }
  if (resumo.totalPendentes > 0) {
    console.log(
      `\nO arquivo possui ${resumo.totalPendentes} decisão(ões) PENDENTE(s). ` +
      "Decisões pendentes não invalidam o arquivo, mas impedem a aplicação ao banco (Etapa E)."
    );
  }
  if (resumo.aplicavel) {
    console.log("\nArquivo pronto para aplicação: sem erros e sem decisões pendentes.");
  }
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const relatorio = validarDecisoesSaneamento({ repoRoot });

  salvarRelatorioValidacao(relatorio, path.join(repoRoot, CAMINHO_SAIDA));
  imprimirResumo(relatorio, CAMINHO_SAIDA);

  // Erros invalidam o arquivo (exit 1). Pendências NÃO causam falha.
  if (relatorio.resumo.totalErros > 0) {
    process.exit(1);
  }
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao validar decisões de saneamento PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

const fs = require("node:fs");
const path = require("node:path");
const { registrarDecisao } = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const repo = require("../services/profor-2022/profor-pad-revisao-repository");

const CAMINHO_DRY_RUN_JSON = "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.json";

// Status que já têm decisão resolutiva — não devem receber nova decisão.
const STATUS_RESOLUTIVOS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"]);

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const dryRunCaminho = path.join(repoRoot, CAMINHO_DRY_RUN_JSON);

  // Se não existir, avisa e pede para rodar a auditoria
  if (!fs.existsSync(dryRunCaminho)) {
    console.error(`Erro: Relatório dry-run não encontrado em ${dryRunCaminho}`);
    console.error("Execute 'npm run profor:pad:diacritico:auditar-pendencias' primeiro.");
    process.exit(1);
  }

  const dryRun = JSON.parse(fs.readFileSync(dryRunCaminho, "utf8"));
  const { idsSaneaveis, analisados } = dryRun;

  if (!Array.isArray(idsSaneaveis) || idsSaneaveis.length === 0) {
    console.log("Nenhum item saneável encontrado para registrar decisão.");
    return;
  }

  console.log(`Iniciando saneamento automático para os IDs: [${idsSaneaveis.join(", ")}]`);

  const justificativa = "Divergência saneada automaticamente: a diferença entre memória e PAD é exclusivamente de acentuação/diacrítico, com mesmo convênio, natureza e dados materiais compatíveis dentro da tolerância definida. Não há ausência real nem alteração material do item.";
  const payloadDecisao = {
    origem: "saneamento-automatico-diacritico",
    tipoSaneamento: "diacritico_sem_divergencia_material",
    criterios: {
      descricaoDiferencaApenasDiacritico: true,
      convenioCompativel: true,
      naturezaCompativel: true,
      dadosMateriaisCompativeis: true
    },
    aplicadaAoPlano: false
  };

  let totalSaneados = 0;
  let totalIgnorados = 0;
  for (const id of idsSaneaveis) {
    const item = analisados.find((x) => x.id === id);
    if (!item) {
      console.warn(`Aviso: ID ${id} listado como saneável mas não encontrado no detalhamento.`);
      continue;
    }

    // Proteção defensiva: nunca registra decisão sobre divergência que já
    // tenha decisão resolutiva (evita decisão duplicada se a fila mudou
    // entre a auditoria e o saneamento).
    const linhaAtual = await repo.buscarDivergenciaPorId(id);
    if (!linhaAtual) {
      console.warn(`Aviso: ID #${id} não encontrado na base; ignorado.`);
      totalIgnorados++;
      continue;
    }
    if (STATUS_RESOLUTIVOS.has(linhaAtual.status)) {
      console.log(`  ID #${id} já possui status resolutivo (${linhaAtual.status}); nenhuma decisão registrada.`);
      totalIgnorados++;
      continue;
    }

    try {
      console.log(`Aplicando decisão CORRIGIDO para ID #${id} (${item.chaveDivergencia})...`);
      const resultado = await registrarDecisao(id, {
        decisao: "CORRIGIDO",
        justificativa,
        usuario: "sistema-saneamento-diacritico",
        payloadDecisao,
      });
      console.log(`  Sucesso. Status anterior: ${resultado.statusAnterior} -> Novo: ${resultado.statusNovo}`);
      totalSaneados++;
    } catch (erro) {
      console.error(`  Erro ao sanear ID #${id}:`, erro?.message || erro);
    }
  }

  console.log(`Processo finalizado. Total saneados: ${totalSaneados}; ignorados (já decididos/ausentes): ${totalIgnorados}; de ${idsSaneaveis.length} candidatos.`);
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Erro no saneamento de diacríticos:", erro);
  process.exit(1);
});

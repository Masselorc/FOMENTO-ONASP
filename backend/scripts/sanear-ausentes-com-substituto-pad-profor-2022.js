/**
 * Saneamento assistido de itens ausentes com substituto comprovado no PAD —
 * PROFOR 2022.
 *
 * Reaproveita o relatório dry-run da auditoria e registra decisão resolutiva
 * APENAS para os casos classificados como `substituto_compativel`. Usa o
 * serviço existente `registrarDecisao` (sem SQL direto). Não confirma ausência:
 * a decisão registra o VÍNCULO com o item substituto.
 *
 * NÃO publica, NÃO altera origem ativa, NÃO toca o planoAplicacao oficial.
 *
 * Comando: npm run profor:pad:ausentes:sanear-substitutos
 */

const fs = require("node:fs");
const path = require("node:path");
const { registrarDecisao } = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const repo = require("../services/profor-2022/profor-pad-revisao-repository");
const { inicializarBanco } = require("../db/init-db");
const { exigirConfirmacaoAuditoriaSqliteLegado } = require("./_guard-sqlite-legado");

const CAMINHO_DRY_RUN_JSON = "backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.json";

// Status que já têm decisão resolutiva — não recebem nova decisão.
const STATUS_RESOLUTIVOS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"]);

const JUSTIFICATIVA = "Divergência de ausência saneada por vínculo com item substituto no PAD. "
  + "O item antigo não está ausente materialmente: foi reapresentado no PAD com alteração de "
  + "descrição/especificação, mantendo convênio, natureza, quantidade, valor unitário, valor "
  + "previsto, valor executado e saldo compatíveis. Vinculado a item novo já tratado na revisão.";

async function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const dryRunCaminho = path.join(repoRoot, CAMINHO_DRY_RUN_JSON);

  exigirConfirmacaoAuditoriaSqliteLegado("sanear-ausentes-com-substituto-pad-profor-2022");

  inicializarBanco();

  if (!fs.existsSync(dryRunCaminho)) {
    console.error(`Erro: relatório dry-run não encontrado em ${dryRunCaminho}`);
    console.error("Execute 'npm run profor:pad:ausentes:auditar-substitutos' primeiro.");
    process.exit(1);
  }

  const dryRun = JSON.parse(fs.readFileSync(dryRunCaminho, "utf8"));
  const vinculos = Array.isArray(dryRun.vinculosSugeridos) ? dryRun.vinculosSugeridos : [];

  if (!vinculos.length) {
    console.log("Nenhum vínculo de substituto compatível encontrado para sanear.");
    return;
  }

  console.log(`Iniciando saneamento de ${vinculos.length} vínculo(s) ausente -> substituto.`);

  let totalSaneados = 0;
  let totalIgnorados = 0;
  for (const vinculo of vinculos) {
    const ausenteId = Number(vinculo.divergenciaAusenteId);
    const substitutaId = Number(vinculo.divergenciaSubstitutaId);

    const linhaAusente = await repo.buscarDivergenciaPorId(ausenteId);
    if (!linhaAusente) {
      console.warn(`Aviso: divergência ausente #${ausenteId} não encontrada; ignorada.`);
      totalIgnorados++;
      continue;
    }
    // Proteção: nunca registra decisão sobre divergência já resolutiva.
    if (STATUS_RESOLUTIVOS.has(linhaAusente.status)) {
      console.log(`  #${ausenteId} já possui status resolutivo (${linhaAusente.status}); nenhuma decisão registrada.`);
      totalIgnorados++;
      continue;
    }

    const payloadDecisao = {
      origem: "saneamento-ausente-com-substituto",
      tipoSaneamento: "vinculo_item_substituto",
      divergenciaAusenteId: ausenteId,
      divergenciaSubstitutaId: substitutaId,
      descricaoMemoria: vinculo.descricaoMemoria,
      descricaoPadSubstituta: vinculo.descricaoPadSubstituta,
      criterios: {
        mesmoConvenio: true,
        naturezaCompativel: true,
        quantidadeCompativel: true,
        valorUnitarioCompativel: true,
        valorPrevistoCompativel: true,
        valorExecutadoCompativel: true,
        saldoCompativel: true,
        decisaoSubstitutaJaAceita: vinculo.decisaoSubstitutaJaAceita === true,
      },
      aplicadaAoPlano: false,
    };

    try {
      console.log(`Vinculando #${ausenteId} -> #${substitutaId} (decisão CORRIGIDO)...`);
      const resultado = await registrarDecisao(ausenteId, {
        decisao: "CORRIGIDO",
        justificativa: `${JUSTIFICATIVA} Vinculado à divergência #${substitutaId}.`,
        usuario: "sistema-saneamento-substituto-pad",
        payloadDecisao,
      });
      console.log(`  Sucesso. Status: ${resultado.statusAnterior} -> ${resultado.statusNovo}.`);
      totalSaneados++;
    } catch (erro) {
      console.error(`  Erro ao sanear #${ausenteId}:`, erro?.message || erro);
    }
  }

  console.log(`Processo finalizado. Vínculos saneados: ${totalSaneados}; ignorados (já decididos/ausentes): ${totalIgnorados}; de ${vinculos.length} candidatos.`);
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Erro no saneamento de ausentes com substituto:", erro);
  process.exit(1);
});

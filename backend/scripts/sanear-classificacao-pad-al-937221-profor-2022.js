/**
 * Saneamento assistido da classificação do PAD — convênio 937221 / AL,
 * PROFOR 2022.
 *
 * A classificação de área (OUVIDORIA / CORREGEDORIA / ESCOLA) e a confirmação
 * de ausência abaixo são CURADORIA HUMANA a partir do documento oficial
 * `ExtratoProposta.pdf` (Plano de Aplicação Detalhado do convênio 937221).
 * Não é inferência automática: cada item novo foi conferido item a item no
 * extrato, e os itens ausentes confirmados por NÃO constarem do PAD novo.
 *
 * Para cada divergência (identificada pela chave_item, estável):
 *  - item_novo_sem_rateio: registra decisão ACEITO com payloadDecisao.rateio
 *    por área (percentualQuantidade), no formato que o backend valida.
 *  - item_ausente_no_pad sem substituto: registra decisão ACEITO confirmando
 *    a ausência (item da memória antiga não reapresentado no PAD).
 *
 * Usa o serviço existente `registrarDecisao` (sem SQL direto). Não publica,
 * não altera origem ativa nem o planoAplicacao oficial. Idempotente: ignora
 * divergências que já tenham decisão resolutiva.
 *
 * Suporta `--dry-run` (apenas lista o que seria feito, sem registrar).
 *
 * Comando: npm run profor:pad:al-937221:sanear-classificacao
 */

const { registrarDecisao } = require("../services/profor-2022/profor-pad-revisao-decisao-service");
const repo = require("../services/profor-2022/profor-pad-revisao-repository");
const { query } = require("../db/postgres-client");

// Normaliza payload_json (jsonb no Postgres vem como objeto) para string, de modo
// que o consumo a seguir (JSON.parse(linha.payload_json || "{}")) permaneça válido.
function normalizarLinhaSaneamento(linha) {
  return {
    ...linha,
    // bigint no Postgres chega como string; o restante do script compara o id
    // em Set numérico e o passa a registrarDecisao — manter Number preserva o
    // comportamento anterior (SQLite retornava INTEGER como number).
    id: Number(linha.id),
    payload_json: typeof linha.payload_json === "string"
      ? linha.payload_json
      : JSON.stringify(linha.payload_json ?? {}),
  };
}

const CONVENIO = "937221";
const USUARIO = "sistema-saneamento-pad-al-937221";
const STATUS_RESOLUTIVOS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "APLICADO", "REVERTIDO"]);
const DRY_RUN = process.argv.includes("--dry-run") || process.env.npm_config_dry_run === "true";

/**
 * Classificação por área dos itens NOVOS do PAD 937221 (item_novo_sem_rateio).
 * Fonte: ExtratoProposta.pdf — seção 9 (Plano de Aplicação Detalhado).
 * `area` única => rateio 100% para a área. Saldo Residual/Remanescente foi
 * removido deste saneamento: a regra atual exige item técnico não
 * setorializado e segregado por natureza, sem rateio entre áreas operacionais.
 */
const ITENS_NOVOS = [
  { chave: "937221::EQUIPAMENTOS DE REDE (SWITCHES E ROTEADO", area: "OUVIDORIA" },
  { chave: "937221::FORNO DE MICRO-ONDAS A PARTIR DE- 32 LIT", area: "ESCOLA" },
  { chave: "937221::FORNO DE MICROONDAS - 20L - (OUVIDORIA)", area: "OUVIDORIA" },
  { chave: "937221::FRAGMENTADORA E PAPEL - CORREGEDORIA", area: "CORREGEDORIA" },
  { chave: "937221::FRIGOBAR 45L INVERTER BIVOLT (OUVIDORIA)", area: "OUVIDORIA" },
  { chave: "937221::IMPRESSORA MULTIFUNCIONAL (OUVIDORIA)", area: "OUVIDORIA" },
  { chave: "937221::KIT COM 2 POLTRONAS (CORREGEDORIA).", area: "CORREGEDORIA" },
  { chave: "937221::NOBREAK 1200 BIVOLT(OUVIDORIA)", area: "OUVIDORIA" },
  { chave: "937221::NOTEBOOK I7 16 GB, 1 TB SSD, WINDOWS 11", area: "OUVIDORIA" },
  { chave: "937221::QUADRO LOUSA BRANCA", area: "ESCOLA" },
  { chave: "937221::REFRIGERADOR FRIGOBAR, COM CAPACIDADE NO", area: "ESCOLA" },
  { chave: "937221::TELEVISAO SMART LED, MINIMO DE 50 POLEGA", area: "OUVIDORIA" },
  { chave: "937221::TELEVISAO SMART LED, MINIMO DE 50 POLEGADAS", area: "CORREGEDORIA" },
];

const AREAS_TRES = ["OUVIDORIA", "CORREGEDORIA", "ESCOLA"];

/** Monta o payloadDecisao.rateio para um item novo. */
function montarRateioItemNovo(item, payloadDivergencia) {
  const natureza = payloadDivergencia.naturezaPad || payloadDivergencia.natureza || "CAPITAL";
  const quantidadeTotal = Number(payloadDivergencia.quantidadePad);

  if (item.rateioIgual) {
    throw new Error("Rateio igual entre areas foi desabilitado para Saldo Residual/Remanescente.");
  }
  // Área única: 100% para a área indicada no PDF.
  return [{
    area: item.area,
    natureza,
    quantidade: Number.isFinite(quantidadeTotal) ? quantidadeTotal : null,
    percentualQuantidade: 100,
  }];
}

async function executar() {
  // 1) Itens novos do PAD: classificação por área a partir do PDF.
  const resNovas = await query(
    `SELECT id, chave_item, tipo_alerta, status, payload_json
     FROM profor_2022_revisao_divergencias
     WHERE numero_convenio = $1 AND tipo_alerta = 'item_novo_sem_rateio'`,
    [CONVENIO]
  );
  const linhasNovas = resNovas.rows.map(normalizarLinhaSaneamento);
  const mapaNovas = new Map(linhasNovas.map((l) => [l.chave_item, l]));

  // 2) Itens ausentes sem substituto: confirmados como realmente ausentes.
  //    A lista de "possível substituto com divergência" vem da auditoria de
  //    substitutos; esses NÃO são saneados aqui (exigem revisão humana).
  const resAusentes = await query(
    `SELECT id, chave_item, tipo_alerta, status, payload_json
     FROM profor_2022_revisao_divergencias
     WHERE numero_convenio = $1 AND tipo_alerta = 'item_ausente_no_pad'`,
    [CONVENIO]
  );
  const linhasAusentes = resAusentes.rows.map(normalizarLinhaSaneamento);

  let substitutosComDivergencia = new Set();
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const rel = path.resolve(__dirname, "../../backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.json");
    if (fs.existsSync(rel)) {
      const dryRun = JSON.parse(fs.readFileSync(rel, "utf8"));
      (dryRun.analisados || [])
        .filter((a) => a.numeroConvenio === CONVENIO && a.classificacao === "possivel_substituto_com_divergencia")
        .forEach((a) => substitutosComDivergencia.add(a.id));
    }
  } catch (_) { /* sem relatório: trata todas as ausentes como reais */ }

  const resultado = { rateioOk: 0, rateioIgnorado: 0, ausenciaOk: 0, ausenciaIgnorada: 0, erros: 0 };

  console.log(`Saneamento PAD AL convênio ${CONVENIO}${DRY_RUN ? " (DRY-RUN)" : ""}.`);
  console.log("Fonte da classificação: ExtratoProposta.pdf (Plano de Aplicação Detalhado).\n");

  // --- Itens novos: rateio por área ---
  console.log("Itens novos (classificação por área):");
  for (const item of ITENS_NOVOS) {
    const linha = mapaNovas.get(item.chave);
    if (!linha) {
      console.warn(`  AVISO: item novo não encontrado na fila: ${item.chave}`);
      resultado.rateioIgnorado++;
      continue;
    }
    if (STATUS_RESOLUTIVOS.has(linha.status)) {
      console.log(`  #${linha.id} já decidido (${linha.status}); ignorado.`);
      resultado.rateioIgnorado++;
      continue;
    }
    const payloadDivergencia = JSON.parse(linha.payload_json || "{}");
    const rateio = montarRateioItemNovo(item, payloadDivergencia);
    const areasTexto = rateio.map((r) => `${r.area} ${r.percentualQuantidade}%`).join(", ");
    const justificativa = `Item classificado a partir do Plano de Aplicação Detalhado do PAD (ExtratoProposta.pdf): aquisição destinada à área ${item.area}, conforme descrição/observação do extrato.`;

    if (DRY_RUN) {
      console.log(`  #${linha.id} -> ACEITO | rateio: ${areasTexto}`);
      resultado.rateioOk++;
      continue;
    }
    try {
      const r = await registrarDecisao(linha.id, {
        decisao: "ACEITO",
        justificativa,
        usuario: USUARIO,
        payloadDecisao: {
          origem: "saneamento-pad-al-937221",
          tipoSaneamento: "rateio_manual",
          fonteClassificacao: "ExtratoProposta.pdf",
          rateio,
        },
      });
      console.log(`  #${linha.id} -> ACEITO | rateio: ${areasTexto} | ${r.statusAnterior} -> ${r.statusNovo}`);
      resultado.rateioOk++;
    } catch (erro) {
      console.error(`  ERRO #${linha.id}:`, erro?.message || erro);
      resultado.erros++;
    }
  }

  // --- Itens ausentes sem substituto: confirma ausência ---
  console.log("\nItens ausentes sem substituto (ausência confirmada):");
  for (const linha of linhasAusentes) {
    if (STATUS_RESOLUTIVOS.has(linha.status)) {
      console.log(`  #${linha.id} já decidido (${linha.status}); ignorado.`);
      resultado.ausenciaIgnorada++;
      continue;
    }
    if (substitutosComDivergencia.has(linha.id)) {
      console.log(`  #${linha.id} possui possível substituto com divergência; mantido PENDENTE para revisão humana.`);
      resultado.ausenciaIgnorada++;
      continue;
    }
    const payloadDivergencia = JSON.parse(linha.payload_json || "{}");
    const justificativa = "Ausência confirmada a partir do Plano de Aplicação Detalhado do PAD "
      + "(ExtratoProposta.pdf): o item da memória antiga não consta do PAD atual do convênio, "
      + "tendo sido substituído por outros itens na nova proposta. Não há correspondência material no PAD.";

    if (DRY_RUN) {
      console.log(`  #${linha.id} -> ACEITO (ausência confirmada) | ${(payloadDivergencia.descricaoMemoria || "").slice(0, 45)}`);
      resultado.ausenciaOk++;
      continue;
    }
    try {
      const r = await registrarDecisao(linha.id, {
        decisao: "ACEITO",
        justificativa,
        usuario: USUARIO,
        payloadDecisao: {
          origem: "saneamento-pad-al-937221",
          tipoSaneamento: "ausencia_confirmada",
          fonteClassificacao: "ExtratoProposta.pdf",
          ausenciaConfirmada: true,
          motivo: "item da memória antiga não reapresentado no PAD; substituído por outros itens.",
        },
      });
      console.log(`  #${linha.id} -> ACEITO (ausência confirmada) | ${r.statusAnterior} -> ${r.statusNovo}`);
      resultado.ausenciaOk++;
    } catch (erro) {
      console.error(`  ERRO #${linha.id}:`, erro?.message || erro);
      resultado.erros++;
    }
  }

  console.log("\nResumo:");
  console.log(`  Itens novos classificados por área: ${resultado.rateioOk} (ignorados: ${resultado.rateioIgnorado})`);
  console.log(`  Itens ausentes confirmados: ${resultado.ausenciaOk} (ignorados: ${resultado.ausenciaIgnorada})`);
  console.log(`  Erros: ${resultado.erros}`);
  if (DRY_RUN) console.log("  (DRY-RUN: nenhuma decisão foi registrada.)");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Erro no saneamento PAD AL 937221:", erro);
  process.exit(1);
});

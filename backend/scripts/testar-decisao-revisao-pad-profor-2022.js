/**
 * Teste manual da camada de decisão da revisão assistida (Etapa 5.4).
 *
 * Usa uma divergência CONTROLADA de teste (chave fixa 'revisao_teste:...'),
 * de modo a NÃO contaminar as divergências reais da fila. A divergência de
 * teste é idempotente: o upsert por chave_divergencia a reaproveita entre
 * execuções. Nenhuma decisão é aplicada ao planoAplicacao.
 */
const { inicializarBanco } = require("../db/init-db");
const repo = require("../services/profor-2022/profor-pad-revisao-repository");
const decisaoService = require("../services/profor-2022/profor-pad-revisao-decisao-service");

const CHAVE_TESTE = "revisao_teste:divergencia-controlada";

async function executar() {
  inicializarBanco();

  // 1. Garante uma divergência de teste num lote próprio de teste.
  const loteId = repo.criarLoteRevisao({
    origem: "teste-manual-decisao",
    arquivoOrigem: null,
    hashOrigem: null,
  });
  const upsert = repo.inserirOuAtualizarDivergencia(loteId, {
    chaveDivergencia: CHAVE_TESTE,
    numeroConvenio: "000000",
    uf: "ZZ",
    chaveItem: "000000::ITEM DE TESTE",
    tipoAlerta: "valor_diferente",
    nivel: "aviso",
    campoAfetado: "valorPrevisto",
    valorAnterior: "10.98",
    valorNovo: "10.99",
    fonteAnterior: "memoria",
    fonteNova: "pad",
    diferenca: "0.01",
    motivoProvavel: "Divergência controlada para teste da camada de decisão.",
    acaoSugerida: "Registrar decisão de teste.",
    impactoReconstrucao: "Nenhum — divergência de teste.",
    bloqueiaPublicacao: false,
    payload: { antes: { valorPrevisto: 10.98 }, depois: { valorPrevisto: 10.99 } },
  });
  console.log(`Divergência de teste ${upsert.acao} (id ${upsert.id}, lote ${loteId}).`);

  const antes = repo.buscarDivergenciaPorId(upsert.id);
  console.log(`Status antes da decisão: ${antes.status}`);

  // 2. Registra uma decisão EM_REVISAO (justificativa recomendada, não obrigatória).
  const resultado = decisaoService.registrarDecisao(upsert.id, {
    decisao: "EM_REVISAO",
    justificativa: "Teste automatizado da Etapa 5.4 — colocando em revisão.",
    usuario: "script-teste",
  });
  console.log(`Decisão registrada: ${resultado.decisao} `
    + `(${resultado.statusAnterior} -> ${resultado.statusNovo}), `
    + `aplicadaAoPlano=${resultado.aplicadaAoPlano}.`);

  // 3. Confere decisão e log gravados.
  const detalhe = await decisaoService.obterDivergencia(upsert.id);
  const ultimaDecisao = detalhe.decisoes[0];
  const ultimoLog = detalhe.logs[0];
  console.log(`Decisões registradas para a divergência: ${detalhe.decisoes.length}.`);
  console.log(`  última decisão: ${ultimaDecisao.decisao} por ${ultimaDecisao.usuario}.`);
  console.log(`Logs registrados para a divergência: ${detalhe.logs.length}.`);
  console.log(`  último log: ${ultimoLog.evento} | anterior=${JSON.stringify(ultimoLog.estadoAnterior)} `
    + `| novo=${JSON.stringify(ultimoLog.estadoNovo)}.`);

  const ok = detalhe.status === "EM_REVISAO"
    && detalhe.decisoes.length >= 1
    && ultimoLog.evento === "decisao_registrada"
    && resultado.aplicadaAoPlano === false;
  console.log(ok
    ? "Teste OK: decisão e log gravados; nenhuma decisão aplicada ao planoAplicacao."
    : "Teste FALHOU: verifique a gravação de decisão/log.");
  if (!ok) process.exit(1);

  console.log("Observação: a divergência de teste (chave 'revisao_teste:...') "
    + "não pertence à fila real de 145 divergências.");
}

async function main() {
  await executar();
}

main().catch((erro) => {
  console.error("Falha no teste de decisão da revisão assistida PAD PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
});

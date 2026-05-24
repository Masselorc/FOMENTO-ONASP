// Rotina operacional LEGADA: atualização consolidada PROFOR 2022.
// Executa DETRU → rendimentos Transferegov → consolidado → validação.
// LEGADO/DESCONTINUAÇÃO: este orquestrador aciona Transferegov e lê workbook
// via carregarPlanoAplicacaoLocal. Foi substituído operacionalmente pelo
// fluxo PAD/reconstrução. Para execução pontual em desenvolvimento exige
// ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1. Em produção, é PROIBIDO mesmo
// com a flag (vide profor-workbook-fallback-guard-service.js).
// NÃO publica dados estáticos. NÃO altera JSONs publicados.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const {
  assertOrquestradorLegadoPermitido,
} = require("../services/profor-2022/profor-workbook-fallback-guard-service");

const { inicializarBanco } = require("../db/init-db");
const {
  atualizarProfor2022Consolidado,
  resumirAtualizacaoConsolidada,
} = require("../services/profor-2022/profor-atualizacao-consolidada-service");

async function executar() {
  // Gate de descontinuação: falha cedo, antes de tocar banco ou Transferegov.
  try {
    assertOrquestradorLegadoPermitido("atualizar-profor-2022-consolidado");
  } catch (err) {
    console.error(err?.message || err);
    process.exit(2);
    return;
  }

  inicializarBanco();

  let resultado;
  try {
    resultado = await atualizarProfor2022Consolidado();
  } catch (err) {
    console.error("Falha critica na atualizacao consolidada PROFOR 2022:", err?.message || err);
    process.exit(1);
    return;
  }

  console.log(resumirAtualizacaoConsolidada(resultado));

  const bloqueante =
    (resultado.consolidado?.totalConvenios ?? 0) === 0 ||
    (!resultado.detru.sucesso && !resultado.rendimentos.sucesso && !resultado.consolidado.sucesso);

  process.exit(bloqueante ? 1 : 0);
}

executar();

// Rotina operacional única: atualização consolidada PROFOR 2022.
// Executa DETRU → rendimentos Transferegov → consolidado → validação.
// NÃO publica dados estáticos. NÃO altera JSONs publicados.
// Retorna codigo 0 em sucesso; codigo 1 apenas em falha bloqueante
// (consolidado sem convenios ou todas as etapas reais falharam).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const { inicializarBanco } = require("../db/init-db");
const {
  atualizarProfor2022Consolidado,
  resumirAtualizacaoConsolidada,
} = require("../services/profor-2022/profor-atualizacao-consolidada-service");

async function executar() {
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

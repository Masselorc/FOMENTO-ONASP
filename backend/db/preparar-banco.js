const { isPostgresConfigured, query } = require("./postgres-client");
const { inicializarFormalizacaoProfor } = require("../services/formalizacao-profor-service");
const { inicializarOrcamento2026 } = require("../services/orcamento-2026-service");

// Preparacao de banco no boot do servidor. Postgres-only: NAO cria schema, NAO
// popula dados e NAO toca SQLite. Faz apenas uma verificacao leve de prontidao
// (a tabela base existe e responde) e dispara os backfills idempotentes ja
// migrados para Postgres. O schema e a carga inicial sao responsabilidade dos
// scripts de migracao/infra, nao do boot.
async function prepararBanco() {
  if (!isPostgresConfigured()) {
    throw new Error(
      "DATABASE_URL nao configurada. O servidor agora depende exclusivamente do Postgres/Supabase; " +
      "nao ha fallback para SQLite no boot."
    );
  }

  // Verificacao leve de prontidao: confirma que a tabela base responde.
  // Nao escreve nada; apenas valida conectividade e existencia minima.
  await query("SELECT 1 FROM parametros_minimos LIMIT 1");

  // Backfills idempotentes ja migrados para Postgres.
  await inicializarFormalizacaoProfor();
  await inicializarOrcamento2026();
}

module.exports = {
  prepararBanco
};

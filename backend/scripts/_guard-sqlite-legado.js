// Guard compartilhado para scripts auxiliares que ainda leem/escrevem o SQLite
// legado (backend/data/onasp.sqlite) em tabelas que ja foram migradas para
// Postgres. Apos a migracao PAD/PROFOR 2022, essas leituras podem refletir uma
// fonte defasada. Para evitar uso acidental de dados obsoletos, o script fica
// bloqueado por padrao e so executa quando a variavel de ambiente
// CONFIRMAR_AUDITORIA_SQLITE_LEGADO=SIM e definida explicitamente.
const VARIAVEL_CONFIRMACAO = "CONFIRMAR_AUDITORIA_SQLITE_LEGADO";

function exigirConfirmacaoAuditoriaSqliteLegado(nomeScript = "Este script") {
  if (process.env[VARIAVEL_CONFIRMACAO] === "SIM") return;
  throw new Error(
    `${nomeScript} ainda le o SQLite legado (backend/data/onasp.sqlite), cujas tabelas ` +
    "ja foram migradas para Postgres; os dados podem estar defasados. " +
    `Execucao bloqueada por seguranca. Defina ${VARIAVEL_CONFIRMACAO}=SIM apenas se ` +
    "voce realmente quer inspecionar o SQLite legado local, ciente de que o resultado " +
    "NAO reflete o Postgres/Supabase. A migracao definitiva deste script para Postgres " +
    "esta pendente de sublote proprio."
  );
}

module.exports = {
  VARIAVEL_CONFIRMACAO,
  exigirConfirmacaoAuditoriaSqliteLegado,
};

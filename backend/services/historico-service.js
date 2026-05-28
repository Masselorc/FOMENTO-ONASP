const { query } = require("../db/postgres-client");

async function registrarHistorico(executor, { pagina, registro, campo, valorAnterior, valorNovo } = {}) {
  // Mantém compatibilidade com a assinatura legada (db, payload). Quando chamado
  // com (payload) — sem o primeiro argumento de transação — o segundo é undefined.
  let payload;
  if (executor && typeof executor === "object" && "pagina" in executor) {
    payload = executor;
    executor = null;
  } else {
    payload = { pagina, registro, campo, valorAnterior, valorNovo };
  }

  if (String(payload.valorAnterior) === String(payload.valorNovo)) return;

  const sql = `
    INSERT INTO historico_alteracoes
    (pagina, registro, campo, valor_anterior, valor_novo, alterado_em)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  const params = [
    payload.pagina,
    payload.registro,
    payload.campo,
    payload.valorAnterior === undefined ? "" : String(payload.valorAnterior),
    payload.valorNovo === undefined ? "" : String(payload.valorNovo),
    new Date().toISOString()
  ];

  if (executor && typeof executor.query === "function") {
    await executor.query(sql, params);
    return;
  }

  await query(sql, params);
}

module.exports = {
  registrarHistorico
};

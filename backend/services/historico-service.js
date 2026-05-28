const { query } = require("../db/postgres-client");

function registrarHistorico(db, { pagina, registro, campo, valorAnterior, valorNovo }) {
  if (String(valorAnterior) === String(valorNovo)) return;

  db.prepare(`
    INSERT INTO historico_alteracoes
    (pagina, registro, campo, valor_anterior, valor_novo, alterado_em)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    pagina,
    registro,
    campo,
    valorAnterior === undefined ? "" : String(valorAnterior),
    valorNovo === undefined ? "" : String(valorNovo),
    new Date().toISOString()
  );
}

async function registrarHistoricoPostgres(executor, { pagina, registro, campo, valorAnterior, valorNovo } = {}) {
  if (String(valorAnterior) === String(valorNovo)) return;

  const sql = `
    INSERT INTO historico_alteracoes
    (pagina, registro, campo, valor_anterior, valor_novo, alterado_em)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  const params = [
    pagina,
    registro,
    campo,
    valorAnterior === undefined ? "" : String(valorAnterior),
    valorNovo === undefined ? "" : String(valorNovo),
    new Date().toISOString()
  ];

  if (executor && typeof executor.query === "function") {
    await executor.query(sql, params);
    return;
  }

  await query(sql, params);
}

module.exports = {
  registrarHistorico,
  registrarHistoricoPostgres
};

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

module.exports = {
  registrarHistorico
};

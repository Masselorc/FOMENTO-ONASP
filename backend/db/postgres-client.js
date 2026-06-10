const { Pool, types } = require("pg");

// node-postgres devolve NUMERIC/DECIMAL (OID 1700) como string por padrao
// (ex.: "84792.08"). Esses valores eram reinterpretados pelos parsers de moeda
// brasileiros (que tratam o ponto como separador de milhar), inflando o numero
// em x100. Converter para numero ja na borda do banco — como o SQLite fazia —
// elimina essa classe de bug e mantem o restante do codigo recebendo numeros.
types.setTypeParser(1700, (valor) => (valor === null ? null : parseFloat(valor)));

let pool = null;

function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (pool) return pool;

  if (!isPostgresConfigured()) {
    throw new Error("DATABASE_URL nao configurada. Postgres indisponivel.");
  }

  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  pool.on("error", (err) => {
    console.error("Erro inesperado no pool Postgres:", err.message);
  });

  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}

async function withTransaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}

module.exports = {
  isPostgresConfigured,
  getPool,
  query,
  withTransaction,
  closePool
};

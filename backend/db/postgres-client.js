const { Pool } = require("pg");

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

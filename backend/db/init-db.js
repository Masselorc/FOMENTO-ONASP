const db = require("./database");

function inicializarBanco() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parametros_minimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uf TEXT NOT NULL,
      parametro TEXT NOT NULL,
      status TEXT NOT NULL,
      atualizado_em TEXT,
      UNIQUE (uf, parametro)
    );

    CREATE TABLE IF NOT EXISTS formalizacao_profor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uf TEXT NOT NULL,
      etapa TEXT NOT NULL,
      status TEXT NOT NULL,
      observacao TEXT,
      atualizado_em TEXT,
      UNIQUE (uf, etapa)
    );

    CREATE TABLE IF NOT EXISTS orcamento_2026 (
      id TEXT PRIMARY KEY,
      categoria TEXT,
      descricao TEXT,
      acao_orcamentaria TEXT,
      plano_orcamentario TEXT,
      natureza TEXT,
      valor_previsto REAL DEFAULT 0,
      valor_disponibilizado REAL DEFAULT 0,
      valor_executado REAL DEFAULT 0,
      status TEXT,
      observacao TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS historico_alteracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pagina TEXT NOT NULL,
      registro TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior TEXT,
      valor_novo TEXT,
      alterado_em TEXT NOT NULL
    );
  `);

  garantirColuna("parametros_minimos", "quantidade_atual", "REAL");
  garantirColuna("parametros_minimos", "quantidade_ideal", "REAL");
}

function garantirColuna(tabela, coluna, definicao) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all();
  if (colunas.some((item) => item.name === coluna)) return;

  db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}

if (require.main === module) {
  inicializarBanco();
  console.log("Banco SQLite inicializado em backend/data/onasp.sqlite");
}

module.exports = {
  inicializarBanco
};

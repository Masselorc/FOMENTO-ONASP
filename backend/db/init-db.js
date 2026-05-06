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
      valor_empenhado REAL DEFAULT 0,
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
  garantirColuna("orcamento_2026", "valor_estimado_pesquisa_preco", "REAL DEFAULT 0");
  garantirColuna("orcamento_2026", "valor_empenhado", "REAL DEFAULT 0");
  garantirColuna("orcamento_2026", "processo_autuado", "INTEGER DEFAULT 0");
  garantirColuna("orcamento_2026", "processo_sei", "TEXT");
  garantirColuna("orcamento_2026", "compoe_orcamento", "INTEGER DEFAULT 1");
  garantirColuna("orcamento_2026", "ativo", "INTEGER DEFAULT 1");
  garantirColunasOrcamentoRastreio();
}

function garantirColunasOrcamentoRastreio() {
  [
    ["tipo_rastreio", "TEXT"],
    ["abrangencia", "TEXT"],
    ["quantidade", "TEXT"],
    ["unidade", "TEXT"],
    ["valor_unitario", "REAL DEFAULT 0"],
    ["link_processo_sei", "TEXT"],
    ["data_processo_sei", "TEXT"],
    ["demanda_formalizada", "TEXT"],
    ["link_demanda_formalizada", "TEXT"],
    ["data_demanda_formalizada", "TEXT"],
    ["estudo_tecnico", "TEXT"],
    ["link_estudo_tecnico", "TEXT"],
    ["data_estudo_tecnico", "TEXT"],
    ["termo_referencia", "TEXT"],
    ["link_termo_referencia", "TEXT"],
    ["data_termo_referencia", "TEXT"],
    ["pesquisa_precos", "TEXT"],
    ["link_pesquisa_precos", "TEXT"],
    ["data_pesquisa_precos", "TEXT"],
    ["autorizacao_autoridade", "TEXT"],
    ["link_autorizacao_autoridade", "TEXT"],
    ["data_autorizacao_autoridade", "TEXT"],
    ["parecer_juridico", "TEXT"],
    ["link_parecer_juridico", "TEXT"],
    ["data_parecer_juridico", "TEXT"],
    ["empenho", "TEXT"],
    ["link_empenho", "TEXT"],
    ["data_empenho", "TEXT"],
    ["contrato", "TEXT"],
    ["link_contrato", "TEXT"],
    ["data_contratacao", "TEXT"],
    ["ordem_servico", "TEXT"],
    ["link_ordem_servico", "TEXT"],
    ["data_ordem_servico", "TEXT"],
    ["data_entrega", "TEXT"],
    ["ordem_bancaria", "TEXT"],
    ["link_ordem_bancaria", "TEXT"],
    ["data_ordem_bancaria", "TEXT"],
    ["profor_autuacao", "TEXT"],
    ["link_profor_autuacao", "TEXT"],
    ["data_profor_autuacao", "TEXT"],
    ["profor_parecer_tecnico", "TEXT"],
    ["link_profor_parecer_tecnico", "TEXT"],
    ["data_profor_parecer_tecnico", "TEXT"],
    ["profor_minuta_edital", "TEXT"],
    ["link_profor_minuta_edital", "TEXT"],
    ["data_profor_minuta_edital", "TEXT"],
    ["profor_ddo_cgof", "TEXT"],
    ["link_profor_ddo_cgof", "TEXT"],
    ["data_profor_ddo_cgof", "TEXT"],
    ["profor_abertura_programa", "TEXT"],
    ["link_profor_abertura_programa", "TEXT"],
    ["data_profor_abertura_programa", "TEXT"],
    ["profor_parecer_conjur", "TEXT"],
    ["link_profor_parecer_conjur", "TEXT"],
    ["data_profor_parecer_conjur", "TEXT"],
    ["profor_publicacao_gabsec", "TEXT"],
    ["link_profor_publicacao_gabsec", "TEXT"],
    ["data_profor_publicacao_gabsec", "TEXT"]
  ].forEach(([coluna, definicao]) => garantirColuna("orcamento_2026", coluna, definicao));
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
  inicializarBanco,
  garantirColuna
};

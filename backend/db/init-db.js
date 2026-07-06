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
      setor_atual TEXT,
      responsavel_atual TEXT,
      data_entrada_setor TEXT,
      pendencia_atual TEXT,
      observacao TEXT,
      classificacao_gerencial TEXT DEFAULT 'NAO_APARELHAMENTO',
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
  garantirColuna("parametros_minimos", "resposta_original", "TEXT");
  // Campos usados para vincular processos filhos ao envelope orcamentario principal sem duplicar o total do orcamento.
  garantirColuna("orcamento_2026", "processo_pai_id", "TEXT");
  garantirColuna("orcamento_2026", "tipo_processo", "TEXT DEFAULT 'PRINCIPAL'");
  garantirColuna("orcamento_2026", "origem_recurso_id", "TEXT");
  garantirColuna("orcamento_2026", "ordem_exibicao", "INTEGER");
  garantirColuna("orcamento_2026", "valor_alocado_origem", "REAL DEFAULT 0");
  garantirColuna("orcamento_2026", "valor_estimado_pesquisa_preco", "REAL DEFAULT 0");
  garantirColuna("orcamento_2026", "valor_empenhado", "REAL DEFAULT 0");
  garantirColuna("orcamento_2026", "processo_autuado", "INTEGER DEFAULT 0");
  garantirColuna("orcamento_2026", "pena_justa", "INTEGER DEFAULT 0");
  garantirColuna("orcamento_2026", "processo_sei", "TEXT");
  garantirColuna("orcamento_2026", "setor_atual", "TEXT");
  garantirColuna("orcamento_2026", "responsavel_atual", "TEXT");
  garantirColuna("orcamento_2026", "data_entrada_setor", "TEXT");
  garantirColuna("orcamento_2026", "pendencia_atual", "TEXT");
  garantirColuna("orcamento_2026", "compoe_orcamento", "INTEGER DEFAULT 1");
  garantirColuna("orcamento_2026", "ativo", "INTEGER DEFAULT 1");
  garantirColuna("orcamento_2026", "classificacao_gerencial", "TEXT DEFAULT 'NAO_APARELHAMENTO'");
  garantirColunasOrcamentoRastreio();
  garantirTabelaMovimentacoesOrcamento2026();
  garantirTabelaConveniosMonitoradosProfor2022();
  garantirTabelaDetruCacheProfor2022();
  garantirTabelaDetruAtualizacoesProfor2022();
  garantirTabelaTransferegovRendimentosCacheProfor2022();
  garantirTabelaTransferegovRendimentosConsultasProfor2022();
  garantirTabelaLogsOperacionais();
  garantirTabelasRateioInicialProfor2022();
  garantirTabelasRevisaoProfor2022();
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

function garantirTabelaMovimentacoesOrcamento2026() {
  // Registra deslocamentos de saldo entre processos, preservando trilha de auditoria sem sobrescrever o valor original.
  db.exec(`
    CREATE TABLE IF NOT EXISTS orcamento_2026_movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      origem_id TEXT,
      destino_id TEXT,
      valor REAL NOT NULL DEFAULT 0,
      justificativa TEXT,
      criado_em TEXT NOT NULL,
      criado_por TEXT,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orcamento_2026_frentes (
      frente TEXT PRIMARY KEY,
      valor_disponivel REAL NOT NULL DEFAULT 0,
      atualizado_em TEXT
    );
  `);
}

function garantirTabelaConveniosMonitoradosProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_convenios_monitorados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_convenio TEXT NOT NULL,
      ano TEXT,
      uf TEXT,
      instrumento TEXT DEFAULT 'Convênio',
      programa_origem TEXT DEFAULT 'PROFOR 2022',
      ativo INTEGER DEFAULT 1,
      id_convenio_transferegov TEXT,
      observacao TEXT,
      criado_em TEXT,
      atualizado_em TEXT,
      UNIQUE (numero_convenio, ano)
    );
  `);
}

function garantirTabelaDetruCacheProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_detru_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_convenio TEXT NOT NULL,
      ano TEXT,
      payload_json TEXT NOT NULL,
      fonte TEXT DEFAULT 'DETRU/siconv_convenio.csv.zip',
      arquivo_origem TEXT,
      arquivo_hash TEXT,
      consultado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      UNIQUE(numero_convenio, ano)
    );
  `);
}

function garantirTabelaDetruAtualizacoesProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_detru_atualizacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      iniciado_em TEXT NOT NULL,
      concluido_em TEXT,
      sucesso INTEGER DEFAULT 0,
      caminho_arquivo TEXT,
      arquivo_hash TEXT,
      total_carteira_ativa INTEGER DEFAULT 0,
      total_linhas_detru_lidas INTEGER DEFAULT 0,
      total_encontrados INTEGER DEFAULT 0,
      total_nao_encontrados INTEGER DEFAULT 0,
      erro TEXT,
      resumo_json TEXT
    );
  `);
}

function garantirTabelaTransferegovRendimentosCacheProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_transferegov_rendimentos_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_convenio TEXT NOT NULL,
      ano TEXT,
      saldo_rendimentos_atual REAL,
      valor_original TEXT,
      subtitulo TEXT,
      aviso TEXT,
      convenio_texto TEXT,
      url_final TEXT,
      consultado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      sucesso INTEGER DEFAULT 1,
      erro TEXT,
      payload_json TEXT,
      UNIQUE(numero_convenio, ano)
    );
  `);
}

function garantirTabelaTransferegovRendimentosConsultasProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_transferegov_rendimentos_consultas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      iniciado_em TEXT NOT NULL,
      concluido_em TEXT,
      sucesso INTEGER DEFAULT 0,
      total_carteira_ativa INTEGER DEFAULT 0,
      total_consultados INTEGER DEFAULT 0,
      total_sucesso INTEGER DEFAULT 0,
      total_falha INTEGER DEFAULT 0,
      erro TEXT,
      resumo_json TEXT
    );
  `);
}

function garantirTabelaLogsOperacionais() {
  // Log genérico aditivo de eventos operacionais por módulo (PROFOR 2022 etc.).
  // Cresce apenas via INSERT; consulta/exportação são feitas pela tela de Sistema (modo local/API).
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs_operacionais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modulo TEXT NOT NULL,
      tipo_evento TEXT NOT NULL,
      status TEXT NOT NULL,
      iniciado_em TEXT,
      concluido_em TEXT,
      duracao_ms INTEGER,
      resumo TEXT,
      payload_json TEXT,
      criado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_operacionais_criado_em ON logs_operacionais(criado_em DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_operacionais_tipo_evento ON logs_operacionais(tipo_evento);
    CREATE INDEX IF NOT EXISTS idx_logs_operacionais_status ON logs_operacionais(status);
  `);
}

function garantirTabelasRateioInicialProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_2022_rateio_import_lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo_origem TEXT NOT NULL,
      arquivo_json_dry_run TEXT NOT NULL,
      hash_arquivo_json TEXT,
      status TEXT NOT NULL,
      total_itens INTEGER NOT NULL DEFAULT 0,
      total_rateios INTEGER NOT NULL DEFAULT 0,
      total_alertas INTEGER NOT NULL DEFAULT 0,
      total_alertas_impeditivos INTEGER NOT NULL DEFAULT 0,
      observacao TEXT,
      rollback_em TEXT,
      rollback_motivo TEXT,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profor_2022_itens_conhecidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_item TEXT NOT NULL,
      numero_convenio TEXT NOT NULL,
      descricao_normalizada TEXT NOT NULL,
      descricao_original_referencia TEXT,
      uf TEXT,
      ano TEXT,
      naturezas_encontradas_json TEXT NOT NULL DEFAULT '[]',
      unidades_encontradas_json TEXT NOT NULL DEFAULT '[]',
      valor_unitario_referencia REAL NOT NULL DEFAULT 0,
      origem TEXT NOT NULL DEFAULT 'planilha-antiga',
      possui_pendencia_impeditiva INTEGER NOT NULL DEFAULT 0,
      apto_para_importacao_futura INTEGER NOT NULL DEFAULT 1,
      status_item TEXT NOT NULL DEFAULT 'ATIVO',
      ultima_ocorrencia_em TEXT,
      ultima_ausencia_em TEXT,
      validacao_exclusao TEXT,
      item_substituido_id INTEGER,
      motivo_substituicao TEXT,
      observacao_substituicao TEXT,
      validado_por TEXT,
      validado_em TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      lote_importacao_id INTEGER,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      UNIQUE(chave_item),
      FOREIGN KEY(item_substituido_id) REFERENCES profor_2022_itens_conhecidos(id),
      FOREIGN KEY(lote_importacao_id) REFERENCES profor_2022_rateio_import_lotes(id)
    );

    CREATE TABLE IF NOT EXISTS profor_2022_item_rateios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_conhecido_id INTEGER NOT NULL,
      chave_item TEXT NOT NULL,
      area TEXT NOT NULL,
      natureza TEXT NOT NULL,
      quantidade_referencia REAL NOT NULL DEFAULT 0,
      valor_previsto_referencia REAL NOT NULL DEFAULT 0,
      valor_executado_referencia REAL NOT NULL DEFAULT 0,
      percentual_quantidade REAL NOT NULL DEFAULT 0,
      percentual_valor REAL NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      lote_importacao_id INTEGER,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      UNIQUE(item_conhecido_id, area, natureza, lote_importacao_id),
      FOREIGN KEY(item_conhecido_id) REFERENCES profor_2022_itens_conhecidos(id),
      FOREIGN KEY(lote_importacao_id) REFERENCES profor_2022_rateio_import_lotes(id)
    );

    CREATE TABLE IF NOT EXISTS profor_2022_rateio_import_alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lote_importacao_id INTEGER NOT NULL,
      chave_item TEXT,
      tipo TEXT NOT NULL,
      nivel TEXT NOT NULL,
      numero_convenio TEXT,
      uf TEXT,
      ano TEXT,
      descricao TEXT,
      detalhe TEXT,
      origem_arquivo TEXT,
      origem_aba TEXT,
      origem_linha INTEGER,
      criado_em TEXT NOT NULL,
      FOREIGN KEY(lote_importacao_id) REFERENCES profor_2022_rateio_import_lotes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_itens_numero_convenio
      ON profor_2022_itens_conhecidos(numero_convenio);
    CREATE INDEX IF NOT EXISTS idx_itens_numero_descricao
      ON profor_2022_itens_conhecidos(numero_convenio, descricao_normalizada);
    CREATE INDEX IF NOT EXISTS idx_itens_apto
      ON profor_2022_itens_conhecidos(apto_para_importacao_futura);
    CREATE INDEX IF NOT EXISTS idx_itens_status_item
      ON profor_2022_itens_conhecidos(status_item);

    CREATE INDEX IF NOT EXISTS idx_rateios_item
      ON profor_2022_item_rateios(item_conhecido_id);
    CREATE INDEX IF NOT EXISTS idx_rateios_chave_item
      ON profor_2022_item_rateios(chave_item);

    CREATE INDEX IF NOT EXISTS idx_alertas_lote
      ON profor_2022_rateio_import_alertas(lote_importacao_id);
    CREATE INDEX IF NOT EXISTS idx_alertas_tipo_nivel
      ON profor_2022_rateio_import_alertas(tipo, nivel);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_rateio_ativo_unico
      ON profor_2022_item_rateios(item_conhecido_id, area, natureza)
      WHERE ativo = 1;
  `);
}

function garantirTabelasRevisaoProfor2022() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profor_2022_revisao_lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origem TEXT NOT NULL,
      arquivo_origem TEXT,
      hash_origem TEXT,
      status TEXT NOT NULL DEFAULT 'ABERTO',
      total_divergencias INTEGER NOT NULL DEFAULT 0,
      total_pendentes INTEGER NOT NULL DEFAULT 0,
      total_impeditivas INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profor_2022_revisao_divergencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lote_revisao_id INTEGER NOT NULL,
      chave_divergencia TEXT NOT NULL,
      numero_convenio TEXT,
      uf TEXT,
      chave_item TEXT,
      tipo_alerta TEXT NOT NULL,
      nivel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      campo_afetado TEXT,
      valor_anterior TEXT,
      valor_novo TEXT,
      fonte_anterior TEXT,
      fonte_nova TEXT,
      diferenca TEXT,
      motivo_provavel TEXT,
      acao_sugerida TEXT,
      impacto_reconstrucao TEXT,
      bloqueia_publicacao INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      UNIQUE(chave_divergencia),
      FOREIGN KEY(lote_revisao_id) REFERENCES profor_2022_revisao_lotes(id)
    );

    CREATE TABLE IF NOT EXISTS profor_2022_revisao_decisoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      divergencia_id INTEGER NOT NULL,
      decisao TEXT NOT NULL,
      valor_aplicado TEXT,
      justificativa TEXT,
      usuario TEXT,
      decidido_em TEXT NOT NULL,
      lote_saneamento_id INTEGER,
      payload_decisao_json TEXT NOT NULL DEFAULT '{}',
      criado_em TEXT NOT NULL,
      FOREIGN KEY(divergencia_id) REFERENCES profor_2022_revisao_divergencias(id)
    );

    CREATE TABLE IF NOT EXISTS profor_2022_revisao_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entidade_tipo TEXT NOT NULL,
      entidade_id INTEGER,
      evento TEXT NOT NULL,
      estado_anterior_json TEXT,
      estado_novo_json TEXT,
      usuario TEXT,
      detalhe TEXT,
      criado_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revisao_divergencias_status
      ON profor_2022_revisao_divergencias(status);
    CREATE INDEX IF NOT EXISTS idx_revisao_divergencias_tipo
      ON profor_2022_revisao_divergencias(tipo_alerta);
    CREATE INDEX IF NOT EXISTS idx_revisao_divergencias_nivel
      ON profor_2022_revisao_divergencias(nivel);
    CREATE INDEX IF NOT EXISTS idx_revisao_divergencias_convenio
      ON profor_2022_revisao_divergencias(numero_convenio);
    CREATE INDEX IF NOT EXISTS idx_revisao_divergencias_chave_item
      ON profor_2022_revisao_divergencias(chave_item);
    CREATE INDEX IF NOT EXISTS idx_revisao_decisoes_divergencia
      ON profor_2022_revisao_decisoes(divergencia_id);
    CREATE INDEX IF NOT EXISTS idx_revisao_logs_entidade
      ON profor_2022_revisao_logs(entidade_tipo, entidade_id);
  `);
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

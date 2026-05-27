const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const {
  planejarSaneamentoDecisoesAntigas,
  aplicarSaneamentoDecisoesAntigas,
  interpretarRegistro,
  normalizarAreaPayload,
} = require("../../backend/services/profor-2022/profor-pad-saneamento-decisoes-antigas-service");

function criarBancoComSchema() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE profor_2022_itens_conhecidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave_item TEXT,
      numero_convenio TEXT,
      descricao_normalizada TEXT,
      descricao_original_referencia TEXT,
      uf TEXT,
      ano TEXT,
      naturezas_encontradas_json TEXT,
      unidades_encontradas_json TEXT,
      valor_unitario_referencia REAL,
      origem TEXT,
      possui_pendencia_impeditiva INTEGER,
      apto_para_importacao_futura INTEGER,
      status_item TEXT,
      ultima_ocorrencia_em TEXT,
      ativo INTEGER,
      criado_em TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE profor_2022_item_rateios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_conhecido_id INTEGER,
      chave_item TEXT,
      area TEXT,
      natureza TEXT,
      quantidade_referencia REAL,
      valor_previsto_referencia REAL,
      valor_executado_referencia REAL,
      percentual_quantidade REAL,
      percentual_valor REAL,
      ativo INTEGER,
      lote_importacao_id INTEGER,
      criado_em TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE profor_2022_revisao_divergencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lote_revisao_id INTEGER,
      chave_divergencia TEXT,
      numero_convenio TEXT,
      uf TEXT,
      chave_item TEXT,
      tipo_alerta TEXT,
      nivel TEXT,
      status TEXT,
      campo_afetado TEXT,
      valor_anterior TEXT,
      valor_novo TEXT,
      fonte_anterior TEXT,
      fonte_nova TEXT,
      diferenca TEXT,
      motivo_provavel TEXT,
      acao_sugerida TEXT,
      impacto_reconstrucao TEXT,
      bloqueia_publicacao INTEGER,
      payload_json TEXT,
      criado_em TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE profor_2022_revisao_decisoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      divergencia_id INTEGER,
      decisao TEXT,
      valor_aplicado TEXT,
      justificativa TEXT,
      usuario TEXT,
      decidido_em TEXT,
      lote_saneamento_id INTEGER,
      payload_decisao_json TEXT,
      criado_em TEXT
    );

    CREATE TABLE profor_2022_revisao_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entidade_tipo TEXT,
      entidade_id INTEGER,
      evento TEXT,
      estado_anterior_json TEXT,
      estado_novo_json TEXT,
      usuario TEXT,
      detalhe TEXT,
      criado_em TEXT
    );
  `);
  return db;
}

function inserirDivergenciaComDecisao(db, {
  numeroConvenio,
  uf,
  chaveItem,
  descricaoPad,
  naturezaPad = "CAPITAL",
  quantidadePad = 1,
  valorUnitarioPad = 100,
  decisao = "ACEITO",
  tipoSaneamento = "rateio_manual",
  rateio = [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 1, percentualQuantidade: 100 }],
  quantidadeTotalItem = null,
}) {
  const divPayload = {
    campoAfetado: "rateio",
    numeroConvenio,
    uf,
    chaveItem,
    descricaoPad,
    naturezaPad,
    quantidadePad,
    valorUnitarioPad,
  };
  const divInfo = db.prepare(`
    INSERT INTO profor_2022_revisao_divergencias
    (numero_convenio, uf, chave_item, tipo_alerta, status, payload_json)
    VALUES (?, ?, ?, 'item_novo_sem_rateio', 'ACEITO', ?)
  `).run(numeroConvenio, uf, chaveItem, JSON.stringify(divPayload));

  const decPayload = {
    origem: "interface-revisao-divergencias",
    tipoSaneamento,
    quantidadeTotalItem: quantidadeTotalItem ?? quantidadePad,
    rateio,
  };
  const decInfo = db.prepare(`
    INSERT INTO profor_2022_revisao_decisoes
    (divergencia_id, decisao, usuario, decidido_em, payload_decisao_json)
    VALUES (?, ?, 'usuario-teste', '2026-05-21T10:00:00.000Z', ?)
  `).run(divInfo.lastInsertRowid, decisao, JSON.stringify(decPayload));

  return { divergenciaId: divInfo.lastInsertRowid, decisaoId: decInfo.lastInsertRowid };
}

test("normalizarAreaPayload converte 'ESCOLA PENAL' e 'ESCOLA' para ESCOLA_PENAL", () => {
  assert.equal(normalizarAreaPayload("ESCOLA PENAL"), "ESCOLA_PENAL");
  assert.equal(normalizarAreaPayload("ESCOLA"), "ESCOLA_PENAL");
  assert.equal(normalizarAreaPayload("CORREGEDORIA"), "CORREGEDORIA");
  assert.equal(normalizarAreaPayload("NAO INFORMADO"), "NAO_CLASSIFICADO");
  assert.equal(normalizarAreaPayload(""), "NAO_CLASSIFICADO");
});

test("identifica decisao ACEITO/rateio_manual como candidata", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221",
    uf: "AL",
    chaveItem: "937221::AR CONDICIONADO SPLIT 60.000 BTUS",
    descricaoPad: "Ar condicionado Split 60.000 BTUs (ESCOLA)",
    rateio: [{ area: "ESCOLA PENAL", natureza: "CAPITAL", quantidade: 1, percentualQuantidade: 100 }],
  });

  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.totalDecisoesLidas, 1);
  assert.equal(plano.candidatas.length, 1);
  assert.equal(plano.jaMaterializadas.length, 0);
  assert.equal(plano.ignoradas.length, 0);
  const c = plano.candidatas[0];
  assert.equal(c.contexto.numeroConvenio, "937221");
  assert.equal(c.contexto.chaveItem, "937221::AR CONDICIONADO SPLIT 60.000 BTUS");
  assert.equal(c.linhasPersistencia.length, 1);
  assert.equal(c.linhasPersistencia[0].area, "ESCOLA_PENAL");
});

test("dry-run nao altera banco", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::TESTE",
    descricaoPad: "Teste item",
  });
  const antesItens = db.prepare("SELECT COUNT(*) AS n FROM profor_2022_itens_conhecidos").get().n;
  const antesRateios = db.prepare("SELECT COUNT(*) AS n FROM profor_2022_item_rateios").get().n;

  planejarSaneamentoDecisoesAntigas({ db });

  const depoisItens = db.prepare("SELECT COUNT(*) AS n FROM profor_2022_itens_conhecidos").get().n;
  const depoisRateios = db.prepare("SELECT COUNT(*) AS n FROM profor_2022_item_rateios").get().n;
  assert.equal(depoisItens, antesItens);
  assert.equal(depoisRateios, antesRateios);
});

test("decisao REJEITADO/PENDENTE nao gera candidata", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::R1",
    descricaoPad: "Rejeitado",
    decisao: "REJEITADO",
  });
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::R2",
    descricaoPad: "Pendente",
    decisao: "PENDENTE",
  });
  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 2);
  assert.ok(plano.ignoradas.every((i) => i.motivo === "decisao_nao_resolutiva"));
});

test("tipoSaneamento diferente de rateio_manual e ignorado", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::X",
    descricaoPad: "Liberacao",
    tipoSaneamento: "liberacao_item_nao_apto",
  });
  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 1);
  assert.equal(plano.ignoradas[0].motivo, "tipo_saneamento_diferente");
});

test("filtro por convenio funciona", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, { numeroConvenio: "937221", uf: "AL", chaveItem: "937221::A", descricaoPad: "A" });
  inserirDivergenciaComDecisao(db, { numeroConvenio: "937782", uf: "AC", chaveItem: "937782::B", descricaoPad: "B" });
  inserirDivergenciaComDecisao(db, { numeroConvenio: "999999", uf: "ZZ", chaveItem: "999999::C", descricaoPad: "C" });

  const planoAmbos = planejarSaneamentoDecisoesAntigas({ db, convenios: ["937221", "937782"] });
  assert.equal(planoAmbos.totalDecisoesLidas, 2);
  assert.equal(planoAmbos.candidatas.length, 2);

  const planoSo221 = planejarSaneamentoDecisoesAntigas({ db, convenios: ["937221"] });
  assert.equal(planoSo221.totalDecisoesLidas, 1);
});

test("ja materializadas nao sao reaplicadas (idempotencia por chave_item)", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::JA_EXISTE",
    descricaoPad: "Item ja materializado",
  });
  // Simula que esse item ja foi materializado previamente
  const info = db.prepare(`
    INSERT INTO profor_2022_itens_conhecidos
      (chave_item, numero_convenio, descricao_normalizada, descricao_original_referencia,
       uf, ano, naturezas_encontradas_json, unidades_encontradas_json,
       valor_unitario_referencia, origem, possui_pendencia_impeditiva,
       apto_para_importacao_futura, status_item, ultima_ocorrencia_em, ativo,
       criado_em, atualizado_em)
    VALUES ('937221::JA_EXISTE','937221','item ja materializado','Item ja materializado',
            'AL','2022','["CAPITAL"]','[]', 100, 'teste', 0, 1, 'ATIVO', '2026-05-01', 1,
            '2026-05-01', '2026-05-01')
  `).run();
  db.prepare(`
    INSERT INTO profor_2022_item_rateios
      (item_conhecido_id, chave_item, area, natureza, quantidade_referencia,
       valor_previsto_referencia, valor_executado_referencia, percentual_quantidade,
       percentual_valor, ativo, criado_em, atualizado_em)
    VALUES (?, '937221::JA_EXISTE', 'OUVIDORIA', 'CAPITAL', 1, 100, 0, 100, 100, 1,
            '2026-05-01', '2026-05-01')
  `).run(info.lastInsertRowid);

  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.jaMaterializadas.length, 1);
  assert.equal(plano.jaMaterializadas[0].estadoAtual.itemConhecidoId, info.lastInsertRowid);
});

test("--aplicar usa servico existente (persistirRateiosOperacionais) e materializa", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937782", uf: "AC",
    chaveItem: "937782::NOTEBOOK 4 NUCLEOS",
    descricaoPad: "Notebook 4 núcleos",
    quantidadePad: 2,
    valorUnitarioPad: 3500,
    rateio: [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 2, percentualQuantidade: 100 }],
  });

  const chamadas = [];
  const persistirFake = ({ contexto, linhas, evento, detalhe }, opcoes) => {
    chamadas.push({ contexto, linhas, evento, detalhe, opcoesDb: opcoes?.db === db });
    return 42; // simulado: id do item conhecido criado
  };

  const resultado = aplicarSaneamentoDecisoesAntigas({
    db,
    persistirRateiosOperacionais: persistirFake,
  });

  assert.equal(resultado.aplicadas.length, 1);
  assert.equal(resultado.aplicadas[0].itemConhecidoId, 42);
  assert.equal(resultado.aplicadas[0].chaveItem, "937782::NOTEBOOK 4 NUCLEOS");
  assert.equal(resultado.erros.length, 0);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].evento, "MATERIALIZAR_DECISAO_ANTIGA_RATEIO_MANUAL");
  assert.equal(chamadas[0].linhas[0].area, "OUVIDORIA");
  assert.equal(chamadas[0].linhas[0].quantidade, 2);
});

test("payload com soma de rateio diferente da quantidade total e ignorado", () => {
  const db = criarBancoComSchema();
  inserirDivergenciaComDecisao(db, {
    numeroConvenio: "937221", uf: "AL",
    chaveItem: "937221::SOMA_ERRADA",
    descricaoPad: "Quantidade incoerente",
    quantidadePad: 5,
    quantidadeTotalItem: 5,
    rateio: [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 2, percentualQuantidade: 40 }],
  });
  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 1);
  assert.equal(plano.ignoradas[0].motivo, "soma_rateio_diferente_quantidade");
});

test("payload_decisao_json invalido e marcado como ignorado com motivo payload_invalido", () => {
  const db = criarBancoComSchema();
  db.prepare(`
    INSERT INTO profor_2022_revisao_divergencias
    (numero_convenio, uf, chave_item, tipo_alerta, status, payload_json)
    VALUES ('937221','AL','937221::BROKEN','item_novo_sem_rateio','ACEITO','{}')
  `).run();
  db.prepare(`
    INSERT INTO profor_2022_revisao_decisoes
    (divergencia_id, decisao, payload_decisao_json)
    VALUES (last_insert_rowid(), 'ACEITO', '{not-json')
  `).run();
  const plano = planejarSaneamentoDecisoesAntigas({ db });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 1);
  assert.equal(plano.ignoradas[0].motivo, "payload_invalido");
});

test("interpretarRegistro deriva quantidade quando payload antigo so traz percentualQuantidade", () => {
  // Formato historico encontrado em decisoes do convenio 937782/AC: o rateio
  // antigo so guardou percentualQuantidade/percentualValor, sem campo
  // quantidade absoluta. O service deve derivar quantidade = percentual *
  // quantidadeTotalItem / 100 e considerar a decisao aplicavel.
  const linha = {
    divergencia_id: 21, decisao_id: 77,
    numero_convenio: "937782", uf: "AC",
    chave_item: "937782::CONTRATACAO DE 01 SUPERVISOR",
    tipo_alerta: "item_novo_sem_rateio",
    divergencia_payload_json: JSON.stringify({
      descricaoPad: "Contratação de 01 Supervisor",
      naturezaPad: "CUSTEIO",
      quantidadePad: 12,
      valorUnitarioPad: 7461,
    }),
    decisao: "ACEITO",
    decisao_payload_json: JSON.stringify({
      tipoSaneamento: "rateio_manual",
      // sem quantidadeTotalItem -> precisa cair em quantidadePad da divergencia
      rateio: [
        { area: "OUVIDORIA", natureza: "CUSTEIO", percentualQuantidade: 100, percentualValor: 100 },
      ],
    }),
    decisao_decidido_em: "2026-05-21T10:00:00.000Z",
  };
  const i = interpretarRegistro(linha);
  assert.equal(i.aplicavel, true, `esperava aplicavel; motivo=${i.motivo}`);
  assert.equal(i.linhasPersistencia.length, 1);
  assert.equal(i.linhasPersistencia[0].area, "OUVIDORIA");
  assert.equal(i.linhasPersistencia[0].quantidade, 12);
  assert.equal(i.linhasPersistencia[0].valorTotal, 12 * 7461);
});

test("interpretarRegistro deriva 50/50 a partir de dois percentuais", () => {
  const linha = {
    divergencia_id: 23, decisao_id: 85,
    numero_convenio: "937782", uf: "AC",
    chave_item: "937782::NOTEBOOK",
    tipo_alerta: "item_novo_sem_rateio",
    divergencia_payload_json: JSON.stringify({
      descricaoPad: "Notebook",
      naturezaPad: "CAPITAL",
      quantidadePad: 2,
      valorUnitarioPad: 3599.99,
    }),
    decisao: "ACEITO",
    decisao_payload_json: JSON.stringify({
      tipoSaneamento: "rateio_manual",
      rateio: [
        { area: "OUVIDORIA", natureza: "CAPITAL", percentualQuantidade: 50 },
        { area: "CORREGEDORIA", natureza: "CAPITAL", percentualQuantidade: 50 },
      ],
    }),
    decisao_decidido_em: "2026-05-21T10:00:00.000Z",
  };
  const i = interpretarRegistro(linha);
  assert.equal(i.aplicavel, true, `esperava aplicavel; motivo=${i.motivo}`);
  assert.equal(i.linhasPersistencia.length, 2);
  assert.equal(i.linhasPersistencia[0].quantidade, 1);
  assert.equal(i.linhasPersistencia[1].quantidade, 1);
});

test("interpretarRegistro mapeia 'NAO INFORMADO' para NAO_CLASSIFICADO sem quebrar", () => {
  const linha = {
    divergencia_id: 1, decisao_id: 1,
    numero_convenio: "937221", uf: "AL",
    chave_item: "937221::SR",
    tipo_alerta: "item_novo_sem_rateio",
    divergencia_payload_json: JSON.stringify({ descricaoPad: "Saldo Residual", naturezaPad: "CAPITAL", quantidadePad: 1, valorUnitarioPad: 9506.54 }),
    decisao: "CORRIGIDO",
    decisao_payload_json: JSON.stringify({
      tipoSaneamento: "rateio_manual",
      quantidadeTotalItem: 1,
      rateio: [{ area: "NAO INFORMADO", natureza: "CAPITAL", quantidade: 1, percentualQuantidade: 100 }],
    }),
    decisao_decidido_em: "2026-05-21T10:00:00.000Z",
  };
  const interpretado = interpretarRegistro(linha);
  assert.equal(interpretado.aplicavel, true);
  assert.equal(interpretado.linhasPersistencia[0].area, "NAO_CLASSIFICADO");
});

const test = require("node:test");
const assert = require("node:assert/strict");

// O saneamento de decisoes antigas agora le divergencias/decisoes e verifica
// materializacao diretamente no Postgres, e persiste via persistirRateiosOperacionais
// (tambem Postgres). Os testes de planejamento/aplicacao sao integrados e exigem
// DATABASE_URL. Os testes de interpretacao pura (interpretarRegistro,
// normalizarAreaPayload) nao tocam banco e rodam sempre.
const testPostgres = process.env.DATABASE_URL ? test : test.skip;

const { query, closePool } = require("../../backend/db/postgres-client");
const {
  planejarSaneamentoDecisoesAntigas,
  aplicarSaneamentoDecisoesAntigas,
  verificarMaterializacao,
  interpretarRegistro,
  normalizarAreaPayload,
} = require("../../backend/services/profor-2022/profor-pad-saneamento-decisoes-antigas-service");

const { executar, obterArgumentos } = require("../../backend/scripts/sanear-decisoes-antigas-pad-profor-2022");

// Prefixo isolado para os dados semeados nos testes integrados. Tudo criado e
// removido pelos proprios testes; nenhuma escrita de saneamento real e disparada.
const PREFIXO_TESTE = "TST-SANEAMENTO-D23";
const CONVENIOS_TESTE = ["T937221", "T937782", "T999999"];

async function limparDadosTeste() {
  // Ordem respeita FKs: rateios/itens, decisoes/divergencias, logs.
  await query(
    "DELETE FROM profor_2022_item_rateios WHERE chave_item LIKE $1",
    [`${PREFIXO_TESTE}%`]
  );
  await query(
    "DELETE FROM profor_2022_itens_conhecidos WHERE chave_item LIKE $1",
    [`${PREFIXO_TESTE}%`]
  );
  await query(
    `DELETE FROM profor_2022_revisao_decisoes
     WHERE divergencia_id IN (
       SELECT id FROM profor_2022_revisao_divergencias WHERE chave_divergencia LIKE $1
     )`,
    [`${PREFIXO_TESTE}%`]
  );
  await query(
    "DELETE FROM profor_2022_revisao_divergencias WHERE chave_divergencia LIKE $1",
    [`${PREFIXO_TESTE}%`]
  );
  await query(
    "DELETE FROM profor_2022_revisao_logs WHERE entidade_tipo = 'rateio_plano' AND detalhe LIKE $1",
    [`%${PREFIXO_TESTE}%`]
  );
}

async function obterLoteRevisao() {
  // As divergencias exigem lote_revisao_id (FK NOT NULL). Reaproveita um lote
  // existente se houver; caso contrario cria um lote de teste.
  const existente = await query("SELECT id FROM profor_2022_revisao_lotes ORDER BY id LIMIT 1");
  if (existente.rows[0]) return Number(existente.rows[0].id);
  const agora = new Date().toISOString();
  const novo = await query(
    `INSERT INTO profor_2022_revisao_lotes (origem, status, criado_em, atualizado_em)
     VALUES ($1, 'ABERTO', $2, $2) RETURNING id`,
    [`${PREFIXO_TESTE}-lote`, agora]
  );
  return Number(novo.rows[0].id);
}

async function inserirDivergenciaComDecisao({
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
  const loteId = await obterLoteRevisao();
  const agora = new Date().toISOString();
  const chaveDivergencia = `${PREFIXO_TESTE}::${chaveItem}`;
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
  const divInfo = await query(
    `INSERT INTO profor_2022_revisao_divergencias
       (lote_revisao_id, chave_divergencia, numero_convenio, uf, chave_item,
        tipo_alerta, nivel, status, payload_json, criado_em, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, 'item_novo_sem_rateio', 'INFO', 'ACEITO', $6, $7, $7)
     RETURNING id`,
    [loteId, chaveDivergencia, numeroConvenio, uf, chaveItem, JSON.stringify(divPayload), agora]
  );
  const divergenciaId = Number(divInfo.rows[0].id);

  const decPayload = {
    origem: "interface-revisao-divergencias",
    tipoSaneamento,
    quantidadeTotalItem: quantidadeTotalItem ?? quantidadePad,
    rateio,
  };
  const decInfo = await query(
    `INSERT INTO profor_2022_revisao_decisoes
       (divergencia_id, decisao, usuario, decidido_em, payload_decisao_json, criado_em)
     VALUES ($1, $2, 'usuario-teste', $3, $4, $3)
     RETURNING id`,
    [divergenciaId, decisao, "2026-05-21T10:00:00.000Z", JSON.stringify(decPayload)]
  );
  return { divergenciaId, decisaoId: Number(decInfo.rows[0].id), chaveItem };
}

async function inserirItemMaterializado({ chaveItem, numeroConvenio, uf }) {
  const agora = new Date().toISOString();
  const item = await query(
    `INSERT INTO profor_2022_itens_conhecidos
       (chave_item, numero_convenio, descricao_normalizada, descricao_original_referencia,
        uf, ano, naturezas_encontradas_json, unidades_encontradas_json,
        valor_unitario_referencia, origem, possui_pendencia_impeditiva,
        apto_para_importacao_futura, status_item, ultima_ocorrencia_em, ativo,
        criado_em, atualizado_em)
     VALUES ($1, $2, 'item ja materializado', 'Item ja materializado', $3, '2022',
             '["CAPITAL"]'::jsonb, '[]'::jsonb, 100, 'teste', 0, 1, 'ATIVO', $4, true, $4, $4)
     RETURNING id`,
    [chaveItem, numeroConvenio, uf, agora]
  );
  const itemId = Number(item.rows[0].id);
  await query(
    `INSERT INTO profor_2022_item_rateios
       (item_conhecido_id, chave_item, area, natureza, quantidade_referencia,
        valor_previsto_referencia, valor_executado_referencia, percentual_quantidade,
        percentual_valor, ativo, criado_em, atualizado_em)
     VALUES ($1, $2, 'OUVIDORIA', 'CAPITAL', 1, 100, 0, 100, 100, true, $3, $3)`,
    [itemId, chaveItem, agora]
  );
  return itemId;
}

test.after(async () => {
  if (process.env.DATABASE_URL) {
    try { await limparDadosTeste(); } catch (_) { /* best-effort */ }
    await closePool();
  }
});

// ---------------------------------------------------------------------------
// interpretarRegistro / normalizarAreaPayload (puros, sem banco)
// ---------------------------------------------------------------------------

test("normalizarAreaPayload converte 'ESCOLA PENAL' e 'ESCOLA' para ESCOLA_PENAL", () => {
  assert.equal(normalizarAreaPayload("ESCOLA PENAL"), "ESCOLA_PENAL");
  assert.equal(normalizarAreaPayload("ESCOLA"), "ESCOLA_PENAL");
  assert.equal(normalizarAreaPayload("CORREGEDORIA"), "CORREGEDORIA");
  assert.equal(normalizarAreaPayload("NAO INFORMADO"), "NAO_CLASSIFICADO");
  assert.equal(normalizarAreaPayload(""), "NAO_CLASSIFICADO");
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

test("interpretarRegistro tolera payload jsonb ja desserializado (objeto)", () => {
  // O driver pg devolve colunas jsonb como objeto JS, nao string. interpretarRegistro
  // precisa aceitar ambos os formatos sem quebrar.
  const linha = {
    divergencia_id: 9, decisao_id: 9,
    numero_convenio: "937221", uf: "AL",
    chave_item: "937221::OBJ",
    tipo_alerta: "item_novo_sem_rateio",
    divergencia_payload_json: { descricaoPad: "Objeto", naturezaPad: "CAPITAL", quantidadePad: 1, valorUnitarioPad: 10 },
    decisao: "ACEITO",
    decisao_payload_json: {
      tipoSaneamento: "rateio_manual",
      quantidadeTotalItem: 1,
      rateio: [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 1, percentualQuantidade: 100 }],
    },
    decisao_decidido_em: "2026-05-21T10:00:00.000Z",
  };
  const i = interpretarRegistro(linha);
  assert.equal(i.aplicavel, true, `esperava aplicavel; motivo=${i.motivo}`);
  assert.equal(i.linhasPersistencia[0].area, "OUVIDORIA");
  assert.equal(i.linhasPersistencia[0].quantidade, 1);
});

// ---------------------------------------------------------------------------
// Script: trava de seguranca e dry-run padrao (sem banco)
// ---------------------------------------------------------------------------

test("obterArgumentos: sem flags assume dry-run", () => {
  const original = process.argv;
  try {
    process.argv = ["node", "script"];
    const opcoes = obterArgumentos();
    assert.equal(opcoes.dryRun, true);
    assert.equal(opcoes.aplicar, false);
  } finally {
    process.argv = original;
  }
});

test("script --aplicar e bloqueado sem CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS=SIM", async () => {
  const argvOriginal = process.argv;
  const confirmacaoOriginal = process.env.CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS;
  try {
    process.argv = ["node", "script", "--aplicar"];
    delete process.env.CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS;
    await assert.rejects(
      () => executar(),
      /CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS=SIM|confirmacao explicita/i
    );
  } finally {
    process.argv = argvOriginal;
    if (confirmacaoOriginal === undefined) delete process.env.CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS;
    else process.env.CONFIRMAR_SANEAMENTO_DECISOES_ANTIGAS = confirmacaoOriginal;
  }
});

// ---------------------------------------------------------------------------
// Planejamento / verificacao / aplicacao (integrados Postgres)
// ---------------------------------------------------------------------------

testPostgres("identifica decisao ACEITO/rateio_manual como candidata", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221",
    uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::AR CONDICIONADO SPLIT 60.000 BTUS`,
    descricaoPad: "Ar condicionado Split 60.000 BTUs (ESCOLA)",
    rateio: [{ area: "ESCOLA PENAL", natureza: "CAPITAL", quantidade: 1, percentualQuantidade: 100 }],
  });

  const plano = await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  assert.equal(plano.candidatas.length, 1);
  assert.equal(plano.jaMaterializadas.length, 0);
  assert.equal(plano.ignoradas.length, 0);
  const c = plano.candidatas[0];
  assert.equal(c.contexto.numeroConvenio, "T937221");
  assert.equal(c.contexto.chaveItem, `${PREFIXO_TESTE}::AR CONDICIONADO SPLIT 60.000 BTUS`);
  assert.equal(c.linhasPersistencia.length, 1);
  assert.equal(c.linhasPersistencia[0].area, "ESCOLA_PENAL");
});

testPostgres("decisao REJEITADO/PENDENTE nao gera candidata", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::R1`, descricaoPad: "Rejeitado", decisao: "REJEITADO",
  });
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::R2`, descricaoPad: "Pendente", decisao: "PENDENTE",
  });
  const plano = await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 2);
  assert.ok(plano.ignoradas.every((i) => i.motivo === "decisao_nao_resolutiva"));
});

testPostgres("tipoSaneamento diferente de rateio_manual e ignorado", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::X`, descricaoPad: "Liberacao",
    tipoSaneamento: "liberacao_item_nao_apto",
  });
  const plano = await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 1);
  assert.equal(plano.ignoradas[0].motivo, "tipo_saneamento_diferente");
});

testPostgres("filtro por convenio funciona", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({ numeroConvenio: "T937221", uf: "AL", chaveItem: `${PREFIXO_TESTE}::A`, descricaoPad: "A" });
  await inserirDivergenciaComDecisao({ numeroConvenio: "T937782", uf: "AC", chaveItem: `${PREFIXO_TESTE}::B`, descricaoPad: "B" });
  await inserirDivergenciaComDecisao({ numeroConvenio: "T999999", uf: "ZZ", chaveItem: `${PREFIXO_TESTE}::C`, descricaoPad: "C" });

  const planoAmbos = await planejarSaneamentoDecisoesAntigas({ convenios: ["T937221", "T937782"] });
  assert.equal(planoAmbos.candidatas.length, 2);

  const planoSo221 = await planejarSaneamentoDecisoesAntigas({ convenios: ["T937221"] });
  assert.equal(planoSo221.candidatas.length, 1);
});

testPostgres("verificarMaterializacao detecta item com rateio ativo", async () => {
  await limparDadosTeste();
  const chaveItem = `${PREFIXO_TESTE}::MAT`;
  const itemId = await inserirItemMaterializado({ chaveItem, numeroConvenio: "T937221", uf: "AL" });

  const estado = await verificarMaterializacao(chaveItem);
  assert.equal(estado.itemConhecidoId, itemId);
  assert.equal(estado.possuiRateioAtivo, true);

  const inexistente = await verificarMaterializacao(`${PREFIXO_TESTE}::NAO_EXISTE`);
  assert.equal(inexistente.itemConhecidoId, null);
  assert.equal(inexistente.possuiRateioAtivo, false);
});

testPostgres("ja materializadas nao sao reaplicadas (idempotencia por chave_item)", async () => {
  await limparDadosTeste();
  const chaveItem = `${PREFIXO_TESTE}::JA_EXISTE`;
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL", chaveItem, descricaoPad: "Item ja materializado",
  });
  const itemId = await inserirItemMaterializado({ chaveItem, numeroConvenio: "T937221", uf: "AL" });

  const plano = await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.jaMaterializadas.length, 1);
  assert.equal(plano.jaMaterializadas[0].estadoAtual.itemConhecidoId, itemId);
});

testPostgres("payload com soma de rateio diferente da quantidade total e ignorado", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::SOMA_ERRADA`,
    descricaoPad: "Quantidade incoerente",
    quantidadePad: 5,
    quantidadeTotalItem: 5,
    rateio: [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 2, percentualQuantidade: 40 }],
  });
  const plano = await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  assert.equal(plano.candidatas.length, 0);
  assert.equal(plano.ignoradas.length, 1);
  assert.equal(plano.ignoradas[0].motivo, "soma_rateio_diferente_quantidade");
});

testPostgres("aplicarSaneamentoDecisoesAntigas aguarda persistencia (mock) e materializa", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937782", uf: "AC",
    chaveItem: `${PREFIXO_TESTE}::NOTEBOOK 4 NUCLEOS`,
    descricaoPad: "Notebook 4 núcleos",
    quantidadePad: 2,
    valorUnitarioPad: 3500,
    rateio: [{ area: "OUVIDORIA", natureza: "CAPITAL", quantidade: 2, percentualQuantidade: 100 }],
  });

  const chamadas = [];
  // Mock de persistencia: evita escrita real de saneamento mas exercita o await.
  const persistirFake = async ({ contexto, linhas, evento, detalhe }) => {
    chamadas.push({ contexto, linhas, evento, detalhe });
    return 42;
  };

  const resultado = await aplicarSaneamentoDecisoesAntigas({
    convenios: CONVENIOS_TESTE,
    persistirRateiosOperacionais: persistirFake,
  });

  assert.equal(resultado.aplicadas.length, 1);
  assert.equal(resultado.aplicadas[0].itemConhecidoId, 42);
  assert.equal(resultado.aplicadas[0].chaveItem, `${PREFIXO_TESTE}::NOTEBOOK 4 NUCLEOS`);
  assert.equal(resultado.erros.length, 0);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].evento, "MATERIALIZAR_DECISAO_ANTIGA_RATEIO_MANUAL");
  assert.equal(chamadas[0].linhas[0].area, "OUVIDORIA");
  assert.equal(chamadas[0].linhas[0].quantidade, 2);
});

testPostgres("dry-run (planejar) nao escreve itens/rateios", async () => {
  await limparDadosTeste();
  await inserirDivergenciaComDecisao({
    numeroConvenio: "T937221", uf: "AL",
    chaveItem: `${PREFIXO_TESTE}::DRYRUN`, descricaoPad: "Teste dry-run",
  });
  const antes = await query(
    "SELECT COUNT(*) AS n FROM profor_2022_itens_conhecidos WHERE chave_item LIKE $1",
    [`${PREFIXO_TESTE}%`]
  );
  await planejarSaneamentoDecisoesAntigas({ convenios: CONVENIOS_TESTE });
  const depois = await query(
    "SELECT COUNT(*) AS n FROM profor_2022_itens_conhecidos WHERE chave_item LIKE $1",
    [`${PREFIXO_TESTE}%`]
  );
  assert.equal(Number(depois.rows[0].n), Number(antes.rows[0].n));
});

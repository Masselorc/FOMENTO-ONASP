const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const raiz = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(raiz, 'frontend/js/app.js'), 'utf8');
const service = fs.readFileSync(path.join(raiz, 'backend/services/orcamento-2026-service.js'), 'utf8');

function extrair(codigo, nome) {
  const inicio = codigo.search(new RegExp(`(?:async )?function ${nome}\\(`));
  assert.ok(inicio >= 0, nome);
  const resto = codigo.slice(inicio);
  const fim = resto.slice(1).search(/\n(?:        )?(?:async )?function /);
  return fim < 0 ? resto : resto.slice(0, fim + 1);
}

test('datas ISO e brasileiras preservam o dia e limpar permanece como alteração', () => {
  const ctx = vm.createContext({ orcamentoAlteracoesPendentes: {}, campoBooleanoOrcamento: () => false });
  for (const nome of ['obterPartesDataOrcamento', 'normalizarDataInputOrcamento', 'normalizarDataBancoOrcamento', 'registrarAlteracaoOrcamento']) {
    vm.runInContext(extrair(app, nome), ctx);
  }
  assert.equal(ctx.normalizarDataInputOrcamento('2026-02-19T03:00:00.000Z'), '19/02/2026');
  assert.equal(ctx.normalizarDataBancoOrcamento('19/02/2026'), '2026-02-19');
  assert.equal(ctx.obterPartesDataOrcamento('31/02/2026'), null);
  ctx.registrarAlteracaoOrcamento('teste', 'data_pesquisa_precos', '2026-03-12T03:00:00.000Z', '2026-03-12');
  assert.equal(ctx.orcamentoAlteracoesPendentes.teste, undefined);
  ctx.registrarAlteracaoOrcamento('teste', 'data_pesquisa_precos', '2026-03-12T03:00:00.000Z', '');
  ctx.registrarAlteracaoOrcamento('teste', 'pesquisa_precos', 'Documento teste', '');
  assert.equal(ctx.orcamentoAlteracoesPendentes.teste.data_pesquisa_precos, '');
  assert.equal(ctx.orcamentoAlteracoesPendentes.teste.pesquisa_precos, '');
});

test('backfill repetido preserva campos apagados com histórico e importa campos nunca editados', async () => {
  const atual = { id: 'teste', pesquisa_precos: '', data_pesquisa_precos: null, contrato: '' };
  const updates = [];
  const client = { query: async (sql, params) => {
    if (sql.includes('SELECT *')) return { rows: [atual] };
    if (sql.includes('SELECT DISTINCT campo')) {
      assert.deepEqual(Array.from(params), ['orcamento-2026', 'teste']);
      return { rows: [{ campo: 'pesquisa_precos' }, { campo: 'data_pesquisa_precos' }] };
    }
    if (sql.includes('UPDATE')) { updates.push(sql); atual.contrato = params[0]; }
    return { rows: [] };
  } };
  const ctx = vm.createContext({
    PAGINA: 'orcamento-2026', COLUNAS_ORCAMENTO: Object.keys(atual), ALIASES_CAMPOS_EDITAVEIS: {},
    CAMPOS_BACKFILL_SE_NAO_PREENCHIDOS: ['pesquisa_precos', 'data_pesquisa_precos', 'contrato'],
    obterRegistrosIniciaisDaPlanilha: () => [{ id: 'teste', pesquisa_precos: 'Antigo', data_pesquisa_precos: '2026-03-12', contrato: 'Importado' }],
    withTransaction: async (fn) => fn(client)
  });
  for (const nome of ['valorAtualVazio', 'devePreencherBackfill', 'executarBackfillOrcamento']) vm.runInContext(extrair(service, nome), ctx);
  await ctx.executarBackfillOrcamento();
  await ctx.executarBackfillOrcamento();
  assert.equal(atual.pesquisa_precos, '');
  assert.equal(atual.data_pesquisa_precos, null);
  assert.equal(atual.contrato, 'Importado');
  assert.equal(updates.length, 1);
  assert.doesNotMatch(updates[0], /pesquisa_precos/);
});

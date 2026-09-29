const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const raiz = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(raiz, 'frontend/js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'frontend/css/app.css'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

function obterFuncao(nome) {
  const inicio = app.indexOf(`        function ${nome}(`);
  assert.notEqual(inicio, -1, `Função ${nome} não encontrada`);
  const fim = app.indexOf('\n        }', inicio);
  assert.notEqual(fim, -1, `Fim da função ${nome} não encontrado`);
  return app.slice(inicio, fim + '\n        }'.length);
}

test('datas de execução usam America/Sao_Paulo e meses usam calendário civil UTC', () => {
  const codigo = [
    obterFuncao('dataSaoPauloHistoricoPad'),
    obterFuncao('mesVizinhoHistoricoPad'),
    '({ dataSaoPauloHistoricoPad, mesVizinhoHistoricoPad })',
  ].join('\n');
  const helpers = vm.runInNewContext(codigo, { Date, Intl });
  assert.equal(helpers.dataSaoPauloHistoricoPad('2026-09-30T02:30:00.000Z'), '2026-09-29');
  assert.equal(helpers.dataSaoPauloHistoricoPad('2026-09-30T03:30:00.000Z'), '2026-09-30');
  assert.equal(helpers.mesVizinhoHistoricoPad('2026-12', 1), '2027-01');
  assert.equal(helpers.mesVizinhoHistoricoPad('2026-01', -1), '2025-12');
});

test('ID inválido é descartado e a URL preserva parâmetros alheios', () => {
  const window = {
    location: { href: 'http://localhost:3000/index.html?debugPerf=1&outro=abc' },
    history: { state: null },
  };
  window.history.pushState = (_estado, _titulo, url) => { window.location.href = String(url); };
  window.history.replaceState = window.history.pushState;
  const codigo = [
    obterFuncao('idHistoricoPadValido'),
    obterFuncao('sincronizarUrlRegistrosPadProfor2022'),
    obterFuncao('limparUrlRegistrosPadProfor2022'),
    '({ idHistoricoPadValido, sincronizarUrlRegistrosPadProfor2022, limparUrlRegistrosPadProfor2022 })',
  ].join('\n');
  const helpers = vm.runInNewContext(codigo, { window, URL });
  for (const id of ['0', '-1', 'texto', '2x', '9007199254740992']) {
    assert.equal(helpers.idHistoricoPadValido(id), null);
  }
  helpers.sincronizarUrlRegistrosPadProfor2022({ atualizacaoId: 123 });
  let parametros = new URL(window.location.href).searchParams;
  assert.equal(parametros.get('proforSubview'), 'registros-pad');
  assert.equal(parametros.get('registroPadId'), '123');
  assert.equal(parametros.get('debugPerf'), '1');
  helpers.sincronizarUrlRegistrosPadProfor2022({ atualizacaoId: 'inválido', replace: true });
  parametros = new URL(window.location.href).searchParams;
  assert.equal(parametros.has('registroPadId'), false);
  helpers.limparUrlRegistrosPadProfor2022({ replace: true });
  parametros = new URL(window.location.href).searchParams;
  assert.equal(parametros.has('proforSubview'), false);
  assert.equal(parametros.get('outro'), 'abc');
});

test('calendário marca execuções e falhas sem marcar dias vazios', () => {
  const contexto = {
    Date, Intl,
    proforPadHistoricoMes: '2026-09',
    proforPadHistoricoDataSelecionada: '2026-09-29',
    proforPadHistoricoDias: [{ data: '2026-09-29', totalExecucoes: 2, falhas: 1 }],
    proforPadHistoricoCarregando: { mes: false },
    proforPadHistoricoErros: { mes: '' },
    escapeHtml: (valor) => String(valor),
    textoHistoricoPad: (valor) => String(valor),
  };
  const renderizar = vm.runInNewContext(`${obterFuncao('montarCalendarioHistoricoPad')}\nmontarCalendarioHistoricoPad`, contexto);
  const comExecucao = renderizar();
  assert.equal((comExecucao.match(/data-historico-acao="dia"/g) || []).length, 30);
  assert.equal((comExecucao.match(/profor-pad-historico-calendar-dot/g) || []).length, 1);
  assert.match(comExecucao, /data-data="2026-09-29"[^>]*aria-current="date"/);
  assert.match(comExecucao, /profor-pad-historico-calendar-failure/);
  contexto.proforPadHistoricoDias = [];
  const vazio = renderizar();
  assert.match(vazio, /Nenhuma atualização registrada neste mês/);
  assert.doesNotMatch(vazio, /profor-pad-historico-calendar-dot/);
});

test('cards Antes/Depois exibem alteração, novo pendente e removido', () => {
  const codigo = [
    obterFuncao('campoAlteradoHistoricoPad'),
    obterFuncao('montarCardAlteracaoHistoricoPad'),
    'montarCardAlteracaoHistoricoPad',
  ].join('\n');
  const renderizar = vm.runInNewContext(codigo, {
    Object,
    escapeHtml: (valor) => String(valor),
    textoHistoricoPad: (valor) => String(valor ?? '—'),
    dinheiroHistoricoPad: (valor) => valor == null ? '—' : `R$ ${valor}`,
  });
  const base = { numeroConvenio: '123/2022', uf: 'GO', descricaoAnterior: 'Notebook', descricaoNova: 'Notebook' };
  const alterado = renderizar({ ...base, tipo: 'ALTERADO', camposAlterados: ['quantidade'], itemAnterior: { quantidade: 10 }, itemNovo: { quantidade: 12 } }, 0);
  assert.match(alterado, /is-changed[\s\S]*Quantidade[\s\S]*10[\s\S]*12/);
  const novo = renderizar({ ...base, tipo: 'NOVO', classificacaoEstado: 'PENDENTE_REVISAO', areaNova: 'NAO_CLASSIFICADO', itemNovo: { quantidade: 1 } }, 1);
  assert.match(novo, /Item inexistente no snapshot anterior/);
  assert.match(novo, /Classificação pendente/);
  const removido = renderizar({ ...base, tipo: 'REMOVIDO', itemAnterior: { quantidade: 2 } }, 2);
  assert.match(removido, /Item não consta mais no PAD atual/);
});

test('cards da data distinguem COM_ALTERACOES, SEM_ALTERACOES e FALHOU', () => {
  const renderizar = vm.runInNewContext(`${obterFuncao('montarCardExecucaoHistoricoPad')}\nmontarCardExecucaoHistoricoPad`, {
    proforPadHistoricoAtualizacaoSelecionada: null,
    textoHistoricoPad: (valor) => String(valor ?? '—'),
    formatarHoraHistoricoPad: () => '09:14',
    duracaoHistoricoPad: () => '30 s',
    dinheiroHistoricoPad: () => 'R$ 10,00',
    idHistoricoPadValido: (id) => id,
  });
  const base = { id: 8, origem: 'TRANSFEREGOV', status: 'CONCLUIDA', totalItensAntes: 3, totalItensDepois: 4 };
  assert.match(renderizar({ ...base, resultado: 'COM_ALTERACOES', totalNovos: 2, totalRemovidos: 1, totalAlterados: 3 }), /\+2 novos · -1 removidos · 3 alterados/);
  assert.match(renderizar({ ...base, resultado: 'SEM_ALTERACOES' }), /Nenhuma alteração identificada\.[\s\S]*Ver registro/);
  const falha = renderizar({ ...base, status: 'FALHOU', resultado: null, mensagemErro: 'Falha técnica' });
  assert.match(falha, /Atualização não concluída/);
  assert.match(falha, /Falha técnica/);
  assert.match(falha, /is-failure/);
});

test('CTA abre ID concluído inclusive SEM_ALTERACOES e ignora erro', () => {
  const botoes = [];
  const container = { querySelector: () => null, append: (filho) => botoes.push(filho) };
  const document = {
    getElementById: () => container,
    createElement: () => ({
      filhos: [],
      append(...filhos) { this.filhos.push(...filhos); },
      addEventListener(_tipo, acao) { this.acao = acao; },
    }),
  };
  let aberto = null;
  const renderizar = vm.runInNewContext([
    obterFuncao('idHistoricoPadValido'),
    obterFuncao('renderizarCtaHistoricoPadAtualizacao'),
    'renderizarCtaHistoricoPadAtualizacao',
  ].join('\n'), {
    document,
    estaEmModoPublicacaoEstatica: () => false,
    abrirRegistrosPadProfor2022: (opcoes) => { aberto = opcoes.atualizacaoId; },
  });
  renderizar({ status: 'erro', registroPadId: 21, resultadoHistorico: 'COM_ALTERACOES' });
  assert.equal(botoes.length, 0);
  renderizar({ status: 'concluido', registroPadId: 21, resultadoHistorico: 'SEM_ALTERACOES' });
  assert.equal(botoes.length, 1);
  assert.match(botoes[0].filhos[0].textContent, /Nenhuma alteração identificada/);
  botoes[0].filhos[1].acao();
  assert.equal(aberto, 21);
  renderizar({ status: 'concluido', registroPadId: 22, resultadoHistorico: 'COM_ALTERACOES' });
  assert.equal(botoes.length, 2);
  botoes[1].filhos[1].acao();
  assert.equal(aberto, 22);
});

test('subview interna usa somente o main PROFOR, calendário, filtros e três consultas existentes', () => {
  assert.match(app, /let profor2022Subview = 'principal'/);
  assert.match(app, /if \(profor2022Subview === 'registros-pad'\)/);
  assert.match(app, /Registros do PAD/);
  assert.match(app, /Mês anterior/);
  assert.match(app, /Mês seguinte/);
  assert.match(app, /data-historico-acao="dia"/);
  assert.match(app, /new Date\(Date\.UTC\(ano, numeroMes - 1, 1\)\)/);
  for (const campo of ['uf', 'convenio', 'tipo', 'area']) assert.match(app, new RegExp(`name="${campo}"`));
  for (const valor of ['OUVIDORIA', 'CORREGEDORIA', 'ESCOLA_PENAL', 'NAO_CLASSIFICADO', 'NOVO', 'REMOVIDO', 'ALTERADO']) {
    assert.ok(app.includes(`'${valor}'`), valor);
  }
  assert.match(app, /new URLSearchParams\(\{ mes \}\)/);
  assert.match(app, /new URLSearchParams\(\{ data: proforPadHistoricoDataSelecionada \}\)/);
  assert.match(app, /CAMINHO_HISTORICO_PAD_PROFOR\}\/\$\{id\}/);
  assert.match(html, /<main id="view-profor-2022"/);
  assert.doesNotMatch(html, /id="view-registros-pad"/);
  assert.doesNotMatch(app, /snapshot_json|snapshotJson|snapshotIntegral/);
});

test('detalhe cobre mudança, ausência, falha e metadados sem download de snapshot', () => {
  for (const trecho of [
    'SEM_ALTERACOES', 'FALHOU', 'Nenhuma alteração identificada.',
    'Item inexistente no snapshot anterior', 'Item não consta mais no PAD atual',
    'Classificação pendente', 'camposAlterados', 'itemAnterior', 'itemNovo',
    'ANTES', 'DEPOIS', 'checksum', 'aria-expanded', 'role="status"', 'role="alert"',
  ]) assert.ok(app.includes(trecho), trecho);
  assert.doesNotMatch(app, /baixar snapshot|download.*snapshot/i);
});

test('CTA usa resultado do polling e só aparece após conclusão com registro', () => {
  assert.match(app, /statusFinal\.registroPadId|statusFinal\?\.registroPadId/);
  assert.match(app, /statusFinal\.resultadoHistorico/);
  assert.match(app, /statusFinal\?\.status !== 'concluido'/);
  assert.match(app, /statusFinal\.status === 'erro'/);
  assert.match(app, /Ver alterações/);
  assert.match(app, /abrirRegistrosPadProfor2022\(\{ atualizacaoId: id \}\)/);
  assert.match(app, /renderResultadoRecargaPad\(recarga\)/);
  assert.match(app, /renderizarCtaHistoricoPadAtualizacao\(statusFinal\)/);
});

test('refresh, popstate, 404 e modo estático têm guardas específicos', () => {
  assert.match(app, /DOMContentLoaded/);
  assert.match(app, /restaurarDeepLinkHistoricoPadProfor2022\(\)/);
  assert.match(app, /addEventListener\('popstate'/);
  assert.match(app, /Registro histórico não encontrado\./);
  assert.match(app, /if \(estaEmModoPublicacaoEstatica\(\)\) return null;/);
  assert.match(app, /if \(estaEmModoPublicacaoEstatica\(\)\) return;/);
  assert.match(app, /\$\{!estaEmModoPublicacaoEstatica\(\) \? `<button/);
});

test('CSS do histórico é isolado, responsivo e tem foco visível', () => {
  assert.match(css, /\.profor-pad-historico-layout/);
  assert.match(css, /\.profor-pad-historico-calendar-day/);
  assert.match(css, /\.profor-pad-historico-execution-card/);
  assert.match(css, /\.profor-pad-historico-change-card/);
  assert.match(css, /\.profor-pad-historico-compare-row/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /\.profor-pad-historico-calendar-day:focus-visible/);
});

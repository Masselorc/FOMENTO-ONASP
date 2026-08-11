const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(raiz, 'frontend/js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'frontend/css/app.css'), 'utf8');

test('Parâmetros Mínimos oferece edição explícita e todos os estados auditáveis', () => {
  assert.match(app, /Alterar status/);
  assert.match(app, /Salvar agora/);
  assert.match(app, /data-parametros-salvar-item/);
  assert.match(app, /\{ valor: 'TEM', rotulo: 'Em conformidade'/);
  assert.match(app, /\{ valor: 'NÃO TEM', rotulo: 'Pendente'/);
  assert.match(app, /\{ valor: 'PARCIAL', rotulo: 'Parcial'/);
  assert.match(app, /\{ valor: 'VALIDAR', rotulo: 'Validar'/);
  assert.match(app, /\{ valor: 'NÃO INFORMADO', rotulo: 'Não informado'/);
});

test('normalização reconhece os rótulos exibidos sem converter badges em Não informado', () => {
  assert.match(app, /'em conformidade': 'TEM'/);
  assert.match(app, /pendente: 'NÃO TEM'/);
  assert.match(app, /anterior: statusParametroMinimoParaTela\(statusAnterior\)/);
  assert.match(app, /novo: `\$\{statusParametroMinimoParaTela\(statusNovo\)\}/);
});

test('publicação mantém edição protegida e orienta uso do ambiente autenticado', () => {
  assert.match(app, /Consulta pública/);
  assert.match(app, /Edição protegida/);
  assert.match(app, /aplicação local autenticada/);
});

test('Parâmetros Mínimos concentra indicador e lista verificável de institucionalização', () => {
  assert.doesNotMatch(html, /dashboard-institutionalization-card/);
  assert.match(app, /renderizarResumoInstitucionalizacaoParametrosMinimos\(dados\)/);
  assert.match(app, /Institucionalização das ouvidorias/);
  assert.match(app, /btnParametrosInstitucionalizacaoLista/);
  assert.match(app, /data-parametros-institutionalization-state/);
  assert.match(app, /Abrir ficha/);
});

test('camada visual profissionaliza o checklist e preserva responsividade', () => {
  assert.match(css, /\.parametros-institutionalization-overview\s*\{/);
  assert.match(css, /#view-diagnostico-ouvidorias \.diagnostico-trail-groups/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /min-height: 2\.75rem/);
});

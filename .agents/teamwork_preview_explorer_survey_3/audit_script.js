const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const dir = path.join(projectRoot, 'frontend', 'data', 'publicados');

const files = [
  'aplicacao.json',
  'dashboard-geral.json',
  'parametros-minimos.json',
  'formalizacao-profor.json',
  'orcamento-2026.json',
  'contatos.json',
  'resumo-publicacao.json'
];

console.log('=== VERIFICAÇÃO DE ESTRUTURA E VALORES CONTRATUAIS ===\n');

// 1. aplicacao.json
const aplicacao = JSON.parse(fs.readFileSync(path.join(dir, 'aplicacao.json'), 'utf8'));
console.log('1. aplicacao.json:');
console.log('- dadosBase length:', aplicacao.dadosBase?.length);
console.log('- dadosProfor2022 convenios length:', aplicacao.dadosProfor2022?.convenios?.length);
console.log('- metadadosPublicacao:', aplicacao.metadadosPublicacao);

// 2. dashboard-geral.json
const dashboard = JSON.parse(fs.readFileSync(path.join(dir, 'dashboard-geral.json'), 'utf8'));
console.log('\n2. dashboard-geral.json:');
console.log('- publicadoEm:', dashboard.publicadoEm);
console.log('- resumoEsperado:', JSON.stringify(dashboard.resumoEsperado, null, 2));

// 3. parametros-minimos.json
const parametros = JSON.parse(fs.readFileSync(path.join(dir, 'parametros-minimos.json'), 'utf8'));
console.log('\n3. parametros-minimos.json:');
console.log('- respostas length:', parametros.respostas?.length);
console.log('- totalRespostas:', parametros.resumo?.totalRespostas);
console.log('- ufsDiagnosticadas:', parametros.resumo?.ufsDiagnosticadas);
console.log('- unidadesDiagnosticadas:', parametros.resumo?.unidadesDiagnosticadas);

// 4. formalizacao-profor.json
const formalizacao = JSON.parse(fs.readFileSync(path.join(dir, 'formalizacao-profor.json'), 'utf8'));
console.log('\n4. formalizacao-profor.json:');
console.log('- propostas length:', formalizacao.propostas?.length);
console.log('- ufsAutorizadas:', formalizacao.ufsAutorizadas);
console.log('- totalPropostas:', formalizacao.resumo?.totalPropostas);
console.log('- totalRepasse:', formalizacao.resumo?.totalRepasse);

// 5. orcamento-2026.json
const orcamento = JSON.parse(fs.readFileSync(path.join(dir, 'orcamento-2026.json'), 'utf8'));
console.log('\n5. orcamento-2026.json:');
console.log('- itens length:', orcamento.itens?.length);
console.log('- itensOficiais length:', orcamento.itensOficiais?.length);
console.log('- outrosProcessos length:', orcamento.outrosProcessos?.length);
console.log('- resumoFrentes length:', orcamento.resumoFrentes?.length);
console.log('- Frentes:', orcamento.resumoFrentes?.map(f => `${f.nome}: R$ ${f.valorDisponivel}`));
console.log('- totalGeral:', orcamento.resumo?.totalGeral);

// 6. contatos.json
const contatos = JSON.parse(fs.readFileSync(path.join(dir, 'contatos.json'), 'utf8'));
console.log('\n6. contatos.json:');
console.log('- cadastroPorUf length:', contatos.cadastroPorUf?.length);
console.log('- pessoasPorUf length:', contatos.pessoasPorUf?.length);
console.log('- totais:', contatos.totais);

// 7. resumo-publicacao.json
const resumo = JSON.parse(fs.readFileSync(path.join(dir, 'resumo-publicacao.json'), 'utf8'));
console.log('\n7. resumo-publicacao.json:');
console.log('- publicadoEm:', resumo.publicadoEm);
console.log('- arquivos:', resumo.arquivos);
console.log('- totais:', JSON.stringify(resumo.totais, null, 2));

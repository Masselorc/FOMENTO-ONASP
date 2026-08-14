const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { listarContatosPublicos } = require("../../backend/services/contatos-publication-service");

function criarWorkbookContatos() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    UF: "DF",
    Estado: "Distrito Federal",
    "Órgão_Entidade": "Órgão institucional",
    Nome_Titular: "Pessoa Titular",
    CPF_Titular: "000.000.000-00",
    Celular_Titular: "(61) 99999-9999",
    Telefone_Titular: "(61) 3000-0000",
    Email_Titular: "institucional@example.gov.br",
    Tratamento_Destinatario: "Senhor"
  }]), "Contatos_UF");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    UF: "DF",
    Papel: "Ponto focal",
    Nome: "Pessoa de Referência",
    CPF: "111.111.111-11",
    "Telefone/Contato": "(61) 3000-0001",
    "E-mail": "referencia@example.gov.br",
    Endereco_Destinatario: "Endereço interno"
  }]), "Contatos_Pessoas");
  return workbook;
}

test("publicacao de contatos usa lista positiva e exclui dados sensiveis", () => {
  const dados = listarContatosPublicos({ workbook: criarWorkbookContatos() });
  const cadastro = dados.cadastroPorUf[0];
  const pessoa = dados.pessoasPorUf[0];

  assert.equal(dados.disponivel, true);
  assert.equal(dados.totais.ufs, 1);
  assert.equal(cadastro.telefoneInstitucional, "(61) 3000-0000");
  assert.equal(pessoa.email, "referencia@example.gov.br");
  assert.equal(Object.hasOwn(cadastro, "cpfTitular"), false);
  assert.equal(Object.hasOwn(cadastro, "celularTitular"), false);
  assert.equal(Object.hasOwn(cadastro, "tratamentoDestinatario"), false);
  assert.equal(Object.hasOwn(pessoa, "cpf"), false);
  assert.equal(Object.hasOwn(pessoa, "enderecoDestinatario"), false);
  assert.doesNotMatch(JSON.stringify(dados), /000\.000\.000-00|111\.111\.111-11|99999-9999/);
});

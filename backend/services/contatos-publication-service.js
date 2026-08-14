const path = require("path");
const XLSX = require("xlsx");

const arquivoContatos = path.join(__dirname, "..", "..", "Planilhas", "Contatos.xlsx");
const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
]);

function normalizarCabecalho(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function obterValor(linha, alternativas) {
  const indice = new Map(
    Object.entries(linha || {}).map(([chave, valor]) => [normalizarCabecalho(chave), valor])
  );

  for (const alternativa of alternativas) {
    const valor = indice.get(normalizarCabecalho(alternativa));
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }

  return "";
}

function lerLinhas(workbook, nomeAba) {
  const planilha = workbook.Sheets[nomeAba];
  if (!planilha) {
    throw new Error(`A aba ${nomeAba} nao foi encontrada na planilha de contatos.`);
  }

  return XLSX.utils.sheet_to_json(planilha, { defval: "", raw: false });
}

function normalizarUf(linha) {
  const uf = obterValor(linha, ["UF"]).toUpperCase();
  return UFS_VALIDAS.has(uf) ? uf : "";
}

function removerCamposVazios(registro) {
  return Object.fromEntries(
    Object.entries(registro).filter(([, valor]) => valor !== "")
  );
}

function extrairCadastrosPublicos(workbook) {
  return lerLinhas(workbook, "Contatos_UF")
    .map((linha) => {
      const uf = normalizarUf(linha);
      if (!uf) return null;

      const emailTitular = obterValor(linha, ["Email_Titular", "E-mail Titular"]);
      const emailGabinete = obterValor(linha, ["Email_Gabinete", "E-mail Gabinete"]);
      const telefoneTitular = obterValor(linha, ["Telefone_Titular", "Telefone Titular"]);
      const contatoChefe = obterValor(linha, ["Contato_Chefe", "Contato Chefe"]);
      const contatoSecretaria = obterValor(linha, ["Contato_Secretaria", "Contato Secretaria"]);
      const ramaisGabinete = obterValor(linha, ["Ramais_Gabinete", "Ramais Gabinete"]);

      // Lista positiva: CPF, celular pessoal e metadados de expedicao de oficio
      // nunca integram o arquivo exposto no GitHub Pages.
      return removerCamposVazios({
        uf,
        estado: obterValor(linha, ["Estado"]),
        regiao: obterValor(linha, ["Região", "Regiao"]),
        orgao: obterValor(linha, ["Órgão_Entidade", "Órgão Entidade", "Orgao Entidade"]),
        sigla: obterValor(linha, ["Sigla"]),
        tipoOrgao: obterValor(linha, ["Tipo_Órgão", "Tipo Órgão", "Tipo Orgao"]),
        endereco: obterValor(linha, ["Endereço", "Endereco"]),
        cep: obterValor(linha, ["CEP"]),
        cargoTitular: obterValor(linha, ["Cargo_Titular", "Cargo Titular"]),
        nomeTitular: obterValor(linha, ["Nome_Titular", "Nome Titular"]),
        emailInstitucional: emailTitular || emailGabinete,
        telefoneInstitucional: telefoneTitular || contatoChefe || contatoSecretaria || ramaisGabinete
      });
    })
    .filter(Boolean);
}

function extrairPessoasPublicas(workbook) {
  return lerLinhas(workbook, "Contatos_Pessoas")
    .map((linha) => {
      const uf = normalizarUf(linha);
      if (!uf) return null;

      const pessoa = removerCamposVazios({
        uf,
        estado: obterValor(linha, ["Estado"]),
        orgao: obterValor(linha, ["Órgão_Entidade", "Órgão Entidade", "Orgao Entidade"]),
        sigla: obterValor(linha, ["Sigla"]),
        papel: obterValor(linha, ["Papel"]),
        cargo: obterValor(linha, ["Cargo/Função", "Cargo Função", "Cargo Funcao"]),
        nome: obterValor(linha, ["Nome"]),
        telefone: obterValor(linha, ["Telefone/Contato", "Telefone Contato", "Telefone"]),
        email: obterValor(linha, ["E-mail", "Email"])
      });

      return pessoa.papel || pessoa.nome || pessoa.telefone || pessoa.email ? pessoa : null;
    })
    .filter(Boolean);
}

function listarContatosPublicos(opcoes = {}) {
  const caminho = opcoes.arquivoContatos || arquivoContatos;
  const workbook = opcoes.workbook || XLSX.readFile(caminho, { cellDates: false });
  const cadastroPorUf = extrairCadastrosPublicos(workbook);
  const pessoasPorUf = extrairPessoasPublicas(workbook);

  return {
    disponivel: cadastroPorUf.length > 0 || pessoasPorUf.length > 0,
    cadastroPorUf,
    pessoasPorUf,
    totais: {
      ufs: new Set([...cadastroPorUf, ...pessoasPorUf].map((item) => item.uf)).size,
      cadastrosInstitucionais: cadastroPorUf.length,
      contatosNominais: pessoasPorUf.length
    }
  };
}

module.exports = {
  listarContatosPublicos
};

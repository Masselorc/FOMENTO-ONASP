const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "frontend", "data", "publicados");

const arquivosEsperados = [
  "aplicacao.json",
  "dashboard-geral.json",
  "parametros-minimos.json",
  "formalizacao-profor.json",
  "orcamento-2026.json",
  "contatos.json",
  "resumo-publicacao.json"
];

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
]);

const CAMPOS_MONETARIOS_ORCAMENTO = [
  "valor_previsto",
  "valor_disponibilizado",
  "valor_empenhado",
  "valor_executado",
  "valor_estimado_pesquisa_preco",
  "valorPrevisto",
  "valorDisponibilizado",
  "valorEmpenhado",
  "valorExecutado",
  "valorEstimadoPesquisaPreco"
];

function ehObjetoPlano(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function adicionarErro(erros, arquivo, mensagem) {
  erros.push(`${arquivo}: ${mensagem}`);
}

function validarArray(dados, chave, arquivo, erros, { obrigatorio = true, naoVazio = false } = {}) {
  const valor = dados?.[chave];

  if (!obrigatorio && valor === undefined) return null;
  if (!Array.isArray(valor)) {
    adicionarErro(erros, arquivo, `campo ${chave} deve ser array`);
    return null;
  }
  if (naoVazio && valor.length === 0) {
    adicionarErro(erros, arquivo, `campo ${chave} nao pode ser vazio`);
  }

  return valor;
}

function validarObjeto(dados, chave, arquivo, erros, { obrigatorio = true } = {}) {
  const valor = dados?.[chave];

  if (!obrigatorio && valor === undefined) return null;
  if (!ehObjetoPlano(valor)) {
    adicionarErro(erros, arquivo, `campo ${chave} deve ser objeto`);
    return null;
  }

  return valor;
}

function validarPublicadoEmSeExistir(dados, arquivo, erros) {
  if (dados?.publicadoEm !== undefined && (typeof dados.publicadoEm !== "string" || dados.publicadoEm.trim() === "")) {
    adicionarErro(erros, arquivo, "campo publicadoEm deve ser string nao vazia quando existir");
  }
}

function validarUfSeExistir(valor, arquivo, caminho, erros) {
  if (valor === undefined || valor === null || valor === "") return;
  if (typeof valor !== "string") {
    adicionarErro(erros, arquivo, `${caminho} deve ser string de UF`);
    return;
  }
  const ufCompleta = valor.trim().toUpperCase();
  const uf = ufCompleta.split("_")[0];
  if (!UFS_VALIDAS.has(uf)) {
    adicionarErro(erros, arquivo, `${caminho} possui UF invalida: ${valor}`);
  }
}

function validarNumeroNaoNegativoSeExistir(valor, arquivo, caminho, erros) {
  if (valor === undefined || valor === null || valor === "") return;

  let numero = valor;
  if (typeof valor === "string") {
    numero = Number(valor);
  }

  if (!Number.isFinite(numero)) {
    adicionarErro(erros, arquivo, `${caminho} deve ser numero finito quando preenchido`);
    return;
  }

  if (numero < 0) {
    adicionarErro(erros, arquivo, `${caminho} nao pode ser negativo`);
  }
}

function validarStringsSemHtmlPerigoso(valor, arquivo, caminho, erros) {
  if (typeof valor === "string") {
    const texto = valor.toLowerCase();
    if (
      texto.includes("<script") ||
      texto.includes("onerror=") ||
      texto.includes("onload=") ||
      texto.includes("javascript:")
    ) {
      adicionarErro(erros, arquivo, `texto potencialmente perigoso em ${caminho}`);
    }
    return;
  }

  if (Array.isArray(valor)) {
    valor.forEach((item, index) => validarStringsSemHtmlPerigoso(item, arquivo, `${caminho}[${index}]`, erros));
    return;
  }

  if (ehObjetoPlano(valor)) {
    Object.entries(valor).forEach(([chave, item]) => {
      const proximoCaminho = caminho ? `${caminho}.${chave}` : chave;
      validarStringsSemHtmlPerigoso(item, arquivo, proximoCaminho, erros);
    });
  }
}

function validarRegrasGerais(dados, arquivo, erros) {
  if (!ehObjetoPlano(dados)) {
    adicionarErro(erros, arquivo, "JSON raiz deve ser objeto");
    return;
  }

  validarPublicadoEmSeExistir(dados, arquivo, erros);
  validarStringsSemHtmlPerigoso(dados, arquivo, "", erros);
}

function validarAplicacao(dados, arquivo, erros) {
  const dadosBase = validarArray(dados, "dadosBase", arquivo, erros, { obrigatorio: true, naoVazio: true });
  if (!dadosBase) return;

  for (let i = 0; i < dadosBase.length; i += 1) {
    const item = dadosBase[i];
    if (!ehObjetoPlano(item)) {
      adicionarErro(erros, arquivo, `dadosBase[${i}] deve ser objeto`);
      continue;
    }

    const possuiIdentificador = Boolean(item.uf || item.estado || item.instrumento || item.objeto);
    if (!possuiIdentificador && Object.keys(item).length === 0) {
      adicionarErro(erros, arquivo, `dadosBase[${i}] nao pode ser objeto vazio`);
    }

    validarUfSeExistir(item.uf, arquivo, `dadosBase[${i}].uf`, erros);
  }
}

function validarDashboardGeral(dados, arquivo, erros) {
  const dadosBase = validarArray(dados, "dadosBase", arquivo, erros, { obrigatorio: true, naoVazio: true });
  if (!dadosBase) return;

  for (let i = 0; i < dadosBase.length; i += 1) {
    if (!ehObjetoPlano(dadosBase[i])) {
      adicionarErro(erros, arquivo, `dadosBase[${i}] deve ser objeto`);
    }
  }
}

function validarParametrosMinimos(dados, arquivo, erros) {
  const respostas = validarArray(dados, "respostas", arquivo, erros, { obrigatorio: true });
  validarObjeto(dados, "diagnostico", arquivo, erros, { obrigatorio: true });
  const parametrosDisponiveis = validarArray(dados, "parametrosDisponiveis", arquivo, erros, { obrigatorio: false });

  const temResposta = Array.isArray(respostas) && respostas.length > 0;
  const temParametros = Array.isArray(parametrosDisponiveis) && parametrosDisponiveis.length > 0;
  if (!temResposta && !temParametros) {
    adicionarErro(erros, arquivo, "ao menos um entre respostas e parametrosDisponiveis deve ter dados");
  }

  if (Array.isArray(respostas)) {
    respostas.forEach((item, index) => {
      if (!ehObjetoPlano(item)) {
        adicionarErro(erros, arquivo, `respostas[${index}] deve ser objeto`);
        return;
      }
      validarUfSeExistir(item.uf, arquivo, `respostas[${index}].uf`, erros);
    });
  }
}

function validarFormalizacaoProfor(dados, arquivo, erros) {
  const propostas = validarArray(dados, "propostas", arquivo, erros, { obrigatorio: true, naoVazio: true });
  validarArray(dados, "ufs", arquivo, erros, { obrigatorio: false });

  if (Array.isArray(propostas)) {
    propostas.forEach((item, index) => {
      if (!ehObjetoPlano(item)) {
        adicionarErro(erros, arquivo, `propostas[${index}] deve ser objeto`);
        return;
      }
      validarUfSeExistir(item.uf, arquivo, `propostas[${index}].uf`, erros);
    });
  }
}

function validarOrcamento2026(dados, arquivo, erros) {
  const itens = validarArray(dados, "itens", arquivo, erros, { obrigatorio: true, naoVazio: true });
  if (!Array.isArray(itens)) return;

  itens.forEach((item, index) => {
    if (!ehObjetoPlano(item)) {
      adicionarErro(erros, arquivo, `itens[${index}] deve ser objeto`);
      return;
    }

    validarUfSeExistir(item.uf, arquivo, `itens[${index}].uf`, erros);

    for (const campo of CAMPOS_MONETARIOS_ORCAMENTO) {
      if (Object.prototype.hasOwnProperty.call(item, campo)) {
        validarNumeroNaoNegativoSeExistir(item[campo], arquivo, `itens[${index}].${campo}`, erros);
      }
    }
  });
}

function validarContatos(dados, arquivo, erros) {
  const cadastros = validarArray(dados, "cadastroPorUf", arquivo, erros, { obrigatorio: true, naoVazio: true });
  const pessoas = validarArray(dados, "pessoasPorUf", arquivo, erros, { obrigatorio: true });
  const camposPermitidos = {
    cadastroPorUf: new Set([
      "uf", "estado", "regiao", "orgao", "sigla", "tipoOrgao", "endereco", "cep",
      "cargoTitular", "nomeTitular", "emailInstitucional", "telefoneInstitucional"
    ]),
    pessoasPorUf: new Set(["uf", "estado", "orgao", "sigla", "papel", "cargo", "nome", "telefone", "email"])
  };

  for (const [chave, itens] of [["cadastroPorUf", cadastros], ["pessoasPorUf", pessoas]]) {
    if (!Array.isArray(itens)) continue;
    itens.forEach((item, index) => {
      if (!ehObjetoPlano(item)) {
        adicionarErro(erros, arquivo, `${chave}[${index}] deve ser objeto`);
        return;
      }
      validarUfSeExistir(item.uf, arquivo, `${chave}[${index}].uf`, erros);
      for (const campo of Object.keys(item)) {
        if (!camposPermitidos[chave].has(campo)) {
          adicionarErro(erros, arquivo, `${chave}[${index}] expoe campo nao autorizado ${campo}`);
        }
      }
    });
  }
}

function validarResumoPublicacao(dados, arquivo, erros) {
  const arquivos = validarArray(dados, "arquivos", arquivo, erros, { obrigatorio: true, naoVazio: true });
  if (!Array.isArray(arquivos)) return;

  const referencias = new Set();

  arquivos.forEach((item, index) => {
    if (typeof item === "string") {
      const valor = item.trim();
      if (!valor) {
        adicionarErro(erros, arquivo, `arquivos[${index}] deve ser string nao vazia`);
      } else {
        referencias.add(valor);
      }
      return;
    }

    if (!ehObjetoPlano(item)) {
      adicionarErro(erros, arquivo, `arquivos[${index}] deve ser objeto ou string`);
      return;
    }

    const nomeArquivo = item.nomeArquivo || item.arquivo || item.caminho || item.path || item.nome;
    if (typeof nomeArquivo !== "string" || nomeArquivo.trim() === "") {
      adicionarErro(erros, arquivo, `arquivos[${index}] deve informar nome/caminho do arquivo`);
    } else {
      referencias.add(nomeArquivo.trim());
    }

    for (const campoData of ["publicadoEm", "geradoEm", "data"]) {
      if (Object.prototype.hasOwnProperty.call(item, campoData)) {
        if (typeof item[campoData] !== "string" || item[campoData].trim() === "") {
          adicionarErro(erros, arquivo, `arquivos[${index}].${campoData} deve ser string nao vazia`);
        }
      }
    }
  });

  const esperadosSemResumo = arquivosEsperados.filter((nome) => nome !== "resumo-publicacao.json");
  for (const nome of esperadosSemResumo) {
    if (!referencias.has(nome)) {
      adicionarErro(erros, arquivo, `arquivos nao referencia ${nome}`);
    }
  }
}

const erros = [];

for (const nomeArquivo of arquivosEsperados) {
  const caminhoArquivo = path.join(publicDir, nomeArquivo);

  if (!fs.existsSync(caminhoArquivo)) {
    adicionarErro(erros, nomeArquivo, `arquivo ausente: ${path.relative(rootDir, caminhoArquivo)}`);
    continue;
  }

  try {
    const conteudo = fs.readFileSync(caminhoArquivo, "utf8");
    const dados = JSON.parse(conteudo);

    validarRegrasGerais(dados, nomeArquivo, erros);

    if (nomeArquivo === "aplicacao.json") {
      validarAplicacao(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "dashboard-geral.json") {
      validarDashboardGeral(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "parametros-minimos.json") {
      validarParametrosMinimos(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "formalizacao-profor.json") {
      validarFormalizacaoProfor(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "orcamento-2026.json") {
      validarOrcamento2026(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "contatos.json") {
      validarContatos(dados, nomeArquivo, erros);
      continue;
    }

    if (nomeArquivo === "resumo-publicacao.json") {
      validarResumoPublicacao(dados, nomeArquivo, erros);
      continue;
    }
  } catch (error) {
    adicionarErro(erros, nomeArquivo, `JSON invalido (${error.message})`);
  }
}

if (erros.length > 0) {
  console.error("Falha na validacao dos JSONs publicados:");
  erros.forEach((erro) => console.error(`- ${erro}`));
  process.exit(1);
}

console.log("OK: todos os JSONs publicados esperados existem e sao validos.");

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { inicializarBanco } = require("../db/init-db");
const {
  criarConvenioMonitorado,
  obterConvenioMonitoradoPorNumero
} = require("../services/profor-2022/convenios-monitorados-service");

function resolverCaminhoPlanilha() {
  const caminhoConfig = path.join(__dirname, "..", "data", "aplicacao.json");
  try {
    const config = JSON.parse(fs.readFileSync(caminhoConfig, "utf8"));
    const arquivo = config?.configuracao?.arquivoPlanilhaConvenios;
    if (arquivo && typeof arquivo === "string") {
      return path.join(__dirname, "..", "..", arquivo);
    }
  } catch {
    // configuração ausente ou inválida — usar fallback
  }
  return path.join(__dirname, "..", "..", "Planilhas", "gestao_financeira_ouvidoria.xlsx");
}

const CAMINHO_PLANILHA = resolverCaminhoPlanilha();
const ABA_GERAL = "Geral";
const CHAVE_LIBERACAO_IMPORTACAO_LEGADA = "ALLOW_PROFOR_2022_IMPORT_PLANILHA_LEGADA";

// Índices de coluna da aba Geral (espelho de COLUNAS_GERAL_PROFOR em data-service.js)
const COL_UF = 0;
const COL_INSTRUMENTO = 1;
const COL_NUMERO = 2;
const COL_ANO = 3;

// Registro de teste criado durante validação da Etapa 5 — não deve ser tratado como real
const NUMERO_CONVENIO_TESTE = "999999";

function extrairTexto(valor) {
  return String(valor ?? "").trim();
}

function ehNumeroValido(valor) {
  return /^\d+$/.test(valor);
}

function ehAnoValido(valor) {
  return /^\d{4}$/.test(valor);
}

function ehUfValida(valor) {
  return valor.length === 2;
}

function importarCarteira() {
  if (process.env[CHAVE_LIBERACAO_IMPORTACAO_LEGADA] !== "1") {
    throw new Error(
      `Importacao legada bloqueada por padrao. Este script usa a aba "${ABA_GERAL}" da planilha antiga e nao deve ser usado como origem operacional atual.\n` +
      `Se for necessario para desenvolvimento controlado, execute com ${CHAVE_LIBERACAO_IMPORTACAO_LEGADA}=1.`
    );
  }

  inicializarBanco();

  if (!fs.existsSync(CAMINHO_PLANILHA)) {
    throw new Error(
      `Planilha não encontrada: ${CAMINHO_PLANILHA}\n` +
      "Verifique se o arquivo gestao_financeira_ouvidoria.xlsx está na pasta Planilhas/."
    );
  }

  const workbook = XLSX.readFile(CAMINHO_PLANILHA, { raw: true });
  const sheet = workbook.Sheets[ABA_GERAL];

  if (!sheet) {
    throw new Error(
      `Aba "${ABA_GERAL}" não encontrada em: ${CAMINHO_PLANILHA}\n` +
      "O script só pode importar convênios a partir da aba Geral."
    );
  }

  const todasLinhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  // Linha 0 = cabeçalho; dados começam na linha 1
  const linhasDados = todasLinhas.slice(1).filter((linha) => Array.isArray(linha) && linha.some((c) => c !== null));
  const totalLido = linhasDados.length;

  let inseridos = 0;
  let jaExistentesAtivos = 0;
  let jaExistentesInativos = 0;
  let ignoradosPorErro = 0;

  linhasDados.forEach((linha, idx) => {
    const numeroRaw = extrairTexto(linha[COL_NUMERO]);
    const anoRaw = extrairTexto(linha[COL_ANO]);
    const ufRaw = extrairTexto(linha[COL_UF]).toUpperCase();
    const instrumentoRaw = extrairTexto(linha[COL_INSTRUMENTO]);
    const linhaExibicao = idx + 2; // +1 cabeçalho, +1 base-1

    if (!numeroRaw) {
      ignoradosPorErro++;
      return;
    }

    if (numeroRaw === NUMERO_CONVENIO_TESTE) {
      console.log(`  [IGNORADO] Linha ${linhaExibicao}: número de teste ${NUMERO_CONVENIO_TESTE} — não importado.`);
      ignoradosPorErro++;
      return;
    }

    if (!ehNumeroValido(numeroRaw)) {
      console.warn(`  [ERRO] Linha ${linhaExibicao}: número de convênio inválido "${numeroRaw}" — esperado apenas dígitos.`);
      ignoradosPorErro++;
      return;
    }

    const ano = anoRaw || null;
    if (ano && !ehAnoValido(ano)) {
      console.warn(`  [ERRO] Linha ${linhaExibicao}: ano inválido "${ano}" para convênio ${numeroRaw}.`);
      ignoradosPorErro++;
      return;
    }

    const uf = ufRaw || null;
    if (uf && !ehUfValida(uf)) {
      console.warn(`  [ERRO] Linha ${linhaExibicao}: UF inválida "${uf}" para convênio ${numeroRaw}.`);
      ignoradosPorErro++;
      return;
    }

    const existente = obterConvenioMonitoradoPorNumero(numeroRaw, ano);
    if (existente) {
      if (existente.ativo === 0) {
        console.log(`  [INATIVO] Convênio ${numeroRaw}/${ano ?? "s/ano"} já existe inativo (id=${existente.id}) — não reativado.`);
        jaExistentesInativos++;
      } else {
        jaExistentesAtivos++;
      }
      return;
    }

    try {
      criarConvenioMonitorado({
        numero_convenio: numeroRaw,
        ano,
        uf,
        instrumento: instrumentoRaw || "Convênio",
        programa_origem: "PROFOR 2022"
      });
      console.log(`  [OK] Convênio ${numeroRaw}/${ano ?? "s/ano"} (${uf ?? "s/UF"}) inserido.`);
      inseridos++;
    } catch (err) {
      console.error(`  [ERRO] Linha ${linhaExibicao}: ${err.message}`);
      ignoradosPorErro++;
    }
  });

  console.log("\n--- Relatório de importação PROFOR 2022 ---");
  console.log(`Total lido (excl. cabeçalho):    ${totalLido}`);
  console.log(`Inseridos:                        ${inseridos}`);
  console.log(`Já existentes (ativos):           ${jaExistentesAtivos}`);
  console.log(`Já existentes (inativos):         ${jaExistentesInativos}`);
  console.log(`Ignorados por erro ou inválidos:  ${ignoradosPorErro}`);
  console.log("-------------------------------------------\n");

  return { inseridos, jaExistentesAtivos, jaExistentesInativos, ignoradosPorErro, totalLido };
}

if (require.main === module) {
  importarCarteira();
}

module.exports = { importarCarteira };

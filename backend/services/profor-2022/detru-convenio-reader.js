const path = require("path");
const fs = require("fs");

// adm-zip: necessário porque ZIP é um formato de contêiner distinto de DEFLATE/GZIP.
// Node.js (zlib) cobre DEFLATE/GZIP mas não analisa o diretório central do ZIP.
// xlsx (SheetJS) lê ZIPs de planilhas Excel, não ZIP genérico.
// adm-zip é síncrono, puro JavaScript (sem bindings nativos) e mínimo.
const AdmZip = require("adm-zip");

const PADRAO_CSV_DETRU = /siconv_convenio/i;

function _encontrarEntradaCsv(zip, referencia) {
  const entradas = zip.getEntries().filter((e) => !e.isDirectory);

  const candidatoPrincipal = entradas.find(
    (e) => PADRAO_CSV_DETRU.test(e.entryName) && /\.csv$/i.test(e.entryName)
  );
  if (candidatoPrincipal) return candidatoPrincipal;

  const candidatoFallback = entradas.find((e) => /\.csv$/i.test(e.entryName));
  if (candidatoFallback) return candidatoFallback;

  const nomesEntradas = entradas.map((e) => e.entryName).join(", ") || "(vazio)";
  throw new Error(
    `Nenhum CSV encontrado no ZIP: ${referencia}\n` +
      `Entradas encontradas: ${nomesEntradas}`
  );
}

function localizarCsvNoZip(caminhoZip) {
  const zip = new AdmZip(caminhoZip);
  return _encontrarEntradaCsv(zip, path.basename(caminhoZip)).entryName;
}

function detectarSeparadorCsv(conteudo) {
  const primeiraLinha = (conteudo.split(/\r?\n/)[0] || "");
  const pontoVirgulas = (primeiraLinha.match(/;/g) || []).length;
  const virgulas = (primeiraLinha.match(/,/g) || []).length;
  return pontoVirgulas >= virgulas ? ";" : ",";
}

function normalizarCabecalhoDetru(nomeColuna) {
  return String(nomeColuna)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function parseCsvLinha(linha, separador) {
  const campos = [];
  let campo = "";
  let dentroDasAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDasAspas && linha[i + 1] === '"') {
        campo += '"';
        i++;
      } else {
        dentroDasAspas = !dentroDasAspas;
      }
    } else if (c === separador && !dentroDasAspas) {
      campos.push(campo);
      campo = "";
    } else {
      campo += c;
    }
  }
  campos.push(campo);
  return campos;
}

function lerCsvDetruConvenio(caminhoZip) {
  if (!fs.existsSync(caminhoZip)) {
    throw new Error(
      `Arquivo ZIP não encontrado: ${caminhoZip}\n` +
        "Baixe o arquivo siconv_convenio.csv.zip do DETRU e coloque-o no caminho configurado."
    );
  }

  if (path.extname(caminhoZip).toLowerCase() !== ".zip") {
    throw new Error(
      `Extensão inválida: esperado .zip, recebido "${path.extname(caminhoZip)}".`
    );
  }

  const zip = new AdmZip(caminhoZip);
  const entrada = _encontrarEntradaCsv(zip, path.basename(caminhoZip));

  // Arquivos do governo brasileiro frequentemente usam Windows-1252 (superset de Latin-1).
  // toString("latin1") preserva os bytes sem perda e permite normalização posterior.
  const conteudo = entrada.getData().toString("latin1");

  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim());

  if (!linhas.length) {
    throw new Error(
      `CSV vazio: "${entrada.entryName}" (ZIP: ${path.basename(caminhoZip)}).`
    );
  }

  const separador = detectarSeparadorCsv(conteudo);
  const cabecalho = parseCsvLinha(linhas[0], separador).map(normalizarCabecalhoDetru);

  const registros = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = parseCsvLinha(linhas[i], separador);
    if (campos.every((c) => !c)) continue;
    const obj = {};
    cabecalho.forEach((col, idx) => {
      obj[col] = campos[idx] !== undefined ? campos[idx] : "";
    });
    registros.push(obj);
  }

  return registros;
}

function listarColunasDetruConvenio(caminhoZip) {
  const registros = lerCsvDetruConvenio(caminhoZip);
  return registros.length ? Object.keys(registros[0]) : [];
}

module.exports = {
  localizarCsvNoZip,
  lerCsvDetruConvenio,
  normalizarCabecalhoDetru,
  parseCsvLinha,
  detectarSeparadorCsv,
  listarColunasDetruConvenio,
};

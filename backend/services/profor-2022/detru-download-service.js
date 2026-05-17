// Serviço de acesso ao arquivo DETRU siconv_convenio.csv.zip.
// Lê configuração de URL em DETRU_SICONV_CONVENIO_URL (.env) ou em backend/data/aplicacao.json.
// Nunca inventa URL. Se não houver URL configurada, usa arquivo local.
// O download usa fetch nativo do Node (v18+). Não cria dependência externa.
// O arquivo baixado vai para Dados/detru/ — não deve ser versionado no Git.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const CAMINHO_APLICACAO_JSON = path.join(__dirname, "..", "..", "data", "aplicacao.json");
const CAMINHO_LOCAL_PADRAO = path.join(__dirname, "..", "..", "..", "Dados", "detru", "siconv_convenio.csv.zip");

function obterConfiguracaoDetru() {
  const config = {
    url: process.env.DETRU_SICONV_CONVENIO_URL || null,
    caminhoLocal: process.env.DETRU_SICONV_CONVENIO_LOCAL || null,
    horaAtualizacaoDiaria: process.env.DETRU_ATUALIZACAO_DIARIA_HORA || null,
  };

  // Fallback em aplicacao.json quando variável de ambiente não definida
  try {
    const conteudo = fs.readFileSync(CAMINHO_APLICACAO_JSON, "utf8");
    const appJson = JSON.parse(conteudo);
    const detruJson = appJson?.detru ?? {};
    if (!config.url && detruJson.urlSiconvConvenio) {
      config.url = detruJson.urlSiconvConvenio || null;
    }
    if (!config.caminhoLocal && detruJson.caminhoLocal) {
      config.caminhoLocal = detruJson.caminhoLocal;
    }
    if (!config.horaAtualizacaoDiaria && detruJson.horaAtualizacaoDiaria) {
      config.horaAtualizacaoDiaria = detruJson.horaAtualizacaoDiaria;
    }
  } catch {
    // aplicacao.json ausente ou sem seção detru
  }

  // String vazia não conta como URL configurada
  if (config.url !== null && config.url.trim() === "") config.url = null;

  config.horaAtualizacaoDiaria = config.horaAtualizacaoDiaria || "06:00";

  return config;
}

function resolverCaminhoLocalDetru() {
  const config = obterConfiguracaoDetru();
  if (config.caminhoLocal) {
    return path.isAbsolute(config.caminhoLocal)
      ? config.caminhoLocal
      : path.join(process.cwd(), config.caminhoLocal);
  }
  return CAMINHO_LOCAL_PADRAO;
}

function validarUrlDetru(url) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return {
      ok: false,
      erro:
        "URL do DETRU não configurada. " +
        "Defina DETRU_SICONV_CONVENIO_URL no .env ou " +
        'em backend/data/aplicacao.json (campo detru.urlSiconvConvenio).',
    };
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, erro: `URL inválida: "${url}"` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      erro: `Protocolo não permitido: "${parsed.protocol}". Use http:// ou https://.`,
    };
  }
  return { ok: true, url: parsed.href };
}

async function baixarArquivoDetru(url, caminhoDestino) {
  const validacao = validarUrlDetru(url);
  if (!validacao.ok) throw new Error(validacao.erro);

  if (!caminhoDestino.endsWith(".zip")) {
    throw new Error(`Caminho de destino deve ter extensão .zip: "${caminhoDestino}"`);
  }

  const dir = path.dirname(caminhoDestino);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Diretório criado: ${dir}`);
  }

  const caminhoTemp = caminhoDestino + ".tmp";

  console.log(`Baixando DETRU de: ${validacao.url}`);
  let resposta;
  try {
    resposta = await fetch(validacao.url);
  } catch (err) {
    throw new Error(`Falha de rede ao acessar URL do DETRU: ${err.message}`);
  }

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} ao baixar arquivo DETRU: ${validacao.url}`);
  }

  const tipoConteudo = resposta.headers.get("content-type") || "";
  if (
    tipoConteudo &&
    !tipoConteudo.includes("zip") &&
    !tipoConteudo.includes("octet-stream") &&
    !tipoConteudo.includes("application")
  ) {
    console.warn(`Aviso: Content-Type inesperado "${tipoConteudo}" — prosseguindo.`);
  }

  let buffer;
  try {
    buffer = await resposta.arrayBuffer();
  } catch (err) {
    throw new Error(`Falha ao ler corpo da resposta: ${err.message}`);
  }

  const bytes = Buffer.from(buffer);

  try {
    fs.writeFileSync(caminhoTemp, bytes);
    // Mover para o destino definitivo somente após download completo
    fs.renameSync(caminhoTemp, caminhoDestino);
  } catch (err) {
    // Remover arquivo parcial em caso de erro de escrita
    try { fs.unlinkSync(caminhoTemp); } catch { /* ignorar */ }
    throw new Error(`Falha ao salvar arquivo DETRU: ${err.message}`);
  }

  const tamanho = bytes.length;
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const baixadoEm = new Date().toISOString();

  console.log(`Arquivo DETRU salvo: ${caminhoDestino} (${(tamanho / 1024 / 1024).toFixed(2)} MB)`);

  return { caminho: caminhoDestino, tamanho, hash, baixadoEm, fonte: "download" };
}

async function garantirArquivoDetruAtualizado(opcoes = {}) {
  const config = obterConfiguracaoDetru();
  const caminhoLocal = opcoes.caminhoLocal || resolverCaminhoLocalDetru();
  const url = opcoes.url !== undefined ? opcoes.url : config.url;

  if (url) {
    const validacao = validarUrlDetru(url);
    if (!validacao.ok) throw new Error(validacao.erro);
    return await baixarArquivoDetru(validacao.url, caminhoLocal);
  }

  if (fs.existsSync(caminhoLocal)) {
    console.log(`Usando arquivo local existente: ${caminhoLocal}`);
    return { caminho: caminhoLocal, fonte: "local" };
  }

  throw new Error(
    `Arquivo DETRU não disponível.\n` +
    `  - Configure DETRU_SICONV_CONVENIO_URL no .env para download automático.\n` +
    `  - Ou coloque o arquivo manualmente em: ${caminhoLocal}`
  );
}

function obterMetadadosArquivoDetru(caminhoArquivo) {
  if (!fs.existsSync(caminhoArquivo)) {
    return { existe: false, caminho: caminhoArquivo };
  }
  const stat = fs.statSync(caminhoArquivo);
  const conteudo = fs.readFileSync(caminhoArquivo);
  const hash = crypto.createHash("sha256").update(conteudo).digest("hex");
  return {
    existe: true,
    caminho: caminhoArquivo,
    tamanho: stat.size,
    modificadoEm: stat.mtime.toISOString(),
    hash,
  };
}

module.exports = {
  obterConfiguracaoDetru,
  resolverCaminhoLocalDetru,
  validarUrlDetru,
  baixarArquivoDetru,
  garantirArquivoDetruAtualizado,
  obterMetadadosArquivoDetru,
};

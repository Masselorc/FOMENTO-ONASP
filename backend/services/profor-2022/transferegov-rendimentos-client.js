const BASE_TRANSFEREGOV_PUBLICO = "https://discricionarias.transferegov.sistema.gov.br";
const CAMINHO_RENDIMENTOS_APLICACAO =
  "/voluntarias/execucao/ListarSolicitacaoRendimentosAplicacao/ListarSolicitacaoRendimentosAplicacao.do?destino=ListarSolicitacaoRendimentosAplicacao";

function decodeHtmlEntities(texto) {
  return String(texto ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function limparHtml(texto) {
  return decodeHtmlEntities(texto)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extrairElementoPorId(html, id) {
  const pattern = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid=["']${escaparRegex(id)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "i"
  );
  const match = String(html || "").match(pattern);
  return match ? match[0] : "";
}

function extrairPrimeiroPorClasse(html, tag, classe) {
  const pattern = new RegExp(
    `<${tag}\\b[^>]*\\bclass=["'][^"']*\\b${escaparRegex(classe)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  const match = String(html || "").match(pattern);
  return match ? match[1] : "";
}

function extrairCamposDaLinhaRendimento(linhaHtml) {
  const campos = [];
  const pattern = /<td\b[^>]*\bclass=["'][^"']*\bfield\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = pattern.exec(linhaHtml)) !== null) {
    const texto = limparHtml(match[1]);
    if (texto) campos.push(texto);
  }
  return campos;
}

function converterMoedaBrasileiraParaNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  const texto = String(valor)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function montarUrlRendimentosAplicacao(baseUrl = BASE_TRANSFEREGOV_PUBLICO) {
  return new URL(CAMINHO_RENDIMENTOS_APLICACAO, baseUrl || BASE_TRANSFEREGOV_PUBLICO).href;
}

function extrairSaldoRendimentosDoHtml(html, metadados = {}) {
  const consultadoEm = metadados.consultadoEm || new Date().toISOString();
  const urlFinal = metadados.urlFinal || null;
  const numeroConvenio = metadados.numeroConvenio ? String(metadados.numeroConvenio).trim() : null;
  const conteudo = String(html || "");
  const linhaRendimento = extrairElementoPorId(conteudo, "tr-novaSolicitacaoValorDisponivelRendimento");
  const subtitulo = limparHtml(extrairPrimeiroPorClasse(conteudo, "td", "subtitulo")) || null;
  const aviso = limparHtml(extrairPrimeiroPorClasse(conteudo, "div", "important")) || null;
  const convenioTexto = limparHtml(extrairElementoPorId(conteudo, "convenio")) || null;
  const campos = linhaRendimento ? extrairCamposDaLinhaRendimento(linhaRendimento) : [];
  const valorOriginal = campos.find((campo) => /R\$\s*[\d.]+,\d{2}/.test(campo)) || null;
  const saldoRendimentosAtual = converterMoedaBrasileiraParaNumero(valorOriginal);

  const payload = {
    seletores: {
      linhaRendimentoEncontrada: Boolean(linhaRendimento),
      totalCamposLinhaRendimento: campos.length,
      subtituloEncontrado: Boolean(subtitulo),
      avisoEncontrado: Boolean(aviso),
      convenioEncontrado: Boolean(convenioTexto),
    },
    camposLinhaRendimento: campos,
  };

  if (!linhaRendimento || !valorOriginal || saldoRendimentosAtual === null) {
    const erro = !convenioTexto && !linhaRendimento
      ? "Sessão pública do convênio não estabelecida."
      : "Campo de saldo de rendimentos não encontrado no HTML público do Transferegov.";

    return {
      sucesso: false,
      numeroConvenio,
      convenioTexto,
      subtitulo,
      valorOriginal,
      saldoRendimentosAtual: null,
      aviso,
      urlFinal,
      consultadoEm,
      erro,
      payload,
    };
  }

  return {
    sucesso: true,
    numeroConvenio,
    convenioTexto,
    subtitulo,
    valorOriginal,
    saldoRendimentosAtual,
    aviso,
    urlFinal,
    consultadoEm,
    erro: null,
    payload,
  };
}

function montarHeadersConsulta(opcoes = {}) {
  const headers = {
    "User-Agent": "ONASP-SENAPPEN-FOMENTO/1.0 consulta-publica-transferegov",
    "Accept": "text/html,application/xhtml+xml",
    ...(opcoes.headers || {}),
  };

  if (opcoes.cookie && !headers.Cookie) {
    headers.Cookie = opcoes.cookie;
  }

  return headers;
}

async function consultarSaldoRendimentosConvenio(numeroConvenio, opcoes = {}) {
  const numero = String(numeroConvenio ?? "").trim();
  const consultadoEm = new Date().toISOString();
  const url = montarUrlRendimentosAplicacao(opcoes.baseUrl);

  if (!/^\d+$/.test(numero)) {
    return {
      sucesso: false,
      numeroConvenio: numero || null,
      convenioTexto: null,
      subtitulo: null,
      valorOriginal: null,
      saldoRendimentosAtual: null,
      aviso: null,
      urlFinal: url,
      consultadoEm,
      erro: "Número do convênio inválido para consulta pública do Transferegov.",
      payload: {},
    };
  }

  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: montarHeadersConsulta(opcoes),
      redirect: "follow",
    });

    const urlFinal = resposta.url || url;
    if (!resposta.ok) {
      return {
        sucesso: false,
        numeroConvenio: numero,
        convenioTexto: null,
        subtitulo: null,
        valorOriginal: null,
        saldoRendimentosAtual: null,
        aviso: null,
        urlFinal,
        consultadoEm,
        erro: `HTTP ${resposta.status} ao consultar página pública de rendimentos do Transferegov.`,
        payload: { status: resposta.status, statusText: resposta.statusText },
      };
    }

    const html = await resposta.text();
    const resultado = extrairSaldoRendimentosDoHtml(html, {
      numeroConvenio: numero,
      urlFinal,
      consultadoEm,
    });

    if (!resultado.convenioTexto || !resultado.convenioTexto.includes(numero)) {
      return {
        ...resultado,
        sucesso: false,
        erro: "Sessão pública do convênio não estabelecida.",
      };
    }

    return resultado;
  } catch (error) {
    return {
      sucesso: false,
      numeroConvenio: numero,
      convenioTexto: null,
      subtitulo: null,
      valorOriginal: null,
      saldoRendimentosAtual: null,
      aviso: null,
      urlFinal: url,
      consultadoEm,
      erro: `Falha ao consultar página pública de rendimentos do Transferegov: ${error.message}`,
      payload: {},
    };
  }
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consultarSaldoRendimentosCarteira(convenios, opcoes = {}) {
  const intervaloMs = Number.isFinite(Number(opcoes.intervaloMs)) ? Number(opcoes.intervaloMs) : 500;
  const resultados = [];

  for (const convenio of convenios || []) {
    const numeroConvenio = convenio?.numeroConvenio ?? convenio?.numero_convenio;
    const resultado = await consultarSaldoRendimentosConvenio(numeroConvenio, opcoes);
    resultados.push({
      ...resultado,
      ano: convenio?.ano ?? null,
      uf: convenio?.uf ?? null,
    });

    if (intervaloMs > 0) {
      await aguardar(intervaloMs);
    }
  }

  return resultados;
}

module.exports = {
  BASE_TRANSFEREGOV_PUBLICO,
  CAMINHO_RENDIMENTOS_APLICACAO,
  converterMoedaBrasileiraParaNumero,
  extrairSaldoRendimentosDoHtml,
  montarUrlRendimentosAplicacao,
  consultarSaldoRendimentosConvenio,
  consultarSaldoRendimentosCarteira,
};

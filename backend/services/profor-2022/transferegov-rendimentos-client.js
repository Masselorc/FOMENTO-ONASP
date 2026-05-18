const BASE_TRANSFEREGOV_PUBLICO = "https://discricionarias.transferegov.sistema.gov.br";
const CAMINHO_PRINCIPAL_GUEST = "/voluntarias/Principal/Principal.do?Usr=guest&Pwd=guest";
const CAMINHO_FORWARD_CONSULTAR_CONVENIO =
  "/voluntarias/ForwardAction.do?modulo=Principal&path=/MostraPrincipalConsultarConvenio.do";
const CAMINHO_CONSULTAR_PROPOSTA = "/voluntarias/proposta/ConsultarProposta/ConsultarProposta.do";
const CAMINHO_POST_CONSULTA_COMPLETA =
  "/voluntarias/ConsultarProposta/PreenchaOsDadosDaConsultaConsultar.do?tipo_consulta=CONSULTA_COMPLETA";
const CAMINHO_SELECIONAR_CONVENIO_RESULTADO =
  "/voluntarias/ConsultarProposta/ResultadoDaConsultaDeConvenioSelecionarConvenio.do";
const CAMINHO_FORWARD_RENDIMENTOS =
  "/voluntarias/ForwardAction.do?modulo=proposta&path=/SelecionarConvenio/SelecionarConvenio.do?destino=ListarSolicitacaoRendimentosAplicacao";
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

function normalizarNumeroConvenioTransferegov(valor) {
  const numero = String(valor ?? "").replace(/\D/g, "");
  return numero || null;
}

function extrairTituloHtml(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? limparHtml(match[1]) : null;
}

function detectarFlagsHtml(html, numeroConvenio) {
  const conteudo = String(html || "");
  return {
    titulo: extrairTituloHtml(conteudo),
    temSaml: /SAMLRequest|SAMLResponse|HTTP Post Binding/i.test(conteudo),
    temLogin: /Login do Transferegov|Entrar com gov\.br/i.test(conteudo),
    temAcessoLivre: /Acesso livre/i.test(conteudo),
    temConsultarProposta: /ConsultarProposta|Consultar Pré-Instrumento|Consultar Pre-Instrumento/i.test(conteudo),
    temNumero: numeroConvenio ? conteudo.includes(String(numeroConvenio)) : false,
    temIdConvenio: /idConvenio=\d+/i.test(conteudo),
    temRendimento: /Rendimento de Aplica/i.test(conteudo),
    temValorDisponivel: /Valor Total Dispon/i.test(conteudo) || /valorDisponivelRendimento/i.test(conteudo),
  };
}

function sanitizarUrlDiagnostico(url) {
  return String(url || "").replace(/SAML(Request|Response)=[^&]+/gi, "SAML$1=<omitido>");
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

function criarCookieJarEmMemoria() {
  const cookies = new Map();

  function absorverSetCookie(headers) {
    const valores = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);

    for (const valor of valores) {
      for (const parte of String(valor).split(/,(?=[^;,]+=)/)) {
        const [cookie] = parte.split(";");
        const indice = cookie.indexOf("=");
        if (indice <= 0) continue;
        cookies.set(cookie.slice(0, indice).trim(), cookie.slice(indice + 1).trim());
      }
    }
  }

  function montarCookieHeader() {
    return Array.from(cookies.entries())
      .map(([nome, valor]) => `${nome}=${valor}`)
      .join("; ");
  }

  return { absorverSetCookie, montarCookieHeader };
}

function resolverUrlTransferegov(caminhoOuUrl, baseUrl = BASE_TRANSFEREGOV_PUBLICO) {
  return new URL(caminhoOuUrl, baseUrl || BASE_TRANSFEREGOV_PUBLICO).href;
}

function montarHeadersConsulta(opcoes = {}) {
  const headers = {
    "User-Agent": "ONASP-SENAPPEN-FOMENTO/1.0 consulta-publica-transferegov",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    ...(opcoes.headers || {}),
  };

  if (opcoes.cookie && !headers.Cookie) {
    headers.Cookie = opcoes.cookie;
  }

  return headers;
}

function extrairFormAutoSubmit(html, urlAtual, baseUrl) {
  const conteudo = String(html || "");
  const formMatch = conteudo.match(/<form\b[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) return null;

  const formTag = formMatch[0].match(/<form\b[^>]*>/i)?.[0] || "";
  const action = decodeHtmlEntities(formTag.match(/\baction=["']([^"']+)["']/i)?.[1] || urlAtual);
  const method = (formTag.match(/\bmethod=["']([^"']+)["']/i)?.[1] || "GET").toUpperCase();
  const body = new URLSearchParams();
  const inputPattern = /<input\b[^>]*>/gi;
  let inputMatch;

  while ((inputMatch = inputPattern.exec(formMatch[1])) !== null) {
    const input = inputMatch[0];
    const name = input.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = decodeHtmlEntities(input.match(/\bvalue=["']([^"']*)["']/i)?.[1] || "");
    body.append(name, value);
  }

  if ([...body.keys()].length === 0) return null;

  return {
    action: resolverUrlTransferegov(action, baseUrl),
    method,
    body,
    contemSaml: body.has("SAMLRequest") || body.has("SAMLResponse"),
  };
}

async function fetchComSessao(url, opcoes = {}, contexto = {}) {
  const baseUrl = opcoes.baseUrl || contexto.baseUrl || BASE_TRANSFEREGOV_PUBLICO;
  const jar = contexto.cookieJar || contexto.jar || criarCookieJarEmMemoria();
  const historico = contexto.historico || [];
  let atual = resolverUrlTransferegov(url, baseUrl);
  let referer = opcoes.referer || null;
  let metodo = opcoes.method || "GET";
  let body = opcoes.body;
  const headersBase = {
    ...montarHeadersConsulta(opcoes),
    "Cache-Control": "max-age=0",
  };

  for (let redirect = 0; redirect <= (opcoes.maxRedirects ?? 12); redirect += 1) {
    const cookie = jar.montarCookieHeader();
    const headers = { ...headersBase };
    if (cookie) headers.Cookie = cookie;
    if (referer) headers.Referer = referer;

    const resposta = await fetch(atual, {
      method: metodo,
      headers,
      body,
      redirect: "manual",
    });
    jar.absorverSetCookie(resposta.headers);

    if ([301, 302, 303, 307, 308].includes(resposta.status)) {
      const location = resposta.headers.get("location");
      historico.push({
        etapa: opcoes.etapa || "fetch",
        metodo,
        url: sanitizarUrlDiagnostico(atual),
        status: resposta.status,
        redirect: true,
        location: sanitizarUrlDiagnostico(location),
      });
      if (!location) break;
      referer = atual;
      atual = resolverUrlTransferegov(location, baseUrl);
      if (resposta.status === 302 || resposta.status === 303) {
        metodo = "GET";
        body = undefined;
        delete headersBase["Content-Type"];
        delete headersBase.Origin;
      }
      continue;
    }

    const texto = await resposta.text();
    historico.push({
      etapa: opcoes.etapa || "fetch",
      metodo,
      url: sanitizarUrlDiagnostico(atual),
      status: resposta.status,
      titulo: extrairTituloHtml(texto),
      flags: detectarFlagsHtml(texto, opcoes.numeroConvenio),
    });

    const formAutoSubmit = extrairFormAutoSubmit(texto, atual, baseUrl);
    if (formAutoSubmit && /HTTP Post Binding/i.test(extrairTituloHtml(texto) || "")) {
      historico.push({
        etapa: `${opcoes.etapa || "fetch"}_auto_form`,
        metodo: formAutoSubmit.method,
        url: sanitizarUrlDiagnostico(formAutoSubmit.action),
        status: "auto-submit",
        contemSaml: formAutoSubmit.contemSaml,
      });
      referer = atual;
      atual = formAutoSubmit.action;
      metodo = formAutoSubmit.method;
      body = formAutoSubmit.body;
      headersBase["Content-Type"] = "application/x-www-form-urlencoded";
      headersBase.Origin = new URL(referer).origin;
      continue;
    }

    return {
      status: resposta.status,
      urlFinal: atual,
      texto,
      headersSanitizados: {
        contentType: resposta.headers.get("content-type"),
      },
      historico,
      cookieJar: jar,
    };
  }

  throw new Error(`Limite de redirects atingido em ${opcoes.etapa || "fetch"}.`);
}

function montarPayloadConsultaConvenio(numeroConvenio, formato = "urlencoded") {
  const numero = normalizarNumeroConvenioTransferegov(numeroConvenio);
  const pares = [
    ["invalidatePageControlCounter", "1"],
    ["destino", ""],
    ["ufAcessoLivre", ""],
    ["numeroProposta", ""],
    ["numeroConvenio", numero || ""],
    ["orgaoConvenio", ""],
    ["codigoUg", ""],
    ["modalidade", ""],
    ["ano", ""],
    ["enviadaInstituicaoMandataria", "13"],
    ["situacaoConvenioAsArray", "5"],
    ["codigoPrograma", ""],
    ["codigoParlamentar", ""],
    ["numeroEmendaParlamentar", ""],
    ["nomeProponente", ""],
    ["tipoIdentificacao", "5"],
    ["identificacao", ""],
    ["uf", ""],
    ["cpfResponsavel", ""],
    ["naturezaJuridica", ""],
  ];
  const payload = formato === "formdata" ? new FormData() : new URLSearchParams();
  pares.forEach(([chave, valor]) => payload.append(chave, valor));
  ["1", "3", "8", "9", "10"].forEach((valor) => payload.append("camposParaExibirConvenioAsArray", valor));
  return payload;
}

function extrairIdConvenioDoHtmlConsulta(html, numeroConvenio) {
  const conteudo = String(html || "");
  const numero = normalizarNumeroConvenioTransferegov(numeroConvenio);
  const candidatos = [];
  const padroes = [
    /ResultadoDaConsultaDeConvenioSelecionarConvenio\.do\?[^"'<>]*idConvenio=(\d+)/gi,
    /idConvenio=(\d+)/gi,
    /name=["']idConvenio["'][^>]*value=["'](\d+)["']/gi,
  ];

  for (const padrao of padroes) {
    let match;
    while ((match = padrao.exec(conteudo)) !== null) {
      const inicio = Math.max(0, match.index - 800);
      const fim = Math.min(conteudo.length, match.index + 800);
      const contexto = conteudo.slice(inicio, fim);
      candidatos.push({
        idConvenio: match[1],
        proximoAoNumero: numero ? contexto.includes(numero) : false,
      });
    }
  }

  const unicos = [];
  const vistos = new Set();
  for (const candidato of candidatos) {
    if (vistos.has(candidato.idConvenio)) continue;
    vistos.add(candidato.idConvenio);
    unicos.push(candidato);
  }

  const escolhido = unicos.find((item) => item.proximoAoNumero) || unicos[0] || null;
  return {
    idConvenio: escolhido?.idConvenio || null,
    totalCandidatos: unicos.length,
    erro: escolhido ? null : "idConvenio não encontrado na resposta da consulta pública.",
  };
}

async function consultarInstrumentoPorNumeroConvenio(numeroConvenio, opcoes = {}) {
  const numero = normalizarNumeroConvenioTransferegov(numeroConvenio);
  const contexto = opcoes.contexto || {
    cookieJar: criarCookieJarEmMemoria(),
    historico: [],
    baseUrl: opcoes.baseUrl || BASE_TRANSFEREGOV_PUBLICO,
  };

  await fetchComSessao(CAMINHO_PRINCIPAL_GUEST, {
    ...opcoes,
    etapa: "inicio_guest",
    numeroConvenio: numero,
  }, contexto);
  await fetchComSessao(CAMINHO_FORWARD_CONSULTAR_CONVENIO, {
    ...opcoes,
    etapa: "abrir_consulta",
    numeroConvenio: numero,
  }, contexto);
  await fetchComSessao(CAMINHO_CONSULTAR_PROPOSTA, {
    ...opcoes,
    etapa: "abrir_consultar_proposta",
    numeroConvenio: numero,
  }, contexto);

  const multipart = await fetchComSessao(CAMINHO_POST_CONSULTA_COMPLETA, {
    ...opcoes,
    etapa: "post_consulta",
    method: "POST",
    headers: {
      ...(opcoes.headers || {}),
      Origin: opcoes.baseUrl || BASE_TRANSFEREGOV_PUBLICO,
    },
    body: montarPayloadConsultaConvenio(numero, "formdata"),
    numeroConvenio: numero,
  }, contexto);
  let extracao = extrairIdConvenioDoHtmlConsulta(multipart.texto, numero);
  let respostaConsulta = multipart;

  if (!extracao.idConvenio) {
    const urlencoded = await fetchComSessao(CAMINHO_POST_CONSULTA_COMPLETA, {
      ...opcoes,
      etapa: "post_consulta_urlencoded",
      method: "POST",
      headers: {
        ...(opcoes.headers || {}),
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: opcoes.baseUrl || BASE_TRANSFEREGOV_PUBLICO,
      },
      body: montarPayloadConsultaConvenio(numero, "urlencoded"),
      numeroConvenio: numero,
    }, contexto);
    extracao = extrairIdConvenioDoHtmlConsulta(urlencoded.texto, numero);
    respostaConsulta = urlencoded;
  }

  return {
    html: respostaConsulta.texto,
    urlFinal: respostaConsulta.urlFinal,
    idConvenio: extracao.idConvenio,
    totalCandidatos: extracao.totalCandidatos,
    erro: extracao.erro,
    contexto,
  };
}

async function selecionarConvenioPorIdConvenio(idConvenio, contexto, opcoes = {}) {
  if (!/^\d+$/.test(String(idConvenio || ""))) {
    throw new Error("idConvenio inválido para seleção do instrumento.");
  }

  const selecao = await fetchComSessao(
    `${CAMINHO_SELECIONAR_CONVENIO_RESULTADO}?idConvenio=${encodeURIComponent(idConvenio)}&destino=`,
    {
      ...opcoes,
      etapa: "selecionar_convenio",
    },
    contexto
  );
  const forward = await fetchComSessao(CAMINHO_FORWARD_RENDIMENTOS, {
    ...opcoes,
    etapa: "abrir_rendimentos",
  }, contexto);

  return {
    selecao,
    forward,
    contexto,
  };
}

async function consultarTelaRendimentosComSessao(numeroConvenio, contexto, opcoes = {}) {
  const resposta = await fetchComSessao(CAMINHO_RENDIMENTOS_APLICACAO, {
    ...opcoes,
    etapa: "extrair_saldo",
    numeroConvenio,
  }, contexto);
  const resultado = extrairSaldoRendimentosDoHtml(resposta.texto, {
    numeroConvenio,
    urlFinal: resposta.urlFinal,
    consultadoEm: opcoes.consultadoEm,
  });

  if (!resultado.convenioTexto || !resultado.convenioTexto.includes(String(numeroConvenio))) {
    return {
      ...resultado,
      sucesso: false,
      erro: "Sessão pública do convênio não estabelecida.",
      etapa: "extrair_saldo",
    };
  }

  return {
    ...resultado,
    etapa: resultado.sucesso ? "concluido" : "extrair_saldo",
  };
}

function montarFalhaConsulta(numeroConvenio, consultadoEm, etapa, erro, payload = {}) {
  return {
    sucesso: false,
    numeroConvenio: numeroConvenio || null,
    idConvenio: payload.idConvenio ?? null,
    convenioTexto: null,
    subtitulo: null,
    valorOriginal: null,
    saldoRendimentosAtual: null,
    aviso: null,
    urlFinal: payload.urlFinal ?? montarUrlRendimentosAplicacao(),
    consultadoEm,
    erro,
    etapa,
    payload,
  };
}

async function consultarSaldoRendimentosConvenioComNavegador(numero, opcoes, diagnosticoFetch) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    return montarFalhaConsulta(
      numero,
      opcoes.consultadoEm,
      diagnosticoFetch?.etapa || "inicio_guest",
      "Fluxo HTTP público não estabeleceu sessão e Playwright não está disponível para inspeção pública local.",
      { diagnosticoFetch }
    );
  }

  const baseUrl = opcoes.baseUrl || BASE_TRANSFEREGOV_PUBLICO;
  const etapas = [];
  const browser = await chromium.launch({ headless: opcoes.headless !== false });
  const page = await browser.newPage();

  function registrarEtapa(etapa, html) {
    etapas.push({
      etapa,
      url: sanitizarUrlDiagnostico(page.url()),
      titulo: null,
      flags: detectarFlagsHtml(html, numero),
    });
  }

  try {
    await page.goto(resolverUrlTransferegov(CAMINHO_PRINCIPAL_GUEST, baseUrl), {
      waitUntil: "networkidle",
      timeout: opcoes.timeoutMs ?? 30000,
    });
    registrarEtapa("inicio_guest", await page.content());

    await page.goto(resolverUrlTransferegov(CAMINHO_FORWARD_CONSULTAR_CONVENIO, baseUrl), {
      waitUntil: "networkidle",
      timeout: opcoes.timeoutMs ?? 30000,
    });
    registrarEtapa("abrir_consulta", await page.content());

    const htmlConsulta = await page.evaluate(async ({ baseUrl, caminho, numeroConvenio }) => {
      const resposta = await fetch(new URL(caminho, baseUrl).href, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams([
          ["invalidatePageControlCounter", "1"],
          ["destino", ""],
          ["ufAcessoLivre", ""],
          ["numeroProposta", ""],
          ["numeroConvenio", numeroConvenio],
          ["orgaoConvenio", ""],
          ["codigoUg", ""],
          ["modalidade", ""],
          ["ano", ""],
          ["enviadaInstituicaoMandataria", "13"],
          ["situacaoConvenioAsArray", "5"],
          ["codigoPrograma", ""],
          ["codigoParlamentar", ""],
          ["numeroEmendaParlamentar", ""],
          ["nomeProponente", ""],
          ["tipoIdentificacao", "5"],
          ["identificacao", ""],
          ["uf", ""],
          ["cpfResponsavel", ""],
          ["naturezaJuridica", ""],
          ["camposParaExibirConvenioAsArray", "1"],
          ["camposParaExibirConvenioAsArray", "3"],
          ["camposParaExibirConvenioAsArray", "8"],
          ["camposParaExibirConvenioAsArray", "9"],
          ["camposParaExibirConvenioAsArray", "10"],
        ]),
      });
      return await resposta.text();
    }, {
      baseUrl,
      caminho: CAMINHO_POST_CONSULTA_COMPLETA,
      numeroConvenio: numero,
    });

    const extracaoId = extrairIdConvenioDoHtmlConsulta(htmlConsulta, numero);
    etapas.push({
      etapa: "post_consulta",
      url: resolverUrlTransferegov(CAMINHO_POST_CONSULTA_COMPLETA, baseUrl),
      titulo: extrairTituloHtml(htmlConsulta),
      flags: detectarFlagsHtml(htmlConsulta, numero),
      idConvenioEncontrado: Boolean(extracaoId.idConvenio),
      totalCandidatos: extracaoId.totalCandidatos,
    });

    if (!extracaoId.idConvenio) {
      return montarFalhaConsulta(numero, opcoes.consultadoEm, "extrair_id_convenio", extracaoId.erro, {
        fluxo: "playwright-publico",
        etapas,
        diagnosticoFetch,
      });
    }

    await page.goto(
      resolverUrlTransferegov(
        `${CAMINHO_SELECIONAR_CONVENIO_RESULTADO}?idConvenio=${encodeURIComponent(extracaoId.idConvenio)}&destino=`,
        baseUrl
      ),
      { waitUntil: "networkidle", timeout: opcoes.timeoutMs ?? 30000 }
    );
    registrarEtapa("selecionar_convenio", await page.content());

    await page.goto(resolverUrlTransferegov(CAMINHO_FORWARD_RENDIMENTOS, baseUrl), {
      waitUntil: "networkidle",
      timeout: opcoes.timeoutMs ?? 30000,
    });
    const htmlRendimentos = await page.content();
    registrarEtapa("abrir_rendimentos", htmlRendimentos);

    const resultado = extrairSaldoRendimentosDoHtml(htmlRendimentos, {
      numeroConvenio: numero,
      urlFinal: page.url(),
      consultadoEm: opcoes.consultadoEm,
    });

    if (!resultado.convenioTexto || !resultado.convenioTexto.includes(numero)) {
      return {
        ...resultado,
        sucesso: false,
        idConvenio: extracaoId.idConvenio,
        erro: "Sessão pública do convênio não estabelecida.",
        etapa: "extrair_saldo",
        payload: {
          ...resultado.payload,
          fluxo: "playwright-publico",
          idConvenio: extracaoId.idConvenio,
          etapas,
          diagnosticoFetch,
        },
      };
    }

    return {
      ...resultado,
      idConvenio: extracaoId.idConvenio,
      etapa: resultado.sucesso ? "concluido" : "extrair_saldo",
      payload: {
        ...resultado.payload,
        fluxo: "playwright-publico",
        idConvenio: extracaoId.idConvenio,
        etapas,
        diagnosticoFetch,
      },
    };
  } catch (error) {
    return montarFalhaConsulta(numero, opcoes.consultadoEm, "abrir_rendimentos", error.message, {
      fluxo: "playwright-publico",
      etapas,
      diagnosticoFetch,
    });
  } finally {
    await browser.close();
  }
}

async function consultarSaldoRendimentosConvenio(numeroConvenio, opcoes = {}) {
  const numero = normalizarNumeroConvenioTransferegov(numeroConvenio);
  const consultadoEm = new Date().toISOString();
  const opcoesConsulta = { ...opcoes, consultadoEm };

  if (!numero) {
    return montarFalhaConsulta(
      null,
      consultadoEm,
      "inicio_guest",
      "Número do convênio inválido para consulta pública do Transferegov.",
      {}
    );
  }

  const contexto = {
    cookieJar: criarCookieJarEmMemoria(),
    historico: [],
    baseUrl: opcoes.baseUrl || BASE_TRANSFEREGOV_PUBLICO,
  };

  try {
    const consulta = await consultarInstrumentoPorNumeroConvenio(numero, {
      ...opcoesConsulta,
      contexto,
    });

    if (!consulta.idConvenio) {
      throw Object.assign(new Error(consulta.erro || "idConvenio não encontrado na consulta pública."), {
        etapa: "extrair_id_convenio",
        payload: {
          historico: contexto.historico,
          totalCandidatos: consulta.totalCandidatos,
          urlFinal: consulta.urlFinal,
        },
      });
    }

    await selecionarConvenioPorIdConvenio(consulta.idConvenio, contexto, opcoesConsulta);
    const resultado = await consultarTelaRendimentosComSessao(numero, contexto, opcoesConsulta);
    return {
      ...resultado,
      idConvenio: consulta.idConvenio,
      payload: {
        ...resultado.payload,
        fluxo: "fetch-publico",
        idConvenio: consulta.idConvenio,
        etapas: contexto.historico,
      },
    };
  } catch (error) {
    const diagnosticoFetch = {
      etapa: error.etapa || "inicio_guest",
      erro: error.message,
      historico: contexto.historico,
      ...(error.payload || {}),
    };

    if (opcoes.usarNavegador === false) {
      return montarFalhaConsulta(numero, consultadoEm, diagnosticoFetch.etapa, error.message, diagnosticoFetch);
    }

    return consultarSaldoRendimentosConvenioComNavegador(numero, opcoesConsulta, diagnosticoFetch);
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
  CAMINHO_PRINCIPAL_GUEST,
  CAMINHO_FORWARD_CONSULTAR_CONVENIO,
  CAMINHO_CONSULTAR_PROPOSTA,
  CAMINHO_POST_CONSULTA_COMPLETA,
  CAMINHO_SELECIONAR_CONVENIO_RESULTADO,
  CAMINHO_FORWARD_RENDIMENTOS,
  converterMoedaBrasileiraParaNumero,
  extrairSaldoRendimentosDoHtml,
  montarUrlRendimentosAplicacao,
  criarCookieJarEmMemoria,
  resolverUrlTransferegov,
  fetchComSessao,
  montarPayloadConsultaConvenio,
  consultarInstrumentoPorNumeroConvenio,
  extrairIdConvenioDoHtmlConsulta,
  selecionarConvenioPorIdConvenio,
  consultarTelaRendimentosComSessao,
  consultarSaldoRendimentosConvenio,
  consultarSaldoRendimentosCarteira,
};

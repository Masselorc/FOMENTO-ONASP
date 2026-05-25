const BASE_TRANSFEREGOV_PUBLICO = "https://discricionarias.transferegov.sistema.gov.br";
const URL_SESSAO_PUBLICA = `${BASE_TRANSFEREGOV_PUBLICO}/voluntarias/Principal/Principal.do?Usr=guest&Pwd=guest`;
const URL_RELATORIO_PAD = `${BASE_TRANSFEREGOV_PUBLICO}/voluntarias/_gerencial/RelatorioItensDespesasPAD/relatorioItensDespesasPAD.jsf`;

function criarCookieJarEmMemoria() {
  const cookies = new Map();

  function chaveCookie(nome, dominio, caminho) {
    return `${nome}|${dominio}|${caminho}`;
  }

  function absorverSetCookie(headers, urlAtual) {
    const hostAtual = new URL(urlAtual).hostname.toLowerCase();
    const valores = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);

    for (const valor of valores) {
      for (const parte of String(valor).split(/,(?=[^;,]+=)/)) {
        const partes = parte.split(";").map((item) => item.trim()).filter(Boolean);
        const [cookie] = partes;
        const indice = cookie.indexOf("=");
        if (indice <= 0) continue;
        const nome = cookie.slice(0, indice).trim();
        const cookieValor = cookie.slice(indice + 1).trim();
        const dominioAttr = partes.find((item) => /^domain=/i.test(item));
        const caminhoAttr = partes.find((item) => /^path=/i.test(item));
        const dominio = (dominioAttr ? dominioAttr.split("=").slice(1).join("=") : hostAtual)
          .trim()
          .replace(/^\./, "")
          .toLowerCase();
        const caminho = (caminhoAttr ? caminhoAttr.split("=").slice(1).join("=") : "/").trim() || "/";
        cookies.set(chaveCookie(nome, dominio, caminho), { nome, valor: cookieValor, dominio, caminho, hostOnly: !dominioAttr });
      }
    }
  }

  function montarCookieHeader(urlAtual) {
    const url = new URL(urlAtual);
    const host = url.hostname.toLowerCase();
    const caminho = url.pathname || "/";
    return Array.from(cookies.values())
      .filter((cookie) => {
        const dominioOk = cookie.hostOnly
          ? host === cookie.dominio
          : host === cookie.dominio || host.endsWith(`.${cookie.dominio}`);
        return dominioOk && caminho.startsWith(cookie.caminho);
      })
      .map((cookie) => `${cookie.nome}=${cookie.valor}`)
      .join("; ");
  }

  return { absorverSetCookie, montarCookieHeader };
}

function headersBase(headers = {}) {
  return {
    "User-Agent": "ONASP-SENAPPEN-FOMENTO/1.0 poc-pad-publico-transferegov",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Cache-Control": "no-cache",
    ...headers,
  };
}

function decodificarHtml(valor) {
  return String(valor || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&#039;/gi, "'");
}

function extrairInputsForm(formHtml) {
  const body = new URLSearchParams();
  const inputPattern = /<input\b[^>]*>/gi;
  let inputMatch;
  while ((inputMatch = inputPattern.exec(String(formHtml || ""))) !== null) {
    const input = inputMatch[0];
    const name = input.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const value = input.match(/\bvalue=["']([^"']*)["']/i)?.[1] || "";
    body.append(decodificarHtml(name), decodificarHtml(value));
  }
  return body;
}

function extrairFormAutoSubmit(html, urlAtual) {
  const formMatch = String(html || "").match(/<form\b[^>]*>[\s\S]*?<\/form>/i);
  if (!formMatch) return null;

  const formHtml = formMatch[0];
  const formTag = formHtml.match(/^<form\b[^>]*>/i)?.[0] || "";
  const body = extrairInputsForm(formHtml);
  const nomes = Array.from(body.keys());
  const contemSaml = nomes.includes("SAMLRequest") || nomes.includes("SAMLResponse");
  if (!contemSaml) return null;

  const action = decodificarHtml(formTag.match(/\baction=["']([^"']+)["']/i)?.[1] || urlAtual);
  const method = (formTag.match(/\bmethod=["']([^"']+)["']/i)?.[1] || "POST").toUpperCase();
  return {
    url: new URL(action, urlAtual).href,
    method,
    body,
  };
}

async function fetchComSessao(url, opcoes = {}, contexto = {}) {
  const jar = contexto.cookieJar || criarCookieJarEmMemoria();
  const historico = contexto.historico || [];
  let atual = url;
  let metodo = opcoes.method || "GET";
  let body = opcoes.body;
  let referer = opcoes.referer || null;

  for (let i = 0; i <= (opcoes.maxRedirects ?? 10); i += 1) {
    const cookie = jar.montarCookieHeader(atual);
    const headers = headersBase(opcoes.headers);
    if (cookie) headers.Cookie = cookie;
    if (referer) headers.Referer = referer;

    const resposta = await fetch(atual, {
      method: metodo,
      headers,
      body,
      redirect: "manual",
    });
    jar.absorverSetCookie(resposta.headers, atual);

    if ([301, 302, 303, 307, 308].includes(resposta.status)) {
      const location = resposta.headers.get("location");
      historico.push({ etapa: opcoes.etapa || "fetch", status: resposta.status, redirect: true });
      if (!location) break;
      referer = atual;
      atual = new URL(location, atual).href;
      if ([301, 302, 303].includes(resposta.status)) {
        metodo = "GET";
        body = undefined;
      }
      continue;
    }

    const html = await resposta.text();
    historico.push({ etapa: opcoes.etapa || "fetch", status: resposta.status, redirect: false });
    const autoSubmit = extrairFormAutoSubmit(html, atual);
    if (autoSubmit && i < (opcoes.maxRedirects ?? 10)) {
      referer = atual;
      atual = autoSubmit.url;
      metodo = autoSubmit.method;
      body = autoSubmit.body;
      historico.push({ etapa: opcoes.etapa || "fetch", status: resposta.status, autoSubmit: "saml" });
      continue;
    }
    return { resposta, html, urlFinal: atual, cookieJar: jar, historico };
  }

  throw new Error("Limite de redirecionamentos atingido na consulta pública PAD Transferegov.");
}

function extrairViewState(html) {
  const conteudo = String(html || "");
  const padroes = [
    /<input\b[^>]*name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["'][^>]*>/i,
    /<input\b[^>]*value=["']([^"']+)["'][^>]*name=["']javax\.faces\.ViewState["'][^>]*>/i,
  ];
  for (const padrao of padroes) {
    const match = conteudo.match(padrao);
    if (match?.[1]) return match[1];
  }
  return null;
}

function montarPayloadRelatorioPad(instrumento, viewState) {
  const body = new URLSearchParams();
  body.set("formRelatorioItensDespesasPAD:idInstrumento", String(instrumento));
  body.set("formRelatorioItensDespesasPAD:_idJsp88", "Gerar Relatório");
  body.set("autoScroll", "0,0");
  body.set("formRelatorioItensDespesasPAD_SUBMIT", "1");
  body.set("formRelatorioItensDespesasPAD:_link_hidden_", "");
  body.set("formRelatorioItensDespesasPAD:_idcl", "");
  body.set("javax.faces.ViewState", viewState);
  return body;
}

async function obterHtmlRelatorioPadTransferegov(instrumento, opcoes = {}) {
  const cookieJar = criarCookieJarEmMemoria();
  const historico = [];
  const contexto = { cookieJar, historico };

  await fetchComSessao(URL_SESSAO_PUBLICA, { etapa: "sessao_publica" }, contexto);
  const pagina = await fetchComSessao(URL_RELATORIO_PAD, { etapa: "get_relatorio" }, contexto);
  const viewState = extrairViewState(pagina.html);
  if (!viewState) {
    throw new Error("Campo javax.faces.ViewState não localizado na tela pública do relatório PAD.");
  }

  const payload = montarPayloadRelatorioPad(instrumento, viewState);
  const relatorio = await fetchComSessao(URL_RELATORIO_PAD, {
    etapa: "post_relatorio",
    method: "POST",
    referer: pagina.urlFinal || URL_RELATORIO_PAD,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": BASE_TRANSFEREGOV_PUBLICO,
    },
    body: payload,
  }, contexto);

  if (!relatorio.resposta.ok) {
    throw new Error(`Transferegov retornou HTTP ${relatorio.resposta.status} ao gerar relatório PAD.`);
  }

  return {
    html: relatorio.html,
    diagnostico: {
      instrumento: String(instrumento),
      status: relatorio.resposta.status,
      urlFinal: relatorio.urlFinal,
      viewStateTamanho: viewState.length,
      historico,
    },
  };
}

module.exports = {
  BASE_TRANSFEREGOV_PUBLICO,
  URL_RELATORIO_PAD,
  URL_SESSAO_PUBLICA,
  criarCookieJarEmMemoria,
  extrairFormAutoSubmit,
  extrairViewState,
  fetchComSessao,
  montarPayloadRelatorioPad,
  obterHtmlRelatorioPadTransferegov,
};

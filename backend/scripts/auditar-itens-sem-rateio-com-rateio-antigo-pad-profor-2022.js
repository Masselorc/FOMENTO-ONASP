const fs = require("node:fs");
const path = require("node:path");

const { inicializarBanco } = require("../db/init-db");
const db = require("../db/database");
const revisaoService = require("../services/profor-2022/profor-pad-revisao-decisao-service");

const CAMINHO_SAIDA_JSON = "backend/data/relatorios/profor-2022-item-sem-rateio-rateio-antigo-dry-run.json";
const CAMINHO_SAIDA_MD = "backend/data/relatorios/profor-2022-item-sem-rateio-rateio-antigo-dry-run.md";
const CAMINHO_RATEIO_INICIAL = "backend/data/relatorios/profor-2022-rateio-inicial-dry-run.json";

const STATUS_ANALISAVEIS = new Set(["PENDENTE", "EM_REVISAO"]);
const DECISOES_RESOLUTIVAS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);
const TOLERANCIA_QUANTIDADE = 0.000001;
const TOLERANCIA_MONETARIA = 0.01;
const USUARIO_DECISAO = "sistema-auditoria-rateio-antigo";
const JUSTIFICATIVA_RATEIO_ANTIGO = "Item PAD consolidado conferido com rateio antigo existente na memória. A soma das linhas antigas por área fecha integralmente com o PAD em quantidade, valor previsto, valor executado e saldo. Fica aceito o rateio antigo OUVIDORIA/CAPITAL 50% e CORREGEDORIA/CAPITAL 50% para uso em dry-run, sem alteração do planoAplicacao oficial.";
const MOTIVO_RATEIO_ANTIGO = "Item PAD consolidado possui rateio antigo por área com fechamento material e financeiro completo.";

function repoRootPadrao() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(repoRootPadrao(), caminhoRelativo);
}

function lerJsonSeExistir(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  if (!fs.existsSync(caminho)) return null;
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

function escreverArquivoJson(caminhoRelativo, dados) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverArquivoTexto(caminhoRelativo, conteudo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${conteudo.trimEnd()}\n`, "utf8");
}

function garantirArray(valor) {
  return Array.isArray(valor) ? valor : [];
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function normalizarDescricaoBasica(valor) {
  return normalizarTexto(valor)
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarDescricaoSemFrequenciaGhz(valor) {
  return normalizarTexto(valor)
    .replace(/\b\d+(?:[\.,]\d+)?\s*GHZ\b/g, " GHZ ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroOuNull(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const ultimoPonto = texto.lastIndexOf(".");
  const ultimaVirgula = texto.lastIndexOf(",");
  let normalizado = texto.replace(/[^\d,.-]/g, "");
  if (ultimaVirgula > ultimoPonto) {
    normalizado = normalizado.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) {
    normalizado = normalizado.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    normalizado = normalizado.replace(",", ".");
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function arredondar(valor, casas = 6) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  const fator = 10 ** casas;
  return Math.round((numero + Number.EPSILON) * fator) / fator;
}

function argumentoFlag(nome) {
  return process.argv.includes(nome);
}

function argumentoValor(nome) {
  const prefixo = `${nome}=`;
  const encontrado = process.argv.find((arg) => arg.startsWith(prefixo));
  return encontrado ? encontrado.slice(prefixo.length) : null;
}

function compararNumerico(antigo, pad, tolerancia) {
  if (antigo === null || pad === null) {
    return { ok: false, insuficiente: true, diferenca: null };
  }
  const diferenca = arredondar(antigo - pad, 6);
  return {
    ok: Math.abs(diferenca) <= tolerancia,
    insuficiente: false,
    diferenca,
  };
}

function possuiDecisaoResolutiva(divergencia) {
  return garantirArray(divergencia.decisoes)
    .some((decisao) => DECISOES_RESOLUTIVAS.has(String(decisao.decisao || "").toUpperCase()));
}

function extrairPad(divergencia) {
  const payload = divergencia.payload || {};
  return {
    id: divergencia.id,
    numeroConvenio: String(divergencia.numeroConvenio || payload.numeroConvenio || "").trim(),
    uf: divergencia.uf || payload.uf || null,
    chaveItem: divergencia.chaveItem || payload.chaveItem || null,
    descricao: payload.descricaoPad || divergencia.valorNovo || null,
    natureza: payload.naturezaPad || null,
    quantidade: numeroOuNull(payload.quantidadePad),
    valorUnitario: numeroOuNull(payload.valorUnitarioPad),
    valorPrevisto: numeroOuNull(payload.valorPrevistoPad),
    valorExecutado: numeroOuNull(payload.valorExecutadoPad),
    saldo: numeroOuNull(payload.saldoPad),
  };
}

function carregarDivergenciasItemNovoSemRateio() {
  const divergencias = [];
  let offset = 0;
  const limite = 500;
  while (true) {
    const pagina = revisaoService.listarDivergencias({ tipo: "item_novo_sem_rateio", limite, offset });
    divergencias.push(...pagina.divergencias);
    offset += pagina.divergencias.length;
    if (offset >= pagina.total || !pagina.divergencias.length) break;
  }
  return divergencias.map((divergencia) => revisaoService.obterDivergencia(divergencia.id));
}

function carregarMemoriaSqlite() {
  const linhas = db.prepare(`
    SELECT
      i.id AS item_id,
      i.chave_item,
      i.numero_convenio,
      i.descricao_normalizada,
      i.descricao_original_referencia,
      i.valor_unitario_referencia,
      r.area,
      r.natureza,
      r.quantidade_referencia,
      r.valor_previsto_referencia,
      r.valor_executado_referencia
    FROM profor_2022_itens_conhecidos i
    LEFT JOIN profor_2022_item_rateios r
      ON r.item_conhecido_id = i.id AND r.ativo = 1
    WHERE i.ativo = 1
    ORDER BY i.numero_convenio, i.id, r.id
  `).all();

  const mapa = new Map();
  for (const linha of linhas) {
    const chave = `sqlite:${linha.item_id}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        origem: "sqlite",
        itemConhecidoId: linha.item_id,
        chaveItem: linha.chave_item,
        numeroConvenio: String(linha.numero_convenio || "").trim(),
        descricaoNormalizada: linha.descricao_normalizada,
        descricaoOriginalReferencia: linha.descricao_original_referencia,
        valorUnitarioReferencia: numeroOuNull(linha.valor_unitario_referencia),
        rateios: [],
      });
    }
    if (linha.area || linha.natureza || linha.quantidade_referencia !== null) {
      mapa.get(chave).rateios.push({
        area: linha.area,
        natureza: linha.natureza,
        quantidadeReferencia: numeroOuNull(linha.quantidade_referencia) ?? 0,
        valorPrevistoReferencia: numeroOuNull(linha.valor_previsto_referencia) ?? 0,
        valorExecutadoReferencia: numeroOuNull(linha.valor_executado_referencia) ?? 0,
      });
    }
  }
  return Array.from(mapa.values()).filter((item) => item.rateios.length);
}

function carregarMemoriaRateioInicialDryRun() {
  const dados = lerJsonSeExistir(CAMINHO_RATEIO_INICIAL);
  if (!dados) return [];
  const itensPorChave = new Map();
  for (const item of garantirArray(dados.itensConhecidos)) {
    itensPorChave.set(String(item.chaveItem || "").trim(), item);
  }
  const rateiosPorChave = new Map();
  for (const rateio of garantirArray(dados.rateios)) {
    const chave = String(rateio.chaveItem || "").trim();
    if (!chave) continue;
    if (!rateiosPorChave.has(chave)) rateiosPorChave.set(chave, []);
    rateiosPorChave.get(chave).push({
      area: rateio.area,
      natureza: rateio.natureza,
      quantidadeReferencia: numeroOuNull(rateio.quantidadeReferencia) ?? 0,
      valorPrevistoReferencia: numeroOuNull(rateio.valorPrevistoReferencia) ?? 0,
      valorExecutadoReferencia: numeroOuNull(rateio.valorExecutadoReferencia) ?? 0,
    });
  }
  const memoria = [];
  for (const [chaveItem, rateios] of rateiosPorChave.entries()) {
    const item = itensPorChave.get(chaveItem) || {};
    memoria.push({
      origem: "rateio-inicial-dry-run",
      itemConhecidoId: null,
      chaveItem,
      numeroConvenio: String(item.numeroConvenio || chaveItem.split("::")[0] || "").trim(),
      descricaoNormalizada: item.descricaoNormalizada || chaveItem.split("::").slice(1).join("::"),
      descricaoOriginalReferencia: item.descricaoOriginalReferencia || null,
      valorUnitarioReferencia: numeroOuNull(item.valorUnitarioReferencia),
      rateios,
    });
  }
  return memoria;
}

function agregarMemoria(item) {
  const quantidade = item.rateios.reduce((total, rateio) => total + (numeroOuNull(rateio.quantidadeReferencia) ?? 0), 0);
  const valorPrevisto = item.rateios.reduce((total, rateio) => total + (numeroOuNull(rateio.valorPrevistoReferencia) ?? 0), 0);
  const valorExecutado = item.rateios.reduce((total, rateio) => total + (numeroOuNull(rateio.valorExecutadoReferencia) ?? 0), 0);
  const saldo = valorPrevisto - valorExecutado;
  const valorUnitario = item.valorUnitarioReferencia ?? (quantidade > 0 ? valorPrevisto / quantidade : null);
  return {
    ...item,
    quantidade: arredondar(quantidade, 6),
    valorUnitario: arredondar(valorUnitario, 2),
    valorPrevisto: arredondar(valorPrevisto, 2),
    valorExecutado: arredondar(valorExecutado, 2),
    saldo: arredondar(saldo, 2),
  };
}

function descricaoCompativel(pad, memoria) {
  const padBasica = normalizarDescricaoBasica(pad.descricao);
  const memoriaBasica = normalizarDescricaoBasica(memoria.descricaoNormalizada || memoria.descricaoOriginalReferencia);
  if (padBasica && memoriaBasica && padBasica === memoriaBasica) {
    return { ok: true, criterio: "descricao_normalizada_exata" };
  }

  const padSemGhz = normalizarDescricaoSemFrequenciaGhz(pad.descricao);
  const memoriaSemGhz = normalizarDescricaoSemFrequenciaGhz(memoria.descricaoNormalizada || memoria.descricaoOriginalReferencia);
  const haviaGhz = /\b\d+(?:[\.,]\d+)?\s*GHZ\b/i.test(String(pad.descricao || ""))
    && /\b\d+(?:[\.,]\d+)?\s*GHZ\b/i.test(String(memoria.descricaoNormalizada || memoria.descricaoOriginalReferencia || ""));
  if (haviaGhz && padSemGhz && memoriaSemGhz && padSemGhz === memoriaSemGhz) {
    return { ok: true, criterio: "descricao_sem_token_frequencia_ghz" };
  }

  return { ok: false, criterio: "descricao_incompativel" };
}

function calcularDiferencas(pad, memoria) {
  return {
    natureza: normalizarTexto(memoria.rateios[0]?.natureza) === normalizarTexto(pad.natureza)
      ? { ok: true, diferenca: null }
      : { ok: false, diferenca: "natureza divergente" },
    quantidade: compararNumerico(memoria.quantidade, pad.quantidade, TOLERANCIA_QUANTIDADE),
    valorPrevisto: compararNumerico(memoria.valorPrevisto, pad.valorPrevisto, TOLERANCIA_MONETARIA),
    valorExecutado: compararNumerico(memoria.valorExecutado, pad.valorExecutado, TOLERANCIA_MONETARIA),
    saldo: compararNumerico(memoria.saldo, pad.saldo, TOLERANCIA_MONETARIA),
  };
}

function todosRateiosComNaturezaCompativel(memoria, naturezaPad) {
  const natureza = normalizarTexto(naturezaPad);
  return Boolean(natureza) && memoria.rateios.every((rateio) => normalizarTexto(rateio.natureza) === natureza);
}

function montarRateioSugerido(memoria) {
  const quantidadeTotal = memoria.quantidade || 0;
  const valorPrevistoTotal = memoria.valorPrevisto || 0;
  return memoria.rateios.map((rateio) => {
    const quantidade = numeroOuNull(rateio.quantidadeReferencia) ?? 0;
    const valorPrevisto = numeroOuNull(rateio.valorPrevistoReferencia) ?? 0;
    const valorExecutado = numeroOuNull(rateio.valorExecutadoReferencia) ?? 0;
    return {
      area: rateio.area || null,
      natureza: rateio.natureza || null,
      quantidadeReferencia: arredondar(quantidade, 6),
      valorPrevistoReferencia: arredondar(valorPrevisto, 2),
      valorExecutadoReferencia: arredondar(valorExecutado, 2),
      saldoReferencia: arredondar(valorPrevisto - valorExecutado, 2),
      percentualQuantidade: quantidadeTotal > 0 ? arredondar((quantidade / quantidadeTotal) * 100, 6) : null,
      percentualValor: valorPrevistoTotal > 0 ? arredondar((valorPrevisto / valorPrevistoTotal) * 100, 6) : null,
    };
  });
}

function dadosPadInsuficientes(pad) {
  const campos = ["numeroConvenio", "descricao", "natureza", "quantidade", "valorPrevisto", "valorExecutado", "saldo"];
  return campos.filter((campo) => pad[campo] === null || pad[campo] === undefined || pad[campo] === "");
}

function classificarDivergencia(divergencia, memoriasSqlite, memoriasFallback) {
  if (possuiDecisaoResolutiva(divergencia) || !STATUS_ANALISAVEIS.has(String(divergencia.status || "").toUpperCase())) {
    return {
      id: divergencia.id,
      classificacao: "ja_decidido",
      numeroConvenio: divergencia.numeroConvenio,
      uf: divergencia.uf,
      chaveItem: divergencia.chaveItem,
      descricao: divergencia.payload?.descricaoPad || divergencia.valorNovo || null,
      motivos: ["Divergência já possui decisão resolutiva ou status não analisável."],
    };
  }

  const pad = extrairPad(divergencia);
  const faltantes = dadosPadInsuficientes(pad);
  if (faltantes.length) {
    return {
      id: divergencia.id,
      classificacao: "dados_insuficientes",
      numeroConvenio: pad.numeroConvenio,
      uf: pad.uf,
      chaveItem: pad.chaveItem,
      descricao: pad.descricao,
      dadosPad: pad,
      motivos: [`Campos PAD ausentes: ${faltantes.join(", ")}.`],
    };
  }

  const candidatosSqlite = memoriasSqlite.filter((memoria) => memoria.numeroConvenio === pad.numeroConvenio);
  let origemUsada = "sqlite";
  let candidatos = candidatosSqlite;
  if (!candidatos.length) {
    origemUsada = "rateio-inicial-dry-run";
    candidatos = memoriasFallback.filter((memoria) => memoria.numeroConvenio === pad.numeroConvenio);
  }

  const compativeisDescricao = candidatos
    .map(agregarMemoria)
    .map((memoria) => ({ memoria, compatibilidade: descricaoCompativel(pad, memoria) }))
    .filter((item) => item.compatibilidade.ok);

  if (!compativeisDescricao.length) {
    return {
      id: divergencia.id,
      classificacao: "sem_rateio_antigo_encontrado",
      numeroConvenio: pad.numeroConvenio,
      uf: pad.uf,
      chaveItem: pad.chaveItem,
      descricao: pad.descricao,
      dadosPad: pad,
      motivos: ["Nenhum rateio antigo com descrição compatível foi encontrado."],
    };
  }

  const avaliados = compativeisDescricao.map(({ memoria, compatibilidade }) => {
    const diferencas = calcularDiferencas(pad, memoria);
    const possuiArea = memoria.rateios.some((rateio) => String(rateio.area || "").trim());
    const percentuaisCalculaveis = memoria.quantidade > 0 && memoria.valorPrevisto > 0;
    const naturezaOk = todosRateiosComNaturezaCompativel(memoria, pad.natureza);
    const materialOk = naturezaOk
      && diferencas.quantidade.ok
      && diferencas.valorPrevisto.ok
      && diferencas.valorExecutado.ok
      && diferencas.saldo.ok
      && possuiArea
      && percentuaisCalculaveis;
    return {
      memoria,
      compatibilidade,
      diferencas,
      materialOk,
      possuiArea,
      percentuaisCalculaveis,
      naturezaOk,
    };
  });

  const compativel = avaliados.find((item) => item.materialOk);
  if (compativel) {
    return {
      id: divergencia.id,
      classificacao: "rateio_antigo_compativel",
      numeroConvenio: pad.numeroConvenio,
      uf: pad.uf,
      chaveItem: pad.chaveItem,
      descricao: pad.descricao,
      dadosPad: pad,
      origemRateioAntigo: origemUsada,
      itemMemoria: {
        itemConhecidoId: compativel.memoria.itemConhecidoId,
        chaveItem: compativel.memoria.chaveItem,
        descricaoOriginalReferencia: compativel.memoria.descricaoOriginalReferencia,
        descricaoNormalizada: compativel.memoria.descricaoNormalizada,
        criterioCompatibilidade: compativel.compatibilidade.criterio,
      },
      linhasAntigasEncontradas: compativel.memoria.rateios,
      rateioSugerido: montarRateioSugerido(compativel.memoria),
      diferencas: compativel.diferencas,
      justificativaSugerida: "Item PAD consolidado possui rateio antigo por área com mesma natureza, quantidade e valores fechando dentro da tolerância; candidato a saneamento assistido por rateio antigo.",
    };
  }

  return {
    id: divergencia.id,
    classificacao: "possivel_rateio_antigo_com_divergencia",
    numeroConvenio: pad.numeroConvenio,
    uf: pad.uf,
    chaveItem: pad.chaveItem,
    descricao: pad.descricao,
    dadosPad: pad,
    possiveisRateiosAntigos: avaliados.map((item) => ({
      origemRateioAntigo: origemUsada,
      itemConhecidoId: item.memoria.itemConhecidoId,
      chaveItem: item.memoria.chaveItem,
      descricaoOriginalReferencia: item.memoria.descricaoOriginalReferencia,
      descricaoNormalizada: item.memoria.descricaoNormalizada,
      criterioCompatibilidade: item.compatibilidade.criterio,
      possuiArea: item.possuiArea,
      percentuaisCalculaveis: item.percentuaisCalculaveis,
      naturezaOk: item.naturezaOk,
      totaisAntigos: {
        quantidade: item.memoria.quantidade,
        valorPrevisto: item.memoria.valorPrevisto,
        valorExecutado: item.memoria.valorExecutado,
        saldo: item.memoria.saldo,
      },
      diferencas: item.diferencas,
      rateioSugerido: montarRateioSugerido(item.memoria),
    })),
    motivos: ["Há descrição compatível, mas natureza, áreas, percentuais ou totais não fecham dentro da tolerância."],
  };
}

function agrupar(itens) {
  return {
    candidatos: itens.filter((item) => item.classificacao === "rateio_antigo_compativel"),
    divergentes: itens.filter((item) => item.classificacao === "possivel_rateio_antigo_com_divergencia"),
    semRateio: itens.filter((item) => item.classificacao === "sem_rateio_antigo_encontrado"),
    insuficientes: itens.filter((item) => item.classificacao === "dados_insuficientes"),
    jaDecididos: itens.filter((item) => item.classificacao === "ja_decidido"),
  };
}

function renderTabela(titulo, itens) {
  const linhas = [`### ${titulo}`, ""];
  if (!itens.length) {
    linhas.push("_Nenhum item._", "");
    return linhas;
  }
  linhas.push("| ID | Convênio | UF | Descrição | Classificação | Motivo/critério |");
  linhas.push("| --- | --- | --- | --- | --- | --- |");
  for (const item of itens) {
    const criterio = item.itemMemoria?.criterioCompatibilidade
      || item.motivos?.join("; ")
      || item.possiveisRateiosAntigos?.map((r) => r.criterioCompatibilidade).join(", ")
      || "-";
    linhas.push(
      `| ${item.id} | ${item.numeroConvenio || "-"} | ${item.uf || "-"} | `
      + `${String(item.descricao || "-").replace(/\|/g, "\\|")} | ${item.classificacao} | ${String(criterio).replace(/\|/g, "\\|")} |`
    );
  }
  linhas.push("");
  return linhas;
}

function renderRateiosCandidatos(candidatos) {
  const linhas = ["## Rateios sugeridos", ""];
  if (!candidatos.length) {
    linhas.push("_Nenhum rateio sugerido._", "");
    return linhas;
  }
  for (const item of candidatos) {
    linhas.push(`### Divergência #${item.id} - ${item.numeroConvenio}/${item.uf || "-"}`);
    linhas.push("");
    linhas.push(`Descrição PAD: ${item.descricao || "-"}`);
    linhas.push("");
    linhas.push("| Área | Natureza | Quantidade | Previsto | Executado | Saldo | % Qtd | % Valor |");
    linhas.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const rateio of item.rateioSugerido) {
      linhas.push(
        `| ${rateio.area || "-"} | ${rateio.natureza || "-"} | ${rateio.quantidadeReferencia} | `
        + `${rateio.valorPrevistoReferencia} | ${rateio.valorExecutadoReferencia} | ${rateio.saldoReferencia} | `
        + `${rateio.percentualQuantidade} | ${rateio.percentualValor} |`
      );
    }
    linhas.push("");
  }
  return linhas;
}

function renderMarkdown(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Auditoria de rateio antigo em itens PAD sem rateio",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "## Resumo",
    "",
    `- Total item_novo_sem_rateio analisados: ${relatorio.resumo.totalItemNovoSemRateioAnalisados}`,
    `- Rateio antigo compatível: ${relatorio.resumo.totalRateioAntigoCompativel}`,
    `- Possível rateio antigo com divergência: ${relatorio.resumo.totalPossivelRateioAntigoComDivergencia}`,
    `- Sem rateio antigo encontrado: ${relatorio.resumo.totalSemRateioAntigoEncontrado}`,
    `- Dados insuficientes: ${relatorio.resumo.totalDadosInsuficientes}`,
    `- Já decididos: ${relatorio.resumo.totalJaDecididos}`,
    "",
    ...renderTabela("Candidatos com rateio antigo compatível", relatorio.candidatosRateioAntigoCompativel),
    ...renderRateiosCandidatos(relatorio.candidatosRateioAntigoCompativel),
    ...renderTabela("Possível rateio antigo com divergência", relatorio.possiveisRateiosAntigosComDivergencia),
    ...renderTabela("Exigem rateio manual", relatorio.itensExigemRateioManual),
  ];
  return linhas.join("\n");
}

function montarRelatorio() {
  const divergencias = carregarDivergenciasItemNovoSemRateio();
  const memoriasSqlite = carregarMemoriaSqlite();
  const memoriasFallback = carregarMemoriaRateioInicialDryRun();
  const classificados = divergencias.map((divergencia) =>
    classificarDivergencia(divergencia, memoriasSqlite, memoriasFallback)
  );
  const grupos = agrupar(classificados);
  const itensExigemRateioManual = [
    ...grupos.divergentes,
    ...grupos.semRateio,
    ...grupos.insuficientes,
  ];

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    tolerancias: {
      quantidade: TOLERANCIA_QUANTIDADE,
      monetaria: TOLERANCIA_MONETARIA,
    },
    criterios: [
      "mesmo numero_convenio",
      "descrição normalizada exata ou compatibilidade controlada removendo apenas token decimal de frequência GHz",
      "natureza compatível",
      "quantidade, valor previsto, valor executado e saldo fechando nas tolerâncias",
      "ao menos uma linha antiga com área preenchida",
      "percentuais de quantidade e valor calculáveis",
    ],
    resumo: {
      totalItemNovoSemRateioAnalisados: classificados.length,
      totalRateioAntigoCompativel: grupos.candidatos.length,
      totalPossivelRateioAntigoComDivergencia: grupos.divergentes.length,
      totalSemRateioAntigoEncontrado: grupos.semRateio.length,
      totalDadosInsuficientes: grupos.insuficientes.length,
      totalJaDecididos: grupos.jaDecididos.length,
    },
    candidatosRateioAntigoCompativel: grupos.candidatos,
    possiveisRateiosAntigosComDivergencia: grupos.divergentes,
    semRateioAntigoEncontrado: grupos.semRateio,
    dadosInsuficientes: grupos.insuficientes,
    jaDecididos: grupos.jaDecididos,
    itensExigemRateioManual,
    aplicacao: {
      solicitada: false,
      totalAplicados: 0,
      aplicados: [],
    },
  };
}

function validarCandidatoParaAplicacao(candidato, idEsperado) {
  if (!candidato) {
    throw new Error(`Candidato #${idEsperado} não foi encontrado como rateio_antigo_compativel.`);
  }
  if (candidato.id !== idEsperado) {
    throw new Error(`Aplicação abortada: candidato inesperado #${candidato.id}; esperado #${idEsperado}.`);
  }
  if (candidato.classificacao !== "rateio_antigo_compativel") {
    throw new Error(`Aplicação abortada: #${candidato.id} não está classificado como rateio_antigo_compativel.`);
  }

  const diferencas = candidato.diferencas || {};
  for (const campo of ["quantidade", "valorPrevisto", "valorExecutado", "saldo"]) {
    if (!diferencas[campo]?.ok) {
      throw new Error(`Aplicação abortada: #${candidato.id} não fecha ${campo}.`);
    }
  }
  if (!diferencas.natureza?.ok) {
    throw new Error(`Aplicação abortada: #${candidato.id} possui natureza incompatível.`);
  }

  const rateio = garantirArray(candidato.rateioSugerido);
  if (!rateio.length) {
    throw new Error(`Aplicação abortada: #${candidato.id} não possui rateio sugerido.`);
  }
  if (rateio.some((linha) => !String(linha.area || "").trim() || !String(linha.natureza || "").trim())) {
    throw new Error(`Aplicação abortada: #${candidato.id} possui linha de rateio sem área ou natureza.`);
  }

  const somaPercentualValor = rateio.reduce((total, linha) => total + (numeroOuNull(linha.percentualValor) ?? 0), 0);
  const somaPercentualQuantidade = rateio.reduce((total, linha) => total + (numeroOuNull(linha.percentualQuantidade) ?? 0), 0);
  if (Math.abs(somaPercentualValor - 100) > TOLERANCIA_QUANTIDADE) {
    throw new Error(`Aplicação abortada: percentualValor soma ${somaPercentualValor}, não 100.`);
  }
  if (Math.abs(somaPercentualQuantidade - 100) > TOLERANCIA_QUANTIDADE) {
    throw new Error(`Aplicação abortada: percentualQuantidade soma ${somaPercentualQuantidade}, não 100.`);
  }
}

function montarPayloadDecisao(candidato) {
  return {
    origem: "auditoria-rateio-antigo-em-item-sem-rateio",
    tipoSaneamento: "rateio_manual",
    rateio: candidato.rateioSugerido.map((linha) => ({
      area: linha.area,
      natureza: linha.natureza,
      percentualValor: linha.percentualValor,
      percentualQuantidade: linha.percentualQuantidade,
    })),
    rateioAntigoValidado: true,
    itemMemoria: {
      chaveItem: candidato.itemMemoria.chaveItem,
    },
    motivo: MOTIVO_RATEIO_ANTIGO,
  };
}

function aplicarRateioAntigo(relatorio, idAlvo) {
  const candidatos = relatorio.candidatosRateioAntigoCompativel;
  const candidato = candidatos.find((item) => item.id === idAlvo);
  if (candidatos.some((item) => item.id !== idAlvo)) {
    const ids = candidatos.map((item) => item.id).join(", ");
    throw new Error(`Aplicação abortada: há candidatos além do alvo #${idAlvo}: ${ids}.`);
  }
  validarCandidatoParaAplicacao(candidato, idAlvo);

  const resultado = revisaoService.registrarDecisao(candidato.id, {
    decisao: "ACEITO",
    justificativa: JUSTIFICATIVA_RATEIO_ANTIGO,
    usuario: USUARIO_DECISAO,
    payloadDecisao: montarPayloadDecisao(candidato),
  });
  if (resultado.aplicadaAoPlano !== false) {
    throw new Error(`Decisão ${resultado.decisaoId} retornou aplicadaAoPlano diferente de false.`);
  }

  const detalhe = revisaoService.obterDivergencia(candidato.id);
  const decisao = detalhe.decisoes.find((item) => item.id === resultado.decisaoId);
  const temSnapshot = Boolean(decisao?.payloadDecisao?._segurancaPreAtivacao);
  const temLog = detalhe.logs.some((log) =>
    log.evento === "decisao_registrada" && log.estadoNovo?.decisaoId === resultado.decisaoId
  );
  if (!temSnapshot) {
    throw new Error(`Decisão ${resultado.decisaoId} não possui snapshot _segurancaPreAtivacao.`);
  }
  if (!temLog) {
    throw new Error(`Decisão ${resultado.decisaoId} não possui log decisao_registrada.`);
  }

  return {
    divergenciaId: candidato.id,
    decisaoId: resultado.decisaoId,
    statusAnterior: resultado.statusAnterior,
    statusNovo: resultado.statusNovo,
    aplicadaAoPlano: resultado.aplicadaAoPlano,
    temSnapshot,
    temLog,
    payloadDecisao: decisao.payloadDecisao,
  };
}

function imprimirRelatorio(relatorio) {
  console.log("Auditoria de rateio antigo em item_novo_sem_rateio PAD/PROFOR 2022");
  console.log(`Total item_novo_sem_rateio analisados: ${relatorio.resumo.totalItemNovoSemRateioAnalisados}`);
  console.log(`Rateio antigo compatível: ${relatorio.resumo.totalRateioAntigoCompativel}`);
  console.log(`Possível rateio antigo com divergência: ${relatorio.resumo.totalPossivelRateioAntigoComDivergencia}`);
  console.log(`Sem rateio antigo encontrado: ${relatorio.resumo.totalSemRateioAntigoEncontrado}`);
  console.log(`Dados insuficientes: ${relatorio.resumo.totalDadosInsuficientes}`);
  console.log(`Já decididos: ${relatorio.resumo.totalJaDecididos}`);
  console.log("Candidatos a saneamento assistido:");
  if (!relatorio.candidatosRateioAntigoCompativel.length) {
    console.log("  (nenhum)");
  } else {
    for (const item of relatorio.candidatosRateioAntigoCompativel) {
      console.log(
        `  #${item.id} | ${item.numeroConvenio}/${item.uf || "-"} | ${item.descricao}`
        + ` | rateios: ${item.rateioSugerido.length}`
      );
    }
  }
  console.log(`Saída JSON: ${CAMINHO_SAIDA_JSON}`);
  console.log(`Saída Markdown: ${CAMINHO_SAIDA_MD}`);
  if (relatorio.aplicacao?.solicitada) {
    console.log(`Decisões ACEITO registradas: ${relatorio.aplicacao.totalAplicados}`);
    for (const item of relatorio.aplicacao.aplicados) {
      console.log(`  #${item.divergenciaId} -> decisão ${item.decisaoId} | aplicadaAoPlano=${item.aplicadaAoPlano}`);
    }
  } else {
    console.log("Dry-run: nenhuma decisão foi registrada.");
  }
}

function executar() {
  inicializarBanco();
  const aplicar = argumentoFlag("--aplicar");
  const idAlvo = Number(argumentoValor("--id") || 23);
  const relatorio = montarRelatorio();
  if (aplicar) {
    const aplicado = aplicarRateioAntigo(relatorio, idAlvo);
    relatorio.modo = "aplicacao-assistida";
    relatorio.aplicacao = {
      solicitada: true,
      idAlvo,
      totalAplicados: 1,
      aplicados: [aplicado],
    };
  }
  escreverArquivoJson(CAMINHO_SAIDA_JSON, relatorio);
  escreverArquivoTexto(CAMINHO_SAIDA_MD, renderMarkdown(relatorio));
  imprimirRelatorio(relatorio);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao auditar rateio antigo em itens PAD sem rateio PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

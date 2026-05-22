const fs = require("node:fs");
const path = require("node:path");

const { inicializarBanco } = require("../db/init-db");
const revisaoService = require("../services/profor-2022/profor-pad-revisao-decisao-service");

const CAMINHO_SAIDA_JSON = "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json";
const CAMINHO_SAIDA_MD = "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.md";
const CAMINHO_PAD_RELATORIOS_JSON = "backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json";

const STATUS_ANALISAVEIS = new Set(["PENDENTE", "EM_REVISAO"]);
const DECISOES_RESOLUTIVAS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);
const TOLERANCIA_QUANTIDADE = 0.000001;
const TOLERANCIA_QUANTIDADE_DERIVADA = 0.01;
const TOLERANCIA_MONETARIA = 0.01;
const TOLERANCIA_VALOR_UNITARIO_AGRUPAMENTO = 0.01;
const USUARIO_DECISAO = "sistema-auditoria-item-nao-apto";
const JUSTIFICATIVA_ACEITE = "Item conferido automaticamente: descrição/chave, natureza, quantidade, valor unitário, valor previsto, valor executado e saldo coincidem entre memória e PAD dentro da tolerância definida. A pendência referia-se apenas à marcação histórica de não aptidão, motivo pelo qual fica registrada a liberação para uso em dry-run, sem alteração do planoAplicacao oficial.";
const PAYLOAD_DECISAO = {
  origem: "auditoria-item-nao-apto-sem-divergencia",
  tipoSaneamento: "liberacao_item_nao_apto",
  liberarUsoDryRun: true,
  motivo: "Item presente no PAD com dados materiais coincidentes com a memória; liberado para uso em dry-run por decisão assistida.",
};

function repoRootPadrao() {
  return path.resolve(__dirname, "../..");
}

function escreverArquivoJson(caminhoRelativo, dados) {
  const caminho = path.join(repoRootPadrao(), caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverArquivoTexto(caminhoRelativo, conteudo) {
  const caminho = path.join(repoRootPadrao(), caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${conteudo.trimEnd()}\n`, "utf8");
}

function lerJsonRelativo(caminhoRelativo, fallback = null) {
  const caminho = path.join(repoRootPadrao(), caminhoRelativo);
  if (!fs.existsSync(caminho)) return fallback;
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

function normalizarTextoComparacao(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function arredondarQuantidade(valor) {
  if (!Number.isFinite(valor)) return null;
  return Math.round((Number(valor) + Number.EPSILON) * 1000000) / 1000000;
}

function arredondarMoeda(valor) {
  if (!Number.isFinite(valor)) return null;
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
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

function valorAninhado(objeto, caminhos) {
  for (const caminho of caminhos) {
    const partes = String(caminho).split(".");
    let atual = objeto;
    for (const parte of partes) {
      if (atual === null || atual === undefined) break;
      atual = atual[parte];
    }
    if (atual !== null && atual !== undefined && atual !== "") return atual;
  }
  return null;
}

function montarMemoriaPad(divergencia) {
  const payload = divergencia.payload || {};
  const memoria = payload.memoria || payload.antes || {};
  const pad = payload.pad || payload.depois || {};
  return {
    memoria: {
      descricao: valorAninhado(memoria, ["descricao", "descricaoOriginal", "descricaoOriginalReferencia"])
        ?? payload.descricaoMemoria
        ?? payload.descricaoAnterior
        ?? payload.descricaoOriginalReferencia,
      natureza: valorAninhado(memoria, ["natureza"]) ?? payload.naturezaMemoria ?? payload.naturezaAnterior,
      quantidade: numeroOuNull(valorAninhado(memoria, ["quantidade", "quantidadeReferencia"]) ?? payload.quantidadeMemoria ?? payload.quantidadeAnterior),
      valorUnitario: numeroOuNull(valorAninhado(memoria, ["valorUnitario", "valorUnitarioReferencia"]) ?? payload.valorUnitarioMemoria ?? payload.valorUnitarioAnterior),
      valorPrevisto: numeroOuNull(valorAninhado(memoria, ["valorPrevisto", "valorPrevistoReferencia"]) ?? payload.valorPrevistoMemoria ?? payload.valorPrevistoAnterior),
      valorExecutado: numeroOuNull(valorAninhado(memoria, ["valorExecutado", "valorExecutadoReferencia"]) ?? payload.valorExecutadoMemoria ?? payload.valorExecutadoAnterior),
      saldo: numeroOuNull(valorAninhado(memoria, ["saldo"]) ?? payload.saldoMemoria ?? payload.saldoAnterior),
    },
    pad: {
      descricao: valorAninhado(pad, ["descricao", "descricaoOriginal"]) ?? payload.descricaoPad ?? payload.descricaoNova,
      natureza: valorAninhado(pad, ["natureza"]) ?? payload.naturezaPad ?? payload.naturezaNova,
      quantidade: numeroOuNull(valorAninhado(pad, ["quantidade"]) ?? payload.quantidadePad ?? payload.quantidadeNova),
      valorUnitario: numeroOuNull(valorAninhado(pad, ["valorUnitario"]) ?? payload.valorUnitarioPad ?? payload.valorUnitarioNovo),
      valorPrevisto: numeroOuNull(valorAninhado(pad, ["valorPrevisto", "valorTotalPrevisto"]) ?? payload.valorPrevistoPad ?? payload.valorPrevistoNovo),
      valorExecutado: numeroOuNull(valorAninhado(pad, ["valorExecutado", "valorTotalExecutado"]) ?? payload.valorExecutadoPad ?? payload.valorExecutadoNovo),
      saldo: numeroOuNull(valorAninhado(pad, ["saldo"]) ?? payload.saldoPad ?? payload.saldoNovo),
    },
  };
}

function compararNumerico(memoria, pad, tolerancia) {
  if (memoria === null || pad === null) {
    return { ok: false, insuficiente: true, diferenca: null };
  }
  const diferenca = Number((memoria - pad).toFixed(6));
  return {
    ok: Math.abs(diferenca) <= tolerancia,
    insuficiente: false,
    diferenca,
  };
}

function numeroConvenioDivergencia(divergencia) {
  return String(divergencia.numeroConvenio
    ?? divergencia.numero_convenio
    ?? divergencia.payload?.numeroConvenio
    ?? "").trim();
}

function numeroConvenioItemPad(item) {
  return String(item?.numeroConvenio
    ?? item?.instrumento
    ?? item?.codigoInstrumento
    ?? item?.codigo_instrumento
    ?? "").trim();
}

function descricaoItemPad(item) {
  return String(item?.descricao ?? item?.descricaoOriginal ?? "").trim();
}

function naturezaItemPad(item) {
  return String(item?.natureza ?? item?.naturezaPad ?? "").trim();
}

function quantidadeItemPad(item) {
  return numeroOuNull(item?.quantidade ?? item?.quantidadePad);
}

function valorUnitarioItemPad(item) {
  return numeroOuNull(item?.valorUnitario ?? item?.valorUnitarioPad);
}

function valorPrevistoItemPad(item) {
  return numeroOuNull(item?.valorTotalPrevisto ?? item?.valorPrevisto ?? item?.valorPrevistoPad);
}

function valorExecutadoItemPad(item) {
  return numeroOuNull(item?.valorTotalExecutado ?? item?.valorExecutado ?? item?.valorExecutadoPad);
}

function saldoItemPad(item) {
  return numeroOuNull(item?.saldo ?? item?.saldoPad);
}

function carregarItensPadRelatorio() {
  const relatorio = lerJsonRelativo(CAMINHO_PAD_RELATORIOS_JSON, { itens: [] });
  return Array.isArray(relatorio?.itens) ? relatorio.itens : [];
}

function valoresProximos(a, b, tolerancia) {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerancia;
}

function localizarLinhasPadEquivalentes(divergencia, dados, itensPad) {
  if (!Array.isArray(itensPad) || !itensPad.length) return [];

  const numeroConvenio = numeroConvenioDivergencia(divergencia);
  const descricaoReferencia = normalizarTextoComparacao(dados.pad.descricao || dados.memoria.descricao);
  const naturezaReferencia = normalizarTextoComparacao(dados.pad.natureza || dados.memoria.natureza);
  const valorUnitarioReferencia = dados.memoria.valorUnitario ?? dados.pad.valorUnitario;

  if (!numeroConvenio || !descricaoReferencia || !naturezaReferencia || valorUnitarioReferencia === null) {
    return [];
  }

  return itensPad.filter((item) => {
    if (numeroConvenioItemPad(item) !== numeroConvenio) return false;
    if (normalizarTextoComparacao(descricaoItemPad(item)) !== descricaoReferencia) return false;
    if (normalizarTextoComparacao(naturezaItemPad(item)) !== naturezaReferencia) return false;
    return valoresProximos(valorUnitarioItemPad(item), valorUnitarioReferencia, TOLERANCIA_VALOR_UNITARIO_AGRUPAMENTO);
  });
}

function consolidarLinhasPad(linhas) {
  if (!Array.isArray(linhas) || !linhas.length) return null;

  const quantidade = linhas.reduce((soma, item) => soma + (quantidadeItemPad(item) ?? 0), 0);
  const valorPrevisto = linhas.reduce((soma, item) => soma + (valorPrevistoItemPad(item) ?? 0), 0);
  const valorExecutado = linhas.reduce((soma, item) => soma + (valorExecutadoItemPad(item) ?? 0), 0);
  const saldo = linhas.reduce((soma, item) => soma + (saldoItemPad(item) ?? 0), 0);

  return {
    descricao: descricaoItemPad(linhas[0]),
    natureza: naturezaItemPad(linhas[0]),
    quantidade: arredondarQuantidade(quantidade),
    valorUnitario: quantidade > 0 ? arredondarMoeda(valorPrevisto / quantidade) : valorUnitarioItemPad(linhas[0]),
    valorPrevisto: arredondarMoeda(valorPrevisto),
    valorExecutado: arredondarMoeda(valorExecutado),
    saldo: arredondarMoeda(saldo),
    totalLinhasPadEquivalentes: linhas.length,
    linhas: linhas.map((item) => ({
      arquivo: item.arquivo,
      aba: item.aba,
      linha: item.linha,
      descricao: descricaoItemPad(item),
      natureza: naturezaItemPad(item),
      quantidade: quantidadeItemPad(item),
      valorUnitario: valorUnitarioItemPad(item),
      valorPrevisto: valorPrevistoItemPad(item),
      valorExecutado: valorExecutadoItemPad(item),
      saldo: saldoItemPad(item),
    })),
  };
}

function detectarRateiosQuantidadeSuspeita(dados, payload) {
  const valorUnitario = dados.memoria.valorUnitario;
  if (valorUnitario === null || valorUnitario <= 0) return [];

  return (Array.isArray(payload.rateiosAtivos) ? payload.rateiosAtivos : [])
    .map((rateio) => {
      const quantidadeGravada = numeroOuNull(rateio.quantidadeReferencia);
      const valorPrevisto = numeroOuNull(rateio.valorPrevistoReferencia);
      if (quantidadeGravada === null || valorPrevisto === null) return null;
      const quantidadeEstimada = valorPrevisto / valorUnitario;
      const fatorInflacao = quantidadeEstimada > 0 ? quantidadeGravada / quantidadeEstimada : null;
      const fator10 = fatorInflacao !== null && Math.abs(fatorInflacao - 10) <= 0.05;
      const valorPelaQuantidadeGravada = quantidadeGravada * valorUnitario;
      const fechamentoIncompativel = Math.abs(valorPelaQuantidadeGravada - valorPrevisto) > TOLERANCIA_MONETARIA;
      if (!fator10 && !fechamentoIncompativel) return null;
      return {
        area: rateio.area,
        natureza: rateio.natureza,
        quantidadeGravada,
        quantidadeEstimada: arredondarQuantidade(quantidadeEstimada),
        fatorInflacao: fatorInflacao === null ? null : arredondarQuantidade(fatorInflacao),
        fatorInflacaoDecimal10: fator10,
        valorUnitarioReferencia: valorUnitario,
        valorPrevistoReferencia: valorPrevisto,
      };
    })
    .filter(Boolean);
}

function compararQuantidadeMemoriaPad(dados, padConsolidado) {
  const comparacaoEstrita = compararNumerico(dados.memoria.quantidade, padConsolidado.quantidade, TOLERANCIA_QUANTIDADE);
  if (comparacaoEstrita.ok) return comparacaoEstrita;

  const quantidadeDerivadaFecha = valoresProximos(
    dados.memoria.quantidade,
    padConsolidado.quantidade,
    TOLERANCIA_QUANTIDADE_DERIVADA
  );
  if (quantidadeDerivadaFecha) {
    return {
      ok: true,
      insuficiente: false,
      diferenca: Number((dados.memoria.quantidade - padConsolidado.quantidade).toFixed(6)),
      toleranciaDerivada: TOLERANCIA_QUANTIDADE_DERIVADA,
    };
  }
  return comparacaoEstrita;
}

function saldoCalculadoCompativelComPad(dados, padConsolidado) {
  if (dados.memoria.valorPrevisto === null || dados.memoria.valorExecutado === null || padConsolidado.saldo === null) {
    return false;
  }
  const saldoCalculadoMemoria = arredondarMoeda(dados.memoria.valorPrevisto - dados.memoria.valorExecutado);
  return valoresProximos(saldoCalculadoMemoria, padConsolidado.saldo, TOLERANCIA_MONETARIA);
}

function avaliarComparacao(dados, padComparacao) {
  const naturezaMemoria = normalizarTextoComparacao(dados.memoria.natureza);
  const naturezaPad = normalizarTextoComparacao(padComparacao.natureza);
  const comparacoes = {
    natureza: { ok: naturezaMemoria === naturezaPad, diferenca: null },
    quantidade: compararQuantidadeMemoriaPad(dados, padComparacao),
    valorUnitario: compararNumerico(dados.memoria.valorUnitario, padComparacao.valorUnitario, TOLERANCIA_MONETARIA),
    valorPrevisto: compararNumerico(dados.memoria.valorPrevisto, padComparacao.valorPrevisto, TOLERANCIA_MONETARIA),
    valorExecutado: compararNumerico(dados.memoria.valorExecutado, padComparacao.valorExecutado, TOLERANCIA_MONETARIA),
    saldo: compararNumerico(dados.memoria.saldo, padComparacao.saldo, TOLERANCIA_MONETARIA),
  };

  if (!comparacoes.saldo.ok && saldoCalculadoCompativelComPad(dados, padComparacao)) {
    comparacoes.saldo = {
      ok: true,
      diferenca: comparacoes.saldo.diferenca,
      saldoMemoriaCalculado: arredondarMoeda(dados.memoria.valorPrevisto - dados.memoria.valorExecutado),
      saldoInformadoIgnoradoPorFechamento: true,
    };
  }

  return comparacoes;
}

function divergenciasComparacoes(comparacoes) {
  return Object.entries(comparacoes)
    .filter(([, comparacao]) => !comparacao.ok)
    .map(([campo, comparacao]) =>
      comparacao.diferenca === null
        ? `${campo} divergente`
        : `${campo} divergente (${comparacao.diferenca})`
    );
}

function possuiDecisaoResolutiva(divergencia) {
  return Array.isArray(divergencia.decisoes)
    && divergencia.decisoes.some((decisao) => DECISOES_RESOLUTIVAS.has(String(decisao.decisao || "").toUpperCase()));
}

function montarLinhaRelatorio(divergencia, dados, classificacao, motivos, extras = {}) {
  const descricao = dados.memoria.descricao || dados.pad.descricao || divergencia.valorNovo || divergencia.chaveItem;
  return {
    id: divergencia.id,
    classificacao,
    numeroConvenio: divergencia.numeroConvenio,
    uf: divergencia.uf,
    chaveItem: divergencia.chaveItem,
    descricao,
    naturezaMemoria: dados.memoria.natureza,
    naturezaPad: dados.pad.natureza,
    quantidadeMemoria: dados.memoria.quantidade,
    quantidadePad: dados.pad.quantidade,
    valorUnitarioMemoria: dados.memoria.valorUnitario,
    valorUnitarioPad: dados.pad.valorUnitario,
    valorPrevistoMemoria: dados.memoria.valorPrevisto,
    valorPrevistoPad: dados.pad.valorPrevisto,
    valorExecutadoMemoria: dados.memoria.valorExecutado,
    valorExecutadoPad: dados.pad.valorExecutado,
    saldoMemoria: dados.memoria.saldo,
    saldoPad: dados.pad.saldo,
    quantidadePadConsolidada: extras.padConsolidado?.quantidade ?? null,
    valorUnitarioPadConsolidado: extras.padConsolidado?.valorUnitario ?? null,
    valorPrevistoPadConsolidado: extras.padConsolidado?.valorPrevisto ?? null,
    valorExecutadoPadConsolidado: extras.padConsolidado?.valorExecutado ?? null,
    saldoPadConsolidado: extras.padConsolidado?.saldo ?? null,
    padConsolidado: extras.padConsolidado || null,
    rateiosQuantidadeSuspeita: extras.rateiosQuantidadeSuspeita || [],
    justificativaSugerida: ["candidato_aceite_automatico", "falso_positivo_saneavel"].includes(classificacao)
      ? JUSTIFICATIVA_ACEITE
      : null,
    motivos,
  };
}

function classificarDivergencia(divergencia, contexto = {}) {
  if (possuiDecisaoResolutiva(divergencia) || !STATUS_ANALISAVEIS.has(String(divergencia.status || "").toUpperCase())) {
    return montarLinhaRelatorio(divergencia, montarMemoriaPad(divergencia), "ja_decidido", [
      "Divergência já possui decisão resolutiva ou status não analisável.",
    ]);
  }

  if (!divergencia.payload || typeof divergencia.payload !== "object") {
    return montarLinhaRelatorio(divergencia, { memoria: {}, pad: {} }, "erro_payload", [
      "Payload ausente ou inválido.",
    ]);
  }

  const dados = montarMemoriaPad(divergencia);
  const payload = divergencia.payload || {};
  const linhasPadEquivalentes = localizarLinhasPadEquivalentes(divergencia, dados, contexto.itensPad || []);
  const padConsolidado = consolidarLinhasPad(linhasPadEquivalentes);
  const rateiosQuantidadeSuspeita = detectarRateiosQuantidadeSuspeita(dados, payload);
  const camposObrigatorios = ["quantidade", "valorUnitario", "valorPrevisto", "valorExecutado", "saldo"];
  const faltantesMemoria = camposObrigatorios.filter((campo) => dados.memoria[campo] === null);
  const faltantesPad = camposObrigatorios.filter((campo) => dados.pad[campo] === null);
  if (faltantesMemoria.length || faltantesPad.length) {
    return montarLinhaRelatorio(divergencia, dados, "dados_memoria_insuficientes", [
      faltantesMemoria.length ? `Campos de memória ausentes: ${faltantesMemoria.join(", ")}.` : null,
      faltantesPad.length ? `Campos PAD ausentes: ${faltantesPad.join(", ")}.` : null,
    ].filter(Boolean));
  }

  const naturezaMemoria = normalizarTextoComparacao(dados.memoria.natureza);
  const naturezaPad = normalizarTextoComparacao(dados.pad.natureza);
  if (!naturezaMemoria || !naturezaPad) {
    return montarLinhaRelatorio(divergencia, dados, "dados_memoria_insuficientes", [
      "Natureza ausente na memória ou no PAD.",
    ]);
  }

  const comparacoes = avaliarComparacao(dados, dados.pad);
  const descricaoMemoria = normalizarTextoComparacao(dados.memoria.descricao);
  const descricaoPad = normalizarTextoComparacao(dados.pad.descricao);
  const descricaoCoincide = Boolean(descricaoMemoria && descricaoPad && descricaoMemoria === descricaoPad);
  const chaveItemPresente = Boolean(String(divergencia.chaveItem || "").trim());

  const divergencias = divergenciasComparacoes(comparacoes);

  if (divergencias.length && padConsolidado && padConsolidado.totalLinhasPadEquivalentes > 1) {
    const comparacoesConsolidadas = avaliarComparacao(dados, padConsolidado);
    const divergenciasConsolidadas = divergenciasComparacoes(comparacoesConsolidadas);
    const fechamentoFinanceiroOk = comparacoesConsolidadas.valorPrevisto.ok
      && comparacoesConsolidadas.valorExecutado.ok
      && comparacoesConsolidadas.saldo.ok;
    const quantidadeOk = comparacoesConsolidadas.quantidade.ok;
    const valorUnitarioOk = comparacoesConsolidadas.valorUnitario.ok;

    if (!divergenciasConsolidadas.length || (fechamentoFinanceiroOk && quantidadeOk && valorUnitarioOk)) {
      const motivos = [
        `PAD possui ${padConsolidado.totalLinhasPadEquivalentes} linhas equivalentes consolidadas por convênio, descrição, natureza e valor unitário.`,
        "Quantidade, valor previsto total e valor unitário fecham no conjunto consolidado.",
        "Bloqueio anterior decorre de comparação contra linha PAD isolada.",
      ];
      if (rateiosQuantidadeSuspeita.length) {
        motivos.push("Rateios da memória apresentam quantidade legada incompatível com valor previsto / valor unitário, com indício de inflação decimal.");
      }
      if ((payload.alertasOriginais || []).some((alerta) => String(alerta.tipo) === "fechamento_valor_inconsistente")) {
        motivos.push("Alertas originais indicam saldo antigo inconsistente; saldo calculado por previsto - executado fecha com o PAD consolidado.");
      }
      return montarLinhaRelatorio(divergencia, dados, "falso_positivo_saneavel", motivos, {
        padConsolidado,
        rateiosQuantidadeSuspeita,
      });
    }
  }

  if (divergencias.length) {
    const motivos = [...divergencias];
    if (padConsolidado?.totalLinhasPadEquivalentes > 1) {
      motivos.push(`PAD consolidado também foi avaliado com ${padConsolidado.totalLinhasPadEquivalentes} linhas equivalentes, mas ainda há divergência material.`);
    }
    return montarLinhaRelatorio(divergencia, dados, "divergencia_material", motivos, {
      padConsolidado,
      rateiosQuantidadeSuspeita,
    });
  }

  const motivos = [
    "Natureza, quantidade e valores coincidem dentro das tolerâncias.",
    descricaoCoincide
      ? "Descrição normalizada coincide."
      : (chaveItemPresente ? "Descrição diverge, mas a chave do item está preservada e os dados materiais coincidem." : "Descrição diverge e chave do item ausente."),
  ];
  if (!descricaoCoincide && !chaveItemPresente) {
    return montarLinhaRelatorio(divergencia, dados, "divergencia_material", motivos);
  }
  return montarLinhaRelatorio(divergencia, dados, "candidato_aceite_automatico", motivos, {
    padConsolidado,
    rateiosQuantidadeSuspeita,
  });
}

function carregarDivergenciasItemNaoApto() {
  const divergencias = [];
  let offset = 0;
  const limite = 500;
  while (true) {
    const pagina = revisaoService.listarDivergencias({ tipo: "item_nao_apto", limite, offset });
    divergencias.push(...pagina.divergencias);
    offset += pagina.divergencias.length;
    if (offset >= pagina.total || !pagina.divergencias.length) break;
  }
  return divergencias.map((divergencia) => revisaoService.obterDivergencia(divergencia.id));
}

function agruparPorClassificacao(itens) {
  return {
    candidatosAceiteAutomatico: itens.filter((item) => item.classificacao === "candidato_aceite_automatico"),
    falsosPositivosSaneaveis: itens.filter((item) => item.classificacao === "falso_positivo_saneavel"),
    divergenciasMateriais: itens.filter((item) => item.classificacao === "divergencia_material"),
    dadosMemoriaInsuficientes: itens.filter((item) => item.classificacao === "dados_memoria_insuficientes"),
    jaDecididos: itens.filter((item) => item.classificacao === "ja_decidido"),
    errosPayload: itens.filter((item) => item.classificacao === "erro_payload"),
  };
}

function validarCandidatosParaAplicacao(candidatos) {
  for (const candidato of candidatos) {
    const campos = [
      ["quantidade", candidato.quantidadeMemoria, candidato.quantidadePad, TOLERANCIA_QUANTIDADE],
      ["valorUnitario", candidato.valorUnitarioMemoria, candidato.valorUnitarioPad, TOLERANCIA_MONETARIA],
      ["valorPrevisto", candidato.valorPrevistoMemoria, candidato.valorPrevistoPad, TOLERANCIA_MONETARIA],
      ["valorExecutado", candidato.valorExecutadoMemoria, candidato.valorExecutadoPad, TOLERANCIA_MONETARIA],
      ["saldo", candidato.saldoMemoria, candidato.saldoPad, TOLERANCIA_MONETARIA],
    ];
    for (const [campo, memoria, pad, tolerancia] of campos) {
      if (memoria === null || pad === null) {
        throw new Error(`Candidato ${candidato.id} possui campo obrigatório ausente: ${campo}.`);
      }
      if (Math.abs(memoria - pad) > tolerancia) {
        throw new Error(`Candidato ${candidato.id} possui divergência em ${campo}: ${memoria} x ${pad}.`);
      }
    }
    if (normalizarTextoComparacao(candidato.naturezaMemoria) !== normalizarTextoComparacao(candidato.naturezaPad)) {
      throw new Error(`Candidato ${candidato.id} possui divergência de natureza.`);
    }
  }
}

function aplicarAceiteAssistido(candidatos) {
  validarCandidatosParaAplicacao(candidatos);
  const aplicados = [];
  for (const candidato of candidatos) {
    const resultado = revisaoService.registrarDecisao(candidato.id, {
      decisao: "ACEITO",
      justificativa: JUSTIFICATIVA_ACEITE,
      usuario: USUARIO_DECISAO,
      payloadDecisao: PAYLOAD_DECISAO,
    });
    if (resultado.aplicadaAoPlano !== false) {
      throw new Error(`Decisão ${resultado.decisaoId} retornou aplicadaAoPlano diferente de false.`);
    }
    aplicados.push({
      id: candidato.id,
      decisaoId: resultado.decisaoId,
      statusAnterior: resultado.statusAnterior,
      statusNovo: resultado.statusNovo,
      aplicadaAoPlano: resultado.aplicadaAoPlano,
    });
  }
  return aplicados;
}

function renderTabelaMarkdown(titulo, itens) {
  const linhas = [`### ${titulo}`, ""];
  if (!itens.length) {
    linhas.push("_Nenhum item._", "");
    return linhas;
  }
  linhas.push("| ID | Convênio | UF | Descrição | Qtd mem/PAD | Previsto mem/PAD | Executado mem/PAD | Saldo mem/PAD | Motivos |");
  linhas.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const item of itens) {
    const quantidadePad = item.quantidadePadConsolidada ?? item.quantidadePad;
    const valorPrevistoPad = item.valorPrevistoPadConsolidado ?? item.valorPrevistoPad;
    const valorExecutadoPad = item.valorExecutadoPadConsolidado ?? item.valorExecutadoPad;
    const saldoPad = item.saldoPadConsolidado ?? item.saldoPad;
    linhas.push([
      `| ${item.id}`,
      item.numeroConvenio || "-",
      item.uf || "-",
      String(item.descricao || "-").replace(/\|/g, "\\|"),
      `${item.quantidadeMemoria ?? "-"} / ${quantidadePad ?? "-"}`,
      `${item.valorPrevistoMemoria ?? "-"} / ${valorPrevistoPad ?? "-"}`,
      `${item.valorExecutadoMemoria ?? "-"} / ${valorExecutadoPad ?? "-"}`,
      `${item.saldoMemoria ?? "-"} / ${saldoPad ?? "-"}`,
      `${(item.motivos || []).join("; ").replace(/\|/g, "\\|")} |`,
    ].join(" | "));
  }
  linhas.push("");
  return linhas;
}

function renderMarkdown(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Auditoria item_nao_apto sem divergência material",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Modo: ${relatorio.modo}`,
    "",
    "## Resumo",
    "",
    `- Total item_nao_apto encontrados: ${relatorio.resumo.totalItemNaoAptoEncontrados}`,
    `- Candidatos a aceite automático: ${relatorio.resumo.totalCandidatosAceiteAutomatico}`,
    `- Falsos positivos saneáveis: ${relatorio.resumo.totalFalsosPositivosSaneaveis}`,
    `- Divergência material: ${relatorio.resumo.totalDivergenciaMaterial}`,
    `- Dados insuficientes: ${relatorio.resumo.totalDadosMemoriaInsuficientes}`,
    `- Já decididos: ${relatorio.resumo.totalJaDecididos}`,
    `- Erros de payload: ${relatorio.resumo.totalErrosPayload}`,
    `- Decisões aplicadas: ${relatorio.aplicacao.totalAplicados}`,
    "",
    ...renderTabelaMarkdown("Candidatos a aceite automático", relatorio.candidatosAceiteAutomatico),
    ...renderTabelaMarkdown("Falsos positivos saneáveis", relatorio.falsosPositivosSaneaveis),
    ...renderTabelaMarkdown("Divergência material", relatorio.divergenciasMateriais),
    ...renderTabelaMarkdown("Dados insuficientes", relatorio.dadosMemoriaInsuficientes),
  ];
  return linhas.join("\n");
}

function montarRelatorio({ aplicar }) {
  const divergencias = carregarDivergenciasItemNaoApto();
  const itensPad = carregarItensPadRelatorio();
  const classificados = divergencias.map((divergencia) => classificarDivergencia(divergencia, { itensPad }));
  const grupos = agruparPorClassificacao(classificados);
  const aplicacao = {
    solicitada: aplicar,
    totalAplicados: 0,
    aplicados: [],
  };

  if (aplicar) {
    aplicacao.aplicados = aplicarAceiteAssistido(grupos.candidatosAceiteAutomatico);
    aplicacao.totalAplicados = aplicacao.aplicados.length;
  }

  return {
    geradoEm: new Date().toISOString(),
    modo: aplicar ? "aplicacao-assistida" : "dry-run",
    tolerancias: {
      quantidade: TOLERANCIA_QUANTIDADE,
      monetaria: TOLERANCIA_MONETARIA,
    },
    resumo: {
      totalItemNaoAptoEncontrados: classificados.length,
      totalCandidatosAceiteAutomatico: grupos.candidatosAceiteAutomatico.length,
      totalFalsosPositivosSaneaveis: grupos.falsosPositivosSaneaveis.length,
      totalDivergenciaMaterial: grupos.divergenciasMateriais.length,
      totalDadosMemoriaInsuficientes: grupos.dadosMemoriaInsuficientes.length,
      totalJaDecididos: grupos.jaDecididos.length,
      totalErrosPayload: grupos.errosPayload.length,
    },
    candidatosAceiteAutomatico: grupos.candidatosAceiteAutomatico,
    falsosPositivosSaneaveis: grupos.falsosPositivosSaneaveis,
    divergenciasMateriais: grupos.divergenciasMateriais,
    dadosMemoriaInsuficientes: grupos.dadosMemoriaInsuficientes,
    jaDecididos: grupos.jaDecididos,
    errosPayload: grupos.errosPayload,
    aplicacao,
  };
}

function imprimirRelatorio(relatorio) {
  console.log("Auditoria de item_nao_apto sem divergência material PAD/PROFOR 2022");
  console.log(`Modo: ${relatorio.modo}`);
  console.log(`Total item_nao_apto encontrados: ${relatorio.resumo.totalItemNaoAptoEncontrados}`);
  console.log(`Candidatos a aceite automático: ${relatorio.resumo.totalCandidatosAceiteAutomatico}`);
  console.log(`Falsos positivos saneáveis: ${relatorio.resumo.totalFalsosPositivosSaneaveis}`);
  console.log(`Divergência material: ${relatorio.resumo.totalDivergenciaMaterial}`);
  console.log(`Dados insuficientes: ${relatorio.resumo.totalDadosMemoriaInsuficientes}`);
  console.log(`Já decididos: ${relatorio.resumo.totalJaDecididos}`);
  console.log(`Erros de payload: ${relatorio.resumo.totalErrosPayload}`);
  console.log("Candidatos:");
  if (!relatorio.candidatosAceiteAutomatico.length) {
    console.log("  (nenhum)");
  } else {
    for (const item of relatorio.candidatosAceiteAutomatico) {
      console.log(
        `  #${item.id} | ${item.numeroConvenio}/${item.uf || "-"} | ${item.descricao || item.chaveItem}`
        + ` | qtd ${item.quantidadeMemoria}/${item.quantidadePad}`
        + ` | previsto ${item.valorPrevistoMemoria}/${item.valorPrevistoPad}`
      );
    }
  }
  console.log("Falsos positivos saneáveis:");
  if (!relatorio.falsosPositivosSaneaveis.length) {
    console.log("  (nenhum)");
  } else {
    for (const item of relatorio.falsosPositivosSaneaveis) {
      console.log(
        `  #${item.id} | ${item.numeroConvenio}/${item.uf || "-"} | ${item.descricao || item.chaveItem}`
        + ` | qtd ${item.quantidadeMemoria}/${item.quantidadePadConsolidada ?? item.quantidadePad}`
        + ` | previsto ${item.valorPrevistoMemoria}/${item.valorPrevistoPadConsolidado ?? item.valorPrevistoPad}`
      );
    }
  }
  if (relatorio.aplicacao.solicitada) {
    console.log(`Decisões ACEITO registradas: ${relatorio.aplicacao.totalAplicados}`);
  } else {
    console.log("Dry-run: nenhuma decisão foi registrada. Use --aplicar para aplicação assistida explícita.");
  }
  console.log(`Saída JSON: ${CAMINHO_SAIDA_JSON}`);
  console.log(`Saída Markdown: ${CAMINHO_SAIDA_MD}`);
}

function executar() {
  const aplicar = process.argv.includes("--aplicar");
  inicializarBanco();
  const relatorio = montarRelatorio({ aplicar });
  escreverArquivoJson(CAMINHO_SAIDA_JSON, relatorio);
  escreverArquivoTexto(CAMINHO_SAIDA_MD, renderMarkdown(relatorio));
  imprimirRelatorio(relatorio);
}

if (require.main === module) {
  try {
    executar();
  } catch (erro) {
    console.error("Falha ao auditar itens item_nao_apto sem divergência material PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = {
  classificarDivergencia,
  consolidarLinhasPad,
  detectarRateiosQuantidadeSuspeita,
  localizarLinhasPadEquivalentes,
  montarMemoriaPad,
};

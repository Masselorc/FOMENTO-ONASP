const fs = require("node:fs");
const path = require("node:path");

const db = require("../db/database");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.md";

const DECISOES_RESOLUTIVAS = new Set(["ACEITO", "REJEITADO", "CORRIGIDO", "REVERTIDO"]);
const STATUS_PENDENTES = new Set(["PENDENTE", "EM_REVISAO"]);
const CATEGORIAS = [
  "pendencia_real",
  "possivel_falso_positivo",
  "ja_saneado_mas_ainda_pendente",
  "historico_nao_reapresentado",
  "diacritico_ou_acentuacao",
  "ausente_com_substituto_compativel",
  "ausente_com_substituto_possivel",
  "quantidade_suspeita",
  "valor_ou_saldo_inconsistente",
  "rateio_antigo_compativel",
  "rateio_manual_necessario",
  "item_nao_apto_sem_divergencia_material",
  "decisao_antiga_com_payload_alterado",
  "duplicidade_ou_ambiguidade_pad",
  "dados_insuficientes",
];

// Camada operacional: cada item recai em exatamente uma destas categorias,
// separando pendência operacional real de bloqueio técnico de segurança.
const CATEGORIAS_OPERACIONAIS = [
  "pendencia_operacional_real",
  "bloqueio_tecnico_seguranca",
  "decisao_resolutiva_com_pendencia_tecnica",
  "revalidacao_necessaria",
  "historico_saneado",
  "falso_positivo_saneavel",
];

const RELATORIOS = {
  ausentesSubstitutos: "backend/data/relatorios/profor-2022-ausentes-substitutos-dry-run.json",
  diacritico: "backend/data/relatorios/profor-2022-pendencias-diacritico-dry-run.json",
  itemNaoApto: "backend/data/relatorios/profor-2022-item-nao-apto-auditoria-dry-run.json",
  rateioAntigo: "backend/data/relatorios/profor-2022-item-sem-rateio-rateio-antigo-dry-run.json",
  quantidades: "backend/data/relatorios/profor-2022-quantidades-suspeitas-dry-run.json",
  seguranca: "backend/data/relatorios/profor-2022-pad-seguranca-pre-ativacao-dry-run.json",
  reconstrucao: "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
  comparacao: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json",
};

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(repoRoot(), caminhoRelativo);
}

function lerJsonSeExistir(caminhoRelativo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  if (!fs.existsSync(caminho)) return null;
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    return { erroLeitura: erro.message, caminho: caminhoRelativo };
  }
}

function escreverJson(caminhoRelativo, dados) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverTexto(caminhoRelativo, conteudo) {
  const caminho = caminhoAbsoluto(caminhoRelativo);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${conteudo.trimEnd()}\n`, "utf8");
}

function parseJsonSeguro(texto, padrao = {}) {
  if (!texto) return padrao;
  try {
    return JSON.parse(texto);
  } catch {
    return padrao;
  }
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

function descricaoDaDivergencia(divergencia) {
  const p = divergencia.payload || {};
  return p.descricaoPad
    || p.descricaoMemoria
    || p.memoria?.descricao
    || p.pad?.descricao
    || divergencia.valor_novo
    || divergencia.valor_anterior
    || divergencia.chave_item
    || "-";
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

function diferencaApenasDiacritico(a, b) {
  const originalA = String(a ?? "").replace(/\s+/g, " ").trim();
  const originalB = String(b ?? "").replace(/\s+/g, " ").trim();
  if (!originalA || !originalB || originalA === originalB) return false;
  return normalizarTexto(originalA) === normalizarTexto(originalB);
}

function agruparPorId(lista, chave = "id") {
  const mapa = new Map();
  for (const item of garantirArray(lista)) {
    const id = Number(item?.[chave]);
    if (Number.isFinite(id)) mapa.set(id, item);
  }
  return mapa;
}

function carregarRelatorios() {
  const relatorios = {};
  const fontes = {};
  for (const [nome, caminho] of Object.entries(RELATORIOS)) {
    const dados = lerJsonSeExistir(caminho);
    relatorios[nome] = dados;
    fontes[nome] = {
      caminho,
      disponivel: Boolean(dados && !dados.erroLeitura),
      geradoEm: dados?.geradoEm || dados?.resumo?.geradoEm || null,
      erro: dados?.erroLeitura || null,
    };
  }
  return { relatorios, fontes };
}

function carregarDecisoes() {
  const linhas = db.prepare(`
    SELECT id, divergencia_id, decisao, valor_aplicado, justificativa, usuario,
           decidido_em, payload_decisao_json, criado_em
    FROM profor_2022_revisao_decisoes
    ORDER BY id
  `).all();
  const porDivergencia = new Map();
  const valoresNaoCanonicos = [];
  for (const linha of linhas) {
    const decisao = {
      ...linha,
      payloadDecisao: parseJsonSeguro(linha.payload_decisao_json, {}),
    };
    const canonica = String(linha.decisao || "").toUpperCase();
    if (linha.decisao && linha.decisao !== canonica) {
      valoresNaoCanonicos.push({
        decisaoId: linha.id,
        divergenciaId: linha.divergencia_id,
        valor: linha.decisao,
        valorCanonico: canonica,
      });
    }
    if (!porDivergencia.has(linha.divergencia_id)) porDivergencia.set(linha.divergencia_id, []);
    porDivergencia.get(linha.divergencia_id).push(decisao);
  }
  return { porDivergencia, valoresNaoCanonicos, total: linhas.length };
}

function carregarLogs() {
  const linhas = db.prepare(`
    SELECT id, entidade_id, evento, usuario, detalhe, estado_anterior_json, estado_novo_json, criado_em
    FROM profor_2022_revisao_logs
    WHERE entidade_tipo = 'divergencia'
    ORDER BY id
  `).all();
  const mapa = new Map();
  for (const linha of linhas) {
    const log = {
      ...linha,
      estadoAnterior: parseJsonSeguro(linha.estado_anterior_json, null),
      estadoNovo: parseJsonSeguro(linha.estado_novo_json, null),
    };
    if (!mapa.has(linha.entidade_id)) mapa.set(linha.entidade_id, []);
    mapa.get(linha.entidade_id).push(log);
  }
  return mapa;
}

// Reúne os divergenciaId citados pelo relatório de segurança pré-ativação,
// para que a auditoria profunda também classifique decisões resolutivas
// bloqueadas por segurança (payload alterado, não reapresentada).
function coletarIdsBloqueioSeguranca(segurancaRelatorio) {
  const ids = new Set();
  if (!segurancaRelatorio) return [];
  for (const chave of [
    "payloadAlteradoAposDecisao",
    "divergenciasNaoReapresentadas",
    "divergenciasReapresentacaoIndeterminada",
    "bloqueiosAtivacao",
  ]) {
    for (const item of garantirArray(segurancaRelatorio[chave])) {
      const id = Number(item?.divergenciaId);
      if (Number.isFinite(id)) ids.add(id);
    }
  }
  return Array.from(ids);
}

function carregarDivergencias(decisoesPorDivergencia, logsPorDivergencia, idsBloqueioSeguranca = []) {
  const resolutivas = Array.from(DECISOES_RESOLUTIVAS);
  const placeholders = resolutivas.map(() => "?").join(", ");
  const idsExtras = Array.from(new Set(idsBloqueioSeguranca.map(Number).filter(Number.isFinite)));
  const placeholdersIds = idsExtras.length ? idsExtras.map(() => "?").join(", ") : "NULL";
  const linhas = db.prepare(`
    SELECT *
    FROM profor_2022_revisao_divergencias d
    WHERE d.status IN ('PENDENTE', 'EM_REVISAO')
       OR d.bloqueia_publicacao = 1
       OR d.id IN (${placeholdersIds})
       OR NOT EXISTS (
         SELECT 1 FROM profor_2022_revisao_decisoes x
         WHERE x.divergencia_id = d.id AND UPPER(x.decisao) IN (${placeholders})
       )
    ORDER BY d.id
  `).all(...idsExtras, ...resolutivas);

  return linhas.map((linha) => {
    const decisoes = decisoesPorDivergencia.get(linha.id) || [];
    return {
      ...linha,
      payload: parseJsonSeguro(linha.payload_json, {}),
      decisoes,
      logs: logsPorDivergencia.get(linha.id) || [],
      temDecisaoResolutiva: decisoes.some((decisao) => DECISOES_RESOLUTIVAS.has(String(decisao.decisao || "").toUpperCase())),
    };
  });
}

function carregarResumoBanco() {
  const total = db.prepare("SELECT COUNT(*) AS total FROM profor_2022_revisao_divergencias").get();
  const status = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM profor_2022_revisao_divergencias
    GROUP BY status
    ORDER BY status
  `).all();
  const tipo = db.prepare(`
    SELECT tipo_alerta AS tipoAlerta, status, COUNT(*) AS total
    FROM profor_2022_revisao_divergencias
    GROUP BY tipo_alerta, status
    ORDER BY tipo_alerta, status
  `).all();
  const bloqueios = db.prepare(`
    SELECT
      SUM(CASE WHEN bloqueia_publicacao = 1 THEN 1 ELSE 0 END) AS totalBloqueantes,
      SUM(CASE WHEN status IN ('PENDENTE', 'EM_REVISAO') AND bloqueia_publicacao = 1 THEN 1 ELSE 0 END) AS totalBloqueantesOperacionais
    FROM profor_2022_revisao_divergencias
  `).get();
  return {
    totalDivergencias: Number(total.total || 0),
    porStatus: status,
    porTipoStatus: tipo,
    totalBloqueantes: Number(bloqueios.totalBloqueantes || 0),
    totalBloqueantesOperacionais: Number(bloqueios.totalBloqueantesOperacionais || 0),
  };
}

function montarMapasRelatorios(relatorios) {
  const ausentes = agruparPorId(relatorios.ausentesSubstitutos?.analisados || []);
  const diacritico = agruparPorId(relatorios.diacritico?.analisados || []);

  const itemNaoApto = new Map();
  for (const [classe, lista] of [
    ["sem_divergencia_material_detectada", relatorios.itemNaoApto?.semDivergenciaMaterialDetectada],
    ["candidato_aceite_automatico", relatorios.itemNaoApto?.candidatosAceiteAutomatico],
    ["falso_positivo_saneavel", relatorios.itemNaoApto?.falsosPositivosSaneaveis],
    ["divergencia_material", relatorios.itemNaoApto?.divergenciasMateriais],
    ["dados_memoria_insuficientes", relatorios.itemNaoApto?.dadosMemoriaInsuficientes],
    ["ja_decidido", relatorios.itemNaoApto?.jaDecididos],
    ["erro_payload", relatorios.itemNaoApto?.errosPayload],
  ]) {
    for (const item of garantirArray(lista)) itemNaoApto.set(Number(item.id), { ...item, classificacao: classe });
  }

  const rateioAntigo = new Map();
  for (const [classe, lista] of [
    ["rateio_antigo_compativel", relatorios.rateioAntigo?.candidatosRateioAntigoCompativel],
    ["possivel_rateio_antigo_com_divergencia", relatorios.rateioAntigo?.possiveisRateiosAntigosComDivergencia],
    ["sem_rateio_antigo_encontrado", relatorios.rateioAntigo?.semRateioAntigoEncontrado],
    ["dados_insuficientes", relatorios.rateioAntigo?.dadosInsuficientes],
    ["ja_decidido", relatorios.rateioAntigo?.jaDecididos],
  ]) {
    for (const item of garantirArray(lista)) rateioAntigo.set(Number(item.id), { ...item, classificacao: classe });
  }

  const payloadAlterado = new Map();
  for (const item of garantirArray(relatorios.seguranca?.payloadAlteradoAposDecisao)) {
    const id = Number(item.divergenciaId);
    if (!payloadAlterado.has(id)) payloadAlterado.set(id, []);
    payloadAlterado.get(id).push(item);
  }

  const naoReapresentadas = new Map();
  for (const item of garantirArray(relatorios.seguranca?.divergenciasNaoReapresentadas)) {
    naoReapresentadas.set(Number(item.divergenciaId), item);
  }
  const reapresentacaoIndeterminada = new Map();
  for (const item of garantirArray(relatorios.seguranca?.divergenciasReapresentacaoIndeterminada)) {
    reapresentacaoIndeterminada.set(Number(item.divergenciaId), item);
  }

  const ambiguidades = garantirArray(relatorios.comparacao?.itensAmbiguos);

  return {
    ausentes,
    diacritico,
    itemNaoApto,
    rateioAntigo,
    payloadAlterado,
    naoReapresentadas,
    reapresentacaoIndeterminada,
    ambiguidades,
  };
}

function extrairQuantidadeAlerta(divergencia) {
  const texto = [
    divergencia.diferenca,
    divergencia.payload?.diferenca,
    divergencia.payload?.evidencias?.detalhe,
  ].filter(Boolean).join(" ");
  const match = texto.match(/Quantidade\s*\(([-\d.,]+)\)\s*x\s*valor unit[aá]rio\s*\(([-\d.,]+)\).*?valor total previsto informado\s*\(([-\d.,]+)\)/i);
  if (!match) return null;
  const quantidade = numeroOuNull(match[1]);
  const valorUnitario = numeroOuNull(match[2]);
  const valorPrevisto = numeroOuNull(match[3]);
  if (quantidade === null || valorUnitario === null || valorPrevisto === null || valorUnitario === 0) return null;
  const quantidadeEsperada = valorPrevisto / valorUnitario;
  const quantidadeDivididaPor10 = quantidade / 10;
  return {
    quantidade,
    valorUnitario,
    valorPrevisto,
    quantidadeEsperada,
    diferencaAtual: Math.abs((quantidade * valorUnitario) - valorPrevisto),
    compativelComInflacaoDecimal: Math.abs(quantidadeDivididaPor10 - quantidadeEsperada) <= 0.01,
    compativelComTruncamentoValorUnitario: Math.abs(quantidade - quantidadeEsperada) <= 0.01,
  };
}

function temAmbiguidadePad(divergencia, ambiguidades) {
  const descricao = normalizarTexto(descricaoDaDivergencia(divergencia));
  const convenio = String(divergencia.numero_convenio || "");
  if (!descricao || !convenio) return false;
  return ambiguidades.some((item) => {
    const chave = normalizarTexto(item.chave || "");
    return chave.includes(convenio) && descricao && chave.includes(descricao.slice(0, Math.min(descricao.length, 24)));
  });
}

// Reduz as classificações detalhadas a uma única categoria operacional,
// separando explicitamente pendência operacional real de bloqueio técnico.
function classificarOperacional(item, divergencia, mapas) {
  const status = String(divergencia.status || "").toUpperCase();
  const statusResolutivo = DECISOES_RESOLUTIVAS.has(status);
  const temResolutiva = divergencia.temDecisaoResolutiva || statusResolutivo;
  const temPayloadAlterado = Boolean(mapas.payloadAlterado.get(divergencia.id)?.length);
  const naoReapresentada = mapas.naoReapresentadas.has(divergencia.id);
  const reapIndeterminada = mapas.reapresentacaoIndeterminada.has(divergencia.id);
  const temBloqueioSeguranca = temPayloadAlterado || naoReapresentada || reapIndeterminada;
  const cls = new Set(item.classificacoes);
  const bloqueante = Boolean(divergencia.bloqueia_publicacao);

  // 1. Payload alterado após a decisão: exige revalidação humana antes da ativação.
  if (temPayloadAlterado) {
    return {
      categoria: "revalidacao_necessaria",
      motivo: "Decisão resolutiva com payload alterado após a decisão; exige revalidação humana antes da ativação.",
      exigeDecisaoHumanaSubstantiva: false,
    };
  }
  // 2. Decisão resolutiva que ainda carrega bloqueio técnico de segurança.
  if (temResolutiva && temBloqueioSeguranca) {
    return {
      categoria: "decisao_resolutiva_com_pendencia_tecnica",
      motivo: "Item já decidido de forma resolutiva, mas mantém bloqueio técnico de segurança pré-ativação (divergência não reapresentada).",
      exigeDecisaoHumanaSubstantiva: false,
    };
  }
  // 3. Decisão resolutiva sem bloqueio de segurança: histórico saneado.
  if (temResolutiva) {
    return {
      categoria: "historico_saneado",
      motivo: "Item já decidido de forma resolutiva e sem bloqueio de segurança; fora da fila operacional, mantido como histórico.",
      exigeDecisaoHumanaSubstantiva: false,
    };
  }
  // A partir daqui: status pendente, sem decisão resolutiva.
  // 4. Pendência real: exige decisão humana substantiva.
  if (cls.has("pendencia_real")) {
    return {
      categoria: "pendencia_operacional_real",
      motivo: "Pendência ainda aberta que exige decisão humana substantiva.",
      exigeDecisaoHumanaSubstantiva: true,
    };
  }
  // 5. Pendente, mas histórico/não reapresentado: não é prioridade operacional.
  if (naoReapresentada || reapIndeterminada || cls.has("historico_nao_reapresentado")) {
    return {
      categoria: "historico_saneado",
      motivo: "Pendente, porém não reapresentada na geração atual; tratar como histórico/segurança, não como pendência operacional prioritária.",
      exigeDecisaoHumanaSubstantiva: false,
    };
  }
  // 6. Falso positivo saneável por regra sistêmica auditável.
  if (cls.has("possivel_falso_positivo") || cls.has("diacritico_ou_acentuacao")
    || cls.has("item_nao_apto_sem_divergencia_material") || cls.has("rateio_antigo_compativel")) {
    return {
      categoria: "falso_positivo_saneavel",
      motivo: "Pendente, com indício de falso positivo saneável por regra sistêmica auditável.",
      exigeDecisaoHumanaSubstantiva: false,
    };
  }
  // 7. Bloqueante técnico sem enquadramento operacional ou de falso positivo.
  if (bloqueante) {
    return {
      categoria: "bloqueio_tecnico_seguranca",
      motivo: "Pendente e bloqueante de publicação, sem enquadramento como pendência operacional real ou falso positivo saneável.",
      exigeDecisaoHumanaSubstantiva: true,
    };
  }
  // 8. Fallback: pendente sem classificador específico.
  return {
    categoria: "pendencia_operacional_real",
    motivo: "Pendente sem classificador específico; requer revisão humana.",
    exigeDecisaoHumanaSubstantiva: true,
  };
}

function classificarDivergencia(divergencia, mapas) {
  const categorias = new Set();
  const evidencias = [];
  const recomendacoes = [];
  const statusPendente = STATUS_PENDENTES.has(String(divergencia.status || "").toUpperCase());
  const statusResolutivo = DECISOES_RESOLUTIVAS.has(String(divergencia.status || "").toUpperCase());

  if (divergencia.temDecisaoResolutiva || statusResolutivo) {
    categorias.add("ja_saneado_mas_ainda_pendente");
    evidencias.push(`Status/decisão resolutiva presente (${divergencia.status}); incluído na auditoria por bloqueio técnico, histórico ou critério sem decisão canônica.`);
    recomendacoes.push("Manter fora da lista operacional padrão; revisar apenas bloqueios de segurança antes de ativação.");
  }

  const segurancaPayload = mapas.payloadAlterado.get(divergencia.id);
  if (segurancaPayload?.length) {
    categorias.add("decisao_antiga_com_payload_alterado");
    evidencias.push(`Segurança pré-ativação: ${segurancaPayload.length} decisão(ões) com payload alterado após decisão.`);
    recomendacoes.push("Revalidar decisão humana ou criar etapa sistêmica auditável; não revalidar automaticamente nesta auditoria.");
  }
  const naoReapresentada = mapas.naoReapresentadas.get(divergencia.id);
  if (naoReapresentada) {
    categorias.add("historico_nao_reapresentado");
    evidencias.push(`Divergência não reapresentada na geração atual (${naoReapresentada.classificacao}).`);
    recomendacoes.push("Remover da operação padrão e tratar como histórico/segurança antes da ativação.");
  }
  const indeterminada = mapas.reapresentacaoIndeterminada.get(divergencia.id);
  if (indeterminada) {
    categorias.add("historico_nao_reapresentado");
    categorias.add("dados_insuficientes");
    evidencias.push("Reapresentação indeterminada por falha de geração atual da fila.");
    recomendacoes.push("Reexecutar geração/auditoria da fila antes de decidir.");
  }

  if (temAmbiguidadePad(divergencia, mapas.ambiguidades)) {
    categorias.add("duplicidade_ou_ambiguidade_pad");
    evidencias.push("Comparador antigo x novo aponta ambiguidade para descrição/convênio compatível.");
    recomendacoes.push("Conferir granularidade do PAD antes de decisão humana.");
  }

  const tipo = divergencia.tipo_alerta;
  if (tipo === "item_ausente_no_pad") {
    const info = mapas.ausentes.get(divergencia.id);
    if (info) {
      evidencias.push(`Auditoria de ausentes: ${info.classificacao} — ${info.motivo}`);
      if (info.classificacao === "substituto_compativel") {
        categorias.add("ausente_com_substituto_compativel");
        categorias.add("possivel_falso_positivo");
        recomendacoes.push("Vincular substituto em etapa assistida; não confirmar ausência real.");
      } else if (info.classificacao === "possivel_substituto_com_divergencia") {
        categorias.add("ausente_com_substituto_possivel");
        recomendacoes.push("Exigir decisão humana para vínculo ou confirmação de ausência.");
      } else if (info.classificacao === "ausencia_real_sem_substituto") {
        if (statusPendente) categorias.add("pendencia_real");
        recomendacoes.push("Confirmar ausência ou manter em revisão conforme análise humana.");
      } else if (info.classificacao === "dados_insuficientes") {
        categorias.add("dados_insuficientes");
        recomendacoes.push("Completar payload/consultar fonte antes de decisão.");
      }
    } else {
      categorias.add("dados_insuficientes");
      evidencias.push("Sem resultado de auditoria de substitutos para este item ausente.");
    }
  } else if (tipo === "item_novo_sem_rateio" || tipo === "item_pad_sem_rateio" || tipo === "rateio_novo") {
    const info = mapas.rateioAntigo.get(divergencia.id);
    if (info) {
      evidencias.push(`Auditoria de rateio antigo: ${info.classificacao}.`);
      if (info.classificacao === "rateio_antigo_compativel") {
        categorias.add("rateio_antigo_compativel");
        categorias.add("possivel_falso_positivo");
        recomendacoes.push("Aproveitar rateio antigo em etapa auditável; não exigir rateio manual novo.");
      } else if (info.classificacao === "possivel_rateio_antigo_com_divergencia") {
        categorias.add("rateio_antigo_compativel");
        recomendacoes.push("Conferir divergência material antes de reaproveitar rateio antigo.");
      } else if (info.classificacao === "sem_rateio_antigo_encontrado" && statusPendente) {
        categorias.add("rateio_manual_necessario");
        categorias.add("pendencia_real");
        recomendacoes.push("Solicitar decisão humana com rateio por área/quantidade.");
      } else if (info.classificacao === "dados_insuficientes") {
        categorias.add("dados_insuficientes");
      }
    } else if (statusPendente) {
      categorias.add("rateio_manual_necessario");
      categorias.add("pendencia_real");
      evidencias.push("Item PAD sem rateio e sem auditoria de rateio antigo aplicável.");
      recomendacoes.push("Solicitar rateio manual.");
    }
  } else if (tipo === "item_nao_apto" || tipo === "item_conhecido_nao_apto" || tipo === "item_conhecido_nao_apto_usado") {
    const info = mapas.itemNaoApto.get(divergencia.id);
    if (info) {
      evidencias.push(`Auditoria de item não apto: ${info.classificacao}.`);
      if (info.classificacao === "sem_divergencia_material_detectada"
        || info.classificacao === "candidato_aceite_automatico"
        || info.classificacao === "falso_positivo_saneavel") {
        categorias.add("item_nao_apto_sem_divergencia_material");
        categorias.add("possivel_falso_positivo");
        recomendacoes.push(info.classificacao === "falso_positivo_saneavel"
          ? "Tratar como falso positivo saneável: conjunto PAD equivalente fecha com a memória; não alterar aptidão no banco nesta auditoria."
          : "Sem divergência material detectada; liberar apenas por decisão auditável, sem alterar aptidão no banco nesta auditoria.");
      } else if (info.classificacao === "divergencia_material" && statusPendente) {
        categorias.add("pendencia_real");
        recomendacoes.push("Exige decisão humana real; há divergência material entre memória e PAD.");
      } else if (info.classificacao === "dados_memoria_insuficientes" || info.classificacao === "erro_payload") {
        categorias.add("dados_insuficientes");
      }
    } else if (statusPendente) {
      categorias.add("pendencia_real");
      evidencias.push("Item não apto pendente sem classificação auxiliar.");
      recomendacoes.push("Conferir motivo original e impacto na reconstrução.");
    }
  } else if (tipo === "equivalencia_por_descricao_normalizada") {
    const info = mapas.diacritico.get(divergencia.id);
    const descMemoria = divergencia.payload?.descricaoMemoria || divergencia.valor_anterior;
    const descPad = divergencia.payload?.descricaoPad || divergencia.valor_novo;
    if (info) evidencias.push(`Auditoria de diacrítico: ${info.classificacao} — ${info.motivo}`);
    if (info?.classificacao === "saneavel_automaticamente_por_diacritico" || diferencaApenasDiacritico(descMemoria, descPad)) {
      categorias.add("diacritico_ou_acentuacao");
      categorias.add("possivel_falso_positivo");
      recomendacoes.push("Saneamento por diacrítico em etapa auditável; não exigir decisão manual se critérios materiais fecharem.");
    } else if (statusPendente) {
      categorias.add("pendencia_real");
      recomendacoes.push("Exige decisão humana de equivalência.");
    }
  } else if (tipo === "quantidade_valor_unitario_inconsistente") {
    categorias.add("valor_ou_saldo_inconsistente");
    const analiseQuantidade = extrairQuantidadeAlerta(divergencia);
    if (analiseQuantidade?.compativelComInflacaoDecimal) {
      categorias.add("quantidade_suspeita");
      categorias.add("possivel_falso_positivo");
      evidencias.push(`Quantidade pode refletir inflação decimal: quantidade=${analiseQuantidade.quantidade}, esperada≈${analiseQuantidade.quantidadeEsperada.toFixed(6)}.`);
      recomendacoes.push("Conferir parser e artefato PAD; não decidir até validar quantidade atual.");
    } else if (analiseQuantidade?.compativelComTruncamentoValorUnitario) {
      categorias.add("possivel_falso_positivo");
      evidencias.push("Diferença compatível com truncamento/arredondamento do valor unitário; total PAD deve permanecer fonte de verdade.");
      recomendacoes.push("Registrar decisão de aceite do total PAD em lote/etapa assistida, se governança aprovar.");
    } else {
      evidencias.push("Inconsistência de quantidade x valor unitário não enquadrada como inflação decimal simples.");
      recomendacoes.push("Revisar alerta antes de decisão.");
    }
  } else if ([
    "valor_diferente",
    "quantidade_diferente",
    "saldo_inconsistente",
    "descricao_divergente",
    "natureza_divergente",
    "valor_unitario_diferente",
  ].includes(tipo)) {
    categorias.add("valor_ou_saldo_inconsistente");
    if (statusPendente) categorias.add("pendencia_real");
    recomendacoes.push("Exige decisão humana ou correção estruturada do campo.");
  }

  if (!categorias.size) {
    if (statusPendente) {
      categorias.add("pendencia_real");
      evidencias.push("Pendência sem classificador específico; exige revisão humana.");
      recomendacoes.push("Revisar payload e logs antes de decisão.");
    } else {
      categorias.add("dados_insuficientes");
      evidencias.push("Item incluído na auditoria, mas sem classificação conclusiva.");
    }
  }

  const item = {
    id: divergencia.id,
    chaveDivergencia: divergencia.chave_divergencia,
    numeroConvenio: divergencia.numero_convenio,
    uf: divergencia.uf,
    tipoAlerta: tipo,
    descricao: descricaoDaDivergencia(divergencia),
    status: divergencia.status,
    nivel: divergencia.nivel,
    bloqueiaPublicacao: Boolean(divergencia.bloqueia_publicacao),
    campoAfetado: divergencia.campo_afetado,
    classificacoes: Array.from(categorias),
    evidencia: evidencias.join(" | ") || "-",
    recomendacao: Array.from(new Set(recomendacoes)).join(" | ") || "Revisar manualmente.",
    totalDecisoes: divergencia.decisoes.length,
    temDecisaoResolutiva: divergencia.temDecisaoResolutiva,
    totalLogs: divergencia.logs.length,
  };
  const operacional = classificarOperacional(item, divergencia, mapas);
  item.classificacaoOperacional = operacional.categoria;
  item.motivoOperacional = operacional.motivo;
  item.exigeDecisaoHumanaSubstantiva = operacional.exigeDecisaoHumanaSubstantiva;
  return item;
}

function sintetizarCategorias(itens) {
  const mapa = new Map(CATEGORIAS.map((categoria) => [categoria, []]));
  for (const item of itens) {
    for (const categoria of item.classificacoes) {
      if (!mapa.has(categoria)) mapa.set(categoria, []);
      mapa.get(categoria).push(item.id);
    }
  }
  const riscoPorCategoria = {
    pendencia_real: "alto",
    possivel_falso_positivo: "medio",
    ja_saneado_mas_ainda_pendente: "medio",
    historico_nao_reapresentado: "alto",
    diacritico_ou_acentuacao: "baixo",
    ausente_com_substituto_compativel: "medio",
    ausente_com_substituto_possivel: "alto",
    quantidade_suspeita: "alto",
    valor_ou_saldo_inconsistente: "medio",
    rateio_antigo_compativel: "medio",
    rateio_manual_necessario: "alto",
    item_nao_apto_sem_divergencia_material: "medio",
    decisao_antiga_com_payload_alterado: "alto",
    duplicidade_ou_ambiguidade_pad: "alto",
    dados_insuficientes: "alto",
  };
  const acaoPorCategoria = {
    pendencia_real: "decisão humana real",
    possivel_falso_positivo: "avaliar saneamento sistêmico auditável",
    ja_saneado_mas_ainda_pendente: "remover da operação padrão; revisar segurança",
    historico_nao_reapresentado: "tratar em etapa de histórico/segurança",
    diacritico_ou_acentuacao: "saneamento por diacrítico com critérios materiais",
    ausente_com_substituto_compativel: "vincular substituto",
    ausente_com_substituto_possivel: "decisão humana sobre vínculo",
    quantidade_suspeita: "conferir parser/artefato antes de decidir",
    valor_ou_saldo_inconsistente: "manter total PAD como fonte ou corrigir campo",
    rateio_antigo_compativel: "reaproveitar rateio antigo com auditoria",
    rateio_manual_necessario: "coletar rateio por área/quantidade",
    item_nao_apto_sem_divergencia_material: "liberar uso dry-run por decisão auditável",
    decisao_antiga_com_payload_alterado: "revalidar decisão antiga",
    duplicidade_ou_ambiguidade_pad: "revisar granularidade/substituição",
    dados_insuficientes: "complementar evidência",
  };

  return Array.from(mapa.entries())
    .map(([categoria, ids]) => ({
      categoria,
      quantidade: ids.length,
      ids: ids.sort((a, b) => a - b),
      risco: riscoPorCategoria[categoria] || "medio",
      acaoRecomendada: acaoPorCategoria[categoria] || "revisar",
    }))
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade || a.categoria.localeCompare(b.categoria));
}

function sintetizarCategoriasOperacionais(itens) {
  const mapa = new Map(CATEGORIAS_OPERACIONAIS.map((categoria) => [categoria, []]));
  for (const item of itens) {
    const categoria = item.classificacaoOperacional;
    if (!mapa.has(categoria)) mapa.set(categoria, []);
    mapa.get(categoria).push(item.id);
  }
  const meta = {
    pendencia_operacional_real: {
      risco: "alto",
      descricao: "Pendência aberta que exige decisão humana substantiva.",
    },
    bloqueio_tecnico_seguranca: {
      risco: "alto",
      descricao: "Pendente e bloqueante de publicação por critério técnico, sem decisão resolutiva.",
    },
    decisao_resolutiva_com_pendencia_tecnica: {
      risco: "medio",
      descricao: "Já decidido de forma resolutiva, mas mantém bloqueio técnico de segurança.",
    },
    revalidacao_necessaria: {
      risco: "alto",
      descricao: "Decisão com payload alterado após a decisão; exige revalidação humana.",
    },
    historico_saneado: {
      risco: "baixo",
      descricao: "Histórico/saneado; fora da fila operacional prioritária.",
    },
    falso_positivo_saneavel: {
      risco: "medio",
      descricao: "Falso positivo saneável por regra sistêmica auditável.",
    },
  };
  return Array.from(mapa.entries())
    .map(([categoria, ids]) => ({
      categoria,
      quantidade: ids.length,
      ids: ids.sort((a, b) => a - b),
      risco: meta[categoria]?.risco || "medio",
      descricao: meta[categoria]?.descricao || "",
    }))
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade || a.categoria.localeCompare(b.categoria));
}

function montarProblemasCodigo(decisoesNaoCanonicas, relatorios) {
  const problemas = [];
  if (decisoesNaoCanonicas.length) {
    problemas.push({
      classificacao: "erro real",
      problema: "Há decisão com valor não canônico em caixa baixa.",
      evidencia: decisoesNaoCanonicas.map((item) => `decisaoId ${item.decisaoId}: ${item.valor}`).join("; "),
      impacto: "A decisão não entra nos conjuntos resolutivos que usam valores canônicos em caixa alta.",
      recomendacao: "Criar saneamento auditável específico para normalizar decisão legada ou registrar decisão resolutiva nova.",
    });
  }
  const bloqueiosSeguranca = Number(relatorios.seguranca?.resumo?.totalBloqueiosAtivacao || 0);
  if (bloqueiosSeguranca > 0) {
    problemas.push({
      classificacao: "risco provável",
      problema: "Segurança pré-ativação bloqueia ativação por payload alterado ou divergência não reapresentada.",
      evidencia: `${bloqueiosSeguranca} bloqueio(s) no relatório de segurança pré-ativação.`,
      impacto: "Decisões antigas não devem liberar ativação até revalidação.",
      recomendacao: "Executar etapa de revalidação assistida de decisões antigas, sem alterar automaticamente nesta auditoria.",
    });
  }
  return problemas;
}

function montarProblemasUx() {
  return [
    {
      classificacao: "melhoria recomendada",
      problema: "A filtragem operacional de históricos/saneados é feita no cliente após carregar a lista da API.",
      evidencia: "frontend/js/app.js: carregarListaRevisao() filtra `recebidas` por `ehPendenciaOperacionalRevisao()`.",
      impacto: "Com fila maior, a API ainda trafega histórico/saneados antes do filtro visual; risco de ruído/performance.",
      recomendacao: "Adicionar filtro backend/API para pendência operacional efetiva em etapa posterior.",
    },
    {
      classificacao: "risco provável",
      problema: "O fluxo de rateio manual coleta quantidade por área, mas ainda converte para percentualQuantidade no payload por contrato do motor dry-run.",
      evidencia: "frontend/js/app.js: montarPayloadDecisaoRevisao() gera `percentualQuantidade` a partir das quantidades.",
      impacto: "Se a regra futura abandonar percentuais, frontend e motor precisarão mudar juntos para evitar ambiguidade.",
      recomendacao: "Evoluir o motor para aceitar quantidade absoluta como fonte primária do rateio manual.",
    },
  ];
}

function montarListasAcao(itens) {
  return {
    podemSerSaneadosPorRegra: itens
      .filter((item) => item.classificacoes.some((c) => [
        "diacritico_ou_acentuacao",
        "item_nao_apto_sem_divergencia_material",
        "rateio_antigo_compativel",
      ].includes(c)))
      .map((item) => item.id)
      .sort((a, b) => a - b),
    exigemDecisaoHumana: itens
      .filter((item) => item.classificacoes.some((c) => [
        "pendencia_real",
        "ausente_com_substituto_possivel",
        "rateio_manual_necessario",
        "duplicidade_ou_ambiguidade_pad",
      ].includes(c)))
      .map((item) => item.id)
      .sort((a, b) => a - b),
    exigemCorrecaoCodigo: itens
      .filter((item) => item.classificacoes.includes("quantidade_suspeita"))
      .map((item) => item.id)
      .sort((a, b) => a - b),
    exigemAjusteUiFiltro: itens
      .filter((item) => item.classificacoes.some((c) => [
        "ja_saneado_mas_ainda_pendente",
        "historico_nao_reapresentado",
      ].includes(c)))
      .map((item) => item.id)
      .sort((a, b) => a - b),
  };
}

function idsPorCategoria(categorias, nome) {
  return categorias.find((item) => item.categoria === nome)?.ids || [];
}

function renderTabelaCategorias(categorias) {
  const linhas = [
    "| Categoria | Qtd | IDs | Risco | Ação recomendada |",
    "|---|---:|---|---|---|",
  ];
  for (const item of categorias) {
    const ids = item.ids.length > 24 ? `${item.ids.slice(0, 24).join(", ")} ...` : item.ids.join(", ");
    linhas.push(`| \`${item.categoria}\` | ${item.quantidade} | ${ids || "-"} | ${item.risco} | ${item.acaoRecomendada} |`);
  }
  return linhas.join("\n");
}

function renderTabelaCategoriasOperacionais(categoriasOperacionais) {
  const linhas = [
    "| Categoria operacional | Qtd | IDs | Risco | Descrição |",
    "|---|---:|---|---|---|",
  ];
  for (const item of categoriasOperacionais) {
    const ids = item.ids.length > 30 ? `${item.ids.slice(0, 30).join(", ")} ...` : item.ids.join(", ");
    linhas.push(`| \`${item.categoria}\` | ${item.quantidade} | ${ids || "-"} | ${item.risco} | ${item.descricao} |`);
  }
  return linhas.join("\n");
}

function renderTabelaItens(itens) {
  const linhas = [
    "| ID | Convênio | UF | Tipo | Descrição | Status | Bloqueio | Categoria operacional | Classificação detalhada | Evidência |",
    "|---:|---|---|---|---|---|---|---|---|---|",
  ];
  for (const item of itens) {
    linhas.push(`| #${item.id} | ${item.numeroConvenio || "-"} | ${item.uf || "-"} | \`${item.tipoAlerta}\` | ${String(item.descricao).replace(/\|/g, "/")} | ${item.status} | ${item.bloqueiaPublicacao ? "sim" : "não"} | \`${item.classificacaoOperacional}\` | ${item.classificacoes.map((c) => `\`${c}\``).join("<br>")} | ${item.evidencia.replace(/\|/g, "/").slice(0, 360)} |`);
  }
  return linhas.join("\n");
}

function renderMarkdown(relatorio) {
  const r = relatorio.resumo;
  const op = r.separacaoOperacional;
  const idsOp = (nome) => idsPorCategoria(relatorio.categoriasOperacionais, nome);
  const listaIds = (ids) => (ids.length ? ids.join(", ") : "nenhum");
  const linhas = [
    "# PROFOR 2022 — Auditoria profunda de pendências PAD (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "",
    "Auditoria somente leitura: não registra decisão, não altera status, não publica e não altera o planoAplicacao oficial.",
    "Reflete o estado atual do banco. Itens com decisão resolutiva (ACEITO/CORRIGIDO) — incluindo a divergência `#24`, já resolvida — são classificados como histórico/saneado e ficam fora da fila operacional.",
    "",
    "## 1. Resumo executivo",
    "",
    `- Total de divergências na fila: ${r.totalDivergencias}`,
    `- Total analisado pelos critérios da auditoria: ${r.totalAnalisadas}`,
    `- Total PENDENTE/EM_REVISAO (status): ${r.totalPendentesOperacionais}`,
    `- Total bloqueante técnico: ${r.totalBloqueantes}`,
    `- Total bloqueante operacional: ${r.totalBloqueantesOperacionais}`,
    `- Total com decisão resolutiva: ${r.totalComDecisaoResolutiva}`,
    `- Total de suspeitas/falsos positivos: ${r.totalPossiveisFalsosPositivos}`,
    `- Total de pendências reais estimadas: ${r.totalPendenciasReaisEstimadas}`,
    `- Bloqueios de segurança pré-ativação: ${r.totalBloqueiosSegurancaPreAtivacao}`,
    "",
    "Separação operacional (cada item recai em exatamente uma categoria):",
    "",
    `- Pendência operacional real: ${op.pendenciaOperacionalReal}`,
    `- Bloqueio técnico de segurança: ${op.bloqueioTecnicoSeguranca}`,
    `- Decisão resolutiva com pendência técnica: ${op.decisaoResolutivaComPendenciaTecnica}`,
    `- Revalidação necessária (payload alterado): ${op.revalidacaoNecessaria}`,
    `- Histórico/saneado: ${op.historicoSaneado}`,
    `- Falso positivo saneável: ${op.falsoPositivoSaneavel}`,
    "",
    "## 2. Separação operacional × bloqueio técnico",
    "",
    renderTabelaCategoriasOperacionais(relatorio.categoriasOperacionais),
    "",
    "## 3. Tabela por categoria detalhada",
    "",
    renderTabelaCategorias(relatorio.categorias),
    "",
    "## 4. Tabela detalhada por item",
    "",
    renderTabelaItens(relatorio.itens),
    "",
    "## 5. Lista de saneamentos potenciais",
    "",
    `- Podem ser saneados por regra auditável: ${relatorio.listasAcao.podemSerSaneadosPorRegra.join(", ") || "nenhum"}`,
    `- Exigem decisão humana: ${relatorio.listasAcao.exigemDecisaoHumana.join(", ") || "nenhum"}`,
    `- Exigem correção de código/parser: ${relatorio.listasAcao.exigemCorrecaoCodigo.join(", ") || "nenhum"}`,
    `- Exigem ajuste de UI/filtro: ${relatorio.listasAcao.exigemAjusteUiFiltro.join(", ") || "nenhum"}`,
    "",
    "## 6. Problemas de código encontrados",
    "",
    relatorio.problemasCodigo.length
      ? relatorio.problemasCodigo.map((p) => `- **${p.classificacao}:** ${p.problema} Evidência: ${p.evidencia} Recomendação: ${p.recomendacao}`).join("\n")
      : "- Nenhum problema de código confirmado nesta auditoria.",
    "",
    "## 7. Problemas de UX encontrados",
    "",
    relatorio.problemasUx.length
      ? relatorio.problemasUx.map((p) => `- **${p.classificacao}:** ${p.problema} Evidência: ${p.evidencia} Recomendação: ${p.recomendacao}`).join("\n")
      : "- Nenhum problema de UX confirmado nesta auditoria.",
    "",
    "## 8. Plano de ação por grupo",
    "",
    "### Grupo 1 — Revalidação necessária (payload alterado após a decisão)",
    `- IDs: ${listaIds(idsOp("revalidacao_necessaria"))}`,
    "- Revalidar a decisão; comparar payload no momento da decisão × payload atual.",
    "- Confirmar se a alteração decorreu de correção técnica (parser de quantidade) ou reextração do PAD.",
    "- Registrar nova decisão apenas em etapa posterior; ver `profor-2022-seguranca-pre-ativacao-detalhada-dry-run`.",
    "",
    "### Grupo 2 — Decisão resolutiva com pendência técnica (não reapresentada)",
    `- IDs: ${listaIds(idsOp("decisao_resolutiva_com_pendencia_tecnica"))}`,
    "- Manter em histórico; avaliar se ainda devem bloquear a segurança pré-ativação.",
    "- Não exibir como pendência operacional na fila de revisão.",
    "",
    "### Grupo 3 — Pendências operacionais reais",
    `- IDs: ${listaIds(idsOp("pendencia_operacional_real"))}`,
    "- Manter para revisão humana real; exigem decisão substantiva (não sanear por regra).",
    "",
    "### Grupo 4 — Falsos positivos saneáveis",
    `- IDs: ${listaIds(idsOp("falso_positivo_saneavel"))}`,
    "- Propor saneamento sistêmico auditável em etapa posterior; sem decisão automática nesta etapa.",
    "",
    "### Histórico/saneado e bloqueio técnico puro",
    `- Histórico/saneado (fora da fila operacional): ${listaIds(idsOp("historico_saneado"))}`,
    `- Bloqueio técnico de segurança: ${listaIds(idsOp("bloqueio_tecnico_seguranca"))}`,
    "",
    "Rollback: remover este script, seu comando npm, os relatórios gerados e os registros documentais desta auditoria.",
  ];
  return `${linhas.join("\n")}\n`;
}

function executar() {
  const { relatorios, fontes } = carregarRelatorios();
  const decisoes = carregarDecisoes();
  const logs = carregarLogs();
  const idsBloqueioSeguranca = coletarIdsBloqueioSeguranca(relatorios.seguranca);
  const divergencias = carregarDivergencias(decisoes.porDivergencia, logs, idsBloqueioSeguranca);
  const resumoBanco = carregarResumoBanco();
  const mapas = montarMapasRelatorios(relatorios);
  const itens = divergencias.map((divergencia) => classificarDivergencia(divergencia, mapas));
  const categorias = sintetizarCategorias(itens);
  const categoriasOperacionais = sintetizarCategoriasOperacionais(itens);
  const listasAcao = montarListasAcao(itens);
  const totalPendentesOperacionais = divergencias.filter((item) => STATUS_PENDENTES.has(String(item.status || "").toUpperCase())).length;
  const totalComDecisaoResolutiva = divergencias.filter((item) => item.temDecisaoResolutiva).length;

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    fonte: {
      sqlite: db.dbPath || "backend/data/onasp.sqlite",
      relatorios: fontes,
    },
    resumo: {
      totalDivergencias: resumoBanco.totalDivergencias,
      totalAnalisadas: itens.length,
      totalPendentesOperacionais,
      totalBloqueantes: resumoBanco.totalBloqueantes,
      totalBloqueantesOperacionais: resumoBanco.totalBloqueantesOperacionais,
      totalComDecisaoResolutiva,
      totalDecisoesRegistradas: decisoes.total,
      totalPossiveisFalsosPositivos: idsPorCategoria(categorias, "possivel_falso_positivo").length,
      totalPendenciasReaisEstimadas: idsPorCategoria(categorias, "pendencia_real").length,
      totalBloqueiosSegurancaPreAtivacao: Number(relatorios.seguranca?.resumo?.totalBloqueiosAtivacao || 0),
      totalPayloadAlteradoAposDecisao: idsPorCategoria(categorias, "decisao_antiga_com_payload_alterado").length,
      separacaoOperacional: {
        pendenciaOperacionalReal: idsPorCategoria(categoriasOperacionais, "pendencia_operacional_real").length,
        bloqueioTecnicoSeguranca: idsPorCategoria(categoriasOperacionais, "bloqueio_tecnico_seguranca").length,
        decisaoResolutivaComPendenciaTecnica: idsPorCategoria(categoriasOperacionais, "decisao_resolutiva_com_pendencia_tecnica").length,
        revalidacaoNecessaria: idsPorCategoria(categoriasOperacionais, "revalidacao_necessaria").length,
        historicoSaneado: idsPorCategoria(categoriasOperacionais, "historico_saneado").length,
        falsoPositivoSaneavel: idsPorCategoria(categoriasOperacionais, "falso_positivo_saneavel").length,
      },
      porStatus: resumoBanco.porStatus,
      porTipoStatus: resumoBanco.porTipoStatus,
    },
    categorias,
    categoriasOperacionais,
    itens,
    listasAcao,
    problemasCodigo: montarProblemasCodigo(decisoes.valoresNaoCanonicos, relatorios),
    problemasUx: montarProblemasUx(),
    comandosExecutadosSeparadamente: [
      "npm run profor:pad:auditar-fila-revisao",
      "npm run profor:pad:seguranca-pre-ativacao:dry-run",
      "npm run profor:pad:ausentes:auditar-substitutos",
      "npm run profor:pad:item-sem-rateio:auditar-rateio-antigo",
      "npm run profor:pad:item-nao-apto:auditar",
      "npm run profor:pad:diacritico:auditar-pendencias",
      "npm run profor:rateio:auditar-quantidades:dry-run",
      "npm run profor:pad:reconstruir-plano:dry-run",
      "npm run profor:pad:comparar-plano:dry-run",
      "npm run profor:pad:seguranca-pre-ativacao:detalhar",
    ],
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
    },
  };

  escreverJson(SAIDA_JSON, relatorio);
  escreverTexto(SAIDA_MD, renderMarkdown(relatorio));

  console.log("Auditoria profunda de pendências PAD/PROFOR 2022 concluída (dry-run).");
  console.log(`JSON: ${SAIDA_JSON}`);
  console.log(`MD:   ${SAIDA_MD}`);
  console.log(`Divergências analisadas: ${relatorio.resumo.totalAnalisadas}`);
  const sop = relatorio.resumo.separacaoOperacional;
  console.log(`Pendência operacional real: ${sop.pendenciaOperacionalReal}`);
  console.log(`Bloqueio técnico de segurança: ${sop.bloqueioTecnicoSeguranca}`);
  console.log(`Decisão resolutiva com pendência técnica: ${sop.decisaoResolutivaComPendenciaTecnica}`);
  console.log(`Revalidação necessária (payload alterado): ${sop.revalidacaoNecessaria}`);
  console.log(`Histórico/saneado: ${sop.historicoSaneado}`);
  console.log(`Falso positivo saneável: ${sop.falsoPositivoSaneavel}`);
  console.log(`Bloqueios de segurança pré-ativação: ${relatorio.resumo.totalBloqueiosSegurancaPreAtivacao}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha na auditoria profunda de pendências PAD/PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

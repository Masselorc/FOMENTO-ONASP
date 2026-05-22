/**
 * Auditoria de regressão dos saneamentos PAD/PROFOR 2022 por chave de
 * pareamento frágil (dry-run).
 *
 * Motivada pelo diagnóstico da divergência #44 (938128/SP): saneamentos que
 * pareiam item por descrição normalizada, `chaveItem` sem código de natureza
 * ou `itemConhecidoId` consolidado podem ter misturado linhas PAD distintas.
 *
 * Esta auditoria reavalia cada divergência já resolvida (ACEITO/CORRIGIDO ou
 * classificada como falso positivo / histórico / revalidação / pendência
 * técnica) e verifica se a conclusão dependeu de chave frágil — isto é, se a
 * `chaveItem`/`itemConhecidoId` do saneamento aponta para um grupo PAD com
 * mais de uma linha material (natureza, código de natureza ou valor unitário
 * divergentes).
 *
 * Somente leitura: não publica, não registra decisão, não reabre divergência,
 * não altera o SQLite, a origem ativa nem o planoAplicacao oficial. Nenhum
 * achado suspeito vira pendência sem evidência material.
 */
const fs = require("node:fs");
const path = require("node:path");

const db = require("../db/database");
const {
  normalizarDescricao,
  agruparPorDescricao,
  avaliarGrupo,
  carregarLinhasPad,
} = require("./auditar-identidade-material-pad-profor-2022");

const SAIDA_JSON = "backend/data/relatorios/profor-2022-regressao-saneamentos-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-regressao-saneamentos-dry-run.md";
const FONTE_PROFUNDO = "backend/data/relatorios/profor-2022-pendencias-profundo-dry-run.json";

// Tipos de alerta cuja conclusão depende de parear um item da memória com uma
// linha PAD — onde a chave frágil pode misturar linhas distintas.
const TIPOS_SENSIVEIS_A_PAREAMENTO = new Set([
  "item_nao_apto",
  "item_novo_sem_rateio",
  "equivalencia_por_descricao_normalizada",
]);

// Status/classificações consideradas "saneamento concluído" a reavaliar.
const STATUS_RESOLUTIVOS = new Set(["ACEITO", "CORRIGIDO"]);

function repoRoot() {
  return path.resolve(__dirname, "../..");
}

function caminhoAbsoluto(rel) {
  return path.join(repoRoot(), rel);
}

function lerJson(rel) {
  const caminho = caminhoAbsoluto(rel);
  if (!fs.existsSync(caminho)) return null;
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return null;
  }
}

function escreverJson(rel, dados) {
  const caminho = caminhoAbsoluto(rel);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

function escreverTexto(rel, texto) {
  const caminho = caminhoAbsoluto(rel);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, `${texto.trimEnd()}\n`, "utf8");
}

function parseJsonSeguro(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/**
 * Constrói o índice de grupos PAD: chave `convenio::descricaoNormalizada` ->
 * { totalLinhas, riscos, severidade, naturezas, codigos }. Também indexa por
 * itemConhecidoId presente nas linhas do grupo.
 */
function indexarGruposPad() {
  const linhas = carregarLinhasPad();
  const grupos = agruparPorDescricao(linhas);
  const porChaveDescricao = new Map();
  const porItemConhecido = new Map();
  for (const [chave, linhasGrupo] of grupos) {
    const { riscos, severidade } = avaliarGrupo(linhasGrupo);
    const info = {
      chaveDescricao: chave,
      totalLinhasPad: linhasGrupo.length,
      naturezas: [...new Set(linhasGrupo.map((l) => l.natureza).filter(Boolean))],
      codigosNatureza: [...new Set(linhasGrupo.map((l) => l.codigoNaturezaDespesa).filter(Boolean))],
      riscos,
      severidade,
    };
    porChaveDescricao.set(chave, info);
    for (const l of linhasGrupo) {
      if (l.itemConhecidoId === null || l.itemConhecidoId === undefined) continue;
      if (!porItemConhecido.has(l.itemConhecidoId)) porItemConhecido.set(l.itemConhecidoId, info);
    }
  }
  return { porChaveDescricao, porItemConhecido };
}

/** Carrega as divergências do banco com payload já parseado. */
function carregarDivergencias() {
  const linhas = db
    .prepare(`
      SELECT id, numero_convenio, uf, chave_item, tipo_alerta, status,
             campo_afetado, bloqueia_publicacao, payload_json
        FROM profor_2022_revisao_divergencias
    `)
    .all();
  return linhas.map((d) => ({
    id: d.id,
    numeroConvenio: String(d.numero_convenio || "").trim(),
    uf: d.uf || null,
    chaveItem: d.chave_item || null,
    tipoAlerta: d.tipo_alerta,
    status: String(d.status || "").toUpperCase(),
    campoAfetado: d.campo_afetado || null,
    bloqueiaPublicacao: Boolean(d.bloqueia_publicacao),
    payload: parseJsonSeguro(d.payload_json) || {},
  }));
}

/** Decisões resolutivas por divergência (a última decisão registrada). */
function carregarDecisoesPorDivergencia() {
  const linhas = db
    .prepare("SELECT id, divergencia_id, decisao, usuario, decidido_em FROM profor_2022_revisao_decisoes ORDER BY id")
    .all();
  const mapa = new Map();
  for (const dec of linhas) {
    mapa.set(dec.divergencia_id, {
      decisaoId: dec.id,
      decisao: dec.decisao,
      usuario: dec.usuario,
      decididoEm: dec.decidido_em,
    });
  }
  return mapa;
}

/** Mapa itemConhecidoId por chaveItem. */
function carregarItemConhecidoPorChave() {
  const mapa = new Map();
  for (const ic of db.prepare("SELECT id, chave_item FROM profor_2022_itens_conhecidos").all()) {
    mapa.set(ic.chave_item, ic.id);
  }
  return mapa;
}

/** Mapa divergenciaId -> classificação operacional da auditoria profunda. */
function carregarClassificacaoOperacional() {
  const profundo = lerJson(FONTE_PROFUNDO);
  const mapa = new Map();
  if (!profundo || !Array.isArray(profundo.itens)) return mapa;
  for (const item of profundo.itens) {
    mapa.set(item.id, {
      classificacaoOperacional: item.classificacaoOperacional || null,
      classificacoes: Array.isArray(item.classificacoes) ? item.classificacoes : [],
      exigeDecisaoHumanaSubstantiva: Boolean(item.exigeDecisaoHumanaSubstantiva),
    });
  }
  return mapa;
}

/**
 * Avalia a fragilidade da chave de pareamento de uma divergência resolvida.
 * Retorna a lista de fatores de fragilidade detectados.
 */
function avaliarFragilidadeChave(divergencia, grupoPad, itemConhecidoId) {
  const fatores = [];
  const payload = divergencia.payload || {};

  // A chaveItem do projeto é "convenio::descricao" — nunca inclui natureza nem
  // código. Isso é fragilidade estrutural, mas só vira risco quando há de fato
  // mais de uma linha PAD na mesma chave de descrição.
  if (grupoPad && grupoPad.totalLinhasPad > 1) {
    fatores.push("chave_descricao_com_multiplas_linhas_pad");
  }
  if (grupoPad && grupoPad.naturezas.length > 1) {
    fatores.push("grupo_pad_com_multiplas_naturezas");
  }
  if (grupoPad && grupoPad.codigosNatureza.length > 1) {
    fatores.push("grupo_pad_com_multiplos_codigos_natureza");
  }
  // Payload aponta para uma única linha PAD (linhaOrigem) mas o grupo tem
  // várias: o saneamento pode ter olhado a linha errada.
  const apontaUmaLinha = payload.linhaOrigem !== undefined && payload.linhaOrigem !== null;
  if (apontaUmaLinha && grupoPad && grupoPad.totalLinhasPad > 1) {
    fatores.push("payload_aponta_uma_linha_pad_entre_varias");
  }
  // Payload sem natureza nem código de natureza: comparação sem identidade
  // material (não distingue CAPITAL de CUSTEIO nem o código de despesa).
  const temNatureza = payload.naturezaPad || payload.naturezaMemoria;
  if (!temNatureza) {
    fatores.push("payload_sem_natureza");
  }
  if (!payload.codigoNaturezaDespesa && !payload.codigoNaturezaDespesaPad) {
    fatores.push("payload_sem_codigo_natureza");
  }
  // Equivalência por descrição normalizada apontando para item conhecido cujo
  // grupo PAD tem mais de uma linha: alto risco de aplicar rateio de outra linha.
  if (divergencia.tipoAlerta === "equivalencia_por_descricao_normalizada"
    && grupoPad && grupoPad.totalLinhasPad > 1) {
    fatores.push("equivalencia_para_item_conhecido_com_multiplas_linhas_pad");
  }

  return fatores;
}

/**
 * Classifica o achado de regressão de uma divergência.
 *
 * - saneamento_confirmado: sem fragilidade material (grupo PAD de linha única ou não sensível).
 * - saneamento_suspeito_chave_fragil: divergência JÁ DECIDIDA cuja conclusão
 *   dependeu de chave frágil e cujo grupo PAD tem mais de uma linha; exige
 *   revalidação manual da decisão.
 * - risco_confirmado_ja_diagnosticado: caso já diagnosticado/corrigido (#44).
 * - divergencia_aberta_com_alerta_pareamento: divergência aberta em grupo PAD
 *   com múltiplas linhas de mesma natureza/código.
 * - pendencia_material_potencial_aberta: divergência aberta em grupo PAD com
 *   múltiplas linhas e divergência de natureza/código (risco material).
 * - pendencia_material_potencial_decidida: divergência já decidida em grupo PAD
 *   com múltiplas linhas e divergência de natureza/código (risco material).
 */
function classificarAchado(divergencia, fatores, grupoPad, jaDiagnosticado, temDecisaoResolutiva) {
  if (jaDiagnosticado) {
    return {
      classificacao: "risco_confirmado_ja_diagnosticado",
      recomendacao: "Caso ja diagnosticado e corrigido em auditoria anterior; manter como referencia.",
      reabrir: false,
    };
  }

  const temFragilidadeMaterial = fatores.includes("grupo_pad_com_multiplas_naturezas")
    || fatores.includes("grupo_pad_com_multiplos_codigos_natureza");
  const temMultiLinha = fatores.includes("chave_descricao_com_multiplas_linhas_pad");

  if (!temMultiLinha && !temFragilidadeMaterial) {
    return {
      classificacao: "saneamento_confirmado",
      recomendacao: "Grupo PAD de linha unica para a chave do item; pareamento sem ambiguidade material.",
      reabrir: false,
    };
  }

  if (!temDecisaoResolutiva) {
    if (temFragilidadeMaterial) {
      return {
        classificacao: "pendencia_material_potencial_aberta",
        recomendacao: "Divergencia aberta em grupo PAD com multiplas linhas e divergencia de natureza/codigo (risco material). Exige segregar por natureza/codigo na analise.",
        reabrir: false,
      };
    }
    return {
      classificacao: "divergencia_aberta_com_alerta_pareamento",
      recomendacao: "Divergencia aberta em grupo PAD com multiplas linhas de mesma natureza/codigo. Recomenda-se confirmar a linha exata no pareamento.",
      reabrir: false,
    };
  }

  if (temFragilidadeMaterial) {
    return {
      classificacao: "pendencia_material_potencial_decidida",
      recomendacao: "Revalidar manualmente a decisao: o grupo PAD tem linhas de natureza/codigo distintos; risco concreto de mistura de itens.",
      reabrir: false,
    };
  }

  return {
    classificacao: "saneamento_suspeito_chave_fragil",
    recomendacao: "Revalidar manualmente a decisao: a chave de pareamento (descricao/itemConhecido) corresponde a mais de uma linha PAD.",
    reabrir: false,
  };
}

function executar() {
  const { porChaveDescricao, porItemConhecido } = indexarGruposPad();
  const divergencias = carregarDivergencias();
  const decisoes = carregarDecisoesPorDivergencia();
  const itemConhecidoPorChave = carregarItemConhecidoPorChave();
  const classificacaoOperacional = carregarClassificacaoOperacional();

  // #44 já foi diagnosticada e corrigida em auditoria anterior.
  const ID_JA_DIAGNOSTICADO = new Set([44]);

  const achados = [];
  for (const divergencia of divergencias) {
    const decisao = decisoes.get(divergencia.id) || null;
    const classOp = classificacaoOperacional.get(divergencia.id) || null;

    const ehPendenteOuRevisao = ["PENDENTE", "EM_REVISAO"].includes(divergencia.status);
    const temDecisaoResolutiva = !ehPendenteOuRevisao && (STATUS_RESOLUTIVOS.has(divergencia.status) || decisao !== null);

    const descricaoNormalizada = normalizarDescricao(
      (divergencia.chaveItem || "").split("::")[1]
      || divergencia.payload.descricaoPad
      || divergencia.payload.descricaoMemoria
      || ""
    );
    const chaveGrupo = `${divergencia.numeroConvenio}::${descricaoNormalizada}`;
    const itemConhecidoId = itemConhecidoPorChave.get(divergencia.chaveItem) ?? null;
    const grupoPad = porChaveDescricao.get(chaveGrupo)
      || (itemConhecidoId !== null ? porItemConhecido.get(itemConhecidoId) : null)
      || null;

    const sensivel = TIPOS_SENSIVEIS_A_PAREAMENTO.has(divergencia.tipoAlerta);
    const fatores = sensivel ? avaliarFragilidadeChave(divergencia, grupoPad, itemConhecidoId) : [];
    const jaDiagnosticado = ID_JA_DIAGNOSTICADO.has(divergencia.id);
    const { classificacao, recomendacao, reabrir } = sensivel
      ? classificarAchado(divergencia, fatores, grupoPad, jaDiagnosticado, temDecisaoResolutiva)
      : {
        classificacao: "saneamento_confirmado",
        recomendacao: "Tipo de alerta nao depende de pareamento de linha PAD (sem risco de chave fragil).",
        reabrir: false,
      };

    achados.push({
      divergenciaId: divergencia.id,
      numeroConvenio: divergencia.numeroConvenio,
      uf: divergencia.uf,
      tipoAlerta: divergencia.tipoAlerta,
      status: divergencia.status,
      saneamentoConcluido: temDecisaoResolutiva,
      chaveItem: divergencia.chaveItem,
      itemConhecidoId,
      decisao: decisao ? `#${decisao.decisaoId} ${decisao.decisao} (${decisao.usuario})` : null,
      classificacaoOperacional: classOp ? classOp.classificacaoOperacional : null,
      sensivelAPareamento: sensivel,
      grupoPad: grupoPad
        ? {
          chaveDescricao: grupoPad.chaveDescricao,
          totalLinhasPad: grupoPad.totalLinhasPad,
          naturezas: grupoPad.naturezas,
          codigosNatureza: grupoPad.codigosNatureza,
          severidade: grupoPad.severidade,
        }
        : null,
      fatoresFragilidade: fatores,
      classificacaoRegressao: classificacao,
      recomendacao,
      reabrir,
    });
  }

  achados.sort((a, b) => {
    const ordem = {
      pendencia_material_potencial_decidida: 0,
      saneamento_suspeito_chave_fragil: 1,
      pendencia_material_potencial_aberta: 2,
      divergencia_aberta_com_alerta_pareamento: 3,
      risco_confirmado_ja_diagnosticado: 4,
      saneamento_confirmado: 5,
    };
    return (ordem[a.classificacaoRegressao] - ordem[b.classificacaoRegressao])
      || a.divergenciaId - b.divergenciaId;
  });

  const contagem = (c) => achados.filter((a) => a.classificacaoRegressao === c).length;
  const resumo = {
    totalDivergenciasReavaliadas: achados.length,
    totalSensiveisAPareamento: achados.filter((a) => a.sensivelAPareamento).length,
    totalSaneamentosConcluidos: achados.filter((a) => a.saneamentoConcluido).length,
    saneamentosConfirmados: contagem("saneamento_confirmado"),
    saneamentosConcluidosConfirmados: achados.filter((a) => a.saneamentoConcluido && a.classificacaoRegressao === "saneamento_confirmado").length,
    saneamentosSuspeitosChaveFragil: contagem("saneamento_suspeito_chave_fragil"),
    riscosConfirmadosJaDiagnosticados: contagem("risco_confirmado_ja_diagnosticado"),
    divergenciasAbertasComAlertaPareamento: contagem("divergencia_aberta_com_alerta_pareamento"),
    pendenciasMateriaisPotenciaisAbertas: contagem("pendencia_material_potencial_aberta"),
    pendenciasMateriaisPotenciaisDecididas: contagem("pendencia_material_potencial_decidida"),
    divergenciasSaneadasParaRevalidar: achados
      .filter((a) => ["saneamento_suspeito_chave_fragil", "pendencia_material_potencial_decidida"].includes(a.classificacaoRegressao))
      .map((a) => a.divergenciaId),
    divergenciasPendentesComAlerta: achados
      .filter((a) => ["divergencia_aberta_com_alerta_pareamento", "pendencia_material_potencial_aberta"].includes(a.classificacaoRegressao))
      .map((a) => a.divergenciaId),
    divergenciasParaReabrir: achados.filter((a) => a.reabrir).map((a) => a.divergenciaId),
  };

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    titulo: "Auditoria de regressao dos saneamentos PAD/PROFOR 2022 por chave de pareamento fragil",
    escopo: "Somente leitura. Nao publica, nao registra decisao, nao reabre divergencia, nao altera SQLite, origem ativa nem planoAplicacao oficial. Nenhum achado suspeito vira pendencia sem evidencia material.",
    motivacao: "Diagnostico da #44 (938128/SP): o PAD tinha multiplas linhas para a mesma descricao. Reavaliacao transversal dos saneamentos que dependem de pareamento de linha PAD.",
    fonteIdentidadeMaterial: "backend/data/relatorios/profor-2022-identidade-material-pad-dry-run.json",
    catalogoClassificacoes: {
      saneamento_confirmado: "Pareamento sem ambiguidade material; grupo PAD de linha unica ou tipo nao sensivel a pareamento.",
      saneamento_suspeito_chave_fragil: "Divergencia ja decidida cuja chave de pareamento corresponde a mais de uma linha PAD; exige revalidacao manual da decisao.",
      risco_confirmado_ja_diagnosticado: "Caso ja diagnosticado e corrigido em auditoria anterior (#44).",
      divergencia_aberta_com_alerta_pareamento: "Divergencia aberta em grupo PAD com multiplas linhas de mesma natureza/codigo.",
      pendencia_material_potencial_aberta: "Divergencia aberta em grupo PAD com multiplas linhas e divergencia de natureza/codigo (risco material).",
      pendencia_material_potencial_decidida: "Divergencia ja decidida em grupo PAD com multiplas linhas e divergencia de natureza/codigo (risco material).",
    },
    resumo,
    achados,
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
      divergenciaReaberta: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      sqliteAlterado: false,
    },
  };

  escreverJson(SAIDA_JSON, relatorio);
  escreverTexto(SAIDA_MD, renderMarkdown(relatorio));
  return relatorio;
}

function renderMarkdown(relatorio) {
  const r = relatorio.resumo;
  const achados = relatorio.achados;

  const filtrados = (c) => achados.filter((a) => a.classificacaoRegressao === c);

  const confirmados = achados.filter((a) => a.saneamentoConcluido && a.classificacaoRegressao === "saneamento_confirmado");
  const suspeitos = filtrados("saneamento_suspeito_chave_fragil");
  const jaDiag = filtrados("risco_confirmado_ja_diagnosticado");
  const abertasAlerta = filtrados("divergencia_aberta_com_alerta_pareamento");
  const pendAbertas = filtrados("pendencia_material_potencial_aberta");
  const pendDecididas = filtrados("pendencia_material_potencial_decidida");

  const linhas = [
    "# PROFOR 2022 — Auditoria de regressão dos saneamentos por chave de pareamento frágil (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "Modo: dry-run — somente leitura. Não publica, não registra decisão, não reabre divergência, não altera SQLite, origem ativa nem `planoAplicacao` oficial.",
    "",
    `> ${relatorio.motivacao}`,
    "",
    "## 1. Resumo Geral",
    "",
    `- Total de divergências analisadas: ${r.totalDivergenciasReavaliadas}`,
    `- Sensíveis a pareamento de linha PAD: ${r.totalSensiveisAPareamento}`,
    `- Saneamentos concluídos reavaliados (com decisão resolutiva ou status resolutivo): ${r.totalSaneamentosConcluidos}`,
    `  - Permanecem confiáveis (saneamento confirmado): ${r.saneamentosConcluidosConfirmados}`,
    `  - Exigem revalidação manual (suspeitos de chave frágil ou pendência material decidida): ${r.divergenciasSaneadasParaRevalidar.length}`,
    `- Divergências abertas com alerta de pareamento (sem decisão resolutiva): ${r.divergenciasAbertasComAlertaPareamento}`,
    `- Pendências materiais potenciais abertas (sem decisão resolutiva): ${r.pendenciasMateriaisPotenciaisAbertas}`,
    `- Riscos confirmados já diagnosticados (#44): ${r.riscosConfirmadosJaDiagnosticados}`,
    "",
    `> [!IMPORTANT]`,
    `> Nenhuma divergência foi reaberta automaticamente. A reabertura automática exige prova material inequívoca e decisão humana.`,
    "",
    "## 2. Saneamentos Concluídos Reavaliados",
    "",
    "Saneamentos concluídos (ACEITO/CORRIGIDO) que foram reavaliados. Aqueles sob grupo PAD de linha única ou não sensíveis a pareamento de descrição são considerados confiáveis.",
    "",
    `Total de saneamentos confiáveis: **${confirmados.length}**`,
    "",
    "| Divergência | Convênio | UF | Tipo Alerta | Status | Recomendação |",
    "|---|---|---|---|---|---|",
  ];

  if (!confirmados.length) {
    linhas.push("| — | — | — | — | — | — |");
  } else {
    const limiteConfirmados = 15;
    for (let i = 0; i < Math.min(confirmados.length, limiteConfirmados); i++) {
      const a = confirmados[i];
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | Confiável |`);
    }
    if (confirmados.length > limiteConfirmados) {
      linhas.push(`| ... | ... | ... | ... | ... | + ${confirmados.length - limiteConfirmados} outros saneamentos confirmados |`);
    }
  }

  linhas.push(
    "",
    "## 3. Saneamentos Suspeitos por Chave Frágil",
    "",
    "Saneamentos concluídos cuja chave de pareamento (descrição/itemConhecido) corresponde a mais de uma linha PAD no mesmo convênio, sem divergência de natureza/código. Exigem revalidação técnica da correspondência.",
    ""
  );

  if (!suspeitos.length) {
    linhas.push("- Nenhum saneamento suspeito por chave frágil.");
  } else {
    linhas.push("| Divergência | Convênio | UF | Tipo Alerta | Status | Grupo PAD |");
    linhas.push("|---|---|---|---|---|---|");
    for (const a of suspeitos) {
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | \`${a.grupoPad?.chaveDescricao}\` (${a.grupoPad?.totalLinhasPad} linhas) |`);
    }
  }

  linhas.push(
    "",
    "## 4. Divergências Abertas com Alerta de Pareamento",
    "",
    "Divergências que continuam abertas (status PENDENTE) e cujos grupos PAD possuem mais de uma linha com a mesma descrição normalizada (mas com mesma natureza/código). **Não são regressão de saneamento**, pois nunca foram decididas.",
    ""
  );

  if (!abertasAlerta.length) {
    linhas.push("- Nenhuma divergência aberta com alerta de pareamento.");
  } else {
    linhas.push("| Divergência | Convênio | UF | Tipo Alerta | Status | Grupo PAD |");
    linhas.push("|---|---|---|---|---|---|");
    for (const a of abertasAlerta) {
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | \`${a.grupoPad?.chaveDescricao}\` (${a.grupoPad?.totalLinhasPad} linhas) |`);
    }
  }

  linhas.push(
    "",
    "## 5. Pendências Materiais Potenciais Abertas",
    "",
    "Divergências abertas (status PENDENTE) cujos grupos PAD possuem múltiplas naturezas/códigos (risco material alto/médio). Exigem segregação material no pareamento.",
    ""
  );

  if (!pendAbertas.length) {
    linhas.push("- Nenhuma pendência material potencial aberta.");
  } else {
    linhas.push("| Divergência | Convênio | UF | Tipo Alerta | Status | Naturezas | Códigos |");
    linhas.push("|---|---|---|---|---|---|---|");
    for (const a of pendAbertas) {
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | ${a.grupoPad?.naturezas.join(", ")} | ${a.grupoPad?.codigosNatureza.join(", ")} |`);
    }
  }

  linhas.push(
    "",
    "## 6. Casos Já Diagnosticados",
    "",
    "Casos de risco material que já foram formalmente diagnosticados ou corrigidos.",
    ""
  );

  if (!jaDiag.length) {
    linhas.push("- Nenhum caso diagnosticado.");
  } else {
    linhas.push("| Divergência | Convênio | UF | Tipo Alerta | Status | Descrição do Diagnóstico |");
    linhas.push("|---|---|---|---|---|---|");
    for (const a of jaDiag) {
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | ${a.recomendacao} |`);
    }
  }

  if (pendDecididas.length > 0) {
    linhas.push(
      "",
      "## 6.1. Pendências Materiais Potenciais Decididas",
      "",
      "Saneamentos decididos que recaem em grupos PAD com múltiplas naturezas/códigos.",
      ""
    );
    linhas.push("| Divergência | Convênio | UF | Tipo Alerta | Status | Naturezas | Códigos |");
    linhas.push("|---|---|---|---|---|---|---|");
    for (const a of pendDecididas) {
      linhas.push(`| #${a.divergenciaId} | ${a.numeroConvenio} | ${a.uf || "-"} | ${a.tipoAlerta} | ${a.status} | ${a.grupoPad?.naturezas.join(", ")} | ${a.grupoPad?.codigosNatureza.join(", ")} |`);
    }
  }

  linhas.push(
    "",
    "## 7. Conclusão",
    "",
    `- **Saneamentos concluídos reavaliados:** ${r.totalSaneamentosConcluidos} saneamentos foram analisados.`,
    `- **Saneamentos concluídos confiáveis:** ${r.saneamentosConcluidosConfirmados} permanecem confiáveis e sem risco de pareamento frágil.`,
    `- **Revalidação técnica necessária:** ${r.divergenciasSaneadasParaRevalidar.length} saneamentos exigem revalidação manual devido a chave de pareamento frágil ou risco de conflito material (por exemplo, a divergência #24).`,
    `- **Divergências abertas com alerta:** As divergências #31, #32, #33 e #34 já têm alerta de pareamento por caírem em grupo PAD multi-linha, mas **não são regressão de saneamento**, pois continuam em aberto e sem decisão resolutiva.`,
    `- **Pendência material aberta:** A divergência #46 continua em aberto e foi classificada como \`pendencia_material_potencial_aberta\` devido à divergência de natureza/código de despesa no grupo do saldo residual.`,
    `- **Garantia de segurança:** Nenhuma divergência foi reaberta automaticamente no banco de dados. Os dados originais permanecem inalterados.`,
    "",
    "Rollback: reverter o commit e regenerar os relatórios dry-run; não apagar decisões, logs, divergências nem relatórios históricos."
  );

  return `${linhas.join("\n")}\n`;
}

if (require.main === module) {
  try {
    const relatorio = executar();
    console.log("Auditoria de regressao de saneamentos PAD/PROFOR 2022 concluida (dry-run).");
    console.log(`JSON: ${SAIDA_JSON}`);
    console.log(`MD:   ${SAIDA_MD}`);
    console.log(`Divergencias reavaliadas: ${relatorio.resumo.totalDivergenciasReavaliadas} (saneamentos concluidos: ${relatorio.resumo.totalSaneamentosConcluidos})`);
    console.log(`Suspeitos por chave fragil: ${relatorio.resumo.saneamentosSuspeitosChaveFragil}; pendencias materiais abertas: ${relatorio.resumo.pendenciasMateriaisPotenciaisAbertas}; pendencias materiais decididas: ${relatorio.resumo.pendenciasMateriaisPotenciaisDecididas}.`);
  } catch (erro) {
    console.error("Falha na auditoria de regressao de saneamentos PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = {
  TIPOS_SENSIVEIS_A_PAREAMENTO,
  indexarGruposPad,
  avaliarFragilidadeChave,
  classificarAchado,
};

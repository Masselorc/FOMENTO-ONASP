/**
 * Auditoria de identidade material das linhas PAD/PROFOR 2022 (dry-run).
 *
 * Motivada pelo diagnóstico da divergência #44 (Convênio 938128/SP): o PAD novo
 * tinha duas linhas "Saldo Residual" para a mesma descrição textual, mas com
 * naturezas e códigos de natureza diferentes. Uma chave de pareamento baseada
 * apenas em descrição normalizada (ou em `chaveItem` sem código/natureza) pode
 * confundir linhas materialmente distintas.
 *
 * Esta auditoria agrupa as linhas PAD por convênio + descrição normalizada e
 * sinaliza grupos em que a descrição NÃO é identidade material suficiente:
 * mesma descrição com naturezas, códigos de natureza ou valores divergentes.
 *
 * Somente leitura: não publica, não registra decisão, não altera o SQLite, a
 * origem ativa nem o planoAplicacao oficial.
 */
const fs = require("node:fs");
const path = require("node:path");

const {
  ehSaldoResidualProfor,
  normalizarNaturezaSaldoResidual,
} = require("../services/profor-2022/profor-saldo-residual-service");

const FONTE_PAD_RATEIOS = "backend/data/relatorios/profor-2022-pad-rateios-dry-run.json";
const SAIDA_JSON = "backend/data/relatorios/profor-2022-identidade-material-pad-dry-run.json";
const SAIDA_MD = "backend/data/relatorios/profor-2022-identidade-material-pad-dry-run.md";

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

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Normalização textual estável para comparar descrições (acentos/caixa/espaços). */
function normalizarDescricao(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Carrega todas as linhas PAD reconhecidas e sem rateio do relatório de
 * rateios. Cada linha é uma linha física do relatório PAD (aba + linha).
 */
function carregarLinhasPad() {
  const relatorio = lerJson(FONTE_PAD_RATEIOS);
  if (!relatorio) {
    throw new Error(
      `Fonte ausente: ${FONTE_PAD_RATEIOS}. Rode 'npm run profor:pad:conferir-rateios:dry-run' antes.`
    );
  }
  const brutas = [
    ...(Array.isArray(relatorio.itensPadReconhecidos) ? relatorio.itensPadReconhecidos : []),
    ...(Array.isArray(relatorio.itensPadSemRateio) ? relatorio.itensPadSemRateio : []),
  ];
  return brutas.map((item) => ({
    numeroConvenio: String(item.numeroConvenio || "").trim(),
    uf: item.uf || null,
    descricaoOriginal: item.descricaoOriginal || null,
    descricaoNormalizada: normalizarDescricao(item.descricaoNormalizada || item.descricaoOriginal),
    chaveItem: item.chaveItem || null,
    itemConhecidoId: item.itemConhecidoId ?? null,
    natureza: normalizarNaturezaSaldoResidual(item.natureza) || String(item.natureza || "").trim().toUpperCase(),
    codigoNaturezaDespesa: item.codigoNaturezaDespesa ? String(item.codigoNaturezaDespesa).trim() : null,
    unidade: item.unidade || null,
    aba: item.aba || null,
    linha: item.linha ?? null,
    quantidade: numero(item.quantidade),
    valorUnitario: numero(item.valorUnitario),
    valorPrevisto: numero(item.valorTotalPrevisto ?? item.valorPrevisto),
    valorExecutado: numero(item.valorTotalExecutado ?? item.valorExecutado),
    saldo: numero(item.saldo),
  }));
}

/** Chave de identidade material forte: convênio + descrição + natureza + código. */
function chaveIdentidadeMaterial(linha) {
  return [
    linha.numeroConvenio,
    linha.descricaoNormalizada,
    linha.natureza || "SEM_NATUREZA",
    linha.codigoNaturezaDespesa || "SEM_CODIGO",
  ].join("::");
}

/** Agrupa por convênio + descrição normalizada (a chave frágil que se quer auditar). */
function agruparPorDescricao(linhas) {
  const grupos = new Map();
  for (const linha of linhas) {
    const chave = `${linha.numeroConvenio}::${linha.descricaoNormalizada}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(linha);
  }
  return grupos;
}

function valoresDistintos(linhas, campo) {
  return [...new Set(linhas.map((l) => l[campo]).filter((v) => v !== null && v !== undefined && v !== ""))];
}

/**
 * Avalia um grupo (convênio + descrição) e devolve a lista de riscos de
 * identidade material que ele dispara, mais a severidade resultante.
 */
function avaliarGrupo(linhas) {
  const riscos = [];
  const naturezas = valoresDistintos(linhas, "natureza");
  const codigos = valoresDistintos(linhas, "codigoNaturezaDespesa");
  const valoresUnitarios = valoresDistintos(linhas, "valorUnitario");
  const descricao = linhas[0].descricaoNormalizada;
  const ehSaldoResidual = ehSaldoResidualProfor(linhas[0].descricaoOriginal || descricao);

  if (linhas.length > 1) {
    riscos.push("descricao_repetida_no_convenio");
  }
  if (naturezas.length > 1) {
    riscos.push("descricao_com_multiplas_naturezas");
  }
  if (codigos.length > 1) {
    riscos.push("descricao_com_multiplos_codigos_natureza");
  }
  if (valoresUnitarios.length > 1 && linhas.length > 1) {
    riscos.push("descricao_com_valores_unitarios_distintos");
  }
  if (ehSaldoResidual) {
    riscos.push("saldo_residual_ou_remanescente");
    if (linhas.length > 1) riscos.push("saldo_residual_repetido_no_convenio");
  }
  if (naturezas.includes("CAPITAL") && naturezas.includes("CUSTEIO")) {
    riscos.push("mesma_descricao_capital_e_custeio");
  }

  let severidade = "ok";
  if (riscos.includes("descricao_com_multiplas_naturezas")
    || riscos.includes("mesma_descricao_capital_e_custeio")) {
    severidade = "alto";
  } else if (riscos.includes("descricao_com_multiplos_codigos_natureza")
    || riscos.includes("saldo_residual_repetido_no_convenio")) {
    severidade = "medio";
  } else if (riscos.includes("descricao_repetida_no_convenio")
    || riscos.includes("descricao_com_valores_unitarios_distintos")
    || riscos.includes("saldo_residual_ou_remanescente")) {
    severidade = "baixo";
  }

  return { riscos: [...new Set(riscos)], severidade };
}

function montarItensConhecidosAfetados(grupos) {
  // Item conhecido cujas linhas PAD se espalham por mais de uma natureza/código:
  // pareamento por itemConhecidoId consolidado pode misturar linhas distintas.
  const afetados = [];
  for (const [chave, linhas] of grupos) {
    const ids = valoresDistintos(linhas, "itemConhecidoId");
    const { riscos } = avaliarGrupo(linhas);
    const ehRiscoMaterial = riscos.includes("descricao_com_multiplas_naturezas")
      || riscos.includes("descricao_com_multiplos_codigos_natureza")
      || riscos.includes("mesma_descricao_capital_e_custeio");
    if (ehRiscoMaterial) {
      for (const id of ids) {
        if (id === null || id === undefined) continue;
        afetados.push({
          itemConhecidoId: id,
          chaveDescricao: chave,
          naturezas: valoresDistintos(linhas, "natureza"),
          codigosNatureza: valoresDistintos(linhas, "codigoNaturezaDespesa"),
          totalLinhasPad: linhas.length,
        });
      }
    }
  }
  return afetados;
}

function executar() {
  const linhas = carregarLinhasPad();
  const grupos = agruparPorDescricao(linhas);
  const identidadesMateriais = new Set(linhas.map(chaveIdentidadeMaterial));

  const gruposAvaliados = [];
  for (const [chave, linhasGrupo] of grupos) {
    const { riscos, severidade } = avaliarGrupo(linhasGrupo);
    gruposAvaliados.push({
      chaveDescricao: chave,
      numeroConvenio: linhasGrupo[0].numeroConvenio,
      uf: linhasGrupo[0].uf,
      descricaoNormalizada: linhasGrupo[0].descricaoNormalizada,
      totalLinhasPad: linhasGrupo.length,
      naturezas: valoresDistintos(linhasGrupo, "natureza"),
      codigosNatureza: valoresDistintos(linhasGrupo, "codigoNaturezaDespesa"),
      itemConhecidoIds: valoresDistintos(linhasGrupo, "itemConhecidoId"),
      riscos,
      severidade,
      linhas: linhasGrupo.map((l) => ({
        aba: l.aba,
        linha: l.linha,
        natureza: l.natureza,
        codigoNaturezaDespesa: l.codigoNaturezaDespesa,
        unidade: l.unidade,
        quantidade: l.quantidade,
        valorUnitario: l.valorUnitario,
        valorPrevisto: l.valorPrevisto,
        valorExecutado: l.valorExecutado,
        saldo: l.saldo,
        chaveItem: l.chaveItem,
        chaveIdentidadeMaterial: chaveIdentidadeMaterial(l),
      })),
    });
  }
  gruposAvaliados.sort((a, b) => {
    const ordem = { alto: 0, medio: 1, baixo: 2, ok: 3 };
    return (ordem[a.severidade] - ordem[b.severidade])
      || a.numeroConvenio.localeCompare(b.numeroConvenio, "pt-BR")
      || a.descricaoNormalizada.localeCompare(b.descricaoNormalizada, "pt-BR");
  });

  const gruposComRisco = gruposAvaliados.filter((g) => g.severidade !== "ok");
  const itensConhecidosAfetados = montarItensConhecidosAfetados(grupos);

  const resumo = {
    totalLinhasPadAnalisadas: linhas.length,
    totalDescricoesDistintas: grupos.size,
    totalIdentidadesMateriaisDistintas: identidadesMateriais.size,
    totalDescricoesRepetidas: gruposAvaliados.filter((g) => g.totalLinhasPad > 1).length,
    totalDescricoesComMultiplasNaturezas: gruposAvaliados.filter((g) => g.naturezas.length > 1).length,
    totalDescricoesComMultiplosCodigosNatureza: gruposAvaliados.filter((g) => g.codigosNatureza.length > 1).length,
    totalSaldoResidualOuRemanescente: gruposAvaliados.filter((g) => g.riscos.includes("saldo_residual_ou_remanescente")).length,
    totalSaldoResidualRepetido: gruposAvaliados.filter((g) => g.riscos.includes("saldo_residual_repetido_no_convenio")).length,
    totalGruposComRisco: gruposComRisco.length,
    totalGruposAlto: gruposAvaliados.filter((g) => g.severidade === "alto").length,
    totalGruposMedio: gruposAvaliados.filter((g) => g.severidade === "medio").length,
    totalGruposBaixo: gruposAvaliados.filter((g) => g.severidade === "baixo").length,
    totalItensConhecidosAfetados: new Set(itensConhecidosAfetados.map((x) => x.itemConhecidoId)).size,
  };

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    titulo: "Auditoria de identidade material das linhas PAD/PROFOR 2022",
    escopo: "Somente leitura. Nao publica, nao registra decisao, nao altera origem ativa, planoAplicacao oficial nem SQLite versionado.",
    motivacao: "Diagnostico da divergencia #44 (938128/SP): o PAD tinha duas linhas 'Saldo Residual' com naturezas/codigos diferentes para a mesma descricao. Chave de pareamento por descricao normalizada nao e identidade material suficiente.",
    fonte: FONTE_PAD_RATEIOS,
    chaveIdentidadeMaterialRecomendada: "numeroConvenio + descricaoNormalizada + natureza + codigoNaturezaDespesa",
    catalogoRiscos: {
      descricao_repetida_no_convenio: "Mesma descricao normalizada com mais de uma linha PAD no convenio.",
      descricao_com_multiplas_naturezas: "Mesma descricao com CAPITAL e CUSTEIO (ou outra divergencia de natureza).",
      descricao_com_multiplos_codigos_natureza: "Mesma descricao com mais de um codigo de natureza da despesa.",
      descricao_com_valores_unitarios_distintos: "Mesma descricao com valores unitarios diferentes entre linhas.",
      saldo_residual_ou_remanescente: "Descricao generica de saldo residual/remanescente; alto risco de colisao.",
      saldo_residual_repetido_no_convenio: "Saldo residual/remanescente com mais de uma linha PAD no convenio.",
      mesma_descricao_capital_e_custeio: "Mesma descricao aparece em CAPITAL e em CUSTEIO (padrao da #44).",
    },
    resumo,
    gruposComRisco,
    itensConhecidosAfetados,
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
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
  const linhas = [
    "# PROFOR 2022 — Auditoria de identidade material das linhas PAD (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    "Modo: dry-run — somente leitura. Não publica, não registra decisão, não altera SQLite, origem ativa nem `planoAplicacao` oficial.",
    "",
    `> ${relatorio.motivacao}`,
    "",
    "## 1. Resumo",
    "",
    `- Linhas PAD analisadas: ${r.totalLinhasPadAnalisadas}`,
    `- Descrições distintas (convênio + descrição): ${r.totalDescricoesDistintas}`,
    `- Identidades materiais distintas (convênio + descrição + natureza + código): ${r.totalIdentidadesMateriaisDistintas}`,
    `- Descrições repetidas no convênio: ${r.totalDescricoesRepetidas}`,
    `- Descrições com múltiplas naturezas: **${r.totalDescricoesComMultiplasNaturezas}**`,
    `- Descrições com múltiplos códigos de natureza: **${r.totalDescricoesComMultiplosCodigosNatureza}**`,
    `- Saldos residuais/remanescentes: ${r.totalSaldoResidualOuRemanescente} (repetidos: ${r.totalSaldoResidualRepetido})`,
    `- Grupos com risco: ${r.totalGruposComRisco} (alto ${r.totalGruposAlto}, médio ${r.totalGruposMedio}, baixo ${r.totalGruposBaixo})`,
    `- Itens conhecidos afetados por risco material: ${r.totalItensConhecidosAfetados}`,
    "",
    `Chave de identidade material recomendada: \`${relatorio.chaveIdentidadeMaterialRecomendada}\`.`,
    "",
    "## 2. Grupos com risco de identidade material",
    "",
    "| Severidade | Convênio | UF | Descrição | Linhas PAD | Naturezas | Códigos | Riscos |",
    "|---|---|---|---|---:|---|---|---|",
  ];
  for (const grupo of relatorio.gruposComRisco) {
    linhas.push([
      "",
      grupo.severidade,
      grupo.numeroConvenio,
      grupo.uf || "-",
      String(grupo.descricaoNormalizada).replace(/\|/g, "/").slice(0, 48),
      grupo.totalLinhasPad,
      grupo.naturezas.join(", ") || "-",
      grupo.codigosNatureza.join(", ") || "-",
      grupo.riscos.join("; "),
      "",
    ].join(" | ").trim());
  }
  linhas.push("");
  linhas.push("## 3. Detalhe dos grupos de severidade alta");
  linhas.push("");
  const altos = relatorio.gruposComRisco.filter((g) => g.severidade === "alto");
  if (!altos.length) {
    linhas.push("- Nenhum grupo de severidade alta.");
  } else {
    for (const grupo of altos) {
      linhas.push(`### ${grupo.numeroConvenio} — ${grupo.descricaoNormalizada}`);
      linhas.push("");
      linhas.push("| Aba | Linha | Natureza | Código | Qtd | Valor unit. | Previsto | Saldo |");
      linhas.push("|---|---:|---|---|---:|---:|---:|---:|");
      for (const l of grupo.linhas) {
        linhas.push(`| ${l.aba || "-"} | ${l.linha ?? "-"} | ${l.natureza || "-"} | ${l.codigoNaturezaDespesa || "-"} | ${l.quantidade} | ${l.valorUnitario} | ${l.valorPrevisto} | ${l.saldo} |`);
      }
      linhas.push("");
    }
  }
  linhas.push("## 4. Itens conhecidos afetados");
  linhas.push("");
  if (!relatorio.itensConhecidosAfetados.length) {
    linhas.push("- Nenhum item conhecido cujas linhas PAD divirjam em natureza ou código.");
  } else {
    linhas.push("| Item conhecido | Descrição | Naturezas | Códigos | Linhas PAD |");
    linhas.push("|---:|---|---|---|---:|");
    for (const item of relatorio.itensConhecidosAfetados) {
      linhas.push(`| ${item.itemConhecidoId} | ${String(item.chaveDescricao).replace(/\|/g, "/")} | ${item.naturezas.join(", ")} | ${item.codigosNatureza.join(", ")} | ${item.totalLinhasPad} |`);
    }
  }
  linhas.push("");
  linhas.push("Rollback: reverter o commit e regenerar os relatórios dry-run; não apagar decisões, logs, divergências nem relatórios históricos.");
  return `${linhas.join("\n")}\n`;
}

if (require.main === module) {
  try {
    const relatorio = executar();
    console.log("Auditoria de identidade material PAD/PROFOR 2022 concluida (dry-run).");
    console.log(`JSON: ${SAIDA_JSON}`);
    console.log(`MD:   ${SAIDA_MD}`);
    console.log(`Linhas PAD analisadas: ${relatorio.resumo.totalLinhasPadAnalisadas}`);
    console.log(`Grupos com risco: ${relatorio.resumo.totalGruposComRisco} (alto ${relatorio.resumo.totalGruposAlto}).`);
  } catch (erro) {
    console.error("Falha na auditoria de identidade material PAD/PROFOR 2022.");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = {
  normalizarDescricao,
  chaveIdentidadeMaterial,
  agruparPorDescricao,
  avaliarGrupo,
  carregarLinhasPad,
};

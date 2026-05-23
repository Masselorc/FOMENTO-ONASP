const crypto = require("node:crypto");

const MAPA_DIVERGENCIAS = Object.freeze({
  descricao_apenas_diacritico: {
    categoriaOperacional: "falso_positivo_saneavel",
    severidade: "baixa",
    acaoSugerida: "revisao_tecnica_simples_sem_decisao_automatica",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: false,
  },
  descricao_apenas_textual: {
    categoriaOperacional: "falso_positivo_saneavel",
    severidade: "baixa",
    acaoSugerida: "revalidacao_tecnica_simples_sem_decisao_automatica",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: false,
  },
  descricao_alterada: {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "avaliar_materialidade_da_descricao",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  quantidade_alterada: {
    categoriaOperacional: "pendencia_operacional_real",
    severidade: "alta",
    acaoSugerida: "revisar_quantidade_contra_pad",
    aptaParaDecisaoHumana: true,
    requerRateio: true,
    requerRevisaoTecnica: true,
  },
  valor_unitario_alterado: {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "revisar_valor_unitario",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  valor_previsto_alterado: {
    categoriaOperacional: "pendencia_operacional_real",
    severidade: "alta",
    acaoSugerida: "revisar_valor_previsto",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  valor_executado_alterado: {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "revisar_valor_executado",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  saldo_alterado: {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "revisar_saldo",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  area_alterada: {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "revisar_area",
    aptaParaDecisaoHumana: true,
    requerRateio: true,
    requerRevisaoTecnica: true,
  },
  natureza_alterada: {
    categoriaOperacional: "bloqueio_tecnico_seguranca",
    severidade: "alta",
    acaoSugerida: "bloquear_e_revisar_natureza",
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  item_novo: {
    categoriaOperacional: "pendencia_operacional_real",
    severidade: "alta",
    acaoSugerida: "avaliar_inclusao_do_item",
    aptaParaDecisaoHumana: true,
    requerRateio: true,
    requerRevisaoTecnica: true,
  },
  item_removido: {
    categoriaOperacional: "pendencia_operacional_real",
    severidade: "alta",
    acaoSugerida: "avaliar_remocao_do_item",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  checksum_invalido: {
    categoriaOperacional: "bloqueio_tecnico_seguranca",
    severidade: "alta",
    acaoSugerida: "corrigir_integridade_do_snapshot",
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  colisao_chave: {
    categoriaOperacional: "bloqueio_tecnico_seguranca",
    severidade: "alta",
    acaoSugerida: "resolver_colisao_de_chave",
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  chave_ambigua: {
    categoriaOperacional: "bloqueio_tecnico_seguranca",
    severidade: "alta",
    acaoSugerida: "resolver_chave_ambigua",
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
  dados_insuficientes: {
    categoriaOperacional: "bloqueio_tecnico_seguranca",
    severidade: "alta",
    acaoSugerida: "completar_dados_do_snapshot",
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
  },
});

function criarIdCandidato(prefixo, chave, indice) {
  const hash = crypto.createHash("sha256").update(`${prefixo}|${chave || ""}|${indice}`).digest("hex");
  return `snap-${hash.slice(0, 12)}`;
}

function obterRegra(tipo) {
  return MAPA_DIVERGENCIAS[tipo] || {
    categoriaOperacional: "revalidacao_necessaria",
    severidade: "media",
    acaoSugerida: "revisar_divergencia",
    aptaParaDecisaoHumana: true,
    requerRateio: false,
    requerRevisaoTecnica: true,
  };
}

function converterDivergenciaEmCandidato(divergencia, indice, snapshotReferencia) {
  const tipo = divergencia.tipo || divergencia.tipos?.[0] || "divergencia_indefinida";
  const regra = obterRegra(tipo);
  const item = divergencia.item || {};

  return {
    idCandidato: criarIdCandidato("divergencia", divergencia.chave, indice),
    origem: "comparador_snapshots_pad",
    tipoDivergencia: tipo,
    tiposDivergencia: divergencia.tipos || [tipo],
    categoriaOperacional: regra.categoriaOperacional,
    severidade: regra.severidade,
    uf: divergencia.uf || item.uf || null,
    numero: divergencia.numero || item.numero || null,
    area: divergencia.area || item.area || null,
    natureza: divergencia.natureza || item.natureza || null,
    descricaoAnterior: divergencia.descricaoAnterior || null,
    descricaoNova: divergencia.descricaoNova || null,
    chaveMaterial: divergencia.chave || item.chaveMaterial || null,
    chaveComparacao: item.chaveComparacao || null,
    hashAnterior: divergencia.hashAnterior || null,
    hashNovo: divergencia.hashNovo || item.hashItem || null,
    valores: divergencia.valores || {},
    bloqueiosTecnicos: [],
    acaoSugerida: regra.acaoSugerida,
    aptaParaDecisaoHumana: regra.aptaParaDecisaoHumana,
    requerRateio: regra.requerRateio,
    requerRevisaoTecnica: regra.requerRevisaoTecnica,
    motivo: `Divergencia ${tipo} classificada a partir do comparador de snapshots.`,
    snapshotReferencia,
    criadoEm: new Date().toISOString(),
  };
}

function converterBloqueioEmCandidato(bloqueio, indice, snapshotReferencia) {
  const regra = obterRegra(bloqueio.tipo);
  return {
    idCandidato: criarIdCandidato("bloqueio", bloqueio.chave || bloqueio.tipo, indice),
    origem: "comparador_snapshots_pad",
    tipoDivergencia: bloqueio.tipo,
    tiposDivergencia: [bloqueio.tipo],
    categoriaOperacional: regra.categoriaOperacional,
    severidade: regra.severidade,
    uf: bloqueio.uf || null,
    numero: bloqueio.numero || null,
    area: bloqueio.area || null,
    natureza: bloqueio.natureza || null,
    descricaoAnterior: null,
    descricaoNova: null,
    chaveMaterial: bloqueio.chave || null,
    chaveComparacao: null,
    hashAnterior: null,
    hashNovo: null,
    valores: {},
    bloqueiosTecnicos: [bloqueio],
    acaoSugerida: regra.acaoSugerida,
    aptaParaDecisaoHumana: false,
    requerRateio: false,
    requerRevisaoTecnica: true,
    motivo: bloqueio.mensagem || `Bloqueio tecnico ${bloqueio.tipo}.`,
    snapshotReferencia,
    criadoEm: new Date().toISOString(),
  };
}

function resumir(candidatos) {
  const resumo = {
    totalCandidatos: candidatos.length,
    totalAptosDecisaoHumana: 0,
    totalBloqueiosTecnicos: 0,
    porTipo: {},
    porCategoriaOperacional: {},
    porSeveridade: {},
  };

  for (const item of candidatos) {
    if (item.aptaParaDecisaoHumana) resumo.totalAptosDecisaoHumana += 1;
    if (item.categoriaOperacional === "bloqueio_tecnico_seguranca") resumo.totalBloqueiosTecnicos += 1;
    resumo.porTipo[item.tipoDivergencia] = (resumo.porTipo[item.tipoDivergencia] || 0) + 1;
    resumo.porCategoriaOperacional[item.categoriaOperacional] = (resumo.porCategoriaOperacional[item.categoriaOperacional] || 0) + 1;
    resumo.porSeveridade[item.severidade] = (resumo.porSeveridade[item.severidade] || 0) + 1;
  }

  return resumo;
}

function gerarFilaRevisaoSnapshots(comparacao, opcoes = {}) {
  const snapshotReferencia = {
    checksumAnterior: comparacao?.checksumAnterior || null,
    checksumNovo: comparacao?.checksumNovo || null,
    versaoComparador: comparacao?.versaoComparador || null,
  };

  if (!comparacao) {
    return {
      geradoEm: new Date().toISOString(),
      modo: "dry-run",
      origem: "comparador_snapshots_pad",
      status: "comparacao_indisponivel",
      motivo: "Comparacao de snapshots nao existe; snapshot anterior oficial ainda nao foi promovido.",
      snapshotAnteriorOficialPromovido: false,
      resumo: resumir([]),
      candidatos: [],
      garantias: {
        decisaoRegistrada: false,
        bancoAlterado: false,
        publicacaoExecutada: false,
      },
    };
  }

  const candidatos = [];
  for (const [indice, divergencia] of (comparacao.divergencias || []).entries()) {
    candidatos.push(converterDivergenciaEmCandidato(divergencia, indice, snapshotReferencia));
  }
  for (const [indice, bloqueio] of (comparacao.bloqueiosTecnicos || []).entries()) {
    candidatos.push(converterBloqueioEmCandidato(bloqueio, indice, snapshotReferencia));
  }

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    origem: "comparador_snapshots_pad",
    status: "fila_gerada",
    snapshotAnteriorOficialPromovido: Boolean(opcoes.snapshotAnteriorOficialPromovido),
    checksumsValidos: comparacao.checksumsValidos === true,
    resumo: resumir(candidatos),
    candidatos,
    garantias: {
      decisaoRegistrada: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
    },
  };
}

function montarMarkdownFilaRevisaoSnapshots(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Fila de revisão por snapshots PAD (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Status: \`${relatorio.status}\``,
    "",
    "## Resumo",
    "",
    `- Total de candidatos: ${relatorio.resumo.totalCandidatos}`,
    `- Aptos para decisão humana: ${relatorio.resumo.totalAptosDecisaoHumana}`,
    `- Bloqueios técnicos: ${relatorio.resumo.totalBloqueiosTecnicos}`,
    "",
  ];

  if (relatorio.status === "comparacao_indisponivel") {
    linhas.push("## Comparação indisponível");
    linhas.push("");
    linhas.push(relatorio.motivo);
    linhas.push("");
    linhas.push("Nenhuma divergência artificial foi criada.");
    linhas.push("");
  } else {
    linhas.push("## Candidatos");
    linhas.push("");
    linhas.push("| ID | Tipo | Categoria | Severidade | Convênio | UF | Ação |");
    linhas.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const item of relatorio.candidatos) {
      linhas.push(`| \`${item.idCandidato}\` | \`${item.tipoDivergencia}\` | \`${item.categoriaOperacional}\` | ${item.severidade} | ${item.numero || "-"} | ${item.uf || "-"} | ${item.acaoSugerida} |`);
    }
    linhas.push("");
  }

  linhas.push("## Garantias");
  linhas.push("");
  linhas.push("- Nenhuma decisão registrada.");
  linhas.push("- Banco não alterado.");
  linhas.push("- Nenhuma publicação executada.");
  return `${linhas.join("\n")}\n`;
}

module.exports = {
  MAPA_DIVERGENCIAS,
  gerarFilaRevisaoSnapshots,
  montarMarkdownFilaRevisaoSnapshots,
  converterDivergenciaEmCandidato,
  converterBloqueioEmCandidato,
};

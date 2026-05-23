const CAMPOS_MINIMOS_CANDIDATO = [
  "idCandidato",
  "origem",
  "tipoDivergencia",
  "categoriaOperacional",
  "severidade",
  "motivo",
];

function inferirCompatibilidadeFilaOficial(candidato) {
  const ausentes = CAMPOS_MINIMOS_CANDIDATO.filter((campo) => !Object.prototype.hasOwnProperty.call(candidato, campo));
  if (ausentes.length > 0) {
    return {
      compativel: false,
      motivo: "dados_insuficientes_para_inferir_schema_oficial",
      camposAusentes: ausentes,
    };
  }

  return {
    compativel: true,
    motivo: "adaptacao_dry_run_sem_gravacao",
    camposAusentes: [],
  };
}

function adaptarCandidatoParaFilaOficialDryRun(candidato) {
  const compatibilidade = inferirCompatibilidadeFilaOficial(candidato);
  if (!compatibilidade.compativel) {
    return {
      idCandidato: candidato.idCandidato || null,
      integravel: false,
      motivo: compatibilidade.motivo,
      camposAusentes: compatibilidade.camposAusentes,
      payloadFilaOficial: null,
    };
  }

  return {
    idCandidato: candidato.idCandidato,
    integravel: true,
    motivo: "payload_compatível_em_dry_run_sem_persistencia",
    camposAusentes: [],
    payloadFilaOficial: {
      origem: "snapshot_pad_dry_run",
      referenciaExterna: candidato.idCandidato,
      tipoAlerta: candidato.tipoDivergencia,
      categoriaOperacional: candidato.categoriaOperacional,
      severidade: candidato.severidade,
      uf: candidato.uf || null,
      numeroConvenio: candidato.numero || null,
      area: candidato.area || null,
      natureza: candidato.natureza || null,
      descricaoAnterior: candidato.descricaoAnterior || null,
      descricaoNova: candidato.descricaoNova || null,
      chaveMaterial: candidato.chaveMaterial || null,
      chaveComparacao: candidato.chaveComparacao || null,
      hashAnterior: candidato.hashAnterior || null,
      hashNovo: candidato.hashNovo || null,
      valores: candidato.valores || {},
      bloqueiosTecnicos: candidato.bloqueiosTecnicos || [],
      acaoSugerida: candidato.acaoSugerida || null,
      aptaParaDecisaoHumana: candidato.aptaParaDecisaoHumana === true,
      requerRateio: candidato.requerRateio === true,
      requerRevisaoTecnica: candidato.requerRevisaoTecnica === true,
      motivo: candidato.motivo,
    },
  };
}

function simularIntegracaoFilaOficialSnapshots(filaSnapshots) {
  if (!filaSnapshots || filaSnapshots.status === "comparacao_indisponivel") {
    return {
      geradoEm: new Date().toISOString(),
      modo: "dry-run",
      status: "sem_candidatos_integraveis",
      motivo: "Comparacao de snapshots indisponivel; nenhum candidato artificial foi criado.",
      resumo: {
        totalCandidatosOrigem: 0,
        totalIntegraveis: 0,
        totalNaoIntegraveis: 0,
      },
      itens: [],
      garantias: {
        filaOficialAlterada: false,
        decisaoRegistrada: false,
        bancoAlterado: false,
        publicacaoExecutada: false,
      },
    };
  }

  const candidatos = Array.isArray(filaSnapshots.candidatos) ? filaSnapshots.candidatos : [];
  const itens = candidatos.map(adaptarCandidatoParaFilaOficialDryRun);
  const totalIntegraveis = itens.filter((item) => item.integravel).length;

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    status: "simulacao_concluida",
    motivo: "Adaptacao simulada sem persistencia na fila oficial.",
    resumo: {
      totalCandidatosOrigem: candidatos.length,
      totalIntegraveis,
      totalNaoIntegraveis: itens.length - totalIntegraveis,
    },
    itens,
    garantias: {
      filaOficialAlterada: false,
      decisaoRegistrada: false,
      bancoAlterado: false,
      publicacaoExecutada: false,
    },
  };
}

function montarMarkdownIntegracaoFilaOficial(relatorio) {
  const linhas = [
    "# PROFOR 2022 - Integração de snapshots com fila oficial (dry-run)",
    "",
    `Gerado em: ${relatorio.geradoEm}`,
    `Status: \`${relatorio.status}\``,
    "",
    "## Resumo",
    "",
    `- Candidatos na origem: ${relatorio.resumo.totalCandidatosOrigem}`,
    `- Integráveis em dry-run: ${relatorio.resumo.totalIntegraveis}`,
    `- Não integráveis: ${relatorio.resumo.totalNaoIntegraveis}`,
    "",
  ];

  if (relatorio.itens.length > 0) {
    linhas.push("## Itens simulados");
    linhas.push("");
    linhas.push("| ID | Integrável | Motivo |");
    linhas.push("| --- | --- | --- |");
    for (const item of relatorio.itens) {
      linhas.push(`| \`${item.idCandidato || "-"}\` | ${item.integravel ? "sim" : "não"} | ${item.motivo} |`);
    }
    linhas.push("");
  } else {
    linhas.push("Nenhum candidato integrável foi gerado.");
    linhas.push("");
  }

  linhas.push("## Garantias");
  linhas.push("");
  linhas.push("- Fila oficial não alterada.");
  linhas.push("- Nenhuma decisão registrada.");
  linhas.push("- Banco não alterado.");
  linhas.push("- Nenhuma publicação executada.");
  return `${linhas.join("\n")}\n`;
}

module.exports = {
  simularIntegracaoFilaOficialSnapshots,
  adaptarCandidatoParaFilaOficialDryRun,
  inferirCompatibilidadeFilaOficial,
  montarMarkdownIntegracaoFilaOficial,
};

const fs = require("node:fs");
const path = require("node:path");

const { lerRelatoriosPadProfor2022 } = require("./profor-pad-report-reader");
const {
  reconstruirPlanoAplicacaoPadDryRun,
  salvarRelatorioReconstrucao,
} = require("./profor-pad-plano-reconstrucao-service");
const {
  compararPlanosPadDryRun,
  salvarRelatorioComparacao,
} = require("./profor-pad-plano-comparador-service");
const {
  gerarFotografiaCanonica,
  salvarFotografia,
  salvarMarkdownFotografia,
} = require("./profor-pad-fotografia-service");
const {
  compararSnapshotsPad,
  salvarRelatorioComparacaoSnapshots,
} = require("./profor-pad-comparador-snapshots-service");

/**
 * Recarrega todos os relatórios PAD e gera o diagnóstico operacional
 * consolidando a leitura, reconstrução, comparação e fotografia canônica.
 *
 * @param {Object} opcoes Opções de execução
 * @param {string} [opcoes.repoRoot] Caminho raiz do repositório
 * @returns {Promise<Object>} Objeto de resumo da recarga operacional
 */
async function recarregarPadsOperacional(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const dataHora = new Date().toISOString();

  const CAMINHO_RECONSTRUCAO_JSON = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json"
  );
  const CAMINHO_COMPARACAO_JSON = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json"
  );
  const CAMINHO_COMPARACAO_MD = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.md"
  );
  const CAMINHO_SNAPSHOT_ANTERIOR = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-fotografia-canonica-anterior.json"
  );
  const CAMINHO_SNAPSHOT_ATUAL_JSON = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-fotografia-canonica.json"
  );
  const CAMINHO_SNAPSHOT_ATUAL_MD = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-fotografia-canonica.md"
  );
  const CAMINHO_COMP_SNAPSHOTS_JSON = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.json"
  );
  const CAMINHO_COMP_SNAPSHOTS_MD = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.md"
  );
  const CAMINHO_RECARGA_JSON = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-recarga-operacional.json"
  );
  const CAMINHO_RECARGA_MD = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-recarga-operacional.md"
  );

  const impedimentos = [];
  const alertas = [];
  let etapaAtual = "inicio";

  try {
    // 1. Ler relatórios PAD
    etapaAtual = "ler_relatorios_pad";
    opcoes.repoRoot = repoRoot;
    const resultadoReader = lerRelatoriosPadProfor2022(opcoes);
    const { relatorios, alertas: alertasReader, resumo: resumoReader } = resultadoReader;

    // Se a pasta de entrada tiver um total de arquivos lidos diferente de 15
    if (resumoReader.totalArquivosEncontrados !== 15) {
      impedimentos.push({
        tipo: "quantidade_arquivos_pad_invalida",
        nivel: "impeditivo",
        detalhe: `A pasta de entrada possui ${resumoReader.totalArquivosEncontrados} arquivos PAD, mas o esperado é exatamente 15.`,
      });
    }

    // Instrumentos únicos e duplicados
    const instrumentosUnicos = new Set();
    const duplicados = new Set();
    for (const relatorio of relatorios) {
      const instrumento = relatorio.codigoInstrumento;
      if (!instrumento) continue;
      if (instrumentosUnicos.has(instrumento)) {
        duplicados.add(instrumento);
      } else {
        instrumentosUnicos.add(instrumento);
      }
    }

    if (duplicados.size > 0) {
      impedimentos.push({
        tipo: "arquivo_duplicado_para_mesmo_instrumento",
        nivel: "impeditivo",
        detalhe: `Instrumentos duplicados encontrados nos arquivos PAD: ${Array.from(duplicados).join(", ")}.`,
      });
    }

    if (instrumentosUnicos.size !== 15 && duplicados.size === 0) {
      impedimentos.push({
        tipo: "quantidade_arquivos_pad_invalida",
        nivel: "impeditivo",
        detalhe: `Foram encontrados ${instrumentosUnicos.size} instrumentos únicos, mas o esperado é exatamente 15.`,
      });
    }

    // Filtra alertas impeditivos do reader
    for (const alerta of alertasReader) {
      if (alerta.nivel === "impeditivo") {
        impedimentos.push({
          tipo: alerta.tipo,
          nivel: "impeditivo",
          numeroConvenio: alerta.instrumento || null,
          detalhe: alerta.detalhe,
          origem: alerta.origem || null,
        });
      } else {
        alertas.push(alerta);
      }
    }

    // 2. Executar reconstrução dry-run
    etapaAtual = "reconstruir_plano";
    const reconstrucao = reconstruirPlanoAplicacaoPadDryRun(opcoes);

    etapaAtual = "salvar_relatorio_reconstrucao";
    salvarRelatorioReconstrucao(reconstrucao, CAMINHO_RECONSTRUCAO_JSON);

    // Mesclar impedimentos e alertas da reconstrução
    if (reconstrucao.impedimentos && reconstrucao.impedimentos.length > 0) {
      impedimentos.push(...reconstrucao.impedimentos);
    }
    if (reconstrucao.alertas && reconstrucao.alertas.length > 0) {
      alertas.push(...reconstrucao.alertas);
    }

    // 3. Executar comparação
    etapaAtual = "comparar_plano";
    const comparacao = compararPlanosPadDryRun({ repoRoot, reconstrucao });

    etapaAtual = "salvar_relatorio_comparacao";
    salvarRelatorioComparacao(comparacao, CAMINHO_COMPARACAO_JSON, CAMINHO_COMPARACAO_MD);

    // Adicionar as diferenças críticas como impedimentos, se houver
    if (comparacao.diferencasCriticas && comparacao.diferencasCriticas.length > 0) {
      for (const diff of comparacao.diferencasCriticas) {
        impedimentos.push({
          tipo: "diferenca_critica_plano",
          nivel: "impeditivo",
          numeroConvenio: diff.numeroConvenio || null,
          detalhe: `Diferença crítica no item "${diff.descricao}": ${diff.observacao || "necessita de ajuste de rateio"}.`,
        });
      }
    }

    // Adicionar avisos da comparação como alertas
    if (comparacao.avisos && comparacao.avisos.length > 0) {
      alertas.push(...comparacao.avisos);
    }

    const caminhosRelatorios = {
      recargaJson: "backend/data/relatorios/profor-2022-pad-recarga-operacional.json",
      recargaMd: "backend/data/relatorios/profor-2022-pad-recarga-operacional.md",
      reconstrucaoJson: "backend/data/relatorios/profor-2022-pad-plano-reconstruido-dry-run.json",
      comparacaoJson: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.json",
      comparacaoMd: "backend/data/relatorios/profor-2022-pad-plano-comparacao-dry-run.md",
    };

    // 4. Lógica de Snapshot
    let snapshotAtual = null;
    let compSnapshots = null;
    const snapshotAnteriorExiste = fs.existsSync(CAMINHO_SNAPSHOT_ANTERIOR);

    if (snapshotAnteriorExiste) {
      etapaAtual = "gerar_fotografia";
      snapshotAtual = gerarFotografiaCanonica(reconstrucao.planoAplicacaoReconstruido);

      etapaAtual = "salvar_fotografia";
      salvarFotografia(CAMINHO_SNAPSHOT_ATUAL_JSON, snapshotAtual);

      etapaAtual = "salvar_markdown_fotografia";
      salvarMarkdownFotografia(CAMINHO_SNAPSHOT_ATUAL_MD, snapshotAtual);

      etapaAtual = "comparar_snapshots";
      compSnapshots = compararSnapshotsPad(CAMINHO_SNAPSHOT_ANTERIOR, snapshotAtual);

      etapaAtual = "salvar_comparacao_snapshots";
      salvarRelatorioComparacaoSnapshots(
        compSnapshots,
        CAMINHO_COMP_SNAPSHOTS_JSON,
        CAMINHO_COMP_SNAPSHOTS_MD
      );

      caminhosRelatorios.snapshotAtualJson = "backend/data/relatorios/profor-2022-pad-fotografia-canonica.json";
      caminhosRelatorios.snapshotAtualMd = "backend/data/relatorios/profor-2022-pad-fotografia-canonica.md";
      caminhosRelatorios.comparacaoSnapshotsJson = "backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.json";
      caminhosRelatorios.comparacaoSnapshotsMd = "backend/data/relatorios/profor-2022-pad-comparacao-snapshots-dry-run.md";

      // Mesclar bloqueios técnicos do snapshot como impedimentos
      if (compSnapshots.bloqueiosTecnicos && compSnapshots.bloqueiosTecnicos.length > 0) {
        for (const bl of compSnapshots.bloqueiosTecnicos) {
          if (!bl.ruidoTecnicoControlado) {
            impedimentos.push({
              tipo: bl.tipo,
              nivel: "impeditivo",
              detalhe: bl.mensagem || `Bloqueio técnico no snapshot: ${bl.tipo}`,
            });
          }
        }
      }
    }

    const temImpedimentos = impedimentos.length > 0;
    const aptoParaUsoLocal = !temImpedimentos && reconstrucao.aptoParaAtivacao;
    const aptoParaPublicacao = !temImpedimentos && comparacao.aptoParaPublicacao;

    const jsonRecarga = {
      dataHora,
      sucesso: true,
      aptoParaUsoLocal,
      aptoParaPublicacao,
      totalArquivosPad: resumoReader.totalArquivosEncontrados,
      totalRelatoriosLidos: resumoReader.totalRelatoriosLidos,
      totalItensPad: resumoReader.totalItensExtraidos,
      totalLinhasReconstruidas: reconstrucao.resumo.totalLinhasReconstruidas,
      totalConveniosReconstruidos: reconstrucao.resumo.totalConveniosReconstruidos,
      totalItensComRateioAplicado: reconstrucao.resumo.totalItensPadComRateioAplicado,
      totalItensSemRateio: reconstrucao.resumo.totalItensPadSemRateioRemanescentes,
      totalItensNovos: comparacao.resumo.totalItensNovos,
      totalItensSuprimidos: comparacao.resumo.totalItensAusentes,
      totalImpedimentos: impedimentos.length,
      totalAlertas: alertas.length,
      impedimentos,
      alertas,
      caminhosRelatorios,
    };

    // Gerar Markdown
    const mdContent = gerarMarkdownRecarga(jsonRecarga);

    // Salvar relatórios de recarga
    etapaAtual = "salvar_relatorio_recarga";
    fs.mkdirSync(path.dirname(CAMINHO_RECARGA_JSON), { recursive: true });
    fs.writeFileSync(CAMINHO_RECARGA_JSON, JSON.stringify(jsonRecarga, null, 2), "utf8");
    fs.writeFileSync(CAMINHO_RECARGA_MD, mdContent, "utf8");

    return jsonRecarga;
  } catch (erro) {
    // Tratar erro de execução
    const jsonRecargaErro = {
      dataHora,
      sucesso: false,
      aptoParaUsoLocal: false,
      aptoParaPublicacao: false,
      totalArquivosPad: 0,
      totalRelatoriosLidos: 0,
      totalItensPad: 0,
      totalLinhasReconstruidas: 0,
      totalConveniosReconstruidos: 0,
      totalItensComRateioAplicado: 0,
      totalItensSemRateio: 0,
      totalItensNovos: 0,
      totalItensSuprimidos: 0,
      totalImpedimentos: 1,
      totalAlertas: 0,
      impedimentos: [
        {
          tipo: erro.codigo || "erro_execucao_recarga",
          nivel: "impeditivo",
          detalhe: erro.codigo === "cache_pad_transferegov_ausente_ou_invalido" ? erro.message : `Erro na etapa ${erro.etapa || etapaAtual}: ${erro.message}`,
          etapa: erro.etapa || etapaAtual,
          providencia: erro.providencia || undefined,
          tecnico: {
            mensagem: erro?.message || String(erro),
            stack: erro?.stack || null,
          },
        },
      ],
      alertas: [],
      caminhosRelatorios: {
        recargaJson: "backend/data/relatorios/profor-2022-pad-recarga-operacional.json",
        recargaMd: "backend/data/relatorios/profor-2022-pad-recarga-operacional.md",
      },
    };

    const mdContent = gerarMarkdownRecarga(jsonRecargaErro);
    fs.mkdirSync(path.dirname(CAMINHO_RECARGA_JSON), { recursive: true });
    fs.writeFileSync(CAMINHO_RECARGA_JSON, JSON.stringify(jsonRecargaErro, null, 2), "utf8");
    fs.writeFileSync(CAMINHO_RECARGA_MD, mdContent, "utf8");

    return jsonRecargaErro;
  }
}

/**
 * Obtém os resultados da última recarga operacional realizada.
 *
 * @param {Object} opcoes Opções de execução
 * @param {string} [opcoes.repoRoot] Caminho raiz do repositório
 * @returns {Object} Dados da última recarga ou objeto de aviso
 */
function obterUltimaRecargaOperacional(opcoes = {}) {
  const repoRoot = opcoes.repoRoot || path.resolve(__dirname, "../../..");
  const caminhoJson = path.join(
    repoRoot,
    "backend/data/relatorios/profor-2022-pad-recarga-operacional.json"
  );

  if (!fs.existsSync(caminhoJson)) {
    return {
      sucesso: false,
      mensagem: "Nenhuma recarga operacional foi realizada ainda.",
    };
  }

  try {
    return JSON.parse(fs.readFileSync(caminhoJson, "utf8"));
  } catch (erro) {
    return {
      sucesso: false,
      mensagem: "Erro ao ler o relatório de recarga operacional anterior.",
      erro: erro.message,
    };
  }
}

/**
 * Constrói o conteúdo em Markdown para o relatório de recarga operacional.
 *
 * @param {Object} resumo Resumo da recarga operacional
 * @returns {string} Texto formatado em Markdown
 */
function gerarMarkdownRecarga(resumo) {
  const linhas = [];
  linhas.push("# Relatório de Recarga Operacional - PROFOR 2022");
  linhas.push("");
  linhas.push(`**Data e Hora**: ${resumo.dataHora}`);
  linhas.push(`**Sucesso**: ${resumo.sucesso ? "✅ Sim" : "❌ Não (Falha Crítica)"}`);
  linhas.push(`**Apto para Uso Local**: ${resumo.aptoParaUsoLocal ? "✅ Sim" : "❌ Não"}`);
  linhas.push(`**Apto para Publicação**: ${resumo.aptoParaPublicacao ? "✅ Sim" : "❌ Não"}`);
  linhas.push("");

  linhas.push("## Resumo Estatístico");
  linhas.push("");
  linhas.push(`- **Arquivos PAD Encontrados**: ${resumo.totalArquivosPad}`);
  linhas.push(`- **Relatórios Lidos com Sucesso**: ${resumo.totalRelatoriosLidos}`);
  linhas.push(`- **Itens Extraídos dos PADs**: ${resumo.totalItensPad}`);
  linhas.push(`- **Linhas Reconstruídas**: ${resumo.totalLinhasReconstruidas}`);
  linhas.push(`- **Convênios Reconstruídos**: ${resumo.totalConveniosReconstruidos}`);
  linhas.push(`- **Itens com Rateio Aplicado**: ${resumo.totalItensComRateioAplicado}`);
  linhas.push(`- **Itens sem Rateio Remanescentes**: ${resumo.totalItensSemRateio}`);
  linhas.push(`- **Itens Novos**: ${resumo.totalItensNovos}`);
  linhas.push(`- **Itens Suprimidos (Ausentes)**: ${resumo.totalItensSuprimidos}`);
  linhas.push("");

  linhas.push(`## Impedimentos (${resumo.totalImpedimentos})`);
  linhas.push("");
  if (resumo.impedimentos.length === 0) {
    linhas.push("Nenhum impedimento técnico detectado.");
  } else {
    linhas.push("| Tipo | Convênio | Detalhe |");
    linhas.push("| --- | --- | --- |");
    for (const imp of resumo.impedimentos) {
      const conv = imp.numeroConvenio || "-";
      linhas.push(`| \`${imp.tipo}\` | ${conv} | ${imp.detalhe} |`);
    }
  }
  linhas.push("");

  linhas.push(`## Alertas (${resumo.totalAlertas})`);
  linhas.push("");
  if (resumo.alertas.length === 0) {
    linhas.push("Nenhum alerta detectado.");
  } else {
    linhas.push("| Tipo | Convênio | Detalhe |");
    linhas.push("| --- | --- | --- |");
    for (const alt of resumo.alertas) {
      const conv = alt.numeroConvenio || alt.instrumento || "-";
      linhas.push(`| \`${alt.tipo}\` | ${conv} | ${alt.detalhe} |`);
    }
  }
  linhas.push("");

  linhas.push("## Caminhos dos Relatórios Gerados");
  linhas.push("");
  for (const [chave, caminho] of Object.entries(resumo.caminhosRelatorios)) {
    linhas.push(`- **${chave}**: \`${caminho}\``);
  }
  linhas.push("");

  return linhas.join("\n");
}

module.exports = {
  recarregarPadsOperacional,
  obterUltimaRecargaOperacional,
};

// Roda a integração dry-run entre o plano reconstruído oficial (dry-run) e o
// rateio por área + quantidade fixa. Se não houver arquivo real de instruções,
// gera uma amostra controlada documentada — sem alterar dados oficiais.

const fs = require("node:fs");
const path = require("node:path");

const {
  integrarRateioFixoNoPlanoReconstruido,
  compararPlanoOriginalEComRateioFixo,
  montarMarkdownIntegracaoRateioFixo,
  montarMarkdownComparacaoRateioFixo,
  chaveItemPad,
  agruparLinhasOriginalPorItem,
} = require("../services/profor-2022/profor-pad-reconstrucao-rateio-fixo-integracao-service");

const REPO_ROOT = path.join(__dirname, "..", "..");
const RELATORIOS_DIR = path.join(__dirname, "..", "data", "relatorios");
const PLANO_RECONSTRUIDO_DRY_RUN = path.join(RELATORIOS_DIR, "profor-2022-pad-plano-reconstruido-dry-run.json");
const INSTRUCOES_REAIS = path.join(RELATORIOS_DIR, "profor-2022-pad-rateio-quantidade-fixa-instrucoes.json");
const SAIDA_INTEGRACAO_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-plano-reconstruido-com-rateio-fixo-dry-run.json");
const SAIDA_INTEGRACAO_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-plano-reconstruido-com-rateio-fixo-dry-run.md");
const SAIDA_COMPARACAO_JSON = path.join(RELATORIOS_DIR, "profor-2022-pad-comparacao-rateio-fixo-vs-reconstrucao-dry-run.json");
const SAIDA_COMPARACAO_MD = path.join(RELATORIOS_DIR, "profor-2022-pad-comparacao-rateio-fixo-vs-reconstrucao-dry-run.md");

function lerPlanoReconstruido() {
  if (!fs.existsSync(PLANO_RECONSTRUIDO_DRY_RUN)) {
    throw new Error(
      `Plano reconstruído dry-run não encontrado em ${path.relative(REPO_ROOT, PLANO_RECONSTRUIDO_DRY_RUN)}. ` +
        `Execute 'npm run profor:pad:reconstruir-plano:dry-run' antes.`,
    );
  }
  const payload = JSON.parse(fs.readFileSync(PLANO_RECONSTRUIDO_DRY_RUN, "utf8"));
  const plano = Array.isArray(payload.planoAplicacaoReconstruido) ? payload.planoAplicacaoReconstruido : [];
  return { payload, plano };
}

function carregarInstrucoesReaisSeExistirem() {
  if (!fs.existsSync(INSTRUCOES_REAIS)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(INSTRUCOES_REAIS, "utf8"));
    if (Array.isArray(payload?.instrucoes)) return payload.instrucoes;
    if (Array.isArray(payload)) return payload;
    return null;
  } catch (_erro) {
    return null;
  }
}

// Amostra controlada: pega o primeiro item com mais de uma linha (já rateado por área)
// e simula uma instrução de rateio fixo "espelho" sobre essa quantidade total.
function montarAmostraControlada(plano) {
  if (!Array.isArray(plano) || plano.length === 0) return { instrucoes: [], notas: ["plano_vazio"] };
  const grupos = agruparLinhasOriginalPorItem(plano);
  const candidatos = [];
  for (const [chave, linhas] of grupos.entries()) {
    if (linhas.length >= 2) candidatos.push({ chave, linhas });
    if (candidatos.length >= 2) break;
  }
  if (candidatos.length === 0) {
    return { instrucoes: [], notas: ["nenhum_item_multi_linha_para_amostra"] };
  }

  const instrucoes = candidatos.map(({ chave, linhas }) => {
    const referencia = linhas[0];
    const quantidadeTotal = linhas.reduce((acc, linha) => acc + Number(linha.quantidade || 0), 0);
    const valorUnitario = Number(referencia.valorUnitario || 0);
    const rateios = linhas.map((linha) => ({
      area: linha.area,
      natureza: linha.natureza,
      quantidade: Number(linha.quantidade || 0),
    }));
    return {
      chaveItem: chave,
      item: {
        numero: referencia.numero,
        uf: referencia.uf,
        instrumento: referencia.instrumento,
        ano: referencia.ano,
        descricao: referencia.descricao,
        natureza: referencia.natureza,
        quantidade: quantidadeTotal,
        valorUnitario,
      },
      rateios,
    };
  });

  return {
    instrucoes,
    notas: [
      "amostra_controlada_gerada_a_partir_do_plano_reconstruido",
      "nenhuma_instrucao_real_em_disco",
      `total_amostras=${instrucoes.length}`,
    ],
  };
}

function escreverJsonAtomico(caminho, dados) {
  const tmp = `${caminho}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, caminho);
}

function main() {
  const { plano } = lerPlanoReconstruido();
  const instrucoesReais = carregarInstrucoesReaisSeExistirem();
  let instrucoes;
  let fonteInstrucoes;
  let notasAmostra = [];

  if (Array.isArray(instrucoesReais) && instrucoesReais.length > 0) {
    instrucoes = instrucoesReais;
    fonteInstrucoes = path.relative(REPO_ROOT, INSTRUCOES_REAIS);
  } else {
    const amostra = montarAmostraControlada(plano);
    instrucoes = amostra.instrucoes;
    notasAmostra = amostra.notas;
    fonteInstrucoes = "amostra_controlada_gerada_pelo_script";
  }

  const relatorio = integrarRateioFixoNoPlanoReconstruido(plano, instrucoes);
  relatorio.fonteInstrucoes = fonteInstrucoes;
  relatorio.notasAmostra = notasAmostra;

  const comparacao = compararPlanoOriginalEComRateioFixo(relatorio);
  comparacao.fonteInstrucoes = fonteInstrucoes;
  comparacao.notasAmostra = notasAmostra;

  escreverJsonAtomico(SAIDA_INTEGRACAO_JSON, relatorio);
  fs.writeFileSync(SAIDA_INTEGRACAO_MD, montarMarkdownIntegracaoRateioFixo(relatorio), "utf8");
  escreverJsonAtomico(SAIDA_COMPARACAO_JSON, comparacao);
  fs.writeFileSync(SAIDA_COMPARACAO_MD, montarMarkdownComparacaoRateioFixo(comparacao), "utf8");

  console.log("Reconstrução com rateio por quantidade fixa (dry-run) concluída.");
  console.log(`Fonte das instruções: ${fonteInstrucoes}`);
  console.log(`Itens distintos no plano: ${relatorio.resumo.totalItensPlanoOriginal}`);
  console.log(`Instruções recebidas: ${relatorio.resumo.totalInstrucoesRecebidas}`);
  console.log(`Itens com rateio fixo aplicado: ${relatorio.resumo.totalItensComRateioFixoAplicado}`);
  console.log(`Itens bloqueados: ${relatorio.resumo.totalItensBloqueados}`);
  console.log(`Itens sem instrução (preservados): ${relatorio.resumo.totalItensSemInstrucao}`);
  console.log(`Saldo não rateado total: ${relatorio.resumo.saldoNaoRateadoTotal}`);
  console.log(`Diferença residual total: ${relatorio.resumo.diferencaResidualTotal}`);
  console.log(`Δ linhas: ${relatorio.diferencasAgregadas.deltaLinhas}`);
  console.log(`Δ valor previsto: ${relatorio.diferencasAgregadas.deltaValorPrevisto}`);
  console.log(`Δ saldo: ${relatorio.diferencasAgregadas.deltaSaldo}`);
  console.log(`JSON integração:  ${path.relative(REPO_ROOT, SAIDA_INTEGRACAO_JSON)}`);
  console.log(`MD integração:    ${path.relative(REPO_ROOT, SAIDA_INTEGRACAO_MD)}`);
  console.log(`JSON comparação:  ${path.relative(REPO_ROOT, SAIDA_COMPARACAO_JSON)}`);
  console.log(`MD comparação:    ${path.relative(REPO_ROOT, SAIDA_COMPARACAO_MD)}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (erro) {
    console.error("Falha na reconstrução com rateio por quantidade fixa (dry-run).");
    console.error(erro?.stack || erro?.message || erro);
    process.exit(1);
  }
}

module.exports = {
  carregarInstrucoesReaisSeExistirem,
  montarAmostraControlada,
};

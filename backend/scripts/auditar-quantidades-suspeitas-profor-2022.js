const fs = require("node:fs");
const path = require("node:path");
const db = require("../db/database");
const { arredondarMoedaProfor } = require("../services/profor-2022/profor-plano-aplicacao-service");

const TOLERANCIA_QUANTIDADE = 0.001;
const TOLERANCIA_VALOR = 0.01;
const CAMINHO_JSON = "backend/data/relatorios/profor-2022-quantidades-suspeitas-dry-run.json";
const CAMINHO_MD = "backend/data/relatorios/profor-2022-quantidades-suspeitas-dry-run.md";

function obterRegistrosRateio() {
  return db.prepare(`
    SELECT
      r.id AS rateio_id,
      r.item_conhecido_id,
      r.area,
      r.natureza,
      r.quantidade_referencia,
      r.valor_previsto_referencia,
      r.valor_executado_referencia,
      r.percentual_quantidade,
      r.percentual_valor,
      r.ativo AS rateio_ativo,
      i.chave_item,
      i.numero_convenio,
      i.descricao_original_referencia,
      i.uf,
      i.ano,
      i.valor_unitario_referencia,
      i.origem,
      i.apto_para_importacao_futura,
      i.ativo AS item_ativo
    FROM profor_2022_item_rateios r
    INNER JOIN profor_2022_itens_conhecidos i
      ON i.id = r.item_conhecido_id
    WHERE r.ativo = 1
      AND i.ativo = 1
  `).all();
}

function arredondarQuantidade(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 1000000) / 1000000;
}

function calcularQuantidadeEstimada(valorPrevisto, valorUnitario) {
  if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) return null;
  return arredondarQuantidade(valorPrevisto / valorUnitario);
}

function avaliarRegistro(registro) {
  const quantidade = Number(registro.quantidade_referencia) || 0;
  const valorPrevisto = Number(registro.valor_previsto_referencia) || 0;
  const valorUnitario = Number(registro.valor_unitario_referencia) || 0;
  const quantidadeEstimada = calcularQuantidadeEstimada(valorPrevisto, valorUnitario);
  if (quantidadeEstimada === null) return null;

  const diferencaQuantidade = Math.abs(quantidade - quantidadeEstimada);
  const valorEsperado = arredondarMoedaProfor(quantidade * valorUnitario);
  const diferencaFechamento = Math.abs(arredondarMoedaProfor(valorEsperado - valorPrevisto));
  const fatorInflacao = quantidadeEstimada > 0 ? quantidade / quantidadeEstimada : null;
  const fatorInflacaoDecimal10 = fatorInflacao !== null && Math.abs(fatorInflacao - 10) <= 0.05;
  const suspeito = diferencaQuantidade > TOLERANCIA_QUANTIDADE && diferencaFechamento > TOLERANCIA_VALOR;

  if (!suspeito) return null;

  return {
    rateioId: registro.rateio_id,
    itemConhecidoId: registro.item_conhecido_id,
    chaveItem: registro.chave_item,
    numeroConvenio: registro.numero_convenio,
    uf: registro.uf,
    ano: registro.ano,
    descricao: registro.descricao_original_referencia,
    area: registro.area,
    natureza: registro.natureza,
    origem: registro.origem,
    quantidadeGravada: quantidade,
    quantidadeEstimada,
    diferencaQuantidade: arredondarQuantidade(quantidade - quantidadeEstimada),
    fatorInflacao: fatorInflacao === null ? null : arredondarQuantidade(fatorInflacao),
    fatorInflacaoDecimal10,
    classificacao: fatorInflacaoDecimal10 ? "inflacao_decimal_legada_fator_10" : "quantidade_incompativel_com_valor_previsto",
    valorUnitarioReferencia: valorUnitario,
    valorPrevistoReferencia: arredondarMoedaProfor(valorPrevisto),
    valorEsperadoPelaQuantidadeGravada: valorEsperado,
    diferencaFechamentoValor: arredondarMoedaProfor(valorEsperado - valorPrevisto),
    percentualQuantidade: Number(registro.percentual_quantidade) || 0,
    percentualValor: Number(registro.percentual_valor) || 0,
    aptoParaImportacaoFutura: Boolean(registro.apto_para_importacao_futura),
  };
}

function gerarResumo(suspeitos, totalRateiosAtivos) {
  const porConvenioUf = new Map();
  for (const item of suspeitos) {
    const chave = `${item.numeroConvenio}/${item.uf}`;
    const atual = porConvenioUf.get(chave) || {
      numeroConvenio: item.numeroConvenio,
      uf: item.uf,
      totalSuspeitos: 0,
      itens: new Set(),
    };
    atual.totalSuspeitos += 1;
    atual.itens.add(item.chaveItem);
    porConvenioUf.set(chave, atual);
  }

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    totalRateiosAtivos,
    totalSuspeitos: suspeitos.length,
    totalConveniosAfetados: porConvenioUf.size,
    porConvenioUf: Array.from(porConvenioUf.values())
      .map((item) => ({
        numeroConvenio: item.numeroConvenio,
        uf: item.uf,
        totalSuspeitos: item.totalSuspeitos,
        totalItens: item.itens.size,
      }))
      .sort((a, b) => b.totalSuspeitos - a.totalSuspeitos),
  };
}

function renderMarkdown(relatorio) {
  const linhas = [
    "# Auditoria de quantidades suspeitas - PROFOR 2022",
    "",
    `Gerado em: ${relatorio.resumo.geradoEm}`,
    "",
    "## Resumo",
    "",
    `- Total de rateios ativos auditados: ${relatorio.resumo.totalRateiosAtivos}`,
    `- Total de suspeitos: ${relatorio.resumo.totalSuspeitos}`,
    `- Total de convenios/UF afetados: ${relatorio.resumo.totalConveniosAfetados}`,
    "",
    "## Suspeitos (amostra)",
    "",
    "| Rateio | Convenio/UF | Item | Classificação | Qtd gravada | Qtd estimada | Fator | Diff qtd | VU | Previsto | Fechamento diff |",
    "|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ];

  const amostra = relatorio.suspeitos.slice(0, 50);
  for (const item of amostra) {
    linhas.push(
      `| ${item.rateioId} | ${item.numeroConvenio}/${item.uf} | ${item.descricao} | `
      + `${item.classificacao} | ${item.quantidadeGravada} | ${item.quantidadeEstimada} | ${item.fatorInflacao ?? "-"} | ${item.diferencaQuantidade} | `
      + `${item.valorUnitarioReferencia} | ${item.valorPrevistoReferencia} | ${item.diferencaFechamentoValor} |`
    );
  }

  if (relatorio.suspeitos.length > amostra.length) {
    linhas.push("");
    linhas.push(`Amostra limitada a ${amostra.length} registros de ${relatorio.suspeitos.length} suspeitos.`);
  }

  return `${linhas.join("\n")}\n`;
}

function executar() {
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoJson = path.join(repoRoot, CAMINHO_JSON);
  const caminhoMd = path.join(repoRoot, CAMINHO_MD);
  const registros = obterRegistrosRateio();
  const suspeitos = registros
    .map(avaliarRegistro)
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.diferencaFechamentoValor) - Math.abs(a.diferencaFechamentoValor));

  const relatorio = {
    resumo: gerarResumo(suspeitos, registros.length),
    suspeitos,
  };

  fs.mkdirSync(path.dirname(caminhoJson), { recursive: true });
  fs.writeFileSync(caminhoJson, `${JSON.stringify(relatorio, null, 2)}\n`, "utf8");
  fs.writeFileSync(caminhoMd, renderMarkdown(relatorio), "utf8");

  console.log("Auditoria de quantidades suspeitas concluida (dry-run).");
  console.log(`JSON: ${CAMINHO_JSON}`);
  console.log(`MD:   ${CAMINHO_MD}`);
  console.log(`Rateios auditados: ${relatorio.resumo.totalRateiosAtivos}`);
  console.log(`Suspeitos: ${relatorio.resumo.totalSuspeitos}`);
  console.log(`Convenios/UF afetados: ${relatorio.resumo.totalConveniosAfetados}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao auditar quantidades suspeitas do PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

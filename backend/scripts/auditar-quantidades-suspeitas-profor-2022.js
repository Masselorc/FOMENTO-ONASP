const fs = require("node:fs");
const path = require("node:path");
const db = require("../db/database");
const { exigirConfirmacaoAuditoriaSqliteLegado } = require("./_guard-sqlite-legado");
const { arredondarMoedaProfor } = require("../services/profor-2022/profor-plano-aplicacao-service");
const {
  avaliarDivergenciaQuantidadeValorUnitario,
} = require("../services/profor-2022/profor-pad-consistencia-quantidade-service");

const CAMINHO_PAD_RELATORIOS =
  "backend/data/relatorios/profor-2022-pad-relatorios-dry-run.json";

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

/**
 * Indexa os itens do relatorio PAD por arquivo + linha, para recuperar a
 * descricao do item das divergencias de inconsistencia quantidade x valor
 * unitario (cujo payload nem sempre traz a descricao).
 */
function carregarIndicePadRelatorios(repoRoot) {
  const caminho = path.join(repoRoot, CAMINHO_PAD_RELATORIOS);
  if (!fs.existsSync(caminho)) return new Map();
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return new Map();
  }
  const mapa = new Map();
  for (const item of Array.isArray(dados.itens) ? dados.itens : []) {
    const arquivo = String(item?.arquivo || "");
    const linha = Number(item?.linha);
    if (arquivo && Number.isInteger(linha)) mapa.set(`${arquivo}::${linha}`, item);
  }
  return mapa;
}

/**
 * Audita, em dry-run, todas as divergencias quantidade_valor_unitario_inconsistente,
 * aplicando o criterio central de arredondamento do valor unitario exibido.
 */
function auditarInconsistenciasQuantidadeValorUnitario(repoRoot) {
  const indicePad = carregarIndicePadRelatorios(repoRoot);
  const linhas = db.prepare(`
    SELECT id, numero_convenio, uf, status, bloqueia_publicacao, diferenca, payload_json
    FROM profor_2022_revisao_divergencias
    WHERE tipo_alerta = 'quantidade_valor_unitario_inconsistente'
    ORDER BY id
  `).all();

  const avaliadas = [];
  for (const linha of linhas) {
    let payload = {};
    try {
      payload = JSON.parse(linha.payload_json || "{}");
    } catch {
      payload = {};
    }
    const avaliacao = avaliarDivergenciaQuantidadeValorUnitario({
      diferenca: linha.diferenca,
      payload,
    });
    const arquivo = payload.origemRelatorio || payload.alertasOriginais?.[0]?.origem?.arquivo || null;
    const linhaPad = Number(payload.linhaOrigem ?? payload.alertasOriginais?.[0]?.origem?.linha);
    const dados = payload.dadosConsistencia || payload.alertasOriginais?.[0]?.dados || null;
    const itemPad = arquivo && Number.isInteger(linhaPad)
      ? indicePad.get(`${arquivo}::${linhaPad}`)
      : null;
    avaliadas.push({
      id: linha.id,
      numeroConvenio: linha.numero_convenio,
      uf: linha.uf || itemPad?.aba || null,
      status: linha.status,
      bloqueiaPublicacao: linha.bloqueia_publicacao === 1,
      descricao: dados?.descricao || itemPad?.descricao || null,
      linhaPad: dados?.linhaPad ?? itemPad?.linha ?? (Number.isInteger(linhaPad) ? linhaPad : null),
      codigoNaturezaDespesa: dados?.codigoNaturezaDespesa || itemPad?.codigoNaturezaDespesa || null,
      natureza: dados?.natureza || itemPad?.natureza || null,
      avaliacao,
      classificacao: avaliacao
        ? (avaliacao.falsoPositivoPorArredondamento ? "falso_positivo_saneavel" : "pendencia_real")
        : "dados_insuficientes",
      justificativa: avaliacao
        ? avaliacao.motivo
        : "Sem dados suficientes (quantidade, valor unitario, total previsto) para avaliar.",
    });
  }

  const saneados = avaliadas.filter((item) => item.classificacao === "falso_positivo_saneavel");
  const pendentes = avaliadas.filter((item) => item.classificacao === "pendencia_real");
  const semDados = avaliadas.filter((item) => item.classificacao === "dados_insuficientes");

  return {
    geradoEm: new Date().toISOString(),
    modo: "dry-run",
    totalInconsistenciasAvaliadas: avaliadas.length,
    totalSaneadoPorArredondamento: saneados.length,
    totalMantidoComoPendenciaReal: pendentes.length,
    totalSemDadosSuficientes: semDados.length,
    casosSaneados: saneados,
    casosPendentes: pendentes,
    casosSemDados: semDados,
    justificativaPorId: avaliadas
      .map((item) => ({ id: item.id, classificacao: item.classificacao, justificativa: item.justificativa }))
      .sort((a, b) => a.id - b.id),
    garantias: {
      decisaoRegistrada: false,
      statusAlterado: false,
      publicacaoExecutada: false,
      origemAtivaAlterada: false,
      planoAplicacaoOficialAlterado: false,
      frontendDataPublicadosAlterado: false,
      sqliteAlterado: false,
    },
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

  const inc = relatorio.inconsistenciasQuantidadeValorUnitario;
  if (inc) {
    linhas.push("");
    linhas.push("## Inconsistencias quantidade x valor unitario (divergencias PAD)");
    linhas.push("");
    linhas.push("Auditoria somente leitura: nao registra decisao, nao altera status e nao publica.");
    linhas.push("");
    linhas.push(`- Inconsistencias avaliadas: ${inc.totalInconsistenciasAvaliadas}`);
    linhas.push(`- Saneadas por arredondamento do valor unitario exibido: ${inc.totalSaneadoPorArredondamento}`);
    linhas.push(`- Mantidas como pendencia real: ${inc.totalMantidoComoPendenciaReal}`);
    linhas.push(`- Sem dados suficientes: ${inc.totalSemDadosSuficientes}`);
    linhas.push("");
    linhas.push("Regra: a diferenca e falso positivo quando o valor unitario exibido coincide com o "
      + "unitario efetivo (valor previsto informado / quantidade) arredondado para 2 casas e a "
      + "diferenca absoluta esta dentro de quantidade x 0,005 + 0,01. O total previsto informado "
      + "pelo PAD prevalece.");
    linhas.push("");
    linhas.push("### Casos saneados por arredondamento");
    linhas.push("");
    if (!inc.casosSaneados.length) {
      linhas.push("Nenhum.");
    } else {
      linhas.push("| ID | Convenio/UF | Linha PAD | Descricao | Qtd | VU exibido | VU efetivo | Previsto informado | Calculo exibido | Diff | Tolerancia |");
      linhas.push("|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|");
      for (const item of inc.casosSaneados) {
        const a = item.avaliacao;
        linhas.push(`| ${item.id} | ${item.numeroConvenio || "-"}/${item.uf || "-"} | ${item.linhaPad ?? "-"} | `
          + `${String(item.descricao || "-").replace(/\|/g, "/")} | ${a.quantidade} | ${a.valorUnitarioExibido} | `
          + `${a.valorUnitarioEfetivoArredondado} | ${a.valorPrevistoInformado} | ${a.valorCalculadoComUnitarioExibido} | `
          + `${a.diferencaAbsoluta} | ${a.toleranciaMaxima} |`);
      }
    }
    linhas.push("");
    linhas.push("### Casos mantidos como pendencia real");
    linhas.push("");
    if (!inc.casosPendentes.length) {
      linhas.push("Nenhum.");
    } else {
      linhas.push("| ID | Convenio/UF | Linha PAD | Descricao | Motivo |");
      linhas.push("|---:|---|---:|---|---|");
      for (const item of inc.casosPendentes) {
        linhas.push(`| ${item.id} | ${item.numeroConvenio || "-"}/${item.uf || "-"} | ${item.linhaPad ?? "-"} | `
          + `${String(item.descricao || "-").replace(/\|/g, "/")} | ${String(item.justificativa).replace(/\|/g, "/")} |`);
      }
    }
    linhas.push("");
    linhas.push("### Justificativa por ID");
    linhas.push("");
    for (const item of inc.justificativaPorId) {
      linhas.push(`- #${item.id} (${item.classificacao}): ${item.justificativa}`);
    }
  }

  return `${linhas.join("\n")}\n`;
}

function executar() {
  exigirConfirmacaoAuditoriaSqliteLegado("auditar-quantidades-suspeitas-profor-2022");
  const repoRoot = path.resolve(__dirname, "../..");
  const caminhoJson = path.join(repoRoot, CAMINHO_JSON);
  const caminhoMd = path.join(repoRoot, CAMINHO_MD);
  const registros = obterRegistrosRateio();
  const suspeitos = registros
    .map(avaliarRegistro)
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.diferencaFechamentoValor) - Math.abs(a.diferencaFechamentoValor));

  const inconsistencias = auditarInconsistenciasQuantidadeValorUnitario(repoRoot);
  const relatorio = {
    resumo: gerarResumo(suspeitos, registros.length),
    suspeitos,
    inconsistenciasQuantidadeValorUnitario: inconsistencias,
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
  console.log(`Inconsistencias quantidade x valor unitario avaliadas: ${inconsistencias.totalInconsistenciasAvaliadas}`);
  console.log(`  Saneadas por arredondamento: ${inconsistencias.totalSaneadoPorArredondamento}`);
  console.log(`  Mantidas como pendencia real: ${inconsistencias.totalMantidoComoPendenciaReal}`);
  console.log(`  Sem dados suficientes: ${inconsistencias.totalSemDadosSuficientes}`);
}

try {
  executar();
} catch (erro) {
  console.error("Falha ao auditar quantidades suspeitas do PROFOR 2022.");
  console.error(erro?.stack || erro?.message || erro);
  process.exit(1);
}

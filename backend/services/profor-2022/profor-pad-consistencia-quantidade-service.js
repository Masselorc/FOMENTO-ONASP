/**
 * Avaliacao central de inconsistencia quantidade x valor unitario no PAD 2022.
 *
 * O relatorio PAD exibe o valor unitario arredondado para 2 casas. Quando o
 * valor previsto informado nao e multiplo exato do unitario exibido, surge o
 * alerta `quantidade_valor_unitario_inconsistente`. Na maioria dos casos a
 * diferenca e apenas o arredondamento do unitario exibido — nao ha divergencia
 * material: o total previsto informado pelo PAD continua sendo a fonte de
 * verdade. Este servico distingue esse falso positivo de uma divergencia real.
 */

// Tolerancia por arredondamento: cada linha do total pode oscilar ate meio
// centavo do unitario exibido, mais uma margem tecnica minima de 1 centavo
// para cobrir o arredondamento do proprio total previsto.
const TOLERANCIA_ARREDONDAMENTO_POR_UNIDADE = 0.005;
const MARGEM_TECNICA_MINIMA = 0.01;

function arredondar2(valor) {
  return Math.round(((Number(valor) || 0) + Number.EPSILON) * 100) / 100;
}

function numeroFinito(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * Avalia uma inconsistencia quantidade x valor unitario.
 *
 * Entrada: { quantidade, valorUnitarioExibido, valorPrevistoInformado }.
 * Retorna o diagnostico completo, ou null quando faltam dados utilizaveis.
 *
 * Regra de falso positivo (arredondamento do unitario exibido):
 *  - o unitario exibido e igual ao valor unitario efetivo
 *    (valorPrevistoInformado / quantidade) arredondado para 2 casas; e
 *  - a diferenca absoluta entre o calculo exibido e o total informado esta
 *    dentro de quantidade * 0,005 + 0,01.
 * Fora dessa tolerancia, ha diferenca material e o caso permanece pendente.
 */
function avaliarConsistenciaQuantidadeValorUnitario(entrada = {}) {
  const quantidade = numeroFinito(entrada.quantidade);
  const valorUnitarioExibido = numeroFinito(entrada.valorUnitarioExibido);
  const valorPrevistoInformado = numeroFinito(entrada.valorPrevistoInformado);

  if (quantidade === null || valorUnitarioExibido === null || valorPrevistoInformado === null) {
    return null;
  }
  if (quantidade <= 0 || valorUnitarioExibido <= 0) {
    return null;
  }

  const valorCalculadoComUnitarioExibido = arredondar2(quantidade * valorUnitarioExibido);
  const valorUnitarioEfetivo = valorPrevistoInformado / quantidade;
  const valorUnitarioEfetivoArredondado = arredondar2(valorUnitarioEfetivo);
  const diferencaAbsoluta = arredondar2(
    Math.abs(valorCalculadoComUnitarioExibido - valorPrevistoInformado)
  );
  const toleranciaMaxima = arredondar2(
    quantidade * TOLERANCIA_ARREDONDAMENTO_POR_UNIDADE + MARGEM_TECNICA_MINIMA
  );

  const unitarioExibidoBateComEfetivo =
    arredondar2(valorUnitarioExibido) === valorUnitarioEfetivoArredondado;
  const dentroDaTolerancia = diferencaAbsoluta <= toleranciaMaxima;
  const falsoPositivoPorArredondamento = unitarioExibidoBateComEfetivo && dentroDaTolerancia;

  let classificacao;
  let motivo;
  if (falsoPositivoPorArredondamento) {
    classificacao = "falso_positivo_saneavel";
    motivo = "Diferenca explicada pelo arredondamento do valor unitario exibido para 2 casas: "
      + `unitario exibido (${valorUnitarioExibido}) coincide com o unitario efetivo arredondado `
      + `(${valorUnitarioEfetivoArredondado}); diferenca ${diferencaAbsoluta} dentro da tolerancia `
      + `${toleranciaMaxima}. O total previsto informado pelo PAD prevalece.`;
  } else if (!unitarioExibidoBateComEfetivo) {
    classificacao = "pendencia_real";
    motivo = `Valor unitario exibido (${valorUnitarioExibido}) nao corresponde ao unitario efetivo `
      + `arredondado (${valorUnitarioEfetivoArredondado}); diferenca nao e apenas de arredondamento.`;
  } else {
    classificacao = "pendencia_real";
    motivo = `Diferenca absoluta ${diferencaAbsoluta} excede a tolerancia de arredondamento `
      + `${toleranciaMaxima}; tratar como diferenca material.`;
  }

  return {
    quantidade,
    valorUnitarioExibido,
    valorPrevistoInformado: arredondar2(valorPrevistoInformado),
    valorCalculadoComUnitarioExibido,
    valorUnitarioEfetivo: Math.round((valorUnitarioEfetivo + Number.EPSILON) * 1e6) / 1e6,
    valorUnitarioEfetivoArredondado,
    diferencaAbsoluta,
    toleranciaMaxima,
    unitarioExibidoBateComEfetivo,
    dentroDaTolerancia,
    falsoPositivoPorArredondamento,
    classificacao,
    motivo,
    totalPadPrevalece: true,
  };
}

// Extrai quantidade, valor unitario e total previsto do texto padrao do alerta
// PAD: "Quantidade (Q) x valor unitario (VU) = ..., diverge do valor total
// previsto informado (VP)." Permite avaliar divergencias ja persistidas cujo
// payload so traz o texto.
function extrairDadosDoTextoAlerta(texto) {
  if (!texto) return null;
  const match = String(texto).match(
    /Quantidade\s*\(([-\d.,]+)\)\s*x\s*valor unit[aá]rio\s*\(([-\d.,]+)\).*?valor total previsto informado\s*\(([-\d.,]+)\)/i
  );
  if (!match) return null;
  const parse = (valor) => {
    const limpo = String(valor).replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  };
  const quantidade = parse(match[1]);
  const valorUnitarioExibido = parse(match[2]);
  const valorPrevistoInformado = parse(match[3]);
  if (quantidade === null || valorUnitarioExibido === null || valorPrevistoInformado === null) {
    return null;
  }
  return { quantidade, valorUnitarioExibido, valorPrevistoInformado };
}

/** Avalia uma divergencia quantidade_valor_unitario_inconsistente ja persistida. */
function avaliarDivergenciaQuantidadeValorUnitario(divergencia = {}) {
  const payload = divergencia.payload || {};
  // Preferencia: dados estruturados gravados no alerta; fallback: texto.
  const dadosEstruturados = payload.dadosConsistencia
    || payload.alertasOriginais?.[0]?.dados
    || null;
  let entrada = null;
  if (dadosEstruturados
    && Number.isFinite(Number(dadosEstruturados.quantidade))
    && Number.isFinite(Number(dadosEstruturados.valorUnitarioExibido ?? dadosEstruturados.valorUnitario))
    && Number.isFinite(Number(dadosEstruturados.valorPrevistoInformado ?? dadosEstruturados.valorPrevisto))) {
    entrada = {
      quantidade: Number(dadosEstruturados.quantidade),
      valorUnitarioExibido: Number(dadosEstruturados.valorUnitarioExibido ?? dadosEstruturados.valorUnitario),
      valorPrevistoInformado: Number(dadosEstruturados.valorPrevistoInformado ?? dadosEstruturados.valorPrevisto),
    };
  } else {
    const texto = [
      divergencia.diferenca,
      payload.diferenca,
      payload.evidencias?.detalhe,
      payload.alertasOriginais?.[0]?.detalhe,
    ].filter(Boolean).join(" ");
    entrada = extrairDadosDoTextoAlerta(texto);
  }
  if (!entrada) return null;
  return avaliarConsistenciaQuantidadeValorUnitario(entrada);
}

module.exports = {
  TOLERANCIA_ARREDONDAMENTO_POR_UNIDADE,
  MARGEM_TECNICA_MINIMA,
  avaliarConsistenciaQuantidadeValorUnitario,
  extrairDadosDoTextoAlerta,
  avaliarDivergenciaQuantidadeValorUnitario,
};

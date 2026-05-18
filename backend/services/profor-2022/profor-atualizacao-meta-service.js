// Metadados seguros de ultima atualizacao operacional PROFOR 2022.
// Usado pelo endpoint /api/profor-2022/atualizacao/status (modo local/API)
// e pela publicacao estatica (modo GitHub Pages), garantindo um unico
// calculo da "data/hora mais recente" entre DETRU e Transferegov/rendimentos.
//
// Nao expoe URLs internas, cookies, HAR, HTML bruto ou caminhos sensiveis.

const { obterUltimaAtualizacaoDetru } = require("./profor-detru-cache-service");
const { obterUltimaConsultaRendimentos } = require("./transferegov-rendimentos-cache-service");

function comoTimestamp(iso) {
  if (!iso) return null;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}

function extrairDataHoraDetru(registro) {
  if (!registro) return null;
  return (
    registro.concluidoEm ||
    registro.concluido_em ||
    registro.iniciadoEm ||
    registro.iniciado_em ||
    null
  );
}

function extrairDataHoraRendimentos(registro) {
  if (!registro) return null;
  return (
    registro.concluidoEm ||
    registro.concluido_em ||
    registro.iniciadoEm ||
    registro.iniciado_em ||
    null
  );
}

function calcularUltimaAtualizacaoDadosProfor2022(ultimaDetru, ultimaRendimentos) {
  const detruIso = extrairDataHoraDetru(ultimaDetru);
  const rendimentosIso = extrairDataHoraRendimentos(ultimaRendimentos);

  const tsDetru = comoTimestamp(detruIso);
  const tsRendimentos = comoTimestamp(rendimentosIso);

  let dataHora = null;
  let fonte = null;
  if (tsDetru !== null && tsRendimentos !== null) {
    if (tsRendimentos >= tsDetru) {
      dataHora = rendimentosIso;
      fonte = "Transferegov/rendimentos";
    } else {
      dataHora = detruIso;
      fonte = "DETRU";
    }
  } else if (tsDetru !== null) {
    dataHora = detruIso;
    fonte = "DETRU";
  } else if (tsRendimentos !== null) {
    dataHora = rendimentosIso;
    fonte = "Transferegov/rendimentos";
  }

  return {
    dataHora,
    fonte,
    fontesConsideradas: {
      detru: detruIso,
      rendimentos: rendimentosIso,
    },
  };
}

function obterUltimaAtualizacaoDadosProfor2022() {
  let detru = null;
  try {
    detru = obterUltimaAtualizacaoDetru();
  } catch (_err) {
    detru = null;
  }

  let rendimentos = null;
  try {
    rendimentos = obterUltimaConsultaRendimentos();
  } catch (_err) {
    rendimentos = null;
  }

  return calcularUltimaAtualizacaoDadosProfor2022(detru, rendimentos);
}

module.exports = {
  calcularUltimaAtualizacaoDadosProfor2022,
  obterUltimaAtualizacaoDadosProfor2022,
};

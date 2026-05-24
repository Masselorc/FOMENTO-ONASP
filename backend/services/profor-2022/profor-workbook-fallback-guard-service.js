// Guards centralizados para rotinas sensíveis PROFOR 2022. Concentra a lógica de:
//
// 1. Detecção de ambiente de produção (FOMENTO_AMBIENTE, NODE_ENV, APP_ENV, AMBIENTE).
// 2. Governança de endpoints administrativos, chamadas externas e agendadores.
//
// Esses guards são chamados em pontos de entrada operacionais (server.js,
// scripts sensíveis). Não acessam banco, não publicam e não chamam serviços
// externos. São puros sobre `process.env`.

const VALORES_PRODUCAO_NODE_ENV = new Set(["production", "prod"]);
const VALORES_PRODUCAO_APP_ENV = new Set(["production", "prod", "producao"]);
const VALORES_PRODUCAO_AMBIENTE = new Set(["producao", "production", "prod"]);
const VALORES_TESTE = new Set(["test", "teste", "testing"]);

function normalizarValorEnv(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isAmbienteProducao(env = process.env) {
  const fomentoAmbiente = normalizarValorEnv(env.FOMENTO_AMBIENTE);
  const nodeEnv = normalizarValorEnv(env.NODE_ENV);
  const appEnv = normalizarValorEnv(env.APP_ENV);
  const ambiente = normalizarValorEnv(env.AMBIENTE);
  if (fomentoAmbiente && VALORES_PRODUCAO_AMBIENTE.has(fomentoAmbiente)) return true;
  if (nodeEnv && VALORES_PRODUCAO_NODE_ENV.has(nodeEnv)) return true;
  if (appEnv && VALORES_PRODUCAO_APP_ENV.has(appEnv)) return true;
  if (ambiente && VALORES_PRODUCAO_AMBIENTE.has(ambiente)) return true;
  return false;
}

function isAmbienteTeste(env = process.env) {
  const fomentoAmbiente = normalizarValorEnv(env.FOMENTO_AMBIENTE);
  const nodeEnv = normalizarValorEnv(env.NODE_ENV);
  const appEnv = normalizarValorEnv(env.APP_ENV);
  const ambiente = normalizarValorEnv(env.AMBIENTE);
  return [fomentoAmbiente, nodeEnv, appEnv, ambiente].some((valor) => VALORES_TESTE.has(valor));
}

function flagAtiva(env, nome) {
  return normalizarValorEnv(env[nome]) === "1";
}

function erroGovernanca(mensagem, statusCode = 403) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
}

function assertEndpointAdminPermitido(contexto = "endpoint_admin", opcoes = {}) {
  const env = opcoes.env || process.env;
  if (isAmbienteProducao(env)) {
    throw erroGovernanca(
      `[${contexto}] Endpoint administrativo PROFOR 2022 bloqueado em produção. ` +
        `ALLOW_PROFOR_2022_ADMIN_ENDPOINTS não libera endpoints administrativos em produção.`
    );
  }

  if (isAmbienteTeste(env)) {
    throw erroGovernanca(
      `[${contexto}] Endpoint administrativo PROFOR 2022 bloqueado em ambiente de teste.`
    );
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_ADMIN_ENDPOINTS")) return;

  throw erroGovernanca(
    `[${contexto}] Endpoint administrativo PROFOR 2022 bloqueado. ` +
      `Para execução local controlada, defina ALLOW_PROFOR_2022_ADMIN_ENDPOINTS=1.`
  );
}

function assertChamadaExternaPermitida(contexto = "chamada_externa", opcoes = {}) {
  const env = opcoes.env || process.env;
  const tipo = opcoes.tipo || "DETRU/Transferegov";

  if (isAmbienteProducao(env)) {
    throw erroGovernanca(
      `[${contexto}] Chamada externa ${tipo} bloqueada por política de governança em produção. ` +
        `ALLOW_PROFOR_2022_EXTERNAL_CALLS não libera chamadas externas em produção.`
    );
  }

  if (isAmbienteTeste(env)) {
    throw erroGovernanca(
      `[${contexto}] Chamada externa ${tipo} bloqueada por política de governança em teste.`
    );
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_EXTERNAL_CALLS")) return;

  throw erroGovernanca(
    `[${contexto}] Chamada externa ${tipo} bloqueada por política de governança. ` +
      `Para execução local controlada, defina ALLOW_PROFOR_2022_EXTERNAL_CALLS=1.`
  );
}

function assertAgendadorPermitido(contexto = "agendador", opcoes = {}) {
  const env = opcoes.env || process.env;

  if (isAmbienteProducao(env)) {
    throw erroGovernanca(
      `[${contexto}] Agendador PROFOR 2022 bloqueado em produção. ` +
        `ALLOW_PROFOR_2022_SCHEDULER não libera agendador em produção.`
    );
  }

  if (isAmbienteTeste(env)) {
    throw erroGovernanca(`[${contexto}] Agendador PROFOR 2022 bloqueado em ambiente de teste.`);
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_SCHEDULER")) return;

  throw erroGovernanca(
    `[${contexto}] Agendador PROFOR 2022 bloqueado. Para execução local controlada, ` +
      `defina ALLOW_PROFOR_2022_SCHEDULER=1.`
  );
}

module.exports = {
  isAmbienteProducao,
  isAmbienteTeste,
  assertEndpointAdminPermitido,
  assertChamadaExternaPermitida,
  assertAgendadorPermitido,
};

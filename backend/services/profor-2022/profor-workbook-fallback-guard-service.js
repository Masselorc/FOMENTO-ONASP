// Guards centralizados para uso legado de workbook (planilha antiga) e para o
// orquestrador `atualizar:profor-2022`. Concentra a lógica de:
//
// 1. Detecção de ambiente de produção (FOMENTO_AMBIENTE, NODE_ENV, APP_ENV, AMBIENTE).
// 2. Bloqueio do fallback de workbook quando a origem ativa é `reconstrucao-pad`
//    e a flag `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` não está explicitamente
//    em `1`. Em produção, a flag não libera — falha sempre.
// 3. Bloqueio do orquestrador legado `atualizar:profor-2022` (que aciona
//    Transferegov) salvo se `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1` estiver
//    setado. Em produção, a flag não libera — falha sempre.
// 4. Governança de endpoints dev/admin, chamadas externas e agendadores.
//
// Esses guards são chamados em pontos de entrada operacionais (server.js,
// script de orquestração). Não acessam banco, não publicam, não chamam serviços
// externos. São puros sobre `process.env` e `resolverOrigemDadosProfor2022`.

const { resolverOrigemDadosProfor2022 } = require("./profor-origem-service");

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

// Bloqueia leitura de workbook quando a origem ativa é `reconstrucao-pad`,
// salvo se `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1`. Em produção, a flag NÃO
// libera. Em `planilha` e `banco-cache`, não age (fluxo legado preservado).
function assertWorkbookFallbackPermitido(contexto = "workbook", opcoes = {}) {
  const env = opcoes.env || process.env;
  const origemAtiva = opcoes.origemAtiva
    || resolverOrigemDadosProfor2022({ origemDados: opcoes.origemDados });
  if (origemAtiva !== "reconstrucao-pad") return;

  if (isAmbienteProducao(env)) {
    throw new Error(
      `[${contexto}] Leitura de workbook PROIBIDA em produção: origem ativa ` +
        `PROFOR_2022_ORIGEM_DADOS=${origemAtiva}. ALLOW_PROFOR_2022_WORKBOOK_FALLBACK ` +
        `não libera workbook em produção. Para inspeção, use ambiente de desenvolvimento.`
    );
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_WORKBOOK_FALLBACK")) return;

  throw new Error(
    `[${contexto}] Leitura de workbook bloqueada: origem ativa PROFOR_2022_ORIGEM_DADOS=` +
      `${origemAtiva}, mas o caminho local ainda lê a planilha antiga. ` +
      `Para uso temporário em desenvolvimento, defina ALLOW_PROFOR_2022_WORKBOOK_FALLBACK=1 ` +
      `na sessão do servidor; em produção, descontinuar o caminho de workbook.`
  );
}

// Bloqueia execução do orquestrador legado `atualizar:profor-2022` (que aciona
// Transferegov e lê workbook via carregarPlanoAplicacaoLocal). Em produção,
// falha sempre. Em desenvolvimento, exige `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1`.
function assertOrquestradorLegadoPermitido(contexto = "orquestrador_atualizacao", opcoes = {}) {
  const env = opcoes.env || process.env;
  if (isAmbienteProducao(env)) {
    throw new Error(
      `[${contexto}] Execução do orquestrador legado 'atualizar:profor-2022' PROIBIDA em ` +
        `produção: aciona Transferegov e lê workbook. ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO ` +
        `não libera em produção. Use o fluxo PAD/reconstrução.`
    );
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO")) return;

  throw new Error(
    `[${contexto}] Orquestrador legado 'atualizar:profor-2022' está em descontinuação. ` +
      `Para execução pontual em desenvolvimento, defina ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1; ` +
      `em produção, o fluxo PAD/reconstrução é obrigatório.`
  );
}

// Endpoints de desenvolvimento/auditoria não são fluxo operacional. Em
// produção são sempre bloqueados; em desenvolvimento exigem liberação explícita.
function assertEndpointDevPermitido(contexto = "endpoint_dev", opcoes = {}) {
  const env = opcoes.env || process.env;
  if (isAmbienteProducao(env)) {
    const erro = erroGovernanca(
      `[${contexto}] Endpoint dev/auditoria bloqueado em produção. ` +
        `ALLOW_PROFOR_2022_ENDPOINTS_DEV não libera endpoints dev em produção.`
    );
    throw erro;
  }

  if (flagAtiva(env, "ALLOW_PROFOR_2022_ENDPOINTS_DEV")) return;

  const erro = erroGovernanca(
    `[${contexto}] Endpoint dev/auditoria bloqueado. Para auditoria local controlada, ` +
      `defina ALLOW_PROFOR_2022_ENDPOINTS_DEV=1 em ambiente de desenvolvimento.`
  );
  throw erro;
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
  assertWorkbookFallbackPermitido,
  assertOrquestradorLegadoPermitido,
  assertEndpointDevPermitido,
  assertEndpointAdminPermitido,
  assertChamadaExternaPermitida,
  assertAgendadorPermitido,
};

// Guards centralizados para uso legado de workbook (planilha antiga) e para o
// orquestrador `atualizar:profor-2022`. Concentra a lógica de:
//
// 1. Detecção de ambiente de produção (NODE_ENV, APP_ENV, AMBIENTE).
// 2. Bloqueio do fallback de workbook quando a origem ativa é `reconstrucao-pad`
//    e a flag `ALLOW_PROFOR_2022_WORKBOOK_FALLBACK` não está explicitamente
//    em `1`. Em produção, a flag não libera — falha sempre.
// 3. Bloqueio do orquestrador legado `atualizar:profor-2022` (que aciona
//    Transferegov) salvo se `ALLOW_PROFOR_2022_ORQUESTRADOR_LEGADO=1` estiver
//    setado. Em produção, a flag não libera — falha sempre.
//
// Esses guards são chamados em pontos de entrada operacionais (server.js,
// script de orquestração). Não acessam banco, não publicam, não chamam serviços
// externos. São puros sobre `process.env` e `resolverOrigemDadosProfor2022`.

const { resolverOrigemDadosProfor2022 } = require("./profor-origem-service");

const VALORES_PRODUCAO_NODE_ENV = new Set(["production", "prod"]);
const VALORES_PRODUCAO_APP_ENV = new Set(["production", "prod", "producao"]);
const VALORES_PRODUCAO_AMBIENTE = new Set(["producao", "production", "prod"]);

function normalizarValorEnv(valor) {
  return String(valor || "").trim().toLowerCase();
}

function isAmbienteProducao(env = process.env) {
  const nodeEnv = normalizarValorEnv(env.NODE_ENV);
  const appEnv = normalizarValorEnv(env.APP_ENV);
  const ambiente = normalizarValorEnv(env.AMBIENTE);
  if (nodeEnv && VALORES_PRODUCAO_NODE_ENV.has(nodeEnv)) return true;
  if (appEnv && VALORES_PRODUCAO_APP_ENV.has(appEnv)) return true;
  if (ambiente && VALORES_PRODUCAO_AMBIENTE.has(ambiente)) return true;
  return false;
}

function flagAtiva(env, nome) {
  return normalizarValorEnv(env[nome]) === "1";
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

module.exports = {
  isAmbienteProducao,
  assertWorkbookFallbackPermitido,
  assertOrquestradorLegadoPermitido,
};

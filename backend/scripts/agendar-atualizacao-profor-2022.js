// Agendador diario da rotina operacional consolidada PROFOR 2022.
// Uso: node backend/scripts/agendar-atualizacao-profor-2022.js
// Le PROFOR_2022_ATUALIZACAO_DIARIA_HORA (.env), com fallback "12:00".
// Deve rodar como processo separado — nao e iniciado pelo npm start.
// NAO publica dados estaticos. NAO altera JSONs publicados.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const {
  assertAgendadorPermitido,
} = require("../services/profor-2022/profor-workbook-fallback-guard-service");

let inicializarBanco;
let atualizarProfor2022Consolidado;
let resumirAtualizacaoConsolidada;

function carregarDependenciasOperacionais() {
  if (inicializarBanco) return;
  ({ inicializarBanco } = require("../db/init-db"));
  ({
    atualizarProfor2022Consolidado,
    resumirAtualizacaoConsolidada,
  } = require("../services/profor-2022/profor-atualizacao-consolidada-service"));
}

function bloquearSeNaoAutorizado() {
  try {
    assertAgendadorPermitido("script_agendar_atualizacao_profor_2022");
  } catch (erro) {
    console.error(erro?.message || erro);
    process.exit(2);
  }
}

const HORARIO_PADRAO = "12:00";

function parsearHora(horaStr) {
  const valor = (horaStr === undefined || horaStr === null || horaStr === "" ? HORARIO_PADRAO : String(horaStr));
  const [hhStr, mmStr] = valor.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const hora = Number.isFinite(hh) ? Math.min(Math.max(hh, 0), 23) : 12;
  const minuto = Number.isFinite(mm) ? Math.min(Math.max(mm, 0), 59) : 0;
  return { hora, minuto };
}

function calcularProximoDisparo(hora, minuto) {
  const agora = new Date();
  const proximo = new Date(agora);
  proximo.setHours(hora, minuto, 0, 0);
  if (proximo <= agora) {
    proximo.setDate(proximo.getDate() + 1);
  }
  return proximo;
}

function formatarData(data) {
  return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function executarCiclo() {
  carregarDependenciasOperacionais();
  console.log(`[${new Date().toISOString()}] Iniciando atualizacao consolidada PROFOR 2022...`);
  try {
    const resultado = await atualizarProfor2022Consolidado();
    console.log(resumirAtualizacaoConsolidada(resultado));
  } catch (err) {
    console.error(`[PROFOR 2022] Falha na atualizacao consolidada: ${err?.message || err}`);
  }
}

function agendarProximaExecucao(hora, minuto) {
  const proximo = calcularProximoDisparo(hora, minuto);
  const msAte = proximo.getTime() - Date.now();
  console.log(
    `[PROFOR 2022] Proxima atualizacao agendada: ${formatarData(proximo)}` +
      ` (em ${Math.round(msAte / 60000)} min).`
  );
  setTimeout(async () => {
    await executarCiclo();
    agendarProximaExecucao(hora, minuto);
  }, msAte);
}

function iniciar() {
  bloquearSeNaoAutorizado();
  carregarDependenciasOperacionais();
  inicializarBanco();

  const { hora, minuto } = parsearHora(process.env.PROFOR_2022_ATUALIZACAO_DIARIA_HORA);
  console.log(
    `[PROFOR 2022] Agendador iniciado. Horario diario configurado: ` +
      `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`
  );
  agendarProximaExecucao(hora, minuto);
}

iniciar();

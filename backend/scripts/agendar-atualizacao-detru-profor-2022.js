// Agendador de atualização diária do cache DETRU para PROFOR 2022.
// Uso: node backend/scripts/agendar-atualizacao-detru-profor-2022.js
// Lê DETRU_ATUALIZACAO_DIARIA_HORA (.env) ou backend/data/aplicacao.json para definir o horário.
// Deve ser executado como processo separado — não é iniciado automaticamente pelo npm start.
// Mantém o processo ativo e agenda a próxima execução após cada ciclo.

const path = require("path");
const { inicializarBanco } = require("../db/init-db");
const { cruzarCarteiraComDetru, resumirCruzamentoDetru } = require("../services/profor-2022/profor-detru-sync-service");
const {
  calcularHashArquivo,
  salvarSnapshotDetru,
  registrarAtualizacaoDetruInicio,
  registrarAtualizacaoDetruFim,
  registrarAtualizacaoDetruErro,
} = require("../services/profor-2022/profor-detru-cache-service");
const {
  obterConfiguracaoDetru,
  garantirArquivoDetruAtualizado,
} = require("../services/profor-2022/detru-download-service");

function parsearHora(horaStr) {
  const [hh, mm] = (horaStr || "06:00").split(":").map(Number);
  const hora = Number.isFinite(hh) ? Math.min(Math.max(hh, 0), 23) : 6;
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

async function executarAtualizacao() {
  console.log(`[${new Date().toISOString()}] Iniciando atualização agendada do cache DETRU...`);

  let caminhoZip;
  try {
    const resultado = await garantirArquivoDetruAtualizado();
    caminhoZip = resultado.caminho;
  } catch (err) {
    console.error(`[DETRU] Falha ao obter arquivo: ${err.message}`);
    return;
  }

  const arquivoHash = calcularHashArquivo(caminhoZip);
  const idAtualizacao = registrarAtualizacaoDetruInicio({
    caminhoArquivo: caminhoZip,
    arquivoHash,
  });

  try {
    const resultado = cruzarCarteiraComDetru(caminhoZip);
    console.log(resumirCruzamentoDetru(resultado));
    const totalSalvos = salvarSnapshotDetru(resultado, {
      arquivoOrigem: caminhoZip,
      arquivoHash,
    });
    registrarAtualizacaoDetruFim(idAtualizacao, resultado);
    console.log(`[DETRU] Cache atualizado: ${totalSalvos} convênio(s) gravado(s).`);
  } catch (err) {
    registrarAtualizacaoDetruErro(idAtualizacao, err);
    console.error(`[DETRU] Falha na atualização: ${err.message}`);
  }
}

function agendarProximaExecucao(hora, minuto) {
  const proximo = calcularProximoDisparo(hora, minuto);
  const msAte = proximo.getTime() - Date.now();
  console.log(`[DETRU] Próxima atualização agendada para: ${formatarData(proximo)} (em ${Math.round(msAte / 60000)} min)`);

  setTimeout(async () => {
    await executarAtualizacao();
    agendarProximaExecucao(hora, minuto);
  }, msAte);
}

function iniciar() {
  inicializarBanco();

  const config = obterConfiguracaoDetru();
  const { hora, minuto } = parsearHora(config.horaAtualizacaoDiaria);

  console.log(`[DETRU] Agendador iniciado. Horário diário configurado: ${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`);

  if (!config.url) {
    console.warn(
      "[DETRU] Aviso: DETRU_SICONV_CONVENIO_URL não configurada. " +
      "O agendador usará o arquivo local. Configure a URL para download automático."
    );
  }

  agendarProximaExecucao(hora, minuto);
}

iniciar();

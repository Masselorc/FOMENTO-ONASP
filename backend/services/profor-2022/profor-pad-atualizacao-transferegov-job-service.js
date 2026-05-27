const crypto = require("node:crypto");

const {
  atualizarPadsTransferegovEOperacional,
} = require("./profor-pad-atualizacao-transferegov-orquestrador-service");

const MAX_EVENTOS_RETIDOS = 200;

class GerenciadorAtualizacaoTransferegov {
  constructor() {
    this.atualPorChave = new Map(); // chave -> jobId em execução
    this.jobs = new Map();          // jobId -> job
  }

  novoJobId() {
    return `atualizacao-pad-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  }

  obter(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Inicia um job de atualização. Garante exclusividade por chave (default
   * "global"): se já houver um job em andamento, retorna o existente sem
   * iniciar outro.
   *
   * @returns {{ jobId: string, jaEstavaEmAndamento: boolean, job: Object }}
   */
  iniciar(opcoes = {}) {
    const chave = opcoes.chave || "global";
    const jobIdAtual = this.atualPorChave.get(chave);
    if (jobIdAtual && this.jobs.has(jobIdAtual)) {
      const existente = this.jobs.get(jobIdAtual);
      if (existente.status === "em_andamento") {
        return { jobId: jobIdAtual, jaEstavaEmAndamento: true, job: this.publico(existente) };
      }
    }

    const jobId = this.novoJobId();
    const job = {
      jobId,
      chave,
      status: "em_andamento",
      fase: "iniciando",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      concluidoEm: null,
      indiceAtual: 0,
      totalConvenios: 0,
      convenioAtual: null,
      ufAtual: null,
      mensagemAtual: "Iniciando atualização dos PADs no Transferegov.",
      eventos: [],
      resultadoRecarga: null,
      resumo: null,
      erro: null,
    };
    this.jobs.set(jobId, job);
    this.atualPorChave.set(chave, jobId);

    const orquestrador = opcoes.orquestrador || atualizarPadsTransferegovEOperacional;

    // Dispara assíncrono e captura tanto sucesso quanto falha.
    Promise.resolve()
      .then(() => orquestrador({
        repoRoot: opcoes.repoRoot,
        onProgress: (evento) => this._registrarEvento(jobId, evento),
        ...(opcoes.opcoesOrquestrador || {}),
      }))
      .then((resumo) => this._concluir(jobId, resumo))
      .catch((erro) => this._falhar(jobId, erro));

    return { jobId, jaEstavaEmAndamento: false, job: this.publico(job) };
  }

  _registrarEvento(jobId, evento) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (evento.fase) job.fase = evento.fase;
    if (Number.isFinite(evento.indice)) job.indiceAtual = evento.indice;
    if (Number.isFinite(evento.total)) job.totalConvenios = evento.total;
    if (evento.numeroConvenio !== undefined) job.convenioAtual = evento.numeroConvenio;
    if (evento.uf !== undefined) job.ufAtual = evento.uf;
    if (evento.mensagem) job.mensagemAtual = evento.mensagem;
    job.atualizadoEm = new Date().toISOString();

    const eventoArmazenado = {
      etapa: evento.etapa || null,
      fase: evento.fase || job.fase,
      indice: Number.isFinite(evento.indice) ? evento.indice : null,
      total: Number.isFinite(evento.total) ? evento.total : null,
      numeroConvenio: evento.numeroConvenio || null,
      uf: evento.uf || null,
      status: evento.status || null,
      itensExtraidos: Number.isFinite(evento.itensExtraidos) ? evento.itensExtraidos : null,
      mensagem: evento.mensagem || null,
      em: evento.em || job.atualizadoEm,
    };
    job.eventos.push(eventoArmazenado);
    if (job.eventos.length > MAX_EVENTOS_RETIDOS) {
      job.eventos.splice(0, job.eventos.length - MAX_EVENTOS_RETIDOS);
    }
  }

  _concluir(jobId, resumo) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = "concluido";
    job.fase = "concluido";
    job.concluidoEm = new Date().toISOString();
    job.atualizadoEm = job.concluidoEm;
    job.resumo = resumo || null;
    job.resultadoRecarga = (resumo && resumo.resultadoRecarga) || null;
    if (this.atualPorChave.get(job.chave) === jobId) {
      this.atualPorChave.delete(job.chave);
    }
  }

  _falhar(jobId, erro) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = "erro";
    job.fase = "erro";
    job.concluidoEm = new Date().toISOString();
    job.atualizadoEm = job.concluidoEm;
    job.erro = {
      mensagem: erro?.message || String(erro),
      stack: erro?.stack || null,
    };
    job.mensagemAtual = job.erro.mensagem;
    if (this.atualPorChave.get(job.chave) === jobId) {
      this.atualPorChave.delete(job.chave);
    }
  }

  publico(job) {
    if (!job) return null;
    return {
      jobId: job.jobId,
      status: job.status,
      fase: job.fase,
      indiceAtual: job.indiceAtual,
      totalConvenios: job.totalConvenios,
      convenioAtual: job.convenioAtual,
      ufAtual: job.ufAtual,
      mensagemAtual: job.mensagemAtual,
      criadoEm: job.criadoEm,
      atualizadoEm: job.atualizadoEm,
      concluidoEm: job.concluidoEm,
      eventos: job.eventos,
      resultadoRecarga: job.resultadoRecarga,
      resumo: job.resumo,
      erro: job.erro,
    };
  }
}

// Singleton de processo (estado em memória local).
const gerenciadorPadrao = new GerenciadorAtualizacaoTransferegov();

module.exports = {
  GerenciadorAtualizacaoTransferegov,
  gerenciadorPadrao,
};

const crypto = require("node:crypto");

const {
  atualizarPadsTransferegovEOperacional,
} = require("./profor-pad-atualizacao-transferegov-orquestrador-service");
const {
  registrarLogOperacional,
} = require("../logs-operacionais-service");
const {
  publicarDadosEstaticos,
} = require("../static-publication-service");

const MAX_EVENTOS_RETIDOS = 200;
const FASE_PUBLICACAO_ESTATICA = "publicando_dados_estaticos";

class GerenciadorAtualizacaoTransferegov {
  constructor(dependencias = {}) {
    this.atualPorChave = new Map(); // chave -> jobId em execução
    this.jobs = new Map();          // jobId -> job
    this.registrarLogOperacional = dependencias.registrarLogOperacional || registrarLogOperacional;
    this.publicarDadosEstaticos = dependencias.publicarDadosEstaticos || publicarDadosEstaticos;
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
      resultadoPublicacao: null,
      resumo: null,
      erro: null,
    };
    this.jobs.set(jobId, job);
    this.atualPorChave.set(chave, jobId);

    const orquestrador = opcoes.orquestrador || atualizarPadsTransferegovEOperacional;
    this._registrarLogSeguro({
      modulo: "profor-2022",
      tipoEvento: "profor_pad_transferegov_atualizacao_inicio",
      status: "sucesso",
      iniciadoEm: job.criadoEm,
      concluidoEm: job.criadoEm,
      resumo: "Atualização PAD/Transferegov iniciada.",
      payload: {
        jobId,
        chave,
      },
    });

    // Dispara assíncrono e captura tanto sucesso quanto falha.
    Promise.resolve()
      .then(() => orquestrador({
        repoRoot: opcoes.repoRoot,
        onProgress: (evento) => this._registrarEvento(jobId, evento),
        ...(opcoes.opcoesOrquestrador || {}),
      }))
      .then(async (resumo) => {
        this._registrarResumoParcial(jobId, resumo);
        const resultadoPublicacao = await this._publicarDadosEstaticos(jobId);
        return { ...resumo, resultadoPublicacao };
      })
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

  _registrarResumoParcial(jobId, resumo) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.resumo = resumo || null;
    job.resultadoRecarga = (resumo && resumo.resultadoRecarga) || null;
  }

  async _publicarDadosEstaticos(jobId) {
    this._registrarEvento(jobId, {
      etapa: "publicacao_estatica_inicio",
      fase: FASE_PUBLICACAO_ESTATICA,
      mensagem: "Publicando dados estáticos atualizados para a aplicação.",
    });

    const resultadoPublicacao = await this.publicarDadosEstaticos();

    this._registrarEvento(jobId, {
      etapa: "publicacao_estatica_concluida",
      fase: FASE_PUBLICACAO_ESTATICA,
      status: "sucesso",
      mensagem: "Dados estáticos publicados a partir da recarga PAD/Transferegov.",
    });
    return resultadoPublicacao;
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
    job.resultadoPublicacao = (resumo && resumo.resultadoPublicacao) || null;
    this._registrarLogSeguro({
      modulo: "profor-2022",
      tipoEvento: "profor_pad_transferegov_atualizacao_sucesso",
      status: "sucesso",
      iniciadoEm: job.criadoEm,
      concluidoEm: job.concluidoEm,
      duracaoMs: this._calcularDuracaoMs(job.criadoEm, job.concluidoEm),
      resumo: `Atualização PAD/Transferegov concluída: ${Number(resumo?.totalConveniosAtualizados || 0)} convênio(s), ${Number(resumo?.totalItensExtraidos || 0)} item(ns).`,
      payload: this._montarPayloadResumo(job, resumo),
    });
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
    this._registrarLogSeguro({
      modulo: "profor-2022",
      tipoEvento: "profor_pad_transferegov_atualizacao_erro",
      status: "falha",
      iniciadoEm: job.criadoEm,
      concluidoEm: job.concluidoEm,
      duracaoMs: this._calcularDuracaoMs(job.criadoEm, job.concluidoEm),
      resumo: `Erro na atualização PAD/Transferegov: ${job.erro.mensagem}`,
      payload: this._montarPayloadResumo(job, null, { erro: job.erro.mensagem }),
    });
    if (this.atualPorChave.get(job.chave) === jobId) {
      this.atualPorChave.delete(job.chave);
    }
  }

  _calcularDuracaoMs(iniciadoEm, concluidoEm) {
    const inicio = new Date(iniciadoEm).getTime();
    const fim = new Date(concluidoEm).getTime();
    return Number.isFinite(inicio) && Number.isFinite(fim) ? Math.max(0, fim - inicio) : null;
  }

  _montarPayloadResumo(job, resumo = null, extras = {}) {
    return {
      jobId: job.jobId,
      totalConvenios: Number(job.totalConvenios || resumo?.totalConveniosAtualizados || 0),
      totalConveniosAtualizados: Number(resumo?.totalConveniosAtualizados || 0),
      totalAptosTecnicos: Number(resumo?.totalAptosTecnicos || 0),
      totalBloqueiosTecnicos: Number(resumo?.totalBloqueiosTecnicos || 0),
      totalItensExtraidos: Number(resumo?.totalItensExtraidos || 0),
      cacheSalvo: resumo?.cacheSalvo === true,
      hashGlobal: resumo?.hashGlobal || null,
      publicacaoEstatica: resumo?.resultadoPublicacao?.success === true,
      publicadoEm: resumo?.resultadoPublicacao?.publicadoEm || null,
      duracaoMs: this._calcularDuracaoMs(job.criadoEm, job.concluidoEm || job.atualizadoEm),
      erro: extras.erro || null,
    };
  }

  _registrarLogSeguro(log) {
    Promise.resolve()
      .then(() => this.registrarLogOperacional(log))
      .catch(() => {
        // Falha de auditoria nao pode quebrar o job operacional em memória.
      });
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
      resultadoPublicacao: job.resultadoPublicacao,
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
  FASE_PUBLICACAO_ESTATICA,
};

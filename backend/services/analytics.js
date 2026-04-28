function valorNumerico(valor) {
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function moedaParaCentavos(valor) {
    return Math.round((valorNumerico(valor) + Number.EPSILON) * 100);
}

function centavosParaMoeda(centavos) {
    return centavos / 100;
}

function normalizarInstrumento(instrumento) {
    return String(instrumento || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function isFaf(item) {
    return normalizarInstrumento(item.instrumento).includes('FAF');
}

function isConvenio(item) {
    return normalizarInstrumento(item.instrumento).includes('CONV');
}

function isDoacao(item) {
    return normalizarInstrumento(item.instrumento).includes('DOA');
}

export function calcularResumoFinanceiro(data) {
    let totalRepassadoCentavos = 0;
    let totalExecutadoCentavos = 0;
    let totalDoadoCentavos = 0;

    data.forEach((item) => {
        const valorTotalCentavos = moedaParaCentavos(item.valorTotal);
        const valorExecutadoCentavos = moedaParaCentavos(item.valorExecutado);

        if (isDoacao(item)) {
            totalDoadoCentavos += valorTotalCentavos;
            return;
        }

        totalRepassadoCentavos += valorTotalCentavos;
        totalExecutadoCentavos += valorExecutadoCentavos;
    });

    return {
        totalRepassado: centavosParaMoeda(totalRepassadoCentavos),
        totalExecutado: centavosParaMoeda(totalExecutadoCentavos),
        totalDoado: centavosParaMoeda(totalDoadoCentavos),
        percentual: totalRepassadoCentavos > 0
            ? (totalExecutadoCentavos / totalRepassadoCentavos) * 100
            : 0
    };
}

export function calcularResumoInstrumentos(data) {
    const resumo = {
        convenios: {
            totalCentavos: 0,
            executadoCentavos: 0,
            ufs: new Set()
        },
        faf: {
            totalCentavos: 0,
            executadoCentavos: 0,
            ufs: new Set()
        },
        doacao: {
            totalCentavos: 0,
            executadoCentavos: 0,
            ufs: new Set()
        }
    };

    data.forEach((item) => {
        let grupo;
        if (isConvenio(item)) {
            grupo = resumo.convenios;
        } else if (isFaf(item)) {
            grupo = resumo.faf;
        } else if (isDoacao(item)) {
            grupo = resumo.doacao;
        } else {
            return;
        }

        const totalCentavos = moedaParaCentavos(item.valorTotal);
        const executadoCentavos = moedaParaCentavos(item.valorExecutado);

        grupo.totalCentavos += totalCentavos;
        grupo.executadoCentavos += executadoCentavos;

        if (item.uf && (totalCentavos > 0 || executadoCentavos > 0)) {
            grupo.ufs.add(item.uf);
        }
    });

    const finalizarResumo = (grupo) => ({
        total: centavosParaMoeda(grupo.totalCentavos),
        executado: centavosParaMoeda(grupo.executadoCentavos),
        percentual: grupo.totalCentavos > 0
            ? (grupo.executadoCentavos / grupo.totalCentavos) * 100
            : 0,
        ufs: Array.from(grupo.ufs).sort(),
        quantidadeUfs: grupo.ufs.size
    });

    return {
        convenios: finalizarResumo(resumo.convenios),
        faf: finalizarResumo(resumo.faf),
        doacao: finalizarResumo(resumo.doacao)
    };
}

export function calculateStateMetrics(uf, data) {
    const items = data.filter((item) => item.uf === uf);

    let totalRepassadoCentavos = 0;
    let totalExecutadoCentavos = 0;
    let fafValCentavos = 0;
    let fafExecCentavos = 0;
    let convValCentavos = 0;
    let convExecCentavos = 0;
    let doacValCentavos = 0;

    items.forEach((item) => {
        const val = moedaParaCentavos(item.valorTotal);
        const exec = moedaParaCentavos(item.valorExecutado);

        if (isFaf(item)) {
            fafValCentavos += val;
            fafExecCentavos += exec;
            totalRepassadoCentavos += val;
            totalExecutadoCentavos += exec;
        } else if (isConvenio(item)) {
            convValCentavos += val;
            convExecCentavos += exec;
            totalRepassadoCentavos += val;
            totalExecutadoCentavos += exec;
        } else if (isDoacao(item)) {
            doacValCentavos += val;
        }
    });

    return {
        totalRepassado: centavosParaMoeda(totalRepassadoCentavos),
        totalExecutado: centavosParaMoeda(totalExecutadoCentavos),
        execGlobal: totalRepassadoCentavos > 0
            ? (totalExecutadoCentavos / totalRepassadoCentavos) * 100
            : 0,
        fafVal: centavosParaMoeda(fafValCentavos),
        fafExec: centavosParaMoeda(fafExecCentavos),
        fafExecPct: fafValCentavos > 0 ? (fafExecCentavos / fafValCentavos) * 100 : 0,
        convVal: centavosParaMoeda(convValCentavos),
        convExec: centavosParaMoeda(convExecCentavos),
        convExecPct: convValCentavos > 0 ? (convExecCentavos / convValCentavos) * 100 : 0,
        doacVal: centavosParaMoeda(doacValCentavos)
    };
}

export function processarDadosAgregados(data) {
    let totalContratadoCentavos = 0;
    let totalExecutadoCentavos = 0;
    let totalDoadoCentavos = 0;
    const ufsSet = new Set();
    const dadosPorUF = {};

    data.forEach((item) => {
        const vTotal = moedaParaCentavos(item.valorTotal);
        const vExec = moedaParaCentavos(item.valorExecutado);

        if (item.uf) {
            ufsSet.add(item.uf);
        }

        if (!dadosPorUF[item.uf]) {
            dadosPorUF[item.uf] = {
                totalCentavos: 0,
                execCentavos: 0,
                doadoCentavos: 0,
                uf: item.uf
            };
        }

        if (isDoacao(item)) {
            totalDoadoCentavos += vTotal;
            dadosPorUF[item.uf].doadoCentavos += vTotal;
        } else {
            totalContratadoCentavos += vTotal;
            totalExecutadoCentavos += vExec;
            dadosPorUF[item.uf].totalCentavos += vTotal;
            dadosPorUF[item.uf].execCentavos += vExec;
        }
    });

    const arrayUF = Object.values(dadosPorUF).map((item) => ({
        uf: item.uf,
        total: centavosParaMoeda(item.totalCentavos),
        exec: centavosParaMoeda(item.execCentavos),
        doado: centavosParaMoeda(item.doadoCentavos),
        percentual: item.totalCentavos > 0
            ? (item.execCentavos / item.totalCentavos) * 100
            : 0
    }));

    arrayUF.sort((a, b) => b.percentual - a.percentual || b.total - a.total);

    return {
        global: {
            totalContratado: centavosParaMoeda(totalContratadoCentavos),
            totalExecutado: centavosParaMoeda(totalExecutadoCentavos),
            totalDoado: centavosParaMoeda(totalDoadoCentavos),
            percentual: totalContratadoCentavos > 0
                ? (totalExecutadoCentavos / totalContratadoCentavos) * 100
                : 0,
            ufsComExecucao: arrayUF.filter((uf) => uf.exec > 0).length
        },
        ufsUnicas: Array.from(ufsSet).sort(),
        dadosPorUF: arrayUF
    };
}

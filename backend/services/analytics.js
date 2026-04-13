export function calculateStateMetrics(uf, data) {
    const items = data.filter((item) => item.uf === uf);

    let totalRepassado = 0;
    let totalExecutado = 0;
    let fafVal = 0;
    let fafExec = 0;
    let convVal = 0;
    let convExec = 0;
    let doacVal = 0;

    items.forEach((item) => {
        const val = item.valorTotal || 0;
        const exec = item.valorExecutado || 0;
        const inst = (item.instrumento || '').toUpperCase();

        if (inst.includes('FAF')) {
            fafVal += val;
            fafExec += exec;
            totalRepassado += val;
            totalExecutado += exec;
        } else if (inst.includes('CONV')) {
            convVal += val;
            convExec += exec;
            totalRepassado += val;
            totalExecutado += exec;
        } else if (inst.includes('DOA')) {
            doacVal += val;
        }
    });

    return {
        totalRepassado,
        totalExecutado,
        execGlobal: totalRepassado > 0 ? (totalExecutado / totalRepassado) * 100 : 0,
        fafVal,
        fafExec,
        fafExecPct: fafVal > 0 ? (fafExec / fafVal) * 100 : 0,
        convVal,
        convExec,
        convExecPct: convVal > 0 ? (convExec / convVal) * 100 : 0,
        doacVal
    };
}

export function processarDadosAgregados(data) {
    let totalContratado = 0;
    let totalExecutado = 0;
    let totalDoado = 0;
    const ufsSet = new Set();
    const dadosPorUF = {};

    data.forEach((item) => {
        const vTotal = Number.parseFloat(item.valorTotal) || 0;
        const vExec = Number.parseFloat(item.valorExecutado) || 0;
        const isDoacao = (item.instrumento || '').toUpperCase().includes('DOA');

        if (item.uf) {
            ufsSet.add(item.uf);
        }

        if (!dadosPorUF[item.uf]) {
            dadosPorUF[item.uf] = { total: 0, exec: 0, doado: 0, uf: item.uf };
        }

        if (isDoacao) {
            totalDoado += vTotal;
            dadosPorUF[item.uf].doado += vTotal;
        } else {
            totalContratado += vTotal;
            totalExecutado += vExec;
            dadosPorUF[item.uf].total += vTotal;
            dadosPorUF[item.uf].exec += vExec;
        }
    });

    const arrayUF = Object.values(dadosPorUF).map((item) => ({
        ...item,
        percentual: item.total > 0 ? (item.exec / item.total) * 100 : 0
    }));

    arrayUF.sort((a, b) => b.percentual - a.percentual || b.total - a.total);

    return {
        global: {
            totalContratado,
            totalExecutado,
            totalDoado,
            percentual: totalContratado > 0 ? (totalExecutado / totalContratado) * 100 : 0,
            ufsComExecucao: arrayUF.filter((uf) => uf.exec > 0).length
        },
        ufsUnicas: Array.from(ufsSet).sort(),
        dadosPorUF: arrayUF
    };
}

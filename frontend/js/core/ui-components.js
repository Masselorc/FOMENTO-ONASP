// ============================================================================
// UI components shared by the ONASP frontend.
// ============================================================================

const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[char]);

export const UI_ICONS = {
    edit: 'fa-pen-to-square',
    save: 'fa-floppy-disk',
    cancel: 'fa-xmark',
    history: 'fa-clock-rotate-left',
    exportExcel: 'fa-file-excel',
    exportPdf: 'fa-file-pdf',
    add: 'fa-circle-plus',
    back: 'fa-arrow-left',
    warning: 'fa-triangle-exclamation',
    success: 'fa-check-circle',
    info: 'fa-circle-info',
    lock: 'fa-lock',
    search: 'fa-magnifying-glass',
    filter: 'fa-filter',
    refresh: 'fa-rotate-right'
};

export const STATUS_UI = {
    CONCLUIDO: {
        label: 'Concluído',
        classe: 'success',
        icon: 'fa-check-circle'
    },
    PENDENTE: {
        label: 'Pendente',
        classe: 'warning',
        icon: 'fa-clock'
    },
    EM_ANDAMENTO: {
        label: 'Em andamento',
        classe: 'primary',
        icon: 'fa-spinner'
    },
    VALIDAR: {
        label: 'Validar',
        classe: 'info',
        icon: 'fa-circle-question'
    },
    CRITICO: {
        label: 'Crítico',
        classe: 'danger',
        icon: 'fa-triangle-exclamation'
    },
    NAO_APLICA: {
        label: 'Não se aplica',
        classe: 'secondary',
        icon: 'fa-ban'
    }
};

export function normalizarChaveStatusUi(status) {
    const texto = String(status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();

    if (texto.includes('CONCLUID')) return 'CONCLUIDO';
    if (texto.includes('ANDAMENTO')) return 'EM_ANDAMENTO';
    if (texto.includes('VALIDAR')) return 'VALIDAR';
    if (texto.includes('CRITICO')) return 'CRITICO';
    if (texto.includes('NAO SE APLICA')) return 'NAO_APLICA';
    if (texto.includes('PENDENTE')) return 'PENDENTE';

    return 'PENDENTE';
}

export function renderStatusBadge(status, options = {}) {
    const chave = normalizarChaveStatusUi(status);
    const config = STATUS_UI[chave] || STATUS_UI.PENDENTE;
    const label = options.label || config.label;
    const extraClass = options.className || '';

    return `
        <span class="app-status-badge app-status-badge-${config.classe} ${extraClass}">
            <i class="fas ${config.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(label)}</span>
        </span>
    `;
}

export function renderActionButton({
    id = '',
    type,
    label,
    onClick,
    variant = 'outline-primary',
    size = 'sm',
    backend = false,
    disabled = false,
    title = '',
    extraClass = '',
    iconOnly = false,
    attributes = ''
}) {
    const icon = UI_ICONS[type] || 'fa-circle';
    const backendAttr = backend ? 'data-requer-backend="true"' : '';
    const disabledAttr = disabled ? 'disabled aria-disabled="true"' : '';
    const titleAttr = title ? `title="${escapeHtml(title)}"` : '';
    const onClickAttr = onClick ? `onclick="${escapeHtml(onClick)}"` : '';
    const idAttr = id ? `id="${escapeHtml(id)}"` : '';
    const labelHtml = iconOnly
        ? `<span class="visually-hidden">${escapeHtml(label)}</span>`
        : `<span>${escapeHtml(label)}</span>`;

    return `
        <button type="button"
            class="btn btn-${size} btn-${variant} ${iconOnly ? 'btn-icon-only' : 'btn-icon-text'} ${extraClass}"
            ${idAttr}
            ${onClickAttr}
            ${backendAttr}
            ${disabledAttr}
            ${titleAttr}
            ${attributes}>
            <i class="fas ${icon}" aria-hidden="true"></i>
            ${labelHtml}
        </button>
    `;
}

export function renderKpiCard({
    titulo,
    valor,
    descricao = '',
    icon = 'fa-chart-simple',
    variant = '',
    valueClass = '',
    extraClass = ''
}) {
    return `
        <div class="card kpi-card ${variant ? `kpi-card-${variant}` : ''} ${extraClass}">
            <div class="kpi-title">
                <i class="fas ${icon}" aria-hidden="true"></i>
                ${escapeHtml(titulo)}
            </div>
            <div class="kpi-value ${valueClass}">${valor}</div>
            ${descricao ? `<div class="kpi-desc">${escapeHtml(descricao)}</div>` : ''}
        </div>
    `;
}

export function renderPublicationNotice(message) {
    return `
        <div class="publication-mode-notice" role="status">
            <i class="fas ${UI_ICONS.lock}" aria-hidden="true"></i>
            <span>${escapeHtml(message)}</span>
        </div>
    `;
}

export function renderSystemModeBadge(modo, rotulo = '') {
    if (modo === 'estatico') {
        return `
            <span class="app-status-badge app-status-badge-warning">
                <i class="fas fa-lock" aria-hidden="true"></i>
                <span>${escapeHtml(rotulo || 'Publicação estática')}</span>
            </span>
        `;
    }

    if (modo === 'api') {
        return `
            <span class="app-status-badge app-status-badge-success">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <span>${escapeHtml(rotulo || 'Local')}</span>
            </span>
        `;
    }

    return `
        <span class="app-status-badge app-status-badge-secondary">
            <i class="fas fa-circle-info" aria-hidden="true"></i>
            <span>${escapeHtml(rotulo || 'Não identificado')}</span>
        </span>
    `;
}

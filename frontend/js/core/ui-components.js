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
    split: 'fa-code-branch',
    save: 'fa-floppy-disk',
    cancel: 'fa-xmark',
    delete: 'fa-trash-can',
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
    refresh: 'fa-rotate-right',
    allocate: 'fa-right-left',
    share: 'fa-share-nodes'
};

// ----------------------------------------------------------------------------
// Hierarquia de botões — Tema escuro institucional
// ----------------------------------------------------------------------------
// Cada variante mapeia para uma classe utilitária definida em frontend/css/app.css.
// O uso é opcional: chamadas existentes a .btn-primary, .btn-outline-primary e
// .btn-danger continuam funcionando com os tokens do tema escuro.
// ----------------------------------------------------------------------------
export const UI_BUTTON_VARIANTS = Object.freeze({
    action: 'btn-action',
    outline: 'btn-outline-action',
    export: 'btn-export',
    admin: 'btn-admin',
    destructive: 'btn-destructive'
});

export function classeBotaoUi(variant) {
    return UI_BUTTON_VARIANTS[variant] || UI_BUTTON_VARIANTS.action;
}

export function renderBotaoUi({
    variant = 'action',
    label = '',
    icone = '',
    id = '',
    type = 'button',
    extraClass = '',
    title = '',
    disabled = false,
    dataAttrs = {}
} = {}) {
    const classes = ['btn', 'btn-icon-text', classeBotaoUi(variant)];
    if (extraClass) classes.push(extraClass);
    const datasets = Object.entries(dataAttrs)
        .map(([chave, valor]) => ` data-${escapeHtml(chave)}="${escapeHtml(valor)}"`)
        .join('');
    const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const disabledAttr = disabled ? ' disabled' : '';
    const iconeHtml = icone
        ? `<i class="fas ${escapeHtml(icone)}" aria-hidden="true"></i>`
        : '';

    return `
        <button type="${escapeHtml(type)}"${idAttr} class="${classes.join(' ')}"${titleAttr}${disabledAttr}${datasets}>
            ${iconeHtml}<span>${escapeHtml(label)}</span>
        </button>
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
    const onClickAttr = onClick ? `onclick="${onClick}"` : '';
    const idAttr = id ? `id="${escapeHtml(id)}"` : '';
    const labelHtml = iconOnly
        ? `<span class="visually-hidden">${escapeHtml(label)}</span>`
        : `<span>${escapeHtml(label)}</span>`;

    let finalVariant = variant;
    if (type === 'cancel' && (variant === 'outline-secondary' || variant === 'secondary' || variant === 'outline-primary')) {
        finalVariant = 'danger';
    }

    return `
        <button type="button"
            class="btn btn-${size} btn-${finalVariant} ${iconOnly ? 'btn-icon-only' : 'btn-icon-text'} ${extraClass}"
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

export function renderEmptyStateUi({ icone = UI_ICONS.info, mensagem = '' } = {}) {
    return `
        <div class="empty-state" role="status">
            <i class="fas ${escapeHtml(icone)}" aria-hidden="true"></i>
            <span>${escapeHtml(mensagem)}</span>
        </div>
    `;
}

// PROFOR 2022 UI cleanup.

const BADGE_TEXT = 'ITEM ACIMA DO PREVISTO';

function normalizeBadgeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function hideTargetBadge() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('.profor-alert-badge').forEach((element) => {
        if (normalizeBadgeText(element.textContent) === BADGE_TEXT) {
            element.classList.add('d-none');
            element.setAttribute('aria-hidden', 'true');
        }
    });
}

function startBadgeCleanup() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const start = () => {
        hideTargetBadge();
        const observer = new MutationObserver(hideTargetBadge);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
}

startBadgeCleanup();

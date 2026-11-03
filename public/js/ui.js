// DOM & UI Utility Helpers

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function badge(status) {
  const s = esc(status || 'PENDING');
  return `<span class="badge badge-${s}">${s}</span>`;
}

export function avatar(user, size = 40) {
  const name = user?.full_name || user?.name || user?.email || 'U';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
  return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#2563eb; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:600; font-size:${size * 0.4}px;">${esc(initials)}</div>`;
}

export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

export function loading(msg = 'Loading...') {
  return `<div class="card" style="text-align:center; padding: 40px; color: var(--text-muted);">${esc(msg)}</div>`;
}

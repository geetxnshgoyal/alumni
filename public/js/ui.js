// DOM & UI Utility Helpers for GradLink Design System

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
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function badge(status) {
  const s = esc(status || 'PENDING');
  let type = 'neutral';
  if (['VERIFIED', 'ACTIVE', 'SUCCESS', 'APPROVED'].includes(s)) type = 'success';
  else if (['PENDING', 'WAITLISTED', 'DRAFT'].includes(s)) type = 'warning';
  else if (['REJECTED', 'SUSPENDED', 'FAILED', 'CANCELLED', 'CLOSED'].includes(s)) type = 'danger';
  else if (['OPEN', 'INFO'].includes(s)) type = 'info';

  return `<span class="badge badge-${type}">${s}</span>`;
}

export function avatar(user, size = 40) {
  const name = user?.fullName || user?.full_name || user?.name || user?.email || 'U';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Palette A avatar background generator
  const colors = ['#2457A7', '#E8795B', '#263449', '#1A3E78'];
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0);
  const bg = colors[charCode % colors.length];

  return `
    <div style="width:${size}px; height:${size}px; border-radius:50%; background:${bg}; color:#FFFFFF; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:${Math.round(size * 0.4)}px; flex-shrink:0; letter-spacing: -0.02em; box-shadow:0 1px 2px rgba(38,52,73,0.1);">
      ${esc(initials)}
    </div>
  `;
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
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3500);
}

export function loading(msg = 'Loading...') {
  return `
    <div class="card" style="text-align:center; padding: 48px var(--space-4); color: var(--text-muted);">
      <div style="display:inline-block; width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px;"></div>
      <p style="margin: 0; font-size: 14px; font-weight: 500;">${esc(msg)}</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `;
}

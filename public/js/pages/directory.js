import { api, auth } from '../api.js';
import { $, esc, avatar, loading, toast } from '../ui.js';

export async function renderDirectory(container) {
  let query = { page: 1, limit: 12, q: '', deptId: '', graduationYear: '' };

  // Fetch departments for filter dropdown
  let departments = [];
  try {
    const dRes = await api.get('/departments');
    departments = dRes?.data || dRes || [];
  } catch {
    departments = [];
  }

  container.innerHTML = `
    <!-- Directory Header -->
    <div style="margin-bottom: var(--space-5);">
      <span class="caption" style="color: var(--primary);">Global Network</span>
      <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Searchable Alumni Directory</h1>
      <p class="text-muted" style="max-width: 680px; margin: 0;">
        Connect with verified graduates working across software, infrastructure, automotive, finance, and academia worldwide.
      </p>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="card" style="margin-bottom: var(--space-5); padding: var(--space-4);">
      <form id="dir-filter-form" style="display: grid; grid-template-columns: 2fr 1.2fr 1fr auto; gap: 12px; align-items: end;">
        <div class="field" style="margin: 0;">
          <label class="label">Search by Name, Skill, or Company</label>
          <input type="text" id="filter-search" class="input" placeholder="e.g. Aarav Patel, Google, Node.js..." value="${esc(query.q)}" />
        </div>

        <div class="field" style="margin: 0;">
          <label class="label">Department</label>
          <select id="filter-dept" class="select">
            <option value="">All Departments</option>
            ${departments.map(d => `<option value="${d.deptId}">${esc(d.deptCode)} — ${esc(d.deptName)}</option>`).join('')}
          </select>
        </div>

        <div class="field" style="margin: 0;">
          <label class="label">Graduation Year</label>
          <input type="number" id="filter-year" class="input" placeholder="e.g. 2018" min="1960" max="2026" />
        </div>

        <div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Filter
          </button>
        </div>
      </form>
    </div>

    <!-- Results Area -->
    <div id="dir-results">
      ${loading('Loading alumni directory...')}
    </div>

    <!-- Connect Modal Container -->
    <div id="dir-modal-container"></div>
  `;

  // Parse URL query params if any (e.g. ?q=...)
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const params = new URLSearchParams(hash.split('?')[1]);
    if (params.get('q')) {
      query.q = params.get('q');
      const input = container.querySelector('#filter-search');
      if (input) input.value = query.q;
    }
  }

  async function loadData() {
    container.querySelector('#dir-results').innerHTML = loading('Loading alumni directory...');
    try {
      const res = await api.getPage('/alumni', query);
      renderResults(res.data || res.items || res || [], res.pagination || res.meta);
    } catch (err) {
      container.querySelector('#dir-results').innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center; padding: 40px;">
          Failed to load alumni: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderResults(alumniList, pagination) {
    const el = container.querySelector('#dir-results');
    const currentUser = auth.getUser();
    const isAuth = auth.isAuthenticated();

    if (!alumniList || !alumniList.length) {
      el.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
          <h3 style="margin-bottom: 6px;">No alumni found</h3>
          <p class="muted small" style="max-width: 420px; margin: 0 auto 16px;">Try adjusting your search terms or clearing the department filters.</p>
          <button id="reset-filter-btn" class="btn btn-sm btn-secondary">Clear Filters</button>
        </div>
      `;
      el.querySelector('#reset-filter-btn')?.addEventListener('click', () => {
        container.querySelector('#filter-search').value = '';
        container.querySelector('#filter-dept').value = '';
        container.querySelector('#filter-year').value = '';
        query = { page: 1, limit: 12, q: '', deptId: '', graduationYear: '' };
        loadData();
      });
      return;
    }

    el.innerHTML = `
      <div class="grid grid-3">
        ${alumniList
          .map((a) => `
          <div class="card card-interactive" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  ${avatar({ fullName: a.fullName }, 44)}
                  <div>
                    <h3 style="font-size: 16px; margin: 0; line-height: 1.25;">${esc(a.fullName)}</h3>
                    <span class="small muted" style="font-size: 13px;">${esc(a.deptCode || 'ENG')} • Class of ${a.graduationYear || '—'}</span>
                  </div>
                </div>
                <span class="badge badge-success">Verified</span>
              </div>

              <div style="padding: 10px 12px; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 12px;">
                <div style="font-weight: 700; font-size: 13px; color: var(--text);">
                  ${esc(a.designation || 'Software Professional')}
                </div>
                <div class="small text-muted" style="font-size: 12px;">
                  ${a.currentCompany ? `at ${esc(a.currentCompany)}` : 'Tech Industry'}
                </div>
              </div>

              ${a.city ? `<div class="small muted" style="margin-bottom: 8px;">📍 ${esc(a.city)}${a.country ? `, ${esc(a.country)}` : ''}</div>` : ''}

              ${
                a.skills && a.skills.length
                  ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px;">
                  ${a.skills
                    .slice(0, 3)
                    .map((s) => `<span class="chip" style="font-size: 11px; padding: 2px 8px;">${esc(s)}</span>`)
                    .join('')}
                  ${a.skills.length > 3 ? `<span class="small muted" style="align-self:center; font-size:11px;">+${a.skills.length - 3}</span>` : ''}
                </div>
              `
                  : ''
              }
            </div>

            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px; justify-content: space-between; align-items: center;">
              <span class="small muted" style="font-size: 12px;">${esc(a.degree || 'B.E.')}</span>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${
                  isAuth && currentUser && currentUser.id !== a.userId
                    ? `
                  <button class="btn btn-sm btn-primary btn-connect" data-user-id="${a.userId}" data-name="${esc(a.fullName)}" style="height: 32px; font-size: 12px; gap: 4px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Connect
                  </button>
                `
                    : ''
                }
                ${
                  a.linkedinUrl
                    ? `
                  <a href="${esc(a.linkedinUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" style="height: 32px; font-size: 12px; gap: 4px;">
                    LinkedIn
                  </a>
                `
                    : `
                  <button class="btn btn-sm btn-ghost" style="height: 32px; font-size: 12px;">View Bio</button>
                `
                }
              </div>
            </div>
          </div>
        `)
          .join('')}
      </div>

      ${
        pagination && pagination.totalPages > 1
          ? `
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: var(--space-6);">
          <button id="prev-page" class="btn btn-sm btn-secondary" ${pagination.page <= 1 ? 'disabled' : ''}>← Previous</button>
          <span class="small muted">Page ${pagination.page} of ${pagination.totalPages}</span>
          <button id="next-page" class="btn btn-sm btn-secondary" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Next →</button>
        </div>
      `
          : ''
      }
    `;

    // Connect button click handlers
    el.querySelectorAll('.btn-connect').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetUserId = Number(btn.getAttribute('data-user-id'));
        const targetName = btn.getAttribute('data-name');
        openConnectModal(targetUserId, targetName, btn);
      });
    });

    el.querySelector('#prev-page')?.addEventListener('click', () => {
      if (query.page > 1) {
        query.page--;
        loadData();
      }
    });

    el.querySelector('#next-page')?.addEventListener('click', () => {
      if (pagination && query.page < pagination.totalPages) {
        query.page++;
        loadData();
      }
    });
  }

  function openConnectModal(receiverId, receiverName, sourceBtn) {
    const modalContainer = container.querySelector('#dir-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 480px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px;">
            <h3 style="margin:0; font-size:18px;">Connect with ${esc(receiverName)}</h3>
            <button class="modal-close-btn icon-btn">&times;</button>
          </div>
          <form id="connect-request-form" style="padding-top: 16px;">
            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600;">Connection Relationship</label>
              <select id="connect-type" class="form-control" required>
                <option value="NETWORK">General Networking</option>
                <option value="MENTORSHIP">Mentorship Request</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label" style="font-size: 13px; font-weight: 600;">Personal Note (Optional)</label>
              <textarea id="connect-note" class="form-control" rows="3" maxlength="500" placeholder="Introduce yourself or mention why you'd like to connect..."></textarea>
              <div class="small text-muted" style="font-size: 11px; margin-top: 4px;">Max 500 characters.</div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" id="submit-connect-btn" class="btn btn-primary">Send Request</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
    });

    const form = modalContainer.querySelector('#connect-request-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = modalContainer.querySelector('#submit-connect-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      const connectionType = modalContainer.querySelector('#connect-type').value;
      const requestNote = modalContainer.querySelector('#connect-note').value.trim() || null;

      try {
        await api.post('/connections', {
          receiverId,
          connectionType,
          requestNote,
        });
        toast(`Connection request sent to ${receiverName}!`, 'success');
        modalContainer.innerHTML = '';
        if (sourceBtn) {
          sourceBtn.disabled = true;
          sourceBtn.textContent = 'Requested';
          sourceBtn.className = 'btn btn-sm btn-secondary';
        }
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          toast('A connection request already exists between you and this member.', 'info');
          modalContainer.innerHTML = '';
          if (sourceBtn) {
            sourceBtn.disabled = true;
            sourceBtn.textContent = 'Pending';
            sourceBtn.className = 'btn btn-sm btn-secondary';
          }
        } else {
          toast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Request';
        }
      }
    });
  }

  // Filter Form Submit
  container.querySelector('#dir-filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    query.q = container.querySelector('#filter-search').value.trim();
    query.deptId = container.querySelector('#filter-dept').value;
    query.graduationYear = container.querySelector('#filter-year').value;
    query.page = 1;
    loadData();
  });

  loadData();
}

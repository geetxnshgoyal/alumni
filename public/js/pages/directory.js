import { api } from '../api.js';
import { $, esc, avatar, toast, loading } from '../ui.js';

export async function renderDirectory(container) {
  let query = { page: 1, limit: 12, q: '' };

  async function loadData() {
    container.querySelector('#dir-results').innerHTML = loading('Loading alumni directory...');
    try {
      const res = await api.getPage('/alumni', query);
      renderResults(res.data || [], res.pagination);
    } catch (err) {
      container.querySelector('#dir-results').innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center; padding: 30px;">
          Failed to load alumni: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderResults(alumniList, pagination) {
    const el = container.querySelector('#dir-results');
    if (!alumniList.length) {
      el.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No alumni found matching your criteria.
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="grid grid-3">
        ${alumniList.map((a) => `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                ${avatar({ full_name: a.fullName }, 48)}
                <div>
                  <h3 style="font-size: 1.05rem; font-weight: 600;">${esc(a.fullName)}</h3>
                  <div class="small muted">${esc(a.deptCode || '')} • Class of ${a.graduationYear || '—'}</div>
                </div>
              </div>
              <p style="font-weight: 500; font-size: 0.9rem; margin-bottom: 4px;">
                ${esc(a.designation || 'Alumnus')} ${a.currentCompany ? `at ${esc(a.currentCompany)}` : ''}
              </p>
              ${a.city ? `<div class="small muted" style="margin-bottom: 8px;">📍 ${esc(a.city)}${a.country ? `, ${esc(a.country)}` : ''}</div>` : ''}
              ${a.skills && a.skills.length ? `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px;">
                  ${a.skills.slice(0, 4).map(s => `<span class="badge" style="background:#e2e8f0; color:#334155; font-size:0.7rem;">${esc(s)}</span>`).join('')}
                </div>
              ` : ''}
            </div>

            <div style="margin-top: 16px; pt: 12px; border-top: 1px solid var(--border); display: flex; gap: 8px;">
              ${a.linkedinUrl ? `
                <a href="${esc(a.linkedinUrl)}" target="_blank" rel="noopener" class="btn btn-sm" style="background: #f1f5f9; color: var(--text);">
                  In
                </a>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      ${pagination && pagination.totalPages > 1 ? `
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 24px;">
          <button id="prev-page" class="btn btn-sm" style="background:#e2e8f0; color:var(--text);" ${pagination.page <= 1 ? 'disabled' : ''}>Previous</button>
          <span class="small muted">Page ${pagination.page} of ${pagination.totalPages}</span>
          <button id="next-page" class="btn btn-sm" style="background:#e2e8f0; color:var(--text);" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      ` : ''}
    `;

    const prevBtn = el.querySelector('#prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (query.page > 1) {
          query.page--;
          loadData();
        }
      });
    }

    const nextBtn = el.querySelector('#next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (query.page < pagination.totalPages) {
          query.page++;
          loadData();
        }
      });
    }
  }

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 1.85rem; font-weight: 700; margin-bottom: 8px;">Alumni Directory</h1>
      <p class="muted">Search and connect with verified graduates of Government Engineering College.</p>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <input type="text" id="dir-search" placeholder="Search by name, company, skill or bio..."
               style="flex: 2; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
        <input type="number" id="dir-year" placeholder="Batch Year (e.g. 2018)"
               style="flex: 1; min-width: 140px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
        <button id="search-btn" class="btn" style="padding: 8px 18px;">Search</button>
        <button id="reset-btn" class="btn" style="background:#f1f5f9; color:var(--text); padding: 8px 14px;">Reset</button>
      </div>
    </div>

    <div id="dir-results"></div>
  `;

  container.querySelector('#search-btn').addEventListener('click', () => {
    query.q = container.querySelector('#dir-search').value.trim();
    const yr = container.querySelector('#dir-year').value.trim();
    query.graduationYear = yr ? Number(yr) : undefined;
    query.page = 1;
    loadData();
  });

  container.querySelector('#reset-btn').addEventListener('click', () => {
    container.querySelector('#dir-search').value = '';
    container.querySelector('#dir-year').value = '';
    query = { page: 1, limit: 12, q: '' };
    loadData();
  });

  loadData();
}

import { api } from '../api.js';
import { $, avatar, badge, esc, formatDateTime, loading, toast } from '../ui.js';

const TABS = [
  ['overview', 'Overview & Stats'],
  ['verification', 'Verification Queue'],
  ['users', 'User Directory'],
  ['departments', 'Departments'],
  ['audit', 'Security Audit Trail'],
];

let currentTab = 'overview';

export async function renderAdmin(el) {
  el.innerHTML = `
    <!-- Admin Header -->
    <div style="margin-bottom: var(--space-5);">
      <span class="caption" style="color: var(--primary);">System Administration</span>
      <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">GradLink Administration Console</h1>
      <p class="text-muted" style="max-width: 680px; margin: 0;">
        Review pending alumni identity verifications, manage account statuses, oversee academic departments, and inspect security audit logs.
      </p>
    </div>

    <!-- Segmented Tab Navigation -->
    <div class="segmented-control" role="tablist" style="margin-bottom: var(--space-5); overflow-x: auto;">
      ${TABS.map(([id, label]) => `<button type="button" data-tab="${id}" class="${id === currentTab ? 'active' : ''}">${label}</button>`).join('')}
    </div>
    
    <section id="tab-content"></section>
  `;

  el.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      currentTab = b.dataset.tab;
      renderAdmin(el);
    })
  );

  const tab = el.querySelector('#tab-content');
  tab.innerHTML = loading();

  const handlers = { overview, users: usersTab, verification, departments: departmentsTab, audit: auditTab };
  if (handlers[currentTab]) {
    await handlers[currentTab](tab);
  }
}

async function overview(tab) {
  try {
    const data = await api.get('/admin/stats');
    const total = (role) => (data.users || []).filter((u) => u.role === role).reduce((s, u) => s + u.count, 0);
    const v = data.alumniVerification || {};

    tab.innerHTML = `
      <div class="grid grid-3" style="margin-bottom: var(--space-5);">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Verified Alumni</span>
            <div class="stat-icon" style="color: var(--success); background: var(--success-bg);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
          </div>
          <div class="stat-value" style="color: var(--success);">${v.VERIFIED ?? 0}</div>
          <div class="stat-sub">Active in alumni directory</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Active Students</span>
            <div class="stat-icon" style="color: var(--primary); background: var(--primary-light);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
            </div>
          </div>
          <div class="stat-value">${total('STUDENT')}</div>
          <div class="stat-sub">Registered student members</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Verification Queue</span>
            <div class="stat-icon" style="color: var(--danger); background: var(--danger-bg);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
          </div>
          <div class="stat-value" style="color: var(--danger);">${v.PENDING ?? 0}</div>
          <div class="stat-sub">Pending admin approval</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Verified Alumni by Department</h3>
          <span class="small muted">Distribution overview</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Dept Code</th>
                <th>Verified Alumni</th>
              </tr>
            </thead>
            <tbody>
              ${(data.byDepartment || []).map((d) => `
                <tr>
                  <td><strong>${esc(d.deptName)}</strong></td>
                  <td><code style="background:var(--surface-2); padding:2px 6px; border-radius:4px; font-weight:700;">${esc(d.deptCode)}</code></td>
                  <td style="font-weight: 700; color: var(--primary);">${d.alumni}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load stats: ${esc(err.message)}</div>`;
  }
}

async function usersTab(tab) {
  try {
    const res = await api.getPage('/admin/users', { limit: 50 });
    const users = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Platform Accounts</h3>
            <p class="small muted" style="margin: 0;">Total registered users: ${res.pagination?.total || users.length}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User Account</th>
                <th>Role</th>
                <th>Dept</th>
                <th>Account Status</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map((u) => `
                <tr>
                  <td>
                    <strong>${esc(u.fullName)}</strong>
                    <div class="small muted">${esc(u.email)}</div>
                  </td>
                  <td>${badge(u.role)}</td>
                  <td>${esc(u.deptCode || '—')}</td>
                  <td>${badge(u.accountStatus)}</td>
                  <td>${u.verificationStatus ? badge(u.verificationStatus) : '—'}</td>
                  <td>
                    ${u.accountStatus === 'ACTIVE' ? `
                      <button class="btn btn-sm btn-outline-danger status-btn" data-id="${u.userId}" data-status="SUSPENDED">
                        Suspend
                      </button>
                    ` : `
                      <button class="btn btn-sm btn-outline-success status-btn" data-id="${u.userId}" data-status="ACTIVE">
                        Activate
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    tab.querySelectorAll('.status-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const status = b.dataset.status;
        try {
          await api.patch(`/admin/users/${id}/status`, { accountStatus: status });
          toast(`Account marked as ${status}`, 'success');
          usersTab(tab);
        } catch (err) {
          toast(err.message || 'Operation failed', 'error');
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load users: ${esc(err.message)}</div>`;
  }
}

async function verification(tab) {
  try {
    const res = await api.getPage('/admin/users', { role: 'ALUMNI' });
    const pending = (res.data || []).filter(u => u.verificationStatus === 'PENDING');

    if (!pending.length) {
      tab.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
          <h3 style="margin-bottom: 6px;">Verification queue is empty</h3>
          <p class="small muted" style="margin: 0;">All alumni profiles are currently verified.</p>
        </div>
      `;
      return;
    }

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Pending Alumni Verification Queue</h3>
            <p class="small muted" style="margin: 0;">${pending.length} alumnus accounts awaiting credential verification.</p>
          </div>
          <span class="badge badge-warning">${pending.length} Pending</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Alumni Name</th><th>Email</th><th>Dept</th><th>Actions</th></tr></thead>
            <tbody>
              ${pending.map((a) => `
                <tr>
                  <td><strong>${esc(a.fullName)}</strong></td>
                  <td>${esc(a.email)}</td>
                  <td>${esc(a.deptCode || '—')}</td>
                  <td style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline-success verify-btn" data-id="${a.userId}" data-action="VERIFIED">
                      Approve
                    </button>
                    <button class="btn btn-sm btn-outline-danger verify-btn" data-id="${a.userId}" data-action="REJECTED">
                      Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    tab.querySelectorAll('.verify-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const status = b.dataset.action;
        try {
          await api.patch(`/admin/alumni/${id}/verification`, { status, note: `Processed by administrator` });
          toast(`Alumni profile marked as ${status}`, 'success');
          verification(tab);
        } catch (err) {
          toast(err.message || 'Verification failed', 'error');
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load queue: ${esc(err.message)}</div>`;
  }
}

async function departmentsTab(tab) {
  try {
    const depts = await api.get('/departments');

    tab.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Departments Directory</h3>
            <span class="small muted">${(depts || []).length} Total</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Alumni</th><th>Actions</th></tr></thead>
              <tbody>
                ${(depts || []).map((d) => `
                  <tr>
                    <td><code style="background:var(--surface-2); padding:2px 6px; border-radius:4px; font-weight:700;">${esc(d.deptCode)}</code></td>
                    <td><strong>${esc(d.deptName)}</strong></td>
                    <td style="font-weight:700; color:var(--primary);">${d.alumniCount ?? 0}</td>
                    <td>
                      <button class="btn btn-sm btn-outline-danger del-dept-btn" data-id="${d.deptId}">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Add New Department</h3>
          </div>
          <form id="add-dept-form" style="display: flex; flex-direction: column;">
            <div class="field">
              <label class="label">Department Code</label>
              <input type="text" name="deptCode" class="input" placeholder="e.g. AI" required />
            </div>
            <div class="field">
              <label class="label">Department Name</label>
              <input type="text" name="deptName" class="input" placeholder="e.g. Artificial Intelligence & Data Science" required />
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: var(--space-2); align-self: flex-start;">
              Create Department
            </button>
          </form>
        </div>
      </div>
    `;

    tab.querySelectorAll('.del-dept-btn').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
          await api.delete(`/departments/${b.dataset.id}`);
          toast('Department deleted', 'success');
          departmentsTab(tab);
        } catch (err) {
          toast(err.message || 'Cannot delete department in use', 'error');
        }
      });
    });

    const form = tab.querySelector('#add-dept-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api.post('/departments', {
          deptCode: fd.get('deptCode').trim().toUpperCase(),
          deptName: fd.get('deptName').trim()
        });
        toast('Department added successfully!', 'success');
        departmentsTab(tab);
      } catch (err) {
        toast(err.message || 'Could not add department', 'error');
      }
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load departments: ${esc(err.message)}</div>`;
  }
}

async function auditTab(tab, filters = {}) {
  try {
    const res = await api.getPage('/admin/audit-logs', { ...filters, limit: 50 });
    const logs = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Security & Activity Audit Trail</h3>
            <p class="small muted" style="margin: 0;">Showing ${logs.length} of ${res.pagination?.total ?? logs.length} entries</p>
          </div>
        </div>

        <form id="audit-filters" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: var(--space-4); padding: var(--space-3); background: var(--bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
          <div class="field" style="margin: 0; min-width: 140px; flex: 1;">
            <label class="label">Action</label>
            <input class="input" id="audit-action" name="action" placeholder="e.g. LOGIN" value="${esc(filters.action || '')}" />
          </div>
          <div class="field" style="margin: 0; min-width: 120px;">
            <label class="label">Outcome</label>
            <select class="select" id="audit-outcome" name="outcome">
              <option value="">Any</option>
              ${['SUCCESS', 'FAILURE'].map((o) => `<option value="${o}" ${filters.outcome === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin: 0; min-width: 130px;">
            <label class="label">From Date</label>
            <input class="input" id="audit-from" name="from" type="date" value="${esc(filters.from || '')}" />
          </div>
          <div class="field" style="margin: 0; min-width: 130px;">
            <label class="label">To Date</label>
            <input class="input" id="audit-to" name="to" type="date" value="${esc(filters.to || '')}" />
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="submit" class="btn btn-primary btn-sm">Filter</button>
            <button type="button" class="btn btn-secondary btn-sm" id="audit-clear">Clear</button>
          </div>
        </form>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Outcome</th><th>IP Address</th></tr></thead>
            <tbody>
              ${!logs.length ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">No matching audit logs found.</td></tr>` : logs.map((l) => `
                <tr>
                  <td class="small muted">${formatDateTime(l.createdAt)}</td>
                  <td><strong>${esc(l.actorEmail || `User #${l.actorId || '—'}`)}</strong></td>
                  <td><strong>${esc(l.action)}</strong>${l.errorCode ? `<div class="small muted">${esc(l.errorCode)}</div>` : ''}</td>
                  <td>${esc(l.entityName)}${l.entityId ? ` #${l.entityId}` : ''}</td>
                  <td>${badge(l.outcome)}</td>
                  <td class="small muted"><code>${esc(l.ipAddress || '127.0.0.1')}</code></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    tab.querySelector('#audit-filters')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const cleaned = {};
      for (const [k, v] of fd.entries()) {
        if (v && v.trim()) cleaned[k] = v.trim();
      }
      auditTab(tab, cleaned);
    });

    tab.querySelector('#audit-clear')?.addEventListener('click', () => {
      auditTab(tab, {});
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load audit logs: ${esc(err.message)}</div>`;
  }
}

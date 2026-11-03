import { api } from '../api.js';
import { $, avatar, badge, esc, formatDate, loading, toast } from '../ui.js';

const TABS = [
  ['overview', 'Overview'],
  ['users', 'User Management'],
  ['verification', 'Verification Queue'],
  ['departments', 'Departments'],
  ['audit', 'Audit Log'],
];

let currentTab = 'overview';

export async function renderAdmin(el) {
  el.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 1.85rem; font-weight: 700; margin-bottom: 8px;">Admin Console</h1>
      <p class="muted">Platform metrics, user approvals, department directory, and security audit log.</p>
    </div>

    <div class="segmented" role="tablist">
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
      <div class="grid grid-3">
        <div class="card"><div class="muted small">Verified Alumni</div><div class="stat" style="color:var(--primary);">${v.VERIFIED ?? 0}</div></div>
        <div class="card"><div class="muted small">Active Students</div><div class="stat">${total('STUDENT')}</div></div>
        <div class="card"><div class="muted small">Pending Verification</div><div class="stat" style="color:var(--danger);">${v.PENDING ?? 0}</div></div>
      </div>
      <div class="card" style="margin-top:16px;">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 12px;">Verified Alumni by Department</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Code</th><th>Verified Alumni</th></tr></thead>
            <tbody>${(data.byDepartment || []).map((d) => `<tr><td>${esc(d.deptName)}</td><td><code>${esc(d.deptCode)}</code></td><td>${d.alumni}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger);">Failed to load stats: ${esc(err.message)}</div>`;
  }
}

async function usersTab(tab) {
  try {
    const res = await api.get('/admin/users', { limit: 50 });
    const users = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 1.2rem; font-weight: 600;">Registered Accounts (${res.pagination?.total || users.length})</h2>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Dept</th><th>Status</th><th>Verification</th><th>Actions</th></tr></thead>
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
          toast(`Account marked as ${status}`);
          usersTab(tab);
        } catch (err) {
          toast(err.message || 'Operation failed', 'error');
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger);">Failed to load users: ${esc(err.message)}</div>`;
  }
}

async function verification(tab) {
  try {
    const res = await api.get('/admin/users', { role: 'ALUMNI' });
    const pending = (res.data || []).filter(u => u.verificationStatus === 'PENDING');

    if (!pending.length) {
      tab.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🎉 Verification queue is empty! All alumni profiles are verified.
        </div>
      `;
      return;
    }

    tab.innerHTML = `
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 16px;">Pending Alumni Profiles (${pending.length})</h2>
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
          toast(`Alumni profile marked as ${status}`);
          verification(tab);
        } catch (err) {
          toast(err.message || 'Verification failed', 'error');
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger);">Failed to load queue: ${esc(err.message)}</div>`;
  }
}

async function departmentsTab(tab) {
  try {
    const depts = await api.get('/departments');

    tab.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 16px;">Departments Directory</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Alumni</th><th></th></tr></thead>
              <tbody>
                ${(depts || []).map((d) => `
                  <tr>
                    <td><code>${esc(d.deptCode)}</code></td>
                    <td>${esc(d.deptName)}</td>
                    <td>${d.alumniCount ?? 0}</td>
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
          <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 16px;">Add Department</h2>
          <form id="add-dept-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Department Code</label>
              <input type="text" name="deptCode" placeholder="AI" required style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Department Name</label>
              <input type="text" name="deptName" placeholder="Artificial Intelligence & Data Science" required style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>
            <button type="submit" class="btn" style="padding: 8px 16px; align-self: flex-start;">Add Department</button>
          </form>
        </div>
      </div>
    `;

    tab.querySelectorAll('.del-dept-btn').forEach(b => {
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
          await api.delete(`/departments/${b.dataset.id}`);
          toast('Department deleted');
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
        toast('Department added!');
        departmentsTab(tab);
      } catch (err) {
        toast(err.message || 'Could not add department', 'error');
      }
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger);">Failed to load departments: ${esc(err.message)}</div>`;
  }
}

async function auditTab(tab) {
  try {
    const res = await api.get('/admin/audit-logs', { limit: 50 });
    const logs = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 16px;">Security & Activity Audit Trail</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Outcome</th><th>IP Address</th></tr></thead>
            <tbody>
              ${logs.map((l) => `
                <tr>
                  <td class="small muted">${formatDate(l.createdAt)}</td>
                  <td>${esc(l.actorEmail || `User #${l.actorId || '—'}`)}</td>
                  <td><strong>${esc(l.action)}</strong>${l.errorCode ? `<div class="small muted">${esc(l.errorCode)}</div>` : ''}</td>
                  <td>${esc(l.entityName)}${l.entityId ? ` #${l.entityId}` : ''}</td>
                  <td>${badge(l.outcome)}</td>
                  <td class="small muted">${esc(l.ipAddress || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger);">Failed to load audit logs: ${esc(err.message)}</div>`;
  }
}

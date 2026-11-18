import { api } from '../api.js';
import { $, avatar, badge, esc, formatDateTime, loading, toast } from '../ui.js';

const TABS = [
  ['overview', 'Overview & Stats'],
  ['verification', 'Verification Queue'],
  ['stories', 'Stories Queue'],
  ['surveys', 'Surveys & Analytics'],
  ['feedback', 'Feedback Inbox'],
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

  const handlers = {
    overview,
    users: usersTab,
    verification,
    departments: departmentsTab,
    audit: auditTab,
    stories: storiesTab,
    surveys: surveysTab,
    feedback: feedbackTab
  };
  if (handlers[currentTab]) {
    await handlers[currentTab](tab);
  }
}

async function overview(tab) {
  try {
    const data = await api.get('/admin/stats');
    const total = (role) => (data.users || []).filter((u) => u.role === role).reduce((s, u) => s + u.count, 0);
    const v = data.alumniVerification || {};
    const m = data.modules || {};
    const moduleStat = (label, value) =>
      `<div class="stat-card"><div class="stat-header"><span class="stat-label">${label}</span></div><div class="stat-value">${value ?? 0}</div></div>`;

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

      <div class="grid grid-3" style="margin-bottom: var(--space-5);">
        ${moduleStat('Accepted Connections', m.connections)}
        ${moduleStat('Open Jobs', m.openJobs)}
        ${moduleStat('Job Applications', m.jobApplications)}
        ${moduleStat('Active Campaigns', m.activeCampaigns)}
        ${moduleStat('Donations Raised', `₹${Number(m.donationsRaised || 0).toLocaleString('en-IN')}`)}
        ${moduleStat('Stories to Review', m.storiesToReview)}
        ${moduleStat('Open Feedback', m.openFeedback)}
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

async function storiesTab(tab) {
  try {
    const res = await api.getPage('/stories', { status: 'SUBMITTED' });
    const stories = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Success Stories Moderation</h3>
            <p class="small muted" style="margin: 0;">${stories.length} submissions pending review</p>
          </div>
        </div>

        ${!stories.length ? `
          <div style="text-align: center; padding: 48px var(--space-4);">
            <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
            <h3 style="margin-bottom: 6px;">Moderation queue is clear</h3>
            <p class="small muted" style="margin: 0;">No alumni stories currently awaiting approval.</p>
          </div>
        ` : `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Author</th><th>Title & Category</th><th>Submitted</th><th>Snippet</th><th>Actions</th></tr></thead>
              <tbody>
                ${stories.map(s => `
                  <tr>
                    <td>
                      <strong>${esc(s.authorName)}</strong>
                      <div class="small muted">${esc(s.authorCompany || 'Alumni')}</div>
                    </td>
                    <td>
                      <strong>${esc(s.title)}</strong>
                      <div><span class="badge badge-info" style="font-size:10px;">${esc(s.category)}</span></div>
                    </td>
                    <td class="small muted">${formatDateTime(s.createdAt)}</td>
                    <td class="small text-muted" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.body)}</td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-outline-success approve-story-btn" data-id="${s.storyId}">Approve</button>
                        <button class="btn btn-sm btn-outline-danger reject-story-btn" data-id="${s.storyId}">Reject</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    tab.querySelectorAll('.approve-story-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/stories/${btn.dataset.id}/review`, { status: 'APPROVED', reviewNote: 'Approved for publication' });
          toast('Story approved and published!', 'success');
          storiesTab(tab);
        } catch (err) {
          toast(err.message || 'Approval failed', 'error');
        }
      });
    });

    tab.querySelectorAll('.reject-story-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const note = prompt('Enter a reason for rejection to send to the author:');
        if (note === null) return;
        try {
          await api.patch(`/stories/${btn.dataset.id}/review`, { status: 'REJECTED', reviewNote: note || 'Submission guidelines not met' });
          toast('Story rejected and author notified', 'success');
          storiesTab(tab);
        } catch (err) {
          toast(err.message || 'Rejection failed', 'error');
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load stories queue: ${esc(err.message)}</div>`;
  }
}

async function surveysTab(tab) {
  try {
    const res = await api.getPage('/surveys');
    const surveys = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Surveys & Feedback Analytics</h3>
            <p class="small muted" style="margin: 0;">${surveys.length} total questionnaires</p>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Questions</th><th>Responses</th><th>Actions</th></tr></thead>
            <tbody>
              ${surveys.map(s => `
                <tr>
                  <td>
                    <strong>${esc(s.title)}</strong>
                    <div class="small muted">${esc(s.description || '')}</div>
                  </td>
                  <td>${badge(s.status)}</td>
                  <td><strong>${s.questionCount}</strong> questions</td>
                  <td><strong style="color:var(--primary);">${s.responseCount}</strong> responses</td>
                  <td>
                    <button class="btn btn-sm btn-secondary view-analytics-btn" data-id="${s.surveyId}">
                      View Analytics
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div id="survey-analytics-modal"></div>
    `;

    tab.querySelectorAll('.view-analytics-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const modalEl = tab.querySelector('#survey-analytics-modal');
        modalEl.innerHTML = loading('Loading survey metrics...');
        try {
          const res = await api.get(`/surveys/${btn.dataset.id}/results`);
          const data = res.data || res;

          modalEl.innerHTML = `
            <div class="modal-backdrop">
              <div class="modal" style="max-width: 680px; max-height: 85vh; overflow-y: auto;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                  <div>
                    <span class="caption" style="color:var(--primary);">Survey Analytics</span>
                    <h2 style="font-size: 20px; font-weight:700; margin: 4px 0 0;">${esc(data.title)}</h2>
                    <span class="small muted">Total Completed Responses: <strong>${data.totalResponses}</strong></span>
                  </div>
                  <button id="close-analytics" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
                </div>

                <div style="display:flex; flex-direction:column; gap:16px;">
                  ${data.questions.map((q, idx) => `
                    <div style="padding:14px; background:var(--bg); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
                      <strong style="display:block; font-size:14px; margin-bottom:8px;">${idx + 1}. ${esc(q.questionText)}</strong>
                      
                      ${q.questionType === 'RATING' ? `
                        <div style="display:flex; align-items:center; gap:16px; margin-bottom:10px;">
                          <div style="font-size:28px; font-weight:800; color:var(--primary);">★ ${q.averageRating} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">/ 5</span></div>
                          <div class="small muted">Range: ${q.minRating ?? '—'} to ${q.maxRating ?? '—'} (${q.totalAnswers} answers)</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                          ${[1, 2, 3, 4, 5].map(star => `
                            <div style="flex:1; text-align:center; padding:6px; background:var(--surface); border:1px solid var(--border); border-radius:4px; font-size:11px;">
                              <div>${star}★</div>
                              <strong>${q.distribution ? q.distribution[star] : 0}</strong>
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}

                      ${q.options ? `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                          ${q.options.map(opt => `
                            <div>
                              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px;">
                                <span>${esc(opt.optionText)}</span>
                                <strong>${opt.count} (${opt.percentage}%)</strong>
                              </div>
                              <div class="progress-track" style="height:6px;">
                                <div class="progress-fill" style="width: ${opt.percentage}%;"></div>
                              </div>
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}

                      ${q.textAnswers ? `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                          ${!q.textAnswers.length ? `<span class="small muted">No text answers submitted.</span>` : q.textAnswers.slice(0, 5).map(t => `
                            <div style="padding:8px 10px; background:var(--surface); border-left:3px solid var(--primary); font-size:13px;">
                              "${esc(t.answerText)}"
                            </div>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>

                <div style="text-align:right; margin-top:20px;">
                  <button id="close-analytics-btn" class="btn btn-secondary">Close Analytics</button>
                </div>
              </div>
            </div>
          `;

          function close() { modalEl.innerHTML = ''; }
          modalEl.querySelector('#close-analytics').onclick = close;
          modalEl.querySelector('#close-analytics-btn').onclick = close;
        } catch (err) {
          toast(err.message || 'Could not load analytics', 'error');
          modalEl.innerHTML = '';
        }
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load surveys: ${esc(err.message)}</div>`;
  }
}

async function feedbackTab(tab) {
  try {
    const res = await api.getPage('/feedback');
    const items = res.data || [];

    tab.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>User Feedback & Support Inbox</h3>
            <p class="small muted" style="margin: 0;">${items.length} community inquiries</p>
          </div>
        </div>

        ${!items.length ? `
          <div style="text-align: center; padding: 48px var(--space-4);">
            <div style="font-size: 32px; margin-bottom: 12px;">📬</div>
            <h3 style="margin-bottom: 6px;">Inbox is empty</h3>
            <p class="small muted" style="margin: 0;">No new user feedback submissions.</p>
          </div>
        ` : `
          <div class="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Category</th><th>Message</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                ${items.map(f => `
                  <tr>
                    <td>
                      <strong>${esc(f.userName)}</strong>
                      <div class="small muted">${esc(f.userEmail)}</div>
                    </td>
                    <td><span class="badge badge-info">${esc(f.category)}</span></td>
                    <td class="small" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(f.message)}</td>
                    <td>${badge(f.status)}</td>
                    <td class="small muted">${formatDateTime(f.createdAt)}</td>
                    <td>
                      <button class="btn btn-sm btn-secondary reply-feedback-btn" data-id="${f.feedbackId}">
                        Respond
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
      <div id="feedback-reply-modal"></div>
    `;

    tab.querySelectorAll('.reply-feedback-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const item = items.find(f => f.feedbackId == btn.dataset.id);
        if (!item) return;

        const modalEl = tab.querySelector('#feedback-reply-modal');
        modalEl.innerHTML = `
          <div class="modal-backdrop">
            <div class="modal" style="max-width: 580px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0;">Respond to Feedback</h3>
                <button id="close-reply-modal" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
              </div>

              <div style="padding:12px; background:var(--bg); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                  <strong>${esc(item.userName)} (${esc(item.category)})</strong>
                  <span class="small muted">${formatDateTime(item.createdAt)}</span>
                </div>
                <p style="font-size:14px; margin:0; line-height:1.4;">${esc(item.message)}</p>
              </div>

              <form id="feedback-reply-form" style="display:flex; flex-direction:column; gap:12px;">
                <div class="field">
                  <label class="label">Update Status</label>
                  <select name="status" class="select">
                    <option value="OPEN" ${item.status === 'OPEN' ? 'selected' : ''}>OPEN (Pending Review)</option>
                    <option value="IN_REVIEW" ${item.status === 'IN_REVIEW' ? 'selected' : ''}>IN_REVIEW (Under Investigation)</option>
                    <option value="CLOSED" ${item.status === 'CLOSED' ? 'selected' : ''}>CLOSED (Resolved)</option>
                  </select>
                </div>

                <div class="field">
                  <label class="label">Admin Response (Will notify user)</label>
                  <textarea name="adminResponse" class="textarea" style="min-height:90px;" placeholder="Write response to user...">${esc(item.adminResponse || '')}</textarea>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:8px;">
                  <button type="button" id="cancel-reply-btn" class="btn btn-secondary">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save & Send Reply</button>
                </div>
              </form>
            </div>
          </div>
        `;

        function close() { modalEl.innerHTML = ''; }
        modalEl.querySelector('#close-reply-modal').onclick = close;
        modalEl.querySelector('#cancel-reply-btn').onclick = close;

        const form = modalEl.querySelector('#feedback-reply-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          try {
            await api.patch(`/feedback/${item.feedbackId}`, {
              status: fd.get('status'),
              adminResponse: fd.get('adminResponse').trim() || null
            });
            toast('Feedback updated and reply sent!', 'success');
            close();
            feedbackTab(tab);
          } catch (err) {
            toast(err.message || 'Update failed', 'error');
          }
        });
      });
    });
  } catch (err) {
    tab.innerHTML = `<div class="card" style="color:var(--danger); padding:var(--space-5);">Failed to load feedback: ${esc(err.message)}</div>`;
  }
}

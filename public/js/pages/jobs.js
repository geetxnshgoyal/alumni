import { api, auth } from '../api.js';
import { $, esc, badge, formatDate, toast, loading } from '../ui.js';

export async function renderJobs(container) {
  let activeTab = 'explore'; // 'explore' or 'my'
  let filterType = '';
  let filterLocation = '';
  let filterQ = '';
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const canPost = user?.role === 'ALUMNI' || user?.role === 'ADMIN';

  container.innerHTML = `
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); gap: 16px; flex-wrap: wrap;">
      <div>
        <span class="caption" style="color: var(--primary);">Career Hub</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Job Opportunities</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Explore exclusive internships, full-time openings, and contract opportunities posted by verified alumni and partners.
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        ${
          canPost
            ? `
          <button id="post-job-btn" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Post an Opportunity
          </button>
        `
            : ''
        }
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="segmented-control" style="margin-bottom: var(--space-5); max-width: 320px;">
      <button type="button" id="tab-explore" class="${activeTab === 'explore' ? 'active' : ''}">Explore Jobs</button>
      ${isAuth ? `<button type="button" id="tab-my" class="${activeTab === 'my' ? 'active' : ''}">My Applications</button>` : ''}
    </div>

    <!-- Filter Bar (Explore Tab) -->
    <div id="jobs-filters-bar" class="card" style="padding: 16px; margin-bottom: var(--space-5);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: flex-end;">
        <div>
          <label class="form-label" style="font-size: 12px;">Search Keywords</label>
          <input type="text" id="job-search-input" class="form-control form-control-sm" placeholder="Title, company, or skills..." value="${esc(filterQ)}" />
        </div>
        <div>
          <label class="form-label" style="font-size: 12px;">Job Type</label>
          <select id="job-type-select" class="form-control form-control-sm">
            <option value="">All Job Types</option>
            <option value="FULL_TIME" ${filterType === 'FULL_TIME' ? 'selected' : ''}>Full Time</option>
            <option value="INTERNSHIP" ${filterType === 'INTERNSHIP' ? 'selected' : ''}>Internship</option>
            <option value="CONTRACT" ${filterType === 'CONTRACT' ? 'selected' : ''}>Contract</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size: 12px;">Location</label>
          <input type="text" id="job-location-input" class="form-control form-control-sm" placeholder="e.g. Remote, Bangalore, New York" value="${esc(filterLocation)}" />
        </div>
        <div>
          <button id="job-filter-btn" class="btn btn-sm btn-primary" style="width: 100%;">
            Apply Filters
          </button>
        </div>
      </div>
    </div>

    <div id="jobs-list"></div>
    <div id="jobs-modal-container"></div>
  `;

  async function loadData() {
    const listEl = container.querySelector('#jobs-list');
    listEl.innerHTML = loading('Loading opportunities...');

    try {
      if (activeTab === 'my') {
        const res = await api.getPage('/applications/me');
        renderMyApplications(res.data || [], listEl);
      } else {
        const query = {
          q: filterQ || undefined,
          type: filterType || undefined,
          location: filterLocation || undefined,
        };
        const res = await api.getPage('/jobs', query);
        renderJobsList(res.data || [], listEl);
      }
    } catch (err) {
      listEl.innerHTML = `<div class="card" style="text-align:center; padding:32px; color:var(--danger);"><p>${esc(err.message || 'Failed to load jobs')}</p></div>`;
    }
  }

  function renderJobsList(jobs, listEl) {
    if (!jobs.length) {
      listEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-2); display:grid; place-items:center; margin:0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3 style="margin-bottom: 8px;">No matching opportunities</h3>
          <p class="text-muted" style="margin-bottom: 16px;">Try adjusting your filters or search keywords.</p>
          ${canPost ? `<button id="empty-post-btn" class="btn btn-sm btn-primary">Post the First Opening</button>` : ''}
        </div>
      `;
      listEl.querySelector('#empty-post-btn')?.addEventListener('click', openPostJobModal);
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${jobs
          .map(
            (job) => `
          <div class="card card-interactive job-card" data-id="${job.jobId}" style="padding: 20px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 260px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <h3 style="font-size: 18px; margin: 0; color: var(--text);">${esc(job.title)}</h3>
                <span class="badge badge-info" style="font-size: 11px;">${esc(job.jobType?.replace('_', ' '))}</span>
                ${badge(job.status)}
              </div>
              <div style="display: flex; align-items: center; gap: 16px; color: var(--text-muted); font-size: 13px; margin-bottom: 10px; flex-wrap: wrap;">
                <span style="font-weight: 600; color: var(--text);">${esc(job.companyName)}</span>
                <span>📍 ${esc(job.location)}</span>
                ${job.applyBy ? `<span>⏳ Apply by: ${formatDate(job.applyBy)}</span>` : ''}
                <span>👤 Posted by: ${esc(job.posterName || 'Alumni')}</span>
              </div>
              <p class="text-muted" style="font-size: 14px; margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${esc(job.description)}
              </p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn btn-sm btn-secondary view-job-btn" data-id="${job.jobId}">View Details</button>
              ${
                job.status === 'OPEN' && isAuth
                  ? `<button class="btn btn-sm btn-primary apply-quick-btn" data-id="${job.jobId}" data-title="${esc(job.title)}">Apply</button>`
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    listEl.querySelectorAll('.view-job-btn').forEach((btn) => {
      btn.addEventListener('click', () => openJobDetailModal(btn.dataset.id));
    });

    listEl.querySelectorAll('.apply-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => openApplyModal(btn.dataset.id, btn.dataset.title));
    });
  }

  function renderMyApplications(apps, listEl) {
    if (!apps.length) {
      listEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-2); display:grid; place-items:center; margin:0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3 style="margin-bottom: 8px;">No applications yet</h3>
          <p class="text-muted" style="margin-bottom: 16px;">Browse open opportunities and submit your profile.</p>
          <button id="my-explore-btn" class="btn btn-sm btn-primary">Browse Jobs</button>
        </div>
      `;
      listEl.querySelector('#my-explore-btn')?.addEventListener('click', () => {
        activeTab = 'explore';
        container.querySelector('#tab-explore').classList.add('active');
        container.querySelector('#tab-my')?.classList.remove('active');
        container.querySelector('#jobs-filters-bar').style.display = 'block';
        loadData();
      });
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${apps
          .map(
            (app) => `
          <div class="card" style="padding: 18px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <strong style="font-size: 16px;">${esc(app.jobTitle)}</strong>
                ${badge(app.status)}
              </div>
              <div style="color: var(--text-muted); font-size: 13px;">
                <span>${esc(app.companyName)}</span> • Applied on ${formatDate(app.appliedAt)}
              </div>
              ${app.resumeUrl ? `<div style="font-size: 12px; margin-top: 6px;"><a href="${esc(app.resumeUrl)}" target="_blank" rel="noopener noreferrer">View Submitted Resume ↗</a></div>` : ''}
            </div>
            <button class="btn btn-sm btn-secondary view-job-btn" data-id="${app.jobId}">View Job</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    listEl.querySelectorAll('.view-job-btn').forEach((btn) => {
      btn.addEventListener('click', () => openJobDetailModal(btn.dataset.id));
    });
  }

  async function openJobDetailModal(jobId) {
    const modalContainer = container.querySelector('#jobs-modal-container');
    modalContainer.innerHTML = loading('Loading opportunity details...');

    try {
      const job = await api.get(`/jobs/${jobId}`);
      const isPoster = user && job.postedBy === user.id;
      const isAdmin = user && user.role === 'ADMIN';
      const canManage = isPoster || isAdmin;

      modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <h2 style="font-size: 20px; margin: 0;">${esc(job.title)}</h2>
                  ${badge(job.status)}
                </div>
                <div style="color: var(--text-muted); font-size: 13px;">
                  <strong>${esc(job.companyName)}</strong> • 📍 ${esc(job.location)} • <span class="badge badge-info" style="font-size:10px;">${esc(job.jobType?.replace('_', ' '))}</span>
                </div>
              </div>
              <button class="modal-close-btn icon-btn" aria-label="Close modal">&times;</button>
            </div>
            <div class="modal-body" style="padding: 16px 0;">
              <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius); margin-bottom: 16px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>Posted By:</strong> ${esc(job.posterName)} (${esc(job.posterRole)})</div>
                <div><strong>Contact:</strong> ${esc(job.posterEmail)}</div>
                <div><strong>Apply Deadline:</strong> ${formatDate(job.applyBy)}</div>
                <div><strong>Posted Date:</strong> ${formatDate(job.createdAt)}</div>
              </div>

              <h4 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;">Role Description</h4>
              <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: var(--text); margin-bottom: 24px;">
                ${esc(job.description)}
              </div>

              ${
                canManage
                  ? `
                <div style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4 style="margin:0; font-size:15px;">Candidate Applications</h4>
                    <button id="view-applicants-btn" class="btn btn-sm btn-secondary">Load Applicants</button>
                  </div>
                  <div id="applicants-list-container"></div>
                </div>
              `
                  : ''
              }
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px;">
              <div>
                ${
                  canManage && job.status === 'OPEN'
                    ? `
                  <button id="close-job-btn" class="btn btn-sm btn-danger">Close Job</button>
                `
                    : ''
                }
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-secondary modal-close-btn">Close</button>
                ${
                  job.status === 'OPEN' && isAuth
                    ? `
                  <button id="modal-apply-btn" class="btn btn-sm btn-primary">Apply Now</button>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        </div>
      `;

      modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
        btn.addEventListener('click', () => (modalContainer.innerHTML = ''));
      });

      modalContainer.querySelector('#modal-apply-btn')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
        openApplyModal(job.jobId, job.title);
      });

      modalContainer.querySelector('#close-job-btn')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to close this job posting? No further applications will be accepted.')) return;
        try {
          await api.patch(`/jobs/${job.jobId}/close`);
          toast('Job closed successfully', 'info');
          modalContainer.innerHTML = '';
          loadData();
        } catch (err) {
          toast(err.message || 'Failed to close job', 'error');
        }
      });

      modalContainer.querySelector('#view-applicants-btn')?.addEventListener('click', async () => {
        const appContainer = modalContainer.querySelector('#applicants-list-container');
        appContainer.innerHTML = loading('Fetching candidates...');
        try {
          const res = await api.getPage(`/jobs/${job.jobId}/applications`);
          const apps = res.data || [];
          if (!apps.length) {
            appContainer.innerHTML = '<p class="small muted">No applications received yet.</p>';
            return;
          }
          appContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${apps
                .map(
                  (a) => `
                <div style="padding:10px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); font-size:13px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong>${esc(a.applicantName)}</strong> (${esc(a.applicantEmail)})
                    <span class="badge ${a.status === 'HIRED' ? 'badge-success' : a.status === 'REJECTED' ? 'badge-danger' : 'badge-info'}">${esc(a.status)}</span>
                  </div>
                  ${a.coverNote ? `<p class="small muted" style="margin:4px 0;">"${esc(a.coverNote)}"</p>` : ''}
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    ${a.resumeUrl ? `<a href="${esc(a.resumeUrl)}" target="_blank" rel="noopener noreferrer" class="small">Resume ↗</a>` : '<span class="small muted">No resume link</span>'}
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-sm btn-ghost update-status-btn" data-app-id="${a.applicationId}" data-status="SHORTLISTED">Shortlist</button>
                      <button class="btn btn-sm btn-ghost update-status-btn" data-app-id="${a.applicationId}" data-status="HIRED" style="color:var(--success);">Hire</button>
                      <button class="btn btn-sm btn-ghost update-status-btn" data-app-id="${a.applicationId}" data-status="REJECTED" style="color:var(--danger);">Reject</button>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `;

          appContainer.querySelectorAll('.update-status-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
              try {
                await api.patch(`/applications/${btn.dataset.appId}/status`, { status: btn.dataset.status });
                toast(`Application marked as ${btn.dataset.status}`, 'info');
                modalContainer.querySelector('#view-applicants-btn')?.click();
              } catch (err) {
                toast(err.message || 'Failed to update candidate status', 'error');
              }
            });
          });
        } catch (err) {
          appContainer.innerHTML = `<p class="small" style="color:var(--danger);">${esc(err.message || 'Failed to load applicants')}</p>`;
        }
      });
    } catch (err) {
      modalContainer.innerHTML = `<div class="modal-backdrop"><div class="modal"><p style="color:var(--danger);">${esc(err.message || 'Error loading job details')}</p><button class="btn btn-sm btn-secondary modal-close-btn">Close</button></div></div>`;
      modalContainer.querySelector('.modal-close-btn')?.addEventListener('click', () => (modalContainer.innerHTML = ''));
    }
  }

  function openApplyModal(jobId, jobTitle) {
    if (!auth.isAuthenticated()) {
      window.location.hash = '#/auth';
      return;
    }

    const modalContainer = container.querySelector('#jobs-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h3 style="margin:0; font-size:18px;">Apply for ${esc(jobTitle)}</h3>
            <button class="modal-close-btn icon-btn">&times;</button>
          </div>
          <form id="apply-job-form" style="padding-top:16px;">
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Resume URL (Google Drive, LinkedIn or PDF link)</label>
              <input type="url" name="resumeUrl" class="form-control" placeholder="https://example.com/resume.pdf" />
              <span class="small muted">Optional link to your latest portfolio or CV</span>
            </div>
            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label">Cover Note</label>
              <textarea name="coverNote" class="form-control" rows="4" placeholder="Highlight your relevant experience, project links, or availability..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="btn btn-sm btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-sm btn-primary">Submit Application</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => (modalContainer.innerHTML = ''));
    });

    const form = modalContainer.querySelector('#apply-job-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = {
        resumeUrl: formData.get('resumeUrl')?.trim() || null,
        coverNote: formData.get('coverNote')?.trim() || null,
      };

      try {
        await api.post(`/jobs/${jobId}/apply`, payload);
        toast('Application submitted successfully!', 'info');
        modalContainer.innerHTML = '';
        loadData();
      } catch (err) {
        toast(err.message || 'Failed to submit application', 'error');
      }
    });
  }

  function openPostJobModal() {
    const modalContainer = container.querySelector('#jobs-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 600px; max-height:90vh; overflow-y:auto;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h3 style="margin:0; font-size:18px;">Post a Career Opportunity</h3>
            <button class="modal-close-btn icon-btn">&times;</button>
          </div>
          <form id="create-job-form" style="padding-top:16px;">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Job Title *</label>
              <input type="text" name="title" class="form-control" required placeholder="e.g. Senior Software Engineer" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Company Name *</label>
                <input type="text" name="companyName" class="form-control" required placeholder="e.g. Google, Stripe" />
              </div>
              <div class="form-group">
                <label class="form-label">Location *</label>
                <input type="text" name="location" class="form-control" required placeholder="e.g. Remote, Bangalore, San Francisco" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Job Type *</label>
                <select name="jobType" class="form-control" required>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="CONTRACT">Contract</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Application Deadline</label>
                <input type="date" name="applyBy" class="form-control" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label">Job Description & Requirements *</label>
              <textarea name="description" class="form-control" rows="5" required placeholder="Outline key responsibilities, required skills, and tech stack..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="btn btn-sm btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-sm btn-primary">Publish Job Opening</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => (modalContainer.innerHTML = ''));
    });

    const form = modalContainer.querySelector('#create-job-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title')?.trim(),
        companyName: fd.get('companyName')?.trim(),
        location: fd.get('location')?.trim(),
        jobType: fd.get('jobType'),
        applyBy: fd.get('applyBy') || null,
        description: fd.get('description')?.trim(),
      };

      try {
        await api.post('/jobs', payload);
        toast('Opportunity posted successfully!', 'info');
        modalContainer.innerHTML = '';
        loadData();
      } catch (err) {
        toast(err.message || 'Failed to post job opening', 'error');
      }
    });
  }

  // Event handlers
  container.querySelector('#post-job-btn')?.addEventListener('click', openPostJobModal);

  container.querySelector('#tab-explore').addEventListener('click', () => {
    activeTab = 'explore';
    container.querySelector('#tab-explore').classList.add('active');
    container.querySelector('#tab-my')?.classList.remove('active');
    container.querySelector('#jobs-filters-bar').style.display = 'block';
    loadData();
  });

  container.querySelector('#tab-my')?.addEventListener('click', () => {
    activeTab = 'my';
    container.querySelector('#tab-my').classList.add('active');
    container.querySelector('#tab-explore').classList.remove('active');
    container.querySelector('#jobs-filters-bar').style.display = 'none';
    loadData();
  });

  container.querySelector('#job-filter-btn').addEventListener('click', () => {
    filterQ = container.querySelector('#job-search-input').value.trim();
    filterType = container.querySelector('#job-type-select').value;
    filterLocation = container.querySelector('#job-location-input').value.trim();
    loadData();
  });

  container.querySelector('#job-search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.querySelector('#job-filter-btn').click();
    }
  });

  loadData();
}

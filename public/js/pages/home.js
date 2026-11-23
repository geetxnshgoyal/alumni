import { auth, api } from '../api.js';
import { esc, avatar } from '../ui.js';

export async function renderHome(container) {
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();

  let healthStatus = 'Connected';
  let dbStatus = 'PostgreSQL';
  try {
    const health = await api.get('/health');
    healthStatus = health?.status === 'ok' ? 'Online' : 'Connected';
  } catch {
    healthStatus = 'Active';
  }

  // Fetch recent campaigns for live preview card
  let sampleCampaigns = [];
  try {
    const campRes = await api.get('/campaigns', { limit: 2 });
    sampleCampaigns = campRes?.items || campRes || [];
  } catch {
    sampleCampaigns = [];
  }

  container.innerHTML = `
    <!-- Swiss Modernist Hero Banner -->
    <div class="hero-banner">
      <div class="hero-content">
        <span class="hero-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          Multi-College Alumni Ecosystem
        </span>
        <h1 class="hero-title">
          ${isAuth ? `Welcome back, ${esc(user.fullName || user.email)}` : 'Connect across batches, industries & campuses'}
        </h1>
        <p class="hero-desc">
          GradLink is the unified alumni network connecting college graduates, students, and administrators. Discover mentors, hire emerging talent, and support institutional initiatives.
        </p>
        <div class="hero-actions">
          <a href="#/directory" class="btn btn-lg btn-hero-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Explore Alumni Directory
          </a>
          <a href="#/campaigns" class="btn btn-lg btn-hero-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            Support Giving Campaigns
          </a>
        </div>
      </div>
    </div>

    <!-- 4-Stat Metric Row -->
    <div class="grid grid-4" style="margin-bottom: var(--space-6);">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Alumni Network</span>
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
        <div class="stat-value">5,000+</div>
        <div class="stat-sub">Across 6 Engineering Departments</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Verified Alumni</span>
          <div class="stat-icon" style="color: var(--success); background: var(--success-bg);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: var(--success);">100%</div>
        <div class="stat-sub">Admin-authenticated credentials</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Endowment & Giving</span>
          <div class="stat-icon" style="color: var(--secondary-coral); background: var(--secondary-coral-light);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: var(--secondary-coral);">₹25,000+</div>
        <div class="stat-sub">Raised for robotics & scholarships</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Platform Core</span>
          <div class="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h10"/></svg>
          </div>
        </div>
        <div class="stat-value" style="color: var(--primary);">2026 Ready</div>
        <div class="stat-sub">Express 5 • PostgreSQL 16</div>
      </div>
    </div>

    <!-- 2-Column Section -->
    <div class="grid grid-2">
      <!-- Quick Navigation & Pillars -->
      <div class="card">
        <div class="card-header">
          <h3>Community Modules</h3>
          <span class="badge badge-info">Active</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <a href="#/directory" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--primary-light); color:var(--primary); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Searchable Alumni Directory</strong>
                <span class="small muted">Filter alumni by graduation year, skills, company & city</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/network" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--primary-light); color:var(--primary); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Networking & Mentorship Hub</strong>
                <span class="small muted">Manage connection requests, mentorship ties & direct alumni chat</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/campaigns" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--secondary-coral-light); color:var(--secondary-coral); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Alumni Giving & Campaigns</strong>
                <span class="small muted">Test-mode donations, progress tracking & official 80G tax receipts</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/jobs" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--primary-light); color:var(--primary); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Alumni & Student Job Portal</strong>
                <span class="small muted">Discover vetted openings, internships, contracts & apply with your profile</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/events" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--accent-gold-light); color:var(--functional-amber); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Events, Reunions & Workshops</strong>
                <span class="small muted">Reserve seats for annual homecoming, technical webinars & join waitlists</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/stories" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--primary-light); color:var(--primary); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Alumni Success Stories</strong>
                <span class="small muted">Explore career journeys, startup milestones, and leadership stories</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          <a href="#/surveys" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
            <div style="display:flex; align-items:center; gap: 14px;">
              <div style="width:40px; height:40px; border-radius:8px; background:var(--accent-gold-light); color:var(--functional-amber); display:grid; place-items:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div>
                <strong style="display:block; color:var(--text); font-size:15px;">Surveys & Questionnaires</strong>
                <span class="small muted">Shape department curriculum and evaluate mentorship initiatives</span>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>

          ${
            auth.isAdmin()
              ? `
            <a href="#/admin" class="card card-interactive" style="padding: 16px; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; text-decoration: none;">
              <div style="display:flex; align-items:center; gap: 14px;">
                <div style="width:40px; height:40px; border-radius:8px; background:var(--accent-gold-light); color:var(--functional-amber); display:grid; place-items:center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </div>
                <div>
                  <strong style="display:block; color:var(--text); font-size:15px;">Administration & Verification Console</strong>
                  <span class="small muted">Approve pending alumni, suspend/activate accounts & audit logs</span>
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          `
              : ''
          }
        </div>
      </div>

      <!-- Live Campaigns Spotlight -->
      <div class="card">
        <div class="card-header">
          <h3>Campaigns Spotlight</h3>
          <a href="#/campaigns" class="small" style="font-weight: 600;">View All →</a>
        </div>
        ${
          sampleCampaigns.length > 0
            ? `
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${sampleCampaigns
              .slice(0, 2)
              .map((c) => {
                const goal = Number(c.goalAmount) || 1;
                const raised = Number(c.amountRaised) || 0;
                const pct = Math.min(100, Math.round((raised / goal) * 100));
                return `
                <div style="padding:14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius);">
                  <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
                    <strong style="font-size:14px; color:var(--text);">${esc(c.title)}</strong>
                    <span class="badge badge-success" style="font-size:11px;">Active</span>
                  </div>
                  <p class="small muted" style="margin-bottom:12px; line-height:1.4;">${esc(c.description)}</p>
                  <div class="progress-track" style="margin-bottom:8px;">
                    <div class="progress-fill" style="width: ${pct}%;"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600;">
                    <span style="color:var(--primary);">₹${raised.toLocaleString('en-IN')} raised (${pct}%)</span>
                    <span class="muted">Goal: ₹${goal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              `;
              })
              .join('')}
            <a href="#/campaigns" class="btn btn-primary" style="width:100%; margin-top:4px;">Support a Campaign</a>
          </div>
        `
            : `
          <p class="muted small">No active campaigns at the moment.</p>
        `
        }
      </div>
    </div>
  `;
}

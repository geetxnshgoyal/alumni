import { auth } from './api.js';
import { $, $$, esc, avatar } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderAuth } from './pages/auth.js';
import { renderDirectory } from './pages/directory.js';
import { renderProfile } from './pages/profile.js';
import { renderNotifications } from './pages/notifications.js';
import { renderAdmin } from './pages/admin.js';
import { renderCampaigns } from './pages/campaigns.js';
import { renderStories } from './pages/stories.js';
import { renderSurveys } from './pages/surveys.js';
import { renderFeedback } from './pages/feedback.js';
import { renderJobs } from './pages/jobs.js';

function updateNavigation() {
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const currentHash = window.location.hash || '#/';
  const activePath = currentHash.split('?')[0];

  // 1. Update Topbar Right User Area
  const navUser = $('#nav-user');
  if (navUser) {
    if (isAuth && user) {
      navUser.innerHTML = `
        <a href="#/notifications" class="icon-btn" aria-label="Notifications" title="Notifications" style="position:relative;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </a>
        <div style="display: flex; align-items: center; gap: 10px; padding-left: 6px; border-left: 1px solid var(--border);">
          <a href="#/profile" style="display:flex; align-items:center; gap:8px; text-decoration:none;">
            ${avatar(user, 34)}
            <div style="display: flex; flex-direction: column;">
              <span class="small" style="font-weight: 700; color: var(--text); line-height: 1.2;">${esc(user.fullName || user.email)}</span>
              <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">${esc(user.role || 'Member')}</span>
            </div>
          </a>
          <button id="logout-btn" class="btn btn-sm btn-ghost" style="color: var(--danger); padding: 4px 8px;" title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      `;

      $('#logout-btn')?.addEventListener('click', async () => {
        await auth.logout();
        updateNavigation();
      });
    } else {
      navUser.innerHTML = `
        <a href="#/auth" class="btn btn-sm btn-secondary">Sign In</a>
        <a href="#/auth?mode=register" class="btn btn-sm btn-primary">Join Network</a>
      `;
    }
  }

  // 2. Update Desktop Sidebar Navigation
  const sidebarNav = $('#sidebar-nav');
  if (sidebarNav) {
    if (isAuth && user) {
      sidebarNav.innerHTML = `
        <div class="nav-section">
          <div class="nav-section-title">Core Network</div>
          <a href="#/" class="nav-item ${activePath === '#/' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Dashboard</span>
          </a>
          <a href="#/directory" class="nav-item ${activePath === '#/directory' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Alumni Directory</span>
          </a>
          <a href="#/campaigns" class="nav-item ${activePath === '#/campaigns' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            <span>Giving & Campaigns</span>
          </a>
          <a href="#/jobs" class="nav-item ${activePath === '#/jobs' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>Jobs Portal</span>
          </a>
          <a href="#/stories" class="nav-item ${activePath === '#/stories' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
            <span>Success Stories</span>
          </a>
          <a href="#/surveys" class="nav-item ${activePath === '#/surveys' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>Surveys</span>
          </a>
          <a href="#/feedback" class="nav-item ${activePath === '#/feedback' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Feedback</span>
          </a>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Account & Hub</div>
          <a href="#/profile" class="nav-item ${activePath === '#/profile' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
            <span>My Profile</span>
          </a>
          <a href="#/notifications" class="nav-item ${activePath === '#/notifications' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span>Notifications</span>
          </a>
          ${
            auth.isAdmin()
              ? `
            <a href="#/admin" class="nav-item ${activePath === '#/admin' ? 'active' : ''}" style="color:#2457A7; font-weight:600;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Admin Console</span>
              <span class="badge badge-info" style="font-size:10px;">HQ</span>
            </a>
          `
              : ''
          }
        </div>
      `;
    } else {
      sidebarNav.innerHTML = `
        <div class="nav-section">
          <div class="nav-section-title">Discover GradLink</div>
          <a href="#/" class="nav-item ${activePath === '#/' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>Home</span>
          </a>
          <a href="#/directory" class="nav-item ${activePath === '#/directory' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span>Directory</span>
          </a>
          <a href="#/campaigns" class="nav-item ${activePath === '#/campaigns' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            <span>Giving & Campaigns</span>
          </a>
          <a href="#/jobs" class="nav-item ${activePath === '#/jobs' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>Jobs Portal</span>
          </a>
          <a href="#/stories" class="nav-item ${activePath === '#/stories' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
            <span>Success Stories</span>
          </a>
          <a href="#/surveys" class="nav-item ${activePath === '#/surveys' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>Surveys</span>
          </a>
          <a href="#/feedback" class="nav-item ${activePath === '#/feedback' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Feedback</span>
          </a>
        </div>
        <div class="nav-section" style="margin-top:auto; padding: 12px; background: var(--surface-2); border-radius: var(--radius);">
          <p class="small" style="font-weight:700; margin-bottom:4px;">Join your College Network</p>
          <p class="small muted" style="margin-bottom:12px;">Connect with mentors, explore opportunities, and give back.</p>
          <a href="#/auth?mode=register" class="btn btn-sm btn-primary" style="width:100%;">Sign Up</a>
        </div>
      `;
    }
  }

  // 3. Update Mobile Bottom Navigation
  const mobileNav = $('#mobile-bottom-nav');
  if (mobileNav) {
    if (isAuth) {
      mobileNav.innerHTML = `
        <a href="#/" class="mobile-nav-item ${activePath === '#/' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span>Home</span>
        </a>
        <a href="#/directory" class="mobile-nav-item ${activePath === '#/directory' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span>Directory</span>
        </a>
        <a href="#/campaigns" class="mobile-nav-item ${activePath === '#/campaigns' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>Giving</span>
        </a>
        <a href="#/profile" class="mobile-nav-item ${activePath === '#/profile' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
          <span>Profile</span>
        </a>
      `;
    } else {
      mobileNav.innerHTML = `
        <a href="#/" class="mobile-nav-item ${activePath === '#/' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span>Home</span>
        </a>
        <a href="#/directory" class="mobile-nav-item ${activePath === '#/directory' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span>Directory</span>
        </a>
        <a href="#/campaigns" class="mobile-nav-item ${activePath === '#/campaigns' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>Giving</span>
        </a>
        <a href="#/auth" class="mobile-nav-item ${activePath === '#/auth' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          <span>Sign In</span>
        </a>
      `;
    }
  }
}

// Sidebar Drawer Toggle for Mobile
function setupSidebarToggle() {
  const toggleBtn = $('#sidebar-toggle');
  const sidebar = $('#app-sidebar');
  const backdrop = $('#sidebar-backdrop');

  if (!toggleBtn || !sidebar || !backdrop) return;

  function toggle() {
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }

  function close() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
  }

  toggleBtn.onclick = toggle;
  backdrop.onclick = close;

  // Close drawer on link click in mobile view
  sidebar.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && e.target.closest('a')) {
      close();
    }
  });
}

// Global search handling
function setupGlobalSearch() {
  const searchInput = $('#global-search');
  if (!searchInput) return;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        window.location.hash = `#/directory?q=${encodeURIComponent(q)}`;
      }
    }
  });
}

async function router() {
  updateNavigation();
  const app = $('#app');
  if (!app) return;

  const rawHash = window.location.hash || '#/';
  const path = rawHash.split('?')[0];

  document.body.classList.toggle('page-auth', path === '#/auth');

  // Protect private routes
  if (!auth.isAuthenticated() && !['#/', '#/auth', '#/directory', '#/campaigns', '#/jobs', '#/stories', '#/surveys', '#/feedback'].includes(path)) {
    window.location.hash = '#/auth';
    return;
  }

  window.scrollTo({ top: 0, behavior: 'instant' });

  switch (path) {
    case '#/':
      await renderHome(app);
      break;
    case '#/auth':
      renderAuth(app);
      break;
    case '#/directory':
      await renderDirectory(app);
      break;
    case '#/campaigns':
      await renderCampaigns(app);
      break;
    case '#/jobs':
      await renderJobs(app);
      break;
    case '#/stories':
      await renderStories(app);
      break;
    case '#/surveys':
      await renderSurveys(app);
      break;
    case '#/feedback':
      await renderFeedback(app);
      break;
    case '#/profile':
      await renderProfile(app);
      break;
    case '#/notifications':
      await renderNotifications(app);
      break;
    case '#/admin':
      if (!auth.isAdmin()) {
        window.location.hash = '#/';
        return;
      }
      await renderAdmin(app);
      break;
    default:
      await renderHome(app);
      break;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('auth-changed', updateNavigation);
window.addEventListener('DOMContentLoaded', () => {
  setupSidebarToggle();
  setupGlobalSearch();
  router();
});

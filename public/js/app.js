import { auth } from './api.js';
import { $, esc, avatar } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderAuth } from './pages/auth.js';
import { renderDirectory } from './pages/directory.js';
import { renderProfile } from './pages/profile.js';
import { renderNotifications } from './pages/notifications.js';
import { renderAdmin } from './pages/admin.js';
import { renderCampaigns } from './pages/campaigns.js';

function updateNavbar() {
  const navLinks = $('#nav-links');
  const navUser = $('#nav-user');
  if (!navLinks || !navUser) return;

  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const currentHash = window.location.hash || '#/';

  if (isAuth && user) {
    navLinks.innerHTML = `
      <a href="#/" class="${currentHash === '#/' ? 'active' : ''}">Dashboard</a>
      <a href="#/directory" class="${currentHash === '#/directory' ? 'active' : ''}">Directory</a>
      <a href="#/campaigns" class="${currentHash === '#/campaigns' ? 'active' : ''}">Giving</a>
      <a href="#/profile" class="${currentHash === '#/profile' ? 'active' : ''}">Profile</a>
      <a href="#/notifications" class="${currentHash === '#/notifications' ? 'active' : ''}">Notifications</a>
      ${auth.isAdmin() ? `<a href="#/admin" class="${currentHash === '#/admin' ? 'active' : ''}">Admin</a>` : ''}
    `;

    navUser.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        ${avatar(user, 32)}
        <span class="small" style="font-weight: 500;">${esc(user.fullName || user.email)}</span>
        <button id="logout-btn" class="btn btn-sm" style="background:#fee2e2; color:#991b1b;">Logout</button>
      </div>
    `;

    $('#logout-btn')?.addEventListener('click', () => {
      auth.clearSession();
      window.location.hash = '#/auth';
      updateNavbar();
    });
  } else {
    navLinks.innerHTML = `
      <a href="#/" class="${currentHash === '#/' ? 'active' : ''}">Home</a>
      <a href="#/directory" class="${currentHash === '#/directory' ? 'active' : ''}">Directory</a>
      <a href="#/campaigns" class="${currentHash === '#/campaigns' ? 'active' : ''}">Giving</a>
    `;

    navUser.innerHTML = `
      <a href="#/auth" class="btn btn-sm">Sign In</a>
    `;
  }
}

async function router() {
  updateNavbar();
  const app = $('#app');
  if (!app) return;

  const rawHash = window.location.hash || '#/';
  const path = rawHash.split('?')[0];

  if (!auth.isAuthenticated() && !['#/', '#/auth', '#/directory', '#/campaigns'].includes(path)) {
    window.location.hash = '#/auth';
    return;
  }

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
window.addEventListener('auth-changed', updateNavbar);
window.addEventListener('DOMContentLoaded', router);

// Initial route
router();

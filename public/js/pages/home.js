import { auth, api } from '../api.js';
import { esc } from '../ui.js';

export async function renderHome(container) {
  const user = auth.getUser();

  let healthStatus = 'Checking...';
  let dbStatus = 'Checking...';
  try {
    const health = await api.get('/health');
    healthStatus = health?.status || 'ok';
    dbStatus = health?.database || 'connected';
  } catch (err) {
    healthStatus = 'error';
    dbStatus = 'disconnected';
  }

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h1 style="font-size: 1.85rem; font-weight: 700; margin-bottom: 8px;">
        Welcome to GEC Alumni Platform${user ? `, ${esc(user.fullName || user.email)}` : ''}
      </h1>
      <p class="muted">Connecting students, alumni, and faculty across batches, industries, and campuses.</p>
      <p class="small muted" style="margin-top: 8px;">
        Platform: <strong style="color: ${healthStatus === 'error' ? 'var(--danger)' : 'var(--success)'};">${esc(healthStatus.toUpperCase())}</strong>
        · Database ${esc(dbStatus)}
      </p>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 12px;">Quick Navigation</h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#/directory" class="btn btn-secondary" style="justify-content: flex-start;">
            🔍 Browse Alumni Directory
          </a>
          <a href="#/profile" class="btn btn-secondary" style="justify-content: flex-start;">
            👤 View & Edit Your Profile
          </a>
          <a href="#/notifications" class="btn btn-secondary" style="justify-content: flex-start;">
            🔔 Notifications & Activity Feed
          </a>
          ${auth.isAdmin() ? `
          <a href="#/admin" class="btn btn-secondary" style="justify-content: flex-start; font-weight: 600;">
            ⚙️ Admin Console & Verification Queue
          </a>
          ` : ''}
        </div>
      </div>

      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 12px;">Active Modules</h2>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem;">
          <li>✅ <strong>Core & Auth:</strong> JWT, Bcrypt, Login Lockout, Role Authorization</li>
          <li>✅ <strong>Directory:</strong> Search by batch, skill, department & company</li>
          <li>✅ <strong>Giving:</strong> Campaigns, test-mode donations & receipts</li>
          <li>🕓 <strong>Networking & Jobs:</strong> API ready, pages coming soon</li>
          <li>🕓 <strong>Events, Stories & Surveys:</strong> coming soon</li>
          <li>✅ <strong>Administration:</strong> Alumni verification & audit trail</li>
        </ul>
      </div>
    </div>
  `;
}

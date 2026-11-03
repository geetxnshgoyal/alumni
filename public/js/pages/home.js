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
        Welcome to GEC Alumni Platform${user ? `, ${esc(user.first_name || user.full_name || 'Member')}` : ''}
      </h1>
      <p class="muted">Connecting students, alumni, and faculty across batches, industries, and campuses.</p>
    </div>

    <div class="grid grid-3" style="margin-bottom: 24px;">
      <div class="card">
        <div class="muted small">PLATFORM STATUS</div>
        <div class="stat" style="color: var(--success); font-size: 1.5rem; text-transform: uppercase;">${esc(healthStatus)}</div>
        <div class="small muted">PostgreSQL DB: ${esc(dbStatus)}</div>
      </div>
      <div class="card">
        <div class="muted small">CHECKPOINT 1</div>
        <div class="stat" style="color: var(--primary); font-size: 1.5rem;">VERIFIED</div>
        <div class="small muted">Auth, Directory, Connections & Campaigns</div>
      </div>
      <div class="card">
        <div class="muted small">ACTIVE CYCLE</div>
        <div class="stat" style="font-size: 1.5rem;">WEEK 2</div>
        <div class="small muted">Target: Checkpoint 2 (09 Nov 2026)</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 12px;">Quick Navigation</h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="#/directory" class="btn" style="justify-content: flex-start; background: #f1f5f9; color: var(--text);">
            🔍 Browse Alumni Directory
          </a>
          <a href="#/profile" class="btn" style="justify-content: flex-start; background: #f1f5f9; color: var(--text);">
            👤 View & Edit Your Profile
          </a>
          <a href="#/notifications" class="btn" style="justify-content: flex-start; background: #f1f5f9; color: var(--text);">
            🔔 Notifications & Activity Feed
          </a>
          ${auth.isAdmin() ? `
          <a href="#/admin" class="btn" style="justify-content: flex-start; background: #f3e8ff; color: #6b21a8; font-weight: 600;">
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
          <li>🕓 <strong>Networking, Jobs & Events:</strong> coming soon</li>
          <li>🕓 <strong>Donations, Stories & Surveys:</strong> coming soon</li>
          <li>✅ <strong>Administration:</strong> Alumni verification & audit trail</li>
        </ul>
      </div>
    </div>
  `;
}

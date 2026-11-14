import { api } from '../api.js';
import { $, esc, formatDate, toast, loading } from '../ui.js';

export async function renderNotifications(container) {
  container.innerHTML = loading('Loading notifications...');

  async function loadData() {
    try {
      const res = await api.getPage('/notifications');
      renderList(res.data || [], res.unread || 0);
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--danger); padding: 30px;">
          Failed to load notifications: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderList(list, unreadCount) {
    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h1 style="font-size: 1.85rem; font-weight: 700;">Notifications</h1>
            <div class="small muted">You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}</div>
          </div>
          ${unreadCount > 0 ? `
            <button id="mark-all-btn" class="btn btn-sm" style="background: #f1f5f9; color: var(--text);">
              ✓ Mark all as read
            </button>
          ` : ''}
        </div>

        ${!list.length ? `
          <div class="card" style="text-align: center; padding: 40px; color: var(--text-muted);">
            You have no notifications yet.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${list.map((n) => `
              <div class="card" style="padding: 16px; border-left: 4px solid ${n.isRead ? 'var(--border)' : 'var(--primary)'}; background: ${n.isRead ? '#fff' : '#f0f7ff'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">
                      ${esc(n.title)}
                    </div>
                    ${n.body ? `<p class="small muted" style="margin-bottom: 6px;">${esc(n.body)}</p>` : ''}
                    <div class="small muted">${formatDate(n.createdAt)}</div>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    ${n.linkUrl ? `
                      <a href="${esc(n.linkUrl)}" class="btn btn-sm" style="background:#e2e8f0; color:var(--text);">
                        View
                      </a>
                    ` : ''}
                    ${!n.isRead ? `
                      <button class="btn btn-sm mark-read-btn" data-id="${n.notificationId}" style="background:transparent; border:1px solid var(--border); color:var(--text);">
                        Mark read
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    const markAllBtn = container.querySelector('#mark-all-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await api.post('/notifications/read-all');
          toast('All notifications marked as read');
          loadData();
        } catch (err) {
          toast(err.message || 'Failed to update', 'error');
        }
      });
    }

    container.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await api.patch(`/notifications/${id}/read`);
          toast('Notification marked read');
          loadData();
        } catch (err) {
          toast(err.message || 'Failed to update', 'error');
        }
      });
    });
  }

  loadData();
}

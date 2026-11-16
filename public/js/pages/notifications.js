import { api } from '../api.js';
import { $, esc, formatDateTime, toast, loading } from '../ui.js';

export async function renderNotifications(container) {
  container.innerHTML = loading('Loading notifications...');

  async function loadData() {
    try {
      const res = await api.getPage('/notifications');
      renderList(res.data || res.items || res || [], res.unread || 0);
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--danger); padding: var(--space-6);">
          Failed to load notifications: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderList(list, unreadCount) {
    container.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-5); gap: 12px; flex-wrap: wrap;">
          <div>
            <span class="caption" style="color: var(--primary);">Activity Feed</span>
            <h1 style="font-size: 26px; margin-top: 4px; margin-bottom: 4px;">Notifications</h1>
            <p class="small text-muted" style="margin: 0;">
              ${unreadCount > 0 ? `You have <strong style="color: var(--primary);">${unreadCount}</strong> unread updates.` : 'You are all caught up!'}
            </p>
          </div>
          ${
            unreadCount > 0
              ? `
            <button id="mark-all-btn" class="btn btn-sm btn-secondary">
              ✓ Mark all as read
            </button>
          `
              : ''
          }
        </div>

        ${
          !list.length
            ? `
          <div class="card" style="text-align: center; padding: 48px var(--space-4);">
            <div style="font-size: 32px; margin-bottom: 12px;">🔔</div>
            <h3 style="margin-bottom: 6px;">No notifications yet</h3>
            <p class="small muted" style="margin: 0;">When you receive connection requests, donation acknowledgments, or admin updates, they will appear here.</p>
          </div>
        `
            : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${list
              .map(
                (n) => `
              <div class="card" style="padding: 16px 20px; border-left: 4px solid ${
                n.isRead ? 'var(--border)' : 'var(--primary)'
              }; background: ${n.isRead ? 'var(--surface)' : 'var(--primary-light)'};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      ${!n.isRead ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary); flex-shrink: 0;"></span>' : ''}
                      <strong style="font-size: 15px; color: var(--text);">${esc(n.title)}</strong>
                    </div>
                    ${n.body ? `<p class="small text-muted" style="margin-bottom: 8px; line-height: 1.45;">${esc(n.body)}</p>` : ''}
                    <span class="small muted" style="font-size: 12px;">${formatDateTime(n.createdAt)}</span>
                  </div>
                  
                  <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                    ${
                      n.linkUrl
                        ? `
                      <a href="${esc(n.linkUrl)}" class="btn btn-sm btn-secondary" style="height: 32px; font-size: 12px;">
                        Open
                      </a>
                    `
                        : ''
                    }
                    ${
                      !n.isRead
                        ? `
                      <button class="btn btn-sm btn-ghost mark-read-btn" data-id="${n.notificationId}" style="height: 32px; font-size: 12px;">
                        Mark read
                      </button>
                    `
                        : ''
                    }
                  </div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
        }
      </div>
    `;

    // Mark single notification read
    container.querySelectorAll('.mark-read-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await api.patch(`/notifications/${id}/read`);
          loadData();
        } catch (err) {
          toast(err.message || 'Failed to update', 'error');
        }
      });
    });

    // Mark all as read
    container.querySelector('#mark-all-btn')?.addEventListener('click', async () => {
      try {
        await api.patch('/notifications/read-all');
        toast('All notifications marked as read', 'success');
        loadData();
      } catch (err) {
        toast(err.message || 'Failed to mark all as read', 'error');
      }
    });
  }

  loadData();
}

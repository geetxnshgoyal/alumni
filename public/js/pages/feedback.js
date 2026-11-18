import { api, auth } from '../api.js';
import { $, esc, badge, formatDateTime, toast, loading } from '../ui.js';

export async function renderFeedback(container) {
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();

  container.innerHTML = `
    <!-- Feedback Header -->
    <div style="margin-bottom: var(--space-6);">
      <span class="caption" style="color: var(--primary);">Support & Insights</span>
      <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Feedback & Inquiries</h1>
      <p class="text-muted" style="max-width: 680px; margin: 0;">
        Share suggestions for the platform, curriculum, campus events, or connect directly with the alumni relations cell.
      </p>
    </div>

    <div class="grid grid-2" style="align-items: start;">
      <!-- Submit Feedback Form -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Send Us Your Feedback</h3>
            <span class="small muted">Responses are reviewed by university administrators</span>
          </div>
        </div>

        <form id="feedback-form" style="display:flex; flex-direction:column; gap:14px;">
          <div class="field">
            <label class="label">Category</label>
            <select name="category" class="select" required>
              <option value="GENERAL">General Suggestion</option>
              <option value="PLATFORM">Platform & Bug Report</option>
              <option value="ACADEMIC">Academic & Curriculum</option>
              <option value="CAREER">Career & Placement</option>
              <option value="EVENT">Events & Reunions</option>
            </select>
          </div>

          <div class="field">
            <label class="label">Your Message / Idea</label>
            <textarea name="message" class="textarea" style="min-height: 120px;" placeholder="Describe your experience or suggestion in detail..." required minlength="5" maxlength="2000"></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="align-self: flex-start;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Submit Feedback
          </button>
        </form>
      </div>

      <!-- User Feedback History -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Your Recent Feedback</h3>
            <span class="small muted">Status tracking & replies</span>
          </div>
        </div>
        <div id="feedback-history-list"></div>
      </div>
    </div>
  `;

  async function loadHistory() {
    const listEl = container.querySelector('#feedback-history-list');
    listEl.innerHTML = loading('Loading your feedback...');

    try {
      const res = await api.getPage('/feedback/my');
      const items = res.data || [];

      if (!items.length) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 32px var(--space-3); color: var(--text-muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">💬</div>
            <p class="small" style="margin: 0;">You have not submitted any feedback yet.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${items.map(f => `
            <div style="padding:12px 14px; background:var(--bg); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge badge-info">${esc(f.category)}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${badge(f.status)}
                  <span class="small muted" style="font-size:11px;">${formatDateTime(f.createdAt)}</span>
                </div>
              </div>
              <p style="font-size:14px; line-height:1.45; margin:0 0 8px; color:var(--text);">${esc(f.message)}</p>

              ${
                f.adminResponse ? `
                  <div style="margin-top:8px; padding:10px 12px; background:var(--surface); border-left:3px solid var(--primary); border-radius:0 var(--radius-sm) var(--radius-sm) 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <strong style="font-size:12px; color:var(--primary);">Admin Response:</strong>
                      <span class="small muted" style="font-size:11px;">${formatDateTime(f.respondedAt)}</span>
                    </div>
                    <div style="font-size:13px; color:var(--text); line-height:1.4;">${esc(f.adminResponse)}</div>
                  </div>
                ` : ''
              }
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      listEl.innerHTML = `<div style="color:var(--danger); padding:16px;">Failed to load history: ${esc(err.message)}</div>`;
    }
  }

  // Handle Feedback Submission
  const form = container.querySelector('#feedback-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      category: fd.get('category'),
      message: fd.get('message').trim()
    };

    try {
      await api.post('/feedback', payload);
      toast('Feedback submitted successfully! Thank you for helping us improve.', 'success');
      form.reset();
      loadHistory();
    } catch (err) {
      toast(err.message || 'Could not submit feedback', 'error');
    }
  });

  loadHistory();
}

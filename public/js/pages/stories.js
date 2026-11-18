import { api, auth } from '../api.js';
import { $, esc, avatar, badge, formatDateTime, toast, loading } from '../ui.js';

export async function renderStories(container) {
  let activeCategory = '';
  let activeTab = 'explore'; // 'explore' or 'my'
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const isAlumni = user?.role === 'ALUMNI' || user?.role === 'ADMIN';

  container.innerHTML = `
    <!-- Stories Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); gap: 16px; flex-wrap: wrap;">
      <div>
        <span class="caption" style="color: var(--primary);">Alumni Journeys</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Success Stories</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Inspiring career paths, tech innovations, and entrepreneurial journeys from graduates worldwide.
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        ${isAlumni ? `
          <button id="share-story-btn" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Share Your Journey
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="segmented-control" style="margin-bottom: var(--space-5); max-width: 320px;">
      <button type="button" id="tab-explore" class="${activeTab === 'explore' ? 'active' : ''}">Explore Stories</button>
      ${isAuth ? `<button type="button" id="tab-my" class="${activeTab === 'my' ? 'active' : ''}">My Submissions</button>` : ''}
    </div>

    <!-- Category Pill Filters -->
    <div id="stories-categories" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: var(--space-5);">
      <button class="btn btn-sm ${!activeCategory ? 'btn-primary' : 'btn-secondary'} cat-btn" data-cat="">All Categories</button>
      <button class="btn btn-sm ${activeCategory === 'CAREER' ? 'btn-primary' : 'btn-secondary'} cat-btn" data-cat="CAREER">Career & Tech</button>
      <button class="btn btn-sm ${activeCategory === 'STARTUP' ? 'btn-primary' : 'btn-secondary'} cat-btn" data-cat="STARTUP">Startups & Venture</button>
      <button class="btn btn-sm ${activeCategory === 'INNOVATION' ? 'btn-primary' : 'btn-secondary'} cat-btn" data-cat="INNOVATION">Engineering & Research</button>
      <button class="btn btn-sm ${activeCategory === 'LEADERSHIP' ? 'btn-primary' : 'btn-secondary'} cat-btn" data-cat="LEADERSHIP">Leadership</button>
    </div>

    <div id="stories-list"></div>
    <div id="story-modal-container"></div>
  `;

  async function loadData() {
    const listEl = container.querySelector('#stories-list');
    listEl.innerHTML = loading('Loading stories...');

    try {
      if (activeTab === 'my') {
        const res = await api.getPage('/stories/my');
        renderMyList(res.data || [], listEl);
      } else {
        const query = activeCategory ? { category: activeCategory } : {};
        const res = await api.getPage('/stories', query);
        renderExploreList(res.data || [], listEl);
      }
    } catch (err) {
      listEl.innerHTML = `<div class="card" style="color:var(--danger); text-align:center; padding:32px;">Failed to load stories: ${esc(err.message)}</div>`;
    }
  }

  function renderExploreList(stories, el) {
    if (!stories.length) {
      el.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="font-size: 32px; margin-bottom: 12px;">📖</div>
          <h3 style="margin-bottom: 6px;">No stories found</h3>
          <p class="small muted" style="margin: 0;">Be the first graduate to share an inspiring journey!</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="grid grid-3">
        ${stories.map(s => `
          <div class="card card-interactive story-card" data-id="${s.storyId}" style="display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span class="badge badge-info">${esc(s.category)}</span>
                <span class="small muted" style="font-size:12px;">${formatDateTime(s.createdAt)}</span>
              </div>
              <h3 style="font-size: 17px; margin-bottom: 10px; line-height: 1.35;">${esc(s.title)}</h3>
              <p class="text-muted small" style="line-height: 1.5; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                ${esc(s.body)}
              </p>
            </div>

            <div style="padding-top: 12px; border-top: 1px solid var(--border-subtle); display:flex; align-items:center; gap:10px;">
              ${avatar({ fullName: s.authorName }, 36)}
              <div style="overflow:hidden;">
                <strong style="font-size: 13px; display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${esc(s.authorName)}</strong>
                <span class="small muted" style="font-size:11px;">${esc(s.authorCompany || s.authorDesignation || 'Alumni')}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.story-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const story = stories.find(item => item.storyId == id);
        if (story) openStoryModal(story);
      });
    });
  }

  function renderMyList(stories, el) {
    if (!stories.length) {
      el.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="font-size: 32px; margin-bottom: 12px;">✍️</div>
          <h3 style="margin-bottom: 6px;">You haven't submitted any stories yet</h3>
          <p class="small muted" style="margin: 0 0 16px;">Share your career progress, insights, and advice with students and alumni.</p>
          <button id="my-empty-share-btn" class="btn btn-primary btn-sm">Submit Story</button>
        </div>
      `;
      el.querySelector('#my-empty-share-btn')?.addEventListener('click', openSubmissionModal);
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Your Story Submissions</h3>
          <span class="small muted">${stories.length} Total</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Submitted On</th><th>Moderation Status</th><th>Reviewer Note</th></tr></thead>
            <tbody>
              ${stories.map(s => `
                <tr>
                  <td><strong>${esc(s.title)}</strong></td>
                  <td><span class="badge badge-info">${esc(s.category)}</span></td>
                  <td class="small muted">${formatDateTime(s.createdAt)}</td>
                  <td>${badge(s.status)}</td>
                  <td class="small muted">${s.reviewNote ? esc(s.reviewNote) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function openStoryModal(story) {
    const modalEl = container.querySelector('#story-modal-container');
    modalEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 640px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <span class="badge badge-info">${esc(story.category)}</span>
            <button id="close-story-modal" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
          </div>

          <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 12px; line-height: 1.3;">${esc(story.title)}</h2>

          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding: 12px; background:var(--bg); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            ${avatar({ fullName: story.authorName }, 44)}
            <div>
              <strong style="font-size: 14px; display:block;">${esc(story.authorName)}</strong>
              <span class="small text-muted" style="font-size: 12px;">${esc(story.authorDesignation || 'Engineering Professional')}${story.authorCompany ? ` at ${esc(story.authorCompany)}` : ''} • Class of ${story.authorGraduationYear || '—'}</span>
            </div>
          </div>

          <div style="font-size: 15px; line-height: 1.7; color: var(--text); white-space: pre-line; margin-bottom: 24px;">
            ${esc(story.body)}
          </div>

          <div style="text-align: right; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
            <button id="close-modal-btn" class="btn btn-secondary">Close Story</button>
          </div>
        </div>
      </div>
    `;

    function close() { modalEl.innerHTML = ''; }
    modalEl.querySelector('#close-story-modal').onclick = close;
    modalEl.querySelector('#close-modal-btn').onclick = close;
  }

  function openSubmissionModal() {
    const modalEl = container.querySelector('#story-modal-container');
    modalEl.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 600px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h2 style="font-size: 20px; font-weight: 700; margin: 0;">Share Your Journey</h2>
            <button id="close-submit-modal" class="btn btn-ghost btn-sm" style="font-size:18px;">✕</button>
          </div>

          <form id="submit-story-form" style="display:flex; flex-direction:column; gap:14px;">
            <div class="field">
              <label class="label">Story Title</label>
              <input type="text" name="title" class="input" placeholder="e.g. Scaling Distributed Microservices at Google" required minlength="5" />
            </div>

            <div class="field">
              <label class="label">Category</label>
              <select name="category" class="select">
                <option value="CAREER">Career & Tech</option>
                <option value="STARTUP">Startups & Venture</option>
                <option value="INNOVATION">Engineering & Research</option>
                <option value="LEADERSHIP">Leadership</option>
                <option value="COMMUNITY">Community & Mentoring</option>
              </select>
            </div>

            <div class="field">
              <label class="label">Your Story / Experience</label>
              <textarea name="body" class="textarea" style="min-height: 140px;" placeholder="Share your key career milestones, how campus prepared you, and practical advice for juniors..." required minlength="20"></textarea>
            </div>

            <div class="field">
              <label class="label">Media / Portfolio URL (Optional)</label>
              <input type="url" name="mediaUrl" class="input" placeholder="https://..." />
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button type="button" id="cancel-submit-btn" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit for Review</button>
            </div>
          </form>
        </div>
      </div>
    `;

    function close() { modalEl.innerHTML = ''; }
    modalEl.querySelector('#close-submit-modal').onclick = close;
    modalEl.querySelector('#cancel-submit-btn').onclick = close;

    const form = modalEl.querySelector('#submit-story-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title').trim(),
        category: fd.get('category'),
        body: fd.get('body').trim(),
        mediaUrl: fd.get('mediaUrl') ? fd.get('mediaUrl').trim() : null
      };

      try {
        await api.post('/stories', payload);
        toast('Your story has been submitted for admin approval!', 'success');
        close();
        activeTab = 'my';
        container.querySelector('#tab-my')?.classList.add('active');
        container.querySelector('#tab-explore')?.classList.remove('active');
        loadData();
      } catch (err) {
        toast(err.message || 'Submission failed', 'error');
      }
    });
  }

  // Setup Event Listeners
  container.querySelector('#share-story-btn')?.addEventListener('click', openSubmissionModal);

  container.querySelector('#tab-explore')?.addEventListener('click', () => {
    activeTab = 'explore';
    container.querySelector('#tab-explore').classList.add('active');
    container.querySelector('#tab-my')?.classList.remove('active');
    loadData();
  });

  container.querySelector('#tab-my')?.addEventListener('click', () => {
    activeTab = 'my';
    container.querySelector('#tab-my').classList.add('active');
    container.querySelector('#tab-explore').classList.remove('active');
    loadData();
  });

  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      container.querySelectorAll('.cat-btn').forEach(b => {
        b.className = b.dataset.cat === activeCategory ? 'btn btn-sm btn-primary cat-btn' : 'btn btn-sm btn-secondary cat-btn';
      });
      loadData();
    });
  });

  loadData();
}

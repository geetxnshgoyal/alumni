import { api } from '../api.js';
import { $, esc, badge, toast, loading } from '../ui.js';

export async function renderProfile(container) {
  container.innerHTML = loading('Loading your profile...');

  try {
    const profile = await api.get('/profile/me');
    renderForm(profile);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--danger); padding: 30px;">
        Failed to load profile: ${esc(err.message)}
      </div>
    `;
  }

  function renderForm(p) {
    const isAlumni = p.role === 'ALUMNI';

    container.innerHTML = `
      <div style="max-width: 760px; margin: 0 auto;">
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h1 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px;">${esc(p.fullName)}</h1>
              <div class="small muted">${esc(p.email)} • ${badge(p.role)} ${p.verificationStatus ? badge(p.verificationStatus) : ''}</div>
            </div>
            <div class="small muted">Dept: <strong>${esc(p.deptCode || '—')}</strong></div>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 20px;">Edit Profile Information</h2>
          <form id="profile-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Phone Number</label>
              <input type="text" name="phone" value="${esc(p.phone || '')}" placeholder="+919876543210"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>

            ${isAlumni ? `
              <div class="grid grid-2">
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Current Company</label>
                  <input type="text" name="currentCompany" value="${esc(p.currentCompany || '')}" placeholder="Google, Microsoft, etc."
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Designation / Title</label>
                  <input type="text" name="designation" value="${esc(p.designation || '')}" placeholder="Staff Software Engineer"
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>

              <div class="grid grid-3">
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Industry</label>
                  <input type="text" name="industry" value="${esc(p.industry || '')}" placeholder="Technology, Finance..."
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">City</label>
                  <input type="text" name="city" value="${esc(p.city || '')}" placeholder="Bengaluru"
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Country</label>
                  <input type="text" name="country" value="${esc(p.country || '')}" placeholder="India"
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>

              <div>
                <label class="small muted" style="display: block; margin-bottom: 4px;">LinkedIn Profile URL</label>
                <input type="url" name="linkedinUrl" value="${esc(p.linkedinUrl || '')}" placeholder="https://linkedin.com/in/username"
                       style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
              </div>

              <div>
                <label class="small muted" style="display: block; margin-bottom: 4px;">Bio / Professional Summary</label>
                <textarea name="bio" rows="3" placeholder="Tell alumni and students about your career journey..."
                          style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">${esc(p.bio || '')}</textarea>
              </div>
            ` : `
              <div class="grid grid-2">
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Current Semester</label>
                  <input type="number" name="currentSemester" value="${p.currentSemester || ''}" min="1" max="12"
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
                <div>
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Expected Graduation Year</label>
                  <input type="number" name="expectedGradYear" value="${p.expectedGradYear || ''}" min="2024" max="2035"
                         style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>
            `}

            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Skills (comma-separated)</label>
              <input type="text" name="skills" value="${esc((p.skills || []).join(', '))}" placeholder="Node.js, PostgreSQL, Docker, Python"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>

            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Interests (comma-separated)</label>
              <input type="text" name="interests" value="${esc((p.interests || []).join(', '))}" placeholder="Mentoring, Open Source, Startups"
                     style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>

            <button type="submit" id="save-btn" class="btn" style="padding: 10px 20px; align-self: flex-start; margin-top: 8px;">
              Save Profile Changes
            </button>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#profile-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = container.querySelector('#save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const formData = new FormData(form);
      const raw = Object.fromEntries(formData.entries());

      const payload = {};
      if (raw.phone !== undefined) payload.phone = raw.phone.trim() || null;
      if (raw.skills !== undefined) {
        payload.skills = raw.skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (raw.interests !== undefined) {
        payload.interests = raw.interests.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (isAlumni) {
        if (raw.currentCompany !== undefined) payload.currentCompany = raw.currentCompany.trim() || null;
        if (raw.designation !== undefined) payload.designation = raw.designation.trim() || null;
        if (raw.industry !== undefined) payload.industry = raw.industry.trim() || null;
        if (raw.city !== undefined) payload.city = raw.city.trim() || null;
        if (raw.country !== undefined) payload.country = raw.country.trim() || null;
        if (raw.bio !== undefined) payload.bio = raw.bio.trim() || null;
        if (raw.linkedinUrl !== undefined) payload.linkedinUrl = raw.linkedinUrl.trim() || null;
      } else {
        if (raw.currentSemester) payload.currentSemester = Number(raw.currentSemester);
        if (raw.expectedGradYear) payload.expectedGradYear = Number(raw.expectedGradYear);
      }

      try {
        const updated = await api.patch('/profile/me', payload);
        toast('Profile updated successfully!');
        renderForm(updated);
      } catch (err) {
        toast(err.message || 'Failed to update profile', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile Changes';
      }
    });
  }
}

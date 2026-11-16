import { api } from '../api.js';
import { $, esc, badge, toast, loading, avatar } from '../ui.js';

export async function renderProfile(container) {
  container.innerHTML = loading('Loading your profile...');

  try {
    const profile = await api.get('/profile/me');
    renderForm(profile);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align: center; color: var(--danger); padding: var(--space-6);">
        Failed to load profile: ${esc(err.message)}
      </div>
    `;
  }

  function renderForm(p) {
    const isAlumni = p.role === 'ALUMNI';

    container.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto;">
        <!-- Profile Header Card -->
        <div class="card" style="margin-bottom: var(--space-5);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              ${avatar({ fullName: p.fullName }, 64)}
              <div>
                <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 6px;">${esc(p.fullName)}</h1>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="small text-muted">${esc(p.email)}</span>
                  ${badge(p.role)}
                  ${p.verificationStatus ? badge(p.verificationStatus) : ''}
                </div>
              </div>
            </div>

            <div style="text-align: right;">
              <span class="caption" style="display: block; color: var(--text-muted);">Department</span>
              <strong style="color: var(--primary); font-size: 15px;">${esc(p.deptName || p.deptCode || 'Engineering')}</strong>
            </div>
          </div>
        </div>

        <!-- Edit Form Card -->
        <div class="card">
          <div class="card-header">
            <h3>Profile & Career Information</h3>
            <span class="small muted">Update your public visibility</span>
          </div>

          <form id="profile-form" style="display: flex; flex-direction: column;">
            <div class="field">
              <label class="label">Contact Phone</label>
              <input type="text" name="phone" class="input" value="${esc(p.phone || '')}" placeholder="+91 98765 43210" />
            </div>

            ${
              isAlumni
                ? `
              <div class="grid grid-2">
                <div class="field">
                  <label class="label">Current Organization / Employer</label>
                  <input type="text" name="currentCompany" class="input" value="${esc(p.currentCompany || '')}" placeholder="e.g. Google, Tata, ISRO" />
                </div>
                <div class="field">
                  <label class="label">Professional Title / Designation</label>
                  <input type="text" name="designation" class="input" value="${esc(p.designation || '')}" placeholder="e.g. Lead Software Architect" />
                </div>
              </div>

              <div class="grid grid-3">
                <div class="field">
                  <label class="label">Industry Domain</label>
                  <input type="text" name="industry" class="input" value="${esc(p.industry || '')}" placeholder="e.g. Technology, Automotive" />
                </div>
                <div class="field">
                  <label class="label">City</label>
                  <input type="text" name="city" class="input" value="${esc(p.city || '')}" placeholder="e.g. Bengaluru" />
                </div>
                <div class="field">
                  <label class="label">Country</label>
                  <input type="text" name="country" class="input" value="${esc(p.country || '')}" placeholder="e.g. India" />
                </div>
              </div>

              <div class="field">
                <label class="label">LinkedIn Profile URL</label>
                <input type="url" name="linkedinUrl" class="input" value="${esc(p.linkedinUrl || '')}" placeholder="https://linkedin.com/in/username" />
              </div>
            `
                : `
              <div class="grid grid-2">
                <div class="field">
                  <label class="label">Current Academic Semester</label>
                  <input type="number" name="currentSemester" class="input" value="${p.currentSemester || ''}" min="1" max="12" />
                </div>
                <div class="field">
                  <label class="label">Expected Graduation Year</label>
                  <input type="number" name="expectedGradYear" class="input" value="${p.expectedGradYear || ''}" min="2024" max="2032" />
                </div>
              </div>
            `
            }

            <div class="field">
              <label class="label">Professional Summary / Bio</label>
              <textarea name="bio" class="textarea" placeholder="Share your career journey, achievements, or mentorship focus...">${esc(p.bio || '')}</textarea>
            </div>

            <div class="field">
              <label class="label">Professional Skills (comma separated)</label>
              <input type="text" id="skills-input" class="input" value="${esc((p.skills || []).join(', '))}" placeholder="e.g. Distributed Systems, PostgreSQL, Project Management" />
            </div>

            <div class="field">
              <label class="label">Interests & Mentorship Topics (comma separated)</label>
              <input type="text" id="interests-input" class="input" value="${esc((p.interests || []).join(', '))}" placeholder="e.g. Startups, Research, Career Guidance" />
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: var(--space-4);">
              <button type="submit" id="save-profile-btn" class="btn btn-primary" style="min-width: 140px;">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#profile-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = container.querySelector('#save-profile-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Parse tags
      const skillsStr = container.querySelector('#skills-input').value;
      const interestsStr = container.querySelector('#interests-input').value;

      payload.skills = skillsStr ? skillsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
      payload.interests = interestsStr ? interestsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];

      if (payload.currentSemester) payload.currentSemester = Number(payload.currentSemester);
      if (payload.expectedGradYear) payload.expectedGradYear = Number(payload.expectedGradYear);

      // Clean empty strings to null
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null;
      }

      try {
        await api.patch('/profile/me', payload);
        toast('Profile updated successfully!', 'success');
        renderProfile(container);
      } catch (err) {
        toast(err.message || 'Failed to update profile', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    });
  }
}

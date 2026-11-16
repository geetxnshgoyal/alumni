import { api, auth } from '../api.js';
import { toast, esc } from '../ui.js';

export async function renderAuth(container) {
  // Check if URL has ?mode=register
  const isRegisterParam = window.location.hash.includes('mode=register');
  let isLogin = !isRegisterParam;
  let role = 'ALUMNI';

  // Fetch departments for registration dropdown
  let departments = [];
  try {
    const dRes = await api.get('/departments');
    departments = dRes?.data || dRes || [];
  } catch {
    departments = [];
  }

  function render() {
    container.innerHTML = `
      <div style="max-width: 480px; margin: var(--space-6) auto;">
        <div class="card" style="box-shadow: var(--shadow-md); padding: var(--space-6);">
          <!-- GradLink Auth Header -->
          <div style="text-align: center; margin-bottom: var(--space-5);">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 12px;">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L3 11L16 18L29 11L16 4Z" fill="#2457A7"/>
                <path d="M7 14.5V21C7 24.5 11 27.5 16 27.5C21 27.5 25 24.5 25 21V14.5" stroke="#E8795B" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="16" cy="12" r="2.5" fill="#F5C66A"/>
              </svg>
            </div>
            <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">
              <span class="brand-grad">Grad</span><span class="brand-link">Link</span>
            </h1>
            <p class="small text-muted" style="margin: 0;">Multi-College Alumni Ecosystem</p>
          </div>

          <!-- Segmented Tabs -->
          <div class="segmented-control" style="margin-bottom: var(--space-5);">
            <button type="button" id="tab-login" class="${isLogin ? 'active' : ''}">Sign In</button>
            <button type="button" id="tab-register" class="${!isLogin ? 'active' : ''}">Create Account</button>
          </div>

          <form id="auth-form" style="display: flex; flex-direction: column;">
            <div id="auth-error" class="badge badge-danger" style="display: none; padding: 10px 14px; margin-bottom: 16px; width: 100%; border-radius: var(--radius-sm); font-size: 13px;"></div>

            ${
              !isLogin
                ? `
              <!-- Role selector -->
              <div class="field">
                <label class="label">I am joining as</label>
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn role-btn ${role === 'ALUMNI' ? 'btn-primary' : 'btn-secondary'}" data-role="ALUMNI" style="flex:1;">Graduated Alumni</button>
                  <button type="button" class="btn role-btn ${role === 'STUDENT' ? 'btn-primary' : 'btn-secondary'}" data-role="STUDENT" style="flex:1;">Current Student</button>
                </div>
                <input type="hidden" name="role" id="auth-role" value="${role}" />
              </div>

              <div class="field">
                <label class="label">Full Legal Name</label>
                <input type="text" name="fullName" class="input" required placeholder="e.g. Aarav Patel" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="field">
                  <label class="label">Department</label>
                  <select name="deptId" class="select" required>
                    <option value="">Select Dept</option>
                    ${departments.map((d) => `<option value="${d.deptId}">${esc(d.deptCode)} — ${esc(d.deptName)}</option>`).join('')}
                  </select>
                </div>

                <div class="field">
                  <label class="label">Enrollment No.</label>
                  <input type="text" name="enrollmentNo" class="input" required placeholder="e.g. 16CE045" />
                </div>
              </div>

              ${
                role === 'ALUMNI'
                  ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="field">
                    <label class="label">Degree</label>
                    <input type="text" name="degree" class="input" required placeholder="e.g. B.E." value="B.E." />
                  </div>
                  <div class="field">
                    <label class="label">Graduation Year</label>
                    <input type="number" name="graduationYear" class="input" required min="1950" max="2026" placeholder="2020" value="2020" />
                  </div>
                </div>
              `
                  : `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="field">
                    <label class="label">Current Semester</label>
                    <input type="number" name="currentSemester" class="input" required min="1" max="12" placeholder="6" value="6" />
                  </div>
                  <div class="field">
                    <label class="label">Expected Grad Year</label>
                    <input type="number" name="expectedGradYear" class="input" required min="2024" max="2032" placeholder="2027" value="2027" />
                  </div>
                </div>
              `
              }
            `
                : ''
            }

            <div class="field">
              <label class="label">Email Address</label>
              <input type="email" name="email" id="email-field" class="input" required placeholder="e.g. name@gec.edu or name@alumni.test" />
            </div>

            <div class="field">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="label" style="margin: 0;">Password</label>
                ${isLogin ? '<span class="small muted" style="font-size:12px;">Default Demo: Alumni@123</span>' : ''}
              </div>
              <input type="password" name="password" id="password-field" class="input" required minlength="8" placeholder="••••••••" />
            </div>

            <button type="submit" id="submit-btn" class="btn btn-primary" style="width: 100%; margin-top: var(--space-3); height: 44px;">
              ${isLogin ? 'Sign In to GradLink' : 'Complete Registration'}
            </button>
          </form>

          ${
            isLogin
              ? `
            <!-- Fast Demo Autofill Helper -->
            <div style="margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border);">
              <span class="caption" style="display:block; margin-bottom: 8px; color: var(--text-dim);">Quick Demo Logins</span>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm btn-secondary demo-btn" data-email="admin@alumni.test" data-pass="Admin@12345">
                  Admin Demo
                </button>
                <button type="button" class="btn btn-sm btn-secondary demo-btn" data-email="aarav@alumni.test" data-pass="Alumni@123">
                  Alumni (Aarav)
                </button>
                <button type="button" class="btn btn-sm btn-secondary demo-btn" data-email="harsh@student.test" data-pass="Alumni@123">
                  Student (Harsh)
                </button>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;

    // Tab buttons
    container.querySelector('#tab-login').addEventListener('click', () => {
      isLogin = true;
      render();
    });

    container.querySelector('#tab-register').addEventListener('click', () => {
      isLogin = false;
      render();
    });

    // Role switcher in registration
    container.querySelectorAll('.role-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        role = btn.dataset.role;
        render();
      });
    });

    // Demo buttons autofill
    container.querySelectorAll('.demo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelector('#email-field').value = btn.dataset.email;
        container.querySelector('#password-field').value = btn.dataset.pass;
        container.querySelector('#auth-form').dispatchEvent(new Event('submit'));
      });
    });

    // Submit handler
    const form = container.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = container.querySelector('#auth-error');
      const submitBtn = container.querySelector('#submit-btn');
      errBox.style.display = 'none';

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      // Coerce numeric fields
      if (payload.deptId) payload.deptId = Number(payload.deptId);
      if (payload.graduationYear) payload.graduationYear = Number(payload.graduationYear);
      if (payload.currentSemester) payload.currentSemester = Number(payload.currentSemester);
      if (payload.expectedGradYear) payload.expectedGradYear = Number(payload.expectedGradYear);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';

      try {
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const res = await api.post(endpoint, payload);
        const { token, user } = res;
        auth.setSession(token, user);
        toast(isLogin ? `Welcome to GradLink, ${user.fullName || user.email}!` : 'Account successfully registered!');
        window.location.hash = '#/';
        window.dispatchEvent(new CustomEvent('auth-changed'));
      } catch (err) {
        errBox.textContent = err.message || 'Authentication failed. Please check credentials.';
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Sign In to GradLink' : 'Complete Registration';
      }
    });
  }

  render();
}

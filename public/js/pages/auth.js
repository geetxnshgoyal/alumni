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

          <!-- Google OAuth 2.0 / OIDC Button (Lecture 16 Slide 17-21) -->
          <button type="button" id="google-auth-btn" class="btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: #FFFFFF; color: #3C4043; border: 1px solid var(--border); box-shadow: var(--shadow-sm); font-weight: 600; padding: 10px 16px; margin-bottom: var(--space-4); border-radius: var(--radius-sm); transition: all 0.2s ease;">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google
          </button>

          <div style="display: flex; align-items: center; margin-bottom: var(--space-4);">
            <div style="flex: 1; height: 1px; background: var(--border);"></div>
            <span style="padding: 0 12px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">or with email</span>
            <div style="flex: 1; height: 1px; background: var(--border);"></div>
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

    // Google OAuth sign-in / registration (Lecture 16 Slide 17-21)
    const googleBtn = container.querySelector('#google-auth-btn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = 'Authenticating with Google...';
          const defaultDept = departments.length ? departments[0].deptId : 1;
          const mockEmail = `alum.google.${Date.now().toString().slice(-4)}@gmail.com`;
          const res = await api.post('/auth/oauth/google', {
            idToken: `mock_google_token_email=${encodeURIComponent(mockEmail)}&name=Google%20Verified%20Alum&sub=google_${Date.now()}`,
            role: isLogin ? 'ALUMNI' : role,
            deptId: defaultDept,
          });
          const { token, user } = res;
          auth.setSession(token, user);
          toast(`Signed in with Google as ${user.fullName || user.email}!`);
          window.location.hash = '#/';
          window.dispatchEvent(new CustomEvent('auth-changed'));
        } catch (err) {
          const errBox = container.querySelector('#auth-error');
          errBox.textContent = err.message || 'Google sign-in failed.';
          errBox.style.display = 'block';
        } finally {
          googleBtn.disabled = false;
        }
      });
    }

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

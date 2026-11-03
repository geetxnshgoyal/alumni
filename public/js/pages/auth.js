import { api, auth } from '../api.js';
import { toast } from '../ui.js';

export function renderAuth(container) {
  let isLogin = true;

  function render() {
    container.innerHTML = `
      <div style="max-width: 440px; margin: 40px auto;">
        <div class="card">
          <div class="segmented" style="width: 100%; margin-bottom: 24px;">
            <button id="tab-login" class="${isLogin ? 'active' : ''}" style="flex: 1;">Sign In</button>
            <button id="tab-register" class="${!isLogin ? 'active' : ''}" style="flex: 1;">Create Account</button>
          </div>

          <form id="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
            ${!isLogin ? `
              <div style="display: flex; gap: 12px;">
                <div style="flex: 1;">
                  <label class="small muted" style="display: block; margin-bottom: 4px;">First Name</label>
                  <input type="text" name="first_name" required placeholder="Geetansh" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
                <div style="flex: 1;">
                  <label class="small muted" style="display: block; margin-bottom: 4px;">Last Name</label>
                  <input type="text" name="last_name" required placeholder="Goyal" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>
              <div>
                <label class="small muted" style="display: block; margin-bottom: 4px;">Role</label>
                <select name="role" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: #fff;">
                  <option value="ALUMNI">Alumni</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
            ` : ''}

            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Email Address</label>
              <input type="email" name="email" required placeholder="name@gec.edu" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>

            <div>
              <label class="small muted" style="display: block; margin-bottom: 4px;">Password</label>
              <input type="password" name="password" required minlength="8" placeholder="••••••••" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;">
            </div>

            <div id="auth-error" style="color: var(--danger); font-size: 0.85rem; display: none;"></div>

            <button type="submit" id="submit-btn" class="btn" style="width: 100%; padding: 10px; margin-top: 8px;">
              ${isLogin ? 'Sign In' : 'Register Account'}
            </button>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#tab-login').addEventListener('click', () => {
      isLogin = true;
      render();
    });

    container.querySelector('#tab-register').addEventListener('click', () => {
      isLogin = false;
      render();
    });

    const form = container.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = container.querySelector('#auth-error');
      const submitBtn = container.querySelector('#submit-btn');
      errBox.style.display = 'none';

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';

      try {
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const res = await api.post(endpoint, payload);
        const { token, user } = res;
        auth.setSession(token, user);
        toast(isLogin ? `Welcome back, ${user.first_name || user.email}!` : 'Account created successfully!');
        window.location.hash = '#/';
        window.dispatchEvent(new CustomEvent('auth-changed'));
      } catch (err) {
        errBox.textContent = err.message || 'Authentication failed.';
        errBox.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Sign In' : 'Register Account';
      }
    });
  }

  render();
}

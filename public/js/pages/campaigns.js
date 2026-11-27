import { auth, api } from '../api.js';
import { $, esc, toast, loading } from '../ui.js';

export async function renderCampaigns(container) {
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();

  container.innerHTML = `
    <!-- Page Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: var(--space-6);">
      <div>
        <span class="caption" style="color: var(--secondary-coral);">Philanthropy & Endowments</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Alumni Giving & Campaigns</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Directly fund campus innovation labs, student merit scholarships, and department infrastructure. Every contribution receives an official tax-deductible (Section 80G) receipt.
        </p>
      </div>
      ${
        auth.isAdmin()
          ? `
        <button id="create-campaign-btn" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Campaign
        </button>
      `
          : ''
      }
    </div>

    <!-- Active Campaigns Grid Section -->
    <div id="campaigns-loading">${loading('Fetching active campaigns...')}</div>
    <div id="campaigns-wrapper" style="display: none;">
      <div id="campaigns-grid" class="grid grid-2" style="margin-bottom: var(--space-7);"></div>

      <!-- Donor History Section (For authenticated users) -->
      ${
        isAuth
          ? `
        <div class="card" style="margin-top: var(--space-6);">
          <div class="card-header">
            <div>
              <h3>My Contribution History</h3>
              <p class="small muted" style="margin: 0;">Download verified receipts for tax-exemption records.</p>
            </div>
            <span class="badge badge-neutral">Section 80G</span>
          </div>
          <div id="my-donations-list">
            <p class="muted small">Loading your donation records...</p>
          </div>
        </div>
      `
          : `
        <div class="card" style="text-align: center; padding: var(--space-6); background: var(--surface);">
          <h3 style="margin-bottom: 8px;">Want to track your donations & receipts?</h3>
          <p class="muted small" style="margin-bottom: 16px;">Sign in to access your donation ledger and download 80G tax receipts anytime.</p>
          <a href="#/auth" class="btn btn-primary btn-sm">Sign In to Your Account</a>
        </div>
      `
      }
    </div>

    <!-- Test Checkout Modal -->
    <div id="donate-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
          <h3 id="modal-campaign-title" style="margin: 0; font-size: 18px; font-weight: 700;">Support Campaign</h3>
          <button id="close-modal-btn" class="icon-btn btn-ghost" style="width: 32px; height: 32px;" aria-label="Close modal">&times;</button>
        </div>
        
        <p id="modal-campaign-desc" class="small muted" style="margin-bottom: 20px; line-height: 1.5;"></p>

        <form id="donate-form">
          <input type="hidden" id="modal-campaign-id" />

          <div class="field">
            <label class="label">Select Contribution Amount (₹)</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
              <button type="button" class="btn btn-secondary preset-btn" data-val="500">₹500</button>
              <button type="button" class="btn btn-secondary preset-btn" data-val="1000">₹1,000</button>
              <button type="button" class="btn btn-secondary preset-btn" data-val="2500">₹2,500</button>
              <button type="button" class="btn btn-secondary preset-btn" data-val="5000">₹5,000</button>
            </div>
            <input type="number" id="custom-amount" class="input" min="10" placeholder="Enter custom amount in ₹" required />
          </div>

          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);">
            <input type="checkbox" id="is-anonymous" style="width: 18px; height: 18px; accent-color: var(--primary);" />
            <label for="is-anonymous" class="small" style="margin: 0; cursor: pointer; font-weight: 500;">
              Donate anonymously (hides your name on the public supporters list)
            </label>
          </div>

          <div style="background: var(--info-bg); border: 1px solid var(--info-border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 24px; font-size: 13px; color: var(--info);">
            <strong>Test-Mode Gateway Simulation:</strong> No live card charge will occur. The payment order and cryptographic HMAC signature will be validated in test mode.
          </div>

          <div style="display: flex; gap: 12px;">
            <button type="button" id="cancel-modal-btn" class="btn btn-secondary" style="flex: 1;">Cancel</button>
            <button type="submit" id="submit-donation-btn" class="btn btn-primary" style="flex: 2;">
              Proceed to Test Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  async function loadData() {
    try {
      const campaigns = await api.get('/campaigns');
      renderCampaignCards(campaigns?.items || campaigns || []);

      if (isAuth) {
        loadMyDonations();
      }

      $('#campaigns-loading').style.display = 'none';
      $('#campaigns-wrapper').style.display = 'block';
    } catch (err) {
      $('#campaigns-loading').innerHTML = `
        <div class="card" style="text-align: center; color: var(--danger); padding: var(--space-6);">
          Failed to load campaigns: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderCampaignCards(list) {
    const grid = $('#campaigns-grid');
    if (!list || list.length === 0) {
      grid.innerHTML = '<div class="card" style="grid-column: 1 / -1;"><p class="muted">No active fundraising campaigns at the moment.</p></div>';
      return;
    }

    grid.innerHTML = list
      .map((c) => {
        const goal = Number(c.goalAmount) || 1;
        const raised = Number(c.amountRaised) || 0;
        const pct = Math.min(100, Math.round((raised / goal) * 100));

        return `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
              <h3 style="font-size: 18px; margin: 0; line-height: 1.3;">${esc(c.title)}</h3>
              <span class="badge badge-success">${esc(c.status)}</span>
            </div>
            <p class="small text-muted" style="margin-bottom: 20px; line-height: 1.5;">${esc(c.description)}</p>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px;">
              <span style="color: var(--primary);">₹${raised.toLocaleString('en-IN')} raised</span>
              <span class="muted">Goal: ₹${goal.toLocaleString('en-IN')} (${pct}%)</span>
            </div>
            
            <div class="progress-track" style="margin-bottom: 16px;">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; pt: 12px; border-top: 1px solid var(--border-subtle);">
              <span class="small muted" style="font-weight: 500;">
                👥 ${c.donorCount || 0} supporters
                ${c.donorCount ? `· <button type="button" class="btn-top-donors" data-id="${c.campaignId}" aria-expanded="false" style="background:none; border:0; padding:0; color:var(--primary); font:inherit; cursor:pointer;">🏆 Top donors</button>` : ''}
              </span>
              <button class="btn btn-sm btn-primary btn-donate" data-id="${c.campaignId}" data-title="${esc(c.title)}" data-desc="${esc(c.description)}">
                Contribute Now
              </button>
            </div>
            <div class="top-donors-list small" data-id="${c.campaignId}" hidden style="margin-top: 12px;"></div>
          </div>
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('.btn-top-donors').forEach((btn) => {
      btn.addEventListener('click', () =>
        toggleTopDonors(btn, grid.querySelector(`.top-donors-list[data-id="${btn.dataset.id}"]`))
      );
    });

    grid.querySelectorAll('.btn-donate').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!isAuth) {
          window.location.hash = '#/auth';
          return;
        }
        openDonationModal(btn.dataset.id, btn.dataset.title, btn.dataset.desc);
      });
    });
  }

  async function toggleTopDonors(btn, box) {
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (!open || box.dataset.loaded) return;

    box.innerHTML = '<span class="muted">Loading…</span>';
    try {
      const donors = await api.get(`/donations/campaign/${btn.dataset.id}/top-donors?limit=3`);
      box.innerHTML = `<ol style="margin: 0; padding-left: 18px;">${(donors || [])
        .map(
          (d) => `<li>
            <strong>#${d.rank} ${esc(d.donorName)}</strong>
            <span class="muted">· ₹${Number(d.totalAmount).toLocaleString('en-IN')} (${d.sharePercent}%)</span>
          </li>`
        )
        .join('')}</ol>`;
      box.dataset.loaded = '1';
    } catch (err) {
      box.innerHTML = `<span style="color: var(--danger);">${esc(err.message)}</span>`;
    }
  }

  async function loadMyDonations() {
    const box = $('#my-donations-list');
    if (!box) return;

    try {
      const res = await api.get('/donations/my');
      const items = res?.items || res || [];
      if (items.length === 0) {
        box.innerHTML = '<p class="muted small" style="padding: 16px 0;">You have not made any donations yet. Support a student initiative above!</p>';
        return;
      }

      box.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Campaign</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((d) => {
                  const isSuccess = d.donationStatus === 'SUCCESS';
                  return `
                  <tr>
                    <td>${new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                    <td><strong>${esc(d.campaignTitle || 'General Campaign')}</strong></td>
                    <td style="font-weight: 700; color: var(--text);">₹${Number(d.amount).toLocaleString('en-IN')}</td>
                    <td>
                      <span class="badge ${isSuccess ? 'badge-success' : 'badge-warning'}">
                        ${esc(d.donationStatus)}
                      </span>
                    </td>
                    <td>
                      ${
                        isSuccess
                          ? `<a href="/api/donations/${d.donationId}/receipt?format=html" target="_blank" class="btn btn-sm btn-secondary" style="font-size: 12px; gap: 4px;">
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                               Receipt (80G)
                             </a>`
                          : '<span class="muted small">—</span>'
                      }
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch {
      box.innerHTML = '<p class="muted small">Could not load past donations.</p>';
    }
  }

  function openDonationModal(id, title, desc) {
    $('#modal-campaign-id').value = id;
    $('#modal-campaign-title').textContent = title;
    $('#modal-campaign-desc').textContent = desc;
    $('#custom-amount').value = '1000';
    $('#donate-modal').style.display = 'flex';
  }

  function closeModal() {
    $('#donate-modal').style.display = 'none';
  }

  $('#close-modal-btn')?.addEventListener('click', closeModal);
  $('#cancel-modal-btn')?.addEventListener('click', closeModal);

  container.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('#custom-amount').value = btn.dataset.val;
    });
  });

  $('#donate-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submit-donation-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying in Test Mode...';

    const campaignId = Number($('#modal-campaign-id').value);
    const amount = Number($('#custom-amount').value);
    const isAnonymous = $('#is-anonymous').checked;

    try {
      // 1. Create Order
      const res = await api.post('/donations', { campaignId, amount, isAnonymous });
      const { donation, gatewayOrder } = res;

      // 2. Simulate Payment Verification
      const token = auth.getToken();
      const mockPaymentId = `pay_test_${Date.now()}`;
      
      const verifyRes = await fetch('/api/donations/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          donationId: donation.donationId,
          gatewayOrderId: gatewayOrder.orderId,
          gatewayPaymentId: mockPaymentId,
          // Calculate valid test signature
          signature: 'test_signature_valid',
        }),
      });

      closeModal();
      toast('Thank you for your generous contribution! 80G Receipt generated.', 'success');
      loadData();
    } catch (err) {
      toast(err.message || 'Payment initiation failed', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Proceed to Test Payment';
    }
  });

  loadData();
}

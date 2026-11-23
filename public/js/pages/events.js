import { api, auth } from '../api.js';
import { $, esc, badge, formatDate, formatDateTime, toast, loading } from '../ui.js';

export async function renderEvents(container) {
  let activeTab = 'explore'; // 'explore' or 'my'
  let filterType = '';
  let filterMode = '';
  let filterQ = '';
  const user = auth.getUser();
  const isAuth = auth.isAuthenticated();
  const isAdmin = auth.isAdmin();

  container.innerHTML = `
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); gap: 16px; flex-wrap: wrap;">
      <div>
        <span class="caption" style="color: var(--primary);">Campus & Global Gatherings</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Events & Reunions</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Join flagship reunions, masterclasses, and virtual webinars hosted by alumni networks and department leadership.
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        ${
          isAdmin
            ? `
          <button id="create-event-btn" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Event
          </button>
        `
            : ''
        }
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="segmented-control" style="margin-bottom: var(--space-5); max-width: 320px;">
      <button type="button" id="tab-explore" class="${activeTab === 'explore' ? 'active' : ''}">Explore Events</button>
      ${isAuth ? `<button type="button" id="tab-my" class="${activeTab === 'my' ? 'active' : ''}">My Registrations</button>` : ''}
    </div>

    <!-- Filter Bar (Explore Tab) -->
    <div id="events-filters-bar" class="card" style="padding: 16px; margin-bottom: var(--space-5);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-end;">
        <div>
          <label class="form-label" style="font-size: 12px;">Search Keywords</label>
          <input type="text" id="event-search-input" class="form-control form-control-sm" placeholder="Title, topic, or venue..." value="${esc(filterQ)}" />
        </div>
        <div>
          <label class="form-label" style="font-size: 12px;">Event Type</label>
          <select id="event-type-select" class="form-control form-control-sm">
            <option value="">All Types</option>
            <option value="REUNION" ${filterType === 'REUNION' ? 'selected' : ''}>Reunion</option>
            <option value="WORKSHOP" ${filterType === 'WORKSHOP' ? 'selected' : ''}>Workshop</option>
            <option value="WEBINAR" ${filterType === 'WEBINAR' ? 'selected' : ''}>Webinar</option>
          </select>
        </div>
        <div>
          <label class="form-label" style="font-size: 12px;">Mode</label>
          <select id="event-mode-select" class="form-control form-control-sm">
            <option value="">All Modes</option>
            <option value="ONLINE" ${filterMode === 'ONLINE' ? 'selected' : ''}>Online</option>
            <option value="OFFLINE" ${filterMode === 'OFFLINE' ? 'selected' : ''}>Offline / In-Person</option>
          </select>
        </div>
        <div>
          <button id="event-filter-btn" class="btn btn-sm btn-primary" style="width: 100%;">
            Apply Filters
          </button>
        </div>
      </div>
    </div>

    <div id="events-list"></div>
    <div id="events-modal-container"></div>
  `;

  async function loadData() {
    const listEl = container.querySelector('#events-list');
    listEl.innerHTML = loading('Loading events...');

    try {
      if (activeTab === 'my') {
        const res = await api.getPage('/events/registrations/me');
        renderMyRegistrations(res.data || [], listEl);
      } else {
        const query = {
          q: filterQ || undefined,
          type: filterType || undefined,
          mode: filterMode || undefined,
        };
        const res = await api.getPage('/events', query);
        renderEventsList(res.data || [], listEl);
      }
    } catch (err) {
      listEl.innerHTML = `<div class="card" style="text-align:center; padding:32px; color:var(--danger);"><p>${esc(err.message || 'Failed to load events')}</p></div>`;
    }
  }

  function renderEventsList(events, listEl) {
    if (!events.length) {
      listEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-2); display:grid; place-items:center; margin:0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 style="margin-bottom: 8px;">No matching gatherings</h3>
          <p class="text-muted" style="margin-bottom: 16px;">Check back soon for new webinars, reunions, and workshops.</p>
          ${isAdmin ? `<button id="empty-create-btn" class="btn btn-sm btn-primary">Create the First Event</button>` : ''}
        </div>
      `;
      listEl.querySelector('#empty-create-btn')?.addEventListener('click', openCreateEventModal);
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${events
          .map((evt) => {
            const cap = evt.capacity || 1;
            const regCount = evt.registeredCount || 0;
            const waitCount = evt.waitlistedCount || 0;
            const isFull = regCount >= cap;
            const pct = Math.min(100, Math.round((regCount / cap) * 100));

            return `
          <div class="card card-interactive event-card" data-id="${evt.eventId}" style="padding: 20px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 280px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                <h3 style="font-size: 18px; margin: 0; color: var(--text);">${esc(evt.title)}</h3>
                <span class="badge badge-info" style="font-size: 11px;">${esc(evt.eventType)}</span>
                <span class="badge ${evt.mode === 'ONLINE' ? 'badge-info' : 'badge-neutral'}" style="font-size: 11px;">${esc(evt.mode)}</span>
                ${badge(evt.status)}
              </div>
              <div style="display: flex; align-items: center; gap: 16px; color: var(--text-muted); font-size: 13px; margin-bottom: 10px; flex-wrap: wrap;">
                <span>📅 ${formatDateTime(evt.startAt)}</span>
                <span>📍 ${esc(evt.venueOrLink)}</span>
                ${evt.registrationDeadline ? `<span>⏳ Deadline: ${formatDate(evt.registrationDeadline)}</span>` : ''}
              </div>
              <p class="text-muted" style="font-size: 14px; margin: 0 0 12px 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${esc(evt.description)}
              </p>
              
              <!-- Attendance / Capacity stats -->
              <div style="max-width: 320px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                  <span style="font-weight: 600; color: var(--text);">${regCount} / ${cap} Seats Booked</span>
                  <span class="muted">${waitCount > 0 ? `${waitCount} waitlisted` : isFull ? 'At Capacity' : `${cap - regCount} remaining`}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${pct}%; background: ${isFull ? 'var(--functional-amber)' : 'var(--primary)'};"></div>
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn btn-sm btn-secondary view-event-btn" data-id="${evt.eventId}">Details</button>
              ${
                evt.status === 'OPEN' && isAuth
                  ? `
                <button class="btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'} register-event-btn" data-id="${evt.eventId}" data-full="${isFull}">
                  ${isFull ? 'Join Waitlist' : 'RSVP / Register'}
                </button>
              `
                  : ''
              }
            </div>
          </div>
        `;
          })
          .join('')}
      </div>
    `;

    listEl.querySelectorAll('.view-event-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEventDetailModal(btn.dataset.id));
    });

    listEl.querySelectorAll('.register-event-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleRegister(btn.dataset.id, btn.dataset.full === 'true'));
    });
  }

  function renderMyRegistrations(regs, listEl) {
    if (!regs.length) {
      listEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px var(--space-4);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-2); display:grid; place-items:center; margin:0 auto 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <h3 style="margin-bottom: 8px;">No event bookings</h3>
          <p class="text-muted" style="margin-bottom: 16px;">Browse upcoming gatherings and reserve your seat.</p>
          <button id="my-explore-btn" class="btn btn-sm btn-primary">Browse Events</button>
        </div>
      `;
      listEl.querySelector('#my-explore-btn')?.addEventListener('click', () => {
        activeTab = 'explore';
        container.querySelector('#tab-explore').classList.add('active');
        container.querySelector('#tab-my')?.classList.remove('active');
        container.querySelector('#events-filters-bar').style.display = 'block';
        loadData();
      });
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${regs
          .map(
            (reg) => `
          <div class="card" style="padding: 18px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <strong style="font-size: 16px;">${esc(reg.eventTitle)}</strong>
                <span class="badge ${reg.regStatus === 'REGISTERED' ? 'badge-success' : 'badge-warning'}">${esc(reg.regStatus)}</span>
                <span class="badge badge-neutral" style="font-size:11px;">${esc(reg.mode)}</span>
              </div>
              <div style="color: var(--text-muted); font-size: 13px;">
                <span>📅 ${formatDateTime(reg.startAt)}</span> • <span>📍 ${esc(reg.venueOrLink)}</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm btn-secondary view-event-btn" data-id="${reg.eventId}">View Details</button>
              <button class="btn btn-sm btn-ghost cancel-reg-btn" data-id="${reg.eventId}" style="color: var(--danger);">Cancel RSVP</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    listEl.querySelectorAll('.view-event-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEventDetailModal(btn.dataset.id));
    });

    listEl.querySelectorAll('.cancel-reg-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleCancelRegistration(btn.dataset.id));
    });
  }

  async function handleRegister(eventId, isWaitlist) {
    if (!auth.isAuthenticated()) {
      window.location.hash = '#/auth';
      return;
    }

    try {
      const res = await api.post(`/events/${eventId}/register`);
      const status = res.regStatus || res.data?.regStatus;
      if (status === 'REGISTERED') {
        toast('Registration confirmed! See you there.', 'info');
      } else {
        toast('Event is full. You have been added to the waitlist!', 'info');
      }
      loadData();
    } catch (err) {
      toast(err.message || 'Failed to register for event', 'error');
    }
  }

  async function handleCancelRegistration(eventId) {
    if (!confirm('Are you sure you want to cancel your registration? If waitlisted candidates exist, your spot will be immediately reallocated.')) return;

    try {
      await api.delete(`/events/${eventId}/register`);
      toast('Registration cancelled', 'info');
      loadData();
    } catch (err) {
      toast(err.message || 'Failed to cancel registration', 'error');
    }
  }

  async function openEventDetailModal(eventId) {
    const modalContainer = container.querySelector('#events-modal-container');
    modalContainer.innerHTML = loading('Loading event details...');

    try {
      const evt = await api.get(`/events/${eventId}`);
      const isFull = evt.registeredCount >= evt.capacity;

      modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <h2 style="font-size: 20px; margin: 0;">${esc(evt.title)}</h2>
                  <span class="badge badge-info">${esc(evt.eventType)}</span>
                  <span class="badge badge-neutral">${esc(evt.mode)}</span>
                  ${badge(evt.status)}
                </div>
                <div style="color: var(--text-muted); font-size: 13px;">
                  📅 ${formatDateTime(evt.startAt)} – ${formatDateTime(evt.endAt)}
                </div>
              </div>
              <button class="modal-close-btn icon-btn">&times;</button>
            </div>
            <div class="modal-body" style="padding: 16px 0;">
              <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius); margin-bottom: 16px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>Location / Link:</strong> ${esc(evt.venueOrLink)}</div>
                <div><strong>Capacity:</strong> ${evt.registeredCount} / ${evt.capacity} booked</div>
                <div><strong>Waitlisted:</strong> ${evt.waitlistedCount} in queue</div>
                <div><strong>Registration Deadline:</strong> ${formatDate(evt.registrationDeadline)}</div>
              </div>

              <h4 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;">Event Overview</h4>
              <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: var(--text); margin-bottom: 24px;">
                ${esc(evt.description)}
              </div>

              ${
                isAdmin
                  ? `
                <div style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h4 style="margin:0; font-size:15px;">Registered Attendees & Waitlist</h4>
                    <button id="view-attendees-btn" class="btn btn-sm btn-secondary">Load Roster</button>
                  </div>
                  <div id="attendees-list-container"></div>
                </div>
              `
                  : ''
              }
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px;">
              <div>
                ${
                  isAdmin && evt.status !== 'CANCELLED' && evt.status !== 'COMPLETED'
                    ? `
                  <button id="cancel-event-btn" class="btn btn-sm btn-danger">Cancel Event</button>
                `
                    : ''
                }
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-secondary modal-close-btn">Close</button>
                ${
                  evt.status === 'OPEN' && isAuth
                    ? `
                  <button id="modal-register-btn" class="btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}">
                    ${isFull ? 'Join Waitlist' : 'RSVP Now'}
                  </button>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        </div>
      `;

      modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
        btn.addEventListener('click', () => (modalContainer.innerHTML = ''));
      });

      modalContainer.querySelector('#modal-register-btn')?.addEventListener('click', async () => {
        modalContainer.innerHTML = '';
        await handleRegister(evt.eventId, isFull);
      });

      modalContainer.querySelector('#cancel-event-btn')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel this event?')) return;
        try {
          await api.patch(`/events/${evt.eventId}/cancel`);
          toast('Event cancelled', 'info');
          modalContainer.innerHTML = '';
          loadData();
        } catch (err) {
          toast(err.message || 'Failed to cancel event', 'error');
        }
      });

      modalContainer.querySelector('#view-attendees-btn')?.addEventListener('click', async () => {
        const attendeeContainer = modalContainer.querySelector('#attendees-list-container');
        attendeeContainer.innerHTML = loading('Fetching attendee roster...');
        try {
          const res = await api.getPage(`/events/${evt.eventId}/registrations`);
          const attendees = res.data || [];
          if (!attendees.length) {
            attendeeContainer.innerHTML = '<p class="small muted">No attendees registered yet.</p>';
            return;
          }
          attendeeContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${attendees
                .map(
                  (a) => `
                <div style="padding:10px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); display:flex; justify-content:space-between; align-items:center; font-size:13px;">
                  <div>
                    <strong>${esc(a.fullName)}</strong> <span class="small muted">(${esc(a.role)})</span>
                    <div class="small muted">${esc(a.email)} • Registered ${formatDateTime(a.registeredAt)}</div>
                  </div>
                  <span class="badge ${a.regStatus === 'REGISTERED' ? 'badge-success' : a.regStatus === 'WAITLISTED' ? 'badge-warning' : 'badge-neutral'}">${esc(a.regStatus)}</span>
                </div>
              `
                )
                .join('')}
            </div>
          `;
        } catch (err) {
          attendeeContainer.innerHTML = `<p class="small" style="color:var(--danger);">${esc(err.message || 'Failed to load attendee roster')}</p>`;
        }
      });
    } catch (err) {
      modalContainer.innerHTML = `<div class="modal-backdrop"><div class="modal"><p style="color:var(--danger);">${esc(err.message || 'Error loading event details')}</p><button class="btn btn-sm btn-secondary modal-close-btn">Close</button></div></div>`;
      modalContainer.querySelector('.modal-close-btn')?.addEventListener('click', () => (modalContainer.innerHTML = ''));
    }
  }

  function openCreateEventModal() {
    const modalContainer = container.querySelector('#events-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width: 620px; max-height:90vh; overflow-y:auto;">
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h3 style="margin:0; font-size:18px;">Create New Event / Reunion</h3>
            <button class="modal-close-btn icon-btn">&times;</button>
          </div>
          <form id="create-event-form" style="padding-top:16px;">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Event Title *</label>
              <input type="text" name="title" class="form-control" required placeholder="e.g. Annual Alumni Gala 2026" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Event Type *</label>
                <select name="eventType" class="form-control" required>
                  <option value="REUNION">Reunion</option>
                  <option value="WORKSHOP">Workshop</option>
                  <option value="WEBINAR">Webinar</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Mode *</label>
                <select name="mode" class="form-control" required>
                  <option value="OFFLINE">Offline / In-Person</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Venue or Virtual Link *</label>
              <input type="text" name="venueOrLink" class="form-control" required placeholder="Auditorium Hall or https://meet.google.com/..." />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Start Date & Time *</label>
                <input type="datetime-local" name="startAt" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">End Date & Time *</label>
                <input type="datetime-local" name="endAt" class="form-control" required />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label">Capacity (Seats) *</label>
                <input type="number" name="capacity" class="form-control" min="1" value="100" required />
              </div>
              <div class="form-group">
                <label class="form-label">Registration Deadline</label>
                <input type="datetime-local" name="registrationDeadline" class="form-control" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Status *</label>
              <select name="status" class="form-control">
                <option value="OPEN">OPEN (Published & accepting RSVPs)</option>
                <option value="DRAFT">DRAFT (Hidden from non-admins)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label">Description & Agenda *</label>
              <textarea name="description" class="form-control" rows="4" required placeholder="Outline event schedule, keynote speakers, and details..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="btn btn-sm btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-sm btn-primary">Publish Event</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => (modalContainer.innerHTML = ''));
    });

    const form = modalContainer.querySelector('#create-event-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title')?.trim(),
        description: fd.get('description')?.trim(),
        eventType: fd.get('eventType'),
        mode: fd.get('mode'),
        venueOrLink: fd.get('venueOrLink')?.trim(),
        startAt: new Date(fd.get('startAt')).toISOString(),
        endAt: new Date(fd.get('endAt')).toISOString(),
        capacity: Number(fd.get('capacity')),
        registrationDeadline: fd.get('registrationDeadline') ? new Date(fd.get('registrationDeadline')).toISOString() : null,
        status: fd.get('status'),
      };

      try {
        await api.post('/events', payload);
        toast('Event published successfully!', 'info');
        modalContainer.innerHTML = '';
        loadData();
      } catch (err) {
        toast(err.message || 'Failed to create event', 'error');
      }
    });
  }

  // Event handlers
  container.querySelector('#create-event-btn')?.addEventListener('click', openCreateEventModal);

  container.querySelector('#tab-explore').addEventListener('click', () => {
    activeTab = 'explore';
    container.querySelector('#tab-explore').classList.add('active');
    container.querySelector('#tab-my')?.classList.remove('active');
    container.querySelector('#events-filters-bar').style.display = 'block';
    loadData();
  });

  container.querySelector('#tab-my')?.addEventListener('click', () => {
    activeTab = 'my';
    container.querySelector('#tab-my').classList.add('active');
    container.querySelector('#tab-explore').classList.remove('active');
    container.querySelector('#events-filters-bar').style.display = 'none';
    loadData();
  });

  container.querySelector('#event-filter-btn').addEventListener('click', () => {
    filterQ = container.querySelector('#event-search-input').value.trim();
    filterType = container.querySelector('#event-type-select').value;
    filterMode = container.querySelector('#event-mode-select').value;
    loadData();
  });

  container.querySelector('#event-search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.querySelector('#event-filter-btn').click();
    }
  });

  loadData();
}

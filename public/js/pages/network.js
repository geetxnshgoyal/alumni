import { api, auth } from '../api.js';
import { $, esc, avatar, badge, formatDate, formatDateTime, toast, loading } from '../ui.js';

export async function renderNetwork(container) {
  const user = auth.getUser();
  if (!auth.isAuthenticated() || !user) {
    window.location.hash = '#/auth';
    return;
  }

  // Parse query params (e.g. #/network?tab=chat&connectionId=5)
  const hash = window.location.hash || '';
  const queryParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  let activeTab = queryParams.get('tab') || 'connections'; // 'connections', 'requests', 'chat'
  let activeConnectionId = queryParams.get('connectionId') ? Number(queryParams.get('connectionId')) : null;
  let requestsTab = 'incoming'; // 'incoming' or 'outgoing'

  container.innerHTML = `
    <!-- Network Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--space-6); gap: 16px; flex-wrap: wrap;">
      <div>
        <span class="caption" style="color: var(--primary);">Peer & Mentorship Network</span>
        <h1 style="font-size: 28px; margin-top: 4px; margin-bottom: 6px;">Networking & Messages</h1>
        <p class="text-muted" style="max-width: 680px; margin: 0;">
          Grow your professional circle, connect with alumni mentors, exchange advice, and communicate in real-time.
        </p>
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="#/directory" class="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Find Alumni in Directory
        </a>
      </div>
    </div>

    <!-- Segmented Navigation Tabs -->
    <div class="segmented-control" style="margin-bottom: var(--space-6); max-width: 500px;">
      <button type="button" id="tab-connections" class="${activeTab === 'connections' ? 'active' : ''}">
        My Connections <span id="connections-count" class="badge badge-neutral" style="font-size: 11px; margin-left: 4px;">...</span>
      </button>
      <button type="button" id="tab-requests" class="${activeTab === 'requests' ? 'active' : ''}">
        Requests <span id="requests-count" class="badge badge-neutral" style="font-size: 11px; margin-left: 4px;">...</span>
      </button>
      <button type="button" id="tab-chat" class="${activeTab === 'chat' ? 'active' : ''}">
        Messages & Chat
      </button>
    </div>

    <!-- Dynamic Tab Content -->
    <div id="network-tab-content"></div>

    <!-- Modal Container for network actions -->
    <div id="network-modal-container"></div>
  `;

  // Wire Tab Buttons
  const tabConnections = container.querySelector('#tab-connections');
  const tabRequests = container.querySelector('#tab-requests');
  const tabChat = container.querySelector('#tab-chat');

  function setActiveTab(tab, connectionId = null) {
    activeTab = tab;
    if (connectionId) activeConnectionId = connectionId;

    tabConnections.classList.toggle('active', activeTab === 'connections');
    tabRequests.classList.toggle('active', activeTab === 'requests');
    tabChat.classList.toggle('active', activeTab === 'chat');

    renderActiveTab();
  }

  tabConnections.addEventListener('click', () => setActiveTab('connections'));
  tabRequests.addEventListener('click', () => setActiveTab('requests'));
  tabChat.addEventListener('click', () => setActiveTab('chat'));

  // Quick helper to determine other party in connection
  function getOtherUser(c) {
    if (c.requesterId === user.id) {
      return {
        id: c.receiverId,
        name: c.receiverName || 'Alumni Member',
        email: c.receiverEmail,
        role: c.receiverRole,
        isRequester: false
      };
    } else {
      return {
        id: c.requesterId,
        name: c.requesterName || 'Alumni Member',
        email: c.requesterEmail,
        role: c.requesterRole,
        isRequester: true
      };
    }
  }

  // Update counts badge
  async function updateCounts() {
    try {
      const [acceptedRes, pendingRes] = await Promise.all([
        api.get('/connections', { status: 'ACCEPTED', limit: 1 }),
        api.get('/connections', { status: 'PENDING', limit: 50 })
      ]);
      const connCountEl = container.querySelector('#connections-count');
      const reqCountEl = container.querySelector('#requests-count');
      if (connCountEl) {
        connCountEl.textContent = acceptedRes?.pagination?.total ?? (acceptedRes?.data?.length || 0);
      }
      if (reqCountEl) {
        const incoming = (pendingRes?.data || []).filter(c => c.receiverId === user.id);
        reqCountEl.textContent = incoming.length;
        if (incoming.length > 0) {
          reqCountEl.className = 'badge badge-warning';
        } else {
          reqCountEl.className = 'badge badge-neutral';
        }
      }
    } catch {
      // Ignore background badge error
    }
  }

  // 1. RENDER CONNECTIONS TAB
  async function renderConnectionsView() {
    const content = container.querySelector('#network-tab-content');
    content.innerHTML = loading('Loading your connections...');

    try {
      const res = await api.get('/connections', { status: 'ACCEPTED', limit: 50 });
      const connectionsList = res?.data || [];

      if (!connectionsList.length) {
        content.innerHTML = `
          <div class="card" style="text-align: center; padding: 48px var(--space-4);">
            <div style="font-size: 36px; margin-bottom: 12px;">🤝</div>
            <h3 style="margin-bottom: 8px;">No connections yet</h3>
            <p class="muted small" style="max-width: 440px; margin: 0 auto 18px; line-height: 1.5;">
              Reach out to graduates from your department or batch in the directory to begin building your trusted alumni network.
            </p>
            <a href="#/directory" class="btn btn-primary btn-sm">Explore Alumni Directory</a>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div style="margin-bottom: var(--space-4); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div class="small muted">
            Showing <strong>${connectionsList.length}</strong> active ${connectionsList.length === 1 ? 'connection' : 'connections'}
          </div>
          <div style="max-width: 260px; width: 100%;">
            <input type="text" id="conn-filter-input" class="form-control form-control-sm" placeholder="Filter by name..." />
          </div>
        </div>

        <div id="connections-grid" class="grid grid-3">
          ${connectionsList.map(c => {
            const other = getOtherUser(c);
            const isMentorship = c.connectionType === 'MENTORSHIP';
            return `
              <div class="card card-interactive conn-card" data-name="${esc(other.name.toLowerCase())}" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      ${avatar({ fullName: other.name }, 46)}
                      <div>
                        <h3 style="font-size: 16px; margin: 0; line-height: 1.25;">${esc(other.name)}</h3>
                        <span class="small muted" style="font-size: 12px;">${esc(other.role || 'Alumni')}</span>
                      </div>
                    </div>
                    <span class="badge ${isMentorship ? 'badge-warning' : 'badge-info'}" style="font-size: 11px;">
                      ${isMentorship ? 'Mentorship' : 'Network'}
                    </span>
                  </div>

                  ${c.requestNote ? `
                    <div style="padding: 8px 12px; background: var(--bg); border-left: 3px solid var(--primary); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 12px; font-size: 12px; color: var(--text-muted); font-style: italic;">
                      "${esc(c.requestNote)}"
                    </div>
                  ` : ''}

                  <div class="small muted" style="font-size: 12px; margin-bottom: 12px;">
                    Connected ${formatDate(c.respondedAt || c.requestedAt)}
                  </div>
                </div>

                <div style="padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px;">
                  <button class="btn btn-sm btn-primary open-chat-btn" data-connection-id="${c.connectionId}" style="width: 100%; gap: 6px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Chat & Messages
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Filter input
      const filterInput = content.querySelector('#conn-filter-input');
      filterInput?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        content.querySelectorAll('.conn-card').forEach(card => {
          const match = card.getAttribute('data-name')?.includes(val);
          card.style.display = match ? 'flex' : 'none';
        });
      });

      // Open Chat buttons
      content.querySelectorAll('.open-chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = Number(btn.getAttribute('data-connection-id'));
          setActiveTab('chat', cid);
        });
      });

    } catch (err) {
      content.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center; padding: 32px;">
          Failed to load connections: ${esc(err.message)}
        </div>
      `;
    }
  }

  // 2. RENDER REQUESTS TAB
  async function renderRequestsView() {
    const content = container.querySelector('#network-tab-content');
    content.innerHTML = loading('Loading connection requests...');

    try {
      const res = await api.get('/connections', { status: 'PENDING', limit: 50 });
      const allPending = res?.data || [];
      const incoming = allPending.filter(c => c.receiverId === user.id);
      const outgoing = allPending.filter(c => c.requesterId === user.id);

      content.innerHTML = `
        <!-- Sub-segmented control for requests -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); flex-wrap: wrap; gap: 12px;">
          <div class="segmented-control" style="max-width: 320px;">
            <button type="button" id="subtab-incoming" class="${requestsTab === 'incoming' ? 'active' : ''}">
              Received (${incoming.length})
            </button>
            <button type="button" id="subtab-outgoing" class="${requestsTab === 'outgoing' ? 'active' : ''}">
              Sent (${outgoing.length})
            </button>
          </div>
        </div>

        <div id="requests-subtab-container"></div>
      `;

      const subIncomingBtn = content.querySelector('#subtab-incoming');
      const subOutgoingBtn = content.querySelector('#subtab-outgoing');
      const subContainer = content.querySelector('#requests-subtab-container');

      function renderSubTab() {
        subIncomingBtn.classList.toggle('active', requestsTab === 'incoming');
        subOutgoingBtn.classList.toggle('active', requestsTab === 'outgoing');

        if (requestsTab === 'incoming') {
          if (!incoming.length) {
            subContainer.innerHTML = `
              <div class="card" style="text-align: center; padding: 48px var(--space-4);">
                <div style="font-size: 32px; margin-bottom: 10px;">📬</div>
                <h3 style="margin-bottom: 6px;">No pending received requests</h3>
                <p class="muted small" style="margin: 0;">You have replied to all your incoming connection and mentorship invitations.</p>
              </div>
            `;
            return;
          }

          subContainer.innerHTML = `
            <div class="grid grid-2">
              ${incoming.map(c => `
                <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        ${avatar({ fullName: c.requesterName }, 44)}
                        <div>
                          <h4 style="margin: 0; font-size: 15px;">${esc(c.requesterName)}</h4>
                          <span class="small muted" style="font-size: 12px;">${esc(c.requesterRole || 'Alumni')}</span>
                        </div>
                      </div>
                      <span class="badge ${c.connectionType === 'MENTORSHIP' ? 'badge-warning' : 'badge-info'}" style="font-size: 11px;">
                        ${c.connectionType === 'MENTORSHIP' ? 'Mentorship' : 'Network'}
                      </span>
                    </div>

                    ${c.requestNote ? `
                      <div style="padding: 10px 14px; background: var(--bg); border-left: 3px solid var(--primary); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 12px; font-size: 13px; color: var(--text);">
                        "${esc(c.requestNote)}"
                      </div>
                    ` : ''}

                    <div class="small muted" style="font-size: 12px; margin-bottom: 14px;">
                      Requested on ${formatDate(c.requestedAt)}
                    </div>
                  </div>

                  <div style="display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
                    <button class="btn btn-sm btn-secondary reject-req-btn" data-id="${c.connectionId}" style="color: var(--danger);">Decline</button>
                    <button class="btn btn-sm btn-primary accept-req-btn" data-id="${c.connectionId}">Accept Connection</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;

          // Handle accept/reject
          subContainer.querySelectorAll('.accept-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              btn.disabled = true;
              btn.textContent = 'Accepting...';
              try {
                await api.patch(`/connections/${id}/accept`);
                toast('Connection accepted!', 'success');
                updateCounts();
                renderRequestsView();
              } catch (err) {
                toast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Accept Connection';
              }
            });
          });

          subContainer.querySelectorAll('.reject-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              btn.disabled = true;
              btn.textContent = 'Declining...';
              try {
                await api.patch(`/connections/${id}/reject`);
                toast('Connection request declined.', 'info');
                updateCounts();
                renderRequestsView();
              } catch (err) {
                toast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Decline';
              }
            });
          });

        } else {
          // Outgoing sent requests
          if (!outgoing.length) {
            subContainer.innerHTML = `
              <div class="card" style="text-align: center; padding: 48px var(--space-4);">
                <div style="font-size: 32px; margin-bottom: 10px;">🚀</div>
                <h3 style="margin-bottom: 6px;">No outgoing pending requests</h3>
                <p class="muted small" style="margin: 0 auto 16px; max-width: 400px;">When you invite alumni to connect from the directory, your sent requests will be tracked here.</p>
                <a href="#/directory" class="btn btn-secondary btn-sm">Browse Directory</a>
              </div>
            `;
            return;
          }

          subContainer.innerHTML = `
            <div class="grid grid-2">
              ${outgoing.map(c => `
                <div class="card">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      ${avatar({ fullName: c.receiverName }, 44)}
                      <div>
                        <h4 style="margin: 0; font-size: 15px;">${esc(c.receiverName)}</h4>
                        <span class="small muted" style="font-size: 12px;">${esc(c.receiverRole || 'Alumni')}</span>
                      </div>
                    </div>
                    <span class="badge badge-warning" style="font-size: 11px;">Pending Approval</span>
                  </div>

                  ${c.requestNote ? `
                    <div style="padding: 10px 14px; background: var(--bg); border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">
                      Note: "${esc(c.requestNote)}"
                    </div>
                  ` : ''}

                  <div class="small muted" style="font-size: 12px;">
                    Sent on ${formatDate(c.requestedAt)} • Type: <strong>${c.connectionType === 'MENTORSHIP' ? 'Mentorship' : 'General Network'}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }
      }

      subIncomingBtn.addEventListener('click', () => {
        requestsTab = 'incoming';
        renderSubTab();
      });

      subOutgoingBtn.addEventListener('click', () => {
        requestsTab = 'outgoing';
        renderSubTab();
      });

      renderSubTab();

    } catch (err) {
      content.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center; padding: 32px;">
          Failed to load requests: ${esc(err.message)}
        </div>
      `;
    }
  }

  // 3. RENDER MESSAGES & CHAT TAB
  async function renderChatView() {
    const content = container.querySelector('#network-tab-content');
    content.innerHTML = loading('Loading messages and conversations...');

    try {
      const res = await api.get('/connections', { status: 'ACCEPTED', limit: 50 });
      const connectionsList = res?.data || [];

      if (!connectionsList.length) {
        content.innerHTML = `
          <div class="card" style="text-align: center; padding: 48px var(--space-4);">
            <div style="font-size: 36px; margin-bottom: 12px;">💬</div>
            <h3 style="margin-bottom: 8px;">No chat conversations available</h3>
            <p class="muted small" style="max-width: 440px; margin: 0 auto 18px; line-height: 1.5;">
              Messages are enabled once you have an accepted connection or mentorship relationship with an alumni or student.
            </p>
            <a href="#/directory" class="btn btn-primary btn-sm">Explore Alumni Directory</a>
          </div>
        `;
        return;
      }

      // If activeConnectionId is not set, choose the first connection
      if (!activeConnectionId || !connectionsList.some(c => c.connectionId === activeConnectionId)) {
        activeConnectionId = connectionsList[0].connectionId;
      }

      const activeConn = connectionsList.find(c => c.connectionId === activeConnectionId) || connectionsList[0];
      const activeOther = getOtherUser(activeConn);

      content.innerHTML = `
        <div class="card" style="padding: 0; overflow: hidden; display: grid; grid-template-columns: 300px 1fr; min-height: 560px; height: 68vh; border: 1px solid var(--border);">
          <!-- Left Column: Conversations List -->
          <div style="border-right: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column;">
            <div style="padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--surface-2);">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">Direct Conversations</div>
              <input type="text" id="chat-search-input" class="form-control form-control-sm" placeholder="Search conversations..." />
            </div>

            <div id="chat-connections-list" style="flex: 1; overflow-y: auto;">
              ${connectionsList.map(c => {
                const other = getOtherUser(c);
                const isSelected = c.connectionId === activeConnectionId;
                return `
                  <div class="chat-conv-item" data-id="${c.connectionId}" data-name="${esc(other.name.toLowerCase())}"
                    style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease; background: ${isSelected ? 'var(--primary-light)' : 'transparent'};">
                    ${avatar({ fullName: other.name }, 38)}
                    <div style="flex: 1; min-width: 0;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-weight: 600; font-size: 13px; color: ${isSelected ? 'var(--primary)' : 'var(--text)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${esc(other.name)}
                        </span>
                        <span class="badge ${c.connectionType === 'MENTORSHIP' ? 'badge-warning' : 'badge-neutral'}" style="font-size: 9px; padding: 1px 4px;">
                          ${c.connectionType === 'MENTORSHIP' ? 'Mentor' : 'Net'}
                        </span>
                      </div>
                      <div class="small muted" style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${esc(other.role || 'Alumni')}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Right Column: Active Conversation Pane -->
          <div style="display: flex; flex-direction: column; background: var(--bg);">
            <!-- Chat Header -->
            <div style="padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px;">
                ${avatar({ fullName: activeOther.name }, 38)}
                <div>
                  <div style="font-weight: 700; font-size: 15px; color: var(--text);">${esc(activeOther.name)}</div>
                  <div class="small muted" style="font-size: 12px;">
                    ${esc(activeOther.role || 'Member')} • Connected ${formatDate(activeConn.respondedAt || activeConn.requestedAt)}
                  </div>
                </div>
              </div>
              <div>
                <span class="badge ${activeConn.connectionType === 'MENTORSHIP' ? 'badge-warning' : 'badge-info'}">
                  ${activeConn.connectionType === 'MENTORSHIP' ? 'Mentorship Connection' : 'Alumni Network'}
                </span>
              </div>
            </div>

            <!-- Messages Stream -->
            <div id="messages-container" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
              ${loading('Loading message history...')}
            </div>

            <!-- Message Input Footer -->
            <div style="padding: 12px 16px; background: var(--surface); border-top: 1px solid var(--border);">
              <form id="send-message-form" style="display: flex; gap: 10px; align-items: flex-end;">
                <textarea id="message-input" class="form-control" placeholder="Write a message to ${esc(activeOther.name)}... (Press Enter to send)" rows="1" style="resize: none; min-height: 40px; max-height: 120px; font-size: 13px;" required></textarea>
                <button type="submit" id="send-btn" class="btn btn-primary" style="height: 40px; padding: 0 16px; gap: 6px; flex-shrink: 0;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      `;

      // Search conversations
      const chatSearch = content.querySelector('#chat-search-input');
      chatSearch?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        content.querySelectorAll('.chat-conv-item').forEach(item => {
          const name = item.getAttribute('data-name');
          item.style.display = name?.includes(val) ? 'flex' : 'none';
        });
      });

      // Switch conversation
      content.querySelectorAll('.chat-conv-item').forEach(item => {
        item.addEventListener('click', () => {
          const cid = Number(item.getAttribute('data-id'));
          activeConnectionId = cid;
          renderChatView();
        });
      });

      // Auto load messages for activeConnectionId
      async function loadActiveMessages() {
        const msgContainer = content.querySelector('#messages-container');
        if (!msgContainer) return;

        try {
          const msgRes = await api.get('/messages', { connectionId: activeConnectionId, limit: 100 });
          const messages = msgRes?.data || [];

          if (!messages.length) {
            msgContainer.innerHTML = `
              <div style="margin: auto; text-align: center; color: var(--text-muted); max-width: 320px;">
                <div style="font-size: 28px; margin-bottom: 8px;">👋</div>
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text);">No messages yet</div>
                <p class="small muted" style="margin: 0;">Say hello and break the ice with ${esc(activeOther.name)}!</p>
              </div>
            `;
            return;
          }

          msgContainer.innerHTML = messages.map(m => {
            const isMe = m.senderId === user.id;
            return `
              <div style="display: flex; flex-direction: column; align-self: ${isMe ? 'flex-end' : 'flex-start'}; max-width: 72%;">
                <div style="
                  padding: 10px 14px;
                  border-radius: ${isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px'};
                  background: ${isMe ? 'var(--primary)' : 'var(--surface)'};
                  color: ${isMe ? '#FFFFFF' : 'var(--text)'};
                  border: ${isMe ? 'none' : '1px solid var(--border)'};
                  box-shadow: var(--shadow-sm);
                  font-size: 13.5px;
                  line-height: 1.45;
                  word-break: break-word;
                  white-space: pre-wrap;
                ">${esc(m.content)}</div>
                <div style="display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-dim); margin-top: 4px; align-self: ${isMe ? 'flex-end' : 'flex-start'};">
                  <span>${formatDateTime(m.sentAt)}</span>
                  ${isMe ? `
                    <span title="${m.readAt ? 'Read by recipient' : 'Sent'}">
                      ${m.readAt ? '• ✓✓ Read' : '• ✓ Sent'}
                    </span>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('');

          // Scroll to bottom
          msgContainer.scrollTop = msgContainer.scrollHeight;

        } catch (err) {
          msgContainer.innerHTML = `
            <div style="color: var(--danger); text-align: center; margin: auto;">
              Failed to load messages: ${esc(err.message)}
            </div>
          `;
        }
      }

      await loadActiveMessages();

      // Send form
      const sendForm = content.querySelector('#send-message-form');
      const messageInput = content.querySelector('#message-input');
      const sendBtn = content.querySelector('#send-btn');

      // Enter to send (Shift+Enter for newline)
      messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendForm?.requestSubmit();
        }
      });

      sendForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contentVal = messageInput.value.trim();
        if (!contentVal) return;

        sendBtn.disabled = true;
        try {
          await api.post('/messages', {
            connectionId: activeConnectionId,
            content: contentVal
          });
          messageInput.value = '';
          await loadActiveMessages();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          sendBtn.disabled = false;
          messageInput.focus();
        }
      });

    } catch (err) {
      content.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center; padding: 32px;">
          Failed to load chat: ${esc(err.message)}
        </div>
      `;
    }
  }

  function renderActiveTab() {
    if (activeTab === 'connections') {
      renderConnectionsView();
    } else if (activeTab === 'requests') {
      renderRequestsView();
    } else if (activeTab === 'chat') {
      renderChatView();
    }
  }

  // Initial load
  updateCounts();
  renderActiveTab();
}

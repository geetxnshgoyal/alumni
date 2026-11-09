const { api, setupDb, resetDb, closeDb, createDepartment, createUser, auth, pool } = require('./helpers');

beforeAll(setupDb);
afterAll(closeDb);
beforeEach(resetDb);

describe('Messages API', () => {
  let user1, user2, user3, acceptedConn, pendingConn, rejectedConn;

  beforeEach(async () => {
    const deptId = await createDepartment();
    user1 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Alice Walker' });
    user2 = await createUser({ deptId, role: 'ALUMNI', fullName: 'Bob Martin' });
    user3 = await createUser({ deptId, role: 'STUDENT', fullName: 'Charlie Brown' });

    // 1. Accepted connection between user1 and user2
    const res1 = await api()
      .post('/api/connections')
      .set(auth(user1.token))
      .send({ receiverId: user2.id });
    acceptedConn = res1.body.data;

    await api()
      .patch(`/api/connections/${acceptedConn.connectionId}/accept`)
      .set(auth(user2.token));

    // 2. Pending connection between user1 and user3
    const res2 = await api()
      .post('/api/connections')
      .set(auth(user1.token))
      .send({ receiverId: user3.id });
    pendingConn = res2.body.data;

    // 3. Rejected connection between user2 and user3
    const res3 = await api()
      .post('/api/connections')
      .set(auth(user3.token))
      .send({ receiverId: user2.id });
    rejectedConn = res3.body.data;

    await api()
      .patch(`/api/connections/${rejectedConn.connectionId}/reject`)
      .set(auth(user2.token));
  });

  describe('POST /api/messages (send message)', () => {
    it('allows connected users to send a message (201)', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({
          connectionId: acceptedConn.connectionId,
          content: 'Hi Bob, excited to connect with you!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.messageId).toBeDefined();
      expect(res.body.data.connectionId).toBe(acceptedConn.connectionId);
      expect(res.body.data.senderId).toBe(user1.id);
      expect(res.body.data.content).toBe('Hi Bob, excited to connect with you!');
      expect(res.body.data.sentAt).toBeDefined();
      expect(res.body.data.readAt).toBeNull();

      // Check notification sent to recipient (user2)
      const { rows } = await pool.query(
        'SELECT * FROM notification WHERE user_id = $1 AND notif_type = $2',
        [user2.id, 'NEW_MESSAGE']
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('Alice Walker');
    });

    it('rejects sending a message when connection is pending (403)', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({
          connectionId: pendingConn.connectionId,
          content: 'Are you there?',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/accepted connection/i);
    });

    it('rejects sending a message when connection is rejected (403)', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user3.token))
        .send({
          connectionId: rejectedConn.connectionId,
          content: 'Please reconsider!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/accepted connection/i);
    });

    it('rejects non-participant from sending a message (403)', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user3.token))
        .send({
          connectionId: acceptedConn.connectionId,
          content: 'Imposing on your chat',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/not a participant/i);
    });

    it('returns 404 when connection does not exist', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({
          connectionId: 999999,
          content: 'Ghost message',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/connection not found/i);
    });

    it('returns 400 for empty or whitespace content', async () => {
      const res = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({
          connectionId: acceptedConn.connectionId,
          content: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/validation failed/i);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await api()
        .post('/api/messages')
        .send({
          connectionId: acceptedConn.connectionId,
          content: 'Unauthorized message',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/messages?connectionId= (list & read receipts)', () => {
    let msg1, msg2;

    beforeEach(async () => {
      const r1 = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({ connectionId: acceptedConn.connectionId, content: 'First message from Alice' });
      msg1 = r1.body.data;

      const r2 = await api()
        .post('/api/messages')
        .set(auth(user2.token))
        .send({ connectionId: acceptedConn.connectionId, content: 'Reply from Bob' });
      msg2 = r2.body.data;
    });

    it('lists messages in chronological order with sender details (200)', async () => {
      const res = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`)
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].messageId).toBe(msg1.messageId);
      expect(res.body.data[0].content).toBe('First message from Alice');
      expect(res.body.data[0].senderName).toBe('Alice Walker');
      expect(res.body.data[1].messageId).toBe(msg2.messageId);
      expect(res.body.data[1].content).toBe('Reply from Bob');
      expect(res.body.data[1].senderName).toBe('Bob Martin');
      expect(res.body.pagination.total).toBe(2);
    });

    it('sets read_at when the receiver opens the conversation', async () => {
      // Alice sent a message, Bob hasn't opened it yet
      const preCheck = await pool.query(
        'SELECT read_at FROM message WHERE message_id = $1',
        [msg1.messageId]
      );
      expect(preCheck.rows[0].read_at).toBeNull();

      // Bob opens the conversation
      const res = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`)
        .set(auth(user2.token));

      expect(res.status).toBe(200);

      // Verify in DB that Alice's message to Bob now has read_at populated
      const postCheck = await pool.query(
        'SELECT read_at FROM message WHERE message_id = $1',
        [msg1.messageId]
      );
      expect(postCheck.rows[0].read_at).not.toBeNull();
    });

    it('does not mark sender own message as read when sender opens conversation', async () => {
      // Alice creates a 3rd message
      const resSend = await api()
        .post('/api/messages')
        .set(auth(user1.token))
        .send({ connectionId: acceptedConn.connectionId, content: 'Third message from Alice' });
      const msg3Id = resSend.body.data.messageId;

      // Alice opens the conversation
      await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`)
        .set(auth(user1.token));

      // Alice's new message should still have read_at = null because Bob hasn't read it
      const check = await pool.query(
        'SELECT read_at FROM message WHERE message_id = $1',
        [msg3Id]
      );
      expect(check.rows[0].read_at).toBeNull();
    });

    it('denies non-participants from viewing messages (403)', async () => {
      const res = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}`)
        .set(auth(user3.token));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/not a participant/i);
    });

    it('denies viewing messages on pending connections (403)', async () => {
      const res = await api()
        .get(`/api/messages?connectionId=${pendingConn.connectionId}`)
        .set(auth(user1.token));

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/accepted connection/i);
    });

    it('returns 404 when connection does not exist', async () => {
      const res = await api()
        .get('/api/messages?connectionId=999999')
        .set(auth(user1.token));

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/connection not found/i);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await api().get(`/api/messages?connectionId=${acceptedConn.connectionId}`);
      expect(res.status).toBe(401);
    });

    it('supports pagination with limit and page', async () => {
      const res = await api()
        .get(`/api/messages?connectionId=${acceptedConn.connectionId}&page=1&limit=1`)
        .set(auth(user1.token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.limit).toBe(1);
    });
  });
});

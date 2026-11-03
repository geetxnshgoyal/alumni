-- Networking and messaging tables (owner: Member B). Mirrors docs/er-diagram.svg.

CREATE TABLE connection (
  connection_id   SERIAL PRIMARY KEY,
  requester_id    INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id     INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('NETWORK', 'MENTORSHIP')),
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED')),
  request_note    TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  CHECK (requester_id <> receiver_id),
  CONSTRAINT uk_connection_requester_receiver UNIQUE (requester_id, receiver_id)
);

CREATE TABLE message (
  message_id    SERIAL PRIMARY KEY,
  connection_id INTEGER     NOT NULL REFERENCES connection(connection_id) ON DELETE CASCADE,
  sender_id     INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content       TEXT        NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ
);

CREATE INDEX idx_connection_requester ON connection (requester_id);
CREATE INDEX idx_connection_receiver ON connection (receiver_id);
CREATE INDEX idx_connection_status ON connection (status);
CREATE INDEX idx_message_connection ON message (connection_id, sent_at);
CREATE INDEX idx_message_sender ON message (sender_id);

-- Shared infrastructure used by every module (owner: team lead).

CREATE TABLE notification (
  notification_id SERIAL PRIMARY KEY,
  user_id         INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notif_type      VARCHAR(40)  NOT NULL,
  title           VARCHAR(150) NOT NULL,
  body            TEXT,
  link_url        VARCHAR(255),
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
  log_id      SERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  entity_name VARCHAR(60) NOT NULL,
  entity_id   INTEGER,
  outcome     VARCHAR(10) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  error_code  VARCHAR(60),
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_user ON notification (user_id, is_read);
CREATE INDEX idx_audit_created ON audit_log (created_at DESC);

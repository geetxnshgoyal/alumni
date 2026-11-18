-- Feedback table (owner: Member C - Ravi Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE feedback (
  feedback_id    SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category       VARCHAR(50) NOT NULL DEFAULT 'GENERAL' CHECK (category IN ('PLATFORM', 'ACADEMIC', 'EVENT', 'CAREER', 'GENERAL')),
  message        TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'CLOSED')),
  admin_response TEXT,
  responded_by   INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_status ON feedback (status);
CREATE INDEX idx_feedback_user ON feedback (user_id);
CREATE INDEX idx_feedback_category ON feedback (category);

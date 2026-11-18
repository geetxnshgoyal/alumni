-- Success Stories table (owner: Member C - Ravi Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE success_story (
  story_id     SERIAL PRIMARY KEY,
  author_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  category     VARCHAR(50) NOT NULL DEFAULT 'CAREER',
  media_url    VARCHAR(500),
  status       VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  reviewed_by  INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_story_status ON success_story (status);
CREATE INDEX idx_story_author ON success_story (author_id);
CREATE INDEX idx_story_category ON success_story (category);

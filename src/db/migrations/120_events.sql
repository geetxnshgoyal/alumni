-- Events & reunions tables (owner: Member B - Bhavesh Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE event (
  event_id              SERIAL PRIMARY KEY,
  created_by            INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title                 VARCHAR(150) NOT NULL,
  description           TEXT         NOT NULL,
  event_type            VARCHAR(20)  NOT NULL CHECK (event_type IN ('REUNION', 'WORKSHOP', 'WEBINAR')),
  mode                  VARCHAR(20)  NOT NULL CHECK (mode IN ('ONLINE', 'OFFLINE')),
  venue_or_link         VARCHAR(255) NOT NULL,
  start_at              TIMESTAMPTZ  NOT NULL,
  end_at                TIMESTAMPTZ  NOT NULL,
  capacity              INTEGER      NOT NULL CHECK (capacity > 0),
  registration_deadline TIMESTAMPTZ,
  status                VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_event_dates CHECK (start_at < end_at),
  CONSTRAINT ck_event_deadline CHECK (registration_deadline IS NULL OR registration_deadline <= start_at)
);

CREATE TABLE event_registration (
  registration_id SERIAL PRIMARY KEY,
  event_id        INTEGER      NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
  user_id         INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reg_status      VARCHAR(20)  NOT NULL DEFAULT 'REGISTERED' CHECK (reg_status IN ('REGISTERED', 'WAITLISTED', 'CANCELLED')),
  registered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  attended        BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT uk_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX idx_event_created_by ON event (created_by);
CREATE INDEX idx_event_status ON event (status);
CREATE INDEX idx_event_type ON event (event_type);
CREATE INDEX idx_event_start_at ON event (start_at);
CREATE INDEX idx_event_created ON event (created_at DESC);

CREATE INDEX idx_event_reg_event ON event_registration (event_id);
CREATE INDEX idx_event_reg_user ON event_registration (user_id);
CREATE INDEX idx_event_reg_status ON event_registration (reg_status);

-- Job portal tables (owner: Member B - Bhavesh Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE job_post (
  job_id       SERIAL PRIMARY KEY,
  posted_by    INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  location     VARCHAR(100) NOT NULL,
  job_type     VARCHAR(20)  NOT NULL CHECK (job_type IN ('FULL_TIME', 'INTERNSHIP', 'CONTRACT')),
  description  TEXT         NOT NULL,
  apply_by     DATE,
  status       VARCHAR(20)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'REMOVED')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE job_application (
  application_id SERIAL PRIMARY KEY,
  job_id         INTEGER      NOT NULL REFERENCES job_post(job_id) ON DELETE CASCADE,
  applicant_id   INTEGER      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  resume_url     VARCHAR(500),
  cover_note     TEXT,
  status         VARCHAR(20)  NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'SHORTLISTED', 'REJECTED', 'HIRED')),
  applied_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_job_application UNIQUE (job_id, applicant_id)
);

CREATE INDEX idx_job_post_posted_by ON job_post (posted_by);
CREATE INDEX idx_job_post_status ON job_post (status);
CREATE INDEX idx_job_post_type ON job_post (job_type);
CREATE INDEX idx_job_post_created ON job_post (created_at DESC);

CREATE INDEX idx_job_application_job ON job_application (job_id);
CREATE INDEX idx_job_application_applicant ON job_application (applicant_id);
CREATE INDEX idx_job_application_status ON job_application (status);

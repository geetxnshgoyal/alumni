-- Core identity tables (owner: team lead). Mirrors docs/er-diagram.svg.

CREATE TABLE department (
  dept_id   SERIAL PRIMARY KEY,
  dept_code VARCHAR(20)  NOT NULL UNIQUE,
  dept_name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id            SERIAL PRIMARY KEY,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  phone              VARCHAR(20) UNIQUE,
  role               VARCHAR(10)  NOT NULL CHECK (role IN ('ADMIN', 'ALUMNI', 'STUDENT')),
  account_status     VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  email_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  failed_login_count INTEGER      NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at      TIMESTAMPTZ
);

CREATE TABLE alumni_profile (
  user_id             INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id             INTEGER      NOT NULL REFERENCES department(dept_id),
  enrollment_no       VARCHAR(30)  NOT NULL UNIQUE,
  degree              VARCHAR(80)  NOT NULL,
  graduation_year     SMALLINT     NOT NULL CHECK (graduation_year BETWEEN 1950 AND 2100),
  current_company     VARCHAR(120),
  designation         VARCHAR(120),
  industry            VARCHAR(80),
  city                VARCHAR(80),
  country             VARCHAR(80),
  bio                 TEXT,
  linkedin_url        VARCHAR(255),
  photo_url           VARCHAR(500),
  verification_status VARCHAR(10)  NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ
);

CREATE TABLE student_profile (
  user_id            INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id            INTEGER     NOT NULL REFERENCES department(dept_id),
  enrollment_no      VARCHAR(30) NOT NULL UNIQUE,
  current_semester   SMALLINT    NOT NULL CHECK (current_semester BETWEEN 1 AND 12),
  expected_grad_year SMALLINT    NOT NULL CHECK (expected_grad_year BETWEEN 1950 AND 2100)
);

CREATE TABLE skill (
  skill_id   SERIAL PRIMARY KEY,
  skill_name VARCHAR(60) NOT NULL
);
-- Unique regardless of case, so "Node.js" and "node.js" are the same skill.
CREATE UNIQUE INDEX uk_skill_name ON skill (LOWER(skill_name));

CREATE TABLE user_skill (
  user_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skill(skill_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE interest (
  interest_id   SERIAL PRIMARY KEY,
  interest_name VARCHAR(60) NOT NULL
);
CREATE UNIQUE INDEX uk_interest_name ON interest (LOWER(interest_name));

CREATE TABLE user_interest (
  user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  interest_id INTEGER NOT NULL REFERENCES interest(interest_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, interest_id)
);

CREATE INDEX idx_alumni_dept ON alumni_profile (dept_id);
CREATE INDEX idx_alumni_grad_year ON alumni_profile (graduation_year);
CREATE INDEX idx_alumni_industry ON alumni_profile (industry);
CREATE INDEX idx_alumni_city ON alumni_profile (city);
CREATE INDEX idx_alumni_status ON alumni_profile (verification_status);

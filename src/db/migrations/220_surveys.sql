-- Surveys and Questionnaires tables (owner: Member C - Ravi Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE survey (
  survey_id    SERIAL PRIMARY KEY,
  created_by   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  opens_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at    TIMESTAMPTZ,
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_survey_status ON survey (status);

CREATE TABLE survey_question (
  question_id   SERIAL PRIMARY KEY,
  survey_id     INTEGER NOT NULL REFERENCES survey(survey_id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'RATING')),
  is_required   BOOLEAN NOT NULL DEFAULT TRUE,
  position      INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_survey ON survey_question (survey_id, position);

CREATE TABLE question_option (
  option_id   SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES survey_question(question_id) ON DELETE CASCADE,
  option_text VARCHAR(255) NOT NULL,
  position    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_option_question ON question_option (question_id, position);

CREATE TABLE survey_response (
  response_id  SERIAL PRIMARY KEY,
  survey_id    INTEGER NOT NULL REFERENCES survey(survey_id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_survey_user UNIQUE (survey_id, user_id)
);

CREATE INDEX idx_response_survey ON survey_response (survey_id);
CREATE INDEX idx_response_user ON survey_response (user_id);

CREATE TABLE response_answer (
  answer_id    SERIAL PRIMARY KEY,
  response_id  INTEGER NOT NULL REFERENCES survey_response(response_id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL REFERENCES survey_question(question_id) ON DELETE CASCADE,
  answer_text  TEXT,
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5)
);

CREATE INDEX idx_answer_response ON response_answer (response_id);
CREATE INDEX idx_answer_question ON response_answer (question_id);

CREATE TABLE answer_choice (
  answer_id INTEGER NOT NULL REFERENCES response_answer(answer_id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES question_option(option_id) ON DELETE CASCADE,
  PRIMARY KEY (answer_id, option_id)
);

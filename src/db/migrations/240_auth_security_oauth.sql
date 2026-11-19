-- Migration 240: Modern Authentication Architectures (Lecture 16)
-- Access Token + Refresh Token Rotation, Replay Detection & OAuth2 / OIDC Google Login

-- Allow users authenticated via OAuth (Google) to have NULL password_hash
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Support OAuth providers & federated identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Refresh Token storage supporting token rotation and family-based reuse detection (Lecture 16 Slide 14 & 15)
CREATE TABLE IF NOT EXISTS refresh_token (
  token_id    SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of plaintext refresh token
  family_id   VARCHAR(64) NOT NULL,         -- Token family identifier to trace reuse/rotation
  is_revoked  BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replaced_by INTEGER REFERENCES refresh_token(token_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_token(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_token_family ON refresh_token(family_id);

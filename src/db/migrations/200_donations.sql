-- Donations and Campaigns tables (owner: Member C - Ravi Sharma). Mirrors docs/er-diagram.svg.

CREATE TABLE campaign (
  campaign_id  SERIAL PRIMARY KEY,
  created_by   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  title        VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL,
  goal_amount  NUMERIC(12, 2) NOT NULL CHECK (goal_amount > 0),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_campaign_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_campaign_status ON campaign (status);

CREATE TABLE donation (
  donation_id     SERIAL PRIMARY KEY,
  campaign_id     INTEGER NOT NULL REFERENCES campaign(campaign_id) ON DELETE RESTRICT,
  donor_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency        VARCHAR(10) NOT NULL DEFAULT 'INR',
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  donation_status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (donation_status IN ('INITIATED', 'SUCCESS', 'FAILED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donation_campaign ON donation (campaign_id, donation_status);
CREATE INDEX idx_donation_donor ON donation (donor_id);

CREATE TABLE payment_transaction (
  transaction_id     SERIAL PRIMARY KEY,
  donation_id        INTEGER NOT NULL REFERENCES donation(donation_id) ON DELETE CASCADE,
  gateway            VARCHAR(20) NOT NULL CHECK (gateway IN ('RAZORPAY', 'STRIPE')),
  gateway_order_id   VARCHAR(100) UNIQUE NOT NULL,
  gateway_payment_id VARCHAR(100) UNIQUE,
  signature          VARCHAR(255),
  amount             NUMERIC(12, 2) NOT NULL,
  currency           VARCHAR(10) NOT NULL DEFAULT 'INR',
  status             VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_donation ON payment_transaction (donation_id);

CREATE TABLE donation_receipt (
  receipt_id   SERIAL PRIMARY KEY,
  donation_id  INTEGER UNIQUE NOT NULL REFERENCES donation(donation_id) ON DELETE CASCADE,
  receipt_no   VARCHAR(50) UNIQUE NOT NULL,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_url  VARCHAR(500)
);

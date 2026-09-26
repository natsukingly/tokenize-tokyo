-- Apply once to the dedicated PostgreSQL database before enabling checkout.
CREATE TABLE IF NOT EXISTS card_orders (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL,
  quote jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('creating', 'awaiting_payment', 'fulfilling', 'submitted', 'fulfilled', 'expired', 'review')),
  session_id text UNIQUE,
  tx_hash text,
  created_at bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_orders_owner_created ON card_orders (owner_hash, created_at);
CREATE TABLE IF NOT EXISTS card_checkout_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL
);

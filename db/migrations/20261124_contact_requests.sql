-- Richieste dal form contatti del sito damaigarden.it (endpoint POST /api/contact).
-- Idempotente: puo' essere eseguita piu' volte. Non modifica registrazioni ne' fasce.

BEGIN;

CREATE TABLE IF NOT EXISTS contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  event_type text NOT NULL,
  event_date text,
  guests integer,
  details text,
  locale text NOT NULL DEFAULT 'it',
  page text,
  ref text,
  source text,
  user_agent text,
  email_sent_at timestamptz,
  status text NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON contact_requests (created_at DESC);

COMMIT;

-- Opt-out dalle comunicazioni promozionali e registro degli invii di campagna.
-- Idempotente: può essere eseguita più volte. Non modifica registrazioni né fasce.

BEGIN;

-- 1. Indirizzi che hanno chiesto di non ricevere più comunicazioni promozionali.
--    Vale per indirizzo email (minuscolo), quindi su tutte le edizioni.
CREATE TABLE IF NOT EXISTS email_suppressions (
  email text PRIMARY KEY CONSTRAINT email_suppressions_lower_check CHECK (email = lower(email)),
  source text NOT NULL DEFAULT 'unsubscribe_link',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Registro degli invii di campagna: una sola riga per (campagna, email),
--    così lo stesso indirizzo non può ricevere due volte la stessa campagna.
CREATE TABLE IF NOT EXISTS campaign_sends (
  id bigserial PRIMARY KEY,
  campaign text NOT NULL,
  email text NOT NULL CONSTRAINT campaign_sends_lower_check CHECK (email = lower(email)),
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sending' CONSTRAINT campaign_sends_status_check CHECK (status IN ('sending','sent','failed')),
  provider_message_id text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_sends_campaign_email_key UNIQUE (campaign, email)
);

COMMIT;

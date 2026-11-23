-- Schema per una installazione pulita (include già edizioni, bambini e walk-in).
-- Su un database esistente NON usare questo file: applicare db/migrations/20261123_edition_natale.sql.

CREATE TABLE IF NOT EXISTS open_day_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition text NOT NULL DEFAULT 'open-days-2026',
  event_date date NOT NULL,
  start_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 60 CHECK (capacity > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT open_day_slots_edition_date_time_key UNIQUE (edition, event_date, start_time)
);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_code text NOT NULL UNIQUE,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  edition text NOT NULL DEFAULT 'open-days-2026',
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  event_type text NOT NULL,
  planned_event_date date,
  guest_count integer CHECK (guest_count IS NULL OR guest_count > 0),
  companions integer NOT NULL DEFAULT 0 CHECK (companions >= 0 AND companions <= 10),
  children integer NOT NULL DEFAULT 0 CONSTRAINT registrations_children_check CHECK (children >= 0 AND children <= 10),
  slot_id uuid NOT NULL REFERENCES open_day_slots(id),
  source text,
  notes text,
  privacy_consent boolean NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','checked_in','exited','cancelled','no_show')),
  lead_stage text NOT NULL DEFAULT 'new' CHECK (lead_stage IN ('new','hot','potential','evaluating','follow_up','long_term','won','lost')),
  registration_mode text NOT NULL DEFAULT 'online' CHECK (registration_mode IN ('online','walk_in')),
  registration_method text NOT NULL DEFAULT 'self' CHECK (registration_method IN ('self','staff')),
  arrived_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cadeau_delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registrations_slot_id_idx ON registrations(slot_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations(status);
CREATE INDEX IF NOT EXISTS registrations_lead_stage_idx ON registrations(lead_stage);
CREATE INDEX IF NOT EXISTS registrations_email_idx ON registrations(lower(email));
CREATE INDEX IF NOT EXISTS registrations_phone_idx ON registrations(phone);
CREATE INDEX IF NOT EXISTS registrations_edition_idx ON registrations(edition);
CREATE INDEX IF NOT EXISTS registrations_mode_idx ON registrations(registration_mode);
CREATE INDEX IF NOT EXISTS registrations_method_idx ON registrations(registration_method);
CREATE INDEX IF NOT EXISTS registrations_cadeau_idx ON registrations(cadeau_delivered_at);

CREATE TABLE IF NOT EXISTS registration_events (
  id bigserial PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communications (
  id bigserial PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','sms','internal')),
  message_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','skipped')),
  provider_message_id text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communications_due_idx ON communications(status, scheduled_for);

-- Fasce del Damai Christmas Village: 12 e 13 dicembre 2026, ogni 30 minuti
-- dalle 16:00 alle 21:00 comprese (ultimo ingresso 21:00), 60 persone per fascia.
INSERT INTO open_day_slots (edition, event_date, start_time, capacity)
SELECT 'natale-2026', d, t::time, 60
FROM unnest(ARRAY['2026-12-12'::date, '2026-12-13'::date]) AS d
CROSS JOIN generate_series(
  timestamp '2026-12-12 16:00', timestamp '2026-12-12 21:00', interval '30 minutes'
) AS t
ON CONFLICT (edition, event_date, start_time) DO NOTHING;

CREATE TABLE IF NOT EXISTS open_day_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  start_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 15 CHECK (capacity > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_date, start_time)
);

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_code text NOT NULL UNIQUE,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  event_type text NOT NULL,
  planned_event_date date,
  guest_count integer CHECK (guest_count IS NULL OR guest_count > 0),
  companions integer NOT NULL DEFAULT 0 CHECK (companions >= 0 AND companions <= 10),
  slot_id uuid NOT NULL REFERENCES open_day_slots(id),
  source text,
  notes text,
  privacy_consent boolean NOT NULL,
  marketing_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','checked_in','cancelled','no_show')),
  lead_stage text NOT NULL DEFAULT 'new' CHECK (lead_stage IN ('new','hot','potential','evaluating','follow_up','long_term','won','lost')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registrations_slot_id_idx ON registrations(slot_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations(status);
CREATE INDEX IF NOT EXISTS registrations_lead_stage_idx ON registrations(lead_stage);
CREATE INDEX IF NOT EXISTS registrations_email_idx ON registrations(lower(email));
CREATE INDEX IF NOT EXISTS registrations_phone_idx ON registrations(phone);

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

INSERT INTO open_day_slots (event_date, start_time, capacity)
SELECT d::date, t::time, 15
FROM unnest(ARRAY['2026-10-30'::date,'2026-10-31'::date,'2026-11-01'::date]) d
CROSS JOIN unnest(ARRAY['16:00'::time,'16:30'::time,'17:00'::time,'17:30'::time,'18:00'::time,'18:30'::time,'19:00'::time,'19:30'::time,'20:00'::time,'20:30'::time]) t
ON CONFLICT (event_date, start_time) DO NOTHING;

ALTER TABLE registrations
  DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE registrations
  ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('registered','checked_in','exited','cancelled','no_show'));

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadeau_delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS registrations_cadeau_idx
  ON registrations(cadeau_delivered_at);

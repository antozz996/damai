-- Modalità registrazione (online vs walk_in)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'online'
  CHECK (registration_mode IN ('online', 'walk_in'));

-- Metodo inserimento (self-service cliente vs staff al desk)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS registration_method text NOT NULL DEFAULT 'self'
  CHECK (registration_method IN ('self', 'staff'));

-- Orario effettivo di arrivo (rilevato al momento della registrazione walk-in)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

-- Indici per le query dashboard e statistiche
CREATE INDEX IF NOT EXISTS registrations_mode_idx ON registrations(registration_mode);
CREATE INDEX IF NOT EXISTS registrations_method_idx ON registrations(registration_method);

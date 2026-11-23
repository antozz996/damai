-- Damai Christmas Village (12-13 dicembre 2026): edizioni separate, numero di bambini,
-- evento già prenotato presso le strutture, capienza 100 persone per fascia.
-- Idempotente: può essere eseguita più volte. I dati degli Open Days 2026 restano intatti
-- e vengono etichettati con l'edizione 'open-days-2026' (valore di default della colonna).

BEGIN;

-- 1. Colonna edizione su fasce e registrazioni.
ALTER TABLE open_day_slots
  ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'open-days-2026';

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'open-days-2026';

-- 2. Numero di bambini nel gruppo (informativo: sono già compresi in companions).
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS children integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'registrations'::regclass AND conname = 'registrations_children_check'
  ) THEN
    ALTER TABLE registrations
      ADD CONSTRAINT registrations_children_check CHECK (children >= 0 AND children <= 10);
  END IF;
END $$;

-- 3. Unicità delle fasce: da (event_date, start_time) a (edition, event_date, start_time).
--    Il vecchio vincolo viene cercato per colonne, qualunque sia il suo nome.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'open_day_slots'::regclass
      AND con.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM pg_attribute a
        WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
      ) = ARRAY['event_date', 'start_time']
  LOOP
    EXECUTE format('ALTER TABLE open_day_slots DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'open_day_slots'::regclass AND conname = 'open_day_slots_edition_date_time_key'
  ) THEN
    ALTER TABLE open_day_slots
      ADD CONSTRAINT open_day_slots_edition_date_time_key UNIQUE (edition, event_date, start_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS registrations_edition_idx ON registrations(edition);

-- 3b. Evento già prenotato presso una delle strutture (facoltativo).
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS existing_booking_venue text;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS existing_booking_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'registrations'::regclass AND conname = 'registrations_existing_booking_venue_check'
  ) THEN
    ALTER TABLE registrations
      ADD CONSTRAINT registrations_existing_booking_venue_check
      CHECK (existing_booking_venue IS NULL OR existing_booking_venue IN ('Playa Luna', 'Culto', 'Damai'));
  END IF;
END $$;

-- 4. Fasce del Christmas Village: 12 e 13 dicembre 2026, ogni 30 minuti
--    dalle 16:00 alle 21:00 comprese (ultimo ingresso 21:00), 100 persone per fascia
--    (30 minuti di permanenza per fascia).
ALTER TABLE open_day_slots ALTER COLUMN capacity SET DEFAULT 100;

INSERT INTO open_day_slots (edition, event_date, start_time, capacity)
SELECT 'natale-2026', d, t::time, 100
FROM unnest(ARRAY['2026-12-12'::date, '2026-12-13'::date]) AS d
CROSS JOIN generate_series(
  timestamp '2026-12-12 16:00', timestamp '2026-12-12 21:00', interval '30 minutes'
) AS t
ON CONFLICT (edition, event_date, start_time) DO NOTHING;

-- Se la migrazione era già stata applicata con la vecchia capienza (60), porta le fasce a 100.
-- Tocca solo le fasce ancora a 60: una capienza modificata a mano dallo staff non viene riscritta.
UPDATE open_day_slots
SET capacity = 100, updated_at = now()
WHERE edition = 'natale-2026' AND capacity = 60;

COMMIT;

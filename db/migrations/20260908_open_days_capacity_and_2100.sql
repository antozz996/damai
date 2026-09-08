-- Open Days 2026: raise each published slot to 60 people and add the 21:00 slot.
-- Safe to run more than once: existing reservations are preserved.

ALTER TABLE open_day_slots
  ALTER COLUMN capacity SET DEFAULT 60;

UPDATE open_day_slots
SET capacity = 60,
    updated_at = now()
WHERE event_date IN ('2026-10-30', '2026-10-31', '2026-11-01')
  AND start_time BETWEEN '16:00'::time AND '21:00'::time;

INSERT INTO open_day_slots (event_date, start_time, capacity)
SELECT d::date, '21:00'::time, 60
FROM unnest(ARRAY[
  '2026-10-30'::date,
  '2026-10-31'::date,
  '2026-11-01'::date
]) AS dates(d)
ON CONFLICT (event_date, start_time) DO UPDATE
SET capacity = EXCLUDED.capacity,
    is_active = true,
    updated_at = now();

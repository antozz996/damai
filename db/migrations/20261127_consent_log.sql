-- Registro delle scelte del banner cookie di damaigarden.it (audit checksito LP-03).
-- Serve a dimostrare il consenso (art. 7.1 GDPR): niente IP, niente dati personali,
-- solo un identificativo casuale generato nel browser e le scelte fatte.
-- Idempotente: puo' essere eseguita piu' volte. Non tocca altre tabelle.

BEGIN;

CREATE TABLE IF NOT EXISTS consent_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  consent_id uuid NOT NULL,
  version integer NOT NULL,
  analytics boolean NOT NULL,
  marketing boolean NOT NULL,
  page text,
  locale text
);

CREATE INDEX IF NOT EXISTS consent_log_consent_id_idx ON consent_log (consent_id);
CREATE INDEX IF NOT EXISTS consent_log_created_at_idx ON consent_log (created_at DESC);

COMMIT;

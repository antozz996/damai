import type { PoolClient } from 'pg';

/**
 * Ringraziamento post-evento: viene messo in coda al check-in (non esiste più la
 * registrazione dell'uscita) per le 09:00 (Europe/Rome) del giorno successivo alla fascia.
 * Una sola volta per registrazione, e solo se l'ospite ha un'email reale.
 */
export async function queueThankYou(client: PoolClient, registrationId: string) {
  await client.query(`
    INSERT INTO communications (registration_id, channel, message_type, status, scheduled_for)
    SELECT r.id, 'email', 'thank_you', 'queued',
      ((s.event_date + 1 + time '09:00') AT TIME ZONE 'Europe/Rome')
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.id = $1
      AND r.email NOT LIKE '%@no-email.damai.local'
      AND NOT EXISTS (
        SELECT 1 FROM communications c
        WHERE c.registration_id = r.id AND c.message_type IN ('thank_you','exit_thank_you')
      )
  `, [registrationId]);
}

import { createHash } from 'crypto';
import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';
import { sendLdvInvite } from '@/lib/notifications';
import { isValidEmail, unsubscribeConfigured, unsubscribeUrl } from '@/lib/unsubscribe';

/**
 * Campagna "invito al Christmas Village" per i contatti de La Dolce Vita · Open Days.
 * Un solo invio per indirizzo: ogni tentativo passa da una riga di `campaign_sends`
 * con chiave unica (campagna, email).
 */
export const LDV_CAMPAIGN = {
  key: 'ldv_natale_invite',
  sourceEdition: 'open-days-2026',
  confirmPhrase: 'INVIA',
  batchSize: 20,
  maxAttempts: 3,
} as const;

/** Pausa tra un invio e l'altro: resta sotto il limite di 2 richieste al secondo di Resend. */
const SEND_PAUSE_MS = 600;

export type AudienceOptions = {
  /** Includi anche chi ha solo registrazioni annullate (default: esclusi). */
  includeCancelled: boolean;
  /** Escludi chi ha già una registrazione attiva all'edizione corrente (default: inclusi). */
  excludeRegistered: boolean;
};

export const DEFAULT_AUDIENCE_OPTIONS: AudienceOptions = { includeCancelled: false, excludeRegistered: false };

export type AudienceRow = {
  email: string;
  registrationId: string;
  firstName: string;
  /** Tutte le registrazioni dell'indirizzo agli Open Days sono annullate. */
  cancelled: boolean;
  attended: boolean;
  marketingConsent: boolean;
  invalid: boolean;
  suppressed: boolean;
  /** Ha già una registrazione attiva all'edizione corrente. */
  registered: boolean;
  sendStatus: 'sending' | 'sent' | 'failed' | null;
  /** Un nuovo tentativo è ammesso (mai inviato, fallito meno di 3 volte, o invio interrotto). */
  retryable: boolean;
};

export function campaignEnabled(): boolean {
  return process.env.LDV_CAMPAIGN_ENABLED === 'true';
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Un indirizzo per riga (email distinte, minuscole) con tutto ciò che serve a decidere. */
export async function loadAudience(): Promise<AudienceRow[]> {
  const result = await query<{
    email: string; registration_id: string; first_name: string; all_cancelled: boolean; attended: boolean;
    marketing_consent: boolean; suppressed: boolean; registered: boolean; send_status: AudienceRow['sendStatus'];
    retryable: boolean;
  }>(`
    WITH per_email AS (
      SELECT lower(trim(r.email)) AS email,
        (array_agg(r.id::text ORDER BY (r.status = 'cancelled'), r.created_at, r.id))[1] AS registration_id,
        (array_agg(r.first_name ORDER BY (r.status = 'cancelled'), r.created_at, r.id))[1] AS first_name,
        bool_and(r.status = 'cancelled') AS all_cancelled,
        bool_or(r.status IN ('checked_in','exited')) AS attended,
        bool_or(r.marketing_consent) AS marketing_consent
      FROM registrations r
      WHERE r.edition = $1
      GROUP BY lower(trim(r.email))
    )
    SELECT p.email, p.registration_id, p.first_name, p.all_cancelled, p.attended, p.marketing_consent,
      (s.email IS NOT NULL) AS suppressed,
      EXISTS (
        SELECT 1 FROM registrations n
        WHERE n.edition = $2 AND n.status <> 'cancelled' AND lower(trim(n.email)) = p.email
      ) AS registered,
      cs.status AS send_status,
      (cs.id IS NULL
        OR (cs.status = 'failed' AND cs.attempts < $4)
        OR (cs.status = 'sending' AND cs.claimed_at < now() - interval '15 minutes')) AS retryable
    FROM per_email p
    LEFT JOIN email_suppressions s ON s.email = p.email
    LEFT JOIN campaign_sends cs ON cs.campaign = $3 AND cs.email = p.email
    ORDER BY p.email
  `, [LDV_CAMPAIGN.sourceEdition, EVENT.edition, LDV_CAMPAIGN.key, LDV_CAMPAIGN.maxAttempts]);

  return result.rows.map(row => ({
    email: row.email,
    registrationId: row.registration_id,
    firstName: row.first_name,
    cancelled: row.all_cancelled,
    attended: row.attended,
    marketingConsent: row.marketing_consent,
    invalid: !isValidEmail(row.email),
    suppressed: row.suppressed,
    registered: row.registered,
    sendStatus: row.send_status,
    retryable: row.retryable,
  }));
}

/** Motivo di esclusione, oppure null se l'indirizzo è destinatario con queste opzioni. */
export function exclusionReason(row: AudienceRow, options: AudienceOptions): 'invalid' | 'suppressed' | 'cancelled' | 'registered' | null {
  if (row.invalid) return 'invalid';
  if (row.suppressed) return 'suppressed';
  if (row.cancelled && !options.includeCancelled) return 'cancelled';
  if (row.registered && options.excludeRegistered) return 'registered';
  return null;
}

export function summarizeAudience(rows: AudienceRow[], options: AudienceOptions) {
  const usable = rows.filter(row => !row.invalid && !row.suppressed);
  const recipients = rows.filter(row => exclusionReason(row, options) === null);
  return {
    distinctEmails: rows.length,
    invalid: rows.filter(row => row.invalid).length,
    suppressed: rows.filter(row => !row.invalid && row.suppressed).length,
    withCancelled: usable.length,
    withoutCancelled: usable.filter(row => !row.cancelled).length,
    onlyCancelled: usable.filter(row => row.cancelled).length,
    alreadyRegistered: usable.filter(row => row.registered).length,
    marketingConsent: usable.filter(row => row.marketingConsent).length,
    recipients: recipients.length,
    sent: recipients.filter(row => row.sendStatus === 'sent').length,
    failed: recipients.filter(row => row.sendStatus === 'failed' && !row.retryable).length,
    toSend: recipients.filter(row => row.sendStatus !== 'sent' && row.retryable).length,
  };
}

function idempotencyKey(email: string): string {
  return `damai-${LDV_CAMPAIGN.key}-${createHash('sha256').update(email).digest('hex').slice(0, 32)}`;
}

/**
 * Invia un lotto (al massimo `batchSize` indirizzi) e restituisce quanti ne restano.
 * Sicuro da richiamare più volte e in parallelo: ogni indirizzo viene "prenotato"
 * in `campaign_sends` prima dell'invio, e chi risulta già inviato non viene mai ripreso.
 */
export async function sendCampaignBatch(options: AudienceOptions, pauseMs = SEND_PAUSE_MS) {
  if (!campaignEnabled()) throw new Error('CAMPAIGN_DISABLED');
  if (!unsubscribeConfigured()) throw new Error('UNSUBSCRIBE_NOT_CONFIGURED');
  if (!emailConfigured()) throw new Error('EMAIL_NOT_CONFIGURED');

  const audience = await loadAudience();
  const pending = audience.filter(row => exclusionReason(row, options) === null && row.sendStatus !== 'sent' && row.retryable);
  const batch = pending.slice(0, LDV_CAMPAIGN.batchSize);
  const outcome = { sent: 0, failed: 0, skipped: 0 };

  for (const [index, row] of batch.entries()) {
    // Prenotazione atomica: una sola esecuzione ottiene la riga. L'opt-out viene
    // ricontrollato qui, nel caso sia arrivato dopo il caricamento dell'elenco.
    const claim = await query<{ id: string }>(`
      INSERT INTO campaign_sends (campaign, email, registration_id, status, attempts, claimed_at)
      SELECT $1, $2, $3::uuid, 'sending', 1, now()
      WHERE NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.email = $2)
      ON CONFLICT (campaign, email) DO UPDATE
        SET status = 'sending', attempts = campaign_sends.attempts + 1, claimed_at = now()
        WHERE (campaign_sends.status = 'failed' AND campaign_sends.attempts < $4)
           OR (campaign_sends.status = 'sending' AND campaign_sends.claimed_at < now() - interval '15 minutes')
      RETURNING id::text
    `, [LDV_CAMPAIGN.key, row.email, row.registrationId, LDV_CAMPAIGN.maxAttempts]);
    if (!claim.rows.length) {
      outcome.skipped++;
      continue;
    }
    const id = claim.rows[0].id;
    try {
      const result = await sendLdvInvite(
        row.email,
        { firstName: row.firstName, attended: row.attended, unsubscribeUrl: unsubscribeUrl(row.email) },
        { idempotencyKey: idempotencyKey(row.email) },
      );
      if (!result.sent) throw new Error('Email non configurata');
      await query(
        `UPDATE campaign_sends SET status='sent', provider_message_id=$1, sent_at=now(), last_error=NULL WHERE id=$2`,
        [result.providerId || null, id],
      );
      outcome.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1500) : 'Unknown error';
      await query(`UPDATE campaign_sends SET status='failed', last_error=$1 WHERE id=$2`, [message, id]);
      outcome.failed++;
    }
    if (pauseMs > 0 && index < batch.length - 1) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }

  const after = summarizeAudience(await loadAudience(), options);
  return { ...outcome, remaining: after.toSend, totalSent: after.sent, totalFailed: after.failed, recipients: after.recipients };
}

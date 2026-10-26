import { z } from 'zod';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { Guest } from '@/lib/notifications';

export type SlotRow = {
  id: string;
  event_date: string;
  start_time: string;
  capacity: number;
};

export function walkInEmail(code: string): string {
  const sanitized = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `walkin_${sanitized}@no-email.damai.local`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('@no-email.damai.local');
}

export function makeWalkInCode(): string {
  return `WI-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export const walkInSchema = z.object({
  firstName: z.string().trim().min(2, 'Inserisci il nome (almeno 2 caratteri)').max(80),
  lastName: z.string().trim().min(2, 'Inserisci il cognome (almeno 2 caratteri)').max(80),
  phone: z.string().trim().min(7, 'Inserisci un recapito telefonico valido').max(30),
  eventType: z.string().trim().min(2, 'Seleziona la tipologia di evento').max(80),
  companions: z.coerce.number().int().min(0).max(10).default(0),
  email: z.string().trim().email('Indirizzo email non valido').max(160).optional().or(z.literal('')),
  plannedEventDate: z.string().trim().optional().or(z.literal('')),
  guestCount: z.coerce.number().int().min(1).max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
  privacyConsent: z.literal(true),
  marketingConsent: z.boolean().default(false),
  source: z.string().trim().max(100).optional(),
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

export type WalkInInput = z.infer<typeof walkInSchema>;

export async function findCurrentSlot(client: PoolClient): Promise<SlotRow | null> {
  // 1. Cerca lo slot del giorno corrente in Europe/Rome più vicino/attivo (con 30 min di anticipo)
  const currentRes = await client.query<SlotRow>(`
    SELECT id, event_date::text, start_time::text, capacity
    FROM open_day_slots
    WHERE is_active = true
      AND event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Rome')::date
      AND start_time <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Rome')::time + interval '30 minutes'
    ORDER BY start_time DESC
    LIMIT 1
  `);

  if (currentRes.rowCount && currentRes.rows[0]) {
    return currentRes.rows[0];
  }

  // 2. Se l'ospite arriva prima dell'inizio del primo slot del giorno dell'evento
  const firstSlotToday = await client.query<SlotRow>(`
    SELECT id, event_date::text, start_time::text, capacity
    FROM open_day_slots
    WHERE is_active = true
      AND event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Rome')::date
    ORDER BY start_time ASC
    LIMIT 1
  `);

  if (firstSlotToday.rowCount && firstSlotToday.rows[0]) {
    return firstSlotToday.rows[0];
  }

  // 3. Fallback: se siamo in ambiente di test o al di fuori delle date ufficiali,
  // seleziona lo slot attivo più prossimo nel futuro, oppure il più recente
  const fallbackSlot = await client.query<SlotRow>(`
    SELECT id, event_date::text, start_time::text, capacity
    FROM open_day_slots
    WHERE is_active = true
    ORDER BY
      CASE WHEN event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Rome')::date THEN 0 ELSE 1 END,
      event_date ASC,
      start_time ASC
    LIMIT 1
  `);

  return fallbackSlot.rows[0] || null;
}

export type WalkInResult = {
  registrationId: string;
  registrationCode: string;
  qrToken: string;
  guest: Guest;
  slot: SlotRow;
  hasRealEmail: boolean;
};

export async function createWalkIn(
  client: PoolClient,
  data: WalkInInput,
  method: 'self' | 'staff',
  overrideSlotId?: string
): Promise<WalkInResult> {
  let slot: SlotRow;

  if (overrideSlotId) {
    const slotRes = await client.query<SlotRow>(
      `SELECT id, event_date::text, start_time::text, capacity
       FROM open_day_slots
       WHERE id = $1 AND is_active = true
       FOR UPDATE`,
      [overrideSlotId]
    );
    if (!slotRes.rowCount || !slotRes.rows[0]) {
      throw new Error('NO_ACTIVE_SLOT');
    }
    slot = slotRes.rows[0];
  } else {
    const candidate = await findCurrentSlot(client);
    if (!candidate) {
      throw new Error('NO_ACTIVE_SLOT');
    }
    // Lock dello slot selezionato
    const lockedRes = await client.query<SlotRow>(
      `SELECT id, event_date::text, start_time::text, capacity
       FROM open_day_slots
       WHERE id = $1 AND is_active = true
       FOR UPDATE`,
      [candidate.id]
    );
    if (!lockedRes.rowCount || !lockedRes.rows[0]) {
      throw new Error('NO_ACTIVE_SLOT');
    }
    slot = lockedRes.rows[0];
  }

  // Controllo duplicato telefono tra le registrazioni non cancellate
  const duplicate = await client.query(
    `SELECT 1 FROM registrations
     WHERE status <> 'cancelled' AND phone = $1
     LIMIT 1
     FOR UPDATE`,
    [data.phone]
  );
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new Error('DUPLICATE');
  }

  // Calcolo capienza attuale (i walk-in possono sempre superare la capienza massima dello slot)
  const partySize = 1 + (data.companions || 0);
  const usage = await client.query<{ used: string }>(
    `SELECT COALESCE(SUM(1 + companions), 0)::text AS used
     FROM registrations
     WHERE slot_id = $1 AND status IN ('registered', 'checked_in')`,
    [slot.id]
  );
  const used = Number(usage.rows[0]?.used ?? 0);
  const isOverCapacity = used + partySize > slot.capacity;

  const registrationCode = makeWalkInCode();
  const hasRealEmail = Boolean(data.email && data.email.trim().length > 0);
  const emailToStore = hasRealEmail ? data.email!.trim().toLowerCase() : walkInEmail(registrationCode);

  const insert = await client.query<{ id: string; qr_token: string }>(
    `INSERT INTO registrations (
       registration_code, first_name, last_name, phone, email, event_type,
       planned_event_date, guest_count, companions, slot_id, source, notes,
       privacy_consent, marketing_consent, registration_mode, registration_method,
       arrived_at, utm_source, utm_medium, utm_campaign
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       NULLIF($7, '')::date, $8, $9, $10, $11, $12,
       $13, $14, 'walk_in', $15,
       now(), $16, $17, $18
     )
     RETURNING id, qr_token::text`,
    [
      registrationCode,
      data.firstName,
      data.lastName,
      data.phone,
      emailToStore,
      data.eventType,
      data.plannedEventDate || '',
      data.guestCount ?? null,
      data.companions || 0,
      slot.id,
      data.source || (method === 'staff' ? 'desk_staff' : 'walk_in_qr'),
      data.notes || null,
      data.privacyConsent,
      data.marketingConsent || false,
      method,
      data.utmSource || null,
      data.utmMedium || null,
      data.utmCampaign || null,
    ]
  );

  const registrationId = insert.rows[0].id;
  const qrToken = insert.rows[0].qr_token;

  // Traccia evento di registrazione
  await client.query(
    `INSERT INTO registration_events (registration_id, event_type, metadata)
     VALUES ($1, 'registered', $2::jsonb)`,
    [registrationId, JSON.stringify({ partySize, registration_mode: 'walk_in', method, overCapacity: isOverCapacity, slotOccupancy: used + partySize })]
  );

  // Inserisci in coda comunicazioni SOLO per email reale (conferma immediata)
  if (hasRealEmail) {
    await client.query(
      `INSERT INTO communications (registration_id, channel, message_type, status, scheduled_for)
       VALUES ($1, 'email', 'registration_confirmation', 'queued', now())`,
      [registrationId]
    );
  }

  const guest: Guest = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: emailToStore,
    registrationCode,
    qrToken,
    eventDate: slot.event_date,
    startTime: slot.start_time,
  };

  return {
    registrationId,
    registrationCode,
    qrToken,
    guest,
    slot,
    hasRealEmail,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { query, transaction } from '@/lib/db';
import { registrationSchema } from '@/lib/validation';
import { Guest, sendEmail } from '@/lib/notifications';

function makeCode() {
  return `D26-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Controlla i dati inseriti e riprova.' }, { status: 400 });
    }

    const d = parsed.data;
    const result = await transaction(async client => {
      const slot = await client.query<{ id:string; capacity:number; event_date:string; start_time:string }>(
        `SELECT id, capacity, event_date::text, start_time::text
         FROM open_day_slots WHERE id=$1 AND is_active=true FOR UPDATE`,
        [d.slotId]
      );
      if (!slot.rowCount) throw new Error('SLOT_NOT_FOUND');

      const duplicate = await client.query(`
        SELECT 1 FROM registrations
        WHERE status <> 'cancelled' AND (lower(email)=lower($1) OR phone=$2)
        LIMIT 1
      `,[d.email,d.phone]);
      if (duplicate.rowCount) throw new Error('DUPLICATE');

      const usage = await client.query<{ used:string }>(
        `SELECT COALESCE(SUM(1 + companions),0)::text AS used FROM registrations WHERE slot_id=$1 AND status IN ('registered','checked_in')`,
        [d.slotId]
      );
      const used = Number(usage.rows[0]?.used ?? 0);
      const partySize = 1 + d.companions;
      if (used + partySize > slot.rows[0].capacity) throw new Error('SLOT_FULL');

      const registrationCode = makeCode();
      const insert = await client.query<{ id:string; qr_token:string }>(`
        INSERT INTO registrations (
          registration_code, first_name, last_name, phone, email, event_type,
          planned_event_date, guest_count, companions, slot_id, source, notes,
          privacy_consent, marketing_consent, utm_source, utm_medium, utm_campaign
        ) VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id, qr_token::text
      `, [
        registrationCode, d.firstName, d.lastName, d.phone, d.email.toLowerCase(), d.eventType,
        d.plannedEventDate || '', d.guestCount ?? null, d.companions, d.slotId, d.source ?? null, d.notes ?? null,
        d.privacyConsent, d.marketingConsent, d.utmSource ?? null, d.utmMedium ?? null, d.utmCampaign ?? null
      ]);

      const registrationId = insert.rows[0].id;
      await client.query(
        `INSERT INTO registration_events (registration_id, event_type, metadata) VALUES ($1,'registered',$2::jsonb)`,
        [registrationId, JSON.stringify({ partySize })]
      );

      await client.query(`
        INSERT INTO communications (registration_id, channel, message_type, status, scheduled_for)
        SELECT $1, q.channel, q.message_type, 'queued', q.scheduled_for
        FROM open_day_slots s
        CROSS JOIN LATERAL (
          VALUES
            ('email','registration_confirmation',now()),
            ('whatsapp','registration_confirmation',now()),
            ('email','reminder_24h',((s.event_date + s.start_time) AT TIME ZONE 'Europe/Rome') - interval '24 hours'),
            ('whatsapp','reminder_24h',((s.event_date + s.start_time) AT TIME ZONE 'Europe/Rome') - interval '24 hours')
        ) AS q(channel,message_type,scheduled_for)
        WHERE s.id=$2
      `,[registrationId,d.slotId]);

      return {
        registrationId,
        registrationCode,
        qrToken: insert.rows[0].qr_token,
        guest: {
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          email: d.email.toLowerCase(),
          registrationCode,
          qrToken: insert.rows[0].qr_token,
          eventDate: slot.rows[0].event_date,
          startTime: slot.rows[0].start_time,
        } satisfies Guest,
      };
    });

    try {
      const emailResult = await sendEmail('registration_confirmation', result.guest);
      if (emailResult.sent) {
        await query(
          `UPDATE communications
           SET status='sent', provider_message_id=$1, sent_at=now(), attempts=attempts+1, last_error=NULL
           WHERE registration_id=$2 AND channel='email' AND message_type='registration_confirmation' AND status='queued'`,
          [emailResult.providerId || null, result.registrationId],
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1500) : 'Unknown error';
      console.error('Immediate confirmation email failed', message);
      await query(
        `UPDATE communications
         SET attempts=attempts+1, last_error=$1
         WHERE registration_id=$2 AND channel='email' AND message_type='registration_confirmation' AND status='queued'`,
        [message, result.registrationId],
      );
    }

    return NextResponse.json({ registrationCode: result.registrationCode, qrToken: result.qrToken }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'SLOT_FULL') {
      return NextResponse.json({ error: 'Questa fascia si è appena completata. Scegli un altro orario.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'SLOT_NOT_FOUND') {
      return NextResponse.json({ error: 'La fascia selezionata non è più disponibile.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'DUPLICATE') {
      return NextResponse.json({ error: 'Risulta già una registrazione attiva con questa email o questo numero di telefono.' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova tra poco.' }, { status: 500 });
  }
}

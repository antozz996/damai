import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { transaction } from '@/lib/db';
import { registrationSchema } from '@/lib/validation';

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
      const slot = await client.query<{ id:string; capacity:number }>(
        `SELECT id, capacity FROM open_day_slots WHERE id=$1 AND is_active=true FOR UPDATE`,
        [d.slotId]
      );
      if (!slot.rowCount) throw new Error('SLOT_NOT_FOUND');

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

      await client.query(
        `INSERT INTO registration_events (registration_id, event_type, metadata) VALUES ($1,'registered',$2::jsonb)`,
        [insert.rows[0].id, JSON.stringify({ partySize })]
      );

      await client.query(`INSERT INTO communications (registration_id, channel, message_type, status) VALUES ($1,'email','registration_confirmation','queued')`, [insert.rows[0].id]);
      return { registrationCode, qrToken: insert.rows[0].qr_token };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'SLOT_FULL') {
      return NextResponse.json({ error: 'Questa fascia si è appena completata. Scegli un altro orario.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'SLOT_NOT_FOUND') {
      return NextResponse.json({ error: 'La fascia selezionata non è più disponibile.' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova tra poco.' }, { status: 500 });
  }
}

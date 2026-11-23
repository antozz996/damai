import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CommunicationType, Guest, sendEmail, sendWhatsApp } from '@/lib/notifications';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Il cron è giornaliero: ogni esecuzione smaltisce più lotti finché resta tempo.
const BATCH_SIZE = 30;
const TIME_BUDGET_MS = 45_000;
// Pausa tra un invio e l'altro per restare sotto i limiti del provider email.
const SEND_PAUSE_MS = 550;

type QueueRow = {
  id:number; channel:'email'|'whatsapp'; message_type:CommunicationType; attempts:number;
  first_name:string; last_name:string; phone:string; email:string; registration_code:string;
  qr_token:string; event_date:string; start_time:string; slot_started:boolean;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Solo i canali configurati: le righe di un canale spento restano in coda
  // senza occupare il lotto e senza bloccare le email.
  const channels: string[] = [];
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) channels.push('email');
  if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) channels.push('whatsapp');

  const startedAt = Date.now();
  const summary = { processed:0, sent:0, deferred:0, skipped:0, failed:0 };
  // Righe già lavorate in questa esecuzione: non vanno riprese nel lotto successivo.
  const seen: number[] = [];

  while (channels.length && Date.now() - startedAt < TIME_BUDGET_MS) {
  const due = await query<QueueRow>(`
    SELECT c.id, c.channel, c.message_type, c.attempts,
      r.first_name, r.last_name, r.phone, r.email, r.registration_code, r.qr_token::text,
      s.event_date::text, s.start_time::text,
      (((s.event_date + s.start_time) AT TIME ZONE 'Europe/Rome') <= now()) AS slot_started
    FROM communications c
    JOIN registrations r ON r.id=c.registration_id
    JOIN open_day_slots s ON s.id=r.slot_id
    WHERE c.status='queued'
      AND (c.scheduled_for IS NULL OR c.scheduled_for <= now())
      AND r.status <> 'cancelled'
      AND r.edition = $1
      AND c.channel = ANY($2::text[])
      AND NOT (c.id = ANY($3::bigint[]))
    ORDER BY COALESCE(c.scheduled_for,c.created_at), c.id
    LIMIT ${BATCH_SIZE}
  `, [EVENT.edition, channels, seen]);
  if (!due.rowCount) break;

  for (const row of due.rows) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
    seen.push(row.id);
    summary.processed++;
    // Un promemoria non ha più senso se la fascia di arrivo è già iniziata.
    if ((row.message_type === 'reminder_24h' || row.message_type === 'reminder_48h') && row.slot_started) {
      await query(`UPDATE communications SET status='skipped', last_error='Promemoria scaduto: fascia già iniziata' WHERE id=$1`, [row.id]);
      summary.skipped++;
      continue;
    }
    const guest: Guest = {
      firstName:row.first_name,lastName:row.last_name,phone:row.phone,email:row.email,
      registrationCode:row.registration_code,qrToken:row.qr_token,eventDate:row.event_date,startTime:row.start_time,
    };
    try {
      const result = row.channel === 'email'
        ? await sendEmail(row.message_type, guest)
        : await sendWhatsApp(row.message_type, guest);
      if (!result.sent) {
        summary.deferred++;
        continue;
      }
      await query(`UPDATE communications SET status='sent', provider_message_id=$1, sent_at=now(), attempts=attempts+1, last_error=NULL WHERE id=$2`, [result.providerId || null,row.id]);
      summary.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0,1500) : 'Unknown error';
      await query(`UPDATE communications SET attempts=attempts+1, last_error=$1, status=CASE WHEN attempts+1 >= 3 THEN 'failed' ELSE 'queued' END WHERE id=$2`, [message,row.id]);
      summary.failed++;
    }
    await new Promise(resolve => setTimeout(resolve, SEND_PAUSE_MS));
  }
  }

  return NextResponse.json(summary);
}

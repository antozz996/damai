import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CommunicationType, Guest, sendEmail, sendWhatsApp } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

type QueueRow = {
  id:number; channel:'email'|'whatsapp'; message_type:CommunicationType; attempts:number;
  first_name:string; last_name:string; phone:string; email:string; registration_code:string;
  qr_token:string; event_date:string; start_time:string;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const due = await query<QueueRow>(`
    SELECT c.id, c.channel, c.message_type, c.attempts,
      r.first_name, r.last_name, r.phone, r.email, r.registration_code, r.qr_token::text,
      s.event_date::text, s.start_time::text
    FROM communications c
    JOIN registrations r ON r.id=c.registration_id
    JOIN open_day_slots s ON s.id=r.slot_id
    WHERE c.status='queued'
      AND (c.scheduled_for IS NULL OR c.scheduled_for <= now())
      AND r.status <> 'cancelled'
    ORDER BY COALESCE(c.scheduled_for,c.created_at), c.id
    LIMIT 30
  `);

  const summary = { processed:0, sent:0, deferred:0, failed:0 };
  for (const row of due.rows) {
    summary.processed++;
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
  }

  return NextResponse.json(summary);
}

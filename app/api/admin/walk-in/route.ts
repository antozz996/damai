import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query, transaction } from '@/lib/db';
import { walkInSchema, createWalkIn } from '@/lib/walk-in';
import { sendEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const staffWalkInSchema = walkInSchema.extend({
  immediateCheckin: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = staffWalkInSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Controlla i dati inseriti e riprova.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const d = parsed.data;

    const result = await transaction(async (client) => {
      const res = await createWalkIn(client, d, 'staff');

      if (d.immediateCheckin) {
        await client.query(
          `UPDATE registrations
           SET status = 'checked_in', checked_in_at = now(), updated_at = now()
           WHERE id = $1`,
          [res.registrationId]
        );

        await client.query(
          `INSERT INTO registration_events (registration_id, event_type, metadata)
           VALUES ($1, 'checked_in', '{"by":"desk_staff_walkin"}'::jsonb)`,
          [res.registrationId]
        );
      }

      return res;
    });

    // Se l'ospite ha fornito email, invia la conferma
    if (result.hasRealEmail) {
      try {
        const emailResult = await sendEmail('registration_confirmation', result.guest);
        if (emailResult.sent) {
          await query(
            `UPDATE communications
             SET status='sent', provider_message_id=$1, sent_at=now(), attempts=attempts+1, last_error=NULL
             WHERE registration_id=$2 AND channel='email' AND message_type='registration_confirmation' AND status='queued'`,
            [emailResult.providerId || null, result.registrationId]
          );
        }
      } catch (err) {
        console.error('Staff walk-in confirmation email failed:', err);
      }
    }

    return NextResponse.json(
      {
        registrationCode: result.registrationCode,
        qrToken: result.qrToken,
        immediateCheckin: d.immediateCheckin,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_ACTIVE_SLOT') {
        return NextResponse.json(
          { error: 'Nessuna fascia oraria attiva trovata per l’Open Day.' },
          { status: 404 }
        );
      }
      if (error.message === 'DUPLICATE') {
        return NextResponse.json(
          { error: 'Risulta già una registrazione attiva con questo numero di telefono.' },
          { status: 409 }
        );
      }
      if (error.message === 'SLOT_FULL') {
        return NextResponse.json(
          { error: 'La capienza massima della fascia attuale è stata raggiunta.' },
          { status: 409 }
        );
      }
    }
    console.error('Staff Walk-in API error:', error);
    return NextResponse.json(
      { error: 'Si è verificato un errore durante la registrazione staff.' },
      { status: 500 }
    );
  }
}

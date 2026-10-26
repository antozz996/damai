import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { walkInSchema, createWalkIn } from '@/lib/walk-in';
import { sendEmail } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = walkInSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Controlla i dati inseriti e riprova.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      return createWalkIn(client, parsed.data, 'self');
    });

    // Se l'ospite ha inserito una email reale, invia la conferma immediata in modo asincrono
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
      } catch (emailErr) {
        const message = emailErr instanceof Error ? emailErr.message.slice(0, 1500) : 'Unknown error';
        console.error('Walk-in confirmation email failed:', message);
        await query(
          `UPDATE communications
           SET attempts=attempts+1, last_error=$1
           WHERE registration_id=$2 AND channel='email' AND message_type='registration_confirmation' AND status='queued'`,
          [message, result.registrationId]
        );
      }
    }

    return NextResponse.json(
      {
        registrationCode: result.registrationCode,
        qrToken: result.qrToken,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NO_ACTIVE_SLOT') {
        return NextResponse.json(
          { error: 'Le registrazioni walk-in sono disponibili durante gli orari dell’Open Day.' },
          { status: 404 }
        );
      }
      if (error.message === 'DUPLICATE') {
        return NextResponse.json(
          { error: 'Sembra che tu abbia già una registrazione attiva. Mostra il tuo QR allo staff o comunica il tuo nome all’accoglienza.' },
          { status: 409 }
        );
      }
      if (error.message === 'SLOT_FULL') {
        return NextResponse.json(
          { error: 'Non riusciamo ad accoglierti in questo momento per ragioni di capienza. Rivolgiti direttamente allo staff all’ingresso.' },
          { status: 409 }
        );
      }
    }
    console.error('Walk-in API error:', error);
    return NextResponse.json(
      { error: 'Si è verificato un errore durante la registrazione. Riprova tra poco o rivolgiti allo staff.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transaction } from '@/lib/db';
import { sendEmail, type Guest } from '@/lib/notifications';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type RegistrationForEmail = {
  status: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  registration_code: string;
  qr_token: string;
  event_date: string;
  start_time: string;
};

type RequestedResend = { communicationId: string; guest: Guest };

export async function POST(req: NextRequest, { params }: RouteContext) {
  // This action is behind the existing /api/admin/* Basic Auth proxy.
  // Also reject cross-origin posts: Basic Auth credentials may be cached in browsers.
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origine della richiesta non valida.' }, { status: 403 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID prenotazione non valido.' }, { status: 400 });
  }

  let request: RequestedResend;
  try {
    request = await transaction(async (client) => {
      const result = await client.query<RegistrationForEmail>(`
        SELECT r.status, r.first_name, r.last_name, r.phone, r.email,
          r.registration_code, r.qr_token::text, s.event_date::text, s.start_time::text
        FROM registrations r
        JOIN open_day_slots s ON s.id=r.slot_id
        WHERE r.id=$1
        FOR UPDATE OF r
      `, [id]);

      const registration = result.rows[0];
      if (!registration) throw new Error('NOT_FOUND');
      if (registration.status === 'cancelled') throw new Error('CANCELLED');
      const email = z.string().trim().email().max(160).safeParse(registration.email);
      if (!email.success) throw new Error('INVALID_EMAIL');

      // The row lock serializes clicks on the same registration. Limit accidental
      // duplicate sends even across multiple staff tabs/devices.
      const recent = await client.query(`
        SELECT 1 FROM communications
        WHERE registration_id=$1
          AND channel='email'
          AND message_type='registration_confirmation_resend'
          AND created_at > now() - interval '30 seconds'
        LIMIT 1
      `, [id]);
      if (recent.rowCount) throw new Error('TOO_SOON');

      // This is a manual dispatch, not a cron queue item. 'skipped' keeps the
      // background worker from automatically sending a duplicate on retries.
      const communication = await client.query<{ id: string }>(`
        INSERT INTO communications
          (registration_id, channel, message_type, status, scheduled_for, attempts, last_error)
        VALUES ($1,'email','registration_confirmation_resend','skipped',now(),1,'Invio manuale in corso')
        RETURNING id::text
      `, [id]);
      const communicationId = communication.rows[0].id;

      await client.query(`
        INSERT INTO registration_events (registration_id, event_type, metadata)
        VALUES ($1,'confirmation_resend_requested',$2::jsonb)
      `, [id, JSON.stringify({ source: 'admin', channel: 'email', email: email.data, communicationId })]);

      return {
        communicationId,
        guest: {
          firstName: registration.first_name,
          lastName: registration.last_name,
          phone: registration.phone,
          email: email.data,
          registrationCode: registration.registration_code,
          qrToken: registration.qr_token,
          eventDate: registration.event_date,
          startTime: registration.start_time,
        },
      };
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
      if (error.message === 'CANCELLED') return NextResponse.json({ error: 'La prenotazione è annullata: non è possibile inviare una conferma.' }, { status: 409 });
      if (error.message === 'INVALID_EMAIL') return NextResponse.json({ error: 'Correggi e salva un indirizzo email valido prima del reinvio.' }, { status: 400 });
      if (error.message === 'TOO_SOON') return NextResponse.json({ error: 'È già stato richiesto un reinvio: riprova tra 30 secondi.' }, { status: 429 });
    }
    console.error('Cannot prepare admin confirmation resend', error);
    return NextResponse.json({ error: 'Impossibile preparare il reinvio. Riprova.' }, { status: 500 });
  }

  try {
    // Keep the original confirmation template and QR, but use a unique key
    // rather than the key from the first (possibly misaddressed) email.
    const result = await sendEmail('registration_confirmation', request.guest, {
      idempotencyKey: `damai-confirmation-resend-${request.communicationId}`,
    });
    if (!result.sent) throw new Error('EMAIL_NOT_CONFIGURED');

    try {
      await transaction(async (client) => {
        await client.query(`
          UPDATE communications
          SET status='sent', provider_message_id=$1, sent_at=now(), last_error=NULL
          WHERE id=$2
        `, [result.providerId || null, request.communicationId]);

        // If the original confirmation is still queued after an invalid email,
        // stop the cron from resending it after the manual resend succeeded.
        await client.query(`
          UPDATE communications
          SET status='skipped', last_error='Sostituita da reinvio manuale'
          WHERE registration_id=$1 AND channel='email'
            AND message_type='registration_confirmation' AND status='queued'
        `, [id]);

        await client.query(`
          INSERT INTO registration_events (registration_id, event_type, metadata)
          VALUES ($1,'confirmation_resend_sent',$2::jsonb)
        `, [id, JSON.stringify({
          source: 'admin',
          email: request.guest.email,
          communicationId: request.communicationId,
          providerId: result.providerId || null,
        })]);
      });
    } catch (dbError) {
      // Resend already accepted the email: do not tell the admin to blindly retry.
      console.error('Confirmation resend accepted, but audit update failed', dbError);
      return NextResponse.json({
        ok: true,
        message: `Resend ha accettato la conferma per ${request.guest.email}, ma il registro non è stato aggiornato. Verifica su Resend prima di ripetere.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Conferma accettata per l’invio a ${request.guest.email}. Il QR e la prenotazione sono invariati.`,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message.slice(0, 1500) : 'Errore sconosciuto';
    console.error('Manual confirmation resend failed', details);
    try {
      await transaction(async (client) => {
        await client.query(`
          UPDATE communications
          SET status='failed', last_error=$1
          WHERE id=$2
        `, [details, request.communicationId]);
        await client.query(`
          INSERT INTO registration_events (registration_id, event_type, metadata)
          VALUES ($1,'confirmation_resend_failed',$2::jsonb)
        `, [id, JSON.stringify({
          source: 'admin', email: request.guest.email,
          communicationId: request.communicationId,
          reason: details,
        })]);
      });
    } catch (auditError) {
      console.error('Unable to log failed confirmation resend', auditError);
    }
    const unconfigured = details === 'EMAIL_NOT_CONFIGURED';
    return NextResponse.json({
      error: unconfigured
        ? 'Servizio email non configurato. Controlla Resend e le variabili di Vercel.'
        : 'La mail non è stata accettata dal servizio di invio. Controlla Resend e riprova.',
    }, { status: unconfigured ? 503 : 502 });
  }
}

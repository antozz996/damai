import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { query, transaction } from '@/lib/db';
import { registrationSchema } from '@/lib/validation';
import { Guest, sendEmail } from '@/lib/notifications';
import { EVENT, ticketUrl } from '@/lib/event';
import { PUBLIC_CORS_ROUTES, corsHeaders, preflightResponse } from '@/lib/cors';
import { trackMetaEvent } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';

const METHODS = PUBLIC_CORS_ROUTES['/api/register'];

// Rate limit in memoria, best-effort: vale per singola istanza serverless,
// quindi frena gli abusi più banali ma non sostituisce un limite distribuito.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 8;
const globalForRate = globalThis as unknown as { damaiRegisterHits?: Map<string, number[]> };
const hitsByIp = (globalForRate.damaiRegisterHits ??= new Map<string, number[]>());

function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (hitsByIp.get(ip) || []).filter(time => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    hitsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  if (hitsByIp.size > 5000) {
    for (const [key, times] of hitsByIp) {
      if (!times.some(time => now - time < RATE_WINDOW_MS)) hitsByIp.delete(key);
    }
  }
  return false;
}

function makeCode() {
  return `${EVENT.codePrefix}${randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Identificativo dell'evento di registrazione: lo stesso va passato al pixel del browser (deduplica). */
function makeEventId(registrationCode: string) {
  return `reg-${registrationCode}`;
}

function json(req: NextRequest, body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(req.headers.get('origin'), METHODS), ...extraHeaders },
  });
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(req.headers.get('origin'), METHODS);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return json(req, { error: 'Troppe richieste in poco tempo. Attendi qualche minuto e riprova.' }, 429, { 'Retry-After': '600' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Controlla i dati inseriti e riprova.' }, 400);
  }

  // Honeypot: il campo `website` è invisibile agli ospiti. Se è valorizzato è un bot:
  // rispondiamo con un finto successo senza salvare né inviare nulla.
  const honeypot = body && typeof body === 'object' ? (body as Record<string, unknown>).website : undefined;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    const qrToken = randomUUID();
    const fakeCode = makeCode();
    return json(req, { registrationCode: fakeCode, qrToken, ticketUrl: ticketUrl(qrToken), eventId: makeEventId(fakeCode) }, 201);
  }

  try {
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const custom = parsed.error.issues.find(issue => issue.code === 'custom')?.message;
      return json(req, { error: custom || 'Controlla i dati inseriti e riprova.' }, 400);
    }

    const d = parsed.data;
    const adsConsent = d.adsConsent ?? d.marketingConsent;
    const result = await transaction(async client => {
      // Lock della fascia: serializza le registrazioni concorrenti sullo stesso orario.
      const slot = await client.query<{ id:string; capacity:number; event_date:string; start_time:string }>(
        `SELECT id, capacity, event_date::text, start_time::text
         FROM open_day_slots WHERE id=$1 AND edition=$2 AND is_active=true FOR UPDATE`,
        [d.slotId, EVENT.edition]
      );
      if (!slot.rowCount) throw new Error('SLOT_NOT_FOUND');

      // Anti-duplicato limitato all'edizione corrente: chi era agli Open Days può registrarsi.
      const duplicate = await client.query(`
        SELECT 1 FROM registrations
        WHERE edition=$3 AND status <> 'cancelled' AND (lower(email)=lower($1) OR phone=$2)
        LIMIT 1
      `,[d.email,d.phone,EVENT.edition]);
      if (duplicate.rowCount) throw new Error('DUPLICATE');

      const usage = await client.query<{ used:string }>(
        `SELECT COALESCE(SUM(1 + companions),0)::text AS used FROM registrations WHERE slot_id=$1 AND status IN ('registered','checked_in')`,
        [d.slotId]
      );
      const used = Number(usage.rows[0]?.used ?? 0);
      // I bambini sono già compresi negli accompagnatori.
      const partySize = 1 + d.companions;
      if (used + partySize > slot.rows[0].capacity) throw new Error('SLOT_FULL');

      const registrationCode = makeCode();
      const insert = await client.query<{ id:string; qr_token:string }>(`
        INSERT INTO registrations (
          registration_code, first_name, last_name, phone, email, event_type,
          planned_event_date, guest_count, companions, slot_id, source, notes,
          privacy_consent, marketing_consent, utm_source, utm_medium, utm_campaign,
          edition, children, existing_booking_venue, existing_booking_date
        ) VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NULLIF($21,'')::date)
        RETURNING id, qr_token::text
      `, [
        registrationCode, d.firstName, d.lastName, d.phone, d.email.toLowerCase(), d.eventType,
        d.plannedEventDate || '', d.guestCount ?? null, d.companions, d.slotId, d.source ?? null, d.notes ?? null,
        d.privacyConsent, d.marketingConsent, d.utmSource ?? null, d.utmMedium ?? null, d.utmCampaign ?? null,
        EVENT.edition, d.children,
        // La data ha senso solo insieme alla struttura.
        d.existingBookingVenue ?? null, d.existingBookingVenue ? (d.existingBookingDate || '') : '',
      ]);

      const registrationId = insert.rows[0].id;
      await client.query(
        `INSERT INTO registration_events (registration_id, event_type, metadata) VALUES ($1,'registered',$2::jsonb)`,
        [registrationId, JSON.stringify({
          partySize, children: d.children, existingBookingVenue: d.existingBookingVenue ?? null,
          // Prova dei due consensi facoltativi (comunicazioni / annunci Meta), separati dal 27/11/2026.
          consents: { marketing: d.marketingConsent, ads: adsConsent, separated: d.adsConsent !== undefined },
        })]
      );

      // Conferma immediata + promemoria 24 ore prima (solo se quel momento non è già passato).
      // Il ringraziamento viene accodato al check-in (vedi lib/communications.ts).
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
          AND (q.message_type <> 'reminder_24h' OR q.scheduled_for > now())
      `,[registrationId,d.slotId]);

      return {
        registrationId,
        registrationCode,
        qrToken: insert.rows[0].qr_token,
        partySize,
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
      ).catch(queueError => console.error('Unable to record the email failure', queueError));
    }

    const eventId = makeEventId(result.registrationCode);

    // Meta Conversions API: solo con il consenso agli annunci personalizzati (e solo se il token è configurato).
    // Parte dopo la risposta e non può farla fallire. Senza consenso non viene inviato nulla.
    if (adsConsent) {
      trackMetaEvent(result.registrationId, {
        eventName: 'CompleteRegistration',
        eventId,
        actionSource: 'website',
        eventSourceUrl: d.eventSourceUrl || EVENT.publicPageUrl,
        user: { email: result.guest.email, phone: d.phone, firstName: d.firstName, lastName: d.lastName },
        clientIp: clientIp(req),
        userAgent: req.headers.get('user-agent') || undefined,
        fbp: d.fbp,
        fbc: d.fbc,
        customData: {
          content_name: 'christmas_village_2026',
          event_day: result.guest.eventDate,
          slot: result.guest.startTime.slice(0, 5),
          party_size: result.partySize,
          // "Caldo" = ha indicato un evento da organizzare (tipologia, data o numero di ospiti).
          lead_hot: d.eventType !== EVENT.defaultEventType || Boolean(d.plannedEventDate) || d.guestCount !== undefined,
        },
      });
    }

    return json(req, {
      registrationCode: result.registrationCode,
      qrToken: result.qrToken,
      ticketUrl: ticketUrl(result.qrToken),
      eventId,
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'SLOT_FULL') {
      return json(req, { error: 'Questa fascia si è appena completata. Scegli un altro orario.' }, 409);
    }
    if (error instanceof Error && error.message === 'SLOT_NOT_FOUND') {
      return json(req, { error: 'La fascia selezionata non è più disponibile.' }, 404);
    }
    if (error instanceof Error && error.message === 'DUPLICATE') {
      return json(req, { error: 'Risulta già una registrazione al Christmas Village con questa email o questo numero di telefono.' }, 409);
    }
    console.error(error);
    return json(req, { error: 'Si è verificato un errore. Riprova tra poco.' }, 500);
  }
}

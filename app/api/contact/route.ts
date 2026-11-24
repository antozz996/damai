import { NextRequest, NextResponse, after } from 'next/server';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { PUBLIC_CORS_ROUTES, corsHeaders, preflightResponse } from '@/lib/cors';
import { contactSchema, sendContactEmail } from '@/lib/contact';
import { metaCapiEnabled, sendMetaEvent } from '@/lib/meta-capi';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

const METHODS = PUBLIC_CORS_ROUTES['/api/contact'];

// Rate limit in memoria, best-effort (per istanza serverless), come per /api/register.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 5;
const globalForRate = globalThis as unknown as { damaiContactHits?: Map<string, number[]> };
const hitsByIp = (globalForRate.damaiContactHits ??= new Map<string, number[]>());

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

function json(req: NextRequest, body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(req.headers.get('origin'), METHODS), ...extraHeaders },
  });
}

/** Messaggio di errore senza dati personali: solo tipo e codice. */
function safeError(error: unknown) {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return `${error.name}${code ? ` ${code}` : ''}: ${error.message.slice(0, 80).replace(/[\r\n]+/g, ' ')}`;
  }
  return 'unknown';
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(req.headers.get('origin'), METHODS);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return json(req, { ok: false, error: 'rate_limited' }, 429, { 'Retry-After': '600' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: 'validation', fields: [] }, 400);
  }

  // Honeypot: se `website` e' valorizzato e' un bot, finto successo senza salvare ne' inviare.
  const honeypot = body && typeof body === 'object' ? (body as Record<string, unknown>).website : undefined;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return json(req, { ok: true }, 200);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? '')).filter(Boolean))];
    return json(req, { ok: false, error: 'validation', fields }, 400);
  }

  const d = parsed.data;
  const id = randomUUID();
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 300) || null;

  // 1. Salvataggio su DB.
  let dbOk = false;
  try {
    await query(
      `INSERT INTO contact_requests
        (id, name, phone, email, event_type, event_date, guests, details, locale, page, ref, source, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id, d.name, d.phone, d.email ? d.email.toLowerCase() : null, d.eventType, d.eventDate ?? null,
        d.guests ?? null, d.details ?? null, d.locale, d.page ?? null, d.ref ?? null, d.source ?? null, userAgent,
      ],
    );
    dbOk = true;
  } catch (error) {
    console.error('Contact request: DB insert failed', safeError(error));
  }

  // 2. Email al team (anche se il DB e' fallito).
  let emailOk = false;
  try {
    emailOk = await sendContactEmail(d, id);
    if (!emailOk) console.error('Contact request: email not configured');
  } catch (error) {
    console.error('Contact request: email failed', safeError(error));
  }

  // 3. Segna l'invio.
  if (dbOk && emailOk) {
    await query('UPDATE contact_requests SET email_sent_at=now() WHERE id=$1', [id])
      .catch(error => console.error('Contact request: email_sent_at update failed', safeError(error)));
  }

  if (!dbOk && !emailOk) {
    return json(req, { ok: false, error: 'server' }, 500);
  }

  // Meta CAPI: solo con consenso marketing e event id (deduplica col Pixel). Non blocca la risposta.
  if (d.consentMarketing === true && d.metaEventId && metaCapiEnabled()) {
    const [firstName, ...rest] = d.name.split(/\s+/);
    const event = {
      eventName: 'Lead',
      eventId: d.metaEventId,
      actionSource: 'website' as const,
      eventSourceUrl: d.page && /^https?:\/\//i.test(d.page) ? d.page : EVENT.publicPageUrl,
      user: { email: d.email, phone: d.phone, firstName, lastName: rest.join(' ') || undefined },
      clientIp: clientIp(req),
      userAgent: req.headers.get('user-agent') || undefined,
      fbp: d.fbp,
      fbc: d.fbc,
      customData: { content_name: 'contact_form', event_type: d.eventType },
    };
    const task = async () => {
      const result = await sendMetaEvent(event);
      if (!result.ok) console.error('Contact request: Meta CAPI failed', result.status, result.error);
    };
    try {
      after(task);
    } catch {
      void task();
    }
  }

  return json(req, { ok: true }, 201);
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { PUBLIC_CORS_ROUTES, corsHeaders, preflightResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const METHODS = PUBLIC_CORS_ROUTES['/api/consent-log'];

/**
 * Registro delle scelte del banner cookie di damaigarden.it (audit LP-03).
 * Nessun IP e nessun dato personale: id casuale del browser, versione del banner, scelte.
 * Risponde sempre in fretta e non blocca mai il sito.
 */
const consentSchema = z.object({
  consentId: z.string().uuid(),
  version: z.number().int().min(1).max(1000),
  analytics: z.boolean(),
  marketing: z.boolean(),
  page: z.string().trim().max(200).optional(),
  locale: z.enum(['it', 'en']).optional(),
});

// Rate limit in memoria, best-effort, come per /api/contact.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 20;
const globalForRate = globalThis as unknown as { damaiConsentHits?: Map<string, number[]> };
const hitsByIp = (globalForRate.damaiConsentHits ??= new Map<string, number[]>());

function isRateLimited(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const recent = (hitsByIp.get(ip) || []).filter(time => now - time < RATE_WINDOW_MS);
  recent.push(now);
  hitsByIp.set(ip, recent);
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return recent.length > RATE_MAX_REQUESTS;
}

function json(req: NextRequest, body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...corsHeaders(req.headers.get('origin'), METHODS) },
  });
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(req.headers.get('origin'), METHODS);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) return json(req, { ok: false, error: 'rate_limited' }, 429);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: 'validation' }, 400);
  }
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) return json(req, { ok: false, error: 'validation' }, 400);
  const d = parsed.data;
  try {
    await query(
      `INSERT INTO consent_log (consent_id, version, analytics, marketing, page, locale) VALUES ($1,$2,$3,$4,$5,$6)`,
      [d.consentId, d.version, d.analytics, d.marketing, d.page ?? null, d.locale ?? null],
    );
  } catch (error) {
    console.error('Consent log: insert failed', error instanceof Error ? error.name : 'unknown');
    return json(req, { ok: false, error: 'server' }, 500);
  }
  return json(req, { ok: true }, 200);
}

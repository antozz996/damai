import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { renderEmailPreview, sendEmail, type CommunicationType, type Guest } from '@/lib/notifications';

const allowed = new Set<CommunicationType>(['registration_confirmation', 'reminder_24h', 'thank_you', 'exit_thank_you']);

function sampleGuest(body: Record<string, unknown>, email: string, uniqueCode: boolean): Guest {
  const requestedCode = String(body.registrationCode || 'N26-TESTMAIL').replace(/[^A-Za-z0-9-]/g, '').slice(0, 30) || 'N26-TESTMAIL';
  return {
    firstName: String(body.firstName || 'Ospite'),
    lastName: String(body.lastName || 'Test'),
    phone: String(body.phone || '+39 000 000 0000'),
    email,
    registrationCode: uniqueCode ? `${requestedCode}-${Date.now()}` : requestedCode,
    qrToken: randomUUID(),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate || '')) ? String(body.eventDate) : '2026-12-12',
    startTime: /^\d{2}:\d{2}/.test(String(body.startTime || '')) ? String(body.startTime) : '17:30',
  };
}

/** Anteprima HTML del template, senza inviare nulla: /api/admin/test-email?type=registration_confirmation */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const type = String(params.type || 'registration_confirmation') as CommunicationType;
  if (!allowed.has(type)) return new NextResponse('Template non valido', { status: 400 });
  const { html } = await renderEmailPreview(type, sampleGuest(params, 'anteprima@example.com', false));
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type || '') as CommunicationType;
    const email = String(body.email || '').trim().toLowerCase();
    if (!allowed.has(type) || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Inserisci un indirizzo email valido e un template.' }, { status: 400 });
    const result = await sendEmail(type, sampleGuest(body, email, true));
    if (!result.sent) return NextResponse.json({ error: 'Email non configurata: controlla RESEND_API_KEY ed EMAIL_FROM.' }, { status: 503 });
    return NextResponse.json({ ok: true, providerId: result.providerId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invio non riuscito.' }, { status: 500 }); }
}

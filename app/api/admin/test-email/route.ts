import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sendEmail, type CommunicationType, type Guest } from '@/lib/notifications';

const allowed = new Set<CommunicationType>(['registration_confirmation', 'reminder_24h', 'exit_thank_you']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type || '') as CommunicationType;
    const email = String(body.email || '').trim().toLowerCase();
    if (!allowed.has(type) || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Inserisci un indirizzo email valido e un template.' }, { status: 400 });
    const guest: Guest = { firstName: String(body.firstName || 'Ospite'), lastName: String(body.lastName || 'Test'), phone: String(body.phone || '+39 000 000 0000'), email, registrationCode: String(body.registrationCode || 'D26-TESTMAIL'), qrToken: randomUUID(), eventDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate || '')) ? String(body.eventDate) : '2026-10-30', startTime: /^\d{2}:\d{2}/.test(String(body.startTime || '')) ? String(body.startTime) : '16:00' };
    const result = await sendEmail(type, guest);
    if (!result.sent) return NextResponse.json({ error: 'Email non configurata: controlla RESEND_API_KEY ed EMAIL_FROM.' }, { status: 503 });
    return NextResponse.json({ ok: true, providerId: result.providerId });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invio non riuscito.' }, { status: 500 }); }
}

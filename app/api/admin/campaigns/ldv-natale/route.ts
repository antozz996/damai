import { NextRequest, NextResponse } from 'next/server';
import { LDV_CAMPAIGN, campaignEnabled, emailConfigured, sendCampaignBatch } from '@/lib/campaign';
import { renderLdvInvite, sendLdvInvite } from '@/lib/notifications';
import { isValidEmail, normalizeEmail, unsubscribeConfigured, unsubscribeUrl } from '@/lib/unsubscribe';
import { publicBaseUrl } from '@/lib/event';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Anteprima senza invio: HTML (default) oppure `?format=text` per la versione testo. */
export function GET(req: NextRequest) {
  const preview = renderLdvInvite({
    firstName: 'Giulia',
    attended: req.nextUrl.searchParams.get('attended') !== '0',
    unsubscribeUrl: `${publicBaseUrl()}/unsubscribe?t=anteprima`,
  });
  if (req.nextUrl.searchParams.get('format') === 'text') {
    return new NextResponse(`Oggetto: ${preview.subject}\n\n${preview.text}`, { headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new NextResponse(preview.html, { headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' } });
}

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Richiesta non valida.', 400);
  }
  if (!unsubscribeConfigured()) return fail('UNSUBSCRIBE_SECRET non configurato (almeno 16 caratteri): senza link di disiscrizione l’email non può partire.', 503);
  if (!emailConfigured()) return fail('Email non configurata: controlla RESEND_API_KEY ed EMAIL_FROM.', 503);

  // Email di prova a un indirizzo scelto: non tocca il registro degli invii.
  if (body.action === 'test') {
    const email = normalizeEmail(String(body.email || ''));
    if (!isValidEmail(email)) return fail('Inserisci un indirizzo email valido.', 400);
    try {
      const result = await sendLdvInvite(
        email,
        { firstName: 'Giulia', attended: true, unsubscribeUrl: unsubscribeUrl(email) },
        { idempotencyKey: `damai-${LDV_CAMPAIGN.key}-test-${Date.now()}`, subjectPrefix: '[PROVA] ' },
      );
      if (!result.sent) return fail('Email non configurata: controlla RESEND_API_KEY ed EMAIL_FROM.', 503);
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    } catch (error) {
      return fail(error instanceof Error ? error.message.slice(0, 300) : 'Invio non riuscito.', 502);
    }
  }

  // Invio reale, un lotto per richiesta: la pagina richiama finché `remaining` arriva a 0.
  if (body.action === 'send') {
    if (!campaignEnabled()) return fail('Invio disattivato: imposta LDV_CAMPAIGN_ENABLED=true per abilitarlo.', 403);
    if (body.confirm !== LDV_CAMPAIGN.confirmPhrase) return fail(`Per confermare digita ${LDV_CAMPAIGN.confirmPhrase}.`, 400);
    const result = await sendCampaignBatch({
      includeCancelled: body.includeCancelled === true,
      excludeRegistered: body.excludeRegistered === true,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  }

  return fail('Azione non valida.', 400);
}

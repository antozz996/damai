import { NextRequest, NextResponse } from 'next/server';
import { maskEmail, suppressEmail, verifyUnsubscribeToken } from '@/lib/unsubscribe';

export const dynamic = 'force-dynamic';

/**
 * Disiscrizione dalle comunicazioni promozionali: `/unsubscribe?t=<token firmato>`.
 * - GET: pagina con il pulsante di conferma. Non disiscrive da sola, perché i filtri
 *   antispam e le anteprime dei client di posta aprono i link in automatico.
 * - POST: registra l'opt-out. È lo stesso indirizzo usato dai client di posta per il
 *   one-click (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`, RFC 8058).
 * Sempre pubblica, anche a registrazioni chiuse (vedi proxy.ts).
 */

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function page(title: string, content: string, status: number) {
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} | Damai Event Garden</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1a0307;color:#fbf1dc;font-family:Georgia,"Times New Roman",Times,serif;text-align:center;padding:24px;box-sizing:border-box}
  main{width:100%;max-width:520px;background:#4b0610;border:1px solid #e6c27a;padding:40px 28px;box-sizing:border-box}
  .eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#e6c27a}
  h1{font-size:30px;line-height:1.2;font-weight:normal;margin:14px 0 18px}
  p{font-size:16px;line-height:1.6;color:#e9d9bd;margin:0 0 14px}
  strong{color:#fbf1dc;font-weight:normal}
  button{margin-top:10px;padding:16px 30px;border:0;background:#e6c27a;color:#1a0307;font-family:inherit;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  a{color:#e6c27a}
  .small{font-size:13px;margin-top:22px}
</style>
</head>
<body>
<main>
  <div class="eyebrow">Damai Event Garden</div>
  ${content}
  <p class="small"><a href="/privacy">Informativa privacy</a></p>
</main>
</body>
</html>`;
  return new NextResponse(html, { status, headers: HEADERS });
}

function invalid() {
  return page('Link non valido', `
  <h1>Link non valido</h1>
  <p>Questo link di disiscrizione non è valido o è incompleto. Apri di nuovo il link dall’email che hai ricevuto, oppure scrivici su WhatsApp al <a href="https://wa.me/393762115726">+39 376 211 5726</a> e ti rimuoviamo noi.</p>`, 400);
}

export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') || '';
  const email = verifyUnsubscribeToken(token);
  if (!email) return invalid();
  return page('Disiscrizione', `
  <h1>Vuoi smettere di ricevere le nostre comunicazioni?</h1>
  <p>Indirizzo: <strong>${escapeHtml(maskEmail(email))}</strong></p>
  <p>Confermando non riceverai più comunicazioni promozionali da Damai Event Garden. Le email di servizio legate a una tua registrazione (biglietto e promemoria) continueranno ad arrivare.</p>
  <form method="post" action="/unsubscribe?t=${encodeURIComponent(token)}">
    <button type="submit">Conferma la disiscrizione</button>
  </form>`, 200);
}

export async function POST(req: NextRequest) {
  const email = verifyUnsubscribeToken(req.nextUrl.searchParams.get('t') || '');
  if (!email) return invalid();
  try {
    await suppressEmail(email, 'unsubscribe_link');
  } catch (error) {
    console.error('Unsubscribe failed', error instanceof Error ? error.message : error);
    return page('Riprova tra poco', `
  <h1>Non siamo riusciti a registrare la richiesta</h1>
  <p>Riprova tra qualche minuto dallo stesso link, oppure scrivici su WhatsApp al <a href="https://wa.me/393762115726">+39 376 211 5726</a>.</p>`, 500);
  }
  return page('Disiscrizione confermata', `
  <h1>Disiscrizione confermata</h1>
  <p>Non riceverai più comunicazioni promozionali da Damai Event Garden all’indirizzo <strong>${escapeHtml(maskEmail(email))}</strong>.</p>`, 200);
}

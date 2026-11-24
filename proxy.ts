import { NextRequest, NextResponse } from 'next/server';
import { EVENT } from '@/lib/event';
import { PUBLIC_CORS_ROUTES, corsHeaders } from '@/lib/cors';

/**
 * Damai Christmas Village (12-13 dicembre 2026).
 *
 * - L'area staff (/admin, /api/admin) è SEMPRE protetta da Basic Auth.
 * - L'informativa privacy e la pagina di disiscrizione dalle email (/unsubscribe)
 *   sono sempre raggiungibili.
 * - Con REGISTRATIONS_OPEN diverso da 'true' tutte le altre rotte rispondono 410 Gone:
 *   nessun nuovo dato personale viene raccolto.
 * - Con REGISTRATIONS_OPEN=true sono pubbliche (senza autenticazione) solo le rotte
 *   elencate in isPublicPath(); tutto il resto resta dietro Basic Auth.
 * - Il preflight CORS (OPTIONS) delle API pubbliche riceve sempre risposta qui,
 *   così il form della pagina statica può leggere anche l'eventuale 410.
 */

const CLOSED_MESSAGE = `Le registrazioni al ${EVENT.name} non sono attive in questo momento.`;

const CLOSED_HTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Registrazioni chiuse | ${EVENT.name}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07100d;color:#f5f0e7;font-family:Georgia,"Times New Roman",serif;text-align:center;padding:24px}
  main{max-width:560px}
  p{font-family:system-ui,sans-serif;line-height:1.6;color:rgba(245,240,231,.78)}
  a{color:#d3ad6a}
</style>
</head>
<body>
<main>
  <h1>Le registrazioni al ${EVENT.name} sono chiuse</h1>
  <p>In questo momento non è possibile registrarsi e questa pagina non raccoglie dati.</p>
  <p>Per informazioni sull'evento visita <a href="${EVENT.publicPageUrl}">la pagina del Christmas Village</a> o scrivici su WhatsApp al <a href="https://wa.me/393762115726">+39 376 211 5726</a>.</p>
  <p><a href="/privacy">Informativa privacy</a></p>
</main>
</body>
</html>`;

const CLOSED_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/api/admin'
    || pathname.startsWith('/api/admin/');
}

/** Sempre raggiungibili, anche a registrazioni chiuse: informativa e disiscrizione dalle email. */
function isPrivacyPath(pathname: string): boolean {
  return pathname === '/privacy' || pathname === '/unsubscribe';
}

/** Rotte raggiungibili senza credenziali quando le registrazioni sono aperte. */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true; // pagina di registrazione di riserva
  if (pathname === '/api/slots' || pathname === '/api/register') return true;
  if (pathname.startsWith('/ticket/')) return true;
  // Il cron si autentica da solo con CRON_SECRET (Authorization: Bearer ...).
  if (pathname.startsWith('/api/cron/')) return true;
  // Registrazione walk-in self-service (QR all'ingresso): pubblica solo se richiesto.
  if (process.env.WALK_IN_PUBLIC === 'true') {
    return pathname === '/walk-in' || pathname.startsWith('/walk-in/') || pathname === '/api/walk-in';
  }
  return false;
}

function closedResponse(request: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    const methods = PUBLIC_CORS_ROUTES[pathname];
    return NextResponse.json(
      { error: CLOSED_MESSAGE },
      {
        status: 410,
        headers: {
          ...CLOSED_HEADERS,
          ...(methods ? corsHeaders(request.headers.get('origin'), methods) : {}),
        },
      },
    );
  }
  return new NextResponse(CLOSED_HTML, {
    status: 410,
    headers: { ...CLOSED_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function requireAdmin(request: NextRequest): NextResponse {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new NextResponse('Area amministrativa non configurata', { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const split = decoded.indexOf(':');
      const suppliedUser = decoded.slice(0, split);
      const suppliedPass = decoded.slice(split + 1);
      if (suppliedUser === user && suppliedPass === pass) return NextResponse.next();
    } catch {}
  }

  return new NextResponse('Accesso riservato al team DAMAI', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="DAMAI Staff"' },
  });
}

export function proxy(request: NextRequest) {
  const rawPath = request.nextUrl.pathname;
  const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : rawPath;

  // Preflight CORS delle API pubbliche: mai dietro Basic Auth, mai 410.
  const corsMethods = PUBLIC_CORS_ROUTES[pathname];
  if (request.method === 'OPTIONS' && corsMethods) {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('origin'), corsMethods),
    });
  }

  if (isAdminPath(pathname)) return requireAdmin(request);
  if (isPrivacyPath(pathname)) return NextResponse.next();
  // Form contatti del sito damaigarden.it: sempre pubblico, indipendente dall'evento.
  if (pathname === '/api/contact') return NextResponse.next();

  if (!EVENT.openRegistrations) return closedResponse(request, pathname);

  if (isPublicPath(pathname)) return NextResponse.next();

  return requireAdmin(request);
}

export const config = {
  // Tutto tranne gli asset statici di Next e i file pubblici con estensione.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|txt|xml|woff2?)$).*)'],
};

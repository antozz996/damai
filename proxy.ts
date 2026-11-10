import { NextRequest, NextResponse } from 'next/server';

/**
 * Open Days 2026 conclusi (30 ott – 1 nov 2026).
 * Tutte le rotte pubbliche (prenotazione, walk-in, biglietti, API pubbliche, cron)
 * rispondono 410 Gone: nessun nuovo dato personale viene raccolto.
 * Restano attivi solo l'area admin protetta (export e consultazione dei lead
 * già raccolti) e l'informativa privacy.
 * Per riaprire una futura edizione: impostare OPEN_DAYS_CLOSED a false.
 */
const OPEN_DAYS_CLOSED = true;

const CLOSED_HTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Open Days conclusi | DAMAI Event Garden</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07100d;color:#f5f0e7;font-family:Georgia,"Times New Roman",serif;text-align:center;padding:24px}
  main{max-width:560px}
  p{font-family:system-ui,sans-serif;line-height:1.6;color:rgba(245,240,231,.78)}
  a{color:#d3ad6a}
</style>
</head>
<body>
<main>
  <h1>Gli Open Days 2026 sono conclusi</h1>
  <p>Grazie a tutti per la partecipazione. Le prenotazioni sono chiuse e questa pagina non raccoglie più dati.</p>
  <p>Per informazioni sugli eventi visita <a href="https://www.damaigarden.it/">damaigarden.it</a> o scrivici su WhatsApp al <a href="https://wa.me/393762115726">+39 376 211 5726</a>.</p>
  <p><a href="/privacy">Informativa privacy</a></p>
</main>
</body>
</html>`;

const CLOSED_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
};

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin')
    || pathname.startsWith('/api/admin')
    || pathname.startsWith('/open-days/admin')
    || pathname.startsWith('/open-days/api/admin');
}

function isPrivacyPath(pathname: string): boolean {
  return pathname === '/privacy' || pathname === '/open-days/privacy';
}

function closedResponse(pathname: string): NextResponse {
  const api = pathname.startsWith('/api/') || pathname.startsWith('/open-days/api/');
  if (api) {
    return NextResponse.json(
      { error: 'Open Days 2026 conclusi: prenotazioni chiuse.' },
      { status: 410, headers: CLOSED_HEADERS },
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
  const pathname = request.nextUrl.pathname;

  if (OPEN_DAYS_CLOSED && !isAdminPath(pathname) && !isPrivacyPath(pathname)) {
    return closedResponse(pathname);
  }

  if ((pathname === '/open-days' || pathname.startsWith('/open-days/'))
    && !pathname.startsWith('/open-days/admin')
    && !pathname.startsWith('/open-days/api/admin')) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = pathname.slice('/open-days'.length) || '/';
    return NextResponse.rewrite(rewritten);
  }

  if (isPrivacyPath(pathname)) return NextResponse.next();

  return requireAdmin(request);
}

export const config = {
  // Tutto tranne gli asset statici di Next e i file pubblici con estensione.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|css|js|txt|xml|woff2?)$).*)'],
};

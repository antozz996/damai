const DEFAULT_ALLOWED_ORIGINS = 'https://www.damaigarden.it,https://damaigarden.it,http://localhost:3000,http://localhost:3111';

/** Rotte pubbliche chiamate cross-origin dalla pagina statica dell'evento. */
export const PUBLIC_CORS_ROUTES: Record<string, string> = {
  '/api/slots': 'GET, OPTIONS',
  '/api/register': 'POST, OPTIONS',
};

export function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Intestazioni CORS: l'origine viene riflessa solo se presente nella lista consentita.
 * `Vary: Origin` è sempre presente per non far condividere risposte tra origini diverse.
 */
export function corsHeaders(origin: string | null, methods: string): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = methods;
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

/** Risposta al preflight OPTIONS. */
export function preflightResponse(origin: string | null, methods: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin, methods) });
}

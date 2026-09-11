import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if ((pathname === '/open-days' || pathname.startsWith('/open-days/'))
    && !pathname.startsWith('/open-days/admin')
    && !pathname.startsWith('/open-days/api/admin')) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = pathname.slice('/open-days'.length) || '/';
    return NextResponse.rewrite(rewritten);
  }

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

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/open-days', '/open-days/:path*'],
};

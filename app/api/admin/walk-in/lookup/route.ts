import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q') || searchParams.get('phone') || '';
  const clean = q.trim();

  if (!clean || clean.length < 3) {
    return NextResponse.json({ error: 'Inserisci almeno 3 caratteri per la ricerca' }, { status: 400 });
  }

  const res = await query<{
    id: string;
    registration_code: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    status: string;
    qr_token: string;
  }>(
    `SELECT id::text, registration_code, first_name, last_name, phone, email, status, qr_token::text
     FROM registrations
     WHERE (
       phone ILIKE ('%' || $1 || '%')
       OR registration_code ILIKE ('%' || $1 || '%')
       OR (first_name || ' ' || last_name) ILIKE ('%' || $1 || '%')
     )
     ORDER BY created_at DESC
     LIMIT 5`,
    [clean]
  );

  return NextResponse.json({
    results: res.rows.map((r) => ({
      id: r.id,
      registrationCode: r.registration_code,
      name: `${r.first_name} ${r.last_name}`,
      phone: r.phone,
      email: r.email,
      status: r.status,
      token: r.qr_token,
    })),
  });
}

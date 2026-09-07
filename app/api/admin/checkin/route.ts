import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get('token') || '');
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse('Token non valido', { status: 400 });

  const found = await transaction(async client => {
    const result = await client.query<{id:string; status:string}>(`SELECT id::text, status FROM registrations WHERE qr_token=$1::uuid FOR UPDATE`, [token]);
    if (!result.rowCount) return false;
    const row = result.rows[0];
    if (row.status !== 'checked_in') {
      await client.query(`UPDATE registrations SET status='checked_in', checked_in_at=now(), updated_at=now() WHERE id=$1`, [row.id]);
      await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'checked_in','{}'::jsonb)`, [row.id]);
    }
    return true;
  });

  if (!found) return new NextResponse('Registrazione non trovata', { status: 404 });
  return NextResponse.redirect(new URL(`/admin/checkin/${token}?ok=1`, req.url), 303);
}

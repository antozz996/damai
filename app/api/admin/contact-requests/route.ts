import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** Aggiorna lo stato di una richiesta dal form del sito (area staff, protetta dal proxy). */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['new', 'contacted', 'closed'].includes(status)) {
    return new NextResponse('Dati non validi', { status: 400 });
  }
  await query('UPDATE contact_requests SET status=$1 WHERE id=$2', [status, id]);
  return NextResponse.redirect(new URL('/admin/richieste', req.url), 303);
}

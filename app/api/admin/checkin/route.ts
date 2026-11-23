import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { EVENT } from '@/lib/event';
import { ARCHIVE_READ_ONLY_MESSAGE, isArchivedRegistration } from '@/lib/edition-guard';
import { queueThankYou } from '@/lib/communications';

/**
 * Check-in dello staff: registra solo l'INGRESSO (scansione del QR).
 * Uscita e cadeau non sono previsti: la permanenza è di 30 minuti per fascia.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get('token') || '');
  const action = String(form.get('action') || 'entry');
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse('Token non valido', { status: 400 });
  if (action === 'exit' || action === 'gift') {
    return new NextResponse('Uscita e cadeau non sono previsti per questo evento: si registra solo l’ingresso', { status: 400 });
  }
  if (action !== 'entry') return new NextResponse('Azione non valida', { status: 400 });

  const result = await transaction(async client => {
    const found = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status
       FROM registrations WHERE qr_token=$1::uuid AND edition=$2 FOR UPDATE`, [token, EVENT.edition]
    );
    if (!found.rowCount) return { ok: false as const, code: 404, message: 'Registrazione non trovata' };
    const row = found.rows[0];
    if (row.status === 'cancelled') return { ok: false as const, code: 409, message: 'Registrazione annullata' };

    // Scansione ripetuta: nessun effetto (stato, eventi e ringraziamento restano unici).
    if (row.status === 'registered') {
      await client.query(`UPDATE registrations SET status='checked_in', checked_in_at=now(), updated_at=now() WHERE id=$1`, [row.id]);
      await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'checked_in','{}'::jsonb)`, [row.id]);
      await queueThankYou(client, row.id);
    }
    return { ok: true as const };
  });

  if (!result.ok) {
    if (result.code === 404 && await isArchivedRegistration('qr_token', token)) return new NextResponse(ARCHIVE_READ_ONLY_MESSAGE, { status: 409 });
    return new NextResponse(result.message, { status: result.code });
  }
  return NextResponse.redirect(new URL(`/admin/checkin/${token}?ok=entry`, req.url), 303);
}

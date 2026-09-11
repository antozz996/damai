import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';

type Action = 'entry' | 'exit' | 'gift';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get('token') || '');
  const action = (String(form.get('action') || 'entry') as Action);
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse('Token non valido', { status: 400 });
  if (!['entry','exit','gift'].includes(action)) return new NextResponse('Azione non valida', { status: 400 });

  const result = await transaction(async client => {
    const found = await client.query<{id:string; status:string; cadeau_delivered_at:string|null}>(
      `SELECT id::text, status, cadeau_delivered_at::text
       FROM registrations WHERE qr_token=$1::uuid FOR UPDATE`, [token]
    );
    if (!found.rowCount) return { ok:false as const, code:404, message:'Registrazione non trovata' };
    const row = found.rows[0];

    if (action === 'entry') {
      if (row.status === 'cancelled') return { ok:false as const, code:409, message:'Registrazione annullata' };
      if (row.status === 'registered') {
        await client.query(`UPDATE registrations SET status='checked_in', checked_in_at=now(), updated_at=now() WHERE id=$1`, [row.id]);
        await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'checked_in','{}'::jsonb)`, [row.id]);
      }
      return { ok:true as const, next:'entry' as const };
    }

    if (action === 'exit') {
      if (row.status === 'registered') return { ok:false as const, code:409, message:'Il cliente non risulta ancora entrato' };
      if (row.status === 'cancelled') return { ok:false as const, code:409, message:'Registrazione annullata' };
      if (row.status === 'checked_in') {
        await client.query(`UPDATE registrations SET status='exited', checked_out_at=now(), updated_at=now() WHERE id=$1`, [row.id]);
        await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'checked_out','{}'::jsonb)`, [row.id]);
        await client.query(`
          INSERT INTO communications (registration_id, channel, message_type, status, scheduled_for)
          VALUES ($1, 'email', 'exit_thank_you', 'queued', now())
        `, [row.id]);
      }
      return { ok:true as const, next:'exit' as const };
    }

    if (row.status !== 'exited') return { ok:false as const, code:409, message:'Registra prima l’uscita del cliente' };
    if (row.cadeau_delivered_at) return { ok:false as const, code:409, message:'Cadeau già consegnato' };
    await client.query(`UPDATE registrations SET cadeau_delivered_at=now(), updated_at=now() WHERE id=$1`, [row.id]);
    await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'cadeau_delivered','{}'::jsonb)`, [row.id]);
    return { ok:true as const, next:'gift' as const };
  });

  if (!result.ok) return new NextResponse(result.message, { status: result.code });
  return NextResponse.redirect(new URL(`/admin/checkin/${token}?ok=${result.next}`, req.url), 303);
}

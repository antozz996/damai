import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transaction } from '@/lib/db';

const editSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(160),
  eventType: z.string().trim().min(2).max(80),
  plannedEventDate: z.string().trim().max(20),
  guestCount: z.preprocess((value) => value === '' || value === null ? undefined : value, z.coerce.number().int().min(1).max(1000).optional()),
  companions: z.coerce.number().int().min(0).max(10),
  slotId: z.string().uuid(),
  source: z.string().trim().max(100),
  notes: z.string().trim().max(1000),
  marketingConsent: z.boolean(),
});

type RouteContext = { params: Promise<{ id: string }> };

function redirectToList(req: NextRequest, key: string) {
  return NextResponse.redirect(new URL(`/admin/registrations?${key}=1`, req.url), 303);
}

function redirectToEdit(req: NextRequest, id: string, key: string) {
  const query = key.includes('=') ? key : `${key}=1`;
  return NextResponse.redirect(new URL(`/admin/registrations/${id}?${query}`, req.url), 303);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('ID non valido', { status: 400 });

  const form = await req.formData();
  const intent = String(form.get('intent') || 'save');

  if (intent === 'cancel') {
    try {
      await transaction(async (client) => {
        const found = await client.query<{ status: string }>(`SELECT status FROM registrations WHERE id=$1 FOR UPDATE`, [id]);
        if (!found.rowCount) throw new Error('NOT_FOUND');
        if (found.rows[0].status === 'cancelled') return;

        await client.query(`UPDATE registrations SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=$1`, [id]);
        await client.query(`UPDATE communications SET status='skipped', last_error='Registrazione annullata da admin' WHERE registration_id=$1 AND status='queued'`, [id]);
        await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'cancelled',$2::jsonb)`, [id, JSON.stringify({ source: 'admin' })]);
      });
      return redirectToList(req, 'cancelled');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') return new NextResponse('Registrazione non trovata', { status: 404 });
      console.error('Unable to cancel registration', error);
      return redirectToEdit(req, id, 'error=Annullamento%20non%20riuscito');
    }
  }

  if (intent === 'delete') {
    try {
      await transaction(async (client) => {
        const found = await client.query<{ status: string }>(`SELECT status FROM registrations WHERE id=$1 FOR UPDATE`, [id]);
        if (!found.rowCount) throw new Error('NOT_FOUND');
        if (found.rows[0].status !== 'cancelled') throw new Error('MUST_CANCEL_FIRST');
        await client.query(`DELETE FROM registrations WHERE id=$1`, [id]);
      });
      return redirectToList(req, 'deleted');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') return new NextResponse('Registrazione non trovata', { status: 404 });
      if (error instanceof Error && error.message === 'MUST_CANCEL_FIRST') return redirectToEdit(req, id, 'error=Annulla%20prima%20di%20eliminare%20definitivamente');
      console.error('Unable to delete registration', error);
      return redirectToEdit(req, id, 'error=Eliminazione%20non%20riuscita');
    }
  }

  const parsed = editSchema.safeParse({
    firstName: String(form.get('firstName') || ''),
    lastName: String(form.get('lastName') || ''),
    phone: String(form.get('phone') || ''),
    email: String(form.get('email') || ''),
    eventType: String(form.get('eventType') || ''),
    plannedEventDate: String(form.get('plannedEventDate') || ''),
    guestCount: String(form.get('guestCount') || ''),
    companions: String(form.get('companions') || '0'),
    slotId: String(form.get('slotId') || ''),
    source: String(form.get('source') || ''),
    notes: String(form.get('notes') || ''),
    marketingConsent: form.get('marketingConsent') === 'on',
  });
  if (!parsed.success) return redirectToEdit(req, id, 'error=Dati%20non%20validi%20o%20incompleti');

  const data = parsed.data;
  try {
    await transaction(async (client) => {
      const current = await client.query<{ status: string; slot_id: string }>(`SELECT status, slot_id::text FROM registrations WHERE id=$1 FOR UPDATE`, [id]);
      if (!current.rowCount) throw new Error('NOT_FOUND');

      const targetSlot = await client.query<{ id: string; capacity: number; is_active: boolean }>(
        `SELECT id::text, capacity, is_active FROM open_day_slots WHERE id=$1 FOR UPDATE`,
        [data.slotId],
      );
      if (!targetSlot.rowCount) throw new Error('SLOT_NOT_FOUND');
      if (!targetSlot.rows[0].is_active && current.rows[0].slot_id !== data.slotId) throw new Error('SLOT_INACTIVE');

      if (current.rows[0].status === 'registered' || current.rows[0].status === 'checked_in') {
        const usage = await client.query<{ used: string }>(
          `SELECT COALESCE(SUM(1 + companions),0)::text AS used FROM registrations WHERE slot_id=$1 AND id<>$2 AND status IN ('registered','checked_in')`,
          [data.slotId, id],
        );
        const used = Number(usage.rows[0]?.used || 0);
        if (used + 1 + data.companions > targetSlot.rows[0].capacity) throw new Error('SLOT_FULL');
      }

      await client.query(`
        UPDATE registrations SET
          first_name=$1, last_name=$2, phone=$3, email=$4, event_type=$5,
          planned_event_date=NULLIF($6,'')::date, guest_count=$7, companions=$8,
          slot_id=$9, source=NULLIF($10,''), notes=NULLIF($11,''),
          marketing_consent=$12, updated_at=now()
        WHERE id=$13
      `, [
        data.firstName, data.lastName, data.phone, data.email.toLowerCase(), data.eventType,
        data.plannedEventDate, data.guestCount ?? null, data.companions, data.slotId,
        data.source, data.notes, data.marketingConsent, id,
      ]);

      await client.query(`
        UPDATE communications c
        SET scheduled_for=((s.event_date + s.start_time) AT TIME ZONE 'Europe/Rome') - interval '24 hours'
        FROM open_day_slots s
        WHERE c.registration_id=$1 AND c.message_type='reminder_24h' AND c.status='queued' AND s.id=$2
      `, [id, data.slotId]);
      await client.query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'admin_updated',$2::jsonb)`, [id, JSON.stringify({ source: 'admin', slotId: data.slotId })]);
    });
    return redirectToList(req, 'saved');
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return new NextResponse('Registrazione non trovata', { status: 404 });
    if (error instanceof Error && error.message === 'SLOT_NOT_FOUND') return redirectToEdit(req, id, 'error=Fascia%20non%20trovata');
    if (error instanceof Error && error.message === 'SLOT_INACTIVE') return redirectToEdit(req, id, 'error=La%20fascia%20scelta%20non%20%C3%A8%20attiva');
    if (error instanceof Error && error.message === 'SLOT_FULL') return redirectToEdit(req, id, 'error=La%20fascia%20scelta%20%C3%A8%20piena');
    console.error('Unable to update registration', error);
    return redirectToEdit(req, id, 'error=Salvataggio%20non%20riuscito');
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  try {
    await transaction(async (client) => {
      const result = await client.query(`DELETE FROM registrations WHERE id=$1 AND status='cancelled' RETURNING id`, [id]);
      if (!result.rowCount) throw new Error('CANCEL_REQUIRED');
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'CANCEL_REQUIRED') return NextResponse.json({ error: 'Annulla prima la registrazione' }, { status: 409 });
    console.error('Unable to delete registration', error);
    return NextResponse.json({ error: 'Eliminazione non riuscita' }, { status: 500 });
  }
}

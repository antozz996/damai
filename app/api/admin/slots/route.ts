import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get('id') || '');
  const capacity = Number(form.get('capacity'));
  const isActive = form.get('isActive') === 'on';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    return new NextResponse('Dati non validi', { status: 400 });
  }

  try {
    await transaction(async client => {
      const used = await client.query<{used:string}>(`SELECT COALESCE(SUM(1+companions),0)::text AS used FROM registrations WHERE slot_id=$1 AND status IN ('registered','checked_in')`,[id]);
      if (capacity < Number(used.rows[0]?.used || 0)) throw new Error('CAPACITY_TOO_LOW');
      await client.query(`UPDATE open_day_slots SET capacity=$1,is_active=$2,updated_at=now() WHERE id=$3`,[capacity,isActive,id]);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPACITY_TOO_LOW') return new NextResponse('La capienza non può essere inferiore alle persone già registrate.',{status:409});
    throw error;
  }

  return NextResponse.redirect(new URL('/admin/slots',req.url),303);
}

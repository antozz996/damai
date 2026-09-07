import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const allowed = new Set(['new','hot','potential','evaluating','follow_up','long_term','won','lost']);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const code = String(form.get('code') || '');
  const stage = String(form.get('stage') || '');
  if (!code || !allowed.has(stage)) return new NextResponse('Dati non validi', { status: 400 });

  const result = await query<{id:string}>(`UPDATE registrations SET lead_stage=$1, updated_at=now() WHERE registration_code=$2 RETURNING id::text`, [stage, code]);
  if (!result.rowCount) return new NextResponse('Registrazione non trovata', { status: 404 });
  await query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'lead_stage_changed',$2::jsonb)`, [result.rows[0].id, JSON.stringify({ stage })]);
  return NextResponse.redirect(new URL('/admin', req.url), 303);
}

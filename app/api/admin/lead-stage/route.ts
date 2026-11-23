import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CURRENT_EDITION, edHref, findEdition } from '@/lib/event';

const allowed = new Set(['new','hot','potential','evaluating','follow_up','long_term','won','lost']);

/**
 * Cambio dello stato del lead. È l'UNICA scrittura ammessa anche sulle edizioni
 * in archivio (campo `ed` del form, validato contro l'allowlist delle edizioni):
 * serve al commerciale per seguire i lead dopo l'evento. Aggiorna solo lead_stage.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const code = String(form.get('code') || '');
  const stage = String(form.get('stage') || '');
  const requested = String(form.get('ed') || '');
  const edition = requested ? findEdition(requested) : CURRENT_EDITION;
  if (!code || !allowed.has(stage) || !edition) return new NextResponse('Dati non validi', { status: 400 });

  const result = await query<{id:string}>(`UPDATE registrations SET lead_stage=$1, updated_at=now() WHERE registration_code=$2 AND edition=$3 RETURNING id::text`, [stage, code, edition.id]);
  if (!result.rowCount) return new NextResponse('Registrazione non trovata', { status: 404 });
  await query(`INSERT INTO registration_events (registration_id,event_type,metadata) VALUES ($1,'lead_stage_changed',$2::jsonb)`, [result.rows[0].id, JSON.stringify(edition.current ? { stage } : { stage, edition: edition.id })]);
  if (edition.current) return NextResponse.redirect(new URL('/admin', req.url), 303);
  const back = form.get('back') === 'detail' ? `/admin/registrations/${result.rows[0].id}` : '/admin/registrations';
  return NextResponse.redirect(new URL(`${edHref(back, edition)}&lead=1`, req.url), 303);
}

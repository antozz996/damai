import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { CURRENT_EDITION, findEdition } from '@/lib/event';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value);
  return `"${s.replaceAll('"','""')}"`;
}

const CURRENT_SQL = `
    SELECT r.registration_code AS codice, r.first_name AS nome, r.last_name AS cognome,
      r.phone AS telefono,
      CASE WHEN r.email LIKE '%@no-email.damai.local' THEN '' ELSE r.email END AS email,
      COALESCE(r.registration_mode, 'online') AS modalita_registrazione,
      COALESCE(r.registration_method, 'self') AS metodo_registrazione,
      (1 + r.companions) AS persone_totali,
      r.companions AS accompagnatori,
      r.children AS bambini,
      s.event_date::text AS giorno_evento,
      to_char(s.start_time,'HH24:MI') AS fascia_oraria,
      r.event_type AS tipo_evento,
      r.planned_event_date::text AS data_evento, r.guest_count AS ospiti_evento,
      r.existing_booking_venue AS struttura_prenotata,
      r.existing_booking_date::text AS data_evento_prenotato,
      r.source AS provenienza,
      r.status AS stato_ingresso, r.lead_stage AS stato_lead,
      r.marketing_consent AS consenso_marketing,
      r.utm_source, r.utm_medium, r.utm_campaign,
      r.arrived_at::text AS arrivo_walkin_at,
      r.checked_in_at::text AS checkin_at,
      r.created_at::text AS registrato_at
    FROM registrations r
    JOIN open_day_slots s ON s.id=r.slot_id
    WHERE r.edition=$1
    ORDER BY s.event_date, s.start_time, r.created_at
  `;

// Edizioni in archivio: stesse colonne di base più quelle storiche
// (stato con 'exited'/'no_show', uscita, cadeau, annullamento, note).
const ARCHIVE_SQL = `
    SELECT r.edition AS edizione,
      r.registration_code AS codice, r.first_name AS nome, r.last_name AS cognome,
      r.phone AS telefono,
      CASE WHEN r.email LIKE '%@no-email.damai.local' THEN '' ELSE r.email END AS email,
      COALESCE(r.registration_mode, 'online') AS modalita_registrazione,
      COALESCE(r.registration_method, 'self') AS metodo_registrazione,
      (1 + r.companions) AS persone_totali,
      r.companions AS accompagnatori,
      s.event_date::text AS giorno_evento,
      to_char(s.start_time,'HH24:MI') AS fascia_oraria,
      r.event_type AS tipo_evento,
      r.planned_event_date::text AS data_evento, r.guest_count AS ospiti_evento,
      r.source AS provenienza,
      r.status AS stato_ingresso, r.lead_stage AS stato_lead,
      r.marketing_consent AS consenso_marketing,
      r.utm_source, r.utm_medium, r.utm_campaign,
      r.arrived_at::text AS arrivo_walkin_at,
      r.checked_in_at::text AS checkin_at,
      r.checked_out_at::text AS checkout_at,
      r.cadeau_delivered_at::text AS cadeau_delivered_at,
      r.cancelled_at::text AS annullato_at,
      r.notes AS note,
      r.created_at::text AS registrato_at,
      r.updated_at::text AS aggiornato_at
    FROM registrations r
    JOIN open_day_slots s ON s.id=r.slot_id
    WHERE r.edition=$1
    ORDER BY s.event_date, s.start_time, r.created_at
  `;

export async function GET(req: NextRequest) {
  // `ed` assente = edizione corrente; valore non in allowlist = richiesta rifiutata.
  const requested = req.nextUrl.searchParams.get('ed');
  const edition = requested ? findEdition(requested) : CURRENT_EDITION;
  if (!edition) return new Response('Edizione non valida', { status: 400 });

  const result = await query<Record<string, unknown>>(edition.current ? CURRENT_SQL : ARCHIVE_SQL, [edition.id]);
  const headers = result.fields.map(f => f.name);
  const lines = [headers.map(csvCell).join(';')];
  for (const row of result.rows) lines.push(headers.map(h => csvCell(row[h])).join(';'));
  const body = '﻿' + lines.join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="damai-${edition.id}${edition.current ? '' : '-archivio'}-${new Date().toISOString().slice(0,10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

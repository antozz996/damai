import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const s = value == null ? '' : String(value);
  return `"${s.replaceAll('"','""')}"`;
}

export async function GET() {
  const result = await query<Record<string, unknown>>(`
    SELECT r.registration_code AS codice, r.first_name AS nome, r.last_name AS cognome,
      r.phone AS telefono, r.email, r.event_type AS tipo_evento,
      r.planned_event_date::text AS data_evento, r.guest_count AS ospiti_evento,
      r.companions AS accompagnatori_open_day, s.event_date::text AS giorno_open_day,
      to_char(s.start_time,'HH24:MI') AS fascia_oraria, r.source AS provenienza,
      r.status AS stato_ingresso, r.lead_stage AS stato_lead,
      r.marketing_consent AS consenso_marketing,
      r.utm_source, r.utm_medium, r.utm_campaign,
      r.checked_in_at::text AS checkin_at, r.created_at::text AS registrato_at
    FROM registrations r
    JOIN open_day_slots s ON s.id=r.slot_id
    ORDER BY s.event_date, s.start_time, r.created_at
  `);
  const headers = result.fields.map(f => f.name);
  const lines = [headers.map(csvCell).join(';')];
  for (const row of result.rows) lines.push(headers.map(h => csvCell(row[h])).join(';'));
  const body = '\uFEFF' + lines.join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="damai-open-days-${new Date().toISOString().slice(0,10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

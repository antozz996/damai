import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';
import { PUBLIC_CORS_ROUTES, corsHeaders, preflightResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const METHODS = PUBLIC_CORS_ROUTES['/api/slots'];

function headers(req: NextRequest) {
  return { 'Cache-Control': 'no-store', ...corsHeaders(req.headers.get('origin'), METHODS) };
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(req.headers.get('origin'), METHODS);
}

export async function GET(req: NextRequest) {
  try {
    const result = await query<{
      id: string;
      event_date: string;
      start_time: string;
      capacity: number;
      used: string;
    }>(`
      SELECT s.id, s.event_date::text, s.start_time::text, s.capacity,
        COALESCE(SUM(CASE WHEN r.status IN ('registered','checked_in') THEN (1 + r.companions) ELSE 0 END),0)::text AS used
      FROM open_day_slots s
      LEFT JOIN registrations r ON r.slot_id = s.id
      WHERE s.is_active = true AND s.edition = $1
      GROUP BY s.id
      ORDER BY s.event_date, s.start_time
    `, [EVENT.edition]);

    const slots = result.rows.map(row => {
      const used = Number(row.used);
      return { id: row.id, eventDate: row.event_date, startTime: row.start_time, capacity: row.capacity, used, remaining: Math.max(0, row.capacity - used) };
    });

    return NextResponse.json({ edition: EVENT.edition, slots }, { headers: headers(req) });
  } catch (error) {
    console.error('Unable to load Christmas Village slots', error);
    return NextResponse.json({ error: 'Disponibilità temporaneamente non disponibile.' }, { status: 503, headers: headers(req) });
  }
}

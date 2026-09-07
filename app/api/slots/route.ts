import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
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
      WHERE s.is_active = true
      GROUP BY s.id
      ORDER BY s.event_date, s.start_time
    `);

    const slots = result.rows.map(row => {
      const used = Number(row.used);
      return { id: row.id, eventDate: row.event_date, startTime: row.start_time, capacity: row.capacity, used, remaining: Math.max(0, row.capacity - used) };
    });

    return NextResponse.json({ slots }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load Open Day slots', error);
    return NextResponse.json({ error: 'Disponibilità temporaneamente non disponibile.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

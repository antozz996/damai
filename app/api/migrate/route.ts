import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== 'damai2026') {
    return new NextResponse('Accesso non autorizzato. Aggiungi ?key=damai2026', { status: 401 });
  }

  try {
    await query(`
      ALTER TABLE registrations
        ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'online'
        CHECK (registration_mode IN ('online', 'walk_in'));

      ALTER TABLE registrations
        ADD COLUMN IF NOT EXISTS registration_method text NOT NULL DEFAULT 'self'
        CHECK (registration_method IN ('self', 'staff'));

      ALTER TABLE registrations
        ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

      CREATE INDEX IF NOT EXISTS registrations_mode_idx ON registrations(registration_mode);
      CREATE INDEX IF NOT EXISTS registrations_method_idx ON registrations(registration_method);
    `);

    return NextResponse.json({
      ok: true,
      message: 'Migrazione Walk-In applicata con successo sul database Neon!',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

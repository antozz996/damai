import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { query } from '@/lib/db';
import { EVENT, checkinUrl as buildCheckinUrl } from '@/lib/event';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Pass non trovato', { status: 404 });

  const res = await query<{ registration_code: string }>(
    `SELECT registration_code
     FROM registrations
     WHERE qr_token = $1::uuid AND edition = $2
     LIMIT 1`,
    [token, EVENT.edition]
  );

  if (!res.rowCount || !res.rows[0]) {
    return new Response('Pass non trovato', { status: 404 });
  }

  const code = res.rows[0].registration_code;
  const checkinUrl = buildCheckinUrl(token);

  const pngBuffer = await QRCode.toBuffer(checkinUrl, {
    width: 520,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const uint8 = new Uint8Array(pngBuffer);

  return new Response(uint8, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="damai-pass-${code}.png"`,
      'Cache-Control': 'no-store',
    },
  });
}

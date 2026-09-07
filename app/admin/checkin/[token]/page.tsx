import { notFound } from 'next/navigation';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Row = {
  id:string; registration_code:string; first_name:string; last_name:string; phone:string; email:string;
  event_type:string; guest_count:number|null; companions:number; status:string; checked_in_at:string|null;
  event_date:string; start_time:string;
};

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ token:string }>; searchParams: Promise<{ ok?:string }> }) {
  const { token } = await params;
  const { ok } = await searchParams;
  const result = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.first_name, r.last_name, r.phone, r.email,
      r.event_type, r.guest_count, r.companions, r.status, r.checked_in_at::text,
      s.event_date::text, s.start_time::text
    FROM registrations r JOIN open_day_slots s ON s.id=r.slot_id
    WHERE r.qr_token=$1::uuid LIMIT 1
  `,[token]);
  if (!result.rowCount) notFound();
  const r = result.rows[0];

  return (
    <main className="admin">
      <div className="checkin-card">
        <div className="eyebrow">DAMAI · Check-in</div>
        <h1>{r.first_name} {r.last_name}</h1>
        {ok === '1' && <div className="success">Check-in registrato correttamente.</div>}
        <p><strong>Codice:</strong> {r.registration_code}</p>
        <p><strong>Evento:</strong> {r.event_type}{r.guest_count ? ` · circa ${r.guest_count} ospiti` : ''}</p>
        <p><strong>Ingresso prenotato:</strong> {r.event_date} · {r.start_time.slice(0,5)}</p>
        <p><strong>Persone nel gruppo:</strong> {1+r.companions}</p>
        <p><strong>Telefono:</strong> {r.phone}<br/><strong>Email:</strong> {r.email}</p>
        <p><strong>Stato:</strong> <span className={`pill ${r.status==='checked_in'?'ok':''}`}>{r.status}</span></p>
        {r.checked_in_at && <p className="info">Check-in già effettuato: {new Date(r.checked_in_at).toLocaleString('it-IT')}</p>}
        {r.status !== 'checked_in' && r.status !== 'cancelled' && (
          <form method="post" action="/api/admin/checkin">
            <input type="hidden" name="token" value={token}/>
            <button type="submit">Conferma ingresso · {1+r.companions} {1+r.companions===1?'persona':'persone'}</button>
          </form>
        )}
        <div className="toolbar"><a href="/admin">← Dashboard</a></div>
      </div>
    </main>
  );
}

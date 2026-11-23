import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

type Row = {
  id:string; registration_code:string; first_name:string; last_name:string; phone:string; email:string;
  event_type:string; guest_count:number|null; companions:number; children:number; status:string; checked_in_at:string|null; checked_out_at:string|null; cadeau_delivered_at:string|null;
  registration_mode?:string; event_date:string; start_time:string;
};

const STATUS_LABELS: Record<string, string> = {
  registered: 'REGISTRATO',
  checked_in: 'PRESENTE',
  exited: 'USCITO',
  cancelled: 'ANNULLATO',
  no_show: 'NO SHOW',
};

const formatTime = (value: string) => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ token:string }>; searchParams: Promise<{ ok?:string }> }) {
  const { token } = await params;
  const { ok } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const result = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.first_name, r.last_name, r.phone, r.email,
      r.event_type, r.guest_count, r.companions, r.children, r.status, r.checked_in_at::text, r.checked_out_at::text, r.cadeau_delivered_at::text,
      r.registration_mode, s.event_date::text, s.start_time::text
    FROM registrations r JOIN open_day_slots s ON s.id=r.slot_id
    WHERE r.qr_token=$1::uuid AND r.edition=$2 LIMIT 1
  `,[token, EVENT.edition]);
  if (!result.rowCount) notFound();
  const r = result.rows[0];
  const isWalkIn = r.registration_mode === 'walk_in';
  const hasRealEmail = r.email && !r.email.toLowerCase().endsWith('@no-email.damai.local');
  const giftEnabled = EVENT.features.gift;
  const partySize = 1 + r.companions;

  return (
    <main className="admin">
      <div className="checkin-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow">DAMAI · Check-in · {EVENT.shortName}</div>
          {isWalkIn && (
            <span style={{ background: '#0a3157', color: '#efc64c', fontSize: '11px', padding: '3px 8px', letterSpacing: '0.1em', fontWeight: 'bold' }}>
              ✦ WALK-IN
            </span>
          )}
        </div>
        <h1>{r.first_name} {r.last_name}</h1>
        {ok === 'entry' && <div className="success">Ingresso registrato correttamente.</div>}
        {ok === 'exit' && <div className="success">{giftEnabled ? 'Uscita registrata. Ora puoi consegnare il cadeau.' : 'Uscita registrata. L’ospite riceverà la mail di ringraziamento.'}</div>}
        {giftEnabled && ok === 'gift' && <div className="success">Cadeau registrato come consegnato.</div>}
        <p><strong>Codice:</strong> {r.registration_code}</p>
        <p><strong>Interesse:</strong> {r.event_type}{r.guest_count ? ` · circa ${r.guest_count} ospiti` : ''}</p>
        <p><strong>Ingresso:</strong> {r.event_date} · {r.start_time.slice(0,5)} {isWalkIn ? '(Walk-in)' : ''}</p>
        <p><strong>Persone nel gruppo:</strong> {partySize}{r.children > 0 ? ` · di cui ${r.children} ${r.children === 1 ? 'bambino' : 'bambini'}` : ''}</p>
        <p><strong>Telefono:</strong> {r.phone}<br/><strong>Email:</strong> {hasRealEmail ? r.email : <span style={{ color: '#888' }}>(Nessuna email - Walk-In)</span>}</p>
        <p><strong>Stato:</strong> <span className={`pill ${r.status==='checked_in' || r.status==='exited'?'ok':''}`}>{STATUS_LABELS[r.status] || r.status}</span></p>
        {r.checked_in_at && <p className="info">Ingresso: {formatTime(r.checked_in_at)}</p>}
        {r.checked_out_at && <p className="info">Uscita: {formatTime(r.checked_out_at)}</p>}
        {giftEnabled && r.cadeau_delivered_at && <p className="info">Cadeau consegnato: {formatTime(r.cadeau_delivered_at)}</p>}
        {r.status === 'registered' && (
          <form method="post" action="/api/admin/checkin">
            <input type="hidden" name="token" value={token}/><input type="hidden" name="action" value="entry"/>
            <button type="submit">Conferma ingresso · {partySize} {partySize===1?'persona':'persone'}</button>
          </form>
        )}
        {r.status === 'checked_in' && (
          <form method="post" action="/api/admin/checkin">
            <input type="hidden" name="token" value={token}/><input type="hidden" name="action" value="exit"/>
            <button type="submit">Registra uscita</button>
          </form>
        )}
        {giftEnabled && r.status === 'exited' && !r.cadeau_delivered_at && (
          <form method="post" action="/api/admin/checkin">
            <input type="hidden" name="token" value={token}/><input type="hidden" name="action" value="gift"/>
            <button type="submit">Conferma cadeau consegnato</button>
          </form>
        )}
        <div className="toolbar"><a href="/admin/checkin">← Scanner QR</a><a href="/admin">Dashboard</a></div>
      </div>
    </main>
  );
}

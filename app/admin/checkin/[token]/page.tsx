import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

type SlotState = 'now' | 'early' | 'late' | 'other_day';

type Row = {
  id:string; registration_code:string; first_name:string; last_name:string; phone:string; email:string;
  event_type:string; guest_count:number|null; companions:number; children:number; status:string; checked_in_at:string|null;
  existing_booking_venue:string|null; existing_booking_date:string|null;
  registration_mode?:string; event_date:string; start_time:string; slot_state:SlotState;
};

const STATUS_LABELS: Record<string, string> = {
  registered: 'DA ARRIVARE',
  checked_in: 'ENTRATO',
  exited: 'ENTRATO',
  cancelled: 'ANNULLATO',
  no_show: 'NO SHOW',
};

const formatTime = (value: string) => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
const formatDay = (value: string) => new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long' }).format(new Date(`${value}T12:00:00`));

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ token:string }>; searchParams: Promise<{ ok?:string }> }) {
  const { token } = await params;
  const { ok } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  // slot_state: la fascia del biglietto rispetto all'ora attuale (Europe/Rome),
  // con 10 minuti di tolleranza in anticipo e ${EVENT.visitMinutes} minuti di permanenza.
  const result = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.first_name, r.last_name, r.phone, r.email,
      r.event_type, r.guest_count, r.companions, r.children, r.status, r.checked_in_at::text,
      r.existing_booking_venue, r.existing_booking_date::text,
      r.registration_mode, s.event_date::text, s.start_time::text,
      CASE
        WHEN (now() AT TIME ZONE 'Europe/Rome')::date <> s.event_date THEN 'other_day'
        WHEN (now() AT TIME ZONE 'Europe/Rome') < (s.event_date + s.start_time) - interval '10 minutes' THEN 'early'
        WHEN (now() AT TIME ZONE 'Europe/Rome') >= (s.event_date + s.start_time) + make_interval(mins => $3::int) THEN 'late'
        ELSE 'now'
      END AS slot_state
    FROM registrations r JOIN open_day_slots s ON s.id=r.slot_id
    WHERE r.qr_token=$1::uuid AND r.edition=$2 LIMIT 1
  `,[token, EVENT.edition, EVENT.visitMinutes]);
  if (!result.rowCount) notFound();
  const r = result.rows[0];
  const isWalkIn = r.registration_mode === 'walk_in';
  const hasRealEmail = r.email && !r.email.toLowerCase().endsWith('@no-email.damai.local');
  const partySize = 1 + r.companions;
  const cancelled = r.status === 'cancelled';
  const entered = r.status === 'checked_in' || r.status === 'exited';
  const slotLabel = `${formatDay(r.event_date)} · fascia ${r.start_time.slice(0,5)}`;
  const slotWarning = r.slot_state === 'other_day'
    ? `Attenzione: il biglietto è per un altro giorno (${slotLabel}).`
    : r.slot_state === 'early'
      ? `Attenzione: la fascia di questo biglietto non è ancora iniziata (${slotLabel}).`
      : r.slot_state === 'late'
        ? `Attenzione: la fascia di questo biglietto è già terminata (${slotLabel}).`
        : '';

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
        {ok === 'entry' && !cancelled && <div className="success">Ingresso registrato correttamente.</div>}
        {cancelled && <div className="error" role="alert" style={{ marginBottom: 18 }}>Biglietto ANNULLATO: non è valido per l’ingresso.</div>}
        {!cancelled && slotWarning && <div role="alert" style={{ padding: 14, marginBottom: 18, background: '#fbf0d5', color: '#7a5210', border: '1px solid #e6cf9a' }}>{slotWarning}</div>}
        {!cancelled && !slotWarning && !entered && <div className="success">Biglietto valido · fascia in corso.</div>}
        <p><strong>Codice:</strong> {r.registration_code}</p>
        <p><strong>Fascia:</strong> {r.event_date} · {r.start_time.slice(0,5)} · {EVENT.visitLabel} {isWalkIn ? '(Walk-in)' : ''}</p>
        <p><strong>Persone nel gruppo:</strong> {partySize}{r.children > 0 ? ` · di cui ${r.children} ${r.children === 1 ? 'bambino' : 'bambini'}` : ''}</p>
        <p><strong>Interesse:</strong> {r.event_type}{r.guest_count ? ` · circa ${r.guest_count} ospiti` : ''}</p>
        {r.existing_booking_venue && <p><strong>Cliente:</strong> evento già prenotato · {r.existing_booking_venue}{r.existing_booking_date ? ` · ${r.existing_booking_date}` : ''}</p>}
        <p><strong>Telefono:</strong> {r.phone}<br/><strong>Email:</strong> {hasRealEmail ? r.email : <span style={{ color: '#888' }}>(Nessuna email - Walk-In)</span>}</p>
        <p><strong>Stato:</strong> <span className={`pill ${entered ? 'ok' : ''}`}>{STATUS_LABELS[r.status] || r.status}</span></p>
        {r.checked_in_at && <p className="info">Ingresso registrato: {formatTime(r.checked_in_at)}</p>}
        {r.status === 'registered' && (
          <form method="post" action="/api/admin/checkin">
            <input type="hidden" name="token" value={token}/><input type="hidden" name="action" value="entry"/>
            <button type="submit">Registra ingresso · {partySize} {partySize===1?'persona':'persone'}</button>
          </form>
        )}
        <div className="toolbar"><a href="/admin/checkin">← Scanner QR</a><a href="/admin">Dashboard</a></div>
      </div>
    </main>
  );
}

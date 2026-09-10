import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Registration = {
  registration_code: string;
  first_name: string;
  last_name: string;
  event_type: string;
  companions: number;
  event_date: string;
  start_time: string;
  status: string;
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await query<Registration>(`
    SELECT r.registration_code, r.first_name, r.last_name, r.event_type, r.companions,
      s.event_date::text, s.start_time::text, r.status
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.qr_token = $1::uuid
    LIMIT 1
  `, [token]);
  if (!result.rowCount) notFound();
  const r = result.rows[0];

  const checkinUrl = `https://www.damaigarden.it/opendays?checkin=${encodeURIComponent(token)}`;
  const qr = await QRCode.toDataURL(checkinUrl, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
  const date = new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date(`${r.event_date}T12:00:00`));

  return (
    <main className="ticket-shell">
      <article className="ticket">
        <div className="brand">DAMAI</div>
        <div className="brand-sub" style={{marginBottom:0}}>Exclusive Garden</div>
        <h1>La tua visita è confermata.</h1>
        <p>Mostra questo QR all'ingresso. È il tuo pass personale per gli Open Days 2026.</p>
        <img className="qr" src={qr} alt="QR code personale DAMAI" />
        <div className="code">{r.registration_code}</div>
        <div className="ticket-meta">
          <div><strong>Ospite</strong>{r.first_name} {r.last_name}</div>
          <div><strong>Evento</strong>{r.event_type}</div>
          <div><strong>Giorno</strong>{date}</div>
          <div><strong>Arrivo</strong>{r.start_time.slice(0,5)}</div>
        </div>
        {r.companions > 0 && <p>Registrazione valida per te + {r.companions} {r.companions === 1 ? 'accompagnatore' : 'accompagnatori'}.</p>}
        <p className="info">L'orario indicato è la fascia di arrivo, non la durata della visita. Salva questa pagina o fai uno screenshot del QR.</p>
      </article>
    </main>
  );
}

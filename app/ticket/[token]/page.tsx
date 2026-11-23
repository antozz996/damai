import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { query } from '@/lib/db';
import { EVENT, checkinUrl } from '@/lib/event';

export const dynamic = 'force-dynamic';

type Registration = {
  registration_code: string;
  first_name: string;
  last_name: string;
  companions: number;
  children: number;
  event_date: string;
  start_time: string;
  status: string;
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const result = await query<Registration>(`
    SELECT r.registration_code, r.first_name, r.last_name, r.companions, r.children,
      s.event_date::text, s.start_time::text, r.status
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.qr_token = $1::uuid AND r.edition = $2
    LIMIT 1
  `, [token, EVENT.edition]);
  if (!result.rowCount) notFound();
  const r = result.rows[0];
  const cancelled = r.status === 'cancelled';

  const qr = await QRCode.toDataURL(checkinUrl(token), { width: 520, margin: 1, errorCorrectionLevel: 'M' });
  const date = new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(new Date(`${r.event_date}T12:00:00`));
  const partySize = 1 + r.companions;

  return (
    <main className="ticket-shell">
      <article className="ticket">
        <div className="brand">DAMAI</div>
        <div className="brand-sub" style={{marginBottom:0}}>{EVENT.shortName} · Ingresso gratuito</div>
        {cancelled ? (
          <>
            <h1>Registrazione annullata.</h1>
            <p>Questo biglietto non è più valido. Per registrarti di nuovo visita <a href={EVENT.publicPageUrl}>la pagina del {EVENT.shortName}</a>.</p>
          </>
        ) : (
          <>
            <h1>Il tuo posto è confermato.</h1>
            <p>Presenta questo QR all’ingresso: è il tuo biglietto personale per il {EVENT.name}.</p>
            <img className="qr" src={qr} alt="QR code personale DAMAI" />
            <div className="code">{r.registration_code}</div>
            <div className="ticket-meta">
              <div><strong>Ospite</strong>{r.first_name} {r.last_name}</div>
              <div><strong>Persone</strong>{partySize}{r.children > 0 ? ` (di cui ${r.children} ${r.children === 1 ? 'bambino' : 'bambini'})` : ''}</div>
              <div><strong>Giorno</strong>{date}</div>
              <div><strong>Arrivo</strong>dalle {r.start_time.slice(0,5)}</div>
            </div>
            <p>{EVENT.venue} · {EVENT.address}</p>
            <p className="info">L’orario indicato è la fascia di arrivo, non la durata della visita: il villaggio resta aperto fino alle 21:30. Salva questa pagina o fai uno screenshot del QR. Dopo l’uscita riceverai una mail di ringraziamento.</p>
          </>
        )}
      </article>
    </main>
  );
}

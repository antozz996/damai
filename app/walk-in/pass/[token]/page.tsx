import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { query } from '@/lib/db';
import ScreenshotButton from './screenshot-button';
import './pass.css';

export const dynamic = 'force-dynamic';

type PassRow = {
  id: string;
  registration_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  companions: number;
  registration_mode: string;
  event_date: string;
  start_time: string;
};

function staffBaseUrl() {
  return (process.env.STAFF_BASE_URL || 'https://damai-rouge.vercel.app').replace(/\/$/, '');
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default async function WalkInPassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await query<PassRow>(
    `SELECT r.id::text, r.registration_code, r.first_name, r.last_name, r.phone, r.email,
       r.companions, r.registration_mode, s.event_date::text, s.start_time::text
     FROM registrations r
     JOIN open_day_slots s ON s.id = r.slot_id
     WHERE r.qr_token = $1::uuid
     LIMIT 1`,
    [token]
  );

  if (!res.rowCount || !res.rows[0]) {
    notFound();
  }

  const r = res.rows[0];
  const checkinUrl = `${staffBaseUrl()}/admin/checkin/${token}`;

  // Generazione QR per visualizzazione su schermo
  const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
    width: 520,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const partySize = 1 + r.companions;
  const isWalkIn = r.registration_mode === 'walk_in';

  return (
    <main className="pass-shell">
      <div className="pass-container">
        <header className="pass-header">
          <img
            src="/damai/damai-logo-cream.png"
            alt="DAMAI Event Garden"
            className="pass-logo"
            width={160}
            height={46}
          />
          <div className="pass-edition">✦ Open Days 2026 ✦</div>
          <div className="pass-title">La Dolce Vita</div>
        </header>

        {/* Banner Screenshot Evidente per chi è sotto il sole o in movimento */}
        <section className="screenshot-banner">
          <div className="screenshot-icon">📸</div>
          <strong>IMPORTANTE — SALVA IL TUO PASS</strong>
          <p>
            Fai subito uno <u>screenshot</u> di questa schermata.
            Ti servirà all’uscita per ricevere il tuo <strong>cadeau esclusivo</strong>.
          </p>
        </section>

        {/* Card Pass */}
        <article className="pass-card">
          <div className="pass-card-eyebrow">Pass Ospite Ufficiale</div>
          <h1 className="pass-guest-name">
            {r.first_name} {r.last_name}
          </h1>

          <div className="pass-tags">
            {isWalkIn && <span className="pass-badge walkin">✦ Walk-In</span>}
            <span className="pass-badge party">
              {partySize} {partySize === 1 ? 'persona' : 'persone'}
            </span>
          </div>

          <div className="pass-qr-wrap">
            <img
              src={qrDataUrl}
              alt={`QR Code Pass ${r.registration_code}`}
              className="pass-qr-img"
              width={240}
              height={240}
            />
          </div>

          <div className="pass-code">{r.registration_code}</div>

          <p className="pass-date-time">
            {formatDate(r.event_date)} · Fascia {r.start_time.slice(0, 5)}
          </p>
        </article>

        {/* Pulsante conferma screenshot */}
        <ScreenshotButton />

        {/* Link download alternativo */}
        <a
          href={`/walk-in/pass/${token}/download`}
          className="pass-download-link"
          download={`damai-pass-${r.registration_code}.png`}
        >
          Scarica immagine QR (PNG)
        </a>

        {/* Istruzioni e rassicurazioni */}
        <section className="pass-instructions">
          <strong>All’uscita mostra questo QR allo staff</strong>
          per registrare la tua visita e ritirare il cadeau DAMAI.
          <div className="pass-support-note">
            Hai difficoltà o hai perso il QR? Comunica il tuo cognome (<strong>{r.last_name}</strong>)
            o il tuo recapito allo staff della reception.
          </div>
        </section>
      </div>
    </main>
  );
}

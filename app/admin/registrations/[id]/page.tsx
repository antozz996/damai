import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import RegistrationActions from '../actions';

export const dynamic = 'force-dynamic';

type Registration = {
  id: string;
  registration_code: string;
  qr_token: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  event_type: string;
  planned_event_date: string | null;
  guest_count: number | null;
  companions: number;
  slot_id: string;
  source: string | null;
  notes: string | null;
  privacy_consent: boolean;
  marketing_consent: boolean;
  status: string;
  lead_stage: string;
  event_date: string;
  start_time: string;
  created_at: string;
  updated_at: string;
};

type Slot = { id: string; event_date: string; start_time: string; capacity: number; is_active: boolean; used: string };

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Presente',
  exited: 'Uscito',
  cancelled: 'Annullato',
  no_show: 'No show',
};

export default async function RegistrationEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const paramsQuery = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const registrationResult = await query<Registration>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.phone, r.email, r.event_type, r.planned_event_date::text, r.guest_count,
      r.companions, r.slot_id::text, r.source, r.notes, r.privacy_consent,
      r.marketing_consent, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text, r.updated_at::text
    FROM registrations r JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.id=$1
  `, [id]);
  if (!registrationResult.rowCount) notFound();

  const slotsResult = await query<Slot>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity, s.is_active,
      COALESCE(SUM(CASE WHEN r.status IN ('registered','checked_in') THEN (1+r.companions) ELSE 0 END),0)::text AS used
    FROM open_day_slots s LEFT JOIN registrations r ON r.slot_id=s.id
    GROUP BY s.id ORDER BY s.event_date,s.start_time
  `);
  const r = registrationResult.rows[0];
  const saved = Array.isArray(paramsQuery.saved) ? paramsQuery.saved[0] : paramsQuery.saved;
  const error = Array.isArray(paramsQuery.error) ? paramsQuery.error[0] : paramsQuery.error;

  return (
    <main className="admin">
      <div className="admin-inner admin-edit-page">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Scheda ospite</div>
            <h1>{r.first_name} {r.last_name}</h1>
            <p className="admin-intro">{r.registration_code} · creato il {new Date(r.created_at).toLocaleString('it-IT')}</p>
          </div>
          <RegistrationActions id={r.id} status={r.status} registrationCode={r.registration_code} qrToken={r.qr_token} />
        </header>

        {saved === '1' && <div className="success admin-notice" role="status">Modifica salvata correttamente.</div>}
        {error && <div className="error admin-notice" role="alert">{error}</div>}

        <div className="admin-edit-layout">
          <form className="admin-edit-form" method="post" action={`/api/admin/registrations/${r.id}`}>
            <input type="hidden" name="intent" value="save" />
            <div className="admin-form-heading"><span className="eyebrow">Dati modificabili</span><h2>Informazioni registrazione</h2></div>
            <div className="admin-form-grid">
              <label>Nome<input name="firstName" required minLength={2} maxLength={80} defaultValue={r.first_name} /></label>
              <label>Cognome<input name="lastName" required minLength={2} maxLength={80} defaultValue={r.last_name} /></label>
              <label>Email<input name="email" type="email" required maxLength={160} defaultValue={r.email} /></label>
              <label>Telefono<input name="phone" required minLength={7} maxLength={30} defaultValue={r.phone} /></label>
              <label>Tipo evento<input name="eventType" required minLength={2} maxLength={80} defaultValue={r.event_type} /></label>
              <label>Data prevista<input name="plannedEventDate" type="date" defaultValue={r.planned_event_date || ''} /></label>
              <label>Ospiti previsti<input name="guestCount" type="number" min="1" max="1000" defaultValue={r.guest_count ?? ''} /></label>
              <label>Accompagnatori<input name="companions" type="number" min="0" max="10" required defaultValue={r.companions} /></label>
              <label className="full">Fascia di ingresso
                <select name="slotId" required defaultValue={r.slot_id}>
                  {slotsResult.rows.map((slot) => {
                    const used = Number(slot.used);
                    const isCurrent = slot.id === r.slot_id;
                    const disabled = !slot.is_active && !isCurrent;
                    return <option key={slot.id} value={slot.id} disabled={disabled}>{slot.event_date} · {slot.start_time.slice(0, 5)} · {used}/{slot.capacity}{!slot.is_active ? ' · non attiva' : ''}</option>;
                  })}
                </select>
              </label>
              <label>Fonte<input name="source" maxLength={100} defaultValue={r.source || ''} /></label>
              <label className="full">Note<textarea name="notes" maxLength={1000} defaultValue={r.notes || ''} /></label>
            </div>
            <div className="admin-consents">
              <label><input type="checkbox" checked={r.privacy_consent} disabled /> Privacy accettata</label>
              <label><input type="checkbox" name="marketingConsent" defaultChecked={r.marketing_consent} /> Consenso comunicazioni marketing</label>
            </div>
            <button className="submit admin-save" type="submit">Salva modifiche</button>
          </form>

          <aside className="admin-side-card">
            <div className="eyebrow">Stato operativo</div>
            <h2>{STATUS_LABELS[r.status] || r.status}</h2>
            <p><strong>Slot:</strong><br />{r.event_date} · {r.start_time.slice(0, 5)}</p>
            <p><strong>Gruppo:</strong><br />{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}</p>
            <p><strong>Lead:</strong><br />{r.lead_stage}</p>
            <p><strong>QR token:</strong><br /><code>{r.qr_token}</code></p>
            <a className="admin-text-link" href={`/admin/checkin/${r.qr_token}`}>Apri scheda scanner →</a>
            <div className="admin-side-note">La modifica non invia automaticamente una nuova email. Se cambi email o fascia, verifica il dato e usa il pannello “Test email” solo per una prova separata.</div>
          </aside>
        </div>

        <div className="toolbar"><a href="/admin/registrations">← Torna alle registrazioni</a><a href="/admin">Dashboard</a></div>
      </div>
    </main>
  );
}

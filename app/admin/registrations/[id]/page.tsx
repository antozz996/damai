import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { CURRENT_EDITION, edHref, EDITION_IDS, findEdition, LEAD_STAGES, leadStageLabel, statusLabel, type Edition } from '@/lib/event';
import EditionBar from '../../edition-bar';
import RegistrationActions from '../actions';
import ResendConfirmation from './resend-confirmation';

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
  children: number;
  existing_booking_venue: string | null;
  existing_booking_date: string | null;
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
  edition: string;
  registration_mode: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cadeau_delivered_at: string | null;
  cancelled_at: string | null;
};

type Slot = { id: string; event_date: string; start_time: string; capacity: number; is_active: boolean; used: string };

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '';

/** Scheda di un'edizione conclusa: tutti i dati in sola lettura, modificabile solo lo stato del lead. */
function ArchivedRegistration({ r, edition, leadSaved }: { r: Registration; edition: Edition; leadSaved: boolean }) {
  const hasRealEmail = !r.email.toLowerCase().endsWith('@no-email.damai.local');
  const fields: Array<[string, string, boolean?]> = [
    ['Nome', r.first_name],
    ['Cognome', r.last_name],
    ['Email', hasRealEmail ? r.email : '—'],
    ['Telefono', r.phone],
    ['Tipo evento', r.event_type],
    ['Data prevista', r.planned_event_date || '—'],
    ['Ospiti previsti', r.guest_count != null ? String(r.guest_count) : '—'],
    ['Accompagnatori', String(r.companions)],
    ['Fascia di ingresso', `${r.event_date} · ${r.start_time.slice(0, 5)}`],
    ['Fonte', r.source || '—'],
    ['Modalità', r.registration_mode === 'walk_in' ? 'Walk-In' : 'Online'],
    ['Consensi', `Privacy: ${r.privacy_consent ? 'sì' : 'no'} · Marketing: ${r.marketing_consent ? 'sì' : 'no'}`],
    ['Note', r.notes || '—', true],
  ];
  if (r.children > 0) fields.splice(8, 0, ['Di cui bambini', String(r.children)]);
  if (r.existing_booking_venue) fields.splice(fields.length - 1, 0, ['Evento già prenotato', `${r.existing_booking_venue}${r.existing_booking_date ? ` · ${r.existing_booking_date}` : ''}`]);
  const timeline: Array<[string, string | null]> = [
    ['Registrato', r.created_at],
    ['Ingresso', r.checked_in_at],
    ['Uscita', r.checked_out_at],
    ['Cadeau consegnato', r.cadeau_delivered_at],
    ['Annullato', r.cancelled_at],
  ];

  return (
    <main className="admin">
      <div className="admin-inner admin-edit-page">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Scheda ospite · Archivio</div>
            <h1>{r.first_name} {r.last_name}</h1>
            <p className="admin-intro"><span className="edition-badge archive">{edition.tabLabel} · archivio</span> {r.registration_code} · creato il {formatDateTime(r.created_at)}</p>
          </div>
          <div className="admin-header-actions"><a className="admin-public-link" href={edHref('/admin/registrations', edition)}>← Registrazioni</a></div>
        </header>

        <EditionBar edition={edition} path="/admin/registrations" />

        {leadSaved && <div className="success admin-notice" role="status">Stato del lead aggiornato.</div>}

        <div className="admin-edit-layout">
          <section className="admin-edit-form" aria-label="Dati della registrazione">
            <div className="admin-form-heading"><span className="eyebrow">Dati non modificabili</span><h2>Informazioni registrazione</h2></div>
            <dl className="admin-readonly-grid">
              {fields.map(([label, value, full]) => (
                <div key={label} className={full ? 'full' : undefined}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>

          <aside className="admin-side-card">
            <div className="eyebrow">Stato finale</div>
            <h2>{statusLabel(r.status, edition)}</h2>
            <p><strong>Gruppo:</strong><br />{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}</p>
            {timeline.filter(([, value]) => value).map(([label, value]) => (
              <p key={label}><strong>{label}:</strong><br />{formatDateTime(value)}</p>
            ))}
            <p><strong>Lead:</strong><br />{leadStageLabel(r.lead_stage)}</p>
            <form method="post" action="/api/admin/lead-stage" className="lead-form">
              <input type="hidden" name="code" value={r.registration_code} />
              <input type="hidden" name="ed" value={edition.id} />
              <input type="hidden" name="back" value="detail" />
              <select name="stage" defaultValue={r.lead_stage} aria-label="Stato del lead">
                {LEAD_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="submit">Salva lead</button>
            </form>
            <div className="admin-side-note">Edizione in archivio: dati, fascia, stato ed email non sono modificabili. Puoi aggiornare solo lo stato del lead.</div>
          </aside>
        </div>

        <div className="toolbar"><a href={edHref('/admin/registrations', edition)}>← Torna alle registrazioni</a><a href={edHref('/admin', edition)}>Dashboard archivio</a></div>
      </div>
    </main>
  );
}

export default async function RegistrationEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const paramsQuery = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const registrationResult = await query<Registration>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.phone, r.email, r.event_type, r.planned_event_date::text, r.guest_count,
      r.companions, r.children, r.existing_booking_venue, r.existing_booking_date::text,
      r.slot_id::text, r.source, r.notes, r.privacy_consent,
      r.marketing_consent, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text, r.updated_at::text,
      r.edition, r.registration_mode, r.checked_in_at::text, r.checked_out_at::text,
      r.cadeau_delivered_at::text, r.cancelled_at::text
    FROM registrations r JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.id=$1 AND r.edition = ANY($2::text[])
  `, [id, EDITION_IDS]);
  if (!registrationResult.rowCount) notFound();
  // L'edizione è quella del record (non del parametro ?ed): una scheda d'archivio resta sempre in sola lettura.
  const edition = findEdition(registrationResult.rows[0].edition) ?? CURRENT_EDITION;
  if (!edition.current) {
    const lead = Array.isArray(paramsQuery.lead) ? paramsQuery.lead[0] : paramsQuery.lead;
    return <ArchivedRegistration r={registrationResult.rows[0]} edition={edition} leadSaved={lead === '1'} />;
  }

  const slotsResult = await query<Slot>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity, s.is_active,
      COALESCE(SUM(CASE WHEN r.status IN ('registered','checked_in') THEN (1+r.companions) ELSE 0 END),0)::text AS used
    FROM open_day_slots s LEFT JOIN registrations r ON r.slot_id=s.id
    WHERE s.edition=$1
    GROUP BY s.id ORDER BY s.event_date,s.start_time
  `, [edition.id]);
  const r = registrationResult.rows[0];
  const saved = Array.isArray(paramsQuery.saved) ? paramsQuery.saved[0] : paramsQuery.saved;
  const error = Array.isArray(paramsQuery.error) ? paramsQuery.error[0] : paramsQuery.error;

  return (
    <main className="admin">
      <div className="admin-inner admin-edit-page">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Scheda ospite</div>
            <h1>{r.first_name} {r.last_name}{r.existing_booking_venue ? <> <span className="pill ok" style={{ fontSize: 13, verticalAlign: 'middle' }}>Cliente</span></> : null}</h1>
            <p className="admin-intro"><span className="edition-badge">{edition.tabLabel}</span> {r.registration_code} · creato il {new Date(r.created_at).toLocaleString('it-IT')}</p>
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
              <label>Accompagnatori (bambini compresi)<input name="companions" type="number" min="0" max="10" required defaultValue={r.companions} /></label>
              <label>Di cui bambini<input name="children" type="number" min="0" max="10" required defaultValue={r.children} /></label>
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
            <h2>{statusLabel(r.status, edition)}</h2>
            <p><strong>Slot:</strong><br />{r.event_date} · {r.start_time.slice(0, 5)}</p>
            <p><strong>Gruppo:</strong><br />{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}{r.children > 0 ? ` · di cui ${r.children} ${r.children === 1 ? 'bambino' : 'bambini'}` : ''}</p>
            <p><strong>Evento già prenotato:</strong><br />{r.existing_booking_venue ? `${r.existing_booking_venue}${r.existing_booking_date ? ` · ${r.existing_booking_date}` : ''}` : 'No'}</p>
            <p><strong>Lead:</strong><br />{r.lead_stage}</p>
            <p><strong>QR token:</strong><br /><code>{r.qr_token}</code></p>
            <a className="admin-text-link" href={`/admin/checkin/${r.qr_token}`}>Apri scheda scanner →</a>
            <ResendConfirmation id={r.id} email={r.email} disabled={r.status === 'cancelled'} />
            <div className="admin-side-note">Le modifiche ai dati non inviano email automaticamente. Salva prima l'indirizzo o la fascia corretti, poi reinvia la conferma da questa scheda.</div>
          </aside>
        </div>

        <div className="toolbar"><a href="/admin/registrations">← Torna alle registrazioni</a><a href="/admin">Dashboard</a></div>
      </div>
    </main>
  );
}

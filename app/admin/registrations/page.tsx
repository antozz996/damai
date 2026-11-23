import { query } from '@/lib/db';
import { edHref, LEAD_STAGES, resolveEdition, statusLabel } from '@/lib/event';
import EditionBar from '../edition-bar';
import RegistrationActions from './actions';

export const dynamic = 'force-dynamic';

type RegistrationRow = {
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
  source: string | null;
  status: string;
  lead_stage: string;
  event_date: string;
  start_time: string;
  created_at: string;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function RegistrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const edition = resolveEdition(params.ed);
  const archive = !edition.current;
  const q = first(params.q).trim();
  const status = ['active', 'cancelled', 'all'].includes(first(params.status)) ? first(params.status) : 'active';
  const notice = first(params.lead) === '1' ? 'Stato del lead aggiornato.' : first(params.saved) === '1' ? 'Modifica salvata correttamente.' : first(params.cancelled) === '1' ? 'Registrazione annullata: lo slot è stato liberato.' : first(params.deleted) === '1' ? 'Record eliminato definitivamente.' : '';

  const countsResult = await query<{ active: string; cancelled: string; people: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COALESCE(SUM(1 + companions) FILTER (WHERE status = ANY($2::text[])), 0)::text AS people
    FROM registrations
    WHERE edition = $1
  `, [edition.id, edition.activeStatuses]);

  const rows = await query<RegistrationRow>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.phone, r.email, r.event_type, r.planned_event_date::text, r.guest_count,
      r.companions, r.children, r.existing_booking_venue, r.existing_booking_date::text,
      r.source, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE ($1 = '' OR r.registration_code ILIKE '%' || $1 || '%' OR r.first_name ILIKE '%' || $1 || '%' OR r.last_name ILIKE '%' || $1 || '%' OR r.email ILIKE '%' || $1 || '%' OR r.phone ILIKE '%' || $1 || '%')
      AND ($2 = 'all' OR ($2 = 'active' AND r.status <> 'cancelled') OR ($2 = 'cancelled' AND r.status = 'cancelled'))
      AND r.edition = $3
    ORDER BY r.created_at DESC
    LIMIT 500
  `, [q, status, edition.id]);

  const counts = countsResult.rows[0] ?? { active: '0', cancelled: '0', people: '0' };

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Gestione ospiti{archive ? ' · Archivio' : ''}</div>
            <h1>Registrazioni</h1>
            <p className="admin-intro">{archive
              ? `${edition.name}: consulta le schede e aggiorna lo stato dei lead. Gli altri dati non sono modificabili.`
              : 'Modifica i dati, sposta una fascia o archivia i record creati durante i test.'}</p>
          </div>
          <div className="admin-header-actions"><a className="admin-public-link" href={edHref('/admin', edition)}>← Dashboard</a></div>
        </header>

        <EditionBar edition={edition} path="/admin/registrations" />

        {notice && <div className="success admin-notice" role="status">{notice}</div>}

        <div className="admin-mini-stats">
          <span><b>{counts.active}</b> attive</span>
          <span><b>{counts.people}</b> {archive ? 'persone' : 'persone prenotate'}</span>
          <span><b>{counts.cancelled}</b> annullate / test</span>
        </div>

        <form className="admin-filters" method="get">
          {archive && <input type="hidden" name="ed" value={edition.id} />}
          <label>Ricerca
            <input name="q" defaultValue={q} placeholder="Nome, email, telefono o codice" />
          </label>
          <label>Vista
            <select name="status" defaultValue={status}>
              <option value="active">Solo attive</option>
              <option value="cancelled">Annullate / test</option>
              <option value="all">Tutte</option>
            </select>
          </label>
          <button type="submit">Cerca</button>
          <a className="admin-reset" href={edHref('/admin/registrations', edition)}>Azzera filtri</a>
          {archive && <a className="admin-reset" href={edHref('/api/admin/export', edition)}>Esporta CSV</a>}
        </form>

        <div className="table-wrap">
          <table className="table registrations-table">
            <thead><tr><th>Codice</th><th>Ospite</th><th>Contatti</th><th>Slot</th><th>Gruppo</th><th>Stato</th><th>Lead</th><th>Azioni</th></tr></thead>
            <tbody>
              {rows.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.registration_code}</strong><br /><small>{r.event_type}</small></td>
                  <td><strong>{r.first_name} {r.last_name}</strong>{r.existing_booking_venue ? <> <span className="pill ok">Cliente</span></> : null}<br /><small>{r.source || 'Fonte non indicata'}</small>{r.existing_booking_venue ? <><br /><small>Evento prenotato: {r.existing_booking_venue}{r.existing_booking_date ? ` · ${r.existing_booking_date}` : ''}</small></> : null}</td>
                  <td>{r.phone}<br /><small>{r.email}</small></td>
                  <td>{r.event_date}<br />{r.start_time.slice(0, 5)}</td>
                  <td>{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}{r.children > 0 ? <><br /><small>{r.children} {r.children === 1 ? 'bambino' : 'bambini'}</small></> : null}</td>
                  <td><span className={`pill ${r.status === 'checked_in' || r.status === 'exited' ? 'ok' : r.status === 'cancelled' ? 'cancelled' : ''}`}>{statusLabel(r.status, edition)}</span></td>
                  <td>
                    <form method="post" action="/api/admin/lead-stage" className="lead-form">
                      <input type="hidden" name="code" value={r.registration_code} />
                      {archive && <input type="hidden" name="ed" value={edition.id} />}
                      <select name="stage" defaultValue={r.lead_stage} aria-label={`Lead ${r.registration_code}`}>
                        {LEAD_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button type="submit">Salva</button>
                    </form>
                  </td>
                  <td><RegistrationActions id={r.id} status={r.status} registrationCode={r.registration_code} qrToken={r.qr_token} archiveEdition={archive ? edition.id : undefined} /></td>
                </tr>
              ))}
              {!rows.rowCount && <tr><td colSpan={8}>Nessuna registrazione per questa vista.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-footnote">
          {archive
            ? <><strong>Archivio in sola lettura:</strong> le registrazioni di questa edizione non si possono modificare, annullare o eliminare. Puoi solo aggiornare lo stato del lead e scaricare il CSV.</>
            : <><strong>Come funziona l’eliminazione:</strong> “Annulla” è la scelta normale per un test: libera la capienza e conserva lo storico. “Elimina definitivamente” compare solo per i record già annullati.</>}
        </div>
      </div>
    </main>
  );
}

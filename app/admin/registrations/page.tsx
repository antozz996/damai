import { query } from '@/lib/db';
import RegistrationActions from './actions';

export const dynamic = 'force-dynamic';

const LEAD_STAGES = [
  ['new', 'Nuovo'],
  ['hot', 'Hot lead'],
  ['potential', 'Potenziale'],
  ['evaluating', 'In valutazione'],
  ['follow_up', 'Follow up'],
  ['long_term', 'Lungo termine'],
  ['won', 'Convertito'],
  ['lost', 'Perso'],
] as const;

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Presente',
  exited: 'Uscito',
  cancelled: 'Annullato',
  no_show: 'No show',
};

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
  const q = first(params.q).trim();
  const status = ['active', 'cancelled', 'all'].includes(first(params.status)) ? first(params.status) : 'active';
  const notice = first(params.saved) === '1' ? 'Modifica salvata correttamente.' : first(params.cancelled) === '1' ? 'Registrazione annullata: lo slot è stato liberato.' : first(params.deleted) === '1' ? 'Record eliminato definitivamente.' : '';

  const countsResult = await query<{ active: string; cancelled: string; people: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COALESCE(SUM(1 + companions) FILTER (WHERE status IN ('registered','checked_in')), 0)::text AS people
    FROM registrations
  `);

  const rows = await query<RegistrationRow>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.phone, r.email, r.event_type, r.planned_event_date::text, r.guest_count,
      r.companions, r.source, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE ($1 = '' OR r.registration_code ILIKE '%' || $1 || '%' OR r.first_name ILIKE '%' || $1 || '%' OR r.last_name ILIKE '%' || $1 || '%' OR r.email ILIKE '%' || $1 || '%' OR r.phone ILIKE '%' || $1 || '%')
      AND ($2 = 'all' OR ($2 = 'active' AND r.status <> 'cancelled') OR ($2 = 'cancelled' AND r.status = 'cancelled'))
    ORDER BY r.created_at DESC
    LIMIT 500
  `, [q, status]);

  const counts = countsResult.rows[0] ?? { active: '0', cancelled: '0', people: '0' };

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-header compact">
          <div>
            <div className="eyebrow">DAMAI · Gestione ospiti</div>
            <h1>Registrazioni</h1>
            <p className="admin-intro">Modifica i dati, sposta una fascia o archivia i record creati durante i test.</p>
          </div>
          <div className="admin-header-actions"><a className="admin-public-link" href="/admin">← Dashboard</a></div>
        </header>

        {notice && <div className="success admin-notice" role="status">{notice}</div>}

        <div className="admin-mini-stats">
          <span><b>{counts.active}</b> attive</span>
          <span><b>{counts.people}</b> persone prenotate</span>
          <span><b>{counts.cancelled}</b> annullate / test</span>
        </div>

        <form className="admin-filters" method="get">
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
          <a className="admin-reset" href="/admin/registrations">Azzera filtri</a>
        </form>

        <div className="table-wrap">
          <table className="table registrations-table">
            <thead><tr><th>Codice</th><th>Ospite</th><th>Contatti</th><th>Slot</th><th>Gruppo</th><th>Stato</th><th>Lead</th><th>Azioni</th></tr></thead>
            <tbody>
              {rows.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.registration_code}</strong><br /><small>{r.event_type}</small></td>
                  <td><strong>{r.first_name} {r.last_name}</strong><br /><small>{r.source || 'Fonte non indicata'}</small></td>
                  <td>{r.phone}<br /><small>{r.email}</small></td>
                  <td>{r.event_date}<br />{r.start_time.slice(0, 5)}</td>
                  <td>{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}</td>
                  <td><span className={`pill ${r.status === 'checked_in' || r.status === 'exited' ? 'ok' : r.status === 'cancelled' ? 'cancelled' : ''}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                  <td>
                    <form method="post" action="/api/admin/lead-stage" className="lead-form">
                      <input type="hidden" name="code" value={r.registration_code} />
                      <select name="stage" defaultValue={r.lead_stage} aria-label={`Lead ${r.registration_code}`}>
                        {LEAD_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button type="submit">Salva</button>
                    </form>
                  </td>
                  <td><RegistrationActions id={r.id} status={r.status} registrationCode={r.registration_code} qrToken={r.qr_token} /></td>
                </tr>
              ))}
              {!rows.rowCount && <tr><td colSpan={8}>Nessuna registrazione per questa vista.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-footnote">
          <strong>Come funziona l’eliminazione:</strong> “Annulla” è la scelta normale per un test: libera la capienza e conserva lo storico. “Elimina definitivamente” compare solo per i record già annullati.
        </div>
      </div>
    </main>
  );
}

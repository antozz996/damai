import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const LEAD_STAGES = [
  ['new','Nuovo'],['hot','Hot lead'],['potential','Potenziale'],['evaluating','In valutazione'],
  ['follow_up','Follow up'],['long_term','Lungo termine'],['won','Convertito'],['lost','Perso'],
] as const;

type Stats = { registrations:string; people:string; checked_in:string; hot:string; marketing:string };
type Row = {
  registration_code:string; qr_token:string; first_name:string; last_name:string; phone:string; email:string;
  event_type:string; planned_event_date:string|null; guest_count:number|null; companions:number; source:string|null;
  status:string; lead_stage:string; event_date:string; start_time:string; created_at:string;
};

export default async function AdminPage() {
  const statsResult = await query<Stats>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS registrations,
      COALESCE(SUM(1 + companions) FILTER (WHERE status <> 'cancelled'),0)::text AS people,
      COUNT(*) FILTER (WHERE status = 'checked_in')::text AS checked_in,
      COUNT(*) FILTER (WHERE lead_stage = 'hot')::text AS hot,
      COUNT(*) FILTER (WHERE marketing_consent = true)::text AS marketing
    FROM registrations
  `);

  const rows = await query<Row>(`
    SELECT r.registration_code, r.qr_token::text, r.first_name, r.last_name, r.phone, r.email,
      r.event_type, r.planned_event_date::text, r.guest_count, r.companions, r.source,
      r.status, r.lead_stage, s.event_date::text, s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    ORDER BY r.created_at DESC
    LIMIT 500
  `);
  const s = statsResult.rows[0] ?? {registrations:'0',people:'0',checked_in:'0',hot:'0',marketing:'0'};

  return (
    <main className="admin">
      <div className="admin-inner">
        <div className="eyebrow">DAMAI · Area staff</div>
        <h1>Open Days 2026</h1>
        <div className="stats">
          <div className="stat"><b>{s.registrations}</b><span>Registrazioni</span></div>
          <div className="stat"><b>{s.people}</b><span>Persone attese</span></div>
          <div className="stat"><b>{s.checked_in}</b><span>Check-in</span></div>
          <div className="stat"><b>{s.hot}</b><span>Hot lead</span></div>
          <div className="stat"><b>{s.marketing}</b><span>Consensi marketing</span></div>
        </div>
        <div className="toolbar">
          <a href="/admin/checkin">Scanner QR ingresso</a>
          <a href="/admin/emails">Test email</a>
          <a href="/api/admin/export">Esporta CSV</a>
          <a href="/api/slots" target="_blank">Disponibilità live</a>
          <a href="/">Apri landing</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Codice</th><th>Ospite</th><th>Contatti</th><th>Evento</th><th>Data evento</th><th>Open Day</th><th>Party</th><th>Stato</th><th>Lead</th><th>Check-in</th></tr></thead>
            <tbody>
              {rows.rows.map(r => (
                <tr key={r.registration_code}>
                  <td>{r.registration_code}</td>
                  <td><strong>{r.first_name} {r.last_name}</strong><br/><small>{r.source || '—'}</small></td>
                  <td>{r.phone}<br/><small>{r.email}</small></td>
                  <td>{r.event_type}<br/><small>{r.guest_count ? `${r.guest_count} ospiti previsti` : '—'}</small></td>
                  <td>{r.planned_event_date || '—'}</td>
                  <td>{r.event_date}<br/>{r.start_time.slice(0,5)}</td>
                  <td>{1 + r.companions}</td>
                  <td><span className={`pill ${r.status === 'checked_in' ? 'ok' : ''}`}>{r.status}</span></td>
                  <td>
                    <form method="post" action="/api/admin/lead-stage" style={{display:'flex',gap:6}}>
                      <input type="hidden" name="code" value={r.registration_code}/>
                      <select name="stage" defaultValue={r.lead_stage} style={{minWidth:125}}>
                        {LEAD_STAGES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button type="submit">Salva</button>
                    </form>
                  </td>
                  <td><a href={`/admin/checkin/${r.qr_token}`}>{r.status === 'checked_in' ? 'Apri' : 'Registra'}</a></td>
                </tr>
              ))}
              {!rows.rowCount && <tr><td colSpan={10}>Nessuna registrazione ancora.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

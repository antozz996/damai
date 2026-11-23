import { query } from '@/lib/db';
import { edHref, leadStageLabel, LEAD_STAGES, type Edition } from '@/lib/event';
import EditionBar from './edition-bar';

type Stats = {
  active: string;
  people: string;
  entered: string;
  entered_people: string;
  exited: string;
  cadeau: string;
  not_arrived: string;
  no_show: string;
  cancelled: string;
  walk_in_total: string;
  children: string;
  customers: string;
};

type SlotRow = {
  id: string;
  event_date: string;
  start_time: string;
  capacity: number;
  registrations: string;
  people: string;
  entered_people: string;
  exited: string;
  cadeau: string;
  no_show: string;
};

const EMPTY: Stats = {
  active: '0', people: '0', entered: '0', entered_people: '0', exited: '0', cadeau: '0',
  not_arrived: '0', no_show: '0', cancelled: '0', walk_in_total: '0', children: '0', customers: '0',
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

/** Dashboard di un'edizione conclusa: solo lettura, con gli stati storici (uscite, cadeau, no-show). */
export default async function ArchiveDashboard({ edition }: { edition: Edition }) {
  const statsResult = await query<Stats>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COALESCE(SUM(1 + companions) FILTER (WHERE status <> 'cancelled'), 0)::text AS people,
      COUNT(*) FILTER (WHERE status IN ('checked_in','exited'))::text AS entered,
      COALESCE(SUM(1 + companions) FILTER (WHERE status IN ('checked_in','exited')), 0)::text AS entered_people,
      COUNT(*) FILTER (WHERE status = 'exited' OR (status <> 'cancelled' AND checked_out_at IS NOT NULL))::text AS exited,
      COUNT(*) FILTER (WHERE status <> 'cancelled' AND cadeau_delivered_at IS NOT NULL)::text AS cadeau,
      COUNT(*) FILTER (WHERE status = 'registered')::text AS not_arrived,
      COUNT(*) FILTER (WHERE status = 'no_show')::text AS no_show,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status <> 'cancelled')::text AS walk_in_total,
      COALESCE(SUM(children) FILTER (WHERE status <> 'cancelled'), 0)::text AS children,
      COUNT(*) FILTER (WHERE existing_booking_venue IS NOT NULL AND status <> 'cancelled')::text AS customers
    FROM registrations
    WHERE edition = $1
  `, [edition.id]);

  const leadResult = await query<{ lead_stage: string; total: string }>(`
    SELECT lead_stage, COUNT(*)::text AS total
    FROM registrations
    WHERE edition = $1 AND status <> 'cancelled'
    GROUP BY lead_stage
  `, [edition.id]);

  const slotsResult = await query<SlotRow>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity,
      COUNT(r.id)::text AS registrations,
      COALESCE(SUM(1 + r.companions), 0)::text AS people,
      COALESCE(SUM(1 + r.companions) FILTER (WHERE r.status IN ('checked_in','exited')), 0)::text AS entered_people,
      COUNT(r.id) FILTER (WHERE r.status = 'exited' OR r.checked_out_at IS NOT NULL)::text AS exited,
      COUNT(r.id) FILTER (WHERE r.cadeau_delivered_at IS NOT NULL)::text AS cadeau,
      COUNT(r.id) FILTER (WHERE r.status = 'no_show')::text AS no_show
    FROM open_day_slots s
    LEFT JOIN registrations r ON r.slot_id = s.id AND r.status <> 'cancelled'
    WHERE s.edition = $1
    GROUP BY s.id
    ORDER BY s.event_date, s.start_time
  `, [edition.id]);

  const s = statsResult.rows[0] ?? EMPTY;
  const hasCadeau = Number(s.cadeau) > 0;
  const leadCounts = new Map(leadResult.rows.map((row) => [row.lead_stage, Number(row.total)]));
  const knownStages = new Set<string>(LEAD_STAGES.map(([value]) => value));
  const leadRows = [
    ...LEAD_STAGES.map(([value]) => ({ stage: value as string, total: leadCounts.get(value) ?? 0 })),
    ...leadResult.rows.filter((row) => !knownStages.has(row.lead_stage)).map((row) => ({ stage: row.lead_stage, total: Number(row.total) })),
  ];
  const leadMax = Math.max(1, ...leadRows.map((row) => row.total));
  const days = [...new Set(slotsResult.rows.map((slot) => slot.event_date))];
  const sum = (rows: SlotRow[], key: 'registrations' | 'people' | 'entered_people' | 'exited' | 'cadeau' | 'no_show') =>
    rows.reduce((total, row) => total + Number(row[key]), 0);
  const columns = hasCadeau ? 8 : 7;

  const links = [
    { href: edHref('/admin/registrations', edition), eyebrow: 'Ospiti e lead', title: 'Registrazioni', text: 'Consulta le schede e aggiorna lo stato dei lead.', tone: 'navy' },
    { href: edHref('/admin/slots/overview', edition), eyebrow: 'Presenze', title: 'Prenotati per slot', text: 'Nominativi per giorno e fascia.', tone: 'cream' },
    { href: edHref('/admin/slots', edition), eyebrow: 'Storico', title: 'Fasce orarie', text: 'Capienze e prenotati di ogni fascia.', tone: 'cream' },
    { href: edHref('/api/admin/export', edition), eyebrow: 'Dati', title: 'Esporta CSV', text: 'Elenco completo con uscite, cadeau e lead.', tone: 'gold' },
  ];

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-header">
          <div>
            <div className="eyebrow">DAMAI · Area staff · Archivio</div>
            <h1>{edition.name}</h1>
            <p className="admin-intro">{edition.datesLabel}. Edizione conclusa: i dati restano consultabili per il seguito commerciale.</p>
          </div>
        </header>

        <EditionBar edition={edition} path="/admin" />

        <section className="stats admin-stats" aria-label="Riepilogo edizione">
          <div className="stat"><b>{s.active}</b><span>Registrazioni</span></div>
          <div className="stat"><b>{s.people}</b><span>Persone registrate</span></div>
          <div className="stat"><b>{s.entered_people}</b><span>Persone entrate ({s.entered} registrazioni)</span></div>
          <div className="stat"><b>{s.exited}</b><span>Uscite registrate</span></div>
          {hasCadeau && <div className="stat"><b>{s.cadeau}</b><span>Cadeau consegnati</span></div>}
          <div className="stat"><b>{s.no_show}</b><span>No show</span></div>
          {Number(s.not_arrived) > 0 && <div className="stat"><b>{s.not_arrived}</b><span>Mai arrivati (ancora «registrato»)</span></div>}
          {Number(s.walk_in_total) > 0 && <div className="stat"><b>{s.walk_in_total}</b><span>Walk-In</span></div>}
          {Number(s.children) > 0 && <div className="stat"><b>{s.children}</b><span>Bambini registrati</span></div>}
          {Number(s.customers) > 0 && <div className="stat"><b>{s.customers}</b><span>Clienti (evento già prenotato)</span></div>}
          <div className="stat muted-stat"><b>{s.cancelled}</b><span>Annullati / test</span></div>
        </section>

        <section aria-labelledby="lead-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Seguito commerciale</div>
              <h2 id="lead-title">Distribuzione dei lead</h2>
            </div>
            <a className="admin-text-link" href={edHref('/admin/registrations', edition)}>Aggiorna i lead →</a>
          </div>
          <div className="lead-bars">
            {leadRows.map((row) => (
              <div className="lead-bar" key={row.stage}>
                <b>{row.total}</b>
                <span>{leadStageLabel(row.stage)}</span>
                <i><em style={{ width: `${Math.round((row.total / leadMax) * 100)}%` }} /></i>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-recent" aria-labelledby="slots-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Annullati esclusi</div>
              <h2 id="slots-title">Conteggi per giorno e fascia</h2>
            </div>
            <a className="admin-text-link" href={edHref('/admin/slots/overview', edition)}>Vedi i nominativi →</a>
          </div>
          <div className="table-wrap">
            <table className="table admin-recent-table">
              <thead>
                <tr><th>Giorno</th><th>Fascia</th><th>Registrazioni</th><th>Persone</th><th>Persone entrate</th><th>Uscite</th>{hasCadeau && <th>Cadeau</th>}<th>No show</th></tr>
              </thead>
              {days.map((day) => {
                const daySlots = slotsResult.rows.filter((slot) => slot.event_date === day);
                return (
                  <tbody key={day}>
                    <tr className="day-total">
                      <td>{dateLabel(day)}</td>
                      <td>Totale giorno</td>
                      <td>{sum(daySlots, 'registrations')}</td>
                      <td>{sum(daySlots, 'people')}</td>
                      <td>{sum(daySlots, 'entered_people')}</td>
                      <td>{sum(daySlots, 'exited')}</td>
                      {hasCadeau && <td>{sum(daySlots, 'cadeau')}</td>}
                      <td>{sum(daySlots, 'no_show')}</td>
                    </tr>
                    {daySlots.map((slot) => (
                      <tr key={slot.id}>
                        <td>{slot.event_date}</td>
                        <td><strong>{slot.start_time.slice(0, 5)}</strong></td>
                        <td>{slot.registrations}</td>
                        <td>{slot.people} / {slot.capacity}</td>
                        <td>{slot.entered_people}</td>
                        <td>{slot.exited}</td>
                        {hasCadeau && <td>{slot.cadeau}</td>}
                        <td>{slot.no_show}</td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
              {!days.length && <tbody><tr><td colSpan={columns}>Nessuna fascia per questa edizione.</td></tr></tbody>}
            </table>
          </div>
        </section>

        <section className="admin-recent" aria-labelledby="archive-tools-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Consultazione</div>
              <h2 id="archive-tools-title">Strumenti dell’archivio</h2>
            </div>
          </div>
          <nav className="admin-command-grid" aria-label="Funzioni di consultazione">
            {links.map((link) => (
              <a className={`admin-command-card ${link.tone}`} href={link.href} key={link.href}>
                <span className="admin-command-eyebrow">{link.eyebrow}</span>
                <strong>{link.title}</strong>
                <span>{link.text}</span>
                <b aria-hidden="true">→</b>
              </a>
            ))}
          </nav>
        </section>

        <div className="admin-footnote">
          Archivio in sola lettura: scanner, walk-in, modifiche, annullamenti, reinvio email e capienze sono disattivati per questa edizione. Resta modificabile solo lo stato del lead.
        </div>
      </div>
    </main>
  );
}

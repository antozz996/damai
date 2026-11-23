import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Entrato',
  exited: 'Entrato',
  cancelled: 'Annullato',
  no_show: 'No show',
};

type Stats = {
  active: string;
  people: string;
  entered: string;
  entered_people: string;
  children: string;
  cancelled: string;
  hot: string;
  walk_in_total: string;
  customers: string;
};

type SlotRow = {
  id: string;
  event_date: string;
  start_time: string;
  capacity: number;
  is_active: boolean;
  registrations: string;
  people: string;
  entered: string;
  children: string;
};

type Row = {
  id: string;
  registration_code: string;
  qr_token: string;
  first_name: string;
  last_name: string;
  email: string;
  companions: number;
  children: number;
  status: string;
  lead_stage: string;
  existing_booking_venue: string | null;
  event_date: string;
  start_time: string;
  created_at: string;
};

const quickLinks = [
  {
    href: '/admin/walk-in',
    eyebrow: 'Desk accoglienza',
    title: 'Registra Walk-In',
    text: 'Accoglienza ospiti non prenotati e ricerca.',
    tone: 'gold',
  },
  {
    href: '/admin/checkin',
    eyebrow: 'Accoglienza',
    title: 'Scanner QR',
    text: 'Registra l’ingresso degli ospiti dal QR del biglietto.',
    tone: 'navy',
  },
  {
    href: '/admin/registrations',
    eyebrow: 'Gestione ospiti',
    title: 'Registrazioni',
    text: 'Cerca, modifica, annulla o archivia i test.',
    tone: 'cream',
  },
  {
    href: '/admin/slots',
    eyebrow: 'Configurazione',
    title: 'Fasce orarie',
    text: 'Capienza e disponibilità delle fasce.',
    tone: 'cream',
  },
  {
    href: '/admin/slots/overview',
    eyebrow: 'Controllo presenze',
    title: 'Prenotati per slot',
    text: 'Vedi conteggio e nominativi per giorno e orario.',
    tone: 'cream',
  },
  {
    href: '/admin/emails',
    eyebrow: 'Comunicazioni',
    title: 'Test email',
    text: 'Prova i tre template con i dati che vuoi.',
    tone: 'cream',
  },
  {
    href: '/api/admin/export',
    eyebrow: 'Dati',
    title: 'Esporta CSV',
    text: 'Scarica l’elenco aggiornato per il team.',
    tone: 'cream',
  },
  {
    href: EVENT.publicPageUrl,
    eyebrow: 'Pubblico',
    title: 'Apri il sito',
    text: 'Controlla la pagina che vedono gli ospiti.',
    tone: 'cream',
  },
];

export default async function AdminPage() {
// Capienza: contano le registrazioni attive (registrate + già entrate).
  const statsResult = await query<Stats>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COALESCE(SUM(1 + companions) FILTER (WHERE status IN ('registered','checked_in')), 0)::text AS people,
      COUNT(*) FILTER (WHERE status = 'checked_in')::text AS entered,
      COALESCE(SUM(1 + companions) FILTER (WHERE status = 'checked_in'), 0)::text AS entered_people,
      COALESCE(SUM(children) FILTER (WHERE status <> 'cancelled'), 0)::text AS children,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COUNT(*) FILTER (WHERE lead_stage = 'hot' AND status <> 'cancelled')::text AS hot,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status <> 'cancelled')::text AS walk_in_total,
      COUNT(*) FILTER (WHERE existing_booking_venue IS NOT NULL AND status <> 'cancelled')::text AS customers
    FROM registrations
    WHERE edition = $1
  `, [EVENT.edition]);

  const slotsResult = await query<SlotRow>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity, s.is_active,
      COUNT(r.id)::text AS registrations,
      COALESCE(SUM(1 + r.companions), 0)::text AS people,
      COALESCE(SUM(1 + r.companions) FILTER (WHERE r.status = 'checked_in'), 0)::text AS entered,
      COALESCE(SUM(r.children), 0)::text AS children
    FROM open_day_slots s
    LEFT JOIN registrations r ON r.slot_id = s.id AND r.status IN ('registered','checked_in')
    WHERE s.edition = $1
    GROUP BY s.id
    ORDER BY s.event_date, s.start_time
  `, [EVENT.edition]);

  const rows = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.email, r.companions, r.children, r.status, r.lead_stage, r.existing_booking_venue, s.event_date::text,
      s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.edition = $1
    ORDER BY r.created_at DESC
    LIMIT 8
  `, [EVENT.edition]);

const s = statsResult.rows[0] ?? {
    active: '0', people: '0', entered: '0', entered_people: '0', children: '0',
    cancelled: '0', hot: '0', walk_in_total: '0', customers: '0',
  };
  const slots = slotsResult.rows.map((slot) => {
    const people = Number(slot.people);
    const entered = Number(slot.entered);
    return { ...slot, people, entered, toArrive: people - entered, remaining: Math.max(0, slot.capacity - people) };
  });
  const remainingTotal = slots.filter((slot) => slot.is_active).reduce((sum, slot) => sum + slot.remaining, 0);
  const toArriveTotal = Number(s.people) - Number(s.entered_people);

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-header">
          <div>
            <div className="eyebrow">DAMAI · Area staff</div>
            <h1>{EVENT.name}</h1>
            <p className="admin-intro">{EVENT.datesLabel}, {EVENT.hoursLabel}. Il centro di comando per ospiti, fasce orarie, QR ed email.</p>
          </div>
          <div className="admin-header-actions">
            <a className="admin-public-link" href={EVENT.publicPageUrl} target="_blank" rel="noreferrer">
              Pagina pubblica ↗
            </a>
          </div>
        </header>

        <section className="stats admin-stats" aria-label="Riepilogo registrazioni">
          <div className="stat"><b>{s.active}</b><span>Registrazioni</span></div>
          <div className="stat"><b>{s.people}</b><span>Persone registrate</span></div>
          <div className="stat"><b>{s.entered_people}</b><span>Ingressi effettuati ({s.entered} registrazioni)</span></div>
          <div className="stat"><b>{toArriveTotal}</b><span>Persone da arrivare</span></div>
          <div className="stat"><b>{s.children}</b><span>Bambini registrati</span></div>
          <div className="stat"><b>{remainingTotal}</b><span>Posti residui</span></div>
          <div className="stat" style={{ borderLeft: '3px solid var(--gold)' }}>
            <b style={{ color: 'var(--gold)' }}>{s.walk_in_total}</b>
            <span>Walk-In</span>
          </div>
          <div className="stat"><b>{s.customers}</b><span>Clienti (evento già prenotato)</span></div>
          <div className="stat"><b>{s.hot}</b><span>Hot lead</span></div>
          <div className="stat muted-stat"><b>{s.cancelled}</b><span>Annullati / test</span></div>
        </section>

        <section className="admin-recent" aria-labelledby="slots-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">{EVENT.slotCapacity} persone per fascia · {EVENT.visitLabel}</div>
              <h2 id="slots-title">Persone per giorno e fascia</h2>
            </div>
            <a className="admin-text-link" href="/admin/slots/overview">Vedi i nominativi →</a>
          </div>
          <div className="table-wrap">
            <table className="table admin-recent-table">
              <thead>
                <tr><th>Giorno</th><th>Fascia</th><th>Registrazioni</th><th>Persone</th><th>Entrate</th><th>Da arrivare</th><th>Bambini</th><th>Posti residui</th></tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{slot.event_date}</td>
                    <td><strong>{slot.start_time.slice(0, 5)}</strong>{!slot.is_active ? ' · non attiva' : ''}</td>
                    <td>{slot.registrations}</td>
                    <td>{slot.people} / {slot.capacity}</td>
                    <td>{slot.entered}</td>
                    <td>{slot.toArrive}</td>
                    <td>{slot.children}</td>
                    <td>{slot.remaining === 0 ? <span className="pill cancelled">Completo</span> : slot.remaining}</td>
                  </tr>
                ))}
                {!slots.length && <tr><td colSpan={8}>Nessuna fascia configurata.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="admin-functions-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Strumenti</div>
              <h2 id="admin-functions-title">Tutto quello che serve, in un punto solo</h2>
            </div>
            <a className="admin-text-link" href="/admin/registrations">Vedi elenco completo →</a>
          </div>
          <nav className="admin-command-grid" aria-label="Funzioni amministrative">
            {quickLinks.map((link) => (
              <a className={`admin-command-card ${link.tone}`} href={link.href} key={link.href}>
                <span className="admin-command-eyebrow">{link.eyebrow}</span>
                <strong>{link.title}</strong>
                <span>{link.text}</span>
                <b aria-hidden="true">→</b>
              </a>
            ))}
          </nav>
        </section>

        <section className="admin-recent" aria-labelledby="recent-title">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Ultime arrivate</div>
              <h2 id="recent-title">Registrazioni recenti</h2>
            </div>
            <a className="admin-text-link" href="/admin/registrations">Gestisci registrazioni →</a>
          </div>
          <div className="table-wrap">
            <table className="table admin-recent-table">
              <thead>
                <tr><th>Codice</th><th>Ospite</th><th>Slot</th><th>Gruppo</th><th>Stato</th><th>Azioni</th></tr>
              </thead>
              <tbody>
                {rows.rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.registration_code}</strong><br /><small>{r.email}</small></td>
                    <td>{r.first_name} {r.last_name}{r.existing_booking_venue ? <> <span className="pill ok">Cliente</span></> : null}</td>
                    <td>{r.event_date}<br />{r.start_time.slice(0, 5)}</td>
                    <td>{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}{r.children > 0 ? ` · ${r.children} ${r.children === 1 ? 'bambino' : 'bambini'}` : ''}</td>
                    <td><span className={`pill ${r.status === 'checked_in' || r.status === 'exited' ? 'ok' : r.status === 'cancelled' ? 'cancelled' : ''}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                    <td><a className="admin-table-link" href={`/admin/registrations/${r.id}`}>Apri scheda →</a></td>
                  </tr>
                ))}
                {!rows.rowCount && <tr><td colSpan={6}>Nessuna registrazione ancora.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="admin-footnote">
          Le registrazioni annullate non contano nelle disponibilità e restano nello storico finché non scegli di eliminarle definitivamente.
        </div>
      </div>
    </main>
  );
}

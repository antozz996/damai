import { query } from '@/lib/db';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrato',
  checked_in: 'Presente',
  exited: 'Uscito',
  cancelled: 'Annullato',
  no_show: 'No show',
};

type Stats = {
  active: string;
  people: string;
  entries: string;
  exits: string;
  present: string;
  children: string;
  children_present: string;
  cancelled: string;
  hot: string;
  walk_in_total: string;
  walk_in_present: string;
  walk_in_exited: string;
  cadeau_delivered: string;
  walk_in_contacts: string;
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
    text: EVENT.features.gift ? 'Ingresso, uscita e consegna cadeau.' : 'Ingresso e uscita degli ospiti.',
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
  const statsResult = await query<Stats>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COALESCE(SUM(1 + companions) FILTER (WHERE status IN ('registered','checked_in')), 0)::text AS people,
      COALESCE(SUM(1 + companions) FILTER (WHERE checked_in_at IS NOT NULL AND status <> 'cancelled'), 0)::text AS entries,
      COALESCE(SUM(1 + companions) FILTER (WHERE status = 'exited'), 0)::text AS exits,
      COALESCE(SUM(1 + companions) FILTER (WHERE status = 'checked_in'), 0)::text AS present,
      COALESCE(SUM(children) FILTER (WHERE status <> 'cancelled'), 0)::text AS children,
      COALESCE(SUM(children) FILTER (WHERE status = 'checked_in'), 0)::text AS children_present,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COUNT(*) FILTER (WHERE lead_stage = 'hot' AND status <> 'cancelled')::text AS hot,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status <> 'cancelled')::text AS walk_in_total,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status = 'checked_in')::text AS walk_in_present,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status = 'exited')::text AS walk_in_exited,
      COUNT(*) FILTER (WHERE cadeau_delivered_at IS NOT NULL)::text AS cadeau_delivered,
      COUNT(*) FILTER (
        WHERE registration_mode = 'walk_in'
          AND status <> 'cancelled'
          AND email NOT LIKE '%@no-email.damai.local'
      )::text AS walk_in_contacts
    FROM registrations
    WHERE edition = $1
  `, [EVENT.edition]);

  const rows = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.email, r.companions, r.children, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    WHERE r.edition = $1
    ORDER BY r.created_at DESC
    LIMIT 8
  `, [EVENT.edition]);

  const s = statsResult.rows[0] ?? {
    active: '0',
    people: '0',
    entries: '0',
    exits: '0',
    present: '0',
    children: '0',
    children_present: '0',
    cancelled: '0',
    hot: '0',
    walk_in_total: '0',
    walk_in_present: '0',
    walk_in_exited: '0',
    cadeau_delivered: '0',
    walk_in_contacts: '0',
  };

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
          <div className="stat"><b>{s.active}</b><span>Registrazioni totali</span></div>
          <div className="stat"><b>{s.people}</b><span>Persone attese</span></div>
          <div className="stat"><b>{s.entries}</b><span>Ingressi (persone)</span></div>
          <div className="stat"><b>{s.exits}</b><span>Uscite (persone)</span></div>
          <div className="stat"><b>{s.present}</b><span>Presenti ora</span></div>
          <div className="stat"><b>{s.children}</b><span>Bambini registrati ({s.children_present} presenti)</span></div>
          {EVENT.features.gift && <div className="stat"><b>{s.cadeau_delivered}</b><span>Cadeau consegnati</span></div>}
          <div className="stat" style={{ borderLeft: '3px solid var(--gold)' }}>
            <b style={{ color: 'var(--gold)' }}>{s.walk_in_total}</b>
            <span>Walk-In ({s.walk_in_present} ora)</span>
          </div>
          <div className="stat"><b>{s.hot}</b><span>Hot lead</span></div>
          <div className="stat muted-stat"><b>{s.cancelled}</b><span>Annullati / test</span></div>
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
              <div className="eyebrow">Ultimi ingressi</div>
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
                    <td>{r.first_name} {r.last_name}</td>
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

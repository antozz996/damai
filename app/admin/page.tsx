import { query } from '@/lib/db';

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
  checked_in: string;
  exited: string;
  cancelled: string;
  hot: string;
};

type Row = {
  id: string;
  registration_code: string;
  qr_token: string;
  first_name: string;
  last_name: string;
  email: string;
  companions: number;
  status: string;
  lead_stage: string;
  event_date: string;
  start_time: string;
  created_at: string;
};

const quickLinks = [
  {
    href: '/admin/registrations',
    eyebrow: 'Gestione ospiti',
    title: 'Registrazioni',
    text: 'Cerca, modifica, annulla o archivia i test.',
    tone: 'navy',
  },
  {
    href: '/admin/checkin',
    eyebrow: 'Accoglienza',
    title: 'Scanner QR',
    text: 'Ingresso, uscita e consegna cadeau.',
    tone: 'gold',
  },
  {
    href: '/admin/slots',
    eyebrow: 'Configurazione',
    title: 'Fasce orarie',
    text: 'Capienza e disponibilità dei 33 slot.',
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
    href: 'https://www.damaigarden.it/open-days',
    eyebrow: 'Pubblico',
    title: 'Apri il sito',
    text: 'Controlla la pagina che vedono gli ospiti.',
    tone: 'cream',
  },
] as const;

export default async function AdminPage() {
  const statsResult = await query<Stats>(`
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::text AS active,
      COALESCE(SUM(1 + companions) FILTER (WHERE status IN ('registered','checked_in')), 0)::text AS people,
      COUNT(*) FILTER (WHERE status = 'checked_in')::text AS checked_in,
      COUNT(*) FILTER (WHERE status = 'exited')::text AS exited,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
      COUNT(*) FILTER (WHERE lead_stage = 'hot' AND status <> 'cancelled')::text AS hot
    FROM registrations
  `);

  const rows = await query<Row>(`
    SELECT r.id::text, r.registration_code, r.qr_token::text, r.first_name, r.last_name,
      r.email, r.companions, r.status, r.lead_stage, s.event_date::text,
      s.start_time::text, r.created_at::text
    FROM registrations r
    JOIN open_day_slots s ON s.id = r.slot_id
    ORDER BY r.created_at DESC
    LIMIT 8
  `);

  const s = statsResult.rows[0] ?? {
    active: '0',
    people: '0',
    checked_in: '0',
    exited: '0',
    cancelled: '0',
    hot: '0',
  };

  return (
    <main className="admin">
      <div className="admin-inner">
        <header className="admin-header">
          <div>
            <div className="eyebrow">DAMAI · Area staff</div>
            <h1>Open Days 2026</h1>
            <p className="admin-intro">Il centro di comando per ospiti, fasce orarie, QR ed email.</p>
          </div>
          <div className="admin-header-actions">
            <a className="admin-public-link" href="https://www.damaigarden.it/open-days" target="_blank" rel="noreferrer">
              Pagina pubblica ↗
            </a>
          </div>
        </header>

        <section className="stats admin-stats" aria-label="Riepilogo registrazioni">
          <div className="stat"><b>{s.active}</b><span>Registrazioni attive</span></div>
          <div className="stat"><b>{s.people}</b><span>Persone attese</span></div>
          <div className="stat"><b>{s.checked_in}</b><span>Presenti ora</span></div>
          <div className="stat"><b>{s.exited}</b><span>Usciti</span></div>
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
                    <td>{1 + r.companions} {1 + r.companions === 1 ? 'persona' : 'persone'}</td>
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

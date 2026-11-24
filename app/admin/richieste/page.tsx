import { query } from '@/lib/db';
import { normalizeMetaPhone } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';

/** Richieste arrivate dal form contatti di damaigarden.it (tabella contact_requests). */
type Row = {
  id: string; created: string; name: string; phone: string; email: string | null;
  event_type: string; event_date: string | null; guests: number | null; details: string | null;
  locale: string; ref: string | null; source: string | null; status: string;
};

const STATUS_LABEL: Record<string, string> = { new: 'Da contattare', contacted: 'Contattato', closed: 'Chiusa' };

export default async function ContactRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const showAll = sp.tutte === '1';
  const result = await query<Row>(`
    SELECT id::text, to_char(created_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI') AS created,
      name, phone, email, event_type, event_date, guests, details, locale, ref, source, status
    FROM contact_requests
    ${showAll ? '' : "WHERE status = 'new'"}
    ORDER BY created_at DESC
    LIMIT 300
  `).catch(() => ({ rows: [] as Row[], rowCount: 0 }));

  return (
    <main className="admin"><div className="admin-inner">
      <div className="eyebrow">DAMAI · Area staff</div>
      <h1>Richieste dal sito</h1>
      <p className="admin-intro">
        Chi compila il form di damaigarden.it apre WhatsApp con il messaggio pronto; qui trovi una copia di ogni richiesta,
        anche di chi poi non ha premuto &quot;invia&quot; su WhatsApp. Segna &quot;Contattato&quot; quando l&apos;hai richiamato.
      </p>
      <div className="toolbar">
        <a href="/admin">← Dashboard</a>
        {showAll ? <a href="/admin/richieste">Solo da contattare</a> : <a href="/admin/richieste?tutte=1">Mostra tutte</a>}
      </div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Arrivata</th><th>Nome</th><th>Contatti</th><th>Evento</th><th>Dettagli</th><th>Stato</th></tr></thead>
        <tbody>
          {result.rows.map(r => {
            const wa = normalizeMetaPhone(r.phone);
            return (
              <tr key={r.id}>
                <td>{r.created}</td>
                <td><b>{r.name}</b>{r.locale === 'en' ? ' (EN)' : ''}</td>
                <td>
                  <a href={`tel:${r.phone}`}>{r.phone}</a>
                  {wa && <> · <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></>}
                  {r.email && <><br /><a href={`mailto:${r.email}`}>{r.email}</a></>}
                </td>
                <td>{r.event_type}{r.event_date ? ` · ${r.event_date}` : ''}{r.guests ? ` · ${r.guests} ospiti` : ''}</td>
                <td style={{ maxWidth: 360 }}>{r.details || '—'}{r.source ? <><br /><small>Fonte: {r.source}</small></> : null}</td>
                <td>
                  <form method="post" action="/api/admin/contact-requests" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} style={{ padding: 6 }}>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="submit">Salva</button>
                  </form>
                </td>
              </tr>
            );
          })}
          {!result.rowCount && <tr><td colSpan={6}>{showAll ? 'Nessuna richiesta.' : 'Nessuna richiesta da contattare.'}</td></tr>}
        </tbody>
      </table></div>
    </div></main>
  );
}

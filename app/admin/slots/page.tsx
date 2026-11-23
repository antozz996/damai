import { query } from '@/lib/db';
import { edHref, resolveEdition } from '@/lib/event';
import EditionBar from '../edition-bar';

export const dynamic = 'force-dynamic';

type Slot = { id:string; event_date:string; start_time:string; capacity:number; is_active:boolean; used:string };

export default async function SlotAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const edition = resolveEdition((await searchParams).ed);
  const archive = !edition.current;
  const result = await query<Slot>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity, s.is_active,
      COALESCE(SUM(CASE WHEN r.status = ANY($2::text[]) THEN (1+r.companions) ELSE 0 END),0)::text AS used
    FROM open_day_slots s LEFT JOIN registrations r ON r.slot_id=s.id
    WHERE s.edition=$1
    GROUP BY s.id ORDER BY s.event_date,s.start_time
  `, [edition.id, edition.activeStatuses]);
  return (
    <main className="admin"><div className="admin-inner">
      <div className="eyebrow">DAMAI · Configurazione{archive ? ' · Archivio' : ''}</div>
      <h1>Fasce di ingresso · {edition.shortName}</h1>
      <EditionBar edition={edition} path="/admin/slots" />
      <div className="toolbar"><a href={edHref('/admin', edition)}>← Dashboard</a><a href={edHref('/admin/slots/overview', edition)}>Prenotati per slot</a>{!archive && <a href="/api/slots" target="_blank">Vista pubblica</a>}</div>
      <div className="table-wrap"><table className="table">
        {archive
          ? <thead><tr><th>Giorno</th><th>Ora</th><th>Persone</th><th>Capienza</th><th>Stato</th></tr></thead>
          : <thead><tr><th>Giorno</th><th>Ora</th><th>Prenotati</th><th>Capienza</th><th>Stato</th><th>Aggiorna</th></tr></thead>}
        <tbody>{result.rows.map(s => archive ? (
          <tr key={s.id}>
            <td>{s.event_date}</td><td>{s.start_time.slice(0,5)}</td><td>{s.used}</td><td>{s.capacity}</td>
            <td>{s.is_active ? 'Attiva' : 'Non attiva'}</td>
          </tr>
        ) : (
          <tr key={s.id}>
            <td>{s.event_date}</td><td>{s.start_time.slice(0,5)}</td><td>{s.used}</td>
            <td colSpan={3}>
              <form method="post" action="/api/admin/slots" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <input type="hidden" name="id" value={s.id}/>
                <input type="number" name="capacity" min={Math.max(1,Number(s.used))} max="500" defaultValue={s.capacity} style={{width:90,padding:8}}/>
                <label style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" name="isActive" defaultChecked={s.is_active}/> Attivo</label>
                <button type="submit">Salva</button>
              </form>
            </td>
          </tr>
        ))}
        {!result.rowCount && <tr><td colSpan={archive ? 5 : 6}>Nessuna fascia configurata.</td></tr>}</tbody>
      </table></div>
    </div></main>
  );
}

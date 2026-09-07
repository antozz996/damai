import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Slot = { id:string; event_date:string; start_time:string; capacity:number; is_active:boolean; used:string };

export default async function SlotAdminPage() {
  const result = await query<Slot>(`
    SELECT s.id::text, s.event_date::text, s.start_time::text, s.capacity, s.is_active,
      COALESCE(SUM(CASE WHEN r.status IN ('registered','checked_in') THEN (1+r.companions) ELSE 0 END),0)::text AS used
    FROM open_day_slots s LEFT JOIN registrations r ON r.slot_id=s.id
    GROUP BY s.id ORDER BY s.event_date,s.start_time
  `);
  return (
    <main className="admin"><div className="admin-inner">
      <div className="eyebrow">DAMAI · Configurazione</div>
      <h1>Fasce di ingresso</h1>
      <div className="toolbar"><a href="/admin">← Dashboard</a><a href="/api/slots" target="_blank">Vista pubblica</a></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Giorno</th><th>Ora</th><th>Prenotati</th><th>Capienza</th><th>Stato</th><th>Aggiorna</th></tr></thead>
        <tbody>{result.rows.map(s => <tr key={s.id}>
          <td>{s.event_date}</td><td>{s.start_time.slice(0,5)}</td><td>{s.used}</td>
          <td colSpan={3}>
            <form method="post" action="/api/admin/slots" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <input type="hidden" name="id" value={s.id}/>
              <input type="number" name="capacity" min={Math.max(1,Number(s.used))} max="500" defaultValue={s.capacity} style={{width:90,padding:8}}/>
              <label style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" name="isActive" defaultChecked={s.is_active}/> Attivo</label>
              <button type="submit">Salva</button>
            </form>
          </td>
        </tr>)}</tbody>
      </table></div>
    </div></main>
  );
}

import Link from 'next/link';
import { query } from '@/lib/db';
import WalkInStaffForm from './walk-in-staff-form';

export const dynamic = 'force-dynamic';

type WalkInStats = {
  total: string;
  present: string;
  exited: string;
  cadeau: string;
};

type WalkInRow = {
  id: string;
  registration_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  companions: number;
  status: string;
  cadeau_delivered_at: string | null;
  qr_token: string;
  arrived_at: string;
};

export default async function AdminWalkInPage() {
  const statsRes = await query<WalkInStats>(`
    SELECT
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status <> 'cancelled')::text AS total,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status = 'checked_in')::text AS present,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND status = 'exited')::text AS exited,
      COUNT(*) FILTER (WHERE registration_mode = 'walk_in' AND cadeau_delivered_at IS NOT NULL)::text AS cadeau
    FROM registrations
  `);

  const listRes = await query<WalkInRow>(`
    SELECT id::text, registration_code, first_name, last_name, phone, companions,
      status, cadeau_delivered_at::text, qr_token::text,
      COALESCE(arrived_at, created_at)::text AS arrived_at
    FROM registrations
    WHERE registration_mode = 'walk_in'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const stats = statsRes.rows[0] ?? { total: '0', present: '0', exited: '0', cadeau: '0' };

  return (
    <main className="admin">
      <div className="admin-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a87423' }}>
              Accoglienza & Desk Ingresso
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: '36px', fontWeight: 400, color: '#0a3157' }}>
              DAMAI · Gestione Walk-In
            </h1>
          </div>
          <div className="toolbar" style={{ margin: 0 }}>
            <Link href="/admin">← Dashboard</Link>
            <Link href="/admin/checkin">Scanner QR</Link>
          </div>
        </div>

        {/* Statistiche Walk-In */}
        <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '32px' }}>
          <div className="stat">
            <b>{stats.total}</b>
            <span>Walk-In Totali</span>
          </div>
          <div className="stat">
            <b style={{ color: '#315d46' }}>{stats.present}</b>
            <span>Presenti in Giardino</span>
          </div>
          <div className="stat">
            <b>{stats.exited}</b>
            <span>Usciti</span>
          </div>
          <div className="stat">
            <b style={{ color: '#a87423' }}>{stats.cadeau}</b>
            <span>Cadeau Consegnati</span>
          </div>
        </div>

        {/* Form di inserimento staff e ricerca */}
        <WalkInStaffForm />

        {/* Tabella ultimi Walk-In registrati */}
        <div style={{ marginTop: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--navy)', marginBottom: '14px' }}>
            Ultimi Walk-In Registrati
          </h2>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Ospite</th>
                  <th>Telefono</th>
                  <th>Gruppo</th>
                  <th>Arrivo</th>
                  <th>Stato</th>
                  <th>Cadeau</th>
                  <th>Azione</th>
                </tr>
              </thead>
              <tbody>
                {listRes.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#746d64' }}>
                      Nessun ospite walk-in registrato finora.
                    </td>
                  </tr>
                ) : (
                  listRes.rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.registration_code}</td>
                      <td>
                        <strong>{row.first_name} {row.last_name}</strong>
                      </td>
                      <td>{row.phone}</td>
                      <td>{1 + row.companions} pers.</td>
                      <td>
                        {new Date(row.arrived_at).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className={`pill ${row.status === 'checked_in' || row.status === 'exited' ? 'ok' : ''}`}>
                          {row.status === 'checked_in' ? 'PRESENTE' : row.status === 'exited' ? 'USCITO' : row.status}
                        </span>
                      </td>
                      <td>
                        {row.cadeau_delivered_at ? (
                          <span style={{ color: '#315d46', fontWeight: 600 }}>✓ Consegnato</span>
                        ) : (
                          <span style={{ color: '#999' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/admin/checkin/${row.qr_token}`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            background: '#0a3157',
                            color: 'white',
                            textDecoration: 'none',
                            fontSize: '11px',
                          }}
                        >
                          Scheda QR →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

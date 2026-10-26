import Link from 'next/link';
import { query } from '@/lib/db';
import WalkInStaffForm from './walk-in-staff-form';
import './admin-walk-in.css';

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
    LIMIT 15
  `);

  const stats = statsRes.rows[0] ?? { total: '0', present: '0', exited: '0', cadeau: '0' };

  return (
    <main className="admin-walkin-shell">
      <div className="admin-walkin-container">
        {/* Header Responsivo */}
        <header className="admin-walkin-header">
          <div>
            <div className="admin-walkin-eyebrow">Accoglienza & Desk Ingresso</div>
            <h1 className="admin-walkin-title">DAMAI · Gestione Walk-In</h1>
          </div>
          <div className="admin-walkin-toolbar">
            <Link href="/admin">← Dashboard</Link>
            <Link href="/admin/checkin">Scanner QR 📷</Link>
          </div>
        </header>

        {/* Statistiche Walk-In Touch-Friendly */}
        <section className="admin-walkin-stats" aria-label="Statistiche Walk-In">
          <div className="admin-walkin-stat-card">
            <b>{stats.total}</b>
            <span>Walk-In Totali</span>
          </div>
          <div className="admin-walkin-stat-card">
            <b style={{ color: '#315d46' }}>{stats.present}</b>
            <span>Presenti Ora</span>
          </div>
          <div className="admin-walkin-stat-card">
            <b>{stats.exited}</b>
            <span>Usciti</span>
          </div>
          <div className="admin-walkin-stat-card">
            <b style={{ color: '#a87423' }}>{stats.cadeau}</b>
            <span>Cadeau Consegnati</span>
          </div>
        </section>

        {/* Form Staff & Ricerca */}
        <WalkInStaffForm />

        {/* Elenco Ultimi Walk-In */}
        <section style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--navy)', marginBottom: '14px' }}>
            Ultimi Walk-In Registrati Oggi
          </h2>

          {listRes.rows.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #ddd7ce', padding: '24px', textAlign: 'center', color: '#746d64', fontSize: '14px' }}>
              Nessun ospite walk-in registrato finora.
            </div>
          ) : (
            <>
              {/* Visualizzazione Mobile: Card Touch-Friendly */}
              <div className="recent-walkins-mobile">
                {listRes.rows.map((row) => (
                  <article key={row.id} className="walkin-mobile-card">
                    <div className="walkin-mobile-header">
                      <span className="walkin-mobile-code">{row.registration_code}</span>
                      <span className={`pill ${row.status === 'checked_in' || row.status === 'exited' ? 'ok' : ''}`}>
                        {row.status === 'checked_in' ? 'PRESENTE' : row.status === 'exited' ? 'USCITO' : row.status}
                      </span>
                    </div>

                    <div className="walkin-mobile-body">
                      <strong style={{ fontSize: '16px', display: 'block', color: 'var(--navy)' }}>
                        {row.first_name} {row.last_name}
                      </strong>
                      <div style={{ marginTop: '4px', color: '#555' }}>
                        📞 {row.phone} · Gruppo: <strong>{1 + row.companions} pers.</strong>
                      </div>
                      <div style={{ marginTop: '4px', color: '#666', fontSize: '12px' }}>
                        Arrivo: {new Date(row.arrived_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        Cadeau: {row.cadeau_delivered_at ? <span style={{ color: '#315d46', fontWeight: 600 }}>✓ Consegnato</span> : 'Non ancora'}
                      </div>
                    </div>

                    <Link href={`/admin/checkin/${row.qr_token}`} className="walkin-mobile-action-btn">
                      Apri Scheda Check-in / Cadeau →
                    </Link>
                  </article>
                ))}
              </div>

              {/* Visualizzazione Desktop: Tabella Classica */}
              <div className="recent-walkins-desktop">
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
                      {listRes.rows.map((row) => (
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
                                padding: '6px 12px',
                                background: '#0a3157',
                                color: 'white',
                                textDecoration: 'none',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              Scheda QR →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

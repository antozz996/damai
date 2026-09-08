import Scanner from './scanner';

export const dynamic = 'force-dynamic';

export default function CheckinScannerPage() {
  return (
    <main className="scanner-page">
      <div className="scanner-shell">
        <header className="scanner-header">
          <div>
            <div className="eyebrow scanner-eyebrow">DAMAI · Area accoglienza</div>
            <h1>Scanner <em>QR</em></h1>
            <p>Inquadra il pass del cliente per aprire la sua scheda e confermare l&apos;ingresso.</p>
          </div>
          <div className="scanner-links">
            <a href="/admin">Dashboard</a>
            <a href="/admin/slots">Fasce orarie</a>
          </div>
        </header>
        <Scanner />
      </div>
    </main>
  );
}

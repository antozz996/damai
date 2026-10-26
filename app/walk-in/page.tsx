import type { Metadata } from 'next';
import WalkInForm from './walk-in-form';
import './walk-in.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Registrazione Immediata · DAMAI Open Days 2026',
  description:
    'Benvenuto a DAMAI Event Garden. Registrati in pochi secondi per ottenere il tuo pass personale per La Dolce Vita Open Days.',
};

export default function WalkInPublicPage() {
  return (
    <main className="walkin-shell">
      <div className="walkin-container">
        <header className="walkin-header">
          {/* Logo DAMAI Ufficiale */}
          <img
            src="/damai/damai-logo-cream.png"
            alt="DAMAI Event Garden"
            className="walkin-logo"
            width={170}
            height={50}
          />
          <span className="walkin-tag">✦ Registrazione Accoglienza ✦</span>
          <h1 className="walkin-title">
            Benvenuto a
            <em>La Dolce Vita</em>
          </h1>
          <p className="walkin-subtitle">
            Compila il modulo rapido per ottenere subito il tuo pass personale d’ingresso.
          </p>
        </header>

        <section className="walkin-card">
          <WalkInForm />
        </section>

        <footer className="walkin-footer">
          DAMAI Event Garden · Via Marina di Varcaturo · Open Days 2026
        </footer>
      </div>
    </main>
  );
}

import Image from 'next/image';
import localFont from 'next/font/local';
import RegistrationForm from './registration-form';
import { EVENT } from '@/lib/event';

export const dynamic = 'force-dynamic';

const didoneFallback = localFont({
  src: '../public/damai/fonts/BodoniModa.ttf',
  variable: '--font-didone',
  display: 'swap',
});

function DamaiLogo() {
  return (
    <Image
      src="/damai/logo-original.svg"
      alt="DAMAI Event Garden"
      width={924}
      height={232}
      unoptimized
    />
  );
}

/**
 * Pagina di registrazione di riserva: quella ufficiale è sul sito
 * (https://www.damaigarden.it/christmas-village/) e usa le stesse API.
 */
export default function HomePage() {
  return (
    <main className={['ldv-page', didoneFallback.variable].join(' ')} id="top">
      <a className="ldv-skip" href="#registrazione-form">Vai alla registrazione</a>

      <header className="ldv-nav">
        <a href="#top" className="ldv-nav-brand" aria-label="DAMAI, inizio pagina"><DamaiLogo /></a>
        <nav aria-label="Navigazione principale">
          <a href="#programma">Il villaggio</a>
          <a href="#registrazione-form" className="ldv-nav-book">Registrati</a>
        </nav>
      </header>

      <section className="ldv-dates" id="programma" aria-labelledby="programma-title">
        <div className="ldv-container">
          <h1 className="ldv-heading" id="programma-title">{EVENT.name}</h1>
          <span className="ldv-rule" aria-hidden="true" />
          <p className="ldv-hours">12 <span>e</span> 13 dicembre 2026</p>
          <p className="ldv-section-note">
            Sabato e domenica, {EVENT.hoursLabel} ({EVENT.lastEntryLabel}).<br />
            <strong>Ingresso gratuito con registrazione obbligatoria.</strong>
          </p>
          <p className="ldv-section-note">
            Ti aspettano Babbo Natale, il laboratorio con la letterina e la foto, bevande tipiche,
            delizie natalizie e i mercatini, mentre esplori la nostra struttura.
          </p>
          <p className="ldv-section-note">{EVENT.venue} · {EVENT.address}</p>
          <a className="ldv-button" href="#registrazione-form">Registrati</a>
        </div>
      </section>

      <section className="ldv-registration-stage" id="registrazione" aria-labelledby="registrazione-title">
        <div className="ldv-registration-form-shell" id="registrazione-form" tabIndex={-1}>
          <h2 className="ldv-heading" id="registrazione-title" style={{ textAlign: 'center' }}>Registrati ora</h2>
          <p className="ldv-registration-form-intro">
            Scegli il giorno e la fascia oraria di arrivo: riceverai via email il biglietto con il QR da presentare all’ingresso.
          </p>
          <RegistrationForm />
        </div>
      </section>

      <footer className="ldv-footer">
        <span className="ldv-nav-brand"><DamaiLogo /></span>
        <p>{EVENT.name} · 12 e 13 dicembre 2026</p>
        <a href="/privacy">Informativa privacy</a>
      </footer>
    </main>
  );
}

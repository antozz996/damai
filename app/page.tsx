import Image from 'next/image';
import RegistrationForm from './registration-form';

export const dynamic = 'force-dynamic';

const steps = [
  {
    number: '01',
    title: 'Raccontaci di te',
    text: 'Lasciaci le informazioni essenziali sul tuo evento e su chi vuoi festeggiare.',
  },
  {
    number: '02',
    title: 'Scegli il momento',
    text: 'Seleziona il giorno e la fascia oraria che preferisci: la disponibilità è aggiornata in tempo reale.',
  },
  {
    number: '03',
    title: 'Ricevi il tuo pass',
    text: 'Ti invieremo un QR personale, valido per te e per i tuoi accompagnatori.',
  },
  {
    number: '04',
    title: 'Vivi DAMAI',
    text: 'All’ingresso il nostro team saprà già come accoglierti e accompagnarti.',
  },
];

const benefits = [
  {
    number: '01',
    title: 'Meno attese',
    text: 'Ogni ingresso è organizzato per farti vivere la location con i tuoi tempi.',
  },
  {
    number: '02',
    title: 'Nessuna visita frettolosa',
    text: 'Tre giornate per guardare, ascoltare e immaginare il tuo giorno speciale.',
  },
  {
    number: '03',
    title: 'A tu per tu',
    text: 'Un incontro dedicato con chi conosce DAMAI e sa trasformare un’idea in esperienza.',
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function FineLineIcon({ type }: { type: 'clock' | 'eye' | 'chat' }) {
  if (type === 'clock') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="15" />
        <path d="M24 15v10l7 4" />
      </svg>
    );
  }

  if (type === 'eye') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M6 24s7-11 18-11 18 11 18 11-7 11-18 11S6 24 6 24Z" />
        <circle cx="24" cy="24" r="5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 10h32v22H21l-8 7v-7H8V10Z" />
      <path d="M16 18h16M16 24h10" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="ldv-page">
      <header className="ldv-nav">
        <a className="ldv-wordmark" href="#top" aria-label="DAMAI Exclusive Garden">
          <span>DAMAI</span>
          <small>EXCLUSIVE GARDEN</small>
        </a>
        <div className="ldv-nav-center" aria-label="Tema dell’evento">
          <span className="ldv-script">La Dolce Vita</span>
          <span>Open Days · 2026</span>
        </div>
        <nav className="ldv-nav-links" aria-label="Navigazione principale">
          <a href="#esperienza">L’esperienza</a>
          <a href="#programma">Il programma</a>
          <a className="ldv-nav-book" href="#registrazione">Registrati <Arrow /></a>
        </nav>
      </header>

      <section className="ldv-hero" id="top">
        <Image className="ldv-hero-frame" src="/damai/ldv/up-frame.png" alt="" width={1800} height={590} />
        <Image className="ldv-hero-lemon" src="/damai/ldv/lemons-02.png" alt="" width={900} height={900} />
        <div className="ldv-hero-copy">
          <p className="ldv-overline">DAMAI PRESENTA</p>
          <p className="ldv-hero-edition">OPEN DAYS <span>2026</span></p>
          <h1 className="ldv-display ldv-hero-title">
            <span>LA DOLCE</span>
            <span>VITA</span>
          </h1>
          <p className="ldv-script ldv-hero-script">Tre giorni per scegliere la tua storia.</p>
          <p className="ldv-hero-lede">
            Un invito a scoprire DAMAI, i suoi spazi e tutto quello che può diventare il tuo prossimo evento.
          </p>
          <div className="ldv-hero-meta">
            <div><strong>30 · 31</strong><span>OTTOBRE</span></div>
            <i aria-hidden="true" />
            <div><strong>01</strong><span>NOVEMBRE</span></div>
            <i aria-hidden="true" />
            <div><strong>16:00 — 21:00</strong><span>ORARIO</span></div>
          </div>
          <a className="ldv-button ldv-button-gold" href="#registrazione">Prenota la tua visita <Arrow /></a>
        </div>
        <div className="ldv-hero-visual">
          <Image className="ldv-hero-photo" src="/damai/hero-exterior.webp" alt="Il giardino DAMAI illuminato al tramonto" fill priority sizes="(max-width: 760px) 100vw, 45vw" />
          <div className="ldv-hero-photo-wash" />
          <div className="ldv-hero-stamp"><span>INGRESSO</span><strong>GRATUITO</strong><small>SU REGISTRAZIONE</small></div>
          <div className="ldv-hero-caption"><span>Via Marina di Varcaturo</span><strong>Il luogo in cui ogni dettaglio diventa ricordo.</strong></div>
          <Image className="ldv-hero-pot" src="/damai/ldv/pot.png" alt="" width={620} height={760} />
        </div>
      </section>

      <div className="ldv-ornament-band" aria-hidden="true">
        <Image src="/damai/ldv/shield.png" alt="" width={920} height={310} />
      </div>

      <section className="ldv-experience" id="esperienza">
        <div className="ldv-section-label">01 <span>L’esperienza</span></div>
        <div className="ldv-experience-grid">
          <div className="ldv-experience-image">
            <Image src="/damai/hero-exterior.webp" alt="Gli spazi esterni di DAMAI" fill sizes="(max-width: 760px) 100vw, 48vw" />
            <div className="ldv-image-note">Un assaggio della tua prossima storia.</div>
            <Image className="ldv-experience-branch" src="/damai/ldv/lemons-03.png" alt="" width={800} height={800} />
          </div>
          <div className="ldv-experience-copy">
            <p className="ldv-overline">MORE THAN AN OPEN DAY</p>
            <h2 className="ldv-display">La visita<br /><em>intorno a te.</em></h2>
            <p className="ldv-script ldv-copy-script">Dedicato a te</p>
            <p>
              Non è una semplice visita. È il primo momento in cui il tuo evento comincia a prendere forma: tra il verde del giardino, la luce della sera e la cura di ogni dettaglio.
            </p>
            <p>
              Scegli il tuo giorno, entra senza attese e lasciati guidare dal team DAMAI. Porta con te chi vuoi: alcune idee hanno bisogno di essere condivise per diventare vere.
            </p>
            <a className="ldv-text-link" href="#registrazione">Scopri il tuo momento <Arrow /></a>
          </div>
        </div>
      </section>

      <section className="ldv-program" id="programma">
        <Image className="ldv-program-tree" src="/damai/ldv/lemons-01.png" alt="" width={900} height={900} />
        <Image className="ldv-program-frame" src="/damai/ldv/up-frame.png" alt="" width={1500} height={490} />
        <div className="ldv-section-label">02 <span>Il programma</span></div>
        <div className="ldv-program-inner">
          <p className="ldv-overline">SEGNALO IN AGENDA</p>
          <h2 className="ldv-display">Tre giorni,<br /><em>una sola experience.</em></h2>
          <div className="ldv-date-grid">
            <div><strong>30</strong><span>OTTOBRE</span><small>VENERDÌ</small></div>
            <div><strong>31</strong><span>OTTOBRE</span><small>SABATO</small></div>
            <div><strong>01</strong><span>NOVEMBRE</span><small>DOMENICA</small></div>
          </div>
          <div className="ldv-program-time"><span>FASCE ORARIE</span><strong>16:00 <b>~</b> 21:00</strong></div>
          <p className="ldv-program-note">L’accesso è gratuito e riservato a chi si registra. Scegli una fascia oraria: ti aspettiamo con un’accoglienza pensata per te.</p>
          <a className="ldv-button ldv-button-navy" href="#registrazione">Scegli il tuo ingresso <Arrow /></a>
        </div>
      </section>

      <section className="ldv-steps-section">
        <div className="ldv-section-label">03 <span>Come funziona</span></div>
        <div className="ldv-section-intro">
          <p className="ldv-overline">SEMPLICE, VELOCE, PERSONALE</p>
          <h2 className="ldv-display">Il tuo pass<br /><em>in quattro passi.</em></h2>
        </div>
        <div className="ldv-steps-grid">
          {steps.map((step) => (
            <article className="ldv-step" key={step.number}>
              <span className="ldv-step-number">{step.number}</span>
              <h3 className="ldv-display">{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ldv-dedicated">
        <div className="ldv-dedicated-copy">
          <p className="ldv-overline">PERCHÉ PRENOTARE</p>
          <h2 className="ldv-display">Ogni dettaglio<br /><em>merita il suo tempo.</em></h2>
          <p className="ldv-script ldv-copy-script">Dedicato a te</p>
          <div className="ldv-benefits">
            {benefits.map((benefit, index) => (
              <article className="ldv-benefit" key={benefit.number}>
                <span>{benefit.number}</span>
                <div>
                  <h3 className="ldv-display">{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </div>
                <FineLineIcon type={index === 0 ? 'clock' : index === 1 ? 'eye' : 'chat'} />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ldv-registration" id="registrazione">
        <div className="ldv-registration-heading">
          <p className="ldv-overline">IL TUO EVENTO INIZIA DA QUI</p>
          <h2 className="ldv-display">Registrati ora.</h2>
          <p>La registrazione è gratuita. Gli ingressi sono a disponibilità limitata per regalarti un incontro davvero personale.</p>
        </div>
        <div className="ldv-form-wrap">
          <aside className="ldv-form-aside">
            <p className="ldv-aside-brand">DAMAI <span>Exclusive Garden</span></p>
            <span className="ldv-aside-rule" aria-hidden="true" />
            <p className="ldv-overline">DAMAI OPEN DAYS</p>
            <h3 className="ldv-display">La magia è nelle persone che scelgono di esserci.</h3>
            <p>Una visita pensata per scoprire spazi, atmosfera e possibilità del tuo futuro evento.</p>
            <ul>
              <li>Ingresso gratuito</li>
              <li>Parcheggio in loco</li>
              <li>QR personale di ingresso</li>
              <li>Consulenza con il team DAMAI</li>
            </ul>
            <p className="ldv-aside-date">30 · 31 OTTOBRE<br />01 NOVEMBRE 2026</p>
            <Image className="ldv-form-lemon" src="/damai/ldv/lemons-03.png" alt="" width={780} height={780} />
          </aside>
          <RegistrationForm />
        </div>
      </section>

      <footer className="ldv-footer">
        <div className="ldv-footer-brand"><span>DAMAI</span><small>EXCLUSIVE GARDEN</small></div>
        <p>Open Days 2026 · La Dolce Vita</p>
        <a href="#top">Torna su <Arrow /></a>
      </footer>
    </main>
  );
}

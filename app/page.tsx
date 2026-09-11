import Image from 'next/image';
import localFont from 'next/font/local';
import RegistrationForm from './registration-form';

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

type CampaignBoardProps = {
  id: string;
  title: string;
  src: string;
  alt: string;
  width?: number;
  priority?: boolean;
  showRegistration?: boolean;
};

function CampaignBoard({ id, title, src, alt, width = 1081, priority = false, showRegistration = false }: CampaignBoardProps) {
  return (
    <section className={`ldv-board-section${showRegistration ? ' ldv-board-with-action' : ''}`} id={id} aria-labelledby={`${id}-title`}>
      <h2 className="ldv-visually-hidden" id={`${id}-title`}>{title}</h2>
      <div className="ldv-board-art">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={1350}
          sizes="100vw"
          priority={priority}
        />
      </div>
      {showRegistration && (
        <div className="ldv-board-action">
          <a className="ldv-button ldv-register-button" href="#registrazione-form">Registrati</a>
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <main className={['ldv-page', didoneFallback.variable].join(' ')} id="top">
      <a className="ldv-skip" href="#registrazione-form">Vai alla registrazione</a>

      <header className="ldv-nav">
        <a href="#top" className="ldv-nav-brand" aria-label="DAMAI, inizio pagina"><DamaiLogo /></a>
        <nav aria-label="Navigazione principale">
          <a href="#programma">Le giornate</a>
          <a href="#registrazione-form" className="ldv-nav-book">Registrati</a>
        </nav>
      </header>

      <CampaignBoard
        id="invito"
        title="DAMAI Open Days — La Dolce Vita"
        src="/damai/ldv/boards/invitation-board.jpg"
        alt="DAMAI Open Days La Dolce Vita, 30 e 31 ottobre e 1 novembre 2026"
        width={1080}
        priority
        showRegistration
      />

      <CampaignBoard
        id="esperienza"
        title="More than an open day"
        src="/damai/ldv/boards/experience-board.jpg"
        alt="La Dolce Vita: tre giorni dedicati alla bellezza, all'ispirazione e all'arte di celebrare"
      />

      <CampaignBoard
        id="programma"
        title="Tre giorni, una sola experience"
        src="/damai/ldv/boards/dates-board.jpg"
        alt="Tre giornate Open Days: 30 ottobre, 31 ottobre e 1 novembre 2026, dalle 16 alle 21"
      />

      <CampaignBoard
        id="dedicato"
        title="Dedicato a te"
        src="/damai/ldv/boards/dedicated-board.jpg"
        alt="Dedicato a te: meno attese, nessuna visita frettolosa, a tu per tu"
      />

      <section className="ldv-board-section ldv-registration-stage" id="registrazione" aria-labelledby="registrazione-title">
        <h2 className="ldv-visually-hidden" id="registrazione-title">Registrati ora</h2>
        <div className="ldv-board-art">
          <Image
            src="/damai/ldv/boards/registration-board.jpg"
            alt="Registrati ora agli Open Days DAMAI: compila il modulo, scegli il giorno e lo slot, ricevi la conferma con QR"
            width={1081}
            height={1350}
            sizes="100vw"
          />
        </div>
        <div className="ldv-registration-form-shell" id="registrazione-form" tabIndex={-1}>
          <p className="ldv-registration-form-intro">Completa il modulo per scegliere la giornata e la fascia oraria della tua visita.</p>
          <RegistrationForm />
        </div>
      </section>

      <CampaignBoard
        id="chiusura"
        title="La Dolce Vita is waiting for you"
        src="/damai/ldv/boards/closing-board.jpg"
        alt="La Dolce Vita is waiting for you: registrati agli Open Days DAMAI"
      />

      <footer className="ldv-footer">
        <span className="ldv-nav-brand"><DamaiLogo /></span>
        <p>Open Days 2026 · La Dolce Vita</p>
        <a href="/privacy">Informativa privacy</a>
      </footer>
    </main>
  );
}

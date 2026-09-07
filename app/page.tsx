import Image from 'next/image';
import RegistrationForm from './registration-form';

export const dynamic = 'force-dynamic';

function LemonBranch({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 340 250" aria-hidden="true">
      <path d="M20 226C94 174 131 111 170 24M118 137c54 0 103 25 153 76M162 48c44 14 80 47 111 89" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g fill="#315a44">
        <path d="M55 188c6-26 27-39 52-33-3 27-24 42-52 33Z"/><path d="M108 139c0-26 17-44 43-44 3 25-13 45-43 44Z"/>
        <path d="M167 63c16-22 39-27 61-14-13 24-37 30-61 14Z"/><path d="M210 121c20-17 44-16 63 2-18 20-43 20-63-2Z"/>
        <path d="M237 179c25-9 47 0 59 23-24 12-48 3-59-23Z"/><path d="M132 176c22-14 46-9 61 11-21 17-46 12-61-11Z"/>
      </g>
      <g fill="#efc64c" stroke="#9c6b1d" strokeWidth="2">
        <ellipse cx="76" cy="164" rx="26" ry="35" transform="rotate(35 76 164)"/><ellipse cx="168" cy="102" rx="27" ry="37" transform="rotate(-18 168 102)"/>
        <ellipse cx="252" cy="142" rx="27" ry="37" transform="rotate(26 252 142)"/><ellipse cx="215" cy="207" rx="27" ry="36" transform="rotate(-28 215 207)"/>
      </g>
      <g fill="none" stroke="#f9e592" strokeWidth="2" opacity=".8"><path d="M59 151c10-12 21-17 32-15"/><path d="M153 86c9-10 19-14 29-13"/><path d="M238 126c10-9 20-12 30-9"/></g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="top-logo" href="#top" aria-label="DAMAI Exclusive Garden"><Image src="/damai/damai-logo-cream.png" alt="DAMAI Exclusive Garden" width={228} height={55} priority /></a>
        <div className="top-event">Open Days · 30/31 ottobre · 1 novembre</div>
        <a className="top-cta" href="#registrazione">Registrati</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="kicker">DAMAI presenta</div>
          <div className="edition">OPEN DAYS <span>2026</span></div>
          <h1>La Dolce <em>Vita</em></h1>
          <p className="hero-tagline">Tre giornate per immaginare il tuo evento,<br/>nel luogo in cui ogni dettaglio diventa ricordo.</p>
          <div className="hero-date">
            <span>30 · 31</span><small>OTTOBRE</small><i /><span>01</span><small>NOVEMBRE</small><i /><span>16—21</span><small>ORARIO</small>
          </div>
          <a href="#registrazione" className="cta cta-gold">Prenota la tua visita <span>↗</span></a>
          <LemonBranch className="lemon lemon-left" />
        </div>
        <div className="hero-visual">
          <Image className="hero-photo" src="/damai/hero-exterior.webp" alt="Ingresso serale del DAMAI Event Garden" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          <div className="photo-shade" />
          <div className="poster-seal"><span>INGRESSO</span><strong>GRATUITO</strong><small>SU REGISTRAZIONE</small></div>
          <div className="photo-caption"><span>Via Marina di Varcaturo</span><strong>Un assaggio della tua prossima storia.</strong></div>
          <LemonBranch className="lemon lemon-right" />
        </div>
      </section>

      <div className="tile-ribbon" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/></div>

      <section className="section journey">
        <div className="section-head"><div className="eyebrow">La tua esperienza</div><h2>Una visita pensata<br/><em>intorno a te.</em></h2><p className="sub">Niente attese, niente visita impersonale. Scegli il tuo momento e lasciati accompagnare alla scoperta di DAMAI.</p></div>
        <div className="steps">
          <div className="step"><div className="step-num">01</div><h3>Raccontaci di te</h3><p>Inserisci i contatti e le prime informazioni sul tuo evento.</p></div>
          <div className="step"><div className="step-num">02</div><h3>Scegli il momento</h3><p>Giorno e fascia oraria, con disponibilità aggiornata in tempo reale.</p></div>
          <div className="step"><div className="step-num">03</div><h3>Ricevi il tuo pass</h3><p>Un QR personale da mostrare all&apos;ingresso, valido anche per gli accompagnatori.</p></div>
          <div className="step"><div className="step-num">04</div><h3>Vivi DAMAI</h3><p>Il nostro team sarà pronto ad accoglierti e a conoscere la tua idea.</p></div>
        </div>
      </section>

      <section className="registration" id="registrazione">
        <div className="registration-title"><span className="eyebrow">Il tuo evento inizia da qui</span><h2>Prenota la tua visita.</h2><p>La registrazione è gratuita. Gli ingressi sono a disponibilità limitata per offrirti un&apos;accoglienza realmente personale.</p></div>
        <div className="form-wrap">
          <aside className="form-aside">
            <Image src="/damai/damai-logo-cream.png" alt="DAMAI Exclusive Garden" width={190} height={46} />
            <div className="aside-rule"/><div className="eyebrow gold">DAMAI Open Days</div>
            <h3>La magia è nelle persone che scelgono di esserci.</h3>
            <p>Una visita pensata per scoprire spazi, atmosfera e possibilità del tuo futuro evento.</p>
            <ul><li>Ingresso gratuito</li><li>Parcheggio in loco</li><li>Registrazione accompagnatori</li><li>QR personale di ingresso</li><li>Consulenza con il team DAMAI</li></ul>
            <div className="aside-date">30 · 31 OTTOBRE<br/>01 NOVEMBRE 2026</div>
            <LemonBranch className="lemon aside-lemon" />
          </aside>
          <RegistrationForm />
        </div>
      </section>
      <footer><Image src="/damai/damai-logo-cream.png" alt="DAMAI Exclusive Garden" width={170} height={41}/><span>Open Days 2026 · La Dolce Vita</span></footer>
    </main>
  );
}

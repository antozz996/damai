import RegistrationForm from './registration-form';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="brand">DAMAI</div>
          <div className="brand-sub">Exclusive Garden</div>
          <div className="kicker">Open Days 2026 · La Dolce Vita</div>
          <h1>Registrazione<br/>e prenotazione</h1>
          <div className="script">Un primo passo verso la tua storia.</div>
          <p className="lede">L'accesso agli Open Days DAMAI è gratuito, ma su registrazione obbligatoria. Scegli il giorno e la fascia oraria più comoda per vivere la location con la giusta attenzione, senza attese e con una consulenza dedicata.</p>
          <a href="#registrazione" className="cta">Prenota la tua visita</a>
        </div>
        <div className="hero-visual">
          <div className="event-card">
            <div className="small">DAMAI Exclusive Garden</div>
            <h2>OPEN DAYS</h2>
            <div className="dolce">La Dolce Vita</div>
            <div className="dates">30 · 31 ottobre<br/>1 novembre 2026<br/><br/>dalle 16:00 alle 21:00</div>
            <a href="#registrazione" className="cta">Prenota la tua visita</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="eyebrow">Come registrarsi</div>
          <h2>Semplice, veloce, personale.</h2>
          <p className="sub">La registrazione ci permette di organizzare gli ingressi e preparare un'accoglienza realmente su misura.</p>
        </div>
        <div className="steps">
          <div className="step"><div className="step-num">01.</div><h3>Compila il form</h3><p>Inserisci i tuoi contatti e alcune informazioni sul tuo evento.</p></div>
          <div className="step"><div className="step-num">02.</div><h3>Scegli giorno e orario</h3><p>Visualizzi solo le fasce disponibili in tempo reale.</p></div>
          <div className="step"><div className="step-num">03.</div><h3>Ricevi il tuo QR</h3><p>Al termine ottieni il pass personale da mostrare all'ingresso.</p></div>
          <div className="step"><div className="step-num">04.</div><h3>Vivi DAMAI</h3><p>Arriva nella fascia scelta: il team avrà già le informazioni principali sul tuo evento.</p></div>
        </div>
      </section>

      <section className="section" id="registrazione">
        <div className="section-head">
          <div className="eyebrow">Il tuo evento inizia da qui</div>
          <h2>Prenota la tua visita.</h2>
          <p className="sub">30-31 ottobre e 1 novembre 2026. Gli slot hanno disponibilità limitata per garantire una migliore esperienza.</p>
        </div>
        <div className="form-wrap">
          <aside className="form-aside">
            <div className="eyebrow" style={{color:'#d5b66e'}}>DAMAI Open Days</div>
            <h3>La magia è nelle persone che scelgono di esserci.</h3>
            <p>Una visita pensata per scoprire spazi, atmosfera e possibilità del tuo futuro evento.</p>
            <ul>
              <li>Ingresso gratuito</li>
              <li>Parcheggio in loco</li>
              <li>Registrazione accompagnatori</li>
              <li>QR personale di ingresso</li>
              <li>Consulenza con il team DAMAI</li>
            </ul>
          </aside>
          <RegistrationForm />
        </div>
      </section>
    </main>
  );
}

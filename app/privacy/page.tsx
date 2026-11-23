import { EVENT } from '@/lib/event';

export default function PrivacyPage() {
  return (
    <main className="section" style={{maxWidth:900,margin:'0 auto'}}>
      <div className="brand">DAMAI</div>
      <div className="brand-sub" style={{marginBottom:40}}>Exclusive Garden</div>
      <div className="eyebrow">Informativa ai sensi del GDPR</div>
      <h1 style={{fontSize:52,fontWeight:400}}>Privacy · {EVENT.name}</h1>
      <p className="sub">Questa informativa riguarda i dati raccolti tramite il sistema di registrazione al {EVENT.name} di {EVENT.datesLabel}.</p>

      <h2>1. Titolare del trattamento</h2>
      <p>Fiordacqua S.r.l., Vicoletto dei Cinesi 56, 80136 Napoli (NA), C.F./P.IVA 10239921215, REA NA-1091006, PEC fiordacqua.srl@pec.it. Location operativa: DAMAI Event Garden, Via Marina di Varcaturo 42, 81030 Castel Volturno (CE).</p>

      <h2>2. Dati trattati</h2>
      <p>Nome, cognome, telefono, email, numero di accompagnatori e numero di bambini presenti nel gruppo (viene raccolto solo il numero, senza dati identificativi dei minori), fascia di ingresso, orari di ingresso e di uscita registrati tramite il QR, provenienza della richiesta, eventuali note e dati tecnici necessari al funzionamento e alla sicurezza del servizio. Se indicati volontariamente: tipologia e data indicativa di un evento da organizzare e numero indicativo di ospiti.</p>

      <h2>3. Finalità e base giuridica</h2>
      <p>I dati obbligatori sono trattati per gestire la registrazione gratuita, organizzare gli ingressi nel rispetto della capienza, inviare la conferma con il biglietto, il promemoria e il ringraziamento connessi alla visita e gestire gli eventuali contatti commerciali richiesti dall'interessato. La base giuridica è l'esecuzione di misure precontrattuali richieste dall'interessato e, per gli aspetti di sicurezza, il legittimo interesse del Titolare.</p>
      <p>Le comunicazioni promozionali successive sono inviate soltanto se è stato prestato lo specifico consenso marketing, che può essere revocato in qualsiasi momento.</p>

      <h2>4. Conservazione</h2>
      <p>I dati di contatto e le informazioni relative alla richiesta sono conservati per il tempo necessario a gestire il rapporto e, in assenza di successivo contratto, fino a 24 mesi dall'ultimo contatto, salvo obblighi di legge o necessità di tutela dei diritti del Titolare.</p>

      <h2>5. Fornitori e trasferimenti</h2>
      <p>I dati possono essere trattati da fornitori tecnici nominati responsabili del trattamento, inclusi servizi di hosting, database, email e messaggistica. Il database operativo del sistema di registrazione è configurato in area UE. Per eventuali fornitori extra SEE si applicano gli strumenti previsti dal GDPR, incluse decisioni di adeguatezza o Clausole Contrattuali Standard.</p>

      <h2>6. Diritti</h2>
      <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso, nei casi previsti dagli artt. 15-22 GDPR, contattando il Titolare. Resta fermo il diritto di proporre reclamo al Garante per la protezione dei dati personali.</p>

      <p style={{marginTop:50}}><a href={EVENT.publicPageUrl}>← Torna alla pagina del {EVENT.shortName}</a></p>
    </main>
  );
}

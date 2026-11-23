import {
  DEFAULT_AUDIENCE_OPTIONS, LDV_CAMPAIGN, campaignEnabled, emailConfigured, loadAudience, summarizeAudience,
} from '@/lib/campaign';
import { LDV_INVITE_SUBJECT, LDV_INVITE_SUBJECT_ALT, ldvInviteRegisterUrl, ldvInviteSubject, renderLdvInvite } from '@/lib/notifications';
import { maskEmail, unsubscribeConfigured } from '@/lib/unsubscribe';
import { publicBaseUrl } from '@/lib/event';
import CampaignPanel, { type PanelRow } from './campaign-panel';
import './campaign.css';

export const dynamic = 'force-dynamic';

export default async function LdvCampaignPage() {
  let audience: Awaited<ReturnType<typeof loadAudience>>;
  try {
    audience = await loadAudience();
  } catch (error) {
    console.error('Campaign audience failed', error instanceof Error ? error.message : error);
    return (
      <main className="admin">
        <div className="admin-inner">
          <div className="eyebrow">DAMAI · Area staff · Campagna</div>
          <h1>Invito al Christmas Village per gli ospiti de La Dolce Vita</h1>
          <div className="error campaign-note" role="alert">
            Impossibile leggere i destinatari. Se la migrazione <code>db/migrations/20261124_email_opt_out.sql</code> non è ancora stata applicata al database, applicala e ricarica la pagina.
          </div>
          <div className="toolbar"><a href="/admin">← Dashboard</a></div>
        </div>
      </main>
    );
  }
  const summary = summarizeAudience(audience, DEFAULT_AUDIENCE_OPTIONS);
  const preview = renderLdvInvite({ firstName: 'Giulia', attended: true, unsubscribeUrl: `${publicBaseUrl()}/unsubscribe?t=anteprima` });
  const subject = ldvInviteSubject();

  // Al browser arrivano solo indirizzi mascherati.
  const rows: PanelRow[] = audience.map(row => ({
    masked: maskEmail(row.email),
    firstName: row.firstName,
    cancelled: row.cancelled,
    attended: row.attended,
    invalid: row.invalid,
    suppressed: row.suppressed,
    registered: row.registered,
    sendStatus: row.sendStatus,
    retryable: row.retryable,
  }));

  const blockers: string[] = [];
  if (!unsubscribeConfigured()) blockers.push('UNSUBSCRIBE_SECRET non è configurato (servono almeno 16 caratteri): senza link di disiscrizione non parte nessuna email, nemmeno di prova.');
  if (!emailConfigured()) blockers.push('RESEND_API_KEY o EMAIL_FROM non sono configurati.');

  return (
    <main className="admin">
      <div className="admin-inner">
        <div className="eyebrow">DAMAI · Area staff · Campagna</div>
        <h1>Invito al Christmas Village per gli ospiti de La Dolce Vita</h1>
        <p className="admin-intro">
          Un solo invio email a chi si è registrato agli Open Days «La Dolce Vita» (edizione <code>{LDV_CAMPAIGN.sourceEdition}</code>).
          Niente parte in automatico: l’invio avviene solo da questa pagina, e ogni indirizzo può ricevere l’email una volta sola.
        </p>

        {blockers.map(message => <div className="error campaign-note" role="alert" key={message}>{message}</div>)}

        <section className="stats admin-stats" aria-label="Destinatari">
          <div className="stat"><b>{summary.distinctEmails}</b><span>Email distinte (Open Days)</span></div>
          <div className="stat"><b>{summary.withoutCancelled}</b><span>Destinatari senza annullati (predefinito)</span></div>
          <div className="stat"><b>{summary.withCancelled}</b><span>Destinatari con annullati</span></div>
          <div className="stat muted-stat"><b>{summary.suppressed}</b><span>Esclusi: disiscritti</span></div>
          <div className="stat muted-stat"><b>{summary.invalid}</b><span>Esclusi: indirizzo non valido</span></div>
          <div className="stat"><b>{summary.alreadyRegistered}</b><span>Già registrati al Christmas Village</span></div>
          <div className="stat"><b>{summary.marketingConsent}</b><span>Con consenso marketing</span></div>
        </section>

        <section className="campaign-section" aria-labelledby="campaign-preview-title">
          <h2 id="campaign-preview-title">Anteprima</h2>
          <p><strong>Oggetto in uso:</strong> {subject}</p>
          <p className="campaign-muted">
            Proposte: «{LDV_INVITE_SUBJECT}» (predefinito) oppure «{LDV_INVITE_SUBJECT_ALT}». Per cambiarlo imposta <code>LDV_CAMPAIGN_SUBJECT</code>.
            Il pulsante «Registrati» porta a <code>{ldvInviteRegisterUrl()}</code>. Chi risulta entrato legge «hai partecipato a La Dolce Vita»,
            chi si era solo registrato legge «hai prenotato la tua visita a La Dolce Vita».
          </p>
          <iframe className="campaign-preview" title="Anteprima dell’email" sandbox="" srcDoc={preview.html} />
          <details className="campaign-text">
            <summary>Versione solo testo</summary>
            <pre>{preview.text}</pre>
          </details>
        </section>

        <CampaignPanel
          rows={rows}
          enabled={campaignEnabled()}
          ready={blockers.length === 0}
          confirmPhrase={LDV_CAMPAIGN.confirmPhrase}
          batchSize={LDV_CAMPAIGN.batchSize}
        />

        <div className="toolbar"><a href="/admin">← Dashboard</a></div>
      </div>
    </main>
  );
}

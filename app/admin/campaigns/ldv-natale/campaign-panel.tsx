'use client';

import { FormEvent, useMemo, useState } from 'react';

export type PanelRow = {
  masked: string;
  firstName: string;
  cancelled: boolean;
  attended: boolean;
  invalid: boolean;
  suppressed: boolean;
  registered: boolean;
  sendStatus: 'sending' | 'sent' | 'failed' | null;
  retryable: boolean;
};

type Props = { rows: PanelRow[]; enabled: boolean; ready: boolean; confirmPhrase: string; batchSize: number };

const ENDPOINT = '/api/admin/campaigns/ldv-natale';

async function post(body: unknown) {
  const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data as { sent?: number; failed?: number; remaining?: number; totalSent?: number; totalFailed?: number };
}

export default function CampaignPanel({ rows, enabled, ready, confirmPhrase, batchSize }: Props) {
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [excludeRegistered, setExcludeRegistered] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState(false);

  const list = useMemo(() => rows.map(row => {
    let state = 'Da inviare';
    let recipient = true;
    if (row.invalid) { state = 'Escluso: indirizzo non valido'; recipient = false; }
    else if (row.suppressed) { state = 'Escluso: disiscritto'; recipient = false; }
    else if (row.cancelled && !includeCancelled) { state = 'Escluso: registrazione annullata'; recipient = false; }
    else if (row.registered && excludeRegistered) { state = 'Escluso: già registrato al Christmas Village'; recipient = false; }
    else if (row.sendStatus === 'sent') state = 'Inviato';
    else if (row.sendStatus === 'failed') state = row.retryable ? 'Errore: verrà ritentato' : 'Errore: tentativi esauriti';
    else if (row.sendStatus === 'sending') state = row.retryable ? 'Invio interrotto: verrà ritentato' : 'Invio in corso';
    const pending = recipient && row.sendStatus !== 'sent' && row.retryable;
    return { ...row, state, recipient, pending };
  }), [rows, includeCancelled, excludeRegistered]);

  const recipients = list.filter(row => row.recipient).length;
  const alreadySent = list.filter(row => row.recipient && row.sendStatus === 'sent').length;
  const toSend = list.filter(row => row.pending).length;

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTestBusy(true);
    setTestStatus('');
    try {
      await post({ action: 'test', email: new FormData(event.currentTarget).get('email') });
      setTestStatus('Email di prova inviata. Controlla anche la cartella spam.');
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : 'Invio non riuscito.');
    }
    setTestBusy(false);
  }

  async function sendAll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm !== confirmPhrase || sending) return;
    setSending(true);
    setSendError('');
    setProgress('Invio in corso… non chiudere questa pagina.');
    try {
      // Un lotto per richiesta, finché non resta più nessuno (o un lotto non fa progressi).
      for (;;) {
        const result = await post({ action: 'send', confirm, includeCancelled, excludeRegistered });
        setProgress(`Inviate ${result.totalSent ?? 0} email · da inviare ${result.remaining ?? 0}${result.totalFailed ? ` · non riuscite ${result.totalFailed}` : ''}`);
        if (!result.remaining) break;
        if (!result.sent) {
          setSendError('Invio fermato: l’ultimo lotto non ha consegnato nessuna email. Controlla Resend e riprova: chi ha già ricevuto l’email non la riceverà di nuovo.');
          break;
        }
      }
      setDone(true);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Invio non riuscito.');
    }
    setSending(false);
  }

  const canSend = enabled && ready && toSend > 0 && confirm === confirmPhrase && !sending && !done;

  return (
    <>
      <section className="campaign-section" aria-labelledby="campaign-test-title">
        <h2 id="campaign-test-title">1. Email di prova</h2>
        <p className="campaign-muted">Arriva solo all’indirizzo indicato, con oggetto preceduto da [PROVA]. Non conta come invio della campagna.</p>
        <form className="campaign-form" onSubmit={sendTest}>
          <label>Invia email di prova a…<input name="email" type="email" required placeholder="tua@email.it" /></label>
          <button className="submit" disabled={testBusy || !ready}>{testBusy ? 'Invio in corso…' : 'Invia email di prova'}</button>
        </form>
        {testStatus && <div className="success" role="status">{testStatus}</div>}
      </section>

      <section className="campaign-section" aria-labelledby="campaign-send-title">
        <h2 id="campaign-send-title">2. Invio a tutti</h2>
        <div className="campaign-options">
          <label><input type="checkbox" checked={includeCancelled} disabled={sending} onChange={event => setIncludeCancelled(event.target.checked)} /> Includi anche chi ha annullato la registrazione agli Open Days</label>
          <label><input type="checkbox" checked={excludeRegistered} disabled={sending} onChange={event => setExcludeRegistered(event.target.checked)} /> Escludi chi è già registrato al Christmas Village</label>
        </div>
        <p><strong>{recipients}</strong> destinatari con queste opzioni · <strong>{alreadySent}</strong> già inviati · <strong>{toSend}</strong> da inviare (a lotti di {batchSize}).</p>
        {!enabled && <div className="error campaign-note" role="status">Invio disattivato. Per abilitarlo imposta la variabile <code>LDV_CAMPAIGN_ENABLED=true</code> e ripubblica; poi torna su questa pagina.</div>}
        <form className="campaign-form" onSubmit={sendAll}>
          <label>Per confermare digita {confirmPhrase}
            <input value={confirm} onChange={event => setConfirm(event.target.value)} disabled={!enabled || !ready || sending || done} autoComplete="off" placeholder={confirmPhrase} />
          </label>
          <button className="submit" disabled={!canSend}>{sending ? 'Invio in corso…' : `Invia a tutti (${toSend})`}</button>
        </form>
        {progress && <div className="success" role="status">{progress}{done && !sendError ? ' · Invio completato. Ricarica la pagina per l’elenco aggiornato.' : ''}</div>}
        {sendError && <div className="error campaign-note" role="alert">{sendError}</div>}
      </section>

      <section className="campaign-section" aria-labelledby="campaign-list-title">
        <h2 id="campaign-list-title">Elenco destinatari</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Email</th><th>Nome</th><th>Open Days</th><th>Stato</th></tr></thead>
            <tbody>
              {list.map((row, index) => (
                <tr key={index} className={row.recipient ? undefined : 'campaign-excluded'}>
                  <td>{row.masked}</td>
                  <td>{row.firstName}</td>
                  <td>{row.cancelled ? 'Annullato' : row.attended ? 'Entrato' : 'Registrato'}{row.registered ? ' · già al Christmas Village' : ''}</td>
                  <td>{row.state}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={4}>Nessuna registrazione agli Open Days.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

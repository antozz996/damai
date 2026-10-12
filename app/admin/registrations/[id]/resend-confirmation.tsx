'use client';

import { useState } from 'react';

type Props = {
  id: string;
  email: string;
  disabled: boolean;
};

type Feedback = { kind: 'success' | 'error'; message: string };

export default function ResendConfirmation({ id, email, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function resend() {
    if (busy || disabled) return;
    if (!window.confirm(`Reinviare la conferma di prenotazione a ${email}?\n\nVerifica che l'indirizzo corretto sia già stato salvato.`)) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/registrations/${encodeURIComponent(id)}/resend-confirmation`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || 'Impossibile reinviare la conferma.');
      setFeedback({ kind: 'success', message: data.message || `Conferma inviata a ${email}.` });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Invio non riuscito. Riprova.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-resend-box" aria-label="Reinvio conferma prenotazione">
      <h3>Conferma via email</h3>
      <div className="admin-resend-email">Destinatario salvato: <strong>{email}</strong></div>
      <button className="admin-resend-button" type="button" onClick={resend} disabled={busy || disabled}>
        {busy ? 'Invio in corso…' : 'Reinvia email di conferma'}
      </button>
      <div className="admin-resend-hint">
        {disabled
          ? 'Non è possibile inviare conferme per prenotazioni annullate.'
          : 'Usa l’indirizzo già salvato. Il codice prenotazione e il QR rimangono invariati.'}
      </div>
      {feedback && (
        <div className={`admin-resend-feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>
          {feedback.message}
        </div>
      )}
    </section>
  );
}

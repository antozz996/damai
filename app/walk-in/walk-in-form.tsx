'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EVENT_TYPES = [
  'Matrimonio',
  '18° Compleanno',
  'Comunione',
  'Laurea',
  'Anniversario',
  'Altro evento',
];

const COMPANION_OPTIONS = [0, 1, 2, 3, 4, 5];

export default function WalkInForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [companions, setCompanions] = useState(0);

  // Campi facoltativi
  const [email, setEmail] = useState('');
  const [plannedEventDate, setPlannedEventDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [notes, setNotes] = useState('');

  // Consensi
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Inserisci il tuo nome e cognome.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 7) {
      setError('Inserisci un numero di telefono valido per identificare il tuo pass.');
      return;
    }

    if (!privacyConsent) {
      setError('È necessario accettare l’informativa sulla privacy per procedere.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          eventType,
          companions,
          email: email.trim() || undefined,
          plannedEventDate: plannedEventDate.trim() || undefined,
          guestCount: guestCount ? Number(guestCount) : undefined,
          notes: notes.trim() || undefined,
          privacyConsent: true,
          marketingConsent,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Si è verificato un errore imprevisto. Riprova.');
      }

      // Successo: redirect immediato alla schermata del pass
      router.push(`/walk-in/pass/${data.qrToken}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore di connessione. Riprova.');
      setLoading(false);
    }
  }

  return (
    <form className="walkin-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="walkin-error-box" role="alert">
          {error}
        </div>
      )}

      {/* Nome e Cognome */}
      <div className="walkin-field">
        <label htmlFor="wi-firstName">Il tuo nome *</label>
        <input
          id="wi-firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Es. Marco"
          autoComplete="given-name"
          required
          disabled={loading}
        />
      </div>

      <div className="walkin-field">
        <label htmlFor="wi-lastName">Il tuo cognome *</label>
        <input
          id="wi-lastName"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Es. Rossi"
          autoComplete="family-name"
          required
          disabled={loading}
        />
      </div>

      {/* Telefono */}
      <div className="walkin-field">
        <label htmlFor="wi-phone">Numero di cellulare *</label>
        <input
          id="wi-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Es. 333 1234567"
          required
          disabled={loading}
        />
        <span className="walkin-field-hint">
          Indispensabile per recuperare il tuo pass all’ingresso o all’uscita se smarrisci il telefono.
        </span>
      </div>

      {/* Tipo Evento - Pill Buttons */}
      <div className="walkin-field">
        <label>A quale evento stai pensando? *</label>
        <div className="pill-group">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`pill-btn ${eventType === type ? 'active' : ''}`}
              onClick={() => setEventType(type)}
              disabled={loading}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Persone aggiuntive (Accompagnatori) */}
      <div className="walkin-field">
        <label>Quante persone sono con te oggi? (oltre a te)</label>
        <div className="companion-selector">
          {COMPANION_OPTIONS.map((num) => (
            <button
              key={num}
              type="button"
              className={`companion-btn ${companions === num ? 'active' : ''}`}
              onClick={() => setCompanions(num)}
              disabled={loading}
            >
              {num === 5 ? '5+' : num}
            </button>
          ))}
        </div>
        <span className="walkin-field-hint">
          Gruppo totale: <strong>{1 + companions} {1 + companions === 1 ? 'persona' : 'persone'}</strong>
        </span>
      </div>

      {/* Dettagli Facoltativi (Accordion) */}
      <details className="walkin-details">
        <summary>Vuoi aggiungere altri dettagli? (Facoltativo)</summary>
        <div className="walkin-details-inner">
          <div className="walkin-field">
            <label htmlFor="wi-email">La tua email</label>
            <input
              id="wi-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@dominio.it"
              autoComplete="email"
              disabled={loading}
            />
            <span className="walkin-field-hint">
              Inseriscila se desideri ricevere una copia digitale del pass e le informazioni dopo la visita.
            </span>
          </div>

          <div className="walkin-field">
            <label htmlFor="wi-date">Data orientativa dell’evento</label>
            <input
              id="wi-date"
              type="text"
              value={plannedEventDate}
              onChange={(e) => setPlannedEventDate(e.target.value)}
              placeholder="Es. Giugno 2027 oppure 15/09/2026"
              disabled={loading}
            />
          </div>

          <div className="walkin-field">
            <label htmlFor="wi-guests">Numero indicativo di invitati</label>
            <input
              id="wi-guests"
              type="number"
              min="1"
              max="1000"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Es. 120"
              disabled={loading}
            />
          </div>

          <div className="walkin-field">
            <label htmlFor="wi-notes">Note particolari o richieste per il team</label>
            <textarea
              id="wi-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hai preferenze o richieste particolari?"
              disabled={loading}
            />
          </div>
        </div>
      </details>

      {/* Consensi */}
      <div className="walkin-consents">
        <label className="walkin-consent-item">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            required
            disabled={loading}
          />
          <span>
            Ho letto e accetto l’<a href="/privacy" target="_blank" rel="noopener noreferrer">informativa sulla privacy</a> per la gestione della visita e la consegna del cadeau. *
          </span>
        </label>

        <label className="walkin-consent-item">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={loading}
          />
          <span>
            Desidero ricevere proposte dedicate ed eventi futuri da DAMAI Event Garden. (Facoltativo)
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <button type="submit" className="walkin-submit-btn" disabled={loading}>
        {loading ? 'Generazione Pass in corso...' : 'Conferma e Ottieni il Pass'}
      </button>
    </form>
  );
}

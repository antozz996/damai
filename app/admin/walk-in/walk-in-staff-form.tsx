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

export default function WalkInStaffForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [companions, setCompanions] = useState(0);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [immediateCheckin, setImmediateCheckin] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ricerca rapida
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      registrationCode: string;
      name: string;
      phone: string;
      status: string;
      token: string;
    }>
  >([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/walk-in/lookup?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Inserisci nome e cognome dell’ospite.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 7) {
      setError('Inserisci un recapito telefonico valido.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          eventType,
          companions,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          privacyConsent: true,
          marketingConsent: false,
          immediateCheckin,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante la registrazione walk-in.');
      }

      // Se confermato ingresso immediato, naviga alla scheda scanner con conferma 'entry'
      if (immediateCheckin) {
        router.push(`/admin/checkin/${data.qrToken}?ok=entry`);
      } else {
        router.push(`/admin/checkin/${data.qrToken}`);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Errore imprevisto. Riprova.');
      setLoading(false);
    }
  }

  return (
    <div className="admin-walkin-grid">
      {/* Colonna: Form Inserimento Desk */}
      <div className="admin-walkin-card">
        <h2>Nuovo Ospite Walk-In</h2>

        {error && (
          <div
            style={{
              background: '#fdf2f0',
              border: '1px solid #eecbc6',
              color: 'var(--danger)',
              padding: '12px 14px',
              marginBottom: '18px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="staff-form-row-2">
            <div className="staff-field">
              <label htmlFor="staff-firstName">Nome *</label>
              <input
                id="staff-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nome ospite"
                required
                disabled={loading}
              />
            </div>

            <div className="staff-field">
              <label htmlFor="staff-lastName">Cognome *</label>
              <input
                id="staff-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Cognome ospite"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="staff-field">
            <label htmlFor="staff-phone">Cellulare *</label>
            <input
              id="staff-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Numero di telefono"
              required
              disabled={loading}
            />
          </div>

          <div className="staff-field">
            <label>Tipo Evento *</label>
            <div className="staff-pills">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={`staff-pill-btn ${eventType === type ? 'active' : ''}`}
                  disabled={loading}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="staff-field">
            <label>Accompagnatori (oltre al titolare)</label>
            <div className="staff-companions">
              {COMPANION_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCompanions(num)}
                  className={`staff-companion-btn ${companions === num ? 'active' : ''}`}
                  disabled={loading}
                >
                  {num === 5 ? '5+' : num}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: '#746d64', marginTop: '2px', display: 'block' }}>
              Totale gruppo: <strong>{1 + companions}</strong> {1 + companions === 1 ? 'persona' : 'persone'}
            </span>
          </div>

          <div className="staff-field">
            <label htmlFor="staff-email">Email (Opzionale)</label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Lascia vuoto se non fornita"
              disabled={loading}
            />
          </div>

          <div className="staff-field">
            <label htmlFor="staff-notes">Note desk (Opzionali)</label>
            <input
              id="staff-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. arrivati con coppia di amici"
              disabled={loading}
            />
          </div>

          {/* Toggle check-in immediato */}
          <div className="staff-toggle-box">
            <label className="staff-toggle-label">
              <input
                type="checkbox"
                checked={immediateCheckin}
                onChange={(e) => setImmediateCheckin(e.target.checked)}
                disabled={loading}
              />
              <span>Conferma ingresso subito (Check-in IN)</span>
            </label>
            <p style={{ margin: '6px 0 0 34px', fontSize: '12px', color: '#695e52', lineHeight: 1.4 }}>
              Se attivo, l&apos;ospite viene registrato direttamente come &ldquo;Presente&rdquo; e sarai reindirizzato alla schermata check-in.
            </p>
          </div>

          <button type="submit" disabled={loading} className="staff-submit-btn">
            {loading ? 'Registrazione in corso...' : 'Registra Ospite al Desk'}
          </button>
        </form>
      </div>

      {/* Colonna: Ricerca Rapida e Supporto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="admin-walkin-card">
          <h2>🔍 Cerca Ospite / Recupero Pass</h2>
          <p style={{ fontSize: '13px', color: '#695e52', margin: '0 0 14px', lineHeight: 1.45 }}>
            Cerca per telefono, cognome o codice per aprire subito la scheda check-in o uscita.
          </p>

          <form onSubmit={handleSearch} className="staff-search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Telefono, nome o codice..."
            />
            <button type="submit" disabled={searchLoading} className="staff-search-btn">
              {searchLoading ? '...' : 'Cerca'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              {searchResults.map((item) => (
                <div key={item.id} className="staff-search-result-item">
                  <div>
                    <strong>{item.name}</strong> ({item.phone})
                    <div style={{ fontSize: '11px', color: '#746d64', marginTop: '2px' }}>
                      Cod: {item.registrationCode} · Stato: <span style={{ fontWeight: 600 }}>{item.status}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/checkin/${item.token}`)}
                    className="staff-open-sheet-btn"
                  >
                    Apri Scheda →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: '#f8f5ee',
            border: '1px solid #ddd7ce',
            padding: '16px 18px',
            fontSize: '13px',
            color: '#55483c',
            lineHeight: 1.5,
            borderRadius: '4px',
          }}
        >
          <strong style={{ display: 'block', color: 'var(--navy)', marginBottom: '6px' }}>
            💡 Suggerimento per l’accoglienza
          </strong>
          Se l’ospite preferisce registrarsi da solo dal proprio smartphone, mostragli il QR cartaceo del desk che punta a:
          <div
            style={{
              background: 'white',
              padding: '10px',
              border: '1px solid #ddd',
              marginTop: '6px',
              fontFamily: 'monospace',
              fontSize: '12px',
              wordBreak: 'break-all',
            }}
          >
            https://www.damaigarden.it/open-days/walk-in
          </div>
        </div>
      </div>
    </div>
  );
}

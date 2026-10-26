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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '28px', alignItems: 'start' }}>
      {/* Colonna Sinistra: Form Inserimento Desk */}
      <div style={{ background: 'white', border: '1px solid #ddd7ce', padding: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--navy)', margin: '0 0 18px' }}>
          Nuovo Ospite Walk-In
        </h2>

        {error && (
          <div style={{ background: '#fdf2f0', border: '1px solid #eecbc6', color: 'var(--danger)', padding: '12px 14px', marginBottom: '18px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
                Nome *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nome ospite"
                required
                style={{ width: '100%', padding: '12px', border: '1px solid #ccc', fontSize: '15px' }}
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
                Cognome *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Cognome ospite"
                required
                style={{ width: '100%', padding: '12px', border: '1px solid #ccc', fontSize: '15px' }}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
              Cellulare *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Numero di telefono"
              required
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', fontSize: '15px' }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
              Tipo Evento *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #0a3157',
                    background: eventType === type ? '#0a3157' : 'white',
                    color: eventType === type ? 'white' : '#0a3157',
                    cursor: 'pointer',
                  }}
                  disabled={loading}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
              Accompagnatori (oltre al titolare)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {COMPANION_OPTIONS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCompanions(num)}
                  style={{
                    height: '40px',
                    fontSize: '15px',
                    fontWeight: 600,
                    border: '1px solid #0a3157',
                    background: companions === num ? '#0a3157' : 'white',
                    color: companions === num ? '#efc64c' : '#0a3157',
                    cursor: 'pointer',
                  }}
                  disabled={loading}
                >
                  {num === 5 ? '5+' : num}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: '#746d64', marginTop: '4px', display: 'block' }}>
              Totale persone nel gruppo: <strong>{1 + companions}</strong>
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
              Email (Opzionale)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Lascia vuoto se l'ospite non la fornisce"
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', fontSize: '14px' }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#695e52', marginBottom: '6px' }}>
              Note desk (Opzionali)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. arrivati con coppia di amici"
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', fontSize: '14px' }}
              disabled={loading}
            />
          </div>

          {/* Toggle check-in immediato */}
          <div style={{ background: '#f8f5ee', border: '1px solid #dfd5c4', padding: '14px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={immediateCheckin}
                onChange={(e) => setImmediateCheckin(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--navy)' }}
                disabled={loading}
              />
              <span>Conferma ingresso immediatamente (Check-in IN)</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: '#695e52' }}>
              Se attivo, l&apos;ospite viene registrato direttamente come &ldquo;Presente&rdquo; e sarai reindirizzato alla schermata check-in.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#0a3157',
              color: '#efc64c',
              border: 'none',
              padding: '16px',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '6px',
            }}
          >
            {loading ? 'Registrazione in corso...' : 'Registra Ospite al Desk'}
          </button>
        </form>
      </div>

      {/* Colonna Destra: Ricerca Rapida e Recupero Pass */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: 'white', border: '1px solid #ddd7ce', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--navy)', margin: '0 0 12px' }}>
            🔍 Cerca Ospite / Recupero Pass
          </h2>
          <p style={{ fontSize: '13px', color: '#695e52', margin: '0 0 14px' }}>
            Cerca per telefono, cognome o codice per aprire subito la scheda check-in o uscita.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Telefono, nome o codice..."
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #ccc', fontSize: '14px' }}
            />
            <button
              type="submit"
              disabled={searchLoading}
              style={{
                background: '#a87423',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {searchLoading ? '...' : 'Cerca'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e2ddd5',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong>{item.name}</strong> ({item.phone})
                    <div style={{ fontSize: '11px', color: '#746d64' }}>
                      Cod: {item.registrationCode} · Stato: <span style={{ fontWeight: 600 }}>{item.status}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/checkin/${item.token}`)}
                    style={{
                      background: '#0a3157',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Apri Scheda →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#f5f3ef', border: '1px solid #ddd7ce', padding: '20px', fontSize: '13px', color: '#55483c', lineHeight: 1.5 }}>
          <strong style={{ display: 'block', color: 'var(--navy)', marginBottom: '6px' }}>
            💡 Suggerimento per l’accoglienza
          </strong>
          Se l’ospite preferisce registrarsi da solo dal proprio smartphone, mostragli il QR cartaceo del desk che punta a:
          <div style={{ background: 'white', padding: '8px', border: '1px solid #ddd', marginTop: '6px', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
            https://www.damaigarden.it/open-days/walk-in
          </div>
        </div>
      </div>
    </div>
  );
}

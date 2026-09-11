'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Slot = {
  id: string;
  eventDate: string;
  startTime: string;
  capacity: number;
  used: number;
  remaining: number;
};

const EVENT_TYPES = ['Matrimonio','18° compleanno','Comunione','Battesimo','Laurea','Anniversario','Evento aziendale','Altro'];

export default function RegistrationForm() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [error, setError] = useState('');

  async function loadSlots() {
    setSlotsLoading(true);
    setSlotsError('');
    try {
      const response = await fetch('/api/slots', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Servizio non disponibile');
      if (!Array.isArray(data.slots) || data.slots.length === 0) throw new Error('Nessuna fascia disponibile');
      setSlots(data.slots);
    } catch {
      setSlots([]);
      setSlotsError('Gli orari non sono disponibili in questo momento. Riprova tra pochi secondi.');
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSlots);
  }, []);

  const byDay = useMemo(() => {
    return slots.reduce<Record<string, Slot[]>>((acc, slot) => {
      (acc[slot.eventDate] ||= []).push(slot);
      return acc;
    }, {});
  }, [slots]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!slotId) return setError('Seleziona prima giorno e orario di arrivo.');
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const url = new URL(window.location.href);
    const payload = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      eventType: fd.get('eventType'),
      plannedEventDate: fd.get('plannedEventDate'),
      guestCount: fd.get('guestCount') ? Number(fd.get('guestCount')) : undefined,
      companions: Number(fd.get('companions') || 0),
      source: fd.get('source') || undefined,
      notes: fd.get('notes') || undefined,
      slotId,
      privacyConsent: fd.get('privacyConsent') === 'on',
      marketingConsent: fd.get('marketingConsent') === 'on',
      utmSource: url.searchParams.get('utm_source') || undefined,
      utmMedium: url.searchParams.get('utm_medium') || undefined,
      utmCampaign: url.searchParams.get('utm_campaign') || undefined,
    };

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registrazione non riuscita.');
      window.location.href = `/open-days?ticket=${encodeURIComponent(data.qrToken)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita.');
      setLoading(false);
    }
  }

  const formatDay = (value: string) => new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long' }).format(new Date(`${value}T12:00:00`));

  return (
    <form onSubmit={submit} className="form-main">
      <div className="grid">
        <div className="field"><label htmlFor="firstName">Nome *</label><input id="firstName" name="firstName" required minLength={2} autoComplete="given-name" /></div>
        <div className="field"><label htmlFor="lastName">Cognome *</label><input id="lastName" name="lastName" required minLength={2} autoComplete="family-name" /></div>
        <div className="field"><label htmlFor="phone">Telefono *</label><input id="phone" name="phone" type="tel" required autoComplete="tel" /></div>
        <div className="field"><label htmlFor="email">Email *</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="eventType">Tipologia di evento *</label><select id="eventType" name="eventType" required defaultValue=""><option value="" disabled>Seleziona</option>{EVENT_TYPES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="plannedEventDate">Data prevista dell'evento</label><input id="plannedEventDate" name="plannedEventDate" type="date" /></div>
        <div className="field"><label htmlFor="guestCount">Numero indicativo ospiti</label><input id="guestCount" name="guestCount" type="number" min="1" max="1000" placeholder="Es. 120" /></div>
        <div className="field"><label htmlFor="companions">Accompagnatori Open Day</label><select id="companions" name="companions" defaultValue="0">{Array.from({length:6},(_,i)=><option value={i} key={i}>{i}</option>)}</select></div>
        <div className="field full"><label htmlFor="source">Come hai conosciuto l'evento?</label><select id="source" name="source" defaultValue=""><option value="">Seleziona</option><option>Instagram</option><option>Facebook</option><option>Google</option><option>Passaparola</option><option>Già cliente / già visitato DAMAI</option><option>Altro</option></select></div>
        <div className="field full"><label htmlFor="notes">Note o esigenze particolari</label><textarea id="notes" name="notes" placeholder="Facoltativo" /></div>
        <div className="field full slots-area">
          <label>Giorno e fascia oraria di arrivo *</label>
          <p className="info">L'orario selezionato è l'orario di arrivo, non la durata della visita. La disponibilità viene aggiornata in tempo reale.</p>
          {slotsLoading && <div className="slots-message"><strong>Caricamento disponibilità…</strong>Stiamo verificando le fasce libere.</div>}
          {!slotsLoading && slotsError && <div className="slots-message"><strong>Disponibilità temporaneamente non caricata</strong>{slotsError}<br/><button type="button" className="retry" onClick={() => void loadSlots()}>Riprova ora</button></div>}
          {Object.entries(byDay).map(([day, daySlots]) => (
            <div key={day}>
              <div className="day-title">{formatDay(day)}</div>
              <div className="slot-grid">
                {daySlots.map(slot => <button type="button" key={slot.id} disabled={slot.remaining <= 0} aria-pressed={slotId===slot.id} className={`slot ${slotId===slot.id?'active':''}`} onClick={()=>setSlotId(slot.id)}>{slot.startTime.slice(0,5)}{slot.remaining <= 3 && slot.remaining > 0 ? ` · ${slot.remaining} posti` : ''}{slot.remaining <= 0 ? ' · Completo' : ''}</button>)}
              </div>
            </div>
          ))}
        </div>
        <div className="field full checks">
          <label className="check"><input name="privacyConsent" type="checkbox" required /> <span>Ho letto l’<a href="/open-days/privacy" target="_blank" rel="noopener noreferrer">informativa privacy</a> e acconsento al trattamento dei dati necessario alla gestione della registrazione e della visita. *</span></label>
          <label className="check"><input name="marketingConsent" type="checkbox" /> <span>Acconsento a ricevere comunicazioni commerciali e aggiornamenti da DAMAI. Facoltativo.</span></label>
        </div>
        {error && <div className="field full error" role="alert">{error}</div>}
        <div className="field full"><button className="submit" disabled={loading || slotsLoading || Boolean(slotsError)}>{loading ? 'Registrazione in corso…' : slotsLoading ? 'Caricamento orari…' : 'Invia la registrazione'}</button></div>
      </div>
    </form>
  );
}

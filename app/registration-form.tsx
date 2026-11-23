'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BOOKING_VENUES } from '@/lib/event';

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
  const [bookingVenue, setBookingVenue] = useState('');
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
    if (!slotId) return setError('Seleziona prima giorno e fascia oraria.');
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    if (Number(fd.get('children') || 0) > Number(fd.get('companions') || 0)) {
      setLoading(false);
      return setError('Il numero di bambini non può superare quello degli accompagnatori.');
    }
    const url = new URL(window.location.href);
    const payload = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      eventType: fd.get('eventType') || undefined,
      plannedEventDate: fd.get('plannedEventDate'),
      guestCount: fd.get('guestCount') ? Number(fd.get('guestCount')) : undefined,
      existingBookingVenue: bookingVenue || undefined,
      existingBookingDate: bookingVenue ? fd.get('existingBookingDate') || undefined : undefined,
      companions: Number(fd.get('companions') || 0),
      children: Number(fd.get('children') || 0),
      website: fd.get('website') || undefined,
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
      window.location.href = `/ticket/${encodeURIComponent(data.qrToken)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita.');
      setLoading(false);
    }
  }

  const formatDay = (value: string) => new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long' }).format(new Date(`${value}T12:00:00`));

  return (
    <form onSubmit={submit} className="form-main">
      {/* Honeypot anti-bot: invisibile agli ospiti, deve restare vuoto. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="website">Sito web</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid">
        <div className="field"><label htmlFor="firstName">Nome *</label><input id="firstName" name="firstName" required minLength={2} autoComplete="given-name" /></div>
        <div className="field"><label htmlFor="lastName">Cognome *</label><input id="lastName" name="lastName" required minLength={2} autoComplete="family-name" /></div>
        <div className="field"><label htmlFor="phone">Telefono *</label><input id="phone" name="phone" type="tel" required autoComplete="tel" /></div>
        <div className="field"><label htmlFor="email">Email *</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="eventType">Stai pensando a un evento al Damai? (facoltativo)</label><select id="eventType" name="eventType" defaultValue=""><option value="">No, vengo per il Christmas Village</option>{EVENT_TYPES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="plannedEventDate">Data prevista dell'evento</label><input id="plannedEventDate" name="plannedEventDate" type="date" /></div>
        <div className="field"><label htmlFor="guestCount">Numero indicativo ospiti</label><input id="guestCount" name="guestCount" type="number" min="1" max="1000" placeholder="Es. 120" /></div>
        <div className="field"><label htmlFor="existingBookingVenue">Hai già un evento prenotato presso le nostre strutture?</label><select id="existingBookingVenue" name="existingBookingVenue" value={bookingVenue} onChange={event => setBookingVenue(event.target.value)}><option value="">No</option>{BOOKING_VENUES.map(venue => <option key={venue} value={venue}>Sì, presso {venue}</option>)}</select></div>
        {bookingVenue && <div className="field full"><label htmlFor="existingBookingDate">Data dell&apos;evento prenotato *</label><input id="existingBookingDate" name="existingBookingDate" type="date" required /></div>}
        <div className="field"><label htmlFor="companions">Accompagnatori (bambini compresi)</label><select id="companions" name="companions" defaultValue="0">{Array.from({length:11},(_,i)=><option value={i} key={i}>{i}</option>)}</select></div>
        <div className="field"><label htmlFor="children">Di cui bambini</label><select id="children" name="children" defaultValue="0">{Array.from({length:11},(_,i)=><option value={i} key={i}>{i}</option>)}</select></div>
        <div className="field full"><label htmlFor="source">Come hai conosciuto l'evento?</label><select id="source" name="source" defaultValue=""><option value="">Seleziona</option><option>Volantino</option><option>Instagram</option><option>Facebook</option><option>Google</option><option>Passaparola</option><option>Già cliente / già visitato DAMAI</option><option>Altro</option></select></div>
        <div className="field full"><label htmlFor="notes">Note o esigenze particolari</label><textarea id="notes" name="notes" placeholder="Facoltativo" /></div>
        <div className="field full slots-area">
          <label>Giorno e fascia oraria *</label>
          <p className="info">Ogni fascia prevede 30 minuti di permanenza all&apos;interno del villaggio: scegli il tuo orario e presentati puntuale. La disponibilità viene aggiornata in tempo reale.</p>
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
          <label className="check"><input name="privacyConsent" type="checkbox" required /> <span>Ho letto l’<a href="/privacy" target="_blank" rel="noopener noreferrer">informativa privacy</a> e acconsento al trattamento dei dati necessario alla gestione della registrazione e della visita. *</span></label>
          <label className="check"><input name="marketingConsent" type="checkbox" /> <span>Sì, voglio ricevere in anteprima le date 2027, gli eventi Damai e le condizioni riservate a chi ha partecipato al Christmas Village, anche tramite annunci personalizzati su Facebook e Instagram. (facoltativo)</span></label>
        </div>
        {error && <div className="field full error" role="alert">{error}</div>}
        <div className="field full"><button className="submit" disabled={loading || slotsLoading || Boolean(slotsError)}>{loading ? 'Registrazione in corso…' : slotsLoading ? 'Caricamento orari…' : 'Invia la registrazione'}</button></div>
      </div>
    </form>
  );
}

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
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/slots', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setSlots(data.slots ?? []))
      .catch(() => setError('Non riusciamo a caricare gli orari. Riprova tra qualche secondo.'));
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
      window.location.href = `/ticket/${data.qrToken}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita.');
      setLoading(false);
    }
  }

  const formatDay = (value: string) => new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long' }).format(new Date(`${value}T12:00:00`));

  return (
    <form onSubmit={submit} className="form-main">
      <div className="grid">
        <div className="field"><label>Nome *</label><input name="firstName" required minLength={2} autoComplete="given-name" /></div>
        <div className="field"><label>Cognome *</label><input name="lastName" required minLength={2} autoComplete="family-name" /></div>
        <div className="field"><label>Telefono *</label><input name="phone" type="tel" required autoComplete="tel" /></div>
        <div className="field"><label>Email *</label><input name="email" type="email" required autoComplete="email" /></div>
        <div className="field"><label>Tipologia di evento *</label><select name="eventType" required defaultValue=""><option value="" disabled>Seleziona</option>{EVENT_TYPES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Data prevista dell'evento</label><input name="plannedEventDate" type="date" /></div>
        <div className="field"><label>Numero indicativo ospiti</label><input name="guestCount" type="number" min="1" max="1000" placeholder="Es. 120" /></div>
        <div className="field"><label>Accompagnatori Open Day</label><select name="companions" defaultValue="0">{Array.from({length:6},(_,i)=><option value={i} key={i}>{i}</option>)}</select></div>
        <div className="field full"><label>Come hai conosciuto l'evento?</label><select name="source" defaultValue=""><option value="">Seleziona</option><option>Instagram</option><option>Facebook</option><option>Google</option><option>Passaparola</option><option>Già cliente / già visitato DAMAI</option><option>Altro</option></select></div>
        <div className="field full"><label>Note o esigenze particolari</label><textarea name="notes" placeholder="Facoltativo" /></div>
        <div className="field full">
          <label>Giorno e fascia oraria di arrivo *</label>
          <p className="info">L'orario selezionato è l'orario di arrivo, non la durata della visita. La disponibilità viene aggiornata in tempo reale.</p>
          {Object.entries(byDay).map(([day, daySlots]) => (
            <div key={day}>
              <div className="day-title">{formatDay(day)}</div>
              <div className="slot-grid">
                {daySlots.map(slot => <button type="button" key={slot.id} disabled={slot.remaining <= 0} className={`slot ${slotId===slot.id?'active':''}`} onClick={()=>setSlotId(slot.id)}>{slot.startTime.slice(0,5)}{slot.remaining <= 3 && slot.remaining > 0 ? ` · ${slot.remaining} posti` : ''}{slot.remaining <= 0 ? ' · Completo' : ''}</button>)}
              </div>
            </div>
          ))}
        </div>
        <div className="field full checks">
          <label className="check"><input name="privacyConsent" type="checkbox" required /> <span>Ho letto l'informativa privacy e acconsento al trattamento dei dati necessario alla gestione della registrazione e della visita. *</span></label>
          <label className="check"><input name="marketingConsent" type="checkbox" /> <span>Acconsento a ricevere comunicazioni commerciali e aggiornamenti da DAMAI. Facoltativo.</span></label>
        </div>
        {error && <div className="field full error">{error}</div>}
        <div className="field full"><button className="submit" disabled={loading}>{loading ? 'Registrazione in corso…' : 'Invia la registrazione'}</button></div>
      </div>
    </form>
  );
}
